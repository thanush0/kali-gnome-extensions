# Clipboard History (`clipboard-history@thanush`)

A Windows-style clipboard history popup for GNOME Shell 50 on Kali Linux
(Wayland-safe). Opens with **Super+Z**, never auto-opens on login/enable.

Companion extension to `winx-menu@thanush` (Super+X quick-link menu) and
styled to match it.

## Features

- Super+Z toggles a Windows 11–style clipboard history popup (press again to close)
- Text clipboard history, newest on top, 50 items by default (configurable)
- No consecutive/duplicate entries — re-copying an item moves it to the top
- Click an item to put it back on the clipboard (never auto-pastes/simulates Ctrl+V)
- Keyboard navigation: Up/Down to move, Enter to select, Escape/Tab/Space to close
- Live search, per-item delete, "Clear all" with a confirm step
- Auto-closes on outside click, app switch, workspace switch
- History persists to `~/.local/share/gnome-shell/clipboard-history/history.json`
- Nothing is ever logged, transmitted, or sent to the network — 100% local
- Clean `enable()`/`disable()` — no leaked signals, timers, or keybindings

## Files

```
clipboard-history@thanush/
├── extension.js
├── metadata.json
├── prefs.js
├── stylesheet.css
├── README.md
└── schemas/
    └── org.gnome.shell.extensions.clipboard-history.gschema.xml
```

## Installation (Kali Linux, GNOME Shell 50, Wayland)

1. Create the extension directory:

   ```bash
   mkdir -p ~/.local/share/gnome-shell/extensions/clipboard-history@thanush/schemas
   ```

2. Copy all files into place (from wherever you extracted this project):

   ```bash
   cp extension.js metadata.json prefs.js stylesheet.css README.md \
      ~/.local/share/gnome-shell/extensions/clipboard-history@thanush/

   cp schemas/org.gnome.shell.extensions.clipboard-history.gschema.xml \
      ~/.local/share/gnome-shell/extensions/clipboard-history@thanush/schemas/
   ```

3. Compile the GSettings schema:

   ```bash
   glib-compile-schemas \
     ~/.local/share/gnome-shell/extensions/clipboard-history@thanush/schemas/
   ```

   Confirm the compiled file now exists:

   ```bash
   ls ~/.local/share/gnome-shell/extensions/clipboard-history@thanush/schemas/gschemas.compiled
   ```

4. On **Wayland**, GNOME Shell needs to restart before it will pick up a new
   extension. Log out and log back in (there is no "Alt+F2, r" trick on
   Wayland).

5. Enable the extension:

   ```bash
   gnome-extensions enable clipboard-history@thanush
   ```

6. Verify it's active:

   ```bash
   gnome-extensions info clipboard-history@thanush
   ```

7. Verify the shortcut is registered:

   ```bash
   gsettings get org.gnome.shell.extensions.clipboard-history clipboard-hotkey
   ```

   Expected output:

   ```
   ['<Super>z']
   ```

## Preferences

```bash
gnome-extensions prefs clipboard-history@thanush
```

From here you can:
- Enable/disable clipboard history
- Change the maximum number of stored items
- Change the Super+Z shortcut
- Clear all stored history from disk

## Test procedure

1. Enable the extension.
2. Confirm the popup does **not** automatically appear.
3. Copy `Hello`.
4. Copy `Kali Linux`.
5. Copy `GNOME`.
6. Press **Super+Z**.
7. Confirm the clipboard history popup opens.
8. Confirm `GNOME` (newest) is at the top.
9. Click an item.
10. Confirm it becomes the current system clipboard contents (paste anywhere to check).
11. Press **Super+Z** again.
12. Confirm the popup closes.
13. Open the popup, press **Escape** — confirm it closes.
14. Open the popup, press **Tab** — confirm it closes.
15. Open the popup, click outside it — confirm it closes.
16. Open the popup, switch to another application — confirm it closes.
17. Open the popup, switch workspace — confirm it closes.
18. Copy the same text twice in a row — confirm it does not create a duplicate entry.
19. Type into the search box — confirm the list filters case-insensitively.
20. Click a delete (🗑) icon on one item — confirm only that item is removed.
21. Click "Clear all" twice (confirm step) — confirm the whole list empties.
22. Log out, log back in.
23. Confirm the extension is still enabled and Super+Z still works.
24. Confirm history from before logout is still present (unless you cleared it).

## Troubleshooting / debug commands

**Extension status**
```bash
gnome-extensions info clipboard-history@thanush
```

**Schema registered**
```bash
gsettings list-schemas | grep clipboard
```

**Shortcut value**
```bash
gsettings get org.gnome.shell.extensions.clipboard-history clipboard-hotkey
```

**Extension logs** (clipboard contents are never logged — only status lines like
`Clipboard History: popup opened`):
```bash
journalctl -b --no-pager | grep 'Clipboard History:' | tail -50
```

**Live log while testing**
```bash
journalctl -f -o cat /usr/bin/gnome-shell | grep 'Clipboard History:'
```

**Enabled extensions list**
```bash
gsettings get org.gnome.shell enabled-extensions
```

**If Super+Z doesn't respond:**
- Check for a shortcut conflict in GNOME Settings → Keyboard → Shortcuts (another
  app or extension, e.g. a workspace shortcut, may already own Super+Z).
- Re-check the compiled schema exists: `schemas/gschemas.compiled`.
- Re-run `glib-compile-schemas schemas/` after any schema edit, then log out/in.

**If the popup never appears at all:**
- Confirm you're on GNOME Shell 50: `gnome-shell --version`.
- Check for JS errors: `journalctl -b --no-pager | grep -i clipboard-history`.

**If history doesn't persist:**
- Check the file exists and is writable:
  `ls -la ~/.local/share/gnome-shell/clipboard-history/history.json`

## Security notes

- Clipboard text is stored **only** locally, in
  `~/.local/share/gnome-shell/clipboard-history/history.json`.
- Nothing is ever sent over the network or to any cloud service.
- Clipboard contents are never written to logs or `journalctl`.
- Because clipboard history can capture passwords or other sensitive text
  copied during normal use, use "Clear all" (in the popup or in Preferences)
  whenever you've copied something sensitive.

## Uninstall

```bash
gnome-extensions disable clipboard-history@thanush
rm -rf ~/.local/share/gnome-shell/extensions/clipboard-history@thanush
rm -rf ~/.local/share/gnome-shell/clipboard-history
```
