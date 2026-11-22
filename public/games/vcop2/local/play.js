import { connectRooms } from './room-ui.js';
import { connectTouchInput } from './touch-input.js';
import { connectMobilePlayback } from './mobile-playback.js';
import { connectHomeScreen } from './home-screen.js';
import { connectSessionLifecycle } from './session-lifecycle.js';
import { connectCanvasInput } from './canvas-input.js';
import { createLocalCoopInput } from './local-coop-input.js';
import { createFramePresenter } from './frame-presenter.js';
import { createAudioPlayer } from './audio-player.js';
import { createCdAudioPlayer } from './cd-audio.js';
import { loadGameAssets } from './game-assets.js';
import { createGameSession } from './game-session.js';
import { connectGameViewport, connectPlayerLayout } from './game-viewport.js';
import { createGameAnalytics } from './game-analytics.js';
import { analyticsConfig } from './analytics-config.js';
import { showSiteStats } from './site-stats.js';

const $ = id => document.getElementById(id);
// Explicit local experiment; the default single-player launch stays unchanged.
const localCoop = new URLSearchParams(location.search).get('players') === '2';
let player2Button;
if (localCoop) {
  player2Button = document.createElement('button');
  player2Button.textContent = 'Player 2 Start';
  player2Button.title = 'Enter: join or pause Player 2';
  document.querySelector('.game-actions').prepend(player2Button);
  const help = document.createElement('p');
  help.className = 'control-line';
  help.textContent = 'LOCAL CO-OP · P1: mouse · P2: WASD / arrows aim · F shoot · G reload · Enter join';
  $('game-controls').prepend(help);
}
// Phone profiling is explicit and never sends reports to a server. Support
// HTTPS previews too: plain HTTP can change iOS JavaScript/Wasm execution tiers.
const profile = new URLSearchParams(location.search).get('performance') === '1';
const performanceContext = `${location.protocol === 'https:' ? 'HTTPS' : 'HTTP'} | secure context: ${globalThis.isSecureContext ? 'yes' : 'no'}`;
let performancePanel, paintMs = 0, paintCount = 0;
if (profile) {
  performancePanel = document.createElement('output');
  performancePanel.style.cssText = 'position:fixed;left:4px;top:4px;z-index:1000;background:#000e;color:#fff;padding:6px;font:12px monospace;white-space:pre;pointer-events:none';
  performancePanel.textContent = `${performanceContext}\nTiming test: press Play`;
  document.body.append(performancePanel);
}
const analytics = createGameAnalytics(analyticsConfig);
analytics.track('page_viewed');
void showSiteStats($('site-stats'));
const canvas = $('game-canvas'), context = canvas.getContext('2d');
const overlay = $('launch-overlay'), playButton = $('play-button'), status = $('launch-status');
const startButton = $('start-button'), restartButton = $('restart-button'), soundButton = $('sound-button');
const screen = $('game-screen'), fullscreenButton = $('fullscreen-button');
connectPlayerLayout({ space: $('cabinet-space'), cabinet: document.querySelector('.cabinet'),
  screen, toolbar: document.querySelector('.game-toolbar') });
let session, viewport, touchInput, mobile, rooms, muted = false, pendingSolo = false;
let touchMode = globalThis.matchMedia?.('(pointer: coarse)').matches ?? false;
function useTouch() {
  const changed = !touchMode;
  touchMode = true; document.documentElement.classList.add('touch-mode');
  if (changed) mobile?.sync();
}
if (touchMode) useTouch();
const audio = createAudioPlayer();
const music = createCdAudioPlayer({ getContext: () => audio.context, getDestination: () => audio.destination });
const presenter = createFramePresenter(frame => {
  const paintStart = profile ? performance.now() : 0;
  if (canvas.width !== frame.width) canvas.width = frame.width;
  if (canvas.height !== frame.height) canvas.height = frame.height;
  context.putImageData(new ImageData(new Uint8ClampedArray(frame.pixels.buffer, frame.pixels.byteOffset,
    frame.pixels.byteLength), frame.width, frame.height), 0, 0);
  if (profile) { paintMs += performance.now() - paintStart; paintCount++; }
});
const sendInput = command => session?.sendInput(command);
const localInput = localCoop ? createLocalCoopInput(sendInput) : undefined;
const input = connectCanvasInput(canvas, localInput ?? sendInput, document, globalThis,
  () => viewport?.sync());
function showTouchAction(action) {
  for (const button of document.querySelectorAll('.touch-reload')) {
    const label = action === 'ok' ? 'OK' : 'Reload';
    if (button.dataset.action === action) continue;
    button.dataset.action = action;
    button.setAttribute('aria-label', label);
    (button.querySelector('span') ?? button).textContent = label;
  }
}
function showState({ phase, progress, paused = false, error }) {
  const playing = phase === 'playing', busy = phase === 'loading' || phase === 'booting';
  const comingSoon = phase === 'coming-soon';
  overlay.hidden = playing;
  overlay.classList.toggle('showing-coming-soon', comingSoon);
  $('coming-soon').hidden = !comingSoon;
  playButton.disabled = busy;
  playButton.textContent = comingSoon ? 'BACK TO HOME' : busy ? 'LOADING…' : phase === 'error' ? 'TRY AGAIN' : 'PLAY GAME';
  startButton.disabled = !playing;
  if (player2Button) player2Button.disabled = !playing;
  restartButton.disabled = !playing;
  for (const button of document.querySelectorAll('.touch-reload, .touch-start')) button.disabled = !playing;
  if (!playing) showTouchAction('ok');
  if (!playing || paused) touchInput?.cancel();
  $('load-track').hidden = !busy;
  if (Number.isFinite(progress)) $('load-fill').style.width = `${Math.round(progress * 100)}%`;
  status.textContent = phase === 'loading' ? 'Loading game…' : phase === 'booting' ? 'Starting game…' :
    phase === 'error' ? (`Couldn’t start the game: ${error?.message || error || 'Unknown error'}. Please try again.`) : '';
  if (phase === 'loading') context.clearRect(0, 0, canvas.width, canvas.height);
  viewport?.sync();
  if (comingSoon) playButton.focus({ preventScroll: true });
  rooms?.sync(phase);
}
session = createGameSession({ loadAssets: options => loadGameAssets(options),
  createWorker: () => new Worker(new URL('./startup-worker.js', import.meta.url), { type: 'module' }),
  audio, music, input, presenter, focusGame: () => canvas.focus({ preventScroll: true }),
  onState: showState, onTouchAction: showTouchAction, onError: error => { console.error('Game session ended:', error); if (rooms?.active) rooms.fail('The multiplayer game ended. Please create a new room.'); },
  onAnalytics: event => {
    analytics.track(event);
    if (rooms?.active && ['assets_loaded', 'game_started'].includes(event))
      analytics.track(`multiplayer_${event}`);
  },
  onPerformance: profile ? sample => {
    const percent = ms => (100 * ms / sample.elapsedMs).toFixed(0);
    performancePanel.textContent = `${performanceContext}\n${(sample.frames * 1000 / sample.elapsedMs).toFixed(1)} produced FPS\n` +
      `Runtime ${percent(sample.executionMs)}% | scheduling ${percent(sample.yieldMs)}%\n` +
      `Slowest slice ${sample.maxSliceMs.toFixed(1)} ms\n` +
      `Canvas ${(paintMs / Math.max(1, paintCount)).toFixed(1)} ms/frame`;
    paintMs = 0; paintCount = 0;
  } : undefined });
viewport = connectGameViewport({ screen, surface: $('game-surface'), canvas,
  resumeButton: $('resume-input'), input, isPlaying: () => session.phase === 'playing', setPaused: value => session.setPaused(value), isTouch: () => touchMode, onTouch: useTouch,
  isBlocked: () => mobile?.blocked() ?? false });
const homeScreen = connectHomeScreen({ guide: $('home-screen-guide'),
  instructions: $('home-screen-instructions'), installButton: $('install-app-button') });
mobile = connectMobilePlayback({ screen, dialog: $('mobile-play-prompt'), title: $('mobile-play-title'),
  description: $('mobile-play-description'), button: $('mobile-play-button'), isTouch: () => touchMode, lobby: true,
  onEnter: () => {
    if (rooms?.active) rooms.markReady();
    else if (pendingSolo) { pendingSolo = false; void session.play(); }
    viewport.resume();
  },
  onChange: () => { homeScreen.sync(); touchInput?.cancel(); viewport.sync(); } });
touchInput = connectTouchInput(canvas, input, { isPlaying: () => session.phase === 'playing', onTouch: useTouch });
for (const button of document.querySelectorAll('.touch-reload, .touch-start')) {
  button.addEventListener('pointerdown', event => { if (event.pointerType === 'touch') useTouch(); });
  button.addEventListener('click', () => {
    useTouch(); viewport.resume();
    if (button.classList.contains('touch-reload')) input.mobileAction(); else session.startPlayer1();
  });
}
$('touch-exit-fullscreen').addEventListener('click', () => {
  if (mobile.phone) mobile.exit(); else void document.exitFullscreen?.().catch(() => {});
});
playButton.addEventListener('pointerdown', event => { if (event.pointerType === 'touch') useTouch(); });
playButton.addEventListener('click', () => {
  if (session.phase === 'coming-soon') session.stop();
  else if (mobile.phone && !mobile.active) { pendingSolo = true; mobile.enter(); }
  else void session.play();
});
restartButton.addEventListener('click', () => { if (rooms.active) rooms.leave(); else void session.restart(); });
startButton.addEventListener('click', () => { viewport.resume(); session.startPlayer1(); });
player2Button?.addEventListener('click', () => {
  viewport.resume();
  // Both edges must reach separate successful keyboard polls in the worker.
  localInput.startPlayer2();
});
function toggleSound() {
  muted = !muted; audio.setMuted(muted);
  soundButton.textContent = muted ? 'Sound off' : 'Sound on';
  soundButton.setAttribute('aria-pressed', String(muted));
  soundButton.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
  for (const button of document.querySelectorAll('.touch-sound')) {
    button.textContent = muted ? 'Sound off' : 'Sound on'; button.setAttribute('aria-pressed', String(muted));
  }
  if (mobile.active) viewport.resume();
}
soundButton.addEventListener('click', toggleSound);
for (const button of document.querySelectorAll('.touch-sound')) button.addEventListener('click', toggleSound);
fullscreenButton.disabled = !screen.requestFullscreen;
fullscreenButton.addEventListener('click', async () => {
  if (mobile.phone) { mobile.enter(); return; }
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await screen.requestFullscreen();
    canvas.focus({ preventScroll: true });
  } catch { /* Fullscreen is optional; the game remains available in the page. */ }
});
document.addEventListener('fullscreenchange', () => {
  fullscreenButton.textContent = document.fullscreenElement ? 'Exit fullscreen ⛶' : 'Fullscreen ⛶';
  fullscreenButton.setAttribute('aria-label', document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen');
});
rooms = connectRooms({ session, audio, viewport, mobile, onAnalytics: (event, properties) => analytics.track(event, properties) });
connectSessionLifecycle({ session, onReturn: () => { viewport.pause(); mobile.sync(); } });
showState({ phase: 'idle' });
