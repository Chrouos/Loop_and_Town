import { buildScript, type ScriptReport } from './validate';

// story/*.yaml is the source of truth; Vite inlines it at build time.
const sources = import.meta.glob('../../../story/*.yaml', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

let cached: ScriptReport | null = null;

export function loadGameScript(): ScriptReport {
  if (!cached) {
    const files = Object.entries(sources).map(([path, source]) => ({ name: path.split('/').pop() ?? path, source }));
    cached = buildScript(files);
  }
  return cached;
}
