# Compass Test Cottagecore Asset Build

This is a test-repo-only cottagecore asset build based on the last stable Compass rollback.

Upload the contents of this folder to the root of your **Compass-Test** repository.

Required root files:

```text
index.html
app.js
styles.css
README.md
ASSET_MANIFEST.md
asset-audit-sheet.png
assets/
```

The `assets/` folder must stay as a folder. The app uses relative paths like:

```text
assets/settings.png
assets/assign_money.png
assets/compass_insights.png
```

Do not upload the PNGs loose into the repo root.

After commit, test with:

```text
https://grahamnick75-sketch.github.io/Compass-Test/?v=cottage-test-1
```
