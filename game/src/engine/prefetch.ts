import type { AmbienceId, SfxId } from '../audio/catalog';
import type { Beat, GameScript, Scene } from '../script/types';
import { isVoice, lifeOf } from './life';

/**
 * `now`: what this scene's own story plays; `soon`: its background life and the scenes after it; `amb`: every bed
 * here and next, `ambNow`: this scene's own (the ones it opens with first); `phone`: the lines her phone reads out, here and next.
 */
export type SceneSounds = { now: SfxId[]; soon: SfxId[]; amb: AmbienceId[]; ambNow: AmbienceId[]; phone: string[] };

/**
 * Every recording a scene can play (its cues, interactions, beds and background life) and the scenes it can
 * lead to, so they are loaded before they are needed. Order matters: this scene first, then the next ones.
 */
export function soundsAround(script: GameScript, sceneId: string): SceneSounds {
  const now = new Set<SfxId>();
  const soon = new Set<SfxId>();
  const amb = new Set<AmbienceId>();
  const ambNow = new Set<AmbienceId>();
  const phone = new Set<string>();
  const next = new Set<string>();
  const visit = (beats: readonly Beat[], into: { sfx: Set<SfxId>; amb: Set<AmbienceId> }, follow: boolean): void => {
    for (const beat of beats) {
      switch (beat.k) {
        case 'sfx': into.sfx.add(beat.id); break;
        case 'line': if (beat.kind === 'phone') phone.add(beat.text); break;
        case 'cue': if (beat.sfx) into.sfx.add(beat.sfx); break;
        case 'amb': for (const id of beat.ids) { into.amb.add(id); amb.add(id); } break;
        case 'heart': into.sfx.add('heartbeat'); break;
        case 'noise': for (const event of beat.with ?? []) if (!isVoice(event)) into.sfx.add(event.sfx); break;
        case 'locate':
          into.sfx.add(beat.sfx);
          for (const decoy of beat.decoys) into.sfx.add(decoy.sfx);
          visit(beat.success, into, follow); visit(beat.fail, into, follow);
          break;
        case 'hold': if (beat.sfx) into.sfx.add(beat.sfx); into.sfx.add('breath'); visit(beat.success, into, follow); visit(beat.fail, into, follow); break;
        case 'approach': into.sfx.add(beat.sfx); visit(beat.hit, into, follow); visit(beat.early, into, follow); visit(beat.late, into, follow); break;
        case 'if': visit(beat.then, into, follow); visit(beat.else, into, follow); break;
        case 'choice':
          for (const option of beat.options) {
            visit(option.then, into, follow);
            if (follow && option.goto) next.add(option.goto);
            for (const entry of option.recall?.accept ?? []) {
              visit(entry.then, into, follow);
              if (follow && entry.goto) next.add(entry.goto);
            }
            if (option.recall) visit(option.recall.miss, into, follow);
          }
          break;
        case 'goto': if (follow) next.add(beat.scene); break;
        default: break;
      }
    }
  };
  const add = (scene: Scene, follow: boolean): void => {
    const into = { sfx: follow ? now : soon, amb: follow ? ambNow : amb };
    for (const id of scene.ambience ?? []) { into.amb.add(id); amb.add(id); }
    visit(scene.beats, into, follow);
    for (const beats of Object.values(scene.threads)) visit(beats, into, follow);
    const life = lifeOf(scene.ambience ?? [], Array.isArray(scene.life) ? scene.life : undefined);
    for (const event of life?.events ?? []) if (!isVoice(event)) soon.add(event.sfx);
    if (follow && scene.next) next.add(scene.next);
  };
  const scene = script.scenes.get(sceneId);
  if (!scene) return { now: [], soon: [], amb: [], ambNow: [], phone: [] };
  add(scene, true);
  for (const id of next) {
    const later = script.scenes.get(id);
    if (later && later !== scene) add(later, false);
  }
  return { now: [...now], soon: [...soon].filter((id) => !now.has(id)), amb: [...amb], ambNow: [...ambNow], phone: [...phone] };
}
