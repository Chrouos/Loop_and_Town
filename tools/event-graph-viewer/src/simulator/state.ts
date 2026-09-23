import type { StateChange, WorldState } from './types';

export function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

export function hasPath(state: WorldState, path: string): boolean {
  const parts = path.split('.');
  let current: unknown = state;
  for (const part of parts) {
    if (!current || typeof current !== 'object' || !(part in current)) return false;
    current = (current as Record<string, unknown>)[part];
  }
  return true;
}

export function getPath(state: WorldState, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = state;
  for (const part of parts) {
    if (!current || typeof current !== 'object' || !(part in current)) {
      throw new Error(`Unknown state path: ${path}`);
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function setPath(state: WorldState, path: string, value: unknown): StateChange {
  const parts = path.split('.');
  const leaf = parts.pop();
  if (!leaf) throw new Error(`Unknown state path: ${path}`);

  let current: Record<string, unknown> = state;
  for (const part of parts) {
    const next = current[part];
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      throw new Error(`Unknown state path: ${path}`);
    }
    current = next as Record<string, unknown>;
  }
  if (!(leaf in current)) throw new Error(`Unknown state path: ${path}`);

  const before = cloneValue(current[leaf]);
  current[leaf] = cloneValue(value);
  return { path, before, after: cloneValue(value) };
}
