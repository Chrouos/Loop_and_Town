import { load } from 'js-yaml';
import { DISTANCES, isAmbience, isDirection, isSfx, VIBRATIONS, type Distance, type VibrationId, type VoiceId } from '../audio/catalog';
import { parseCond } from './conditions';
import type { Beat, Chapter, ChoiceOption, EndKind, LineBeat, Pos, Scene } from './types';

export const CHARACTER_KEYS = ['yuan', 'ruoqing', 'boxun', 'tingan', 'zhiyuan', 'zhixia', 'man', 'woman', 'child', 'old_man', 'old_woman', 'announcer'] as const;
const LINE_KEYS = new Set<string>(['narr', 'me', 'think', 'phone', ...CHARACTER_KEYS]);
const LINE_ATTRS = new Set(['at', 'as', 'learn', 'mem', 'dist']);
const END_KINDS: EndKind[] = ['reset', 'ending_a', 'ending_b', 'ending_c'];

type Errors = string[];
type Obj = Record<string, unknown>;

const isObj = (value: unknown): value is Obj => typeof value === 'object' && value !== null && !Array.isArray(value);

function str(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return undefined;
}

export function parsePos(raw: unknown, where: string, errors: Errors, fallbackDist: Distance = 'mid'): Pos | undefined {
  if (isObj(raw)) {
    const dir = str(raw.dir);
    const dist = str(raw.dist) ?? fallbackDist;
    return parsePos(`${dir}:${dist}`, where, errors);
  }
  const text = str(raw);
  if (!text) { errors.push(`${where}：缺少方位`); return undefined; }
  const [dirText, distText] = text.split(':').map((part) => part.trim());
  const dist = (distText ?? fallbackDist) as Distance;
  if (dirText !== 'center' && !isDirection(dirText)) { errors.push(`${where}：未知方位「${dirText}」`); return undefined; }
  if (!(DISTANCES as readonly string[]).includes(dist)) { errors.push(`${where}：未知距離「${distText}」`); return undefined; }
  return { dir: dirText as Pos['dir'], dist };
}

function cond(source: unknown, where: string, errors: Errors) {
  const text = typeof source === 'boolean' ? String(source) : str(source);
  if (!text) { errors.push(`${where}：條件必須是字串`); return undefined; }
  try { return parseCond(text); } catch (error) { errors.push(`${where}：${(error as Error).message}`); return undefined; }
}

function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item));
  if (value === undefined || value === null) return [];
  return [String(value)];
}

function vib(value: unknown, where: string, errors: Errors): VibrationId | undefined {
  if (value === undefined) return undefined;
  const id = String(value);
  if (!(id in VIBRATIONS)) { errors.push(`${where}：未知震動「${id}」`); return undefined; }
  return id as VibrationId;
}

function parseLine(key: string, raw: Obj, where: string, errors: Errors): LineBeat | undefined {
  const text = str(raw[key]);
  if (!text || text.trim().length === 0) { errors.push(`${where}：「${key}」沒有文字`); return undefined; }
  for (const attr of Object.keys(raw)) {
    if (attr !== key && !LINE_ATTRS.has(attr)) errors.push(`${where}：台詞不支援欄位「${attr}」`);
  }
  const kind: LineBeat['kind'] = key === 'narr' || key === 'me' || key === 'think' || key === 'phone' ? key : 'char';
  const speaker = (kind === 'char' ? key : key === 'phone' ? 'phone' : 'me') as VoiceId | 'me';
  const line: LineBeat = { k: 'line', kind, speaker, text: text.trim() };
  if (raw.at !== undefined) line.at = parsePos(raw.at, where, errors, (str(raw.dist) as Distance) ?? 'mid');
  if (raw.as !== undefined) line.label = String(raw.as);
  if (raw.learn !== undefined) line.learn = String(raw.learn);
  if (raw.mem !== undefined) line.mem = String(raw.mem);
  return line;
}

function parseBeats(raw: unknown, where: string, errors: Errors): Beat[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) { errors.push(`${where}：beats 必須是陣列`); return []; }
  const beats: Beat[] = [];
  raw.forEach((item, index) => {
    const beat = parseBeat(item, `${where}[${index}]`, errors);
    if (beat) beats.push(beat);
  });
  return beats;
}

function parseBeat(raw: unknown, where: string, errors: Errors): Beat | undefined {
  if (!isObj(raw)) { errors.push(`${where}：beat 必須是 map（得到 ${JSON.stringify(raw)}）`); return undefined; }
  const keys = Object.keys(raw);
  const lineKey = keys.find((key) => LINE_KEYS.has(key));
  if (lineKey) return parseLine(lineKey, raw, where, errors);

  const allow = (...allowed: string[]) => {
    for (const key of keys) if (!allowed.includes(key)) errors.push(`${where}：未知欄位「${key}」`);
  };

  if ('cue' in raw) {
    allow('cue', 'at', 'dist', 'text', 'sfx', 'grab');
    const pos = parsePos(raw.at, where, errors, (str(raw.dist) as Distance) ?? 'mid');
    const sfx = raw.sfx === undefined ? undefined : String(raw.sfx);
    if (sfx && !isSfx(sfx)) errors.push(`${where}：未知音效「${sfx}」`);
    const text = str(raw.text);
    if (!text) errors.push(`${where}：cue 需要擬聲字 text`);
    if (!pos) return undefined;
    return { k: 'cue', thread: String(raw.cue), pos, text: text ?? '……', sfx: sfx && isSfx(sfx) ? sfx : undefined, grab: raw.grab === true };
  }
  if ('sfx' in raw) {
    allow('sfx', 'at', 'dist', 'text', 'vib', 'gain');
    let id = String(raw.sfx);
    let posRaw: unknown = raw.at ?? 'center';
    if (id.includes('@')) {
      const [name, posText] = id.split('@');
      id = name.trim();
      posRaw = posText.trim();
    }
    if (!isSfx(id)) { errors.push(`${where}：未知音效「${id}」`); return undefined; }
    const pos = parsePos(posRaw, where, errors, (str(raw.dist) as Distance) ?? 'mid');
    if (!pos) return undefined;
    if (raw.dist !== undefined && typeof posRaw === 'string' && !posRaw.includes(':')) pos.dist = String(raw.dist) as Distance;
    return { k: 'sfx', id, pos, text: str(raw.text), vib: vib(raw.vib, where, errors), gain: typeof raw.gain === 'number' ? raw.gain : undefined };
  }
  if ('amb' in raw) {
    allow('amb');
    const ids = list(raw.amb);
    const bad = ids.filter((id) => !isAmbience(id));
    if (bad.length) errors.push(`${where}：未知環境聲 ${bad.join(', ')}`);
    return { k: 'amb', ids: ids.filter(isAmbience) };
  }
  if ('move' in raw) {
    allow('move');
    if (!isObj(raw.move)) { errors.push(`${where}：move 必須是 map`); return undefined; }
    const moves: Record<string, Pos> = {};
    for (const [who, posRaw] of Object.entries(raw.move)) {
      if (!(CHARACTER_KEYS as readonly string[]).includes(who)) errors.push(`${where}：move 未知角色「${who}」`);
      const pos = parsePos(posRaw, where, errors);
      if (pos) moves[who] = pos;
    }
    return { k: 'move', moves };
  }
  if ('pause' in raw) {
    allow('pause');
    const seconds = Number(raw.pause);
    if (!(seconds >= 0)) errors.push(`${where}：pause 必須是秒數`);
    return { k: 'pause', seconds };
  }
  if ('wait' in raw) {
    allow('wait', 'clock', 'until');
    const seconds = Number(raw.wait);
    if (!(seconds > 0)) errors.push(`${where}：wait 必須是正秒數`);
    return { k: 'wait', seconds, clock: str(raw.clock), until: str(raw.until) };
  }
  if ('vib' in raw) {
    allow('vib');
    const id = vib(raw.vib, where, errors);
    return id ? { k: 'vib', id } : undefined;
  }
  if ('clock' in raw) {
    allow('clock');
    return { k: 'clock', time: String(raw.clock) };
  }
  if ('choice' in raw) {
    allow('choice');
    const choice = raw.choice;
    if (!isObj(choice) || !Array.isArray(choice.options)) { errors.push(`${where}：choice 需要 options`); return undefined; }
    for (const key of Object.keys(choice)) if (!['timeout', 'default', 'options'].includes(key)) errors.push(`${where}：choice 未知欄位「${key}」`);
    const options: ChoiceOption[] = [];
    choice.options.forEach((option, index) => {
      const at = `${where}.options[${index}]`;
      if (!isObj(option)) { errors.push(`${at}：選項必須是 map`); return; }
      for (const key of Object.keys(option)) if (!['text', 'if', 'then', 'goto'].includes(key)) errors.push(`${at}：選項未知欄位「${key}」`);
      const text = str(option.text);
      if (!text) { errors.push(`${at}：選項沒有文字`); return; }
      options.push({
        text,
        cond: option.if === undefined ? undefined : cond(option.if, at, errors),
        then: parseBeats(option.then, `${at}.then`, errors),
        goto: option.goto === undefined ? undefined : String(option.goto),
      });
    });
    if (options.length === 0) errors.push(`${where}：choice 沒有選項`);
    if (!options.some((option) => !option.cond)) errors.push(`${where}：至少要有一個沒有 if 的選項`);
    const timeout = choice.timeout === undefined ? undefined : Number(choice.timeout);
    const fallback = choice.default === undefined ? undefined : Number(choice.default);
    if (fallback !== undefined && (fallback < 0 || fallback >= options.length)) errors.push(`${where}：default 超出範圍`);
    if (fallback !== undefined && options[fallback]?.cond) errors.push(`${where}：default 選項不能有 if`);
    return { k: 'choice', timeout, default: fallback, options };
  }
  if ('if' in raw) {
    allow('if', 'then', 'else');
    const parsed = cond(raw.if, where, errors);
    return parsed ? { k: 'if', cond: parsed, then: parseBeats(raw.then, `${where}.then`, errors), else: parseBeats(raw.else, `${where}.else`, errors) } : undefined;
  }
  if ('set' in raw) { allow('set'); return { k: 'set', flags: list(raw.set) }; }
  if ('learn' in raw) { allow('learn'); return { k: 'learn', ids: list(raw.learn) }; }
  if ('goto' in raw) { allow('goto'); return { k: 'goto', scene: String(raw.goto) }; }
  if ('end' in raw) {
    allow('end');
    const kind = String(raw.end) as EndKind;
    if (!END_KINDS.includes(kind)) errors.push(`${where}：未知 end「${kind}」`);
    return { k: 'end', kind };
  }
  errors.push(`${where}：無法辨識的 beat ${JSON.stringify(raw).slice(0, 80)}`);
  return undefined;
}

export function parseChapter(source: string, file: string, errors: Errors): Chapter | undefined {
  let doc: unknown;
  try { doc = load(source); } catch (error) { errors.push(`${file}：YAML 錯誤 ${(error as Error).message}`); return undefined; }
  if (!isObj(doc)) { errors.push(`${file}：根節點必須是 map`); return undefined; }
  const key = String(doc.chapter ?? '');
  const title = str(doc.title) ?? '';
  const start = str(doc.start) ?? '';
  if (!key) errors.push(`${file}：缺少 chapter`);
  if (!start) errors.push(`${file}：缺少 start`);
  const advance: Chapter['advance'] = [];
  for (const [index, rule] of (Array.isArray(doc.advance) ? doc.advance : []).entries()) {
    if (!isObj(rule)) { errors.push(`${file}.advance[${index}]：必須是 map`); continue; }
    const parsed = cond(rule.if ?? 'true', `${file}.advance[${index}]`, errors);
    if (parsed) advance.push({ cond: parsed, to: String(rule.to) });
  }
  const scenes: Scene[] = [];
  for (const [index, rawScene] of (Array.isArray(doc.scenes) ? doc.scenes : []).entries()) {
    const where = `${file}.scenes[${index}]`;
    if (!isObj(rawScene)) { errors.push(`${where}：必須是 map`); continue; }
    for (const field of Object.keys(rawScene)) {
      if (!['id', 'time', 'place', 'ambience', 'cast', 'beats', 'threads', 'next'].includes(field)) errors.push(`${where}：場景未知欄位「${field}」`);
    }
    const id = str(rawScene.id);
    if (!id) { errors.push(`${where}：缺少 id`); continue; }
    const at = `${file}#${id}`;
    const cast: Record<string, Pos> = {};
    if (isObj(rawScene.cast)) {
      for (const [who, posRaw] of Object.entries(rawScene.cast)) {
        if (!(CHARACTER_KEYS as readonly string[]).includes(who)) errors.push(`${at}：cast 未知角色「${who}」`);
        const pos = parsePos(posRaw, `${at}.cast.${who}`, errors);
        if (pos) cast[who] = pos;
      }
    }
    const ambience = rawScene.ambience === undefined ? undefined : list(rawScene.ambience);
    const badAmb = (ambience ?? []).filter((amb) => !isAmbience(amb));
    if (badAmb.length) errors.push(`${at}：未知環境聲 ${badAmb.join(', ')}`);
    const threads: Record<string, Beat[]> = {};
    if (isObj(rawScene.threads)) {
      for (const [name, thread] of Object.entries(rawScene.threads)) {
        const beats = isObj(thread) ? thread.beats : thread;
        threads[name] = parseBeats(beats, `${at}.threads.${name}`, errors);
      }
    }
    scenes.push({
      id,
      chapter: key,
      time: str(rawScene.time),
      place: str(rawScene.place),
      ambience: ambience?.filter(isAmbience),
      cast,
      beats: parseBeats(rawScene.beats, `${at}.beats`, errors),
      threads,
      next: str(rawScene.next),
    });
  }
  return { key, title, start, advance, scenes };
}
