import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const PORT = 8080;
const PUBLIC_DIR = path.resolve('public');

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4'
};

const OFFLINE_VCOP2_DIR = path.resolve('offline/vcop2.lol');

// In-memory or file-backed career & profile state for offline / LAN play
const CAREER_DB_PATH = path.resolve('career_state.json');
let careerDb = {
  user: {
    id: 'offline-player-1',
    username: 'RoadRider',
    displayName: 'RoadRider',
    kind: 'guest'
  },
  career: null
};

if (fs.existsSync(CAREER_DB_PATH)) {
  try {
    careerDb = JSON.parse(fs.readFileSync(CAREER_DB_PATH, 'utf8'));
  } catch (err) {
    console.warn('Could not read career state file, using fresh state:', err);
  }
}

function saveCareerDb() {
  try {
    fs.writeFileSync(CAREER_DB_PATH, JSON.stringify(careerDb, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save career state:', err);
  }
}

// Load bike data for career server calculations
let bikesCatalog = null;
try {
  bikesCatalog = JSON.parse(fs.readFileSync('public/classic-assets/414a4427a4dcdcc4/data/bikes.json', 'utf8'));
} catch (e) {
  console.warn('Warning: Could not pre-load bikes.json', e);
}

const CAREER_CHARS = ['axle', 'bose', 'cydney', 'jon', 'pearl', 'rhonda', 'jim', 'mike'];
const SHOP_TO_ID = e => (e < 5 ? e : e < 10 ? 10 + (e - 5) : 5 + (e - 10));

function getBikePrice(bikeIndex) {
  if (!bikesCatalog || !bikesCatalog.bikes) return 3000;
  const bikeId = SHOP_TO_ID(bikeIndex);
  return bikesCatalog.bikes[bikeId]?.price ?? 3000;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error('Body too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  let reqPath = decodeURIComponent(req.url.split('?')[0]);
  if (reqPath === '/' || reqPath.endsWith('/')) {
    reqPath += 'index.html';
  }

  // Handle /api/ requests with full offline career, auth, and bike shop persistence
  if (reqPath.startsWith('/api/')) {
    const apiRoute = reqPath.slice(4); // Remove /api
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      if (apiRoute === '/auth/browser' && req.method === 'POST') {
        const body = await parseBody(req);
        res.writeHead(200);
        res.end(JSON.stringify({
          user: careerDb.user,
          device: body.device || 'offline-device'
        }));
        return;
      }

      if (apiRoute === '/profile' && req.method === 'GET') {
        res.writeHead(200);
        res.end(JSON.stringify({
          profile: {
            save: null,
            updated_at: new Date().toISOString()
          },
          career: careerDb.career
        }));
        return;
      }

      if (apiRoute === '/profile/name' && req.method === 'PUT') {
        const body = await parseBody(req);
        if (body.name) {
          careerDb.user.displayName = body.name.trim();
          saveCareerDb();
        }
        res.writeHead(200);
        res.end(JSON.stringify({ displayName: careerDb.user.displayName }));
        return;
      }

      if (apiRoute === '/career' && req.method === 'GET') {
        res.writeHead(200);
        res.end(JSON.stringify({ career: careerDb.career }));
        return;
      }

      if (apiRoute === '/career' && req.method === 'POST') {
        const body = await parseBody(req);
        const charId = body.char || 'axle';
        const charIdx = Math.max(0, CAREER_CHARS.indexOf(charId));
        const charData = bikesCatalog?.chars?.[charIdx] || { cash: 1000, bike: 1 };
        
        careerDb.career = {
          char: charId,
          cash: charData.cash,
          bike: charData.bike,
          level: 1,
          qualified: {}
        };
        saveCareerDb();
        console.log(`[CAREER] Started new career as ${charId} ($${charData.cash}, bike #${charData.bike})`);

        res.writeHead(200);
        res.end(JSON.stringify({ career: careerDb.career }));
        return;
      }

      if (apiRoute === '/career/bike' && req.method === 'POST') {
        const body = await parseBody(req);
        const newBikeIndex = Number(body.bike);

        if (!careerDb.career) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'No active career' }));
          return;
        }

        if (newBikeIndex === careerDb.career.bike) {
          res.writeHead(409);
          res.end(JSON.stringify({ error: 'Already own this bike' }));
          return;
        }

        const currentBikePrice = getBikePrice(careerDb.career.bike);
        const tradeInValue = Math.floor(currentBikePrice / 2);
        const newBikePrice = getBikePrice(newBikeIndex);
        const totalFunds = careerDb.career.cash + tradeInValue;

        if (totalFunds < newBikePrice) {
          res.writeHead(409);
          res.end(JSON.stringify({ error: 'Not enough money' }));
          return;
        }

        careerDb.career.cash = totalFunds - newBikePrice;
        careerDb.career.bike = newBikeIndex;
        saveCareerDb();
        console.log(`[BIKE SHOP] Bought bike #${newBikeIndex}! Remaining cash: $${careerDb.career.cash}`);

        res.writeHead(200);
        res.end(JSON.stringify({ career: careerDb.career }));
        return;
      }

      if (apiRoute === '/races' && req.method === 'GET') {
        res.writeHead(200);
        res.end(JSON.stringify({ races: [] }));
        return;
      }

      if (apiRoute === '/races' && req.method === 'POST') {
        const body = await parseBody(req);
        res.writeHead(200);
        res.end(JSON.stringify({ race: body }));
        return;
      }

      if (apiRoute.includes('/checkpoint')) {
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (apiRoute.includes('/finish')) {
        const body = await parseBody(req);
        // If in career mode and finished, update prize purse and qualification
        if (careerDb.career && body.status === 'finished') {
          const place = body.place || 1;
          const track = body.course || 'city';
          const level = body.level || careerDb.career.level || 1;
          const purseTable = [3000, 2500, 2200, 2000, 1800, 1600, 1400, 1200];
          const purse = (purseTable[place - 1] || 0) * level;

          careerDb.career.cash += purse;
          if (place <= 3) {
            careerDb.career.qualified[`${level}:${track}`] = true;
          }
          saveCareerDb();
          console.log(`[CAREER RACE] Finished #${place}! Won $${purse}. New total: $${careerDb.career.cash}`);
          res.writeHead(200);
          res.end(JSON.stringify({
            paid: true,
            purse: purse,
            career: careerDb.career
          }));
          return;
        }

        res.writeHead(200);
        res.end(JSON.stringify({ ok: true, career: careerDb.career }));
        return;
      }

      if (apiRoute.startsWith('/boards')) {
        res.writeHead(200);
        res.end(JSON.stringify({ entries: [] }));
        return;
      }

      if (apiRoute === '/rank/me') {
        res.writeHead(200);
        res.end(JSON.stringify({
          rank: {
            level: 'Road Rash Veteran',
            totalXP: 5000
          }
        }));
        return;
      }

      // Default API fallback
      res.writeHead(200);
      res.end('{}');
      return;
    } catch (err) {
      console.error('[API ERROR]:', err);
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
      return;
    }
  }

  // Local offline VCop2 mirror handler
  if (reqPath.startsWith('/games/vcop2/local')) {
    let sub = reqPath.replace(/^\/games\/vcop2\/local\/?/, '');
    if (!sub || sub.endsWith('/')) sub += 'index.html';
    const localFile = path.join(OFFLINE_VCOP2_DIR, sub);
    if (fs.existsSync(localFile) && !fs.statSync(localFile).isDirectory()) {
      const ext = path.extname(localFile).toLowerCase();
      const headers = {
        'Content-Type': mimeTypes[ext] || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*'
      };
      res.writeHead(200, headers);
      fs.createReadStream(localFile).pipe(res);
      return;
    }
  }

  const filePath = path.join(PUBLIC_DIR, reqPath);

  if (fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
    const ext = path.extname(filePath).toLowerCase();
    const headers = {
      'Content-Type': mimeTypes[ext] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*'
    };

    // Scoped COOP/COEP: Required for HOTD2 WebAssembly multithreading & SharedArrayBuffer,
    // but omitted on /games/vcop2/ so the embedded iframe can load without CORP errors.
    if (!reqPath.includes('games/vcop2/')) {
      headers['Cross-Origin-Opener-Policy'] = 'same-origin';
      headers['Cross-Origin-Embedder-Policy'] = 'require-corp';
    }

    res.writeHead(200, headers);
    fs.createReadStream(filePath).pipe(res);
  } else {
    // If it's a missing cutscene video, return an empty MP4 or 204 so the game cleanly continues
    if (reqPath.endsWith('.mp4')) {
      res.writeHead(204);
      res.end();
      return;
    }

    console.warn('⚠️ [SERVER 404]:', req.method, req.url);

    // If it's a critical texture or image, or mano websocket
    if (reqPath.includes('/mano')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{}');
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found: ' + reqPath);
  }
});

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log(`\n======================================================`);
  console.log(`🚀 RoadRash Classic Offline Server is Running (v3)!`);
  console.log(`💻 Local (PC):    http://localhost:${PORT}`);
  console.log(`📱 Mobile (Phone): http://${ip}:${PORT}`);
  console.log(`💾 Full Offline Career & Bike Shop Persistence Enabled`);
  console.log(`======================================================\n`);
});
