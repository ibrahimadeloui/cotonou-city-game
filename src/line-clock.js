/** Délai max d'une réplique. speechSynthesis peut ne jamais rappeler onend. */
export function lineBudget(text) {
  const n = String(text || '').length;
  return Math.min(8000, 1400 + n * 55);
}

export function createLineClock() {
  let open = false;
  let budget = 0;
  let elapsed = 0;
  return {
    start(text) {
      open = true;
      elapsed = 0;
      budget = lineBudget(text);
      return budget;
    },
    tick(ms) {
      if (!open) return false;
      elapsed += ms;
      if (elapsed >= budget) {
        open = false;
        return true;
      }
      return false;
    },
    done() { open = false; },
    pending() { return open; },
  };
}
