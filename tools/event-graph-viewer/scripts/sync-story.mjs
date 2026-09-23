import { access, cp, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const outputRoot = resolve(here, '../public/story');
const sources = ['events', 'schemas', 'world', 'actions'];

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

for (const directory of sources) {
  const source = resolve(repoRoot, 'story', directory);
  await access(source);
  await cp(source, resolve(outputRoot, directory), { recursive: true });
}

console.log('Story sync complete.');
