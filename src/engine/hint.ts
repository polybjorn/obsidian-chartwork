/**
 * The line a chart shows under itself for an option it does not use. The
 * chart still draws; the hint says why a key has no effect.
 */
export function showHint(el: HTMLElement, message: string): HTMLElement {
  return el.createDiv({ cls: "chartwork-hint", text: message });
}

// Edits from a to b, where two neighbouring letters swapped count as one,
// the commonest slip in typing a key
function distance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= b.length; j++) (d[0] as number[])[j] = j;
  for (let i = 1; i <= a.length; i++) {
    const row = d[i] as number[];
    const up = d[i - 1] as number[];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min((up[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, (up[j - 1] ?? 0) + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, ((d[i - 2] as number[])[j - 2] ?? 0) + 1);
      row[j] = v;
    }
  }
  return (d[a.length] as number[])[b.length] ?? 0;
}

/** The known key a misspelt one most likely meant: the same but for case, or one or two letters off. */
export function closestKey(key: string, known: readonly string[]): string | undefined {
  const lower = key.toLowerCase();
  const same = known.find((k) => k.toLowerCase() === lower);
  if (same) return same;
  // Short keys are a letter or two from many others, so a guess there misleads
  if (key.length < 4) return undefined;
  let best: string | undefined;
  let bestDistance = 3;
  for (const k of known) {
    const d = distance(lower, k.toLowerCase());
    if (d < bestDistance) {
      best = k;
      bestDistance = d;
    }
  }
  return best;
}

/** One entry of a hint or error, naming the key, or its path, and the known key it may have meant. */
export function unknownKeyText(key: string, known: readonly string[], shown = key): string {
  const guess = closestKey(key, known);
  return guess ? `${shown} (did you mean ${guess}?)` : shown;
}
