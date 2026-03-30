import fs from 'fs';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';
import { Province, Landscape, ProvinceType } from './types';

interface ImportSvgOptions {
  svgFile: string;
  outputDir: string;
}

const landscapes: Landscape[] = ['plains', 'forest', 'mountain', 'desert', 'hills', 'swamp'];
const resources = ['iron', 'wood', 'grain', 'stone', 'gold'];
const resourcesSea = ['fish'];

const randomFrom = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

interface PathPoint {
  x: number;
  y: number;
}

// Parse SVG path to extract coordinate points
function parsePathPoints(pathString: string): PathPoint[] {
  const points: PathPoint[] = [];
  const commands = pathString.match(/[MLHVCSQTAZ][^MLHVCSQTAZ]*/gi) || [];

  let currentX = 0;
  let currentY = 0;

  for (const cmd of commands) {
    const type = cmd[0].toUpperCase();
    const args = cmd.slice(1).trim().split(/[\s,]+/).filter(Boolean).map(Number);

    switch (type) {
      case 'M': // MoveTo
      case 'L': // LineTo
        if (args.length >= 2) {
          currentX = args[0];
          currentY = args[1];
          points.push({ x: currentX, y: currentY });
        }
        break;
      case 'H': // Horizontal line
        if (args.length >= 1) {
          currentX = args[0];
          points.push({ x: currentX, y: currentY });
        }
        break;
      case 'V': // Vertical line
        if (args.length >= 1) {
          currentY = args[0];
          points.push({ x: currentX, y: currentY });
        }
        break;
      case 'Q': // Quadratic curve - use end point
        if (args.length >= 4) {
          currentX = args[2];
          currentY = args[3];
          points.push({ x: currentX, y: currentY });
        }
        break;
      case 'C': // Cubic curve - use end point
        if (args.length >= 6) {
          currentX = args[4];
          currentY = args[5];
          points.push({ x: currentX, y: currentY });
        }
        break;
      case 'Z': // Close path
        break;
    }
  }

  return points;
}

// Check if two points are close enough to be considered the same (within tolerance)
function pointsMatch(p1: PathPoint, p2: PathPoint, tolerance = 1): boolean {
  return Math.abs(p1.x - p2.x) < tolerance && Math.abs(p1.y - p2.y) < tolerance;
}

// Check if two provinces share at least 2 consecutive points (shared edge)
function areBordering(points1: PathPoint[], points2: PathPoint[]): boolean {
  let sharedPoints = 0;

  for (const p1 of points1) {
    for (const p2 of points2) {
      if (pointsMatch(p1, p2)) {
        sharedPoints++;
        if (sharedPoints >= 2) {
          return true;
        }
        break;
      }
    }
  }

  return false;
}

// Calculate neighbors for all provinces
function calculateNeighbors(provinces: Province[]): void {
  console.log('Calculating province neighbors...');

  for (let i = 0; i < provinces.length; i++) {
    const province = provinces[i];
    const points1 = parsePathPoints(province.polygon);
    province.neighbor_regions = [];

    for (let j = 0; j < provinces.length; j++) {
      if (i === j) continue;

      const other = provinces[j];
      const points2 = parsePathPoints(other.polygon);

      if (areBordering(points1, points2)) {
        province.neighbor_regions.push(other.region_id);
      }
    }

    if ((i + 1) % 10 === 0 || i === provinces.length - 1) {
      console.log(`Processed ${i + 1}/${provinces.length} provinces`);
    }
  }

  console.log('Neighbor calculation complete');
}

export function importSvgAsMap(options: ImportSvgOptions) {
  const svgPath = path.resolve(options.svgFile);
  if (!fs.existsSync(svgPath)) {
    console.error(`SVG not found: ${svgPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(svgPath, 'utf-8');
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
  const doc = parser.parse(raw);

  const svg = doc.svg;
  if (!svg) {
    console.error('Not an SVG file');
    process.exit(1);
  }

  const elements = Array.isArray(svg.path) ? svg.path : svg.path ? [svg.path] : [];

  const provinces: Province[] = [];

  for (const el of elements) {
    const id: string | undefined = el.id;
    const d: string | undefined = el.d;
    if (!id || !d) continue;

    const typeAttr: string | undefined = el['data-type'];
    const landscapeAttr: string | undefined = el['data-landscape'];

    const type: ProvinceType =
      typeAttr === 'water' || typeAttr === 'coastal' || typeAttr === 'land'
        ? (typeAttr as ProvinceType)
        : 'land';

    const isWater = type === 'water';

    const province: Province = {
      polygon: d,
      type,
      landscape: landscapeAttr && landscapes.includes(landscapeAttr as Landscape)
        ? (landscapeAttr as Landscape)
        : randomFrom(landscapes),
      local_troops: 0,
      resource_type: isWater ? randomFrom(resourcesSea) : randomFrom(resources),
      user_id: null,
      region_id: id,
      neighbor_regions: [], // Will be populated by calculateNeighbors
    };

    provinces.push(province);
  }

  // Calculate neighbor relationships
  calculateNeighbors(provinces);

  if (!fs.existsSync(options.outputDir)) {
    fs.mkdirSync(options.outputDir, { recursive: true });
  }

  const outPath = path.join(options.outputDir, 'provinces.json');
  fs.writeFileSync(outPath, JSON.stringify(provinces, null, 2), 'utf-8');

  console.log(`Imported ${provinces.length} provinces from SVG`);
  console.log(`Saved: ${outPath}`);
}
