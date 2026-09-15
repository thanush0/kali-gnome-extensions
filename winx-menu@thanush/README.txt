============================================================
        WINDOWS 11 STYLE QUICK LINK - GNOME SHELL
============================================================

Extension:
    winx-menu@thanush

Location:
    ~/.local/share/gnome-shell/extensions/winx-menu@thanush/

Files:
    extension.js    - menu logic
    prefs.js        - preferences UI (shortcut customization)
    stylesheet.css  - menu appearance
    metadata.json   - extension metadata
    schemas/        - GSettings schema (compiled on install)
    install.sh      - copies files into place and compiles schemas

GSettings Schema:
    org.gnome.shell.extensions.winx-menu

Default Shortcut:
    Super + X
    (changeable via the Extensions app -> Quick Link -> Settings,
    or `gsettings set org.gnome.shell.extensions.winx-menu
    winx-hotkey "['<Super>x']"`)

============================================================
                    WHAT CHANGED (v3)
============================================================

Fixes (these caused "Terminal doesn't open" and "menu doesn't
close automatically" in v2):
  - Every button's 'clicked' handler started with
    `this.emit('item-activated')` - a signal that was never
    registered on the QuickLinkMenu class. Emitting an
    unregistered GObject signal throws, and that throw
    happened BEFORE the try/catch around the item's actual
    action, so the action (launching a terminal, opening
    Settings, etc.) never ran for ANY item, not just Terminal.
  - That same rewrite had dropped the explicit "close the
    menu" step the original code did on every item click, so
    even once the crash above is fixed, nothing told the
    extension to tear the menu down when an item was chosen.
  - Fix: item clicks now call a plain callback the extension
    passes into the menu (no custom GObject signal involved),
    which closes the menu first and then runs the item's
    action, matching the original close-then-act ordering.
  - The click-outside/auto-close handlers are now installed
    once in enable() (as in the very first version of this
    extension) instead of being connected and disconnected on
    every open/close cycle, which removes a class of bugs
    where a stale or missing connection silently breaks
    auto-close after the first use.

============================================================
                    WHAT CHANGED (v2)
============================================================

Fixes:
  - extension.js referenced `Clutter` (EVENT_PROPAGATE, KEY_Tab,
    KEY_space, EventType, ...) without importing it. As shipped,
    the auto-close handlers would throw as soon as a key or click
    event fired. Clutter is now imported.
  - Several CSS classes used by extension.js (winx-header,
    winx-subtitle, winx-section, winx-icon-container,
    winx-text-box, winx-description) were never defined in
    stylesheet.css, so most of the menu rendered unstyled.
    stylesheet.css now covers every class the menu uses.
  - GLib.spawn_async() reports success even when the target
    binary does not exist, so the "try the next fallback"
    logic never actually ran on a missing app. Launching now
    goes through Gio.Subprocess, whose failure is detected
    immediately, so fallback commands (e.g. nautilus -> nemo
    -> thunar) work as intended.
  - The global Super+X keybinding used
    Shell.ActionMode.ALL, meaning the menu - including Lock,
    Log Out, Restart and Shut Down - could be opened from the
    lock screen. It is now restricted to
    Shell.ActionMode.NORMAL | OVERVIEW.

Upgrades:
  - Global keybinding registration now goes through
    Main.wm.addKeybinding()/removeKeybinding(), the supported
    entry point for extensions, instead of calling
    global.display directly.
  - Click-outside detection now uses a full-screen invisible
    "shield" actor behind the menu instead of manually walking
    the event's actor hierarchy on every stage click.
  - Added a preferences window (prefs.js) so the shortcut can
    be changed from the Extensions app instead of only via
    `gsettings`. This requires the schema in schemas/, which
    install.sh compiles for you.
  - Added keyboard navigation: Up/Down arrows move focus
    between items, Enter activates the focused item, and
    Escape closes the menu (previously the menu had no
    Escape handling and no way to move focus between items
    with the keyboard).
  - Broadened declared shell-version compatibility from
    ["50"] to ["45".."50"], since the code only relies on the
    ESM extension format introduced in GNOME Shell 45 and
    nothing 50-specific. Verify on your target shell version
    before publishing if you rely on this.
  - Menu is added via Main.layoutManager.addChrome() instead
    of Main.uiGroup.add_child(), which is the normal way
    GNOME Shell UI elements register themselves for correct
    stacking and fullscreen tracking.
  - Terminal/file-manager fallback lists extended with a few
    more common terminals and file managers.

Behavior intentionally kept as before:
  - Tab and Space still close the menu rather than navigating
    it, matching the original design notes. Use the Up/Down
    arrows to navigate and Enter to activate an item instead.
  - Menu does not auto-open on extension enable.
  - Bottom-left positioning, 360px width, automatic height
    clamped to the screen.

============================================================
                    OPEN / CLOSE
============================================================

Extension ENABLE
        |
        +----> Quick Link stays CLOSED
        |
        +----> Press Super + X
                    |
                    +----> Quick Link OPEN
                              |
                              +----> Super + X -> CLOSE
                              +----> Escape -> CLOSE
                              +----> Tab -> CLOSE
                              +----> Space -> CLOSE
                              +----> Click outside -> CLOSE
                              +----> Switch application -> CLOSE
                              +----> Switch workspace -> CLOSE
                              +----> Up / Down -> move focus
                              +----> Enter -> activate focused item

============================================================
                    MENU CONTENT
============================================================

SYSTEM
    Terminal, File Manager, Settings, Network

MANAGEMENT
    System Monitor, Disks, Users, Software

POWER
    Lock, Log Out, Restart, Shut Down

============================================================
                    INSTALL
============================================================

    cd winx-menu@thanush
    chmod +x install.sh
    ./install.sh
    gnome-extensions enable winx-menu@thanush

(Log out and back in the first time you install a new
extension, since GNOME Shell only scans the extensions
directory at login.)

============================================================
                    USEFUL COMMANDS
============================================================

Check extension:
    gnome-extensions info winx-menu@thanush

Enable / disable:
    gnome-extensions enable winx-menu@thanush
    gnome-extensions disable winx-menu@thanush

Open preferences:
    gnome-extensions prefs winx-menu@thanush

Reload after editing:
    gnome-extensions disable winx-menu@thanush
    sleep 1
    gnome-extensions enable winx-menu@thanush

Debug log:
    journalctl -b --no-pager | grep 'Win+X:' | tail -30
============================================================
