#!/usr/bin/env node
// Behavioral regression suite runner for SmartCopy's tests/ directory.
//
// Unlike scripts/check-syntax.js (pure per-file syntax validation), these
// tests extract real functions verbatim from the project's own source files
// (buildform.js, popup.js, collections/smartmatch.js, etc.) - via regex/
// eval, or by loading a real jsdom window and running the actual code
// exactly as popup.html would - and assert on real behavior against
// representative and adversarial inputs, in several cases against actual
// saved pages from the sites this extension reads (see tests/fixtures/).
//
// Each test file is a standalone Node script that prints "PASS: <label>" /
// "FAIL: <label>" per assertion and exits 0 only if every assertion in that
// file passed - this runner just invokes each one as a child process and
// aggregates the results, spawning one `node` per file for the same reason
// check-syntax.js does (isolates one file's crash/hang from the rest of the
// run) and reporting every failure, not just the first.
"use strict";

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const TESTS_DIR = path.join(__dirname, "..", "tests");

const files = fs.readdirSync(TESTS_DIR)
    .filter((name) => name.startsWith("test_") && name.endsWith(".js"))
    .sort();

let failedFiles = 0;
for (const file of files) {
    const fullPath = path.join(TESTS_DIR, file);
    try {
        const output = execFileSync(process.execPath, [fullPath], { encoding: "utf8" });
        const summaryLine = output.trim().split("\n").pop();
        console.log("PASS  " + file + "  (" + summaryLine + ")");
    } catch (error) {
        failedFiles++;
        console.log("FAIL  " + file);
        const output = (error.stdout || "") + (error.stderr || "");
        console.log(output.split("\n").map((line) => "      " + line).join("\n"));
    }
}

console.log("");
console.log((files.length - failedFiles) + "/" + files.length + " test files passed");

if (failedFiles > 0) {
    process.exit(1);
}
