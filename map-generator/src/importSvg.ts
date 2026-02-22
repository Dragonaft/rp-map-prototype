import fs from 'fs';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';
import { Province, Landscape, ProvinceType } from './types';

interface ImportSvgOptions {
  svgFile: string;
  outputDir: string;
}

const landscapes: Landscape[] = ['plains', 'forest', 'mountain', 'desert', 'hills', 'swamp'];
const resources = [null, 'iron', 'wood', 'grain', 'stone', 'gold'];

const randomFrom = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

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
      id,
      polygon: d,
      type,
      landscape: landscapeAttr && landscapes.includes(landscapeAttr as Landscape)
        ? (landscapeAttr as Landscape)
        : randomFrom(landscapes),
      troops: isWater ? 0 : Math.floor(Math.random() * 200),
      resourceId: isWater ? null : randomFrom(resources),
      buildings: isWater ? [] : [],
      ownerId: isWater ? null : null,
      userColor: isWater ? null : null,
      regionId: id,
    };

    provinces.push(province);
  }

  if (!fs.existsSync(options.outputDir)) {
    fs.mkdirSync(options.outputDir, { recursive: true });
  }

  const outPath = path.join(options.outputDir, 'provinces.json');
  fs.writeFileSync(outPath, JSON.stringify(provinces, null, 2), 'utf-8');

  console.log(`Imported ${provinces.length} provinces from SVG`);
  console.log(`Saved: ${outPath}`);
}
