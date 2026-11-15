# Virtua Cop 2 (vcop2.lol) Technical Architecture & Dependency Audit

**Date of Investigation:** 2026-11-15  
**Target Host:** `https://vcop2.lol/`  
**Tooling Used:** Python 3.12 HTTP Inspection & Scrapling 0.5.1 Environment Audit  
**Target Repository:** `D:\RiderProjects\RoadRash` (HEAD: `59ec2f1`)

---

## 1. Executive Summary: Can VCop2 Run and Play Offline?

| Mode | Offline Viable? | Technical Dependency | Legal / Redistribution Status |
|---|:---:|---|---|
| **Single-Player Mode** | **Technically YES** | **Client-Side Self-Contained:** Uses `build/vcop2.wasm` (649 KB) and `build/game/manifest.json` (32.7 MB). WebSockets are **NOT** invoked. | **Proprietary & Copyrighted:** Assets belong to SEGA / AM2; WebAssembly recompiler created by `divyanshkul`. No public redistribution license exists. |
| **Multiplayer Co-op Mode** | **NO** | **Server-Dependent:** Connects via WebSocket signaling to `wss://vcop2.lol/rooms` for peer packet exchange. | Requires active backend room signaling server. |

---

## 2. Network Topology & Asset Inventory

The game engine is loaded entirely through modern ES Modules into a Dedicated Web Worker (`startup-worker.js`):

```
https://vcop2.lol/
├── index.html (8,188 bytes)
├── play.js (11,008 bytes) [Main Thread Orchestrator]
│   ├── game-viewport.js & game-assets.js
│   ├── game-session.js
│   ├── frame-presenter.js (WebGL Canvas Presenter)
│   ├── audio-player.js & cd-audio.js (WebAudio + CD-DA streaming)
│   └── room-ui.js [Multiplayer Lobby Controller]
├── startup-worker.js (24,710 bytes) [Web Worker Game Thread]
│   ├── build/vcop2.js (14,151 bytes) [Emscripten glue]
│   └── build/vcop2.wasm (649,442 bytes / 634 KB) [Main WASM Game Engine]
└── build/game/manifest.json (v1 manifest describing 116 PC asset files)
    ├── Total uncompressed asset size: 32,753,343 bytes (31.24 MB)
    ├── Executable base: PROJECT/PPJ2DD.EXE
    ├── 3D Models & Game Scripts: BIN/ (CAMMOV*.BIN, L_*.BIN)
    └── CD Music Disc (Optional): music/disc.cue + disc.bin (546 MB streaming range requests)
```

---

## 3. Single-Player vs. Multiplayer Network Flow Analysis

### Single-Player Session Flow:
1. User clicks **"PLAY GAME"** on the UI.
2. `play.js` invokes `createGameSession().play({ network: undefined })`.
3. `loadGameAssets()` reads `build/game/manifest.json` and loads the 116 asset files (31.2 MB).
4. `game-assets.js` caches these files into the browser's `CacheStorage` under the key:
   `vcop2-game-assets-v1`.
5. `startup-worker.js` instantiates `build/vcop2.wasm`.
6. Files are passed into WASM memory via `_vcop2_startup_add_file()`.
7. **Crucial Finding**: **Zero WebSocket or external API calls are made during single-player play.** The engine executes 100% inside the client Web Worker and renders to `<canvas id="game-canvas">`.

### Multiplayer Session Flow:
1. User clicks **"ROOM"** or enters a room code.
2. `room-ui.js` triggers `roomSignalingUrl()`:
   ```javascript
   // multiplayer-config.js:
   return `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/rooms`;
   ```
3. Connects to `wss://vcop2.lol/rooms`.
4. Exchanges signaling packets (`PEER_CREATED`, `PEER_DESTROYED`, packet relays).
5. If the WebSocket connection drops, multiplayer desynchronizes and closes.

---

## 4. Cache & Offline Storage Mechanics

`game-assets.js` contains a built-in offline caching layer using the Cache API:
```javascript
const ASSET_CACHE = 'vcop2-game-assets-v1';

async function readGameFile(entry, cache, fetcher, signal) {
  if (cache) {
    const response = await cache.match(entry.cacheKey);
    if (response) return verify(response);
  }
  const { blob } = await readExact(entry.url, entry.size, fetcher, signal);
  await cache?.put(entry.cacheKey, new Response(blob, ...));
  return blob;
}
```
- **Finding**: On `vcop2.lol`, once a user has loaded the 31.2 MB asset set, subsequent single-player loads are read directly from `CacheStorage` without redownloading the full 31.2 MB.
- **Limitation**: The initial document and worker scripts do not use a Service Worker on `vcop2.lol`, so cold offline launches require pre-caching the HTML/JS wrappers.

---

## 5. Answers to Core Evaluation Questions

### Q1: Can we make VCop2 launch and play offline on our own RoadRash domain without depending on vcop2.lol?
- **Single-Player**: **Technically YES, but Legally BLOCKED.**
  - *Technical*: The single-player runtime consists of `build/vcop2.wasm` (634 KB) and 116 extracted PC assets (31.2 MB from the 1997 Windows PC release `PPJ2DD.EXE`). It has zero server-side dependencies.
  - *Legal / IP*: The files contain proprietary SEGA / AM2 textures, models, sound effects, and binary code. Hosting these files on our repository or Vercel domain without an explicit commercial/distribution license from SEGA and creator `divyanshkul` is unauthorized.
- **Multiplayer**: **NO.**
  - Multiplayer strictly depends on the proprietary signaling server at `wss://vcop2.lol/rooms`.

### Q2: What exact technical work and permissions are needed to self-host?
1. **Permission**: Written authorization from `divyanshkul` to redistribute his compiled `vcop2.wasm` engine, or written permission from SEGA to host the 31.2 MB game asset package.
2. **Alternative (Clean-Room BYOR)**: Implement a user-side folder picker (similar to HOTD2) where users supply their own legally acquired 1997 PC CD-ROM directory containing `PROJECT/PPJ2DD.EXE`, `BIN/`, `BMP/`, and `SE/`, passing them locally into the WASM worker memory without public redistribution.

---

## 6. Recommended Architecture for Retro Arcade

1. **Keep the Current Seamless Embed**: Retain `/games/vcop2/` with the in-domain cabinet player embedding `https://vcop2.lol/`.
2. **Keep Clear Transparency**: Maintain the status badge:  
   `ONLINE ONLY (Hosted at vcop2.lol)`.
3. **No Code Scraping**: Do not scrape or mirror the proprietary WASM and 31.2 MB game assets to GitHub or Vercel.
