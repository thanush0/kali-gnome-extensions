import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const SCHEMA_ID = 'org.gnome.shell.extensions.winx-menu';


export default class WinXPreferences extends ExtensionPreferences {

    fillPreferencesWindow(window) {

        const settings = this.getSettings(SCHEMA_ID);

        const page = new Adw.PreferencesPage({
            title: 'Quick Link',
            icon_name: 'preferences-system-symbolic',
        });

        const group = new Adw.PreferencesGroup({
            title: 'Keyboard Shortcut',
            description: 'Set the key combination that opens the Quick Link menu.',
        });

        page.add(group);

        const row = new Adw.ActionRow({
            title: 'Open Quick Link',
        });

        group.add(row);

        const shortcutLabel = new Gtk.ShortcutLabel({
            valign: Gtk.Align.CENTER,
            disabled_text: 'Not set',
        });

        const current = settings.get_strv('winx-hotkey');
        shortcutLabel.set_accelerator(current[0] ?? '');

        const editButton = new Gtk.Button({
            label: 'Set Shortcut',
            valign: Gtk.Align.CENTER,
        });

        row.add_suffix(shortcutLabel);
        row.add_suffix(editButton);
        row.set_activatable_widget(editButton);

        editButton.connect('clicked', () => {
            this._captureShortcut(window, settings, shortcutLabel);
        });

        window.add(page);
    }


    // ================================================================
    // Opens a small dialog that listens for the next key combination
    // pressed and stores it as the new shortcut.
    // ================================================================

    _captureShortcut(window, settings, shortcutLabel) {

        const dialog = new Adw.Window({
            modal: true,
            transient_for: window,
            default_width: 320,
            default_height: 140,
            title: 'Set Shortcut',
        });

        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            margin_top: 24,
            margin_bottom: 24,
            margin_start: 24,
            margin_end: 24,
        });

        box.append(new Gtk.Label({
            label: 'Press a key combination, or Escape to cancel.',
            wrap: true,
        }));

        dialog.set_content(box);

        const controller = new Gtk.EventControllerKey();
        dialog.add_controller(controller);

        controller.connect('key-pressed', (_ctrl, keyval, keycode, state) => {

            if (keyval === Gdk.KEY_Escape) {
                dialog.close();
                return Gdk.EVENT_STOP;
            }

            // Ignore lone modifier presses; wait for a real key.
            const modifierKeys = [
                Gdk.KEY_Shift_L, Gdk.KEY_Shift_R,
                Gdk.KEY_Control_L, Gdk.KEY_Control_R,
                Gdk.KEY_Alt_L, Gdk.KEY_Alt_R,
                Gdk.KEY_Super_L, Gdk.KEY_Super_R,
                Gdk.KEY_Meta_L, Gdk.KEY_Meta_R,
            ];

            if (modifierKeys.includes(keyval))
                return Gdk.EVENT_STOP;

            const mask = state & Gtk.accelerator_get_default_mod_mask();
            const accelerator = Gtk.accelerator_name(keyval, mask);

            if (!accelerator) {
                return Gdk.EVENT_STOP;
            }

            settings.set_strv('winx-hotkey', [accelerator]);
            shortcutLabel.set_accelerator(accelerator);

            dialog.close();

            return Gdk.EVENT_STOP;
        });

        dialog.present();
    }
}
