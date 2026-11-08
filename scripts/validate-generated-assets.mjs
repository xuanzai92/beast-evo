import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const generatedRoot = path.join(projectRoot, 'public', 'assets', 'generated');
const manifestPath = path.join(generatedRoot, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function checkBucket(name, entries) {
  if (!entries || typeof entries !== 'object') throw new Error(`Missing manifest bucket: ${name}`);
  let checked = 0;
  for (const [id, relativePath] of Object.entries(entries)) {
    if (typeof relativePath !== 'string' || !relativePath.endsWith('.png')) {
      throw new Error(`${name}.${id} must point to a PNG: ${relativePath}`);
    }
    const absolutePath = path.join(generatedRoot, relativePath);
    const data = fs.readFileSync(absolutePath);
    if (data.length < pngSignature.length || !data.subarray(0, pngSignature.length).equals(pngSignature)) {
      throw new Error(`${name}.${id} is not a valid PNG: ${relativePath}`);
    }
    checked += 1;
  }
  return checked;
}

const counts = {
  characters: checkBucket('characters', manifest.characters),
  runtimeCharacters: checkBucket('runtimeCharacters', manifest.runtimeCharacters),
  parts: checkBucket('parts', manifest.parts),
  stages: checkBucket('stages', manifest.stages),
  vfx: checkBucket('vfx', manifest.vfx)
};

if (counts.characters !== 16 || counts.runtimeCharacters !== 16 || counts.parts !== 5 || counts.stages !== 3 || counts.vfx !== 8) {
  throw new Error(`Unexpected generated asset counts: ${JSON.stringify(counts)}`);
}

console.log(`Validated generated art: ${JSON.stringify(counts)}`);
