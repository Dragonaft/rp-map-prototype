export const MIN_DISTINGUISHABLE_COLOR_DISTANCE = 80;

const hexToRgb = (hex: string): [number, number, number] | null => {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!match) return null;
  const int = parseInt(match[1], 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

export const colorDistance = (hexA: string, hexB: string): number | null => {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  if (!a || !b) return null;

  const [r1, g1, b1] = a;
  const [r2, g2, b2] = b;
  const rMean = (r1 + r2) / 2;
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;

  return Math.sqrt(
    (2 + rMean / 256) * dr * dr +
    4 * dg * dg +
    (2 + (255 - rMean) / 256) * db * db,
  );
}

export const colorsTooSimilar = (hexA: string, hexB: string): boolean => {
  const distance = colorDistance(hexA, hexB);
  return distance !== null && distance < MIN_DISTINGUISHABLE_COLOR_DISTANCE;
}
