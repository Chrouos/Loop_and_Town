import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { Director } from '../src/engine/director';
import { freshSave, type GameSave } from '../src/engine/save';
import { buildScript } from '../src/script/validate';
import type { GameScript } from '../src/script/types';
import { Stage } from '../src/ui/Stage';
import { loadScriptFromDisk, silentAudio } from './harness';

function setup(script: GameScript, scene: string, chapter = '1', flags: string[] = [], wait?: GameSave['wait']) {
  const director = new Director(script, { ...freshSave(), started: true, scene, chapter, flags, wait }, {
    audio: silentAudio(), vibrate: () => undefined, persist: () => undefined, wallNow: () => 0,
  });
  const lines = new Set<string>();
  const tick = () => {
    director.tick(100);
    if (director.view.center) lines.add(director.view.center.text);
    director.hurry();
  };
  const untilChoice = () => {
    for (let i = 0; i < 1500 && !(director.view.choice && director.view.focus === 'main'); i++) tick();
    expect(director.view.choice).not.toBeNull();
  };
  const pick = (text: string) => {
    const option = director.view.choice!.options.find((candidate) => candidate.text === text);
    expect(option).toBeDefined();
    lines.clear();
    director.choose(option!.index);
    untilChoice();
    return [...lines].join('\n');
  };
  director.start();
  untilChoice();
  return { director, lines, tick, untilChoice, pick };
}

const source = (defaultIndex = 1) => `
chapter: 1
title: 測試
start: s
scenes:
  - id: s
    beats:
      - choice:
          timeout: 2
          default: ${defaultIndex}
          options:
            - text: 離開
              then:
                - set: left
                - pause: 60
            - text: 聽完了
              disabled_if: flag.done
              then:
                - set: repeated
                - set: done
                - pause: 60
      - end: reset
`;

describe('disabled exploration choices', () => {
  it('keeps unfinished exploration available', () => {
    const report = buildScript([{ name: 'test.yaml', source: source() }]);
    expect(report.errors).toEqual([]);
    const { director } = setup(report.script, 's');
    expect(director.view.choice!.options[1].disabled).not.toBe(true);
    director.choose(1);
    expect(director.loopFlags.has('repeated')).toBe(true);
  });

  it('parses disabled_if, keeps the button visible and blocks direct/keyboard selection', () => {
    const report = buildScript([{ name: 'test.yaml', source: source() }]);
    expect(report.errors).toEqual([]);
    const { director } = setup(report.script, 's', '1', ['done']);
    expect(director.view.choice!.options[1].disabled).toBe(true);
    const key = director.view.choice!.key;
    director.choose(1);
    expect(director.view.choice!.key).toBe(key);
    expect(director.loopFlags.has('repeated')).toBe(false);
    const container = document.createElement('div');
    const root = createRoot(container);
    try {
      flushSync(() => root.render(<Stage director={director} view={director.view} onCapture={() => undefined} firstCueHint={false} onCueHintShown={() => undefined} />));
      const buttons = container.querySelectorAll<HTMLButtonElement>('.lt-choice');
      expect(buttons[1].disabled).toBe(true);
      expect(buttons[0].disabled).toBe(false);
      buttons[1].click();
      expect(director.view.choice!.key).toBe(key);
    } finally {
      flushSync(() => root.unmount());
    }
    director.choose(0);
    expect(director.loopFlags.has('left')).toBe(true);
  });

  it.each([1, undefined])('timeout skips the disabled default/last option (%s)', (defaultIndex) => {
    const yaml = defaultIndex === undefined ? source().replace('          default: 1\n', '') : source(defaultIndex);
    const report = buildScript([{ name: 'test.yaml', source: yaml }]);
    expect(report.errors).toEqual([]);
    const { director, tick } = setup(report.script, 's', '1', ['done']);
    for (let i = 0; i < 60; i++) tick();
    expect(director.loopFlags.has('left')).toBe(true);
    expect(director.loopFlags.has('repeated')).toBe(false);
  });
});

describe('story exploration exhaustion', () => {
  const report = loadScriptFromDisk();
  it('loads valid story branches, including resumable waits', () => {
    expect(report.errors).toEqual([]);
  });

  const room = '（站在原地，聽這個房間）';
  const town = '（先站一下，聽這座鎮）';

  it.each([{ flags: [] }, { flags: ['c1_watch'] }])('room offers three distinct passages and then disables listening ($flags)', ({ flags }) => {
    const { director, pick } = setup(report.script, 'c1_room_touch', '1', flags);
    const first = pick(room);
    expect(first).toContain('窗簾被風吹得很輕地碰了一下窗框');
    expect(first).toContain(flags.length ? '姊，妳到底在算什麼' : '椅子沒有推進去');
    expect(pick(room)).toContain('不急');
    expect(pick(room)).toContain('先到這裡吧');
    expect(director.view.choice!.options.find((o) => o.text === room)?.disabled).toBe(true);
    expect(director.view.choice!.options.find((o) => o.text === '（摸相框）')?.disabled).not.toBe(true);
    if (flags.length) expect(director.view.choice!.options.find((o) => o.text === '（離開房間）')?.disabled).not.toBe(true);
    // Resuming this scene in the same loop must retain exhaustion.
    const resumed = setup(report.script, 'c1_room_touch', '1', [...director.loopFlags]);
    expect(resumed.director.view.choice!.options.find((o) => o.text === room)?.disabled).toBe(true);
  });

  it('town exhausts without using a visit slot, persists across returns, and leaves visits available', () => {
    const { director, pick } = setup(report.script, 'f_hub_pick', 'final', ['slot1', 'f_tingan_address']);
    expect(pick(town)).toContain('鐵捲門');
    expect(pick(town)).toContain('腳步聲');
    expect(pick(town)).toContain('該走了');
    expect(director.loopFlags.has('slot2')).toBe(false);
    expect(director.view.choice!.options.find((o) => o.text === town)?.disabled).toBe(true);
    expect(director.view.choice!.options.filter((o) => o.text !== town).every((o) => !o.disabled)).toBe(true);
    const resumed = setup(report.script, 'f_hub_pick', 'final', [...director.loopFlags, 'v_yuan']);
    expect(resumed.director.view.choice!.options.find((o) => o.text === town)?.disabled).toBe(true);
    expect(resumed.director.view.choice!.options.some((o) => o.text.includes('找庭安'))).toBe(true);
  });

  const square = '（去鐘樓廣場坐一下）';
  const home = '（結束調查，慢慢走回家）';
  const dayHubs = ['c6_h0930', 'c6_h1100', 'c6_h1230', 'c6_h1400', 'c6_h1530'];

  it('square visits reveal three passages, advance the original time slots, and persist exhaustion', () => {
    const { director, pick } = setup(report.script, 'c6_h0930', '6');
    expect(pick(square)).toContain('有小孩在拍球');
    expect(director.view.sceneId).toBe('c6_h1100');
    const second = pick(square);
    expect(second).toContain('長椅邊緣');
    expect(second).not.toContain('有小孩在拍球');
    expect(director.view.sceneId).toBe('c6_h1230');
    const third = pick(square);
    expect(third).toContain('該起來了');
    expect(third).not.toContain('有小孩在拍球');
    expect(director.view.sceneId).toBe('c6_h1400');
    const choice = director.view.choice!;
    expect(choice.options.find((o) => o.text === square)?.disabled).toBe(true);
    director.choose(choice.options.find((o) => o.text === square)!.index);
    expect(director.view.choice!.key).toBe(choice.key);
    expect(director.save.flags).toContain('c6_square_done');
    const resumed = setup(report.script, 'c6_h1400', '6', director.save.flags);
    expect(resumed.director.view.choice!.options.find((o) => o.text === square)?.disabled).toBe(true);
    const fresh = setup(report.script, 'c6_h0930', '6');
    expect(fresh.director.view.choice!.options.find((o) => o.text === square)?.disabled).not.toBe(true);
  });

  it.each([
    { flags: ['c6_r1100'], learnedFlag: 'c6_square_1', text: '有小孩在拍球', next: 'c6_h1100' },
    { flags: ['c6_r1230', 'c6_square_1'], learnedFlag: 'c6_square_2', text: '小小的凹痕', next: 'c6_h1230' },
    { flags: ['c6_r1400', 'c6_square_1', 'c6_square_2'], learnedFlag: 'c6_square_done', text: '該起來了', next: 'c6_h1400' },
  ])('reloading during the square wait retains the matching passage and progress ($learnedFlag)', ({ flags, learnedFlag, text, next }) => {
    const director = new Director(report.script, { ...freshSave(), started: true, chapter: '6', scene: 'c6_square', flags }, {
      audio: silentAudio(), vibrate: () => undefined, persist: () => undefined, wallNow: () => 0,
    });
    director.start();
    for (let i = 0; i < 1000 && !director.view.waiting; i++) {
      director.tick(100);
      director.hurry();
    }
    expect(director.save.wait).toBeDefined();
    const resumed = setup(report.script, 'c6_square', '6', director.save.flags, { ...director.save.wait! });
    expect([...resumed.lines].join('\n')).toContain(text);
    expect(resumed.director.view.sceneId).toBe(next);
    expect(resumed.director.save.flags).toContain(learnedFlag);
  });

  it.each(dayHubs)('exhausted square is disabled at %s while unfinished investigations and the exit stay available', (scene) => {
    const { director } = setup(report.script, scene, '6', ['c6_square_done']);
    const options = director.view.choice!.options;
    expect(options.find((o) => o.text === square)?.disabled).toBe(true);
    expect(options.find((o) => o.text === '（去圖書館）')).toBeDefined();
    expect(options.find((o) => o.text === '（去圖書館）')!.disabled).not.toBe(true);
    expect(options.find((o) => o.text === home)).toBeDefined();
    expect(options.find((o) => o.text === home)!.disabled).not.toBe(true);
  });

  it('can end investigation at the last time slot when every short visit and the square are exhausted', () => {
    const { director, pick } = setup(report.script, 'c6_h1530', '6', [
      'c6_square_done', 'c6_d_note', 'c6_d_library', 'c6_d_hospital', 'c6_d_cafe',
    ]);
    expect(director.view.choice!.options.filter((o) => !o.disabled).map((o) => o.text)).toEqual([home]);
    const said = pick(home);
    expect(said).toContain('回家的路經過老街');
    expect(director.view.sceneId).toBe('c6_table');
    expect(director.view.clock).toBe('17:40');
  });
});
