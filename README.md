# InfiniBoard
Infinite whiteboard / drawing / presentation canvas (Miro + Explain Everything style). Vanilla JS PWA — no build step.

## Run on a computer
`python3 -m http.server 8000` in this folder, open http://localhost:8000 (or host the folder on any static server / GitHub Pages). Install it from the browser menu as an app.

## Android APK
- Easiest: push to GitHub → Actions → "Build Android APK" → download the artifact `InfiniBoard-apk`.
- Locally: `bash android/build-apk.sh` (needs Node, JDK 17, Android SDK).
- Or open the hosted site in Chrome on Android → "Add to Home screen" (installs as a PWA).

Boards are stored on-device (IndexedDB); use Board menu → Export for backups. Press `?` in the app for shortcuts.
