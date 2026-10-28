import { readSave, SAVE_KEY } from '../src/engine/save';
import { buildScript } from '../src/script/validate';

const chapter = (beats: string) => `
chapter: 1
title: 測試
start: s1
scenes:
  - id: s1
    beats:
${beats.trim().split('\n').map((line) => `      ${line}`).join('\n')}
      - end: reset
`;

describe('a state name says how long it lasts', () => {
  it('a clue she keeps across loops is k_ or lead_; anything else is this loop only', () => {
    expect(buildScript([{ name: 'a.yaml', source: chapter('- learn: k_c1_note\n- learn: lead_c1_door\n- set: c1_trusts_her') }]).errors).toEqual([]);
    expect(buildScript([{ name: 'a.yaml', source: chapter('- learn: c1_trusts_her') }]).errors.join('\n')).toContain('k_ 或 lead_');
    expect(buildScript([{ name: 'a.yaml', source: chapter('- set: k_c1_note') }]).errors.join('\n')).toContain('k_／lead_');
  });

  it('a save from before the prefixes keeps what she knew, and this loop flags, under the new names', () => {
    const stored = { version: 1, started: true, chapter: '2', knowledge: ['k_truck', 'c4_lead_drawer', 'c2_pushed', 'f_again'], flags: ['yuan_with_me', 'c2_reached'] };
    const storage = { getItem: (key: string) => (key === SAVE_KEY ? JSON.stringify(stored) : null) } as Storage;
    const save = readSave(storage);
    expect(save.knowledge).toEqual(['k_truck', 'lead_c4_drawer', 'k_c2_pushed', 'k_f_again']);
    expect(save.flags).toEqual(['c2_yuan_with_me', 'c2_reached']);
  });
});
