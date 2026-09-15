# Kali GNOME Extensions

A collection of custom GNOME Shell extensions designed to bring a
Windows 11 / macOS-inspired workflow to Kali Linux GNOME.

These extensions are designed for GNOME Shell 50 and provide quick
access to clipboard history, application search, and Windows-style
system shortcuts.

---

## Extensions

### 1. Clipboard History

**UUID:** `clipboard-history@thanush`

**Shortcut:** `Super + Z`

A Windows-style clipboard history popup for GNOME Shell.

#### Features

- Clipboard history for copied text
- Search clipboard history
- Restore previous clipboard items
- Delete individual clipboard entries
- Clear complete clipboard history
- Prevents consecutive duplicate entries
- Re-copying an existing item moves it to the top
- Does not automatically paste after selection
- Popup closes when clicking outside
- Popup closes when switching applications
- Popup closes when changing workspace
- Keyboard navigation
- Persistent history storage

#### Keyboard Controls

| Key | Action |
|---|---|
| `Super + Z` | Open / close clipboard history |
| `↑` / `↓` | Navigate items |
| `Enter` | Select item |
| `Tab` | Navigate controls |
| `Space` | Activate selected control |
| `Esc` | Close popup |

#### Storage

Clipboard history is stored locally at:

```text
~/.local/share/gnome-shell/clipboard-history/history.json
