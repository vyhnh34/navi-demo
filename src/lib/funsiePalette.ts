/** Shared random-single-color palette for any funsie a Hider produces — the reward draw,
 * hand-drawn trail drops, and procedurally generated trail drops all pick from this. */
export const FUNSIE_PALETTE = [
  "#f06b6b", // coral
  "#ffb84d", // amber
  "#8cd98c", // mint
  "#66b3ff", // cyan
  "#ffffff", // white
];

export function randomFunsieColor(): string {
  return FUNSIE_PALETTE[Math.floor(Math.random() * FUNSIE_PALETTE.length)]!;
}
