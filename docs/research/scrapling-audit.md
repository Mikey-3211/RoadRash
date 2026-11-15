# Scrapling Tooling & Network Audit Log

**Audited Host:** `https://vcop2.lol/`  
**Tooling Environment:** Python 3.12, Scrapling 0.5.1 (`scrapling.Fetcher`, `scrapling.AsyncFetcher`, `scrapling.StealthyFetcher`)  
**Audit Purpose:** Non-destructive, read-only network dependency audit for offline gaming feasibility.

---

## 1. Tooling Verification
- Installed Scrapling version: `0.5.1`.
- API architecture verified: v0.5.x deprecates legacy `capture_xhr` in favor of session network monitoring and structured DOM extraction.
- HTTP requests executed with standard User-Agent headers adhering to robot limits and avoiding access control evasion.

---

## 2. Resource Audit Findings
- **Initial Document**: `https://vcop2.lol/` (HTTP 200, 8,188 bytes HTML).
- **Core Scripts**:
  - `play.js`: 11,008 bytes
  - `game-viewport.js`: 5,124 bytes
  - `game-assets.js`: 8,124 bytes
  - `game-session.js`: 5,838 bytes
  - `startup-worker.js`: 24,710 bytes
  - `build/vcop2.js`: 14,151 bytes
  - `build/vcop2.wasm`: 649,442 bytes (WebAssembly binary)
- **Game Assets**:
  - `build/game/manifest.json`: 116 files, 32.7 MB total.
- **Network Handshakes**:
  - Single-Player: Zero WebSocket connections opened. All game simulation runs locally inside `startup-worker.js`.
  - Multiplayer: `wss://vcop2.lol/rooms` opened only upon room creation or join.

---

## 3. Conclusion on Offline Self-Hosting
- Single-player execution has **no technical server-side lock**. It is an Emscripten-compiled binary running client-side.
- However, self-hosting requires distributing SEGA's proprietary 1997 PC asset files and `divyanshkul`'s compiled engine binary.
- Therefore, the **embedded in-cabinet player (`/games/vcop2/`)** remains the optimal and legally compliant architecture for Retro Arcade.
