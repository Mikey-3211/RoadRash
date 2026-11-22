/**
 * Road Rash Multiplayer WebSocket Relay Worker
 * -------------------------------------------------------------
 * Deploy this free Cloudflare Worker to relay multiplayer traffic between
 * Vercel players and the roadrash.site backend broker.
 *
 * HOW TO DEPLOY FOR FREE (1 minute, 100,000 requests/day free forever):
 * 1. Go to https://dash.cloudflare.com -> Workers & Pages -> Create Application
 * 2. Click "Create Worker", name it "roadrash-relay"
 * 3. Paste this file into the worker code editor and click "Deploy"
 * 4. Done! Your free edge WebSocket multiplayer relay is live at:
 *    https://roadrash-relay.<your-subdomain>.workers.dev
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Handle WebSocket upgrade for multiplayer rooms
    if (url.pathname === '/mano') {
      const upgradeHeader = request.headers.get('Upgrade');
      if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
        return new Response(JSON.stringify({
          status: 'online',
          service: 'Road Rash Edge Multiplayer Relay',
          instructions: 'Connect via wss:// to /mano'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Proxy WebSocket connection to roadrash.site with valid Origin
      const targetUrl = new URL(`wss://roadrash.site${url.pathname}${url.search}`);
      const proxyHeaders = new Headers(request.headers);
      proxyHeaders.set('Origin', 'https://roadrash.site');
      proxyHeaders.set('Host', 'roadrash.site');

      return fetch(targetUrl, {
        headers: proxyHeaders
      });
    }

    // Health check
    return new Response(JSON.stringify({
      status: 'active',
      relay: 'Cloudflare Edge Worker',
      game: 'Road Rash Classic'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};
