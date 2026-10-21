#!/usr/bin/env bash
# Builds dist/go-tab-<version>.zip for the Chrome Web Store: only the files the extension
# loads at runtime (no dev fixtures, design references, spec or editor files). Nothing is
# compiled or rewritten; sources are copied as they are.
#
#   scripts/package.sh
#
# The Web Store rejects an upload whose manifest "version" isn't higher than the last one.
set -euo pipefail
cd "$(dirname "$0")/.."

version=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' manifest.json | head -n 1)
[[ -n "$version" ]] || { echo "Couldn't read \"version\" from manifest.json" >&2; exit 1; }

out=dist/go-tab
zipfile=dist/go-tab-$version.zip

rm -rf "$out" "$zipfile"
mkdir -p "$out/src" "$out/design" "$out/icons"
cp manifest.json newtab.html "$out/"
cp src/*.js src/*.css "$out/src/"
cp design/speeddial.css "$out/design/"   # the base stylesheet newtab.html loads
cp icons/*.png "$out/icons/"             # the manifest takes PNG icons only

# Every file newtab.html and the manifest point at must be in the package,
# and every script or stylesheet in src/ must actually be loaded by newtab.html.
problems=0
refs=$(grep -oE '(src|href)="[^"]+"' newtab.html | cut -d'"' -f2
       grep -oE '"(icons/[^"]+|newtab\.html)"' manifest.json | tr -d '"')
for f in $refs; do
  [[ -f "$out/$f" ]] || { echo "Missing from package: $f" >&2; problems=1; }
done
for f in "$out"/src/*; do
  rel="src/$(basename "$f")"
  grep -q "\"$rel\"" newtab.html || { echo "Not loaded by newtab.html: $rel" >&2; problems=1; }
done
if (( problems )); then exit 1; fi

(cd "$out" && zip -qrX "../$(basename "$zipfile")" . -x '.*' -x '*/.*')

echo "Built $zipfile ($(du -h "$zipfile" | cut -f1 | tr -d ' '), $(find "$out" -type f | wc -l | tr -d ' ') files)"
