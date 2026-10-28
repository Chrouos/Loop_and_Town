import { load } from 'js-yaml';
import { SFX_SAMPLES } from '../audio/samples';
import { DIRECTIONS, DISTANCES, VOICES, isAmbience, isDirection, isSfx, VIBRATIONS, type Direction, type Distance, type SfxId, type VibrationId, type VoiceId, VIAS, type Via } from '../audio/catalog';
import type { LifeEvent, LifeLine } from '../engine/life';
import { parseCond } from './conditions';
import { DAZE_LEVELS, HEART_LEVELS, NOISE_LEVELS, SHAKE_LEVELS, TENSION_STEP_MAX, type Beat, type Chapter, type ChoiceOption, type DazeLevel, type EndKind, type HeartLevel, type NoiseLevel, type LineBeat, type Pos, type Scene, type ShakeLevel } from './types';

export const CHARACTER_KEYS = ['yuan', 'ruoqing', 'boxun', 'tingan', 'zhiyuan', 'zhixia', 'man', 'woman', 'child', 'old_man', 'old_woman', 'announcer'] as const;
const LINE_KEYS = new Set<string>(['narr', 'me', 'think', 'phone', ...CHARACTER_KEYS]);
const LINE_ATTRS = new Set(['at', 'to', 'as', 'learn', 'mem', 'dist', 'shake', 'via', 'whisper']);
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

/** Where a moving sound ends up; its distance stays where it started unless given. */
function parseTo(raw: unknown, from: Pos | undefined, where: string, errors: Errors): Pos | undefined {
  if (raw === undefined) return undefined;
  if (!from || from.dir === 'center') { errors.push(`${where}：to 需要先有 at 方位`); return undefined; }
  const to = parsePos(raw, `${where}.to`, errors, from.dist);
  if (to?.dir === 'center') { errors.push(`${where}：to 不能是 center`); return undefined; }
  return to;
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

function shake(value: unknown, where: string, errors: Errors): ShakeLevel | undefined {
  if (value === undefined) return undefined;
  const level = String(value);
  if (!(SHAKE_LEVELS as readonly string[]).includes(level)) { errors.push(`${where}：未知震動強度「${level}」（${SHAKE_LEVELS.join('／')}）`); return undefined; }
  return level as ShakeLevel;
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
  if (raw.to !== undefined) line.to = parseTo(raw.to, line.at, where, errors);
  if (raw.as !== undefined) line.label = String(raw.as);
  if (raw.learn !== undefined) line.learn = String(raw.learn);
  if (raw.mem !== undefined) line.mem = String(raw.mem);
  if (raw.shake !== undefined) line.shake = shake(raw.shake, where, errors);
  if (raw.whisper !== undefined) line.whisper = raw.whisper === true;
  if (raw.via !== undefined) {
    const via = String(raw.via);
    if (!(VIAS as readonly string[]).includes(via)) errors.push(`${where}：via 只能是 ${VIAS.join('／')}`);
    else line.via = via as Via;
  }
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
    allow('cue', 'at', 'dist', 'text', 'sfx', 'grab', 'src', 'whisper');
    const pos = parsePos(raw.at, where, errors, (str(raw.dist) as Distance) ?? 'mid');
    const sfx = raw.sfx === undefined ? undefined : String(raw.sfx);
    if (sfx && !isSfx(sfx)) errors.push(`${where}：未知音效「${sfx}」`);
    const text = str(raw.text);
    if (!text) errors.push(`${where}：cue 需要擬聲字 text`);
    if (!pos) return undefined;
    return { k: 'cue', thread: String(raw.cue), pos, text: text ?? '……', sfx: sfx && isSfx(sfx) ? sfx : undefined, grab: raw.grab === true, src: str(raw.src), ...(raw.whisper === true ? { whisper: true } : {}) };
  }
  if ('sfx' in raw) {
    allow('sfx', 'at', 'to', 'dist', 'text', 'vib', 'gain', 'shake', 'src', 'variant');
    let id = String(raw.sfx);
    let posRaw: unknown = raw.at ?? 'center';
    if (id.includes('@')) {
      const [name, posText] = id.split('@');
      id = name.trim();
      posRaw = posText.trim();
    }
    if (!isSfx(id)) { errors.push(`${where}：未知音效「${id}」`); return undefined; }
    const variant = raw.variant;
    const count = SFX_SAMPLES[id]?.files.length ?? 0;
    if (variant !== undefined && (typeof variant !== 'number' || !Number.isInteger(variant) || variant < 1 || variant > count)) {
      errors.push(`${where}：variant must be an integer between 1 and ${count}`);
      return undefined;
    }
    const pos = parsePos(posRaw, where, errors, (str(raw.dist) as Distance) ?? 'mid');
    if (!pos) return undefined;
    if (raw.dist !== undefined && typeof posRaw === 'string' && !posRaw.includes(':')) pos.dist = String(raw.dist) as Distance;
    return { k: 'sfx', id, pos, to: parseTo(raw.to, pos, where, errors), variant: variant as number | undefined, text: str(raw.text), vib: vib(raw.vib, where, errors), gain: typeof raw.gain === 'number' ? raw.gain : undefined, shake: shake(raw.shake, where, errors), src: str(raw.src) };
  }
  if ('amb' in raw) {
    allow('amb', 'fade');
    const ids = list(raw.amb);
    const bad = ids.filter((id) => !isAmbience(id));
    if (bad.length) errors.push(`${where}：未知環境聲 ${bad.join(', ')}`);
    const fade = raw.fade === undefined ? undefined : Number(raw.fade);
    if (fade !== undefined && !(fade >= 0)) errors.push(`${where}：fade 必須是秒數`);
    return { k: 'amb', ids: ids.filter(isAmbience), fade };
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
  if ('shake' in raw) {
    allow('shake');
    const level = shake(raw.shake, where, errors);
    return level ? { k: 'shake', level } : undefined;
  }
  if ('heart' in raw) {
    allow('heart');
    const level = String(raw.heart);
    if (!(HEART_LEVELS as readonly string[]).includes(level)) { errors.push(`${where}：未知心跳「${level}」（${HEART_LEVELS.join('／')}）`); return undefined; }
    return { k: 'heart', level: level as HeartLevel };
  }
  if ('daze' in raw) {
    allow('daze');
    const level = String(raw.daze);
    if (!(DAZE_LEVELS as readonly string[]).includes(level)) { errors.push(`${where}：未知恍惚「${level}」（${DAZE_LEVELS.join('／')}）`); return undefined; }
    return { k: 'daze', level: level as DazeLevel };
  }
  if ('noise' in raw) {
    allow('noise', 'speed', 'loud', 'with');
    const level = String(raw.noise);
    if (!(NOISE_LEVELS as readonly string[]).includes(level)) { errors.push(`${where}：未知雜音「${level}」（${NOISE_LEVELS.join('／')}）`); return undefined; }
    const speed = raw.speed === undefined ? undefined : Number(raw.speed);
    const loud = raw.loud === undefined ? undefined : Number(raw.loud);
    if (speed !== undefined && !(speed >= 1 && speed <= 10)) errors.push(`${where}：noise 的 speed 是 1 到 10 倍`);
    if (loud !== undefined && !(loud >= 1 && loud <= 3)) errors.push(`${where}：noise 的 loud 是 1 到 3 倍`);
    if (level === 'off' && (speed !== undefined || loud !== undefined || raw.with !== undefined)) errors.push(`${where}：noise: off 不用寫 speed／loud／with`);
    // with: sounds and voices that only exist while she panics (the crowd at the door), in the scene `life:` format.
    const extra = raw.with === undefined ? undefined : parseLife(raw.with, `${where}.with`, errors);
    if (extra === 'off') errors.push(`${where}：noise 的 with 是聲音清單`);
    return { k: 'noise', level: level as NoiseLevel, speed, loud, ...(Array.isArray(extra) && extra.length ? { with: extra } : {}) };
  }
  if ('tension' in raw) {
    allow('tension');
    const delta = Number(raw.tension);
    if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > TENSION_STEP_MAX) { errors.push(`${where}：tension 是 -${TENSION_STEP_MAX} 到 ${TENSION_STEP_MAX} 之間、不為 0 的整數`); return undefined; }
    return { k: 'tension', delta };
  }
  if ('clock' in raw) {
    allow('clock');
    return { k: 'clock', time: String(raw.clock) };
  }
  if ('touch' in raw) {
    allow('touch');
    const spec = raw.touch;
    if (!isObj(spec) || !Array.isArray(spec.cells) || spec.cells.length === 0) { errors.push(`${where}：touch 需要 cells`); return undefined; }
    for (const key of Object.keys(spec)) if (!['cells', 'style', 'prompt', 'timeout'].includes(key)) errors.push(`${where}：touch 未知欄位「${key}」`);
    const style = String(spec.style ?? 'braille');
    if (!['braille', 'groove', 'engrave'].includes(style)) errors.push(`${where}：touch style 只能是 braille／groove／engrave`);
    return { k: 'touch', cells: spec.cells.map((cell) => String(cell)), style: style as 'braille', prompt: str(spec.prompt), timeout: Number(spec.timeout ?? 45) };
  }
  if ('locate' in raw) {
    allow('locate');
    const spec = raw.locate;
    if (!isObj(spec)) { errors.push(`${where}：locate 必須是 map`); return undefined; }
    for (const key of Object.keys(spec)) if (!['sfx', 'at', 'decoys', 'tries', 'exact', 'replay', 'lag', 'timeout', 'interval', 'gain', 'prompt', 'success', 'fail'].includes(key)) errors.push(`${where}：locate 未知欄位「${key}」`);
    const sfx = String(spec.sfx);
    const at = String(spec.at);
    if (!isSfx(sfx)) errors.push(`${where}：未知音效「${sfx}」`);
    if (!isDirection(at)) errors.push(`${where}：locate 的 at 必須是八個方位之一`);
    if (spec.lag !== undefined && !(Number(spec.lag) > 0 && Number(spec.lag) < 0.5)) errors.push(`${where}：locate 的 lag 是 0 到 0.5 秒之間`);
    if (spec.replay === false && (spec.decoys !== undefined || spec.lag !== undefined || spec.interval !== undefined)) errors.push(`${where}：replay: false 不重播，不用 decoys／lag／interval（干擾聲寫在前面的劇情裡）`);
    const decoys = (Array.isArray(spec.decoys) ? spec.decoys : []).flatMap((decoy, n) => {
      if (!isObj(decoy) || !isSfx(String(decoy.sfx)) || !isDirection(String(decoy.at))) { errors.push(`${where}.decoys[${n}]：需要合法的 sfx 與 at`); return []; }
      return [{ sfx: String(decoy.sfx) as never, at: String(decoy.at) as never }];
    });
    return {
      k: 'locate', sfx: sfx as never, at: at as never, decoys,
      tries: Math.max(1, Number(spec.tries ?? 2)),
      exact: spec.exact === true,
      // replay: false — nothing plays again; she points at where she heard it a moment ago.
      ...(spec.replay === false ? { replay: false } : {}),
      lag: spec.lag === undefined ? undefined : Number(spec.lag),
      timeout: spec.timeout === undefined ? undefined : Number(spec.timeout),
      interval: spec.interval === undefined ? undefined : Number(spec.interval),
      gain: spec.gain === undefined ? undefined : Number(spec.gain),
      prompt: str(spec.prompt),
      success: parseBeats(spec.success, `${where}.success`, errors),
      fail: parseBeats(spec.fail, `${where}.fail`, errors),
    };
  }
  if ('approach' in raw) {
    allow('approach');
    const spec = raw.approach;
    if (!isObj(spec)) { errors.push(`${where}：approach 必須是 map`); return undefined; }
    for (const key of Object.keys(spec)) if (!['sfx', 'at', 'past', 'steps', 'interval', 'text', 'prompt', 'hit', 'early', 'late'].includes(key)) errors.push(`${where}：approach 未知欄位「${key}」`);
    const sfx = String(spec.sfx);
    const at = String(spec.at ?? 'front');
    if (!isSfx(sfx)) errors.push(`${where}：未知音效「${sfx}」`);
    if (!isDirection(at)) errors.push(`${where}：approach 的 at 必須是八個方位之一`);
    // Unless told otherwise, whoever walks up to her keeps going straight past.
    const past = spec.past === undefined && isDirection(at) ? DIRECTIONS[(DIRECTIONS.indexOf(at) + 4) % DIRECTIONS.length] : String(spec.past);
    if (!isDirection(past)) errors.push(`${where}：approach 的 past 必須是八個方位之一`);
    const steps = Number(spec.steps ?? 6);
    const interval = Number(spec.interval ?? 0.8);
    if (!(Number.isInteger(steps) && steps >= 3)) errors.push(`${where}：approach 的 steps 至少 3 步`);
    if (!(interval >= 0.3)) errors.push(`${where}：approach 的 interval 至少 0.3 秒`);
    return {
      k: 'approach', sfx: sfx as never, at: at as never, past: past as never, steps, interval,
      text: str(spec.text), prompt: str(spec.prompt),
      hit: parseBeats(spec.hit, `${where}.hit`, errors),
      early: parseBeats(spec.early, `${where}.early`, errors),
      late: parseBeats(spec.late, `${where}.late`, errors),
    };
  }
  if ('punch' in raw) {
    allow('punch');
    const spec = raw.punch;
    if (!isObj(spec) || !Array.isArray(spec.cells) || spec.cells.length === 0) { errors.push(`${where}：punch 需要 cells`); return undefined; }
    for (const key of Object.keys(spec)) if (!['cells', 'label', 'prompt', 'timeout'].includes(key)) errors.push(`${where}：punch 未知欄位「${key}」`);
    const cells = spec.cells.map((cell) => (Array.isArray(cell) ? cell.map(Number) : []));
    if (cells.some((cell) => cell.length === 0 || cell.some((dot) => !(dot >= 1 && dot <= 6)))) errors.push(`${where}：punch 每一格是 1–6 的點號清單`);
    return { k: 'punch', cells, label: str(spec.label), prompt: str(spec.prompt), timeout: Number(spec.timeout ?? 90) };
  }
  if ('choice' in raw) {
    allow('choice');
    const choice = raw.choice;
    if (!isObj(choice) || !Array.isArray(choice.options)) { errors.push(`${where}：choice 需要 options`); return undefined; }
    for (const key of Object.keys(choice)) if (!['timeout', 'default', 'options', 'silence'].includes(key)) errors.push(`${where}：choice 未知欄位「${key}」`);
    const options: ChoiceOption[] = [];
    choice.options.forEach((option, index) => {
      const at = `${where}.options[${index}]`;
      if (!isObj(option)) { errors.push(`${at}：選項必須是 map`); return; }
      for (const key of Object.keys(option)) if (!['text', 'if', 'disabled_if', 'then', 'goto', 'recall'].includes(key)) errors.push(`${at}：選項未知欄位「${key}」`);
      let recall: ChoiceOption['recall'];
      if (option.recall !== undefined) {
        if (!isObj(option.recall) || !Array.isArray(option.recall.accept) || option.recall.accept.length === 0) {
          errors.push(`${at}：recall 需要 accept 清單`);
        } else {
          for (const key of Object.keys(option.recall)) if (!['accept', 'miss'].includes(key)) errors.push(`${at}：recall 未知欄位「${key}」`);
          const accept = option.recall.accept.flatMap((entry, n) => {
            const where2 = `${at}.recall.accept[${n}]`;
            if (!isObj(entry) || typeof entry.mem !== 'string') { errors.push(`${where2}：需要 mem`); return []; }
            for (const key of Object.keys(entry)) if (!['mem', 'then', 'goto'].includes(key)) errors.push(`${where2}：未知欄位「${key}」`);
            return [{ mem: entry.mem, then: parseBeats(entry.then, `${where2}.then`, errors), goto: entry.goto === undefined ? undefined : String(entry.goto) }];
          });
          recall = { accept, miss: parseBeats(option.recall.miss, `${at}.recall.miss`, errors) };
        }
      }
      const text = str(option.text) ?? (recall ? '（想起一句話……）' : undefined);
      if (!text) { errors.push(`${at}：選項沒有文字`); return; }
      if (recall && (option.then !== undefined || option.goto !== undefined)) errors.push(`${at}：recall 選項的結果寫在 accept 裡，不要用 then／goto`);
      options.push({
        text,
        cond: option.if === undefined ? undefined : cond(option.if, at, errors),
        disabledCond: option.disabled_if === undefined ? undefined : cond(option.disabled_if, `${at}.disabled_if`, errors),
        then: parseBeats(option.then, `${at}.then`, errors),
        goto: option.goto === undefined ? undefined : String(option.goto),
        recall,
      });
    });
    if (options.length === 0) errors.push(`${where}：choice 沒有選項`);
    if (!options.some((option) => !option.cond && !option.recall)) errors.push(`${where}：至少要有一個沒有 if、也不是 recall 的選項`);
    const timeout = choice.timeout === undefined ? undefined : Number(choice.timeout);
    const fallback = choice.default === undefined ? undefined : Number(choice.default);
    if (fallback !== undefined && (fallback < 0 || fallback >= options.length)) errors.push(`${where}：default 超出範圍`);
    if (fallback !== undefined && (options[fallback]?.cond || options[fallback]?.recall)) errors.push(`${where}：default 選項不能有 if 或 recall`);
    // Saying nothing is not an option on screen: it is what happens when the time runs out.
    if (choice.silence !== undefined) {
      if (timeout === undefined) errors.push(`${where}：silence 需要 timeout`);
      if (fallback !== undefined) errors.push(`${where}：有 silence 就不用 default`);
      options.push({ text: '（沉默）', then: parseBeats(choice.silence, `${where}.silence`, errors), silent: true });
    }
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

function parseLife(raw: unknown, where: string, errors: Errors): LifeEvent[] | 'off' | undefined {
  if (raw === 'off' || raw === false) return 'off';
  if (!Array.isArray(raw)) { errors.push(`${where}：必須是 off 或清單`); return undefined; }
  const events: LifeEvent[] = [];
  for (const [index, item] of raw.entries()) {
    const at = `${where}[${index}]`;
    if (!isObj(item)) { errors.push(`${at}：必須是 map`); continue; }
    for (const field of Object.keys(item)) {
      if (!['text', 'src', 'sfx', 'say', 'voice', 'reply', 'at', 'dist', 'whisper'].includes(field)) errors.push(`${at}：不支援欄位「${field}」`);
    }
    const dirs = item.at === undefined ? undefined : list(item.at);
    const badDir = (dirs ?? []).filter((dir) => !isDirection(dir));
    if (badDir.length) errors.push(`${at}：未知方位 ${badDir.join(', ')}`);
    const dist = item.dist === undefined ? undefined : String(item.dist);
    if (dist !== undefined && !(DISTANCES as readonly string[]).includes(dist)) errors.push(`${at}：未知距離「${dist}」`);
    const place = { at: dirs?.filter(isDirection) as Direction[] | undefined, dist: dist as Distance | undefined };
    const say = str(item.say);
    if (say) {
      const voice = str(item.voice) ?? 'woman';
      if (!(voice in VOICES)) { errors.push(`${at}：未知聲音「${voice}」`); continue; }
      // reply: the other side of the exchange, one { say, voice } or a list of them
      const turns: LifeLine[] = [];
      for (const [n, turn] of (item.reply === undefined ? [] : Array.isArray(item.reply) ? item.reply : [item.reply]).entries()) {
        const turnSay = isObj(turn) ? str(turn.say) : undefined;
        const turnVoice = isObj(turn) ? str(turn.voice) ?? 'woman' : undefined;
        if (!turnSay || !turnVoice || !(turnVoice in VOICES)) { errors.push(`${at}.reply[${n}]：需要 say 和已知的 voice`); continue; }
        turns.push({ say: turnSay, voice: turnVoice as VoiceId });
      }
      // whisper: true / false overrides the place (a library whispers, a shout never does)
      if (item.whisper !== undefined && typeof item.whisper !== 'boolean') errors.push(`${at}：whisper 必須是 true 或 false`);
      const whisper = typeof item.whisper === 'boolean' ? { whisper: item.whisper } : {};
      events.push({ say, voice: voice as VoiceId, ...place, ...(turns.length ? { reply: turns } : {}), ...whisper });
      continue;
    }
    const text = str(item.text);
    if (!text) { errors.push(`${at}：需要 text 或 say`); continue; }
    const sfx = item.sfx === undefined ? undefined : String(item.sfx);
    if (!sfx) { errors.push(`${at}：擬聲事件需要 sfx 音效`); continue; }
    if (!isSfx(sfx)) { errors.push(`${at}：未知音效「${sfx}」`); continue; }
    events.push({ text, src: str(item.src), sfx, ...place });
  }
  return events;
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
      if (!['id', 'time', 'place', 'ambience', 'cast', 'beats', 'threads', 'next', 'life'].includes(field)) errors.push(`${where}：場景未知欄位「${field}」`);
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
      life: rawScene.life === undefined ? undefined : parseLife(rawScene.life, `${at}.life`, errors),
    });
  }
  return { key, title, start, restart: str(doc.restart), advance, scenes };
}
