# Kali Spotlight

A Windows 11 / macOS Spotlight-style application launcher for GNOME Shell 50
on Wayland. Press **Super + Space**, start typing, and launch apps without
touching the mouse.

## What's new in this version

- **Fixed: instant keyboard focus.** Previously you had to click the search
  box before typing. Focus is now grabbed via `Meta.later_add(BEFORE_REDRAW)`
  right after the modal grab settles, so typing works the moment the panel
  appears — no click required.
- **Open/close animation** — a quick fade + scale transition, closer to how
  Spotlight and the Windows search panel animate in and out.
- **Section header** ("Applications") above results, macOS-style.
- **Empty state** — a subtle "No matching applications" message instead of
  a jarring blank panel.
- **Inline calculator** — type something like `12*7` or `(40+2)/2` and the
  top result shows the answer; press Enter to copy it to the clipboard.
- Panel width standardized to **620px** everywhere (schema, CSS, and JS
  previously disagreed on 620 vs 700).

## Install

```bash
mkdir -p ~/.local/share/gnome-shell/extensions/kali-spotlight@thanush
cp -r ./* ~/.local/share/gnome-shell/extensions/kali-spotlight@thanush/

glib-compile-schemas ~/.local/share/gnome-shell/extensions/kali-spotlight@thanush/schemas/

gnome-extensions enable kali-spotlight@thanush
```

On Wayland you'll need to log out and back in for a brand-new extension to
be picked up (there's no `Alt+F2 r` reload like on X11).

If GSettings can't find the schema, register it at the user level too:

```bash
mkdir -p ~/.local/share/glib-2.0/schemas
cp schemas/org.gnome.shell.extensions.kali-spotlight.gschema.xml ~/.local/share/glib-2.0/schemas/
glib-compile-schemas ~/.local/share/glib-2.0/schemas
```

## Usage

| Action              | Key                        |
|---------------------|----------------------------|
| Open / close        | `Super + Space`            |
| Move selection      | `Up` / `Down`              |
| Launch selected     | `Enter`                    |
| Close               | `Escape`, click outside    |
| Calculate           | type an expression, `Enter` copies result |

## Debugging

Don't guess — check the logs first:

```bash
journalctl --user -b --no-pager | grep -i -E \
  'kali-spotlight|TypeError|ReferenceError|SyntaxError|JS ERROR'
```

Then fix only the component the error points at.

## File structure

```
kali-spotlight@thanush/
├── metadata.json
├── extension.js
├── stylesheet.css
├── prefs.js
├── README.md
└── schemas/
    └── org.gnome.shell.extensions.kali-spotlight.gschema.xml
```
