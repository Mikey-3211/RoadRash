import urllib.request
import re
import json

url = "https://vcop2.lol/"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})

with urllib.request.urlopen(req) as resp:
    headers = dict(resp.headers)
    html = resp.read().decode("utf-8", errors="ignore")

# Find all scripts, stylesheets, links
scripts = re.findall(r'<script[^>]*src=["\']([^"\']+)["\']', html)
links = re.findall(r'<link[^>]*href=["\']([^"\']+)["\']', html)

# Scan for wasm, data, js bundles, websockets
wasm_files = set(re.findall(r'["\']([^"\']+\.wasm[^"\']*)["\']', html))
data_files = set(re.findall(r'["\']([^"\']+\.data[^"\']*)["\']', html))
ws_endpoints = set(re.findall(r'wss?://[^\s"\'<>]+', html))

audit_data = {
    "url": url,
    "status": 200,
    "headers": {k: str(v) for k, v in headers.items()},
    "scripts": scripts,
    "links": links,
    "wasm_references": list(wasm_files),
    "data_references": list(data_files),
    "websocket_references": list(ws_endpoints)
}

print("Scripts found:", len(scripts))
for s in scripts:
    print(" - Script:", s)

print("Links found:", len(links))
for l in links:
    print(" - Link:", l)

with open("D:/RiderProjects/RoadRash/docs/research/vcop2-initial-audit.json", "w", encoding="utf-8") as f:
    json.dump(audit_data, f, indent=2)

print("\nSaved initial audit to docs/research/vcop2-initial-audit.json")
