#!/usr/bin/env node
// Lightweight syntax validation for SmartCopy's project source files.
//
// node --check only ever validates the FIRST file argument given to it -
// every argument after that is silently ignored, not treated as an
// additional file and not flagged as an error either. That makes
// `node --check *.js` a false sense of coverage: it looks like it checked
// everything, but it only checked whichever file the shell's glob expanded
// to first. This script instead spawns one `node --check` per file and
// reports every failure, not just the first one hit.
"use strict";

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

// Vendored third-party libraries - never edited by hand in this project, so
// checking them adds noise without adding coverage of anything we actually
// change.
const EXCLUDED_FILES = new Set(["jquery.js", "jquery.csv.min.js", "moment.js"]);

const EXCLUDED_DIRS = new Set(["node_modules", ".git", "images", "_locales"]);

function findJsFiles(dir, depth) {
    const results = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            if (EXCLUDED_DIRS.has(entry.name)) {
                continue;
            }
            // Only descend one level (covers collections/) - this project
            // has no deeper JS source tree, and stopping here avoids ever
            // needing to widen EXCLUDED_DIRS as unrelated tooling directories
            // get added in the future.
            if (depth === 0) {
                results.push(...findJsFiles(path.join(dir, entry.name), depth + 1));
            }
        } else if (entry.isFile() && entry.name.endsWith(".js") && !EXCLUDED_FILES.has(entry.name)) {
            results.push(path.join(dir, entry.name));
        }
    }
    return results;
}

const files = findJsFiles(ROOT, 0).sort();

let failed = 0;
for (const file of files) {
    const relative = path.relative(ROOT, file);
    try {
        execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
        console.log("PASS  " + relative);
    } catch (error) {
        failed++;
        console.log("FAIL  " + relative);
        console.log(error.stderr ? error.stderr.toString() : error.message);
    }
}

console.log("");
console.log(files.length - failed + "/" + files.length + " files passed syntax validation");

if (failed > 0) {
    process.exit(1);
}
