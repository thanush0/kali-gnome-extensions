import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const SCHEMA_ID = 'org.gnome.shell.extensions.winx-menu';


// ================================================================
// QUICK LINK MENU
// ================================================================

const QuickLinkMenu = GObject.registerClass(
class QuickLinkMenu extends St.BoxLayout {

    // onActivate is called (by the extension) whenever an item is
    // clicked, BEFORE the item's own action runs, so the extension
    // can tear down the menu, keybinding listeners, etc.
    _init(onActivate) {
        super._init({
            vertical: true,
            style_class: 'winx-menu',
            reactive: true,
            can_focus: true,
            track_hover: true,
        });

        this._onActivate = onActivate;

        // Buttons are tracked in order so keyboard navigation
        // (Up / Down) can move focus between them.
        this._buttons = [];

        this._buildMenu();
    }


    // ============================================================
    // BUILD MENU
    // ============================================================

    _buildMenu() {

        // --------------------------------------------------------
        // HEADER
        // --------------------------------------------------------

        const header = new St.BoxLayout({
            style_class: 'winx-header',
        });

        const titleBox = new St.BoxLayout({
            vertical: true,
            x_expand: true,
        });

        titleBox.add_child(
            new St.Label({
                text: 'Quick Link',
                style_class: 'winx-title',
            })
        );

        titleBox.add_child(
            new St.Label({
                text: 'Windows-style system shortcuts',
                style_class: 'winx-subtitle',
            })
        );

        header.add_child(titleBox);
        this.add_child(header);

        this._addSeparator();


        // --------------------------------------------------------
        // SYSTEM
        // --------------------------------------------------------

        this._addSectionTitle('System');

        this._addItem(
            'Terminal',
            'utilities-terminal-symbolic',
            'Open Terminal',
            () => this._runTerminal()
        );

        this._addItem(
            'File Manager',
            'system-file-manager-symbolic',
            'Open Files',
            () => this._runCommand([
                ['nautilus'],
                ['nemo'],
                ['thunar'],
                ['pcmanfm'],
            ])
        );

        this._addItem(
            'Settings',
            'preferences-system-symbolic',
            'Open GNOME Settings',
            () => this._runCommand([
                ['gnome-control-center'],
            ])
        );

        this._addItem(
            'Network',
            'network-wired-symbolic',
            'Network connections and settings',
            () => this._runCommand([
                ['gnome-control-center', 'network'],
                ['nm-connection-editor'],
            ])
        );


        // --------------------------------------------------------
        // MANAGEMENT
        // --------------------------------------------------------

        this._addSectionTitle('Management');

        this._addItem(
            'System Monitor',
            'utilities-system-monitor-symbolic',
            'Processes, CPU, memory and resources',
            () => this._runCommand([
                ['gnome-system-monitor'],
                ['gnome-usage'],
                ['mate-system-monitor'],
            ])
        );

        this._addItem(
            'Disks',
            'drive-harddisk-symbolic',
            'Manage disks and partitions',
            () => this._runCommand([
                ['gnome-disks'],
            ])
        );

        this._addItem(
            'Users',
            'system-users-symbolic',
            'Manage user accounts',
            () => this._runCommand([
                ['gnome-control-center', 'user-accounts'],
            ])
        );

        this._addItem(
            'Software',
            'system-software-install-symbolic',
            'Install and manage applications',
            () => this._runCommand([
                ['gnome-software'],
                ['plasma-discover'],
                ['synaptic'],
            ])
        );


        // --------------------------------------------------------
        // POWER
        // --------------------------------------------------------

        this._addSeparator();

        this._addSectionTitle('Power');

        this._addItem(
            'Lock',
            'system-lock-screen-symbolic',
            'Lock your session',
            () => this._runCommand([
                ['loginctl', 'lock-session'],
            ])
        );

        this._addItem(
            'Log Out',
            'system-log-out-symbolic',
            'Sign out of your session',
            () => this._runCommand([
                ['gnome-session-quit', '--logout', '--no-prompt'],
            ])
        );

        this._addItem(
            'Restart',
            'system-reboot-symbolic',
            'Restart the computer',
            () => this._runCommand([
                ['systemctl', 'reboot'],
            ])
        );

        this._addItem(
            'Shut Down',
            'system-shutdown-symbolic',
            'Power off the computer',
            () => this._runCommand([
                ['systemctl', 'poweroff'],
            ])
        );
    }


    // ============================================================
    // SECTION TITLE
    // ============================================================

    _addSectionTitle(text) {

        this.add_child(
            new St.Label({
                text: text.toUpperCase(),
                style_class: 'winx-section',
            })
        );
    }


    // ============================================================
    // MENU ITEM
    // ============================================================

    _addItem(text, iconName, description, callback) {

        const button = new St.Button({
            style_class: 'winx-item',
            reactive: true,
            can_focus: true,
            track_hover: true,
            x_expand: true,
            accessible_name: `${text}. ${description}`,
        });


        const box = new St.BoxLayout({
            style_class: 'winx-item-box',
            x_expand: true,
        });


        // --------------------------------------------------------
        // ICON
        // --------------------------------------------------------

        const iconContainer = new St.Widget({
            style_class: 'winx-icon-container',
            layout_manager: new Clutter.BinLayout(),
        });

        iconContainer.add_child(
            new St.Icon({
                icon_name: iconName,
                icon_size: 20,
                style_class: 'winx-icon',
            })
        );


        // --------------------------------------------------------
        // TEXT
        // --------------------------------------------------------

        const textBox = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            style_class: 'winx-text-box',
        });

        textBox.add_child(
            new St.Label({
                text: text,
                style_class: 'winx-label',
            })
        );

        textBox.add_child(
            new St.Label({
                text: description,
                style_class: 'winx-description',
            })
        );


        box.add_child(iconContainer);
        box.add_child(textBox);

        button.set_child(box);


        // --------------------------------------------------------
        // CLICK
        //
        // IMPORTANT: this must close the menu (via the extension's
        // callback, which also tears down chrome and listeners)
        // BEFORE running the action, and the action itself must
        // run even if something above it throws.
        // --------------------------------------------------------

        button.connect(
            'clicked',
            () => {

                try {
                    if (this._onActivate)
                        this._onActivate();
                } catch (e) {
                    console.error(
                        `Win+X: error closing menu: ${e}`
                    );
                }

                try {
                    callback();
                } catch (e) {
                    console.error(
                        `Win+X: action error: ${e}`
                    );
                }
            }
        );


        this._buttons.push(button);
        this.add_child(button);
    }


    // ============================================================
    // SEPARATOR
    // ============================================================

    _addSeparator() {

        this.add_child(
            new St.Widget({
                style_class: 'winx-separator',
                x_expand: true,
            })
        );
    }


    // ============================================================
    // KEYBOARD NAVIGATION
    // ============================================================

    focusFirst() {

        if (this._buttons.length > 0)
            this._buttons[0].grab_key_focus();
    }

    focusNext() {

        this._moveFocus(1);
    }

    focusPrevious() {

        this._moveFocus(-1);
    }

    _moveFocus(direction) {

        if (this._buttons.length === 0)
            return;

        const current = global.stage.get_key_focus();
        let index = this._buttons.indexOf(current);

        if (index === -1)
            index = 0;
        else
            index = (index + direction + this._buttons.length) % this._buttons.length;

        this._buttons[index].grab_key_focus();
    }

    activateFocused() {

        const current = global.stage.get_key_focus();
        const index = this._buttons.indexOf(current);

        if (index !== -1)
            this._buttons[index].emit('clicked', Clutter.BUTTON_PRIMARY);
    }


    // ============================================================
    // TERMINAL
    // ============================================================

    _runTerminal() {

        this._runCommand([
            ['kgx'],
            ['ptyxis'],
            ['gnome-terminal'],
            ['xfce4-terminal'],
            ['qterminal'],
            ['konsole'],
            ['mate-terminal'],
            ['x-terminal-emulator'],
        ]);
    }


    // ============================================================
    // RUN COMMAND
    //
    // Tries each candidate command in order until one launches
    // successfully. Uses Gio.Subprocess so a missing binary is
    // detected immediately (spawn_async silently "succeeds" even
    // for a command that does not exist, since the failure only
    // surfaces asynchronously).
    // ============================================================

    _runCommand(commands) {

        for (const command of commands) {

            try {

                const proc = Gio.Subprocess.new(
                    command,
                    Gio.SubprocessFlags.NONE
                );

                proc.wait_async(null, (source, result) => {
                    try {
                        source.wait_finish(result);
                    } catch (e) {
                        console.error(
                            `Win+X: ${command[0]} exited with an error: ${e}`
                        );
                    }
                });

                console.log(
                    `Win+X: started ${command.join(' ')}`
                );

                return;

            } catch (e) {

                console.error(
                    `Win+X: unable to execute ${command.join(' ')}: ${e}`
                );
            }
        }

        console.error(
            `Win+X: all candidate commands failed: ${commands.map(c => c[0]).join(', ')}`
        );

        Main.notify(
            'Quick Link',
            'None of the expected applications are installed for this action.'
        );
    }


    // ============================================================
    // CLOSE
    // ============================================================

    close() {

        if (this.get_parent())
            this.get_parent().remove_child(this);

        this.destroy();
    }
});


// =================================================================
// EXTENSION
// =================================================================

export default class WinXExtension extends Extension {


    // ==============================================================
    // ENABLE
    // ==============================================================

    enable() {

        console.log(
            'Win+X: ENABLE START'
        );

        this._menu = null;


        // ----------------------------------------------------------
        // LOAD GSETTINGS
        // ----------------------------------------------------------

        try {

            this._settings = this.getSettings(SCHEMA_ID);

            console.log(
                `Win+X: configured shortcut = ${
                    this._settings.get_strv('winx-hotkey')
                }`
            );

        } catch (e) {

            console.error(
                `Win+X: GSettings error: ${e}`
            );

            return;
        }


        // ----------------------------------------------------------
        // LOAD CSS
        // ----------------------------------------------------------

        this._loadStylesheet();


        // ----------------------------------------------------------
        // REGISTER GLOBAL KEYBINDING
        //
        // Main.wm.addKeybinding (rather than calling
        // global.display.add_keybinding directly) is the supported
        // entry point for extensions.
        //
        // ActionMode is restricted to NORMAL and OVERVIEW so the
        // shortcut - and the power/lock/session actions it exposes -
        // cannot be triggered from the lock screen or other modal
        // states.
        // ----------------------------------------------------------

        try {

            Main.wm.addKeybinding(
                'winx-hotkey',
                this._settings,
                Meta.KeyBindingFlags.NONE,
                Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
                () => {

                    console.log(
                        'Win+X: KEY PRESSED'
                    );

                    this.toggleMenu();
                }
            );

            console.log(
                'Win+X: GLOBAL KEYBINDING REGISTERED'
            );

        } catch (e) {

            console.error(
                `Win+X: GLOBAL KEYBINDING ERROR: ${e}`
            );
        }


        // ----------------------------------------------------------
        // INSTALL AUTO-CLOSE HANDLERS (installed once; each handler
        // no-ops whenever this._menu is not currently set)
        // ----------------------------------------------------------

        this._installAutoCloseHandlers();


        console.log(
            'Win+X: ENABLE COMPLETE'
        );
    }


    // ==============================================================
    // DISABLE
    // ==============================================================

    disable() {

        console.log(
            'Win+X: DISABLE START'
        );


        // ----------------------------------------------------------
        // REMOVE KEYBINDING
        // ----------------------------------------------------------

        try {

            Main.wm.removeKeybinding('winx-hotkey');

            console.log(
                'Win+X: GLOBAL KEYBINDING REMOVED'
            );

        } catch (e) {

            console.error(
                `Win+X: keybinding removal error: ${e}`
            );
        }


        // ----------------------------------------------------------
        // REMOVE AUTO-CLOSE HANDLERS
        // ----------------------------------------------------------

        this._removeAutoCloseHandlers();


        // ----------------------------------------------------------
        // CLOSE MENU
        // ----------------------------------------------------------

        this.closeMenu();


        // ----------------------------------------------------------
        // UNLOAD CSS
        // ----------------------------------------------------------

        this._unloadStylesheet();


        // ----------------------------------------------------------
        // CLEAR SETTINGS
        // ----------------------------------------------------------

        this._settings = null;


        console.log(
            'Win+X: DISABLE COMPLETE'
        );
    }


    // ==============================================================
    // AUTO-CLOSE HANDLERS
    //
    // Installed once in enable(). Every handler bails out
    // immediately unless a menu is currently open, so there is
    // nothing to connect/disconnect on every toggle.
    // ==============================================================

    _installAutoCloseHandlers() {

        // --------------------------------------------------------
        // CLICK OUTSIDE / KEYBOARD
        //
        // 'captured-event' fires during the capture phase, before
        // the event reaches its target, so this reliably sees every
        // click and key press regardless of which actor has focus.
        // --------------------------------------------------------

        this._stageEventId =
            global.stage.connect(
                'captured-event',
                (actor, event) => {

                    if (!this._menu)
                        return Clutter.EVENT_PROPAGATE;

                    const type = event.type();

                    // ---- click / touch outside the menu ----
                    if (
                        type === Clutter.EventType.BUTTON_PRESS ||
                        type === Clutter.EventType.TOUCH_BEGIN
                    ) {

                        const source = event.get_source();

                        if (source && !this._isInsideMenu(source)) {

                            console.log(
                                'Win+X: CLICK OUTSIDE - CLOSING'
                            );

                            this.closeMenu();
                        }

                        return Clutter.EVENT_PROPAGATE;
                    }

                    // ---- keyboard ----
                    if (type === Clutter.EventType.KEY_PRESS) {

                        const key = event.get_key_symbol();

                        switch (key) {

                        case Clutter.KEY_Escape:
                            console.log('Win+X: ESCAPE - CLOSING');
                            this.closeMenu();
                            return Clutter.EVENT_STOP;

                        case Clutter.KEY_Tab:
                        case Clutter.KEY_ISO_Left_Tab:
                            console.log('Win+X: TAB - CLOSING');
                            this.closeMenu();
                            return Clutter.EVENT_STOP;

                        case Clutter.KEY_space:
                            console.log('Win+X: SPACE - CLOSING');
                            this.closeMenu();
                            return Clutter.EVENT_STOP;

                        case Clutter.KEY_Down:
                            this._menu.focusNext();
                            return Clutter.EVENT_STOP;

                        case Clutter.KEY_Up:
                            this._menu.focusPrevious();
                            return Clutter.EVENT_STOP;

                        case Clutter.KEY_Return:
                        case Clutter.KEY_KP_Enter:
                            this._menu.activateFocused();
                            return Clutter.EVENT_STOP;
                        }
                    }

                    return Clutter.EVENT_PROPAGATE;
                }
            );


        // --------------------------------------------------------
        // FOCUS WINDOW CHANGE
        // --------------------------------------------------------

        this._focusWindowId =
            global.display.connect(
                'notify::focus-window',
                () => {

                    if (!this._menu)
                        return;

                    console.log(
                        'Win+X: FOCUS WINDOW CHANGED - CLOSING'
                    );

                    this.closeMenu();
                }
            );


        // --------------------------------------------------------
        // WORKSPACE CHANGE
        // --------------------------------------------------------

        this._workspaceId =
            global.workspace_manager.connect(
                'active-workspace-changed',
                () => {

                    if (!this._menu)
                        return;

                    console.log(
                        'Win+X: WORKSPACE CHANGED - CLOSING'
                    );

                    this.closeMenu();
                }
            );
    }


    // ==============================================================
    // REMOVE AUTO-CLOSE HANDLERS
    // ==============================================================

    _removeAutoCloseHandlers() {

        try {

            if (this._stageEventId) {
                global.stage.disconnect(this._stageEventId);
                this._stageEventId = null;
            }

        } catch (e) {

            console.error(
                `Win+X: stage handler removal error: ${e}`
            );
        }


        try {

            if (this._focusWindowId) {
                global.display.disconnect(this._focusWindowId);
                this._focusWindowId = null;
            }

        } catch (e) {

            console.error(
                `Win+X: focus handler removal error: ${e}`
            );
        }


        try {

            if (this._workspaceId) {
                global.workspace_manager.disconnect(this._workspaceId);
                this._workspaceId = null;
            }

        } catch (e) {

            console.error(
                `Win+X: workspace handler removal error: ${e}`
            );
        }
    }


    // ==============================================================
    // CHECK WHETHER ACTOR IS INSIDE MENU
    // ==============================================================

    _isInsideMenu(actor) {

        let current = actor;

        while (current) {

            if (current === this._menu)
                return true;

            current = current.get_parent();
        }

        return false;
    }


    // ==============================================================
    // LOAD CSS
    // ==============================================================

    _loadStylesheet() {

        try {

            this._theme =
                St.ThemeContext
                    .get_for_stage(global.stage)
                    .get_theme();


            this._stylesheet =
                this.dir.get_child('stylesheet.css');


            this._theme.load_stylesheet(
                this._stylesheet
            );


            console.log(
                'Win+X: CSS LOADED'
            );

        } catch (e) {

            console.error(
                `Win+X: CSS ERROR: ${e}`
            );
        }
    }


    // ==============================================================
    // UNLOAD CSS
    // ==============================================================

    _unloadStylesheet() {

        if (
            !this._theme ||
            !this._stylesheet
        ) {
            return;
        }


        try {

            this._theme.unload_stylesheet(
                this._stylesheet
            );

        } catch (e) {

            console.error(
                `Win+X: CSS UNLOAD ERROR: ${e}`
            );
        }


        this._theme = null;
        this._stylesheet = null;
    }


    // ==============================================================
    // TOGGLE MENU
    // ==============================================================

    toggleMenu() {

        console.log(
            'Win+X: TOGGLE MENU'
        );


        if (this._menu) {
            this.closeMenu();
            return;
        }


        // ----------------------------------------------------------
        // CREATE MENU
        // ----------------------------------------------------------

        try {

            this._menu = new QuickLinkMenu(
                () => this.closeMenu()
            );

            Main.layoutManager.addChrome(this._menu, {
                trackFullscreen: true,
            });

        } catch (e) {

            console.error(
                `Win+X: MENU CREATION ERROR: ${e}`
            );

            this._menu = null;
            return;
        }


        // ----------------------------------------------------------
        // PRIMARY MONITOR
        // ----------------------------------------------------------

        const monitor =
            Main.layoutManager.primaryMonitor;


        // ----------------------------------------------------------
        // MENU WIDTH
        //
        // Width is fixed. Height is automatic, clamped to the
        // available screen height.
        // ----------------------------------------------------------

        const menuWidth = 360;

        this._menu.set_width(menuWidth);

        const [, naturalHeight] =
            this._menu.get_preferred_height(menuWidth);


        // ----------------------------------------------------------
        // SCREEN MARGINS
        // ----------------------------------------------------------

        const topMargin = 16;
        const bottomMargin = 16;

        const availableHeight =
            monitor.height -
            topMargin -
            bottomMargin;

        const menuHeight =
            Math.min(naturalHeight, availableHeight);

        if (naturalHeight > availableHeight)
            this._menu.set_height(availableHeight);


        // ----------------------------------------------------------
        // POSITION (bottom-left, clamped to screen bounds)
        // ----------------------------------------------------------

        let x = monitor.x + 16;

        let y =
            monitor.y +
            monitor.height -
            menuHeight -
            bottomMargin;

        if (x + menuWidth > monitor.x + monitor.width)
            x = monitor.x + monitor.width - menuWidth - 16;

        if (y < monitor.y + topMargin)
            y = monitor.y + topMargin;

        this._menu.set_position(x, y);


        console.log(
            `Win+X: MENU CREATED x=${x} y=${y} width=${menuWidth} naturalHeight=${naturalHeight} finalHeight=${menuHeight}`
        );


        // ----------------------------------------------------------
        // FOCUS FIRST BUTTON
        // ----------------------------------------------------------

        this._menu.focusFirst();
    }


    // ==============================================================
    // CLOSE MENU
    // ==============================================================

    closeMenu() {

        if (!this._menu)
            return;

        Main.layoutManager.removeChrome(this._menu);
        this._menu.close();
        this._menu = null;

        console.log('Win+X: MENU CLOSED');
    }
}
