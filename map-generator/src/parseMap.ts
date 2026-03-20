import fs from 'fs';
import path from 'path';
import { Province } from './types';

interface ParseOptions {
  inputFile: string;
}

export function parseMap(options: ParseOptions) {
  const inputPath = path.resolve(options.inputFile);
  if (!fs.existsSync(inputPath)) {
    console.error(`File not found: ${inputPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(inputPath, 'utf-8');
  const provinces = JSON.parse(raw) as Province[];

  console.log(`Total provinces: ${provinces.length}`);
}
