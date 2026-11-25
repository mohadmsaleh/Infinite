#!/usr/bin/env bash
# Requires: Node 18+, JDK 17, Android SDK (ANDROID_HOME set)
set -e
cd "$(dirname "$0")"
npm install
node prepare.js
[ -d android ] || npx cap add android
npx cap sync android
# camera / mic / storage permissions
M=android/app/src/main/AndroidManifest.xml
for p in CAMERA RECORD_AUDIO MODIFY_AUDIO_SETTINGS INTERNET; do grep -q "android.permission.$p" $M || sed -i "s#</manifest>#    <uses-permission android:name=\"android.permission.$p\" />\n</manifest>#" $M; done
cd android && ./gradlew assembleDebug
echo "APK: android/android/app/build/outputs/apk/debug/app-debug.apk"
