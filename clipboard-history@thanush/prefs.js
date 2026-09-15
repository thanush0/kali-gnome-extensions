/* prefs.js
 * Preferences UI for Clipboard History (clipboard-history@thanush)
 */

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensionPrefs/prefs.js';

export default class ClipboardHistoryPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings('org.gnome.shell.extensions.clipboard-history');

        const page = new Adw.PreferencesPage({
            title: 'General',
            icon_name: 'edit-paste-symbolic',
        });

        const group = new Adw.PreferencesGroup({
            title: 'Clipboard History',
            description: 'Configure how clipboard history behaves',
        });
        page.add(group);

        /* Enable toggle */
        const enabledRow = new Adw.SwitchRow({
            title: 'Enable clipboard history',
            subtitle: 'Turn clipboard monitoring on or off',
        });
        settings.bind('enabled', enabledRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(enabledRow);

        /* Max history */
        const maxHistoryRow = new Adw.SpinRow({
            title: 'Maximum history items',
            subtitle: 'How many clipboard entries to keep',
            adjustment: new Gtk.Adjustment({
                lower: 1,
                upper: 500,
                step_increment: 1,
                page_increment: 10,
            }),
        });
        settings.bind('max-history', maxHistoryRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        group.add(maxHistoryRow);

        /* Hotkey display + editor */
        const hotkeyRow = new Adw.ActionRow({
            title: 'Shortcut',
            subtitle: 'Default: Super+Z',
        });

        const shortcutLabel = new Gtk.ShortcutLabel({
            disabled_text: 'Not set',
            valign: Gtk.Align.CENTER,
        });
        const currentBinding = settings.get_strv('clipboard-hotkey')[0] || '';
        shortcutLabel.set_accelerator(currentBinding);
        hotkeyRow.add_suffix(shortcutLabel);

        const editButton = new Gtk.Button({
            icon_name: 'document-edit-symbolic',
            valign: Gtk.Align.CENTER,
            css_classes: ['flat'],
            tooltip_text: 'Change shortcut',
        });
        editButton.connect('clicked', () => {
            this._showShortcutDialog(window, settings, shortcutLabel);
        });
        hotkeyRow.add_suffix(editButton);
        group.add(hotkeyRow);

        /* Clear history button */
        const clearGroup = new Adw.PreferencesGroup({
            title: 'Data',
        });
        page.add(clearGroup);

        const clearRow = new Adw.ActionRow({
            title: 'Clear stored history',
            subtitle: 'Removes all saved clipboard entries from disk',
        });
        const clearButton = new Gtk.Button({
            label: 'Clear now',
            valign: Gtk.Align.CENTER,
            css_classes: ['destructive-action'],
        });
        clearButton.connect('clicked', () => {
            this._clearHistoryFile();
            clearRow.subtitle = 'History cleared';
        });
        clearRow.add_suffix(clearButton);
        clearGroup.add(clearRow);

        window.add(page);
    }

    _showShortcutDialog(window, settings, shortcutLabel) {
        const dialog = new Gtk.Dialog({
            title: 'Set Shortcut',
            transient_for: window,
            modal: true,
            use_header_bar: 1,
        });
        dialog.set_default_size(360, 120);

        const content = dialog.get_content_area();
        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            margin_top: 20,
            margin_bottom: 20,
            margin_start: 20,
            margin_end: 20,
        });
        const infoLabel = new Gtk.Label({
            label: 'Press the new key combination…',
        });
        box.append(infoLabel);
        content.append(box);

        const controller = new Gtk.EventControllerKey();
        dialog.add_controller(controller);

        controller.connect('key-pressed', (_ctrl, keyval, keycode, state) => {
            const mask = state & Gtk.accelerator_get_default_mod_mask();
            if (mask === 0)
                return false; // require at least one modifier

            const accelerator = Gtk.accelerator_name(keyval, mask);
            if (!accelerator)
                return false;

            settings.set_strv('clipboard-hotkey', [accelerator]);
            shortcutLabel.set_accelerator(accelerator);
            dialog.close();
            return true;
        });

        dialog.present();
    }

    _clearHistoryFile() {
        try {
            const path = GLib.build_filenamev(
                [GLib.get_home_dir(), '.local', 'share', 'gnome-shell', 'clipboard-history', 'history.json']);
            const file = Gio.File.new_for_path(path);
            if (file.query_exists(null))
                file.replace_contents('[]', null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
        } catch (e) {
            logError(e);
        }
    }
}
