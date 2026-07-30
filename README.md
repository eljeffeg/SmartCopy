# SmartCopy

SmartCopy is a browser extension that assists users in copying and updating genealogical information within [Geni](https://www.geni.com). It reads profile and family data directly from the genealogy website you're browsing and helps you bring it into a Geni profile - matching fields, flagging likely duplicates, and running consistency checks along the way. It also provides quick access to research links and the HistoryLink tools.

This tool does not grant permission to use copyrighted content - users are responsible for obtaining any required authorization from the creator of works, such as biographical stories or images.

This software uses the Geni API but is not operated or sponsored by Geni, Inc.

## Supported websites

SmartCopy can read profile data from:

- **Geni** (native - the whole extension is built around copying *into* Geni, and also reads Geni's own Smart Match suggestions)
- **WikiTree**
- **MyHeritage** (both the classic profile page design and the newer redesigned one)
- **Ancestry** (both the free public view and the newer person-data page structure)
- **FamilySearch** (both the JSON-based Memories/Tree view and the Record view)
- **Find A Grave**
- **BillionGraves**
- **Geneanet**
- **RootsWeb** (WorldConnect)
- **WeRelate**
- **FamilyTreeMaker** (web-published genealogy exports)
- **TNG** (The Next Generation of Genealogy Sitebuilding - works on any site built with this software, not a single domain)
- **Toldot.Ru**
- **Gravez.me**
- **Yad Vashem**
- **BeZikaron.co.il**

## Supported browsers

- **Google Chrome**
- **Mozilla Firefox**
- Other Chromium-based browsers (Edge, Brave, Opera, etc.) should work as well via the Chrome Web Store listing or by loading the extension from source, though they aren't independently tested.

## Installing

### From the Chrome Web Store

Install directly from the [Chrome Web Store listing](https://chromewebstore.google.com/detail/smartcopy/ofikakkdpjlipbnhbfloclbkcabdhjah?hl=en-US&utm_source=ext_sidebar).

### From Firefox Add-ons (AMO)

Install directly from the [Firefox Add-ons listing](https://addons.mozilla.org/en-US/firefox/addon/genismartcopy/).

### From source (development/test builds)

**Chrome:**

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the repository folder.
5. The SmartCopy icon will appear in the toolbar. Reload the extension from this page after pulling new changes.

**Firefox:**

1. Download or clone this repository.
2. Open `about:debugging#/runtime/this-firefox` in Firefox.
3. Click **Load Temporary Add-on...**.
4. Select `manifest.json` from the repository folder (not the folder itself).
5. The SmartCopy icon will appear in the toolbar. This install is temporary and is removed when Firefox restarts - reload it the same way after pulling new changes, or for each new browser session.

## Getting help

SmartCopy has a [Project page on Geni](https://www.geni.com/projects/SmartCopy/18783), with a [discussion board](https://www.geni.com/discussions?discussion_type=project-18783) for questions, discussion, and support.

## License

[Mozilla Public License 2.0](LICENSE)
