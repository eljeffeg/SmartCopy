#!/usr/bin/env node
// Copies scripts/pre-commit into .git/hooks/pre-commit and makes it
// executable. .git/hooks/ is never tracked by git itself, so this is the
// standard way to ship a hook that survives a fresh clone + npm install -
// run automatically via package.json's "prepare" script, or directly with
// `node scripts/install-git-hooks.js`.
//
// Deliberately non-fatal: if there's no .git directory (e.g. this is
// somehow being run outside a git checkout, or from a packaged tarball),
// this warns and exits cleanly rather than failing npm install.
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SOURCE = path.join(ROOT, "scripts", "pre-commit");
const HOOKS_DIR = path.join(ROOT, ".git", "hooks");
const DEST = path.join(HOOKS_DIR, "pre-commit");

if (!fs.existsSync(HOOKS_DIR)) {
    console.warn("No .git/hooks directory found - skipping pre-commit hook install.");
    process.exit(0);
}

fs.copyFileSync(SOURCE, DEST);
fs.chmodSync(DEST, 0o755);
console.log("Installed pre-commit hook -> .git/hooks/pre-commit (runs `npm test` before every commit)");
