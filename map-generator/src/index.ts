import { generateGridMap } from './generateGrid';
import { generateRegionMap } from './generateRegion';
import { parseMap } from './parseMap';
import { rewrapNeighbors } from './rewrapNeighbors';
// importSvg / importPng are lazy-required inside their command branches so the
// rest of the CLI works without their heavy parser deps (fast-xml-parser, pngjs).

const [,, command, ...restArgs] = process.argv;

function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];
    if (key && value && key.startsWith('--')) {
      result[key.slice(2)] = value;
    }
  }
  return result;
}

async function main() {
  if (!command) {
    console.log('Usage:');
    console.log('  generate --rows 10 --cols 15 --width 4800 --height 3600 --out ./out');
    console.log('           [--seed 42] [--continent-scale 0.1] [--land-threshold 0.48]');
    console.log('           [--rivers 3] [--max-river-length 25] [--wrap-x true]');
    console.log('           [--continents 3] [--gaps "4,4,8"] [--gap 4] [--coast-noise 1.0]');
    console.log('           [--lakes 3] [--polar-rows 1]');
    console.log('           With --continents > 1, land/water is decided by a Voronoi-margin');
    console.log('           mask instead of --land-threshold: each continent gets a seed, and the');
    console.log('           water channel between every pair is exactly the requested gap width in');
    console.log('           tiles — matched widest-gap-to-furthest-pair. Size gaps against army water');
    console.log('           survival: DEFAULT_WATER_TURNS is 6 (10 with military.seafaring); a gap');
    console.log('           over 10 is uncrossable by anyone. --gaps needs C(continents,2) values');
    console.log('           (comma-separated); --gap is the fallback used for every pair otherwise.');
    console.log('');
    console.log('  generate-region --land ./ne_50m_land.geojson --seas ./ne_110m_geography_marine_polys.geojson');
    console.log('           --rows 30 --cols 50 --width 4800 --height 3200 --out ./out');
    console.log('           [--seed 42] [--bbox "-30,25,70,75"] [--noise 0.4]');
    console.log('           [--wrap-x true] [--rivers 3] [--max-river-length 25]');
    console.log('');
    console.log('  import-svg --svg ./map.svg --out ./out');
    console.log('  import-png --png ./map.png --out ./out [--min-size 10] [--simplify 2.0]');
    console.log('  parse --file ./out/provinces.json');
    console.log('');
    console.log('  rewrap --file ./out/provinces.json [--out ./out/provinces.json] [--wrap-x true]');
    console.log('           Recompute neighbor_regions of an existing grid map with east-west wrap');
    console.log('           (cylinder/globe). Only neighbors change; terrain is preserved.');
    process.exit(0);
  }

  const args = parseArgs(restArgs);

  if (command === 'generate') {
    const rows = Number(args.rows ?? 10);
    const cols = Number(args.cols ?? 10);
    const width = Number(args.width ?? 4800);
    const height = Number(args.height ?? 3600);
    const outputDir = args.out ?? './out';
    const seed = args.seed ? Number(args.seed) : undefined;
    const continentScale = args['continent-scale'] ? Number(args['continent-scale']) : undefined;
    const landThreshold = args['land-threshold'] ? Number(args['land-threshold']) : undefined;
    const riverCount = args['rivers'] ? Number(args['rivers']) : undefined;
    const maxRiverLength = args['max-river-length'] ? Number(args['max-river-length']) : undefined;
    const wrapX = args['wrap-x'] === 'true';

    const continents = args['continents'] ? Number(args['continents']) : undefined;
    const gap = args['gap'] ? Number(args['gap']) : undefined;
    const coastNoise = args['coast-noise'] ? Number(args['coast-noise']) : undefined;
    const lakes = args['lakes'] ? Number(args['lakes']) : undefined;
    const polarRows = args['polar-rows'] ? Number(args['polar-rows']) : undefined;

    let gaps: number[] | undefined;
    if (args['gaps']) {
      gaps = args['gaps'].split(',').map(Number);
      if (gaps.some(isNaN)) {
        console.error('--gaps must be comma-separated numbers, e.g. "4,4,8"');
        process.exit(1);
      }
      const expected = continents ? (continents * (continents - 1)) / 2 : gaps.length;
      if (continents && gaps.length !== expected) {
        console.error(
          `--gaps has ${gaps.length} value(s) but --continents ${continents} needs ` +
          `C(${continents},2) = ${expected} (one per continent pair).`,
        );
        process.exit(1);
      }
    }

    generateGridMap({
      rows, cols, width, height, outputDir, seed, continentScale, landThreshold,
      riverCount, maxRiverLength, wrapX, continents, gaps, gap, coastNoise, lakes, polarRows,
    });
  } else if (command === 'generate-region') {
    const land = args.land;
    const seas = args.seas;
    const out  = args.out ?? './out';

    if (!land || !seas) {
      console.error('Missing required arguments: --land and --seas');
      process.exit(1);
    }

    const rows           = Number(args.rows ?? 30);
    const cols           = Number(args.cols ?? 50);
    const width          = Number(args.width ?? 4800);
    const height         = Number(args.height ?? 3200);
    const seed           = args.seed ? Number(args.seed) : undefined;
    const noiseAmount    = args.noise ? Number(args.noise) : undefined;
    const wrapX          = args['wrap-x'] === 'true';
    const riverCount     = args.rivers ? Number(args.rivers) : undefined;
    const maxRiverLength = args['max-river-length'] ? Number(args['max-river-length']) : undefined;

    let bbox: [number, number, number, number] | undefined;
    if (args.bbox) {
      const parts = args.bbox.split(',').map(Number);
      if (parts.length === 4 && parts.every(n => !isNaN(n))) {
        bbox = parts as [number, number, number, number];
      } else {
        console.error('--bbox must be four comma-separated numbers: minLon,minLat,maxLon,maxLat');
        process.exit(1);
      }
    }

    generateRegionMap({
      landFile: land, seasFile: seas,
      rows, cols, width, height, outputDir: out,
      seed, bbox, noiseAmount, wrapX,
      rivers: riverCount, maxRiverLength,
    });
  } else if (command === 'import-svg') {
    const svg = args.svg;
    const out = args.out ?? './out';
    if (!svg) {
      console.error('Missing --svg argument');
      process.exit(1);
    }
    const { importSvgAsMap } = require('./importSvg');
    importSvgAsMap({ svgFile: svg, outputDir: out });
  } else if (command === 'import-png') {
    const png = args.png;
    const out = args.out ?? './out';
    const minSize = args['min-size'] ? Number(args['min-size']) : undefined;
    const simplify = args['simplify'] ? Number(args['simplify']) : undefined;
    if (!png) {
      console.error('Missing --png argument');
      process.exit(1);
    }
    const { importPngAsMap } = require('./importPng');
    importPngAsMap({ pngFile: png, outputDir: out, minProvinceSize: minSize, simplifyTolerance: simplify });
  } else if (command === 'parse') {
    const file = args.file;
    if (!file) {
      console.error('Missing --file argument');
      process.exit(1);
    }
    parseMap({ inputFile: file });
  } else if (command === 'rewrap') {
    const file = args.file;
    if (!file) {
      console.error('Missing --file argument');
      process.exit(1);
    }
    // wrap-x defaults to true here; pass --wrap-x false to unwrap.
    const wrapX = args['wrap-x'] !== 'false';
    rewrapNeighbors({ inputFile: file, outputFile: args.out, wrapX });
  } else {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
