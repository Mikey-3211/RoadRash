import fs from 'node:fs';
import path from 'node:path';

// Pre-load bikes catalog
let bikesCatalog = null;
try {
  const filePath = path.resolve(process.cwd(), 'public/classic-assets/414a4427a4dcdcc4/data/bikes.json');
  if (fs.existsSync(filePath)) {
    bikesCatalog = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
} catch (e) {
  console.warn('Could not read bikes.json in serverless function:', e);
}

const CAREER_CHARS = ['axle', 'bose', 'cydney', 'jon', 'pearl', 'rhonda', 'jim', 'mike'];
const SHOP_TO_ID = e => (e < 5 ? e : e < 10 ? 10 + (e - 5) : 5 + (e - 10));

function getBikePrice(bikeIndex) {
  if (!bikesCatalog || !bikesCatalog.bikes) return 3000;
  const bikeId = SHOP_TO_ID(bikeIndex);
  return bikesCatalog.bikes[bikeId]?.price ?? 3000;
}

// In serverless environments, cookies or in-memory map keeps player session
const sessionMap = new Map();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Parse path: /api/...
  const url = req.url || '';
  const pathname = url.split('?')[0].replace(/^\/api/, '');
  const body = req.body || {};

  // Device / User identifier
  const cookies = req.headers.cookie || '';
  let playerId = 'player-default';
  const match = cookies.match(/rr_player=([^;]+)/);
  if (match) playerId = match[1];
  else if (body.device) playerId = String(body.device);

  if (!sessionMap.has(playerId)) {
    sessionMap.set(playerId, {
      user: {
        id: playerId,
        username: 'RoadRider',
        displayName: 'RoadRider',
        kind: 'guest'
      },
      career: null
    });
  }

  const session = sessionMap.get(playerId);
  res.setHeader('Set-Cookie', `rr_player=${playerId}; Path=/; HttpOnly; SameSite=Lax`);

  try {
    // 1. Auth Browser
    if (pathname === '/auth/browser' && req.method === 'POST') {
      return res.status(200).json({
        user: session.user,
        device: body.device || playerId
      });
    }

    // 2. Profile
    if (pathname === '/profile' && req.method === 'GET') {
      return res.status(200).json({
        profile: {
          save: null,
          updated_at: new Date().toISOString()
        },
        career: session.career
      });
    }

    // 3. Profile name
    if (pathname === '/profile/name' && req.method === 'PUT') {
      if (body.name) {
        session.user.displayName = body.name.trim();
      }
      return res.status(200).json({ displayName: session.user.displayName });
    }

    // 4. Career GET
    if (pathname === '/career' && req.method === 'GET') {
      return res.status(200).json({ career: session.career });
    }

    // 5. Career Start POST
    if (pathname === '/career' && req.method === 'POST') {
      const charId = body.char || 'axle';
      const charIdx = Math.max(0, CAREER_CHARS.indexOf(charId));
      const charData = bikesCatalog?.chars?.[charIdx] || { cash: 1000, bike: 1 };

      session.career = {
        char: charId,
        cash: charData.cash,
        bike: charData.bike,
        level: 1,
        qualified: {}
      };

      return res.status(200).json({ career: session.career });
    }

    // 6. Buy Bike
    if (pathname === '/career/bike' && req.method === 'POST') {
      const newBikeIndex = Number(body.bike);

      if (!session.career) {
        return res.status(400).json({ error: 'No active career' });
      }

      if (newBikeIndex === session.career.bike) {
        return res.status(409).json({ error: 'Already own this bike' });
      }

      const currentBikePrice = getBikePrice(session.career.bike);
      const tradeInValue = Math.floor(currentBikePrice / 2);
      const newBikePrice = getBikePrice(newBikeIndex);
      const totalFunds = session.career.cash + tradeInValue;

      if (totalFunds < newBikePrice) {
        return res.status(409).json({ error: 'Not enough money' });
      }

      session.career.cash = totalFunds - newBikePrice;
      session.career.bike = newBikeIndex;

      return res.status(200).json({ career: session.career });
    }

    // 7. Races list
    if (pathname === '/races' && req.method === 'GET') {
      return res.status(200).json({ races: [] });
    }

    if (pathname === '/races' && req.method === 'POST') {
      return res.status(200).json({ race: body });
    }

    // 8. Checkpoint
    if (pathname.includes('/checkpoint')) {
      return res.status(200).json({ ok: true });
    }

    // 9. Finish Race
    if (pathname.includes('/finish')) {
      if (session.career && body.status === 'finished') {
        const place = body.place || 1;
        const track = body.course || 'city';
        const level = body.level || session.career.level || 1;
        const purseTable = [3000, 2500, 2200, 2000, 1800, 1600, 1400, 1200];
        const purse = (purseTable[place - 1] || 0) * level;

        session.career.cash += purse;
        if (place <= 3) {
          session.career.qualified[`${level}:${track}`] = true;
        }

        return res.status(200).json({
          paid: true,
          purse: purse,
          career: session.career
        });
      }

      return res.status(200).json({ ok: true, career: session.career });
    }

    // 10. Leaderboards
    if (pathname.startsWith('/boards')) {
      return res.status(200).json({ entries: [] });
    }

    // 11. Rider rank
    if (pathname === '/rank/me') {
      return res.status(200).json({
        rank: {
          level: 'Road Rash Veteran',
          totalXP: 5000
        }
      });
    }

    return res.status(200).json({});
  } catch (err) {
    console.error('API Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
