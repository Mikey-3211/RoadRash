export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/mano') {
      const upgradeHeader = request.headers.get('Upgrade');
      if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
        return new Response('Expected WebSocket upgrade', { status: 426 });
      }

      // Forward WebSocket upgrade request to roadrash.site with valid Origin
      const targetUrl = new URL(`https://roadrash.site${url.pathname}${url.search}`);
      const proxyHeaders = new Headers(request.headers);
      proxyHeaders.set('Origin', 'https://roadrash.site');
      proxyHeaders.set('Host', 'roadrash.site');

      return fetch(targetUrl, {
        headers: proxyHeaders
      });
    }

    return new Response('Road Rash Multiplayer Relay is Online', { status: 200 });
  }
};
