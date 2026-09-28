import type { PlayerScene, PlayerSceneInput, SceneBase } from './model';

function sceneBase(input: PlayerSceneInput): SceneBase {
  const base: SceneBase = { loop: input.loop, time: input.time };
  if (input.worldline !== undefined) base.worldline = input.worldline;
  if (input.background !== undefined) base.background = input.background;
  return base;
}

export function deriveScene(input: PlayerSceneInput): PlayerScene {
  const base = sceneBase(input);
  switch (input.state.kind) {
    case 'reset':
      return { ...base, kind: 'reset' };
    case 'opening':
      return { ...base, kind: 'opening', title: input.state.title, text: input.state.text };
    case 'dialogue':
      return { ...base, kind: 'dialogue', speaker: input.state.speaker, text: input.state.text, choices: input.state.choices };
    case 'document':
      return { ...base, kind: 'document', recordId: input.state.recordId, title: input.state.title, body: [...input.state.body] };
    case 'idle':
      return {
        ...base,
        kind: 'idle',
        actor: input.state.actor,
        activity: input.state.activity,
        canIntervene: input.state.canIntervene,
        eta: input.state.eta,
      };
  }
}
