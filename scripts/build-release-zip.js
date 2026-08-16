#!/usr/bin/env node
// Builds the release zip via `git archive`, which relies on .gitattributes
// (export-ignore entries there) to exclude dev-only files that aren't part
// of the shipped extension - no custom file-copying/exclusion logic here,
// just git's own well-established mechanism for exactly this purpose.
//
// Usage:
//   node scripts/build-release-zip.js [ref]
//
// [ref] defaults to HEAD. Pass a tag (e.g. v4.15.1.0) to build from that
// exact tagged commit instead of whatever's currently checked out.
//
// This only builds the zip locally - it does NOT upload or attach anything
// to a GitHub release. That's a separate, explicit step
// (`gh release upload <tag> <zip>`), left manual on purpose.
"use strict";

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ref = process.argv[2] || "HEAD";

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
const version = manifest.version;

if (!version) {
    console.error("Could not read a version from manifest.json - aborting.");
    process.exit(1);
}

const outputName = `smartcopy-${version}.zip`;
const outputPath = path.join(ROOT, outputName);

console.log(`Building ${outputName} from ref "${ref}" via git archive...`);

execFileSync("git", ["archive", "--format=zip", "-o", outputPath, ref], { cwd: ROOT, stdio: "inherit" });

const stats = fs.statSync(outputPath);
console.log(`\nBuilt ${outputName} (${(stats.size / 1024).toFixed(1)} KB) at ${outputPath}`);
console.log("This is a LOCAL file only - nothing has been uploaded.");
console.log(`To attach it to the GitHub release: gh release upload ${ref} ${outputName}`);
