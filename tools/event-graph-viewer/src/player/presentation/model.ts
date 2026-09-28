export type SceneBackground =
  | { kind: 'image'; src: string; alt?: string }
  | { kind: 'color'; value: string };

export type SceneBase = {
  loop: number;
  time: string;
  worldline?: string;
  background?: SceneBackground;
};

export type SceneEta =
  | { kind: 'exact'; expectedAt: string }
  | { kind: 'approximate'; minutes: number }
  | { kind: 'unknown' };

export type OpeningSceneModel = SceneBase & {
  kind: 'opening';
  title: string;
  text: string;
};

export type DialogueChoice = {
  label: string;
  actionId: string;
};

export type DialogueSceneModel = SceneBase & {
  kind: 'dialogue';
  speaker: string;
  text: string;
  choices?: DialogueChoice[];
};

export type DocumentSceneModel = SceneBase & {
  kind: 'document';
  recordId: string;
  title: string;
  body: string[];
};

export type IdleSceneModel = SceneBase & {
  kind: 'idle';
  actor?: string;
  activity: string;
  canIntervene: boolean;
  eta: SceneEta;
};

export type ResetSceneModel = SceneBase & {
  kind: 'reset';
};

export type PlayerScene =
  | OpeningSceneModel
  | DialogueSceneModel
  | DocumentSceneModel
  | IdleSceneModel
  | ResetSceneModel;

export type PlayerSceneInput = SceneBase & {
  state:
    | { kind: 'reset' }
    | { kind: 'opening'; title: string; text: string }
    | { kind: 'dialogue'; speaker: string; text: string; choices?: DialogueChoice[] }
    | { kind: 'document'; recordId: string; title: string; body: string[] }
    | { kind: 'idle'; actor?: string; activity: string; canIntervene: boolean; eta: SceneEta };
};
