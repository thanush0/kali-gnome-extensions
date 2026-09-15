#!/usr/bin/env bash
# Installs / updates the Quick Link extension for the current user.
set -euo pipefail

UUID="winx-menu@thanush"
DEST="$HOME/.local/share/gnome-shell/extensions/$UUID"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

mkdir -p "$DEST"
cp -r "$SRC"/extension.js "$SRC"/prefs.js "$SRC"/metadata.json "$SRC"/stylesheet.css "$DEST"/
mkdir -p "$DEST/schemas"
cp "$SRC"/schemas/org.gnome.shell.extensions.winx-menu.gschema.xml "$DEST/schemas/"

glib-compile-schemas "$DEST/schemas"

echo "Installed to $DEST"
echo "Now run:"
echo "  gnome-extensions enable $UUID"
echo "(log out and back in first if this is a fresh install)"
