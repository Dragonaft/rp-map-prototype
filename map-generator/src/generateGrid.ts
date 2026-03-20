import fs from 'fs';
import path from 'path';
import { Province, ProvinceType, Landscape } from './types';

interface GenerateGridOptions {
  rows: number;
  cols: number;
  width: number;
  height: number;
  waterBorder?: boolean;
  outputDir: string;
}

const landscapes: Landscape[] = ['plains', 'forest', 'mountain', 'desert', 'hills', 'swamp'];
const resources = ['iron', 'wood', 'grain', 'stone', 'gold'];
const resourcesSea = ['fish'];

const randomFrom = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export function generateGridMap(options: GenerateGridOptions) {
  const { rows, cols, width, height, waterBorder = true, outputDir } = options;
  const cellWidth = width / cols;
  const cellHeight = height / rows;

  const provinces: Province[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const id = `prov-${r}-${c}`;
      const x1 = c * cellWidth;
      const y1 = r * cellHeight;
      const x2 = x1 + cellWidth;
      const y2 = y1 + cellHeight;

      const isBorder = r === 0 || c === 0 || r === rows - 1 || c === cols - 1;

      let type: ProvinceType = 'land';
      if (waterBorder && isBorder) {
        type = 'water';
      } else if (!isBorder && (r === 1 || r === rows - 2 || c === 1 || c === cols - 2)) {
        type = 'coastal';
      }

      const isWater = type === 'water';

      const province: Province = {
        polygon: `M${x1} ${y1} H${x2} V${y2} H${x1} Z`,
        type,
        landscape: randomFrom(landscapes),
        local_troops: 0,
        resource_type: isWater ? randomFrom(resourcesSea) : randomFrom(resources),
        user_id: null,
        region_id: id,
      };

      provinces.push(province);
    }
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const provincesPath = path.join(outputDir, 'provinces.json');
  fs.writeFileSync(provincesPath, JSON.stringify(provinces, null, 2), 'utf-8');
}
