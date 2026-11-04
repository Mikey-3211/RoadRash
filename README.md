# Road Rash Offline Standalone (Web & Mobile)

This repository contains the reverse-engineered and packaged offline bundle of **RoadRash Classic** (PC/3DO WebGL remake).

## 🎮 What has been extracted & packaged?
- **Core Engine:** Pure Three.js + Web Audio client. No DOS emulator or cloud streaming required.
- **5 Complete Tracks:** The City, Sierra Nevada, The Peninsula, Napa Valley, Pacific Coast Highway.
- **All Track Geometry & Elevation:** JSON sections, lanes, forks, hills, kerbs, hazards, road signs, and side joins.
- **Riders & Bikes:** Full sprite atlases (`rider0.png` to `rider15.png`), bike models (Rat, Sport, Super), and dashboards.
- **Sound Effects:** Complete set of 72 audio samples (engine revs, collisions, kicks, swishes, police sirens, grunts).
- **Mobile Controls:** Native touch on-screen controls (`touch-layout.js`) already built-in.
- **Offline Cleaned:** Google Analytics and tracking scripts neutralized; assets served locally with zero external network requests.

---

## 🚀 Quick Start (Running Offline on PC or Mobile)

### Method 1: Local HTTP Server (Immediate Play)
Because modern browsers restrict ES modules and WebGL textures over `file://` protocol for security reasons, run the lightweight zero-dependency server:

```bash
node server.mjs
```

1. **On your PC:** Open `http://localhost:8080` in Chrome, Edge, or Brave.
2. **On your Phone (WiFi/Hotspot):** Open the displayed IP address (e.g. `http://192.168.1.x:8080`) on your phone browser.

---

### Method 2: Install directly on Mobile (Standalone APK)
To run it completely standalone on Android without keeping a PC server running:

1. Use **Capacitor** to wrap the `public/` folder into an Android app:
   ```bash
   npm init @capacitor/app roadrash-app --web-dir public
   cd roadrash-app
   npm install @capacitor/android
   npx cap add android
   npx cap sync
   npx cap open android
   ```
2. Build and export the APK from Android Studio or run `gradlew assembleDebug`.
3. Install the APK onto your Android phone. It will run completely offline with native touch controls!

