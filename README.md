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

The image is displayed in a 220px by 220px frame by default and fills it with `object-fit: cover`. The overlay uses a temporary fixed position of 130px from the viewport's left edge and may overlap the ChatGPT sidebar. If the selected image fails to load, the extension falls back to `assets/placeholder.svg`; if that also cannot load, it removes the overlay without affecting the page.

After changing any extension file, return to `chrome://extensions`, click the extension's reload icon, then refresh the ChatGPT tab.

## Current limitations

- The avatar is static: no animation, controls, state detection, or ChatGPT integration.
- Position and size are fixed in `styles.css` (`left: 130px`, `bottom: 32px`, and a 220px square frame).
- There is no settings page or saved configuration.
