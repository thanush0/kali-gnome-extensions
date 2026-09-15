/* extension.js
 *
 * Clipboard History for GNOME Shell 50 (Wayland-safe)
 * UUID: clipboard-history@thanush
 *
 * Super+Z toggles a Windows 11 style clipboard history popup.
 * The popup NEVER auto-opens on enable / login / reload.
 */

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const LOG_PREFIX = 'Clipboard History:';
const POLL_INTERVAL_MS = 500;
const HISTORY_DIRNAME = 'clipboard-history';
const HISTORY_FILENAME = 'history.json';
const MAX_ITEM_PREVIEW_CHARS = 300;
const POPUP_WIDTH = 400;

function log(msg) {
    console.log(`${LOG_PREFIX} ${msg}`);
}

function logError(e, msg) {
    console.error(`${LOG_PREFIX} ${msg ?? ''}`, e);
}

/* ---------- time formatting ---------- */
function formatRelativeTime(timestampMs) {
    const diffSec = Math.max(0, Math.floor((Date.now() - timestampMs) / 1000));
    if (diffSec < 5)
        return 'Copied just now';
    if (diffSec < 60)
        return `${diffSec} seconds ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60)
        return diffMin === 1 ? '1 minute ago' : `${diffMin} minutes ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24)
        return diffHour === 1 ? '1 hour ago' : `${diffHour} hours ago`;
    const diffDay = Math.floor(diffHour / 24);
    return diffDay === 1 ? '1 day ago' : `${diffDay} days ago`;
}

/* =========================================================
 *  ClipboardHistoryPopup
 *  A self-contained, non-panel-anchored modal popup.
 * ========================================================= */
class ClipboardHistoryPopup {
    constructor(extensionObj) {
        this._ext = extensionObj;
        this._isOpen = false;
        this._actor = null;
        this._itemRows = [];
        this._filteredItems = [];
        this._selectedIndex = -1;
        this._grabbed = false;

        this._clickCatcher = null;
        this._clickCatcherPressId = 0;
        this._keyPressId = 0;
        this._focusWindowId = 0;
        this._workspaceSwitchId = 0;
    }

    get isOpen() {
        return this._isOpen;
    }

    toggle() {
        if (this._isOpen)
            this.close();
        else
            this.open();
    }

    open() {
        if (this._isOpen)
            return;

        this._buildActor();
        this._populateItems(this._ext.history, '');
        this._position();

        Main.layoutManager.uiGroup.add_child(this._actor);
        this._actor.opacity = 0;
        this._actor.ease({
            opacity: 255,
            duration: 120,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });

        this._isOpen = true;
        this._grabInput();
        this._connectAutoClose();

        if (this._filteredItems.length > 0)
            this._setSelection(0);

        this._searchEntry.grab_key_focus();
        log('popup opened');
    }

    close() {
        if (!this._isOpen)
            return;

        this._isOpen = false;
        this._ungrabInput();
        this._disconnectAutoClose();

        const actor = this._actor;
        this._actor = null;
        this._itemRows = [];
        this._filteredItems = [];
        this._selectedIndex = -1;

        if (actor) {
            actor.ease({
                opacity: 0,
                duration: 100,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onStopped: () => actor.destroy(),
            });
        }
        log('popup closed');
    }

    destroy() {
        // Hard close without animation, used from disable().
        this._isOpen = false;
        this._ungrabInput();
        this._disconnectAutoClose();
        if (this._actor) {
            this._actor.destroy();
            this._actor = null;
        }
        this._itemRows = [];
        this._filteredItems = [];
    }

    /* ---------- input grabbing ---------- */

    _grabInput() {
        // Shell.ActionMode.POPUP is what GNOME's own popups (calendar,
        // quick settings, app menu, etc.) use for exactly this pattern:
        // grab input, but still let Escape and outside clicks dismiss
        // it cleanly. Meta.KeyBindingMode was the wrong enum here and
        // left the grab in a broken state that never released properly
        // - that's what was blocking all other windows.
        this._grab = Main.pushModal(this._actor, {
            actionMode: Shell.ActionMode.POPUP,
        });
        this._grabbed = !!this._grab;
        if (!this._grabbed)
            logError(new Error('pushModal failed'), 'could not grab input');
    }

    _ungrabInput() {
        if (this._grabbed && this._grab) {
            Main.popModal(this._grab);
            this._grabbed = false;
            this._grab = null;
        }
    }

    _connectAutoClose() {
        // Full-screen invisible actor placed BEHIND the popup. Because
        // the popup sits on top of it, clicks land on popup items first;
        // any click that misses the popup falls through to this catcher
        // and closes the menu. This is far more reliable than trying to
        // hit-test 'contains()' on captured stage events.
        const monitor = Main.layoutManager.primaryMonitor;
        this._clickCatcher = new St.Widget({
            reactive: true,
            x: monitor ? monitor.x : 0,
            y: monitor ? monitor.y : 0,
            width: monitor ? monitor.width : global.stage.width,
            height: monitor ? monitor.height : global.stage.height,
        });
        Main.layoutManager.uiGroup.insert_child_below(this._clickCatcher, this._actor);
        this._clickCatcherPressId = this._clickCatcher.connect('button-press-event', () => {
            this.close();
            return Clutter.EVENT_STOP;
        });

        // Keyboard handling (Escape/Tab/Space/arrows/Enter) while grabbed.
        this._keyPressId = global.stage.connect('key-press-event',
            (actor, event) => this._onKeyPress(event));

        // Close on focused-window change (app switch) - catches cases
        // like Alt+Tab that don't go through the click catcher at all.
        this._focusWindowId = global.display.connect('notify::focus-window', () => {
            this.close();
        });

        // Close on workspace switch.
        this._workspaceSwitchId = global.workspace_manager.connect('active-workspace-changed', () => {
            this.close();
        });
    }

    _disconnectAutoClose() {
        if (this._clickCatcher) {
            if (this._clickCatcherPressId)
                this._clickCatcher.disconnect(this._clickCatcherPressId);
            this._clickCatcher.destroy();
            this._clickCatcher = null;
            this._clickCatcherPressId = 0;
        }
        if (this._keyPressId) {
            global.stage.disconnect(this._keyPressId);
            this._keyPressId = 0;
        }
        if (this._focusWindowId) {
            global.display.disconnect(this._focusWindowId);
            this._focusWindowId = 0;
        }
        if (this._workspaceSwitchId) {
            global.workspace_manager.disconnect(this._workspaceSwitchId);
            this._workspaceSwitchId = 0;
        }
    }

    _onKeyPress(event) {
        const symbol = event.get_key_symbol();

        switch (symbol) {
        case Clutter.KEY_Escape:
            this.close();
            return Clutter.EVENT_STOP;

        case Clutter.KEY_Tab:
        case Clutter.KEY_ISO_Left_Tab:
            this.close();
            return Clutter.EVENT_STOP;

        case Clutter.KEY_space:
            // Only treat as "close" if focus isn't in the search entry
            // (so users can still type a space in their search).
            if (!this._searchEntry.has_key_focus()) {
                this.close();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;

        case Clutter.KEY_Down:
            this._moveSelection(1);
            return Clutter.EVENT_STOP;

        case Clutter.KEY_Up:
            this._moveSelection(-1);
            return Clutter.EVENT_STOP;

        case Clutter.KEY_Return:
        case Clutter.KEY_KP_Enter:
            this._activateSelection();
            return Clutter.EVENT_STOP;
        }

        return Clutter.EVENT_PROPAGATE;
    }

    /* ---------- layout / positioning ---------- */

    _position() {
        const monitor = Main.layoutManager.primaryMonitor;
        if (!monitor || !this._actor)
            return;

        // Fix the width first. Letting St measure "natural" width off
        // unwrapped item labels (e.g. a long copied line) makes the
        // popup balloon out to the width of its longest entry - so we
        // pin the width and let labels wrap inside it instead.
        const width = Math.min(POPUP_WIDTH, monitor.width - 32);
        this._actor.set_width(width);

        const maxHeight = monitor.height - 64;
        const [, naturalHeight] = this._actor.get_preferred_height(width);
        const height = Math.min(naturalHeight, maxHeight);

        this._actor.set_height(height);

        let x = monitor.x + 16;
        let y = monitor.y + monitor.height - height - 16;

        // Clamp inside monitor bounds just in case.
        x = Math.max(monitor.x, Math.min(x, monitor.x + monitor.width - width));
        y = Math.max(monitor.y, Math.min(y, monitor.y + monitor.height - height));

        this._actor.set_position(x, y);

        // Cap the scroll area so the whole popup respects maxHeight.
        this._scrollView.set_style(`max-height: ${Math.max(120, maxHeight - 140)}px;`);
    }

    /* ---------- UI construction ---------- */

    _buildActor() {
        this._actor = new St.BoxLayout({
            style_class: 'clipboard-history-popup',
            vertical: true,
            reactive: true,
            can_focus: true,
        });

        // Header
        const header = new St.BoxLayout({
            style_class: 'clipboard-history-header',
            vertical: false,
        });
        const headerLabel = new St.Label({
            style_class: 'clipboard-history-title',
            text: 'Clipboard history',
            y_align: Clutter.ActorAlign.CENTER,
        });
        header.add_child(headerLabel);
        this._actor.add_child(header);

        // Search entry
        this._searchEntry = new St.Entry({
            style_class: 'clipboard-history-search',
            hint_text: 'Search clipboard history',
            can_focus: true,
            track_hover: true,
        });
        this._searchEntry.clutter_text.connect('text-changed', () => {
            this._onSearchChanged();
        });
        this._actor.add_child(this._searchEntry);

        // Scrollable list
        this._scrollView = new St.ScrollView({
            style_class: 'clipboard-history-scroll',
            hscrollbar_policy: St.PolicyType.NEVER,
            vscrollbar_policy: St.PolicyType.AUTOMATIC,
        });
        this._listBox = new St.BoxLayout({
            style_class: 'clipboard-history-list',
            vertical: true,
        });
        this._scrollView.add_child(this._listBox);
        this._actor.add_child(this._scrollView);

        // Empty state
        this._emptyLabel = new St.Label({
            style_class: 'clipboard-history-empty',
            text: 'No clipboard history yet',
            visible: false,
        });
        this._actor.add_child(this._emptyLabel);

        // Footer
        const footer = new St.BoxLayout({
            style_class: 'clipboard-history-footer',
            vertical: false,
        });
        const spacer = new St.Widget();
        spacer.set_x_expand(true);
        const clearButton = new St.Button({
            style_class: 'clipboard-history-clear-button',
            label: 'Clear all',
            can_focus: true,
            track_hover: true,
        });
        clearButton.connect('clicked', () => this._onClearAll());
        footer.add_child(spacer);
        footer.add_child(clearButton);
        this._actor.add_child(footer);
    }

    _onSearchChanged() {
        const query = this._searchEntry.get_text().trim().toLowerCase();
        this._populateItems(this._ext.history, query);
        this._position();
        if (this._filteredItems.length > 0)
            this._setSelection(0);
        else
            this._selectedIndex = -1;
    }

    _populateItems(history, query) {
        this._listBox.destroy_all_children();
        this._itemRows = [];

        this._filteredItems = query
            ? history.filter(item => item.text.toLowerCase().includes(query))
            : history;

        this._emptyLabel.visible = this._filteredItems.length === 0;
        this._scrollView.visible = this._filteredItems.length > 0;

        this._filteredItems.forEach((item, index) => {
            const row = this._buildRow(item, index);
            this._listBox.add_child(row);
            this._itemRows.push(row);
        });
    }

    _buildRow(item, index) {
        const row = new St.BoxLayout({
            style_class: 'clipboard-history-item',
            vertical: false,
            reactive: true,
            track_hover: true,
            can_focus: true,
        });

        const textBox = new St.BoxLayout({
            vertical: true,
            x_expand: true,
        });

        let preview = item.text.replace(/\s+/g, ' ').trim();
        if (preview.length > MAX_ITEM_PREVIEW_CHARS)
            preview = `${preview.slice(0, MAX_ITEM_PREVIEW_CHARS)}…`;

        const textLabel = new St.Label({
            style_class: 'clipboard-history-item-text',
            text: preview,
        });
        textLabel.clutter_text.set_line_wrap(true);

        const timeLabel = new St.Label({
            style_class: 'clipboard-history-item-time',
            text: formatRelativeTime(item.timestamp),
        });

        textBox.add_child(textLabel);
        textBox.add_child(timeLabel);
        row.add_child(textBox);

        const deleteButton = new St.Button({
            style_class: 'clipboard-history-delete-button',
            child: new St.Icon({
                icon_name: 'edit-delete-symbolic',
                style_class: 'clipboard-history-delete-icon',
            }),
            can_focus: true,
            track_hover: true,
        });
        deleteButton.connect('clicked', () => {
            this._ext.removeHistoryItem(item.id);
            this._populateItems(this._ext.history, this._searchEntry.get_text().trim().toLowerCase());
            this._position();
        });
        row.add_child(deleteButton);

        row.connect('button-press-event', () => {
            this._selectItem(index);
            return Clutter.EVENT_STOP;
        });
        row.connect('enter-event', () => {
            this._setSelection(index);
        });

        return row;
    }

    _setSelection(index) {
        if (this._selectedIndex >= 0 && this._itemRows[this._selectedIndex])
            this._itemRows[this._selectedIndex].remove_style_class_name('selected');

        this._selectedIndex = index;

        if (index >= 0 && this._itemRows[index]) {
            this._itemRows[index].add_style_class_name('selected');
            this._scrollSelectedIntoView(this._itemRows[index]);
        }
    }

    _scrollSelectedIntoView(row) {
        try {
            const adjustment = this._scrollView.get_vscroll_bar()?.get_adjustment();
            if (!adjustment)
                return;
            const box = row.get_allocation_box();
            const rowTop = box.y1;
            const rowBottom = box.y2;
            const visibleTop = adjustment.get_value();
            const visibleBottom = visibleTop + adjustment.get_page_size();

            if (rowTop < visibleTop)
                adjustment.set_value(rowTop);
            else if (rowBottom > visibleBottom)
                adjustment.set_value(rowBottom - adjustment.get_page_size());
        } catch (e) {
            // Best-effort only; not critical if scrolling doesn't adjust.
        }
    }

    _moveSelection(delta) {
        if (this._itemRows.length === 0)
            return;
        let next = this._selectedIndex + delta;
        if (next < 0)
            next = 0;
        if (next >= this._itemRows.length)
            next = this._itemRows.length - 1;
        this._setSelection(next);
    }

    _activateSelection() {
        if (this._selectedIndex >= 0)
            this._selectItem(this._selectedIndex);
    }

    _selectItem(index) {
        const item = this._filteredItems[index];
        if (!item)
            return;
        this._ext.restoreToClipboard(item.text);
        this.close();
    }

    _onClearAll() {
        if (this._confirmingClear) {
            this._ext.clearHistory();
            this._confirmingClear = false;
            this._populateItems(this._ext.history, '');
            this._position();
            return;
        }
        // Simple confirmation step: require a second click within a few seconds.
        this._confirmingClear = true;
        const btn = this._actor.get_last_child().get_last_child();
        if (btn && btn.label !== undefined)
            btn.label = 'Confirm clear?';
        GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 3, () => {
            this._confirmingClear = false;
            if (btn && btn.label !== undefined && this._actor)
                btn.label = 'Clear all';
            return GLib.SOURCE_REMOVE;
        });
    }
}

/* =========================================================
 *  Extension entry point
 * ========================================================= */
export default class ClipboardHistoryExtension extends Extension {
    enable() {
        this._settings = this.getSettings('org.gnome.shell.extensions.clipboard-history');
        this.history = [];
        this._lastClipboardText = null;
        this._pollSourceId = 0;
        this._saveTimeoutId = 0;
        this._nextId = 1;

        this._historyDir = GLib.build_filenamev(
            [GLib.get_home_dir(), '.local', 'share', 'gnome-shell', HISTORY_DIRNAME]);
        this._historyFile = GLib.build_filenamev([this._historyDir, HISTORY_FILENAME]);

        this._loadHistory();

        this._popup = new ClipboardHistoryPopup(this);

        this._registerKeybinding();
        this._startClipboardMonitoring();

        log('extension enabled');
    }

    disable() {
        this._removeKeybinding();
        this._stopClipboardMonitoring();

        if (this._saveTimeoutId) {
            GLib.source_remove(this._saveTimeoutId);
            this._saveTimeoutId = 0;
        }
        this._saveHistorySync();

        if (this._popup) {
            this._popup.destroy();
            this._popup = null;
        }

        this._settings = null;
        this.history = [];

        log('extension disabled');
    }

    /* ---------- keybinding ---------- */

    _registerKeybinding() {
        try {
            Main.wm.addKeybinding(
                'clipboard-hotkey',
                this._settings,
                Meta.KeyBindingFlags.NONE,
                Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
                () => this._toggleMenu()
            );
            log('keybinding registered');
        } catch (e) {
            logError(e, 'failed to register keybinding');
        }
    }

    _removeKeybinding() {
        try {
            Main.wm.removeKeybinding('clipboard-hotkey');
        } catch (e) {
            // Not fatal - keybinding may not have been registered.
        }
    }

    _toggleMenu() {
        if (!this._popup)
            return;
        this._popup.toggle();
    }

    /* ---------- clipboard monitoring ---------- */

    _startClipboardMonitoring() {
        this._pollSourceId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT, POLL_INTERVAL_MS, () => {
                this._checkClipboard();
                return GLib.SOURCE_CONTINUE;
            });
    }

    _stopClipboardMonitoring() {
        if (this._pollSourceId) {
            GLib.source_remove(this._pollSourceId);
            this._pollSourceId = 0;
        }
    }

    _checkClipboard() {
        try {
            const clipboard = St.Clipboard.get_default();
            clipboard.get_text(St.ClipboardType.CLIPBOARD, (_clip, text) => {
                if (!text)
                    return;
                if (text === this._lastClipboardText)
                    return;
                this._lastClipboardText = text;
                this._addHistoryItem(text);
            });
        } catch (e) {
            logError(e, 'clipboard poll failed');
        }
    }

    _addHistoryItem(text) {
        if (!this._settings.get_boolean('enabled'))
            return;
        if (!text || text.trim().length === 0)
            return;

        // Deduplicate: if it already exists anywhere, move it to top.
        const existingIndex = this.history.findIndex(item => item.text === text);
        if (existingIndex !== -1)
            this.history.splice(existingIndex, 1);

        this.history.unshift({
            id: this._nextId++,
            text,
            timestamp: Date.now(),
        });

        const maxHistory = this._settings.get_int('max-history');
        if (this.history.length > maxHistory)
            this.history.length = maxHistory;

        this._scheduleSave();
        this._refreshPopupIfOpen();
    }

    removeHistoryItem(id) {
        this.history = this.history.filter(item => item.id !== id);
        this._scheduleSave();
    }

    clearHistory() {
        this.history = [];
        this._scheduleSave();
        log('history cleared');
    }

    restoreToClipboard(text) {
        try {
            St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, text);
            this._lastClipboardText = text;
        } catch (e) {
            logError(e, 'failed to restore clipboard text');
        }
    }

    _refreshPopupIfOpen() {
        if (this._popup && this._popup.isOpen) {
            this._popup._populateItems(this.history,
                this._popup._searchEntry.get_text().trim().toLowerCase());
            this._popup._position();
        }
    }

    /* ---------- persistence ---------- */

    _ensureHistoryDir() {
        const dir = Gio.File.new_for_path(this._historyDir);
        if (!dir.query_exists(null))
            dir.make_directory_with_parents(null);
    }

    _loadHistory() {
        try {
            const file = Gio.File.new_for_path(this._historyFile);
            if (!file.query_exists(null)) {
                this.history = [];
                return;
            }
            const [ok, contents] = file.load_contents(null);
            if (!ok) {
                this.history = [];
                return;
            }
            const text = new TextDecoder('utf-8').decode(contents);
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed)) {
                this.history = parsed;
                const maxId = this.history.reduce((m, it) => Math.max(m, it.id || 0), 0);
                this._nextId = maxId + 1;
            } else {
                this.history = [];
            }
        } catch (e) {
            logError(e, 'failed to load history');
            this.history = [];
        }
    }

    _scheduleSave() {
        if (this._saveTimeoutId)
            return;
        this._saveTimeoutId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT, 1, () => {
                this._saveTimeoutId = 0;
                this._saveHistorySync();
                return GLib.SOURCE_REMOVE;
            });
    }

    _saveHistorySync() {
        try {
            this._ensureHistoryDir();
            const file = Gio.File.new_for_path(this._historyFile);
            const data = JSON.stringify(this.history);
            file.replace_contents(
                data, null, false,
                Gio.FileCreateFlags.REPLACE_DESTINATION, null);
            log('history saved');
        } catch (e) {
            logError(e, 'failed to save history');
        }
    }
}
