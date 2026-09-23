import type { WorldlineHistoryEntry } from '../simulator/types';

export type VisibleRecord = {
  id: string;
  title: string;
  source: string;
  formedAt: string;
  obtainedAt: string;
  body: string[];
  excerpts: Array<{ id: string; text: string }>;
  revealMinute: number;
  matches: (history: WorldlineHistoryEntry[]) => boolean;
};

const always = () => true;
const variant = (id: string) => (history: WorldlineHistoryEntry[]) => history.some(x => x.kind === 'event' && x.eventId === 'evt_1831_station' && x.variantId === id);
const emitted = (history: WorldlineHistoryEntry[]) => history.some(x => x.kind === 'event' && x.eventId === 'evt_2114_reporter_missing');

export const STORY_RECORDS: VisibleRecord[] = [
  { id: 'letter', title: '第七封信', source: '林知夏（信封署名）', formedAt: '郵戳：昨天', obtainedAt: '回到灰潮鎮時', revealMinute: 0, matches: always,
    body: ['回來一趟。', '我知道你會先看信封，才肯相信裡面的字。', '這一次，先別來找我。', '如果午夜的鐘聲響起，就代表又失敗了。', '姊'],
    excerpts: [{ id: 'postmark', text: '郵戳是昨天的；署名是林知夏。' }, { id: 'warning', text: '如果午夜的鐘聲響起，就代表又失敗了。' }] },
  { id: 'yu-an-message', title: '予安的留言', source: '周予安／手機留言', formedAt: '18:00', obtainedAt: '18:00', revealMinute: 0, matches: always,
    body: ['我剛才在店門口碰到若晴。她說今晚要去舊車站，手裡拿著妳姊留下的信封。', '醫院的陳柏勳也問過她幾點會到。她看起來不想自己去。', '妳若想陪她，我可以先去醫院問問陳柏勳。18:20 前告訴我。'],
    excerpts: [{ id: 'plan', text: '若晴說今晚要去舊車站。' }, { id: 'doctor', text: '陳柏勳問過若晴幾點會到。' }] },
  { id: 'old-death', title: '五年前的事故摘要', source: '家中保存的舊案影本', formedAt: '五年前', obtainedAt: '打開案卷時', revealMinute: 0, matches: always,
    body: ['姓名：林知夏。', '地點：舊車站附近。', '結案記載：意外。', '這張紙沒有記下當時誰先到場。'],
    excerpts: [{ id: 'death', text: '林知夏的死亡記載距今五年。' }, { id: 'verdict', text: '舊案以意外結案。' }] },
  { id: 'station-blackout', title: '車站的燈', source: '你當時聽見的聲音', formedAt: '18:31', obtainedAt: '18:31', revealMinute: 1111, matches: history => history.some(x => x.kind === 'event' && x.eventId === 'evt_1831_station'),
    body: ['舊車站那一帶忽然暗了。', '停電只有幾秒。遠處傳來一聲鐘響。', '你還不知道月台上發生了什麼。'], excerpts: [{ id: 'time', text: '18:31，車站停電，鐘響了一聲。' }] },
  { id: 'station-bulletin-wakaharu', title: '車站通報', source: '鎮內公告', formedAt: '18:40', obtainedAt: '18:40', revealMinute: 1120, matches: variant('wakaharu_dies'),
    body: ['舊車站發現許若晴死亡。', '18:31 是現場異常發生的時間；通報沒有提供精確死亡時間。'], excerpts: [{ id: 'victim', text: '舊車站發現許若晴死亡；18:31 並非醫療推定的死亡時間。' }] },
  { id: 'station-bulletin-doctor', title: '車站通報', source: '鎮內公告', formedAt: '18:40', obtainedAt: '18:40', revealMinute: 1120, matches: variant('doctor_dies'),
    body: ['舊車站發現陳柏勳死亡。', '若晴已被帶離車站。公告沒有記下停電原因。'], excerpts: [{ id: 'victim', text: '這一輪，舊車站發現的是陳柏勳。' }] },
  { id: 'station-bulletin-none', title: '車站通報', source: '鎮內公告', formedAt: '18:40', obtainedAt: '18:40', revealMinute: 1120, matches: variant('no_death'),
    body: ['停電後，車站裡沒有人死亡。', '有人聽見鐘響；鐘樓已經停了五年。'], excerpts: [{ id: 'outcome', text: '18:31 仍然停電，但這次沒有人死亡。' }] },
  { id: 'reporter-message', title: '予安的留言', source: '周予安', formedAt: '21:20', obtainedAt: '21:20', revealMinute: 1280, matches: emitted,
    body: ['庭安失去聯絡了。她最後一次回訊息是在車站那邊出事以後。', '我還不知道她去了哪裡。明天我再去問。'], excerpts: [{ id: 'missing', text: '21:20，予安說葉庭安失去聯絡。' }] },
];

export const recordById = (id: string) => STORY_RECORDS.find(record => record.id === id);
