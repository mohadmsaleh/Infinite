// copies the web app into android/www
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), out = path.join(__dirname, 'www');
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
for (const f of ['index.html', 'manifest.webmanifest', 'sw.js']) fs.copyFileSync(path.join(root, f), path.join(out, f));
for (const d of ['css', 'js', 'icons']) fs.cpSync(path.join(root, d), path.join(out, d), { recursive: true });
console.log('web assets copied');
