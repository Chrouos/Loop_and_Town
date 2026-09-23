import { access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const sourceEvents = resolve(repoRoot, 'story/events');
const sourceSchemas = resolve(repoRoot, 'story/schemas');
const outputEvents = resolve(here, '../public/story/events/day_01_1831.yaml');
const outputSchema = resolve(here, '../public/story/schemas/event-graph.schema.json');

await access(sourceEvents);
await access(sourceSchemas);
await access(outputEvents);
await access(outputSchema);

console.log('Story sync verification passed.');
