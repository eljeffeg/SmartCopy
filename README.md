# SmartCopy

SmartCopy is a Chrome extension that copies genealogical information from sites like Ancestry and FamilySearch into Geni. It also performs consistency checks and provides quick access to research tools. This software uses the Geni API but is not operated or sponsored by Geni, Inc. Users are responsible for ensuring they have permission to use any copyrighted content.

## Installation

1. Install Node.js (v18 or later).
2. Clone this repository and install dependencies:
   ```bash
   npm install
   ```
3. Build and run tests:
   ```bash
   npm test
   ```

## Loading the Extension

1. Open Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the repository directory.
4. The SmartCopy icon will appear in the toolbar.

## Usage

Navigate to a supported genealogy website and click the SmartCopy icon. Follow the prompts to copy data into Geni. Verbose logging can be enabled by setting `verboselogs` to `true` in `popup.js`, though this is disabled by default to avoid exposing sensitive tokens.

## Contributing

Contributions are welcome. Please review `AGENTS.md` for development guidelines. All pull requests should include a brief description of changes and pass the test suite with `npm test`.
