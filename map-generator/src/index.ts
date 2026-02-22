import { generateGridMap } from './generateGrid';
import { importSvgAsMap } from './importSvg';
import { parseMap } from './parseMap';

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
    console.log('  generate --rows 10 --cols 15 --width 800 --height 600 --out ./out');
    console.log('  import-svg --svg ./map.svg --out ./out');
    console.log('  parse --file ./out/provinces.json');
    process.exit(0);
  }

  const args = parseArgs(restArgs);

  if (command === 'generate') {
    const rows = Number(args.rows ?? 10);
    const cols = Number(args.cols ?? 10);
    const width = Number(args.width ?? 800);
    const height = Number(args.height ?? 600);
    const outputDir = args.out ?? './out';

    generateGridMap({ rows, cols, width, height, waterBorder: true, outputDir });
  } else if (command === 'import-svg') {
    const svg = args.svg;
    const out = args.out ?? './out';
    if (!svg) {
      console.error('Missing --svg argument');
      process.exit(1);
    }
    importSvgAsMap({ svgFile: svg, outputDir: out });
  } else if (command === 'parse') {
    const file = args.file;
    if (!file) {
      console.error('Missing --file argument');
      process.exit(1);
    }
    parseMap({ inputFile: file });
  } else {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
