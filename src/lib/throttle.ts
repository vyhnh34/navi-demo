/** Time-based gate for GPS broadcast frequency — PRD section 5 wants roughly once every
 * 2-3s, not on every `watchPosition` callback (which can fire multiple times a second). */
export function createThrottle(minIntervalMs: number): () => boolean {
  let last = 0;
  return function ready(): boolean {
    const now = Date.now();
    if (now - last < minIntervalMs) return false;
    last = now;
    return true;
  };
}
