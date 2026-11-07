// Every line her phone reads out in the story, as the reader will be handed it (for tools/render-reader.py).
//   npx vite-node tools/reader-lines.ts
// Prints JSON: { lines: [...], templates: [{ before, after }] }. A line with `<心率>` becomes a template: the
// words before and after the number are rendered once each, the number separately.
import { readFileSync, readdirSync } from 'node:fs';
import { buildScript } from '../src/script/validate';
import { readable } from '../src/audio/reader';

const dir = new URL('../../story/', import.meta.url);
const files = readdirSync(dir).filter((name) => name.endsWith('.yaml')).sort()
  .map((name) => ({ name, source: readFileSync(new URL(name, dir), 'utf8') }));
const { script, errors } = buildScript(files);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

const lines = new Set<string>();
const templates = new Map<string, { before: string; after: string }>();
const visit = (node: unknown): void => {
  if (Array.isArray(node)) { for (const item of node) visit(item); return; }
  if (!node || typeof node !== 'object') return;
  const beat = node as { k?: string; kind?: string; text?: string };
  if (beat.k === 'line' && beat.kind === 'phone' && typeof beat.text === 'string') {
    const [before, ...rest] = beat.text.split('<心率>');
    if (rest.length) {
      const t = { before: readable(before), after: readable(rest.join('')) };
      templates.set(`${t.before}|${t.after}`, t);
    } else {
      const words = readable(beat.text);
      if (words) lines.add(words);
    }
  }
  for (const value of Object.values(node)) visit(value);
};
for (const scene of script.scenes.values()) visit(scene);

console.log(JSON.stringify({ lines: [...lines].sort(), templates: [...templates.values()] }));
