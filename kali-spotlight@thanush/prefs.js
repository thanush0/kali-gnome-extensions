import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/shell/extensions/prefs.js';

export default class KaliSpotlightPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage();
        const group = new Adw.PreferencesGroup({
            title: 'Kali Spotlight',
            description: 'Windows/macOS-style application launcher',
        });
        page.add(group);

        const row = new Adw.ActionRow({
            title: 'Shortcut',
            subtitle: 'Key combination that opens the launcher',
        });
        group.add(row);

        const shortcutLabel = new Gtk.ShortcutLabel({
            disabled_text: 'Not set',
            valign: Gtk.Align.CENTER,
        });

        const updateLabel = () => {
            const bindings = settings.get_strv('hotkey');
            shortcutLabel.set_accelerator(bindings[0] || '');
        };
        updateLabel();
        settings.connect('changed::hotkey', updateLabel);

        row.add_suffix(shortcutLabel);
        window.add(page);
    }
}
