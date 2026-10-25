import { Director } from '../src/engine/director';
import { LIFE, isVoice } from '../src/engine/life';
import { freshSave } from '../src/engine/save';
import { buildScript } from '../src/script/validate';
import { silentAudio } from './harness';

it.each(['old_house', 'house_night'] as const)('%s plays audio when the scooter caption appears', (ambience) => {
  const event = LIFE[ambience]!.events.find((entry) => !isVoice(entry) && entry.src === '機車');
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
  for (let i = 0; i < 300 && !director.view.periph.some((item) => item.text === '噗噗——'); i++) director.tick(100);
  const caption = director.view.periph.find((item) => item.text === '噗噗——');
  expect(caption).toBeDefined();
  expect(caption!.pos.dist).toBe('far');
  expect(log).toContain('sfx:car_pass');
});
