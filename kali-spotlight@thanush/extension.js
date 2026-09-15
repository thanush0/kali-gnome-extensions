import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const WIDTH = 620;
const MAX_RESULTS = 8;
const OPEN_DURATION = 140;
const CLOSE_DURATION = 100;

// Matches things like "12*7", "(4+5)/3", "10 % 4"
const MATH_RE = /^[\d\s+\-*/().%]+$/;

export default class KaliSpotlight extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._focusLaterId = 0;
        this._clipboard = St.Clipboard.get_default();

        this._apps = Shell.AppSystem.get_default().get_installed()
            .filter(app => app.should_show())
            .sort((a, b) => a.get_name().localeCompare(b.get_name()));

        this._buildUi();

        Main.wm.addKeybinding(
            'hotkey',
            this._settings,
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
            () => this._toggle()
        );
    }

    disable() {
        Main.wm.removeKeybinding('hotkey');

        if (this._focusLaterId) {
            Meta.later_remove(this._focusLaterId);
            this._focusLaterId = 0;
        }

        if (this._open)
            this._close(true);

        this._destroyUi();
        this._settings = null;
        this._apps = null;
        this._clipboard = null;
    }

    _buildUi() {
        this._overlay = new St.Widget({
            reactive: true,
            visible: false,
            opacity: 0,
            x_expand: true,
            y_expand: true,
            style_class: 'kali-spotlight-overlay',
        });

        this._panel = new St.BoxLayout({
            vertical: true,
            width: WIDTH,
            opacity: 0,
            style_class: 'kali-spotlight-panel',
        });
        this._panel.set_pivot_point(0.5, 0.0);

        this._searchBox = new St.BoxLayout({
            style_class: 'kali-spotlight-search-box',
        });

        this._searchIcon = new St.Icon({
            icon_name: 'system-search-symbolic',
            style_class: 'kali-spotlight-search-icon',
        });

        this._entry = new St.Entry({
            hint_text: 'Search applications or type a calculation',
            can_focus: true,
            x_expand: true,
            style_class: 'kali-spotlight-entry',
        });

        this._searchBox.add_child(this._searchIcon);
        this._searchBox.add_child(this._entry);

        this._scroll = new St.ScrollView({
            style_class: 'kali-spotlight-scroll',
            overlay_scrollbars: true,
            x_expand: true,
            y_expand: false,
        });

        this._resultsBox = new St.BoxLayout({
            vertical: true,
            x_expand: true,
        });

        this._scroll.set_child(this._resultsBox);

        this._panel.add_child(this._searchBox);
        this._panel.add_child(this._scroll);
        this._overlay.add_child(this._panel);

        Main.layoutManager.uiGroup.add_child(this._overlay);

        this._entry.clutter_text.connect('text-changed', () => this._updateResults());

        this._entry.clutter_text.connect('key-press-event', (_actor, event) => {
            const symbol = event.get_key_symbol();

            if (symbol === Clutter.KEY_Escape) {
                this._close();
                return Clutter.EVENT_STOP;
            }

            if (symbol === Clutter.KEY_Down) {
                this._moveSelection(1);
                return Clutter.EVENT_STOP;
            }

            if (symbol === Clutter.KEY_Up) {
                this._moveSelection(-1);
                return Clutter.EVENT_STOP;
            }

            if (symbol === Clutter.KEY_Return || symbol === Clutter.KEY_KP_Enter) {
                this._activateSelected();
                return Clutter.EVENT_STOP;
            }

            return Clutter.EVENT_PROPAGATE;
        });

        this._overlay.connect('button-press-event', (_actor, event) => {
            const [x, y] = event.get_coords();
            const [px, py] = this._panel.get_transformed_position();
            const pw = this._panel.width;
            const ph = this._panel.height;

            if (x < px || x > px + pw || y < py || y > py + ph)
                this._close();

            return Clutter.EVENT_PROPAGATE;
        });

        this._updatePositionId = Main.layoutManager.connect('monitors-changed', () => {
            if (this._open)
                this._positionPanel();
        });

        this._selected = 0;
        this._resultApps = [];
        this._calcResult = null;
        this._open = false;
    }

    _destroyUi() {
        if (this._updatePositionId) {
            Main.layoutManager.disconnect(this._updatePositionId);
            this._updatePositionId = null;
        }

        if (this._overlay) {
            this._overlay.destroy();
            this._overlay = null;
        }
    }

    _positionPanel() {
        const monitor = Main.layoutManager.primaryMonitor;

        this._panel.set_position(
            Math.round(monitor.x + (monitor.width - WIDTH) / 2),
            Math.round(monitor.y + 90)
        );
    }

    _toggle() {
        if (this._open)
            this._close();
        else
            this._openSearch();
    }

    _openSearch() {
        this._open = true;

        this._overlay.remove_all_transitions();
        this._panel.remove_all_transitions();

        this._overlay.show();
        this._overlay.opacity = 0;
        this._panel.opacity = 0;
        this._panel.scale_y = 0.94;

        this._positionPanel();

        this._entry.set_text('');
        this._selected = 0;
        this._updateResults();

        Main.pushModal(this._overlay, {
            actionMode: Shell.ActionMode.POPUP,
        });

        this._overlay.ease({
            opacity: 255,
            duration: OPEN_DURATION,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });

        this._panel.ease({
            opacity: 255,
            scale_y: 1,
            duration: OPEN_DURATION,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });

        // Grabbing key focus has to happen once the actors are actually
        // mapped and the modal grab has settled, otherwise Wayland/Clutter
        // silently drops it and the user has to click the entry first.
        if (this._focusLaterId)
            Meta.later_remove(this._focusLaterId);

        this._focusLaterId = Meta.later_add(Meta.LaterType.BEFORE_REDRAW, () => {
            this._focusLaterId = 0;
            if (this._open) {
                global.stage.set_key_focus(this._entry.clutter_text);
                this._entry.clutter_text.set_selection(0, 0);
            }
            return GLib.SOURCE_REMOVE;
        });
    }

    _close(immediate = false) {
        if (!this._open)
            return;

        this._open = false;

        if (this._focusLaterId) {
            Meta.later_remove(this._focusLaterId);
            this._focusLaterId = 0;
        }

        try {
            Main.popModal(this._overlay);
        } catch (e) {
            log(`Kali Spotlight: modal cleanup: ${e}`);
        }

        if (immediate || !this._overlay) {
            this._overlay?.hide();
            return;
        }

        this._overlay.remove_all_transitions();
        this._panel.remove_all_transitions();

        this._panel.ease({
            opacity: 0,
            scale_y: 0.96,
            duration: CLOSE_DURATION,
            mode: Clutter.AnimationMode.EASE_IN_QUAD,
        });

        this._overlay.ease({
            opacity: 0,
            duration: CLOSE_DURATION,
            mode: Clutter.AnimationMode.EASE_IN_QUAD,
            onComplete: () => this._overlay?.hide(),
        });
    }

    _tryCalculate(query) {
        const trimmed = query.trim();

        if (trimmed.length < 3)
            return null;
        if (!MATH_RE.test(trimmed))
            return null;
        if (!/[0-9]/.test(trimmed) || !/[+\-*/%]/.test(trimmed))
            return null;

        try {
            // eslint-disable-next-line no-new-func
            const value = Function(`"use strict"; return (${trimmed});`)();
            if (typeof value !== 'number' || !Number.isFinite(value))
                return null;
            return Math.round(value * 1e10) / 1e10;
        } catch (e) {
            return null;
        }
    }

    _updateResults() {
        if (!this._resultsBox)
            return;

        const query = this._entry.get_text();
        const trimmedQuery = query.trim();
        const lowerQuery = trimmedQuery.toLowerCase();

        this._resultsBox.destroy_all_children();
        this._resultApps = [];
        this._calcResult = this._tryCalculate(query);

        if (this._calcResult !== null)
            this._addCalcRow(trimmedQuery, this._calcResult);

        let matches = this._apps.filter(app => {
            const name = app.get_name().toLowerCase();
            const description = (app.get_description() || '').toLowerCase();
            return !lowerQuery || name.includes(lowerQuery) || description.includes(lowerQuery);
        });

        matches = matches.slice(0, MAX_RESULTS);
        this._resultApps = matches;

        if (matches.length > 0) {
            this._resultsBox.add_child(new St.Label({
                text: 'Applications',
                style_class: 'kali-spotlight-section',
            }));

            for (let i = 0; i < matches.length; i++)
                this._addResult(matches[i], i);
        } else if (this._calcResult === null && trimmedQuery.length > 0) {
            this._resultsBox.add_child(new St.Label({
                text: 'No matching applications',
                style_class: 'kali-spotlight-empty',
            }));
        }

        this._selected = 0;
        this._refreshSelection();

        const hasContent = matches.length > 0 || this._calcResult !== null || trimmedQuery.length > 0;
        this._scroll.visible = hasContent;
        this._panel.height = -1;
    }

    _addCalcRow(expression, result) {
        const row = new St.Button({
            style_class: 'kali-spotlight-result kali-spotlight-calc',
            x_expand: true,
            reactive: true,
            can_focus: false,
        });

        const box = new St.BoxLayout({
            style_class: 'kali-spotlight-result-box',
        });

        const icon = new St.Icon({
            icon_name: 'accessories-calculator-symbolic',
            icon_size: 32,
        });

        const labels = new St.BoxLayout({
            vertical: true,
            y_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
        });

        labels.add_child(new St.Label({
            text: `${expression} = ${result}`,
            style_class: 'kali-spotlight-name',
        }));

        labels.add_child(new St.Label({
            text: 'Press Enter to copy result',
            style_class: 'kali-spotlight-description',
        }));

        box.add_child(icon);
        box.add_child(labels);
        row.set_child(box);

        row.connect('clicked', () => {
            this._selected = 0;
            this._activateSelected();
        });

        this._resultsBox.insert_child_at_index(row, 0);
    }

    _addResult(app, index) {
        const row = new St.Button({
            style_class: 'kali-spotlight-result',
            x_expand: true,
            reactive: true,
            can_focus: false,
        });

        const box = new St.BoxLayout({
            style_class: 'kali-spotlight-result-box',
        });

        const icon = new St.Icon({
            gicon: app.get_icon(),
            icon_size: 32,
        });

        const labels = new St.BoxLayout({
            vertical: true,
            y_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
        });

        const name = new St.Label({
            text: app.get_name(),
            style_class: 'kali-spotlight-name',
        });

        labels.add_child(name);

        const description = app.get_description();
        if (description) {
            labels.add_child(new St.Label({
                text: description,
                style_class: 'kali-spotlight-description',
            }));
        }

        box.add_child(icon);
        box.add_child(labels);
        row.set_child(box);

        const resultIndex = this._calcResult !== null ? index + 1 : index;

        row.connect('clicked', () => {
            this._selected = resultIndex;
            this._activateSelected();
        });

        this._resultsBox.add_child(row);
    }

    _selectableChildren() {
        return this._resultsBox.get_children()
            .filter(child => child instanceof St.Button);
    }

    _refreshSelection() {
        const children = this._selectableChildren();

        children.forEach((child, i) => {
            child.remove_style_class_name('selected');
            if (i === this._selected)
                child.add_style_class_name('selected');
        });
    }

    _moveSelection(delta) {
        const count = this._selectableChildren().length;
        if (!count)
            return;

        this._selected = (this._selected + delta + count) % count;
        this._refreshSelection();
    }

    _activateSelected() {
        const offset = this._calcResult !== null ? 1 : 0;

        if (this._calcResult !== null && this._selected === 0) {
            this._clipboard.set_text(St.ClipboardType.CLIPBOARD, String(this._calcResult));
            this._close();
            return;
        }

        const appIndex = this._selected - offset;
        const app = this._resultApps[appIndex];
        if (!app)
            return;

        this._close();

        try {
            const context = global.create_app_launch_context(0, -1);
            app.launch([], context);
        } catch (e) {
            log(`Kali Spotlight: launch failed: ${e}`);
        }
    }
}
