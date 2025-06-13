const fs = require('fs');
const path = require('path');

const EXCLUDE = new Set(['node_modules', '__tests__', 'package-lock.json', 'dist', '.git']);

function copy(src, dest) {
    if (EXCLUDE.has(path.basename(src))) {
        return;
    }
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
        fs.mkdirSync(dest, {recursive: true});
        for (const entry of fs.readdirSync(src)) {
            copy(path.join(src, entry), path.join(dest, entry));
        }
    } else {
        fs.copyFileSync(src, dest);
    }
}

fs.rmSync('dist', {recursive: true, force: true});
fs.mkdirSync('dist');
for (const entry of fs.readdirSync('.')) {
    if (EXCLUDE.has(entry)) continue;
    copy(entry, path.join('dist', entry));
}