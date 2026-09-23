import { access, cp, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const sourceEvents = resolve(repoRoot, 'story/events');
const sourceSchemas = resolve(repoRoot, 'story/schemas');
const outputRoot = resolve(here, '../public/story');
const outputEvents = resolve(outputRoot, 'events');
const outputSchemas = resolve(outputRoot, 'schemas');

await access(sourceEvents);
await access(sourceSchemas);
await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });
await cp(sourceEvents, outputEvents, { recursive: true });
await cp(sourceSchemas, outputSchemas, { recursive: true });

console.log('Story sync complete.');
