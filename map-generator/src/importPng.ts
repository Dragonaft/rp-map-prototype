import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';
import { Province, Landscape } from './types';

interface ImportPngOptions {
  pngFile: string;
  outputDir: string;
  minProvinceSize?: number; // Minimum pixels to consider a valid province (default: 10)
  simplifyTolerance?: number; // Douglas-Peucker tolerance for path simplification (default: 2.0)
}

interface Color {
  r: number;
  g: number;
  b: number;
}

interface Point {
  x: number;
  y: number;
}

const landscapes: Landscape[] = ['plains', 'forest', 'mountain', 'desert', 'hills', 'swamp'];
const resources = ['iron', 'wood', 'grain', 'stone', 'gold'];
const resourcesSea = ['fish'];

const randomFrom = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// Color matching functions
function colorToKey(r: number, g: number, b: number): string {
  return `${r},${g},${b}`;
}

function isWhite(r: number, g: number, b: number): boolean {
  // Accept white and light gray colors (land provinces)
  // All channels should be high and roughly equal
  return r > 200 && g > 200 && b > 200 && Math.abs(r - g) < 30 && Math.abs(g - b) < 30 && Math.abs(r - b) < 30;
}

function isBlue(r: number, g: number, b: number): boolean {
  // Accept various shades of blue (water provinces)
  // Matches colors like rgb(174,226,255) - light blue water
  // Blue channel should be highest and significantly bluish
  return b > 200 && b > r && b > g && (b - r > 20 || b - g > 20);
}

function isBlack(r: number, g: number, b: number): boolean {
  // Black borders - all channels very low
  return r < 50 && g < 50 && b < 50;
}

function getPixel(png: PNG, x: number, y: number): Color | null {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) {
    return null;
  }
  const idx = (png.width * y + x) << 2;
  return {
    r: png.data[idx],
    g: png.data[idx + 1],
    b: png.data[idx + 2],
  };
}

function colorEquals(c1: Color, c2: Color): boolean {
  return c1.r === c2.r && c1.g === c2.g && c1.b === c2.b;
}

// Flood fill to find all pixels of a province
function floodFill(
  png: PNG,
  startX: number,
  startY: number,
  targetColor: Color,
  visited: Set<string>
): Point[] {
  const pixels: Point[] = [];
  const queue: Point[] = [{ x: startX, y: startY }];

  while (queue.length > 0) {
    const { x, y } = queue.shift()!;
    const key = `${x},${y}`;

    if (visited.has(key)) continue;

    const color = getPixel(png, x, y);
    if (!color || !colorEquals(color, targetColor)) continue;

    visited.add(key);
    pixels.push({ x, y });

    // Check 4 neighbors
    queue.push({ x: x + 1, y });
    queue.push({ x: x - 1, y });
    queue.push({ x, y: y + 1 });
    queue.push({ x, y: y - 1 });
  }

  return pixels;
}

// Douglas-Peucker algorithm for path simplification
function douglasPeucker(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2) return points;

  // Find the point with maximum distance from the line between first and last
  let maxDistance = 0;
  let maxIndex = 0;
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i], firstPoint, lastPoint);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }

  // If max distance is greater than tolerance, recursively simplify
  if (maxDistance > tolerance) {
    const leftSegment = douglasPeucker(points.slice(0, maxIndex + 1), tolerance);
    const rightSegment = douglasPeucker(points.slice(maxIndex), tolerance);

    // Combine segments (remove duplicate point at join)
    return [...leftSegment.slice(0, -1), ...rightSegment];
  } else {
    // Max distance is within tolerance, return endpoints only
    return [firstPoint, lastPoint];
  }
}

// Calculate perpendicular distance from point to line
function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;

  if (dx === 0 && dy === 0) {
    // Line start and end are the same point
    return Math.sqrt(Math.pow(point.x - lineStart.x, 2) + Math.pow(point.y - lineStart.y, 2));
  }

  const numerator = Math.abs(dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x);
  const denominator = Math.sqrt(dx * dx + dy * dy);

  return numerator / denominator;
}

// Helper function to check if a pixel is on the border
function isPixelOnBorder(x: number, y: number, pixels: Set<string>, png: PNG): boolean {
  // Check if at image edge
  if (x === 0 || y === 0 || x === png.width - 1 || y === png.height - 1) {
    return true;
  }

  // Check all 8 directions
  const neighbors = [
    [x-1, y], [x+1, y], [x, y-1], [x, y+1],
    [x-1, y-1], [x+1, y-1], [x-1, y+1], [x+1, y+1]
  ];

  for (const [nx, ny] of neighbors) {
    const key = `${nx},${ny}`;
    if (!pixels.has(key)) {
      const color = getPixel(png, nx, ny);
      // Border if neighbor is black, out of bounds, or different color
      if (!color || isBlack(color.r, color.g, color.b)) {
        return true;
      }
    }
  }

  return false;
}

// Trace the border of a province to create an SVG path
function traceBorder(pixels: Set<string>, png: PNG, simplifyTolerance: number = 2.0): string {
  if (pixels.size === 0) return '';

  // Find bounding box first
  let minBoundX = Infinity, maxBoundX = -Infinity;
  let minBoundY = Infinity, maxBoundY = -Infinity;

  for (const key of pixels) {
    const [x, y] = key.split(',').map(Number);
    if (x < minBoundX) minBoundX = x;
    if (x > maxBoundX) maxBoundX = x;
    if (y < minBoundY) minBoundY = y;
    if (y > maxBoundY) maxBoundY = y;
  }

  // Collect border points with sampling
  const borderPoints: Point[] = [];
  const step = 2; // Sample every 2nd pixel

  for (let y = minBoundY; y <= maxBoundY; y += step) {
    for (let x = minBoundX; x <= maxBoundX; x += step) {
      const key = `${x},${y}`;
      if (!pixels.has(key)) continue;

      if (isPixelOnBorder(x, y, pixels, png)) {
        borderPoints.push({ x, y });
      }
    }
  }

  if (borderPoints.length === 0) {
    // Fallback: use bounding box
    borderPoints.push({ x: minBoundX, y: minBoundY });
    borderPoints.push({ x: maxBoundX, y: minBoundY });
    borderPoints.push({ x: maxBoundX, y: maxBoundY });
    borderPoints.push({ x: minBoundX, y: maxBoundY });
  }

  // Simplify the border points using Douglas-Peucker algorithm
  const simplifiedPoints = simplifyTolerance > 0
    ? douglasPeucker(borderPoints, simplifyTolerance)
    : borderPoints;

  // Create SVG path from simplified border points
  if (simplifiedPoints.length === 0) return '';

  let pathString = `M ${simplifiedPoints[0].x} ${simplifiedPoints[0].y}`;
  for (let i = 1; i < simplifiedPoints.length; i++) {
    pathString += ` L ${simplifiedPoints[i].x} ${simplifiedPoints[i].y}`;
  }
  pathString += ' Z';

  return pathString;
}

// Build a map of pixel coordinates to province IDs for fast lookup
function buildPixelToProvinceMap(
  provincePixels: Map<string, Set<string>>
): Map<string, string> {
  const pixelToProvince = new Map<string, string>();

  for (const [provinceId, pixels] of provincePixels) {
    for (const pixelKey of pixels) {
      pixelToProvince.set(pixelKey, provinceId);
    }
  }

  return pixelToProvince;
}

// Find neighboring provinces (provinces separated by black borders or directly adjacent)
function findNeighbors(
  provincePixels: Map<string, Set<string>>,
  png: PNG
): Map<string, string[]> {
  const neighbors = new Map<string, string[]>();
  const totalProvinces = provincePixels.size;
  let processedCount = 0;

  // Build fast lookup map
  const pixelToProvince = buildPixelToProvinceMap(provincePixels);

  for (const [provinceId, pixels] of provincePixels) {
    const neighborSet = new Set<string>();

    for (const key of pixels) {
      const [x, y] = key.split(',').map(Number);

      // Check all 8 directions (4-directional + diagonals)
      const directions = [
        [1, 0], [-1, 0], [0, 1], [0, -1],  // 4-directional
        [1, 1], [1, -1], [-1, 1], [-1, -1]  // diagonals
      ];

      for (const [dx, dy] of directions) {
        let checkX = x + dx;
        let checkY = y + dy;

        // Check immediate neighbor
        const adjKey = `${checkX},${checkY}`;
        const adjProvince = pixelToProvince.get(adjKey);

        if (adjProvince && adjProvince !== provinceId) {
          // Direct neighbor (no border between)
          neighborSet.add(adjProvince);
        } else {
          // Check if there's a black border, and look beyond it
          const adjColor = getPixel(png, checkX, checkY);

          if (adjColor && isBlack(adjColor.r, adjColor.g, adjColor.b)) {
            // Found a black border, look beyond it (up to 10 pixels to handle thick borders)
            for (let distance = 2; distance <= 10; distance++) {
              const beyondX = x + dx * distance;
              const beyondY = y + dy * distance;
              const beyondKey = `${beyondX},${beyondY}`;
              const beyondProvince = pixelToProvince.get(beyondKey);

              if (beyondProvince && beyondProvince !== provinceId) {
                // Found a province on the other side of the border
                neighborSet.add(beyondProvince);
                break;
              }

              // Stop if we hit another color that's not black or the target province
              const beyondColor = getPixel(png, beyondX, beyondY);
              if (!beyondColor || !isBlack(beyondColor.r, beyondColor.g, beyondColor.b)) {
                break;
              }
            }
          }
        }
      }
    }

    neighbors.set(provinceId, Array.from(neighborSet));

    processedCount++;
    if (processedCount % 10 === 0 || processedCount === totalProvinces) {
      console.log(`Processed neighbors for ${processedCount}/${totalProvinces} provinces`);
    }
  }

  return neighbors;
}

export function importPngAsMap(options: ImportPngOptions) {
  const pngPath = path.resolve(options.pngFile);
  if (!fs.existsSync(pngPath)) {
    console.error(`PNG not found: ${pngPath}`);
    process.exit(1);
  }

  const minProvinceSize = options.minProvinceSize ?? 10;
  const simplifyTolerance = options.simplifyTolerance ?? 5.0; // Increased default for better simplification

  console.log('Reading PNG file...');
  const pngData = fs.readFileSync(pngPath);
  const png = PNG.sync.read(pngData);

  console.log(`Image dimensions: ${png.width}x${png.height}`);
  console.log(`Minimum province size: ${minProvinceSize} pixels`);
  console.log(`Path simplification tolerance: ${simplifyTolerance}`);

  const visited = new Set<string>();
  const provinces: Province[] = [];
  const provincePixels = new Map<string, Set<string>>();
  let provinceCounter = 0;
  let skippedCount = 0;

  console.log('Detecting provinces...');

  // Scan image and detect provinces
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const key = `${x},${y}`;
      if (visited.has(key)) continue;

      const color = getPixel(png, x, y);
      if (!color) continue;

      // Only process white (land) or blue (water) pixels
      if (!isWhite(color.r, color.g, color.b) && !isBlue(color.r, color.g, color.b)) {
        visited.add(key);
        continue;
      }

      // Found a new province, flood fill it
      const pixels = floodFill(png, x, y, color, visited);

      if (pixels.length < minProvinceSize) {
        // Skip very small regions (noise)
        skippedCount++;
        console.log(`Skipped small region: ${pixels.length} pixels (threshold: ${minProvinceSize})`);
        continue;
      }

      provinceCounter++;
      const regionId = `province_${provinceCounter}`;
      const pixelSet = new Set(pixels.map(p => `${p.x},${p.y}`));
      provincePixels.set(regionId, pixelSet);

      const isWaterProvince = isBlue(color.r, color.g, color.b);
      const type = isWaterProvince ? 'water' : 'land';
      console.log(`Found province ${provinceCounter}: ${pixels.length} pixels, type: ${type}, color: rgb(${color.r},${color.g},${color.b})`);
    }
  }

  console.log(`Detected ${provinceCounter} provinces (skipped ${skippedCount} small regions)`);
  console.log('Tracing borders...');

  // Generate provinces with borders
  let tracedCount = 0;
  const totalProvinces = provincePixels.size;

  for (const [regionId, pixels] of provincePixels) {
    // Get color of first pixel to determine type
    const firstPixelKey = Array.from(pixels)[0];
    const [fx, fy] = firstPixelKey.split(',').map(Number);
    const color = getPixel(png, fx, fy)!;

    const isWater = isBlue(color.r, color.g, color.b);
    const polygon = traceBorder(pixels, png, simplifyTolerance);

    const province: Province = {
      polygon,
      type: isWater ? 'water' : 'land',
      landscape: isWater ? 'plains' : randomFrom(landscapes),
      local_troops: 0,
      resource_type: isWater ? randomFrom(resourcesSea) : randomFrom(resources),
      user_id: null,
      region_id: regionId,
      neighbor_regions: [], // Will be populated below
    };

    provinces.push(province);

    tracedCount++;
    if (tracedCount % 10 === 0 || tracedCount === totalProvinces) {
      console.log(`Traced ${tracedCount}/${totalProvinces} provinces`);
    }
  }

  console.log('Calculating neighbors...');
  const neighbors = findNeighbors(provincePixels, png);
  console.log('Neighbor calculation complete');

  // Assign neighbors to provinces
  console.log('Assigning neighbors to provinces...');
  for (const province of provinces) {
    province.neighbor_regions = neighbors.get(province.region_id) || [];
  }

  // Save output
  if (!fs.existsSync(options.outputDir)) {
    fs.mkdirSync(options.outputDir, { recursive: true });
  }

  const outPath = path.join(options.outputDir, 'provinces.json');
  fs.writeFileSync(outPath, JSON.stringify(provinces, null, 2), 'utf-8');

  console.log(`\nSuccessfully imported ${provinces.length} provinces from PNG`);
  console.log(`Saved: ${outPath}`);

  // Statistics
  const landCount = provinces.filter(p => p.type === 'land').length;
  const waterCount = provinces.filter(p => p.type === 'water').length;
  console.log(`\nStatistics:`);
  console.log(`  Land provinces: ${landCount}`);
  console.log(`  Water provinces: ${waterCount}`);
}
