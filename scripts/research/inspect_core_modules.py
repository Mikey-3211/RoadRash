import urllib.request
import re
import json

base_url = "https://vcop2.lol/"

def fetch_file(path):
    u = base_url + path.lstrip('./')
    try:
        req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.read().decode("utf-8", errors="ignore")
    except Exception as e:
        print(f"Error fetching {u}: {e}")
        return None

game_assets_js = fetch_file("game-assets.js")
game_session_js = fetch_file("game-session.js")
room_ui_js = fetch_file("room-ui.js")

results = {
    "game-assets.js": {},
    "game-session.js": {},
    "room-ui.js": {}
}

if game_assets_js:
    results["game-assets.js"]["wasm"] = list(set(re.findall(r'["\']([^"\']+\.wasm[^"\']*)["\']', game_assets_js)))
    results["game-assets.js"]["data"] = list(set(re.findall(r'["\']([^"\']+\.data[^"\']*)["\']', game_assets_js)))
    results["game-assets.js"]["fetch_calls"] = re.findall(r'fetch\s*\(([^)]+)\)', game_assets_js)[:10]

if game_session_js:
    results["game-session.js"]["wasm"] = list(set(re.findall(r'["\']([^"\']+\.wasm[^"\']*)["\']', game_session_js)))
    results["game-session.js"]["workers"] = re.findall(r'new\s+Worker\s*\(([^)]+)\)', game_session_js)
    results["game-session.js"]["ws"] = re.findall(r'new\s+WebSocket\s*\(([^)]+)\)', game_session_js)

if room_ui_js:
    results["room-ui.js"]["ws"] = re.findall(r'wss?://[^\s"\'<>]+', room_ui_js)
    results["room-ui.js"]["api"] = re.findall(r'https?://[^\s"\'<>]+', room_ui_js)
    results["room-ui.js"]["ws_calls"] = re.findall(r'new\s+WebSocket\s*\(([^)]+)\)', room_ui_js)

print("=== game-assets.js ===")
print("WASM:", results["game-assets.js"].get("wasm"))
print("DATA:", results["game-assets.js"].get("data"))

print("\n=== game-session.js ===")
print("Workers:", results["game-session.js"].get("workers"))
print("WebSocket:", results["game-session.js"].get("ws"))

print("\n=== room-ui.js ===")
print("WebSocket URLs:", results["room-ui.js"].get("ws"))
print("HTTP APIs:", results["room-ui.js"].get("api"))
print("WebSocket calls:", results["room-ui.js"].get("ws_calls"))

with open("D:/RiderProjects/RoadRash/docs/research/vcop2-core-modules-audit.json", "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2)
