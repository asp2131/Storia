/**
 * Counts reading time the way a person would: only while the tab is visible,
 * and no more than `maxPerPageMs` for any one page, so a reader left open on a
 * page overnight adds minutes, not hours.
 */
export function createActiveReadingTimer(maxPerPageMs: number, now: () => number = Date.now) {
  let totalMs = 0;
  let since: number | null = now();
  const bank = () => {
    if (since != null) totalMs += Math.min(Math.max(now() - since, 0), maxPerPageMs);
  };

  return {
    /** A page turn: bank the time on the page just left. */
    pageTurned() {
      bank();
      if (since != null) since = now();
    },
    /** The tab was hidden. */
    pause() {
      bank();
      since = null;
    },
    /** The tab is visible again. */
    resume() {
      if (since == null) since = now();
    },
    /** Total active time so far. Safe to call repeatedly: nothing is counted twice. */
    totalMs() {
      bank();
      if (since != null) since = now();
      return totalMs;
    },
  };
}
