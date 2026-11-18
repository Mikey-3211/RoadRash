import { spawn } from 'child_process';
import fs from 'fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const USER_DATA = 'C:\\Users\\Mikey\\AppData\\Local\\Temp\\chrome-debug-vcop2';

async function main() {
  console.log('Launching Chrome with remote debugging...');
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9222',
    `--user-data-dir=${USER_DATA}`,
    '--disable-gpu',
    '--no-first-run',
    'http://localhost:8080/games/vcop2/local/'
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const listRes = await fetch('http://127.0.0.1:9222/json/list');
    const text = await listRes.text();
    const pages = JSON.parse(text);
    const page = pages.find(p => p.url.includes('vcop2') || p.type === 'page') || pages[0];

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise(resolve => ws.addEventListener('open', resolve));

    let msgId = 1;
    function send(method, params = {}) {
      return new Promise((resolve) => {
        const id = msgId++;
        const handler = (evt) => {
          const res = JSON.parse(evt.data);
          if (res.id === id) {
            ws.removeEventListener('message', handler);
            resolve(res.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await send('Runtime.enable');
    await send('Page.enable');

    await new Promise(r => setTimeout(r, 1500));
    await send('Runtime.evaluate', { expression: `document.getElementById('play-button')?.click()` });

    console.log('Waiting 4 seconds for game frames to render...');
    await new Promise(r => setTimeout(r, 4000));

    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(shot.data, 'base64');
    fs.writeFileSync('offline_vcop2_gameplay.png', buf);
    console.log('✔ Screenshot captured and saved to offline_vcop2_gameplay.png! Size:', buf.length);

    ws.close();
  } finally {
    chrome.kill();
  }
}

main();
