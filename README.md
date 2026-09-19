# ChatGPT Avatar Overlay

A minimal Chrome Manifest V3 extension that adds a fixed, non-interactive framed avatar image to the left of ChatGPT's conversation column on ultrawide displays. It appends its own element directly to `document.body`; it does not depend on or change ChatGPT's React UI.

## Project structure

```
manifest.json           Chrome extension manifest
content.js              Creates the overlay
styles.css              Fixed-position overlay styling
assets/placeholder.svg  Default transparent placeholder image
```

## Load locally

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode**.
3. Select **Load unpacked**.
4. Choose this repository folder (`now-you-see-me`).
5. Open or refresh a page at `https://chatgpt.com/`.

## Use your avatar

The extension currently uses `assets/placeholder.svg`, a simple transparent SVG. Put your transparent PNG at `assets/avatar.png`, then change this line in `content.js`:

```js
const AVATAR_ASSET = 'assets/placeholder.svg';
```

to:

```js
const AVATAR_ASSET = 'assets/avatar.png';
```

The image is displayed in a 220px by 220px frame by default and fills it with `object-fit: cover`. The overlay starts at a default position of 130px from the viewport's left edge and may overlap the ChatGPT sidebar. Use the small top-left dot to drag it; the dragged position is saved as relative horizontal and vertical ratios, so it restores approximately in the same place when monitor or window size changes. Use the top-right × to close it for the current page session only. If the selected image fails to load, the extension falls back to `assets/placeholder.svg`; if that also cannot load, it removes the overlay without affecting the page.

After changing any extension file, return to `chrome://extensions`, click the extension's reload icon, then refresh the ChatGPT tab.

## Current limitations

- Drag position persists across reloads and is recalculated for the current viewport; closing remains session-only and reload restores the overlay.
- There is no animation, state detection, or ChatGPT integration.
- Position and size are fixed in `styles.css` (`left: 130px`, `bottom: 32px`, and a 220px square frame).
- There is no settings page or saved configuration.
