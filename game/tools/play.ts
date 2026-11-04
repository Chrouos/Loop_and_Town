// Play the game in a terminal: what the player would read and hear, one line at a time.
//
//   npx vite-node tools/play.ts -- --chapter 3 [options]
//
//   --chapter K          1–7 or final (earlier chapters' clues are granted, like the chapter list)
//   --loops N            how many 10/3 to live through (default 1); stops at an ending
//   --pick scene:text    in scene, pick the option containing text; repeat for more. "scene:a|b" tries a, then b on the next visit
//   --default MODE       when no --pick fits: first (default) | last | silence | random
//   --locate MODE        right | wrong | a,b,c (directions in order)  — right = where the sound really is
//   --approach MODE      hit (default) | early | late
//   --hold MODE          steady (default: hold until it comes through) | shaky (lets go too soon every time)
//   --keep               long-press every line that can be kept (so recall has something)
//   --keepwhen a|b       long-press only lines containing a or b (memory holds 10; --keep fills it early)
//   --recall text        at a recall, say the memory containing text (else the first one)
//   --know k_a,k_b       start already knowing these clues
//   --tension N          start this wound up (0–100)
//   --seed N             for --default random
//   --quiet              no sound lines, only words and choices
import { Director } from '../src/engine/director';
import { freshSave, type GameSave } from '../src/engine/save';
import { loadGameScript } from '../src/script/load';
import { DIRECTIONS, type Direction } from '../src/audio/catalog';
import type { AudioEngine } from '../src/audio/engine';

const args = process.argv.slice(2).filter((a) => a !== '--');
const opt = (name: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const many = (name: string) => args.flatMap((a, i) => (a === `--${name}` ? [args[i + 1]!] : []));
const has = (name: string) => args.includes(`--${name}`);

const chapter = opt('chapter') ?? '1';
const loops = Number(opt('loops') ?? 1);
const mode = opt('default') ?? 'first';
const locateMode = opt('locate') ?? 'right';
const approachMode = opt('approach') ?? 'hit';
const quiet = has('quiet');
let seed = Number(opt('seed') ?? 7) || 7;
const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

const picks = new Map<string, string[]>();
for (const p of many('pick')) {
  const at = p.indexOf(':');
  picks.set(p.slice(0, at), p.slice(at + 1).split('|'));
}
const used = new Map<string, number>();

const out: string[] = [];
const say = (s: string) => { out.push(s); console.log(s); };
const DIR: Record<string, string> = { front: '前', 'front-right': '右前', right: '右', 'back-right': '右後', back: '後', 'back-left': '左後', left: '左', 'front-left': '左前', center: '中' };

const sounds: string[] = [];
const audio = {
  ready: true, unlock: async () => undefined, setEnabled() {}, setVolume() {}, setVoiceVolume() {}, setAmbienceVolume() {}, setSfxVolume() {},
  setAmbience(ids: string[]) { if (!quiet && ids.length) say(`    〔環境〕${ids.join('、')}`); },
  play(id: string, pos: { dir: string; dist?: string }) { if (!quiet && id !== 'heartbeat' && id !== 'cloth_rustle' && id !== 'breath' && id !== 'memory_keep') sounds.push(`${id}@${DIR[pos.dir] ?? pos.dir}`); },
  voice() {}, setAttention() {}, setDaze() {}, setNoise() {}, duck() {}, silence() {}, suspend() {}, resume() {},
  speak(text: string) { if (!quiet) say(`    〔讀屏念出〕${text}`); },
  hush() {},
} as unknown as AudioEngine;

const { script, errors } = loadGameScript();
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
if (!script.order.includes(chapter)) { console.error(`沒有這一章：${chapter}（可用：${script.order.join(' ')}）`); process.exit(1); }
let save: GameSave = freshSave();
const d = new Director(script, save, { audio, vibrate: () => undefined, persist: (s) => { save = s; }, wallNow: () => 0 }, { speed: 1 });
d.jumpToChapter(chapter, true);
const known = d.knows as Set<string>;
for (const k of (opt('know') ?? '').split(',').filter(Boolean)) known.add(k);
if (opt('tension')) d.setTension(Number(opt('tension')));

let lastCenter = -1;
let lastScene = '';
let lastChoice = -1;
let lastInteract = -1;
let lastPeriph = new Set<number>();
let lastHeart = '';
let lastDaze = '';
let lastTension = -1;
const startLoop = d.save.loop;
const internals = d as unknown as { runs: Map<string, { pendingInteract?: { beat: { at?: Direction } } }> };

const flushSounds = () => { if (sounds.length) { say(`    〔聲音〕${[...new Set(sounds)].join('  ')}`); sounds.length = 0; } };

for (let step = 0; step < 400_000; step++) {
  const v = d.view;
  if (v.phase === 'ending') { flushSounds(); say(`\n══ 結局 ${v.ending} ══`); break; }
  if (d.save.loop - startLoop >= loops) { flushSounds(); say('\n══ 午夜，重來 ══'); break; }
  if (v.sceneId && v.sceneId !== lastScene) {
    lastScene = v.sceneId;
    flushSounds();
    say(`\n── ${v.sceneId}　${v.clock ?? ''}　${v.place ?? ''}　（第 ${d.save.chLoop} 次的這一章）`);
  }
  if (v.center && v.center.key !== lastCenter) {
    lastCenter = v.center.key;
    flushSounds();
    const who = v.center.kind === 'narr' ? '' : v.center.kind === 'think' ? '（心聲）' : v.center.kind === 'me' ? '我：' : v.center.label ? `${v.center.label}：` : '';
    say(`${who}${v.center.text.replace(/\|/g, '')}${v.center.pos && v.center.kind === 'char' ? `　〈${DIR[v.center.pos.dir] ?? ''}〉` : ''}`);
    const keepWhen = opt('keepwhen')?.split('|');
    if (keepWhen ? keepWhen.some((w) => v.center!.text.includes(w)) : has('keep')) d.capture(v.center.key);
  }
  if (!quiet) {
    for (const p of v.periph) if (!lastPeriph.has(p.key) && (p.kind === 'sfx' || p.kind === 'cue')) say(`    〔${DIR[p.pos.dir] ?? ''}〕${p.text}${p.src ? `（${p.src}）` : ''}`);
    lastPeriph = new Set(v.periph.map((p) => p.key));
    const heart = v.heart?.level ?? 'off';
    if (heart !== lastHeart) { lastHeart = heart; if (heart !== 'off') say(`    〔心跳 ${heart}〕`); }
    const daze = v.daze ?? 'off';
    if (daze !== lastDaze) { lastDaze = daze; if (daze !== 'off') say(`    〔恍惚 ${daze}〕`); }
    if (v.tension !== lastTension) { if (lastTension >= 0) say(`    〔緊張區段 ${lastTension}→${v.tension}〕`); lastTension = v.tension; }
  }
  if (v.keep) d.skipKeep();
  if (v.recall) {
    const want = opt('recall');
    const memory = v.recall.memories.find((m) => want && m.text.includes(want)) ?? v.recall.memories[0];
    say(`    ▶ 想起：${memory ? memory.text : '（什麼都想不起來，算了）'}`);
    d.recallPick(memory ? memory.key : null);
  } else if (v.interact?.type === 'hold') {
    // A hold is retried until its window closes, so it is not a once-per-key interaction.
    const it = v.interact;
    if (it.since === null) {
      const shaky = opt('hold') === 'shaky';
      if (lastInteract !== it.key) say(`  🫁 ${it.prompt ?? '屏息'}${shaky ? '　→ 一直太早放開' : '　→ 按住，慢慢吐氣'}`);
      lastInteract = it.key;
      d.holdStart();
      if (shaky) { d.tick(400); d.holdEnd(); }
    }
  } else if (v.choice && v.focus === 'main' && v.choice.key !== lastChoice) {
    lastChoice = v.choice.key;
    flushSounds();
    const texts = v.choice.options.map((o) => o.text);
    const open = v.choice.options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);
    const secs = v.choice.timeout ? (v.choice.timeout > 100 ? v.choice.timeout / 1000 : v.choice.timeout) : 0;
    say(`  ？ ${texts.map((t, i) => `[${i + 1}] ${t}${v.choice!.options[i]!.disabled ? '（不能選）' : ''}`).join('  ')}${secs ? `（${Math.round(secs)} 秒）` : ''}`);
    const list = picks.get(v.sceneId ?? '');
    let index = -1;
    if (list) {
      const n = used.get(v.sceneId!) ?? 0;
      const want = list[Math.min(n, list.length - 1)]!;
      used.set(v.sceneId!, n + 1);
      index = texts.findIndex((t, i) => t.includes(want) && open.includes(i));
      // A memory can be reached for at any question, even one without a recall option.
      if (index < 0 && want.includes('想起') && d.canRemember()) { say('  ▶ （想起一句話）'); d.remember(); continue; }
    }
    if (index < 0 && mode === 'silence' && v.choice.timeout) { say('  ▶ （不說話，等它過去）'); continue; }
    if (index < 0) index = mode === 'last' ? open[open.length - 1]! : mode === 'random' ? open[Math.floor(rand() * open.length)]! : open[0]!;
    say(`  ▶ ${texts[index]}`);
    d.choose(v.choice.options[index]!.index);
  } else if (v.interact && v.interact.key !== lastInteract) {
    const it = v.interact;
    if (it.type === 'touch') { lastInteract = it.key; say(`  ✋ 摸：${it.prompt ?? ''}（${it.cells.join('')}）`); d.touchDone(); }
    else if (it.type === 'punch') { lastInteract = it.key; say(`  ✋ 打點字：${it.prompt ?? ''}`); d.punchDone(); }
    else if (it.type === 'locate') {
      flushSounds();
      const right = internals.runs.get('main')?.pendingInteract?.beat.at;
      let dir: Direction;
      if (locateMode === 'right' && right) dir = right;
      else if (locateMode === 'wrong' && right) dir = DIRECTIONS[(DIRECTIONS.indexOf(right) + 4) % 8]!;
      else { const list = locateMode.split(',') as Direction[]; dir = list[(it.wrong.length) % list.length] ?? 'front'; }
      say(`  👂 ${it.prompt ?? '聽聲辨位'}　→ 指向 ${DIR[dir]}${right ? `（聲音在 ${DIR[right]}）` : ''}`);
      d.locatePick(dir);
      if (d.view.interact?.key !== it.key) lastInteract = it.key;
    } else if (it.type === 'approach') {
      if (approachMode === 'early') { lastInteract = it.key; say(`  👂 ${it.prompt ?? '等它靠近'}　→ 太早開口`); d.approachCall(); }
      else if (approachMode === 'late') { /* let it pass */ }
      else {
        // Call once the steps are at her heels: poll until the call would land as a hit.
        const p = (d as unknown as { runs: Map<string, { pendingInteract?: { start: number; beat: { steps: number; interval: number } } }> }).runs.get('main')?.pendingInteract;
        if (p && v.t >= p.start + (p.beat.steps - 1) * p.beat.interval * 1000) { lastInteract = it.key; say(`  👂 ${it.prompt ?? '等它靠近'}　→ 剛好轉身`); d.approachCall(); }
      }
    }
  } else if (!v.choice && !v.interact) {
    d.hurry();
  }
  d.tick(150);
}
flushSounds();
console.log(`\n［知道的線索］${[...(d.knows as Set<string>)].filter((k) => !k.startsWith('k_sig_')).slice(-12).join(', ')}`);
