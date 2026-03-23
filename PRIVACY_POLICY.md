# Keiba Race Data Formatter - Privacy Policy

Last updated: 2026-03-22

## Overview

Keiba Race Data Formatter (the "Extension") is a Chrome browser extension that formats horse racing data from web pages the user is actively viewing. This privacy policy explains what data the Extension accesses, how it is used, and how it is protected.

## Data Collection and Usage

### Data the Extension Accesses

| Data Type | Purpose | Stored? | Sent Externally? |
|---|---|---|---|
| Page DOM content | Extract and format horse racing data from the active tab | No | No |
| License key | Verify Pro license activation | Yes (locally) | No |
| License status | Remember Pro activation state | Yes (locally) | No |

### DOM Content (Horse Racing Data)

- The Extension reads the DOM (Document Object Model) of web pages you are actively viewing.
- This data is processed entirely within your browser.
- Extracted data is copied to your clipboard only when you explicitly click the "Copy" button.
- **No page content is stored, cached, or transmitted to any external server.**

### License Information

- If you activate a Pro license, your license key is stored locally using Chrome's `chrome.storage.local` API.
- The license key is validated locally within your browser. **No license data is sent to any external server.**

## Permissions Used

| Permission | Reason |
|---|---|
| `activeTab` | Access the current tab's page content when the user clicks the extension icon |
| `scripting` | Execute the data extraction script on the active page |
| `clipboardWrite` | Copy formatted data to the user's clipboard |
| `storage` | Store license activation status locally |

## Data the Extension Does NOT Collect

- Personal information (name, email, address)
- Browsing history
- Cookies or session data
- Analytics or usage tracking data
- Data from pages other than supported horse racing sites

## Third-Party Services

The Extension does not communicate with any third-party services. All data processing and license validation occurs locally within your browser.

## Data Storage

- All data is stored locally on your device using Chrome's built-in storage API.
- No data is stored on external servers.
- You can remove all stored data by uninstalling the Extension or clearing the extension's storage via Chrome settings.

## Children's Privacy

The Extension does not knowingly collect any information from children under 13 years of age.

## Changes to This Policy

We may update this privacy policy from time to time. Changes will be reflected in the "Last updated" date above.

## Contact

If you have questions about this privacy policy, please contact us at:

- Product page: [Payhip Store](https://payhip.com)

---

This privacy policy is provided in compliance with the [Chrome Web Store Developer Program Policies](https://developer.chrome.com/docs/webstore/program-policies/).
