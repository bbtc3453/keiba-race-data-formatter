# Keiba Race Data Formatter

Extract and format horse racing data from Japanese racing websites for AI analysis.

## Features

- **One-click extraction** — Extract race data from the page you're viewing
- **3 output formats** — Markdown table, CSV, AI analysis prompt
- **AI-ready prompts** — Paste directly into ChatGPT / Claude for race predictions or reviews
- **Dark theme UI** — Clean popup interface
- **Privacy-first** — DOM read-only, no data sent externally

## Supported Sites

| Site | Page |
|---|---|
| netkeiba.com | Race card (出馬表) |
| netkeiba.com | Race result (レース結果) |
| JRA Official | Race card (出馬表) |
| JRA Official | Race result (レース結果) |

### Extractable Data — Race Card (出馬表)

| Data | netkeiba | JRA | Free | Pro |
|---|:-:|:-:|:-:|:-:|
| Bracket / Horse number (枠番・馬番) | ○ | ○ | ○ | ○ |
| Horse name (馬名) | ○ | ○ | ○ | ○ |
| Sex & age (性齢) | ○ | ○ | ○ | ○ |
| Carry weight (斤量) | ○ | ○ | ○ | ○ |
| Jockey (騎手) | ○ | ○ | ○ | ○ |
| Win odds / Popularity (単勝・人気) | ○ | ○ | ○ | ○ |
| Trainer (調教師) | ○ | ○ | - | ○ |
| Body weight (馬体重) | ○ | - | - | ○ |
| Pedigree — Sire, Dam, Dam's sire (血統) | ○ | ○ | - | ○ |
| Previous races, up to 4 (前走成績) | - | ○ | - | ○ |

### Extractable Data — Race Result (レース結果)

| Data | netkeiba | JRA | Free | Pro |
|---|:-:|:-:|:-:|:-:|
| Finish position (着順) | ○ | ○ | ○ | ○ |
| Bracket / Horse number (枠番・馬番) | ○ | ○ | ○ | ○ |
| Horse name (馬名) | ○ | ○ | ○ | ○ |
| Sex & age (性齢) | ○ | ○ | ○ | ○ |
| Carry weight (斤量) | ○ | ○ | ○ | ○ |
| Jockey (騎手) | ○ | ○ | ○ | ○ |
| Time (タイム) | ○ | ○ | ○ | ○ |
| Win odds / Popularity (単勝・人気) | ○ | ○ | ○ | ○ |
| Margin (着差) | ○ | ○ | - | ○ |
| Sectional position (通過順) | ○ | ○ | - | ○ |
| Last 3F (上がり 3F) | ○ | ○ | - | ○ |
| Body weight (馬体重) | ○ | ○ | - | ○ |

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
| Markdown output | ○ | ○ |
| CSV output | - | ○ |
| AI prompt — General analysis (総合分析) | ○ | ○ |
| AI prompt — Race review (レース回顧) | ○ | ○ |
| AI prompt — Pace analysis (展開予想) | - | ○ |
| AI prompt — Longshot finder (穴馬発掘) | - | ○ |
| AI prompt — Pedigree analysis (血統分析) | - | ○ |
| AI prompt — Track bias (馬場バイアス) | - | ○ |
| AI prompt — Next-run picks (次走注目馬) | - | ○ |
| Extended data (trainer, body weight, pedigree, etc.) | - | ○ |

## Output Formats

### Markdown
Standard table format. Copy-paste into any Markdown-compatible tool.

### CSV (Pro)
Comma-separated values. Open directly in Excel or Google Sheets. Includes all data fields.

### AI Analysis Prompt
Select from 7 prompt templates optimized for different analysis styles. Free users get General Analysis and Race Review. Pro unlocks 5 additional specialized templates.

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
