# UI Path Copy

A browser extension for Chrome and Firefox. Right-click any element to copy its DOM path for E2E tests — Playwright, Cypress, or raw CSS/XPath selectors.

---

## Features

| Feature | Description |
|---|---|
| **Right-click → Copy** | Right-click any element, copy its path in your preferred format |
| **Multiple formats** | Playwright path, CSS selector, XPath, or ready-to-paste Playwright snippet |
| **Inspector mode** | Hover to see paths live, click to copy (toggle from popup or context menu) |
| **Copy all testids** | One-click dump every `data-testid` on the page |
| **Highlight on copy** | Brief gold flash on the copied element |
| **Shadow DOM** | Traverses open shadow roots |
| **`data-testignore`** | Skip noisy wrapper elements |
| **`data-testlabel`** | Human-readable labels alongside testids |
| **`data-test-context`** | Page/section context prefix in paths |

---

## Output formats

Default format is configurable in the popup (click the extension icon).

| Format | Example |
|---|---|
| Playwright path | `div[1] > section[1] > input:email` |
| CSS selector | `section > div:nth-of-type(1) > [data-testid="email"]` |
| XPath | `/html/body/div[1]/section[1]/input[1]` |
| Playwright snippet | `await page.getByTestId('email').fill('')` |

---

## Frontend project setup

Add these attributes to your UI for cleaner, more stable paths:

| Attribute | Purpose |
|---|---|
| `data-testid` | Unique identifier for the element (primary segment) |
| `data-testlabel` | Human-readable label shown alongside the testid |
| `data-testignore` | Mark decorative/wrapper elements to skip in path |
| `data-test-context` | Set on a parent to prefix paths with page/section name |

The extension works on **any website** out of the box without special setup.

For local development:

```bash
# from the frontend/ directory
npm install
npm run dev        # starts Vite dev server on http://localhost:5175
```

Open `http://localhost:5175` in a browser with the extension installed.

---

## Install — Chrome

1. Open **chrome://extensions**
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `chromium/` folder (the one containing `manifest.json`)
5. Click the extension icon to open settings

## Install — Firefox

1. Open **about:debugging**
2. Click **This Firefox**
3. Click **Load Temporary Add-on...**
4. Select `firefox/manifest.json`
5. Temporary add-ons are removed on restart (persistent install requires Mozilla signing)

---

## Usage

### Right-click
1. Right-click any element → context menu appears
2. Select **Copy Path** or **Copy URL + Path**
3. Path is in your clipboard; element flashes gold

### Inspector mode
1. Click the extension icon → **Toggle Inspector**
2. Hover any element to see its path in a floating tooltip
3. Click to copy and auto-exit inspector

### Copy all testids
Right-click → **Copy All testids on Page** or use the popup button. Outputs sorted `data-testid` values with counts for duplicates.

---

## Context menu items

| Item | Action |
|---|---|
| Copy Path | Copies element path in selected format |
| Copy URL + Path | `URL \| path` |
| Copy All testids on Page | All `data-testid` values on the page |
| Toggle Inspector Mode | Enable/disable hover-to-copy mode |

---

## Architecture

```
Right-click element
  → content.js stores target
  → context menu item clicked
  → background.js routes to content script
  → content.js builds path in selected format
  → clipboard write (Chrome: navigator.clipboard / Firefox: execCommand inject)
  → highlight + console log
```

### Segment rules

| Condition | Segment |
|---|---|
| Element has `data-testid="btn:sign-in"` | `btn:sign-in` |
| Element is 2nd `<div>` among siblings | `div[2]` |
| Element has `data-testignore` | Skipped (parent used) |

The walk stops at `<body>` and has a 50-depth limit.

### Chrome vs Firefox

| | Chrome (MV3) | Firefox (MV2) |
|---|---|---|
| Background | Service worker | Persistent page |
| API | `chrome.*` | `browser.*` |
| Clipboard | Content script writes directly | Background injects via `tabs.executeScript` |
| Inspector mode | ✅ Full | ❌ (not supported) |
| Manifest | `manifest.json` | `firefox/manifest.json` |

---

## Development

Test the extension with Playwright:

```bash
node diagnose.js
```

This launches a browser with the extension loaded and verifies path building and clipboard behaviour.
