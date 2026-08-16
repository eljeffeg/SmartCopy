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
//
// Pass --staged to check only staged (git-added/modified) .js files instead
// of the whole project - used by the pre-commit hook to stay fast as the
// codebase grows, since a syntax check is inherently per-file (unlike a
// type-checker or test suite, a file's syntax validity can only be broken
// by editing that file directly, so skipping unstaged files has no blind
// spot here). `npm test` itself still runs the full, unrestricted check.
"use strict";

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

// Vendored third-party libraries - never edited by hand in this project, so
// checking them adds noise without adding coverage of anything we actually
// change. Two layers so a future vendored addition doesn't silently need a
// manual list update: an explicit allowlist for names that don't follow any
// naming convention (jquery.js, moment.js), plus pattern rules that catch
// the common vendor/minified conventions automatically (*.min.js, *.bundle.js,
// *-min.js). Add new patterns here rather than growing the explicit list, so
// this stays a one-place update instead of something that can be forgotten.
const EXCLUDED_FILENAMES = new Set(["jquery.js", "moment.js"]);
const EXCLUDED_FILE_PATTERNS = [/\.min\.js$/i, /-min\.js$/i, /\.bundle\.js$/i];

function isExcludedFilename(filename) {
    return EXCLUDED_FILENAMES.has(filename) || EXCLUDED_FILE_PATTERNS.some((pattern) => pattern.test(filename));
}

const EXCLUDED_DIRS = new Set(["node_modules", ".git", "images", "_locales"]);

function isExcluded(absolutePath) {
    const relative = path.relative(ROOT, absolutePath);
    const parts = relative.split(path.sep);
    return parts.some((part) => EXCLUDED_DIRS.has(part)) || isExcludedFilename(parts[parts.length - 1]);
}

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
        } else if (entry.isFile() && entry.name.endsWith(".js") && !isExcludedFilename(entry.name)) {
            results.push(path.join(dir, entry.name));
        }
    }
    return results;
}

function findStagedJsFiles() {
    // ACMR: Added, Copied, Modified, Renamed - deliberately excludes Deleted,
    // since a deleted file has nothing left to syntax-check.
    const output = execFileSync(
        "git",
        ["diff", "--cached", "--name-only", "--diff-filter=ACMR"],
        { cwd: ROOT, encoding: "utf8" }
    );
    return output
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.endsWith(".js"))
        .map((line) => path.join(ROOT, line))
        .filter((absolutePath) => fs.existsSync(absolutePath) && !isExcluded(absolutePath));
}

const staged = process.argv.includes("--staged");
const files = (staged ? findStagedJsFiles() : findJsFiles(ROOT, 0)).sort();

if (staged && files.length === 0) {
    console.log("No staged .js files to check.");
    process.exit(0);
}

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
