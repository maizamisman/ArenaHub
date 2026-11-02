type Score = { version: number; score_a: number; score_b: number };

/** The newest known score (by version) plus taps still in flight, so the screen never steps backwards. */
export function scoreView<T extends Score>(confirmed: T, polled: T | undefined, pend: { a: number; b: number }): T {
  const base = polled && polled.version > confirmed.version ? polled : confirmed;
  return { ...base, score_a: base.score_a + pend.a, score_b: base.score_b + pend.b };
}
