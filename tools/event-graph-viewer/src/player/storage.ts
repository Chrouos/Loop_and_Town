import { normalizeSave, type PlayerSave } from './model';

export const SAVE_KEY = 'ash-town-player-v1';
export const LEGACY_KEY = 'ash-town-bible-v1';

export function readSave(storage: Pick<Storage, 'getItem'>, nowMs: number): PlayerSave {
  try { return normalizeSave(storage.getItem(SAVE_KEY), nowMs); }
  catch { return normalizeSave(null, nowMs); }
}

export function writeSave(storage: Pick<Storage, 'setItem'>, save: PlayerSave): boolean {
  try { storage.setItem(SAVE_KEY, JSON.stringify(save)); return true; }
  catch { return false; }
}

export const exportSave = (save: PlayerSave) => JSON.stringify(save, null, 2);

export function importLegacy(raw: string, current: PlayerSave): PlayerSave {
  let input: unknown;
  try { input = JSON.parse(raw) as unknown; } catch { return current; }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return current;
  const old = input as Record<string, unknown>;
  if (old.version === 1 && typeof old.anchorMs === 'number') return normalizeSave(old, current.lastConfirmedMs);
  if (current.importedLegacy) return current;
  const memory = old.memory && typeof old.memory === 'object' && !Array.isArray(old.memory) ? old.memory as Record<string, unknown> : {};
  if (Number(memory.letter) > 0) current.knowledge.notes.push({ source: 'legacy', text: '舊案卷：已讀過姊姊的信，新的投遞紀錄仍需重新查證。' });
  if (Number(memory.sister) > 0) current.knowledge.notes.push({ source: 'legacy', text: '舊案卷：保留五年前事故的個人摘記。' });
  if (Number(memory.death) > 0) current.knowledge.notes.push({ source: 'legacy', text: '舊案卷：曾讀到車站通報；不能直接當作這一輪的結果。' });
  const oldPins = Array.isArray(old.pins) ? old.pins : [];
  const mapping: Record<string, string> = { 'letter:postmark': 'letter:postmark', 'letter:warning': 'letter:warning', 'sister:death': 'old-death:death', 'sister:verdict': 'old-death:verdict' };
  for (const ref of oldPins) {
    if (typeof ref !== 'string' || !mapping[ref] || current.knowledge.pins.length >= 6) continue;
    if (ref.startsWith('letter:') && !(Number(memory.letter) > 0) || ref.startsWith('sister:') && !(Number(memory.sister) > 0)) continue;
    if (!current.knowledge.pins.includes(mapping[ref])) current.knowledge.pins.push(mapping[ref]);
  }
  if (Array.isArray(old.lines) && old.lines.some(line => line === 'letter|sister' || line === 'letter:postmark|sister:death')) {
    current.knowledge.notes.push({ source: 'legacy', text: '舊案卷曾把信封郵戳與五年前的紀錄放在一起；寄件人仍未查到。' });
    if (current.knowledge.pins.includes('letter:postmark') && current.knowledge.pins.includes('old-death:death')) current.knowledge.connections.push('letter:postmark|old-death:death#letter-after-death');
  }
  current.importedLegacy = true;
  return current;
}
