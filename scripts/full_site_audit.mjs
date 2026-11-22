import http from 'http';

const BASE = 'http://localhost:8080';

async function req(url, method = 'GET', body = null) {
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const opts = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {}
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', (err) => resolve({ status: 0, error: err.message }));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runAudit() {
  console.log('======================================================');
  console.log('AUDITING ALL 7 GAMES & PORTALS ON HTTP://LOCALHOST:8080');
  console.log('======================================================\n');

  const tests = [
    { name: '1. Arcade Hub Homepage', path: '/' },
    { name: '2. Virtua Cop 2 Portal', path: '/games/vcop2/' },
    { name: '3. Virtua Cop 2 Local Mirror', path: '/games/vcop2/local/' },
    { name: '4. Dangerous Dave Portal', path: '/games/dangerous-dave/' },
    { name: '5. Dangerous Dave Legacy', path: '/dave/' },
    { name: '6. Road Rash Portal', path: '/games/road-rash/' },
    { name: '7. Road Rash Classic App JS', path: '/classic/cd4bef5efafb3ec7/app.js' },
    { name: '8. Road Rash Text JSON', path: '/classic-assets/414a4427a4dcdcc4/assets/text.json' },
    { name: '9. Road Rash Bikes JSON', path: '/classic-assets/414a4427a4dcdcc4/data/bikes.json' },
    { name: '10. Road Rash Showroom Image', path: '/classic-assets/414a4427a4dcdcc4/assets/img/showroom/rat/bikes.jpg' },
    { name: '11. House of the Dead 2 Portal', path: '/games/hotd2/' },
    { name: '12. Super Mario Forever Portal', path: '/games/mario-forever/' },
    { name: '13. Contra NES Portal', path: '/games/contra/' },
    { name: '14. Contra jsnes.min.js', path: '/games/contra/jsnes.min.js' },
    { name: '15. Batman Gotham Duo Portal', path: '/games/batman/' },
    { name: '16. Batman Preloaded ROM (batman.nes)', path: '/games/batman/batman.nes' },
    { name: '17. API Auth Browser (Road Rash)', path: '/api/auth/browser', method: 'POST', body: { device: 'audit-test' } },
    { name: '18. API Career GET (Road Rash)', path: '/api/career' },
    { name: '19. API Career Start POST (Road Rash)', path: '/api/career', method: 'POST', body: { char: 'axle' } },
    { name: '20. API Career Bike Purchase (Road Rash)', path: '/api/career/bike', method: 'POST', body: { bike: 2 } }
  ];

  let passed = 0;
  for (const t of tests) {
    const res = await req(`${BASE}${t.path}`, t.method || 'GET', t.body);
    const ok = res.status >= 200 && res.status < 400 || (t.path === '/api/career/bike' && res.status === 409); // 409 is valid "not enough cash" or "already owned"
    if (ok) {
      console.log(`✔ [PASS] ${t.name} -> HTTP ${res.status}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${t.name} -> HTTP ${res.status} ${res.error || ''}`);
    }
  }

  console.log(`\nAUDIT RESULT: ${passed}/${tests.length} tests passed successfully!`);
}

runAudit();
