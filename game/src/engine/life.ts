import type { AmbienceId, Direction, Distance, SfxId, VoiceId } from '../audio/catalog';

// Background life: what goes on around her that the story does not need.
// Not clickable, nothing to learn. Strangers talk, a cup is set down, a scooter passes —
// so a wait is never just a black screen. Steady sounds the ambience already plays
// (rail joints, insects, server hum) are text only; one-off sounds and half-heard voices play too.

export type LifeSound = { text: string; sfx?: SfxId; at?: Direction[]; dist?: Distance };
export type LifeVoice = { say: string; voice: VoiceId; at?: Direction[]; dist?: Distance; reply?: { say: string; voice: VoiceId } };
export type LifeEvent = LifeSound | LifeVoice;
export type Life = { every: [number, number]; events: LifeEvent[] };

const AROUND: Direction[] = ['front-left', 'left', 'back-left', 'back', 'back-right', 'right', 'front-right'];
const SIDES: Direction[] = ['left', 'right', 'back-left', 'back-right'];

export const LIFE: Partial<Record<AmbienceId, Life>> = {
  train_interior: {
    every: [4, 8],
    events: [
      { text: '喀噠、喀噠', at: ['back', 'front'], dist: 'near' },
      { text: '喀啦', at: SIDES, dist: 'mid' },
      { text: '咳、咳', sfx: 'cough', at: ['back-right', 'right'], dist: 'mid' },
      { text: '沙沙', sfx: 'paper_rustle', at: ['right', 'front-right'], dist: 'mid' },
      { say: '……那家的粽子我跟妳說，真的要早點去排……', voice: 'woman', at: ['back-right'], dist: 'far' },
      { say: '媽媽，還有幾站？', voice: 'child', at: ['back', 'back-right'], dist: 'far', reply: { say: '還早，再睡一下。', voice: 'woman' } },
      { say: '便當——飲料——', voice: 'man', at: ['front'], dist: 'far' },
      { say: '借過、借過一下。', voice: 'man', at: ['left'], dist: 'mid' },
      { text: '呵呵', sfx: 'laugh_soft', at: ['back-right'], dist: 'far' },
    ],
  },
  platform: {
    every: [5, 9],
    events: [
      { text: '呼——', sfx: 'wind_gust', at: AROUND, dist: 'far' },
      { text: '叩、叩', sfx: 'step', at: SIDES, dist: 'mid' },
      { text: '喀、喀、喀', sfx: 'step_heels', at: SIDES, dist: 'far' },
      { text: '噗嘶——', sfx: 'bus_hiss', at: ['back', 'back-left'], dist: 'far' },
      { text: '嘎——', sfx: 'crow', at: ['front-left', 'front-right'], dist: 'far' },
      { say: '阿明！這裡啦！', voice: 'old_man', at: ['right', 'front-right'], dist: 'far' },
      { say: '行李我拿就好，妳走前面。', voice: 'woman', at: ['left', 'back-left'], dist: 'mid' },
      { say: '……往北的旅客，請在二號月台候車……', voice: 'announcer', at: ['front'], dist: 'far' },
    ],
  },
  street_morning: {
    every: [4, 8],
    events: [
      { text: '叮鈴', sfx: 'bicycle_bell', at: SIDES, dist: 'mid' },
      { text: '噗、噗噗——', sfx: 'car_pass', at: ['left', 'right'], dist: 'far' },
      { text: '嘩啦啦——', at: ['front-left', 'front-right'], dist: 'far' },
      { text: '刷、刷', at: ['right', 'back-right'], dist: 'mid' },
      { text: '汪', sfx: 'dog_bark', at: AROUND, dist: 'far' },
      { say: '菜頭一斤多少？', voice: 'old_woman', at: ['left', 'front-left'], dist: 'far', reply: { say: '算妳三十啦。', voice: 'man' } },
      { say: '早——', voice: 'woman', at: ['right', 'front-right'], dist: 'mid' },
      { say: '等我啦——', voice: 'child', at: ['back', 'back-left'], dist: 'mid' },
    ],
  },
  street_evening: {
    every: [4, 8],
    events: [
      { text: '噗噗噗——', sfx: 'car_pass', at: ['left', 'right'], dist: 'far' },
      { text: '鏘、鏘', at: ['front-left', 'back-right'], dist: 'far' },
      { text: '哈哈', sfx: 'kid_laugh', at: AROUND, dist: 'far' },
      { text: '汪、汪', sfx: 'dog_bark', at: AROUND, dist: 'far' },
      { say: '回來吃飯了啦！', voice: 'woman', at: ['front-left', 'front-right'], dist: 'far' },
      { say: '明天見。', voice: 'man', at: SIDES, dist: 'mid', reply: { say: '掰掰——', voice: 'woman' } },
      { say: '……明天北部地區，午後有局部陣雨……', voice: 'announcer', at: ['back-left', 'back-right'], dist: 'far' },
    ],
  },
  cafe: {
    every: [3.5, 7],
    events: [
      { text: '嘶——', sfx: 'steam_hiss', at: ['back-left', 'left'], dist: 'mid' },
      { text: '嘎啦嘎啦', sfx: 'coffee_grind', at: ['back-left', 'front-right'], dist: 'mid' },
      { text: '叩', sfx: 'cup_set', at: SIDES, dist: 'mid' },
      { text: '叮、叮', sfx: 'spoon_stir', at: ['right', 'back-right'], dist: 'mid' },
      { text: '嘎', sfx: 'chair_scrape', at: AROUND, dist: 'mid' },
      { text: '噠噠噠', sfx: 'typing', at: ['front-left', 'left'], dist: 'far' },
      { say: '兩杯熱拿鐵，好的。', voice: 'woman', at: ['back-left'], dist: 'mid' },
      { say: '請慢用。', voice: 'woman', at: ['right', 'back-right'], dist: 'mid' },
      { say: '……那個案子，下禮拜再說啦……', voice: 'man', at: ['back-right', 'right'], dist: 'far' },
      { say: '真的假的？他這樣講喔？', voice: 'woman', at: ['left', 'front-left'], dist: 'far', reply: { say: '對啊，我也嚇一跳。', voice: 'woman' } },
      { text: '呵呵', sfx: 'laugh_soft', at: AROUND, dist: 'far' },
    ],
  },
  restaurant: {
    every: [3.5, 7],
    events: [
      { text: '滋啦——', at: ['back-left', 'back'], dist: 'mid' },
      { text: '叮', sfx: 'glass_clink', at: SIDES, dist: 'mid' },
      { text: '嘎', sfx: 'chair_scrape', at: AROUND, dist: 'mid' },
      { say: '老闆，再一碗！', voice: 'man', at: ['right', 'front-right'], dist: 'mid' },
      { say: '內用還外帶？', voice: 'woman', at: ['back-left', 'back'], dist: 'mid' },
      { say: '……今晚到明天，東北季風逐漸增強……', voice: 'announcer', at: ['back-left'], dist: 'far' },
      { text: '哈哈', sfx: 'laugh_soft', at: AROUND, dist: 'far' },
    ],
  },
  old_house: {
    every: [7, 13],
    events: [
      { text: '喀', at: AROUND, dist: 'mid' },
      { text: '滴答', at: ['back-left', 'back-right'], dist: 'mid' },
      { text: '咻——', sfx: 'car_pass', at: ['left', 'right'], dist: 'far' },
      { text: '汪', sfx: 'dog_bark', at: AROUND, dist: 'far' },
      { text: '叮鈴', sfx: 'bicycle_bell', at: ['front-left', 'front-right'], dist: 'far' },
      { say: '……那間不是很久沒人住了……', voice: 'old_woman', at: ['front-right', 'right'], dist: 'far' },
    ],
  },
  house_night: {
    every: [7, 12],
    events: [
      { text: '唧——唧——', at: ['front-left', 'front-right'], dist: 'far' },
      { text: '嗡', at: ['back-right'], dist: 'mid' },
      { text: '喀', at: AROUND, dist: 'mid' },
      { text: '咻——', sfx: 'car_pass', at: ['left', 'right'], dist: 'far' },
      { text: '汪、汪', sfx: 'dog_bark', at: AROUND, dist: 'far' },
      { say: '……好，下一位來賓……', voice: 'announcer', at: ['left', 'right'], dist: 'far' },
    ],
  },
  night_insects: {
    every: [8, 14],
    events: [
      { text: '唧——唧——', at: AROUND, dist: 'far' },
      { text: '嘰、嘰', at: AROUND, dist: 'mid' },
    ],
  },
  clock_shop: {
    every: [5, 9],
    events: [
      { text: '滴答、滴答', at: SIDES, dist: 'mid' },
      { text: '嘀、嗒', at: ['front-left', 'front-right'], dist: 'near' },
      { text: '叮', sfx: 'tools_clink', at: ['front', 'front-right'], dist: 'near' },
      { text: '嘰嘰嘰', sfx: 'clock_wind', at: ['right', 'front-right'], dist: 'mid' },
      { text: '噗噗——', sfx: 'car_pass', at: ['back'], dist: 'far' },
    ],
  },
  police_office: {
    every: [5, 9],
    events: [
      { text: '噠噠、噠', sfx: 'typing', at: SIDES, dist: 'mid' },
      { text: '鈴——', sfx: 'phone_ring', at: ['back-left', 'back-right'], dist: 'far' },
      { text: '嗡——', at: ['front-left', 'front-right'], dist: 'mid' },
      { text: '沙', sfx: 'paper_rustle', at: SIDES, dist: 'mid' },
      { say: '……好，我們會派人過去。', voice: 'man', at: ['back-left', 'back-right'], dist: 'far' },
      { say: '學長，這份要簽哪裡？', voice: 'man', at: ['back'], dist: 'far' },
    ],
  },
  hospital: {
    every: [5, 9],
    events: [
      { text: '喀啦喀啦', at: SIDES, dist: 'far' },
      { text: '叩、叩', sfx: 'step', at: AROUND, dist: 'mid' },
      { text: '咳', sfx: 'cough', at: AROUND, dist: 'far' },
      { say: '……請王先生到批價櫃台……', voice: 'announcer', at: ['front', 'back'], dist: 'far' },
      { say: '這邊請，往前直走。', voice: 'woman', at: ['left', 'right'], dist: 'mid' },
    ],
  },
  library: {
    every: [7, 12],
    events: [
      { text: '沙啦', sfx: 'page_turn', at: AROUND, dist: 'mid' },
      { text: '咳', sfx: 'cough', at: AROUND, dist: 'far' },
      { text: '嘎', sfx: 'chair_scrape', at: AROUND, dist: 'far' },
      { text: '沙沙', sfx: 'pen_scratch', at: SIDES, dist: 'mid' },
      { say: '……這本可以借回去嗎……', voice: 'woman', at: ['front-left', 'front-right'], dist: 'far' },
    ],
  },
  town_square: {
    every: [4, 8],
    events: [
      { text: '咕、咕', at: AROUND, dist: 'mid' },
      { text: '啪啦啪啦', at: AROUND, dist: 'mid' },
      { text: '哈哈', sfx: 'kid_laugh', at: AROUND, dist: 'far' },
      { text: '叮鈴', sfx: 'bicycle_bell', at: SIDES, dist: 'mid' },
      { say: '等一下——不要跑那麼快！', voice: 'woman', at: SIDES, dist: 'far' },
    ],
  },
  tower_square_night: {
    every: [8, 14],
    events: [
      { text: '呼——', sfx: 'wind_gust', at: AROUND, dist: 'far' },
      { text: '咻——', sfx: 'car_pass', at: ['left', 'right'], dist: 'far' },
      { text: '叩……叩……', sfx: 'step', at: SIDES, dist: 'far' },
    ],
  },
  wind_open: {
    every: [7, 12],
    events: [
      { text: '呼——', sfx: 'wind_gust', at: AROUND, dist: 'far' },
      { text: '沙沙沙', at: AROUND, dist: 'mid' },
      { text: '嘎——', sfx: 'crow', at: ['front-left', 'front-right'], dist: 'far' },
      { text: '咻——', sfx: 'car_pass', at: ['left', 'right'], dist: 'far' },
    ],
  },
  sea_far: {
    every: [7, 12],
    events: [
      { text: '嘩——', sfx: 'wave', at: ['front', 'front-left', 'front-right'], dist: 'far' },
      { text: '啊、啊', sfx: 'seagull', at: ['front-left', 'front-right'], dist: 'far' },
    ],
  },
  old_station_hall: {
    every: [8, 13],
    events: [
      { text: '滴——', at: AROUND, dist: 'mid' },
      { text: '呼——', sfx: 'wind_gust', at: ['back', 'back-left'], dist: 'far' },
      { text: '啪啦啪啦', at: ['front-left', 'front-right'], dist: 'far' },
    ],
  },
  research_facility: {
    every: [9, 15],
    events: [
      { text: '嗡——', at: AROUND, dist: 'mid' },
      { text: '喀', sfx: 'relay_click', at: AROUND, dist: 'mid' },
      { text: '滴、滴', at: SIDES, dist: 'far' },
    ],
  },
  construction_far: {
    every: [6, 11],
    events: [
      { text: '噠噠噠噠', at: ['front-left', 'front-right'], dist: 'far' },
      { text: '鏘', at: ['front-left', 'front-right'], dist: 'far' },
      { text: '嗶、嗶、嗶', at: ['left', 'right'], dist: 'far' },
    ],
  },
  rain: {
    every: [5, 9],
    events: [
      { text: '滴答滴答', at: AROUND, dist: 'mid' },
      { text: '唰——', sfx: 'car_pass', at: ['left', 'right'], dist: 'far' },
      { text: '啪', sfx: 'umbrella', at: SIDES, dist: 'mid' },
      { text: '啪、啪', sfx: 'step_wet', at: SIDES, dist: 'mid' },
    ],
  },
  rain_on_window: {
    every: [7, 12],
    events: [
      { text: '滴答滴答', at: ['front', 'front-left', 'front-right'], dist: 'near' },
      { text: '轟……', sfx: 'thunder_far', at: ['front-left', 'front-right'], dist: 'far' },
    ],
  },
};

/** Anomaly sounds: the world holds its breath for a while after one of these. */
export const HUSH_SFX: ReadonlySet<SfxId> = new Set<SfxId>([
  'hum_rise', 'blackout', 'silence_drop', 'tinnitus', 'metal_crash', 'glass_break', 'bell_toll', 'bell_toll_far', 'heartbeat', 'spark',
]);
export const HUSH_MS = 16000;

const SCENE_EVERY: [number, number] = [4, 8];

/** The ambience's life plus whatever this one scene adds. */
export function lifeOf(ambience: readonly AmbienceId[], scene?: readonly LifeEvent[]): Life | null {
  const layers = ambience.map((id) => LIFE[id]).filter((life): life is Life => Boolean(life));
  if (scene?.length) layers.push({ every: SCENE_EVERY, events: [...scene, ...scene] }); // the scene's own sounds come up more often
  if (!layers.length) return null;
  return {
    every: [Math.min(...layers.map((life) => life.every[0])), Math.min(...layers.map((life) => life.every[1]))],
    events: layers.flatMap((life) => life.events),
  };
}

export function isVoice(event: LifeEvent): event is LifeVoice { return 'say' in event; }
