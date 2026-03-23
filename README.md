# Keiba Race Data Formatter

Extract and format horse racing data from Japanese racing websites for AI analysis.

## Features

- **One-click extraction** — Extract race data from the page you're viewing
- **3 output formats** — Markdown table, CSV, AI analysis prompt
- **AI-ready prompts** — Paste directly into ChatGPT / Claude for race predictions or reviews
- **Dark theme UI** — Clean popup interface
- **Privacy-first** — DOM read-only, no data sent externally

## Supported Sites

| Site | Page | Data |
|---|---|---|
| netkeiba.com | Race card (出馬表) | Horse name, bracket, jockey, trainer, odds, popularity |
| netkeiba.com | Race result (レース結果) | Finish position, time, margin, last 3F, passage, weight |
| JRA Official | Race card (出馬表) | Horse name, bracket, jockey, trainer, odds, pedigree |
| JRA Official | Race result (レース結果) | Finish position, time, margin, last 3F, passage, weight |

## Installation

### Chrome Web Store (Recommended)

Install from the [Chrome Web Store](#) (coming soon).

### Manual Install (Developer Mode)

1. Download and unzip the extension
2. Open `chrome://extensions/` in Chrome
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked** and select the unzipped folder
5. The extension icon appears in your toolbar

## Usage

1. Navigate to a supported race page
2. Click the extension icon
3. Select your output format (Markdown / CSV / AI)
4. Click **Data Extract**
5. Click **Copy to Clipboard**
6. Paste into ChatGPT, Claude, spreadsheet, or anywhere

## Free vs Pro

| Feature | Free | Pro |
|---|---|---|
| Markdown output | Yes | Yes |
| CSV output | - | Yes |
| AI analysis prompt | - | Yes |

## Output Formats

### Markdown
Standard table format. Copy-paste into any Markdown-compatible tool.

### CSV
Comma-separated values. Open directly in Excel or Google Sheets.

### AI Analysis Prompt
Includes a pre-built prompt template with the data table, ready to paste into AI chatbots for race predictions or post-race reviews.

## Technical Details

- Chrome Extension (Manifest V3)
- DOM read-only — no server requests, no scraping
- Content scripts run only on supported racing sites
- License stored locally via `chrome.storage.local`

## Files

```
keiba-race-data-formatter/
├── manifest.json
├── popup.html
├── popup.js
├── content-netkeiba.js
├── content-jra.js
├── styles.css
├── icons/
├── DISCLAIMER.md
├── PRIVACY_POLICY.md
└── README.md
```

## Buy Pro License

[Purchase on Payhip](https://payhip.com/b/0E3rn) ($9.99, one-time)

## Disclaimer

This tool is not affiliated with JRA or netkeiba.com. See [DISCLAIMER.md](DISCLAIMER.md) for full details.

## Privacy Policy

See [PRIVACY_POLICY.md](PRIVACY_POLICY.md).

## License

MIT
