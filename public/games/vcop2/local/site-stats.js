// The HTML supplies the starting total of 91. Only aggregate totals are public.
// Loading stats never delays Play or removes the fallback on a network failure.
export async function showSiteStats(element, { fetcher = globalThis.fetch } = {}) {
  if (!element) return false;
  try {
    const response = await fetcher('/stats.json', { credentials: 'omit',
      signal: AbortSignal.timeout(5000) });
    if (!response.ok) return false;
    const stats = await response.json();
    if (![stats.visits, stats.plays].every(value => Number.isSafeInteger(value) && value >= 0) ||
        stats.plays < 91 || !Number.isSafeInteger(91 + stats.visits) || typeof stats.updatedAt !== 'string' ||
        !Number.isFinite(Date.parse(stats.updatedAt))) return false;
    const format = new Intl.NumberFormat('en-US');
    element.textContent = `Games played: ${format.format(91 + stats.visits)}`;
    element.title = 'This counter starts at 91 and adds recorded page visits. ' +
      `Updated ${new Date(stats.updatedAt).toLocaleString()}.`;
    element.hidden = false;
    return true;
  } catch { return false; }
}
