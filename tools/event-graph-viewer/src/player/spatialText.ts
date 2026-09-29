import type {
  NarrativeBlock,
  NarrativeSpatialAnchor,
  NarrativeTextPresentation,
} from '../narrative/types';

export type SpatialTextKind = 'dialogue' | 'narration' | 'monologue';

export type SpatialPhrase = {
  id: string;
  text: string;
  speaker?: string;
  kind: SpatialTextKind;
  anchor: NarrativeSpatialAnchor;
  beats: string[];
  beatMs: number;
  pauseAfterMs: number;
  echoMs: number;
  startMs: number;
  activeEndMs: number;
  echoEndMs: number;
};

export type SpatialScript = {
  phrases: SpatialPhrase[];
  totalDurationMs: number;
};

export type SpatialActiveFrame = SpatialPhrase & {
  visibleText: string;
};

export type SpatialEchoFrame = SpatialPhrase & {
  opacity: number;
};

export type SpatialFrame = {
  active?: SpatialActiveFrame;
  echoes: SpatialEchoFrame[];
};

const DEFAULTS: Record<SpatialTextKind, Required<Pick<NarrativeTextPresentation, 'beatMs' | 'pauseAfterMs' | 'echoMs'>>> = {
  dialogue: { beatMs: 520, pauseAfterMs: 180, echoMs: 1100 },
  narration: { beatMs: 650, pauseAfterMs: 220, echoMs: 850 },
  monologue: { beatMs: 600, pauseAfterMs: 260, echoMs: 1200 },
};

function defaultAnchor(block: Exclude<NarrativeBlock, { type: 'artifact' }>): NarrativeSpatialAnchor {
  if (block.type === 'narration') return 'center';
  if (block.type === 'monologue') return 'lower-left';
  if ('speaker' in block) return block.speaker === 'protagonist' ? 'lower-left' : 'right';
  return 'center';
}

function splitIntoBeats(text: string): string[] {
  const normalized = text.trim();
  if (!normalized) return [];
  const chunks = normalized.match(/[^。！？!?…]+(?:……|[。！？!?]+|…+)?/g)
    ?.map((part) => part.trim())
    .filter(Boolean);
  return chunks?.length ? chunks : [normalized];
}

function blockKind(block: Exclude<NarrativeBlock, { type: 'artifact' }>): SpatialTextKind {
  return block.type;
}

export function compileSpatialScript(blocks: NarrativeBlock[]): SpatialScript {
  let cursor = 0;
  const phrases: SpatialPhrase[] = [];

  for (const [index, block] of blocks.entries()) {
    if (block.type === 'artifact') continue;
    const kind = blockKind(block);
    const defaults = DEFAULTS[kind];
    const presentation = block.presentation ?? {};
    const beats = (presentation.beats?.map((beat) => beat.trim()).filter(Boolean) ?? splitIntoBeats(block.text));
    if (!beats.length) continue;
    const beatMs = Math.max(1, presentation.beatMs ?? defaults.beatMs);
    const pauseAfterMs = Math.max(0, presentation.pauseAfterMs ?? defaults.pauseAfterMs);
    const echoMs = Math.max(0, presentation.echoMs ?? defaults.echoMs);
    const startMs = cursor;
    const activeEndMs = startMs + beats.length * beatMs;
    const echoEndMs = activeEndMs + echoMs;
    phrases.push({
      id: `phrase-${index}`,
      text: block.text,
      speaker: block.type === 'dialogue' ? block.speaker : undefined,
      kind,
      anchor: presentation.anchor ?? defaultAnchor(block),
      beats,
      beatMs,
      pauseAfterMs,
      echoMs,
      startMs,
      activeEndMs,
      echoEndMs,
    });
    cursor = activeEndMs + pauseAfterMs;
  }

  return {
    phrases,
    totalDurationMs: Math.max(cursor, ...phrases.map((phrase) => phrase.echoEndMs), 0),
  };
}

export function frameSpatialScript(script: SpatialScript, elapsedMs: number): SpatialFrame {
  const time = Math.max(0, elapsedMs);
  const activePhrase = script.phrases.find((phrase) => phrase.startMs <= time && time < phrase.activeEndMs);
  const active = activePhrase
    ? {
      ...activePhrase,
      visibleText: activePhrase.beats
        .slice(0, Math.min(activePhrase.beats.length, Math.floor((time - activePhrase.startMs) / activePhrase.beatMs) + 1))
        .join(''),
    }
    : undefined;

  const echoes = script.phrases
    .filter((phrase) => phrase.activeEndMs <= time && time < phrase.echoEndMs)
    .map((phrase) => {
      const progress = phrase.echoMs <= 0 ? 1 : (time - phrase.activeEndMs) / phrase.echoMs;
      return {
        ...phrase,
        opacity: Math.max(0.06, 0.34 * (1 - Math.min(1, Math.max(0, progress)))),
      };
    });

  return { active, echoes };
}

export function nextSpatialDeadline(script: SpatialScript, elapsedMs: number): number | undefined {
  const boundaries = new Set<number>();
  for (const phrase of script.phrases) {
    for (let beat = 1; beat <= phrase.beats.length; beat += 1) {
      boundaries.add(phrase.startMs + beat * phrase.beatMs);
    }
    boundaries.add(phrase.activeEndMs + phrase.pauseAfterMs);
    boundaries.add(phrase.echoEndMs);
  }
  return [...boundaries]
    .filter((boundary) => boundary > elapsedMs)
    .sort((a, b) => a - b)[0];
}
