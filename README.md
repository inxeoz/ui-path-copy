# UI Path Copy

A browser extension for Chrome and Firefox. Right-click any element on any page to copy its `data-testid` navigation path to the clipboard — ready to paste straight into a Playwright selector.

---

## Table of Contents

1. [What it copies](#what-it-copies)
2. [Frontend project setup](#frontend-project-setup)
3. [Install — Chrome](#install--chrome)
4. [Install — Firefox](#install--firefox)
5. [Usage](#usage)
6. [How it works](#how-it-works)

---

## What it copies

Right-clicking an element produces a `>` separated path walking up the DOM. Each segment is either the element's `data-testid` value (preferred) or `tag[index]` when no testid is present.

```
input:username
btn:sign-in
div[1] > div[2] > form[1] > div[1] > input:username
```

Paste directly into a Playwright test:

```js
await page.locator('input:username').fill('admin');
await page.locator('btn:sign-in').click();

// or for a deeper path:
await page.locator('div[1] > div[2] > form[1] > div[1] > input:username').click();
```

---

## Frontend project setup

The extension works on **any website** out of the box. No special setup is required for external sites.

For local development against the frontend in this repo:

```bash
# from the frontend/ directory
npm install        # or: bun install
npm run dev        # starts Vite dev server on http://localhost:5175
```

Once the dev server is running, open `http://localhost:5175` in the browser where the extension is installed and start right-clicking.

---

## Install — Chrome

1. Open **chrome://extensions**
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `cmts-navigator/` folder (this folder — the one containing `manifest.json`)
5. The extension appears in the toolbar as **UI Path Copy**

To reload after code changes: click the refresh icon on the extension card in `chrome://extensions`.

---

## Install — Firefox

1. Open **about:debugging**
2. Click **This Firefox** in the left sidebar
3. Click **Load Temporary Add-on...**
4. Navigate to the `cmts-navigator/firefox/` folder and select `manifest.json`
5. The extension is active until Firefox is restarted

> **Note:** Temporary add-ons are removed on restart. For a persistent install, the extension would need to be signed by Mozilla.

To reload after code changes: click **Reload** next to the extension in `about:debugging`.

---

## Usage

1. Navigate to any page in the browser where the extension is installed
2. **Right-click** the element whose path you want
3. In the context menu, click **Copy Navigation Path**
4. The path is now in your clipboard — paste it into your test

A styled confirmation appears in the browser console (F12 → Console):

```
UI Path Copy  Copied 4-segment path: div[1] > section[1] > div[2] > btn:submit
```

If you see the alert _"right-click an element first"_, the right-click was not captured — try right-clicking directly on the element (not the scrollbar or a browser UI area) and then selecting the menu item without moving the mouse to a different element.

---

## How it works

```
User right-clicks element
        │
        ▼
content.js — contextmenu event listener
  stores the right-clicked element in lastRightClicked
        │
        ▼
User clicks "Copy Navigation Path" in context menu
        │
        ▼
background.js — contextMenus.onClicked
  sends { action: 'get-nav-path' } message to the active tab's content script
        │
        ▼
content.js — runtime.onMessage listener
  calls buildPath(lastRightClicked)
  clears lastRightClicked
        │
        ▼
buildPath(el)
  walks up the DOM from the element to <body>
  for each ancestor:
    - if it has data-testid  →  use that value as the segment
    - otherwise              →  use tagName[siblingIndex] (e.g. div[2])
  joins segments with " > "
  returns the path string
        │
        ▼
clipboard write
  Chrome: navigator.clipboard.writeText() with execCommand fallback
  Firefox: path is returned to background.js, which injects
           execCommand copy via tabs.executeScript() into the focused tab
           (avoids Firefox content-script clipboard restrictions)
        │
        ▼
Path is in the clipboard
```

### Path segment rules

| Condition | Segment |
|---|---|
| Element has `data-testid="btn:sign-in"` | `btn:sign-in` |
| Element is the 2nd `<div>` among its siblings | `div[2]` |
| Element is the only `<form>` among its siblings | `form[1]` |

The walk stops at `<body>` — the root container is never included.

### Chrome vs Firefox architecture

| | Chrome (MV3) | Firefox (MV2) |
|---|---|---|
| Background | Service worker (`background.js`) | Persistent page (`background.js`) |
| API namespace | `chrome.*` | `browser.*` (Promise-based) |
| Clipboard | `navigator.clipboard.writeText` in content script | `tabs.executeScript` injects `execCommand` from background |
| Manifest | `manifest.json` | `firefox/manifest.json` |

Firefox uses a different clipboard strategy because `navigator.clipboard.writeText()` in Firefox content scripts does not reliably fire after an extension background message (the user-gesture chain is broken by the time the message arrives). Injecting `execCommand` via `tabs.executeScript` bypasses this — the code runs in the tab context where the page already has focus after the context menu closes.
