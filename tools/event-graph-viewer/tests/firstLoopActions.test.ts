import yaml from 'js-yaml';
import { expect, it } from 'vitest';
import actionsText from '../../../story/actions/loop_01_actions.yaml?raw';
import type { ActionDefinition } from '../src/simulator/types';

const actions = (yaml.load(actionsText) as { actions: ActionDefinition[] }).actions;
const byId = (id: string) => actions.find((action) => action.id === id)!;

it('defines the five approved interventions', () => {
  expect(actions.map((action) => action.id)).toEqual([
    'send_yuan_to_post_office',
    'show_letter_to_wakaharu',
    'confront_reporter',
    'protect_wakaharu',
    'stop_doctor',
  ]);
});

it('send_yuan_to_post_office changes assignment and records the intervention', () => {
  expect(byId('send_yuan_to_post_office').effects).toEqual([
    { set: { path: 'characters.yuan.assignment', value: 'post_office' } },
    { add_flag: 'flags.yuan_sent_to_post_office' },
  ]);
});

it('show_letter_to_wakaharu only changes player-known state', () => {
  expect(byId('show_letter_to_wakaharu').effects).toEqual([
    { add_flag: 'flags.wakaharu_saw_letter' },
  ]);
});

it('confront_reporter changes her hidden route but not her final status', () => {
  const action = byId('confront_reporter');
  expect(action.effects).toEqual([
    { add_flag: 'flags.reporter_confronted' },
    { set: { path: 'characters.reporter.route', value: 'hotel_then_old_lab' } },
  ]);
  expect(JSON.stringify(action.effects)).not.toContain('missing');
});

it('author-only rescue actions only change routes', () => {
  expect(byId('protect_wakaharu').effects).toEqual([
    { set: { path: 'characters.wakaharu.route', value: 'home' } },
  ]);
  expect(byId('stop_doctor').effects).toEqual([
    { set: { path: 'characters.doctor.route', value: 'stay_hospital' } },
  ]);
});

it('places letter-related interventions after the letter is discovered', () => {
  expect(byId('send_yuan_to_post_office').at).toEqual({ day: 0, time: '16:12' });
  expect(byId('show_letter_to_wakaharu').at).toEqual({ day: 0, time: '16:30' });
  expect(byId('confront_reporter').at).toEqual({ day: 0, time: '16:40' });
  expect(byId('protect_wakaharu').at).toEqual({ day: 0, time: '17:30' });
  expect(byId('stop_doctor').at).toEqual({ day: 0, time: '17:30' });
});
