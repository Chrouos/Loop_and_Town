/** Prefix only the PR preview's browser state, leaving production saves untouched. */
export function previewNamespace(pathname: string): string | null {
  const result = /^\/Loop_and_Town\/previews\/pr-(\d+)\//.exec(pathname);
  return result ? 'loop-town-preview-pr-' + result[1] + ':' : null;
}

export function previewStorageForPath(source: Storage, pathname: string): Storage | undefined {
  const prefix = previewNamespace(pathname);
  if (!prefix) return undefined;
  const scopedKeys = (): string[] => {
    const keys: string[] = [];
    for (let i = 0; i < source.length; i++) {
      const key = source.key(i);
      if (key?.startsWith(prefix)) keys.push(key.slice(prefix.length));
    }
    return keys;
  };
  return {
    get length() { return scopedKeys().length; },
    clear() { scopedKeys().forEach(key => source.removeItem(prefix + key)); },
    getItem(key: string) { return source.getItem(prefix + key); },
    key(index: number) { return scopedKeys()[index] ?? null; },
    removeItem(key: string) { source.removeItem(prefix + key); },
    setItem(key: string, value: string) { source.setItem(prefix + key, value); },
  } as Storage;
}
