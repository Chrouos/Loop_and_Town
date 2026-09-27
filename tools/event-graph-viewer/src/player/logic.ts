import { recordById } from './story';
import type { PlayerSave } from './model';

export type KnownDiff = { left: string; right: string; candidateInvariant: string | null };
export const CLAIMS: Record<string, Array<{ id: string; text: string }>> = {
  'letter:postmark|old-death:death': [
    { id: 'sister-alive', text: '姊姊一定還活著' },
    { id: 'letter-after-death', text: '信是在她死亡紀錄之後投遞的' },
    { id: 'sender-known', text: '寄信的人一定是予安' },
  ],
  'station-blackout:time|station-bulletin-none:outcome': [
    { id: 'clock-without-death', text: '18:31 仍有異常，卻沒有人死亡' },
    { id: 'loop-solved', text: '輪迴已經結束' },
  ],
};
const pairKey = (a: string, b: string) => [a, b].sort().join('|');
export const claimsFor = (a: string, b: string) => CLAIMS[pairKey(a, b)] ?? [];

function knownRefs(save: PlayerSave) {
  const refs = new Set<string>();
  for (const [loop, state] of Object.entries(save.loops)) {
    for (const key of state.revealedIds) {
      if (!key.startsWith(`${loop}:`)) continue;
      const record = recordById(key.slice(loop.length + 1));
      record?.excerpts.forEach(excerpt => refs.add(`${record.id}:${excerpt.id}`));
    }
  }
  return refs;
}

export function pinExcerpt(save: PlayerSave, ref: string): PlayerSave {
  if (!knownRefs(save).has(ref)) throw new Error('這段文字還沒有取得來源。');
  if (save.knowledge.pins.includes(ref)) return save;
  if (save.knowledge.pins.length >= 6) throw new Error('桌上只能留下六段文字。');
  save.knowledge.pins.push(ref);
  return save;
}

export function unpinExcerpt(save: PlayerSave, ref: string): PlayerSave {
  save.knowledge.pins = save.knowledge.pins.filter(id => id !== ref);
  save.knowledge.connections = save.knowledge.connections.filter(key => !key.split('|').includes(ref));
  return save;
}

export function judgeLink(save: PlayerSave, first: string, second: string, claimId: string): { save: PlayerSave; feedback: string } {
  if (first === second || !save.knowledge.pins.includes(first) || !save.knowledge.pins.includes(second)) return { save, feedback: '請選桌上兩段不同的文字。' };
  const key = pairKey(first, second);
  const supported = key === 'letter:postmark|old-death:death' && claimId === 'letter-after-death'
    || key === 'station-blackout:time|station-bulletin-none:outcome' && claimId === 'clock-without-death';
  if (!supported) return { save, feedback: '現有的紀錄還不能證明這個說法。先留下疑問。' };
  const connection = `${key}#${claimId}`;
  if (!save.knowledge.connections.includes(connection)) save.knowledge.connections.push(connection);
  return { save, feedback: '這個說法有兩處紀錄可以支持。' };
}

function outcome(save: PlayerSave, loop: number): string {
  const ids = new Set(save.loops[loop]?.revealedIds ?? []);
  if (ids.has(`${loop}:station-bulletin-wakaharu`)) return '許若晴死亡';
  if (ids.has(`${loop}:station-bulletin-doctor`)) return '陳柏勳死亡';
  if (ids.has(`${loop}:station-bulletin-none`)) return '無人死亡';
  return '尚未查到';
}

export function knownDiff(save: PlayerSave, leftLoop: number, rightLoop: number): KnownDiff {
  const left = outcome(save, leftLoop), right = outcome(save, rightLoop);
  return { left, right, candidateInvariant: left !== '尚未查到' && right !== '尚未查到' ? '兩份紀錄都指向 18:31；還不能證明每一輪都如此。' : null };
}
