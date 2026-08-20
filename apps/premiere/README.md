# FreeFrame for Premiere Pro

A CEP panel that brings FreeFrame review into Premiere Pro: browse projects and
assets, read comments, drop them onto the timeline as markers, jump between
them, link an asset to the sequence you're cutting, and send a render back up as
a new version.

Built with [Bolt CEP](https://github.com/hyperbrew/bolt-cep) (Vite + React +
TypeScript, with end-to-end typed `evalTS` calls into ExtendScript).

## What it does

| Feature | Where |
|---|---|
| Sign in against a FreeFrame server (email + password, auto token refresh) | `src/js/lib/freeframe/api.ts` |
| Browse projects → folders → assets, filter by name | `src/js/main/components/Browser.tsx` |
| Read/post comments and replies, resolve threads, pick a version | `src/js/main/components/AssetView.tsx` |
| Push comments onto the active sequence as markers, and clear them again | `src/jsx/ppro/ppro.ts` (`syncMarkers`) |
| Click a timecode — or the ↑ / ↓ buttons — to move the playhead | `setPlayheadSeconds` |
| Post a comment at the current playhead position | `AssetView` composer |
| Link an asset to the open sequence, stored in the .prproj | `setLink` / `getLink` |
| Render through Media Encoder and upload as a new version | `src/js/main/components/ExportView.tsx` |

Markers the panel creates carry `[ff:<comment-id>]` in their comment field. That
tag is how a re-sync knows which markers are its own: stale ones are deleted,
existing ones are left in place, and markers you made by hand are never touched.

## Requirements

- Premiere Pro 14.0 (2020) or newer
- Node 18+ for the build
- A reachable FreeFrame API (this repo's `apps/api`)

## Develop

```bash
npm install
```

```bash
npm run dev
```

`npm run dev` serves the panel in a browser at http://localhost:3000 with hot
reload. The host calls are no-ops there — useful for UI work, not for markers.

To run inside Premiere:

```bash
npm run build
```

That compiles the panel and the ExtendScript, then symlinks `dist/cep` into the
CEP extensions folder. Restart Premiere and open **Window → Extensions →
FreeFrame**.

Unsigned panels need CEP debug mode once per machine:

- **Windows:** set `PlayerDebugMode` to `1` (a `REG_SZ`) under
  `HKEY_CURRENT_USER\Software\Adobe\CSXS.12` (repeat for the other `CSXS.*`
  versions you have).
- **macOS:** `defaults write com.adobe.CSXS.12 PlayerDebugMode 1`

Use `npm run watch` while iterating — it rebuilds on save; reload the panel with
the debug console at http://localhost:8860.

## Ship it

```bash
npm run zxp
```

Produces a signed `.zxp` in `dist/zxp` using the certificate settings in
`cep.config.ts` — change `zxp.org` and `zxp.password` before distributing.
`npm run zip` builds an unsigned archive with a ZXP installer bundled.

## CORS

The built panel is loaded from `file://`, so its requests carry `Origin: null`.
Allow that origin on the API:

```bash
CORS_ALLOW_ORIGINS=null
```

Object storage needs to accept it too. MinIO allows every origin by default; a
locked-down S3 bucket needs `null` in its CORS policy for the multipart PUTs
that the export upload uses.

## Export presets

Media Encoder renders from an `.epr` preset, and there is no reliable way to
pick a sensible default across installs — so the panel asks for one. Export a
preset from Premiere (**File → Export → Media → Save Preset**) and point the
Export tab at it. It's remembered in `~/.freeframe/premiere-panel.json`
alongside the server URL and tokens.

## Layout

```
src/
├── js/                       # the panel (React, runs in CEP's Chromium)
│   ├── lib/cep/              # Bolt's CSInterface + Node bindings
│   ├── lib/freeframe/        # API client, upload, settings, host bridge
│   └── main/                 # views
├── jsx/ppro/ppro.ts          # ExtendScript: markers, playhead, link, encode
└── shared/                   # config + typed events shared by both sides
```

ExtendScript is ES3. Keep `src/jsx` free of `forEach`/`map`/`indexOf`/`trim` on
built-ins and use the helpers in `src/jsx/utils/utils.ts` instead.
