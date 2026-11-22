const events = ['play_clicked', 'assets_loaded', 'game_started'];
const matchEvents = new Set(['multiplayer_match_started', 'multiplayer_match_progress', 'multiplayer_match_ended']);
const multiplayerEvents = new Set(['multiplayer_create_clicked', 'multiplayer_join_clicked',
  'multiplayer_room_created', 'multiplayer_room_joined', 'multiplayer_assets_loaded',
  'multiplayer_ready', 'multiplayer_game_started', 'multiplayer_left', 'multiplayer_error']);
const endpoints = Object.freeze({ us: 'https://us.i.posthog.com/i/v0/e/', eu: 'https://eu.i.posthog.com/i/v0/e/' });

function browserProperties(navigator) {
  const ua = navigator?.userAgent ?? '';
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator?.maxTouchPoints > 1);
  const browser = /Edg\//.test(ua) ? 'Microsoft Edge' : /OPR\//.test(ua) ? 'Opera' :
    /Firefox\/|FxiOS\//.test(ua) ? 'Firefox' : /Chrome\/|CriOS\//.test(ua) ? 'Chrome' :
    /Safari\//.test(ua) ? 'Safari' : 'Unknown';
  const os = ios ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' :
    /Macintosh|Mac OS X/.test(ua) ? 'Mac OS X' : /Linux/.test(ua) ? 'Linux' : 'Unknown';
  const tablet = /iPad/.test(ua) || (ios && /Macintosh/.test(ua)) || (/Android/.test(ua) && !/Mobile/.test(ua));
  return { $browser: browser, $os: os,
    $device_type: tablet ? 'Tablet' : /Mobile|iPhone|iPod/.test(ua) ? 'Mobile' : 'Desktop' };
}

// Explicit events, one anonymous visit per page load. No SDK, automatic
// capture, recordings, cookies or persistent visitor identifiers are installed.
export function createGameAnalytics(config, {
  location = globalThis.location, page = globalThis.document, navigator = globalThis.navigator,
  fetcher = globalThis.fetch, randomUUID = () => globalThis.crypto.randomUUID(),
  now = () => new Date(), lifecycle = globalThis,
} = {}) {
  let next = 0, distinctId, pageViewed = false, pageLeft = false;
  let sessionId, sessionStarted, lastEvent;
  const enabled = /^phc_[A-Za-z0-9_-]+$/.test(config?.projectToken ?? '') &&
    Object.hasOwn(endpoints, config?.region) && location?.protocol === 'https:' &&
    location?.hostname === config?.hostname;
  let referrer = '$direct';
  try {
    const url = new URL(page?.referrer);
    if (['http:', 'https:'].includes(url.protocol)) referrer = url.origin;
  } catch { /* Missing referrers are direct/unknown, never inferred. */ }
  const pathname = location?.pathname || '/';
  const currentUrl = `https://${location?.hostname}${pathname}`;
  const properties = { $process_person_profile: false, $geoip_disable: false,
    $host: location?.hostname, $pathname: pathname, $current_url: currentUrl,
    $referrer: referrer, $referring_domain: referrer === '$direct' ? referrer : new URL(referrer).hostname,
    $session_entry_url: currentUrl, $session_entry_host: location?.hostname,
    $session_entry_pathname: pathname, $session_entry_referrer: referrer,
    ...browserProperties(navigator) };

  const tracker = {
    track(event, details = {}) {
      const match = matchEvents.has(event);
      let matchProperties = {};
      if (match) {
        if (!details || typeof details.match_id !== 'string' || !/^[a-f0-9]{32}$/.test(details.match_id) ||
            ![1, 2].includes(details.player_role) || details.match_metrics_version !== 1 ||
            !Number.isInteger(details.active_seconds) || details.active_seconds < 0 || details.active_seconds > 7200) return;
        matchProperties = { match_id: details.match_id, player_role: details.player_role,
          active_seconds: details.active_seconds, match_metrics_version: 1 };
        if (event === 'multiplayer_match_ended') {
          if (!['left', 'disconnected', 'error', 'stopped', 'pagehide'].includes(details.end_reason)) return;
          matchProperties.end_reason = details.end_reason;
        }
      }
      const visit = event === 'page_viewed', leave = event === '$pageleave';
      const multiplayer = multiplayerEvents.has(event) || match;
      // The original Play funnel is ordered and deduplicated per page.
      // Room events follow lifecycle transitions and may recur for new attempts.
      if (!enabled || navigator?.globalPrivacyControl === true ||
          navigator?.doNotTrack === '1' || (visit ? pageViewed :
            leave ? !pageViewed || pageLeft : !multiplayer && event !== events[next])) return;
      try {
        const timestamp = now();
        const milliseconds = timestamp.getTime();
        distinctId ??= randomUUID();
        if (!sessionId || milliseconds - lastEvent >= 30 * 60 * 1000 ||
            milliseconds - sessionStarted >= 24 * 60 * 60 * 1000 || milliseconds < sessionStarted) {
          // PostHog session aggregation requires UUIDv7 with a valid start time.
          // Retain UUIDv4's random tail/variant, replacing its timestamp/version.
          const time = milliseconds.toString(16).padStart(12, '0');
          sessionId = `${time.slice(0, 8)}-${time.slice(8)}-7${randomUUID().slice(15)}`;
          sessionStarted = milliseconds;
        }
        lastEvent = milliseconds;
        const body = JSON.stringify({ api_key: config.projectToken, distinct_id: distinctId,
          event: visit ? '$pageview' : event, timestamp: timestamp.toISOString(),
          properties: { ...properties, ...matchProperties, $session_id: sessionId, $window_id: distinctId,
            ...(event === 'game_started' ? { play_counter_version: 1 } : {}) } });
        if (visit) pageViewed = true;
        else if (leave) pageLeft = true;
        else if (!multiplayer) next++;
        // Never await analytics in game startup or execution. Failed/blocked
        // delivery is best-effort; retrying can double count accepted events.
        void Promise.resolve(fetcher(endpoints[config.region], { method: 'POST',
          mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: true,
          headers: { 'Content-Type': 'application/json' }, body })).catch(() => {});
      } catch { /* Analytics must never prevent Play or interrupt a game. */ }
    },
  };
  try {
    if (enabled) lifecycle?.addEventListener?.('pagehide', () => tracker.track('$pageleave'));
  } catch { /* Optional lifecycle observation must not prevent Play. */ }
  return tracker;
}
