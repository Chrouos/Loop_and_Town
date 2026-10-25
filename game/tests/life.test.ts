import { Director } from '../src/engine/director';
import { LIFE, isVoice } from '../src/engine/life';
import { freshSave } from '../src/engine/save';
import { buildScript } from '../src/script/validate';
import { silentAudio } from './harness';

it.each([
  { ambience: 'old_house', source: '機車', text: '噗噗——', sfx: 'car_pass', distance: 'far' },
  { ambience: 'house_night', source: '機車', text: '噗噗——', sfx: 'car_pass', distance: 'far' },
  { ambience: 'old_house', source: '水管', text: '咕嚕咕嚕', sfx: 'pipe_gurgle', distance: 'mid' },
] as const)('$ambience plays $source audio when its caption appears', ({ ambience, source, text, sfx, distance }) => {
  const event = LIFE[ambience]!.events.find((entry) => !isVoice(entry) && entry.src === source);
  expect(event).toBeDefined();
  const { script, errors } = buildScript([{ name: 'test.yaml', source: `
chapter: 1
title: 測試
start: s
scenes:
  - id: s
    beats:
      - wait: 60
      - end: reset
` }]);
  expect(errors).toEqual([]);
  // Isolate the real event from each house's pool so random selection cannot hide the regression.
  script.scenes.get('s')!.life = [event!];
  const log: string[] = [];
  const director = new Director(script, { ...freshSave(), started: true, scene: 's' }, {
    audio: silentAudio(log), vibrate: () => undefined, persist: () => undefined, wallNow: () => 0,
  });
  director.start();
  for (let i = 0; i < 300 && !director.view.periph.some((item) => item.text === text); i++) director.tick(100);
  const caption = director.view.periph.find((item) => item.text === text);
  expect(caption).toBeDefined();
  expect(caption!.pos.dist).toBe(distance);
  expect(log).toContain(`sfx:${sfx}`);
});
