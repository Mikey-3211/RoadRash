import urllib.request
import re
import json

base_url = "https://vcop2.lol/"
play_js_url = "https://vcop2.lol/play.js"

req = urllib.request.Request(play_js_url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
with urllib.request.urlopen(req) as resp:
    js_text = resp.read().decode("utf-8", errors="ignore")

print(f"play.js length: {len(js_text)} characters")

# Scan for wasm, data, js bundles, websockets, apis
wasm_matches = set(re.findall(r'["\']([^"\']+\.wasm[^"\']*)["\']', js_text))
data_matches = set(re.findall(r'["\']([^"\']+\.data[^"\']*)["\']', js_text))
ws_matches = set(re.findall(r'wss?://[^\s"\'<>]+', js_text))
http_matches = set(re.findall(r'https?://[^\s"\'<>]+', js_text))

# Scan for common patterns: Emscripten locateFile, Module, fetch, WebSocket
has_websocket = "WebSocket" in js_text
has_fetch = "fetch(" in js_text
has_xhr = "XMLHttpRequest" in js_text

print("\n--- Findings in play.js ---")
print("Has WebSocket API call:", has_websocket)
print("Has fetch API call:", has_fetch)
print("Has XMLHttpRequest call:", has_xhr)
print("WASM references:", wasm_matches)
print("Data references:", data_matches)
print("Explicit WebSocket URLs:", ws_matches)
print("HTTP URLs found:")
for u in http_matches:
    print(" -", u)

# Check for websocket creation patterns
ws_instantiations = re.findall(r'new\s+WebSocket\s*\(([^)]+)\)', js_text)
print("WebSocket instantiations:", ws_instantiations)

analysis = {
    "play_js_size_bytes": len(js_text),
    "has_websocket_api": has_websocket,
    "has_fetch_api": has_fetch,
    "has_xhr_api": has_xhr,
    "wasm_references": list(wasm_matches),
    "data_references": list(data_matches),
    "ws_urls": list(ws_matches),
    "http_urls": list(http_matches),
    "ws_instantiations": ws_instantiations
}

with open("D:/RiderProjects/RoadRash/docs/research/vcop2-playjs-analysis.json", "w", encoding="utf-8") as f:
    json.dump(analysis, f, indent=2)

print("\nSaved detailed analysis to docs/research/vcop2-playjs-analysis.json")
