# ChatGPT Avatar Overlay

A minimal Chrome Manifest V3 extension that adds a fixed, non-interactive framed avatar image to the left of ChatGPT's conversation column on ultrawide displays. It appends its own element directly to `document.body`; it does not depend on or change ChatGPT's React UI.

## Project structure

```
manifest.json           Chrome extension manifest
content.js              Creates the overlay
styles.css              Fixed-position overlay styling
assets/placeholder.svg  Default transparent placeholder image
options.html            Extension settings page
options.js              Avatar upload and storage logic
options.css             Settings page styling
scripts/package.sh      Local release ZIP packager
```

## Installation

### Development

1. Clone the repository:

   ```bash
   git clone https://github.com/alexpirogovski/now-you-see-me.git
   ```

2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode**.
4. Select **Load unpacked**.
5. Choose the cloned `now-you-see-me` directory.
6. Open or refresh a page at `https://chatgpt.com/`.

### GitHub Release

1. Download the release ZIP from the repository's GitHub Releases page.
2. Extract the ZIP to a permanent directory. Chrome cannot load an unpacked extension directly from a ZIP file.
3. Open `chrome://extensions` in Chrome and turn on **Developer mode**.
4. Select **Load unpacked** and choose the extracted directory.

Do not move or delete the selected cloned/extracted directory after loading it: Chrome uses that directory for the installed unpacked extension.

## Use your avatar

Open `chrome://extensions`, select this extension's **Details**, then choose **Extension options**. Configure separate **Idle avatar**, **Thinking avatar**, and **Answering avatar** images. All accept PNG, JPEG, or WebP files up to 5 MB; preview each image and click its matching Save button.

The avatar images are stored locally in your Chrome profile as image data, not as filesystem paths. They are not synced across computers, so upload them again on each computer where you use the extension. Use **Use default** to remove any custom image without changing the saved overlay position. If no Thinking image is configured, it falls back to Answering, then Idle; if no Answering image is configured, it falls back to Idle.

The image is displayed in a 220px by 220px frame and fills it with `object-fit: cover`. The overlay starts at a default position of 130px from the viewport's left edge and may overlap the ChatGPT sidebar. Use the small top-left dot to drag it; the dragged position is saved as relative horizontal and vertical ratios, so it restores approximately in the same place when monitor or window size changes. Use the top-right × to close it for the current page session only.

The extension supports three states: **Idle**, shown when ChatGPT is inactive; **Thinking**, shown when ChatGPT exposes its expandable Thinking activity control; and **Answering**, shown while the Stop button indicates active response generation. State priority is: Thinking control present → Thinking; otherwise Stop button present → Answering; otherwise → Idle.

Thinking detection inspects only expandable buttons whose visible text consists entirely of one or more `Thinking` words. Answering detection uses the semantic Stop button, `button[aria-label="Stop"]`. Detection relies on observable ChatGPT DOM semantics and may need maintenance if ChatGPT changes its UI. The extension deliberately does not try to detect every possible internal or tool activity state.

After changing any extension file, return to `chrome://extensions`, click the extension's reload icon, then refresh the ChatGPT tab.

## Current limitations

- Drag position persists across reloads and is recalculated for the current viewport; closing remains session-only and reload restores the overlay.
- Custom avatar images are local to the current Chrome profile and are not synced across computers.
- Only Idle, Thinking, and Answering states are currently supported.
- There is no animation, state detection, or ChatGPT integration.
- Position and size are fixed in `styles.css` (`left: 130px`, `bottom: 32px`, and a 220px square frame).
