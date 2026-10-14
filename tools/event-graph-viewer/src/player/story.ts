import type { WorldlineHistoryEntry } from '../simulator/types';
import { compileSpatialScript, type SpatialScript } from './spatialText';

export type VisibleRecord = {
  id: string;
  title: string;
  source: string;
  formedAt: string;
  obtainedAt: string;
  body: string[];
  excerpts: Array<{ id: string; text: string }>;
  revealMinute: number;
  availableUntilMinute?: number;
  acquisition: RecordAcquisition;
  spatialScript?: SpatialScript;
  matches: (history: WorldlineHistoryEntry[]) => boolean;
};

export type PlayerNarrativeRecord = VisibleRecord & {
  sceneId: string;
  loopId: number | 'final';
};

export type RecordAcquisition = 'persistent' | 'message' | 'presence';

const always = () => true;
const variant = (id: string) => (history: WorldlineHistoryEntry[]) => history.some(x => x.kind === 'event' && x.eventId === 'evt_1831_station' && x.variantId === id);
const emitted = (history: WorldlineHistoryEntry[]) => history.some(x => x.kind === 'event' && x.eventId === 'evt_2114_reporter_missing');

const stationBlackoutSpatial = compileSpatialScript([
  {
    type: 'narration',
    text: '停電只有幾秒。',
    presentation: { anchor: 'center', beats: ['停電只有幾秒。'], beatMs: 520, pauseAfterMs: 240, echoMs: 1000 },
  },
  {
    type: 'narration',
    text: '——鐘聲。',
    presentation: { anchor: 'upper-right', beats: ['——鐘聲。'], beatMs: 650, pauseAfterMs: 300, echoMs: 1500 },
  },
  {
    type: 'monologue',
    text: '……月台上發生了什麼？',
    presentation: { anchor: 'lower-left', beats: ['……月台上', '發生了什麼？'], beatMs: 580, echoMs: 1200 },
  },
]);

export const STORY_RECORDS: VisibleRecord[] = [
  { id: 'signal-ledger', title: '舊站同步影像', source: '控制室外側螢幕／自行目視', formedAt: '17:33', obtainedAt: '17:33–17:42', revealMinute: 1053, availableUntilMinute: 1062, acquisition: 'presence',
    matches: always, body: ['顯示器左邊的 Target State 比右邊的 Observed State 早了一個 Epoch。', '時間碼有一段重疊，卻沒有人承認把模擬數據寫進現實。'],
    excerpts: [{ id: 'epoch', text: 'Target 和 Observed 被標為不同 Sync Epoch。' }] },
  { id: 'backup-relay', title: '舊站維修銘牌', source: '維修門外側／自行目視', formedAt: '17:48', obtainedAt: '17:48–17:57', revealMinute: 1068, availableUntilMinute: 1077, acquisition: 'presence',
    matches: always, body: ['維修銘牌列出兩條輸出：PRIMARY / RECOVERY。', 'RECOVERY 有獨立回傳路徑；沒有任何標誌能證明它目前仍可改寫現實。'],
    excerpts: [{ id: 'bridge', text: '舊站有 PRIMARY 和 RECOVERY 兩條獨立回傳路徑。' }] },
  { id: 'track-damage', title: '維修通道的痕跡', source: '舊站外路面／自行目視', formedAt: '18:14', obtainedAt: '18:14–18:23', revealMinute: 1094, availableUntilMinute: 1103, acquisition: 'presence',
    matches: always, body: ['主通道後方有新近施工留下的輪痕。', '醫療人員若從這裡繞行，可能在 18:31 接近暴露區域。'],
    excerpts: [{ id: 'risk', text: '維修路線可能讓人暴露於站區異常。' }] },
  { id: 'external-ack', title: '獨立監測紀錄', source: '志遠保全的獨立紀錄器／自行目視', formedAt: '18:50', obtainedAt: '18:50–18:59', revealMinute: 1130, availableUntilMinute: 1139, acquisition: 'presence',
    matches: always, body: ['獨立紀錄顯示設備回覆並不等於寫入權限已消失。', '若在斷線後再讀取它，才可能知道兩條 Bridge 是否真的失效。'],
    excerpts: [{ id: 'verify', text: '需要以獨立紀錄確認兩路寫入權限是否真的失效。' }] },

  { id: 'letter', title: '第七封信', source: '林知夏（信封署名）', formedAt: '郵戳：昨天', obtainedAt: '在返鄉列車上取出時', revealMinute: 0, acquisition: 'persistent', matches: always,
    body: ['不要回來。', '姊'],
    excerpts: [{ id: 'postmark', text: '郵戳是昨天的；署名是林知夏。' }, { id: 'warning', text: '不要回來。' }] },
  { id: 'yu-an-message', title: '予安的留言', source: '周予安／手機留言', formedAt: '18:00', obtainedAt: '18:00', revealMinute: 1080, acquisition: 'message', matches: always,
    body: ['我剛才在店門口碰到若晴。她說今晚要去舊車站，手裡拿著妳姊留下的信封。', '醫院的陳柏勳也問過她幾點會到。她看起來不想自己去。', '妳若想陪她，我可以先去醫院問問陳柏勳。18:20 前告訴我。'],
    excerpts: [{ id: 'plan', text: '若晴說今晚要去舊車站。' }, { id: 'doctor', text: '陳柏勳問過若晴幾點會到。' }] },
  { id: 'old-death', title: '五年前的事故摘要', source: '家中保存的舊案影本', formedAt: '五年前', obtainedAt: '打開案卷時', revealMinute: 0, acquisition: 'persistent', matches: always,
    body: ['姓名：林知夏。', '地點：舊車站附近。', '結案記載：意外。', '這張紙沒有記下當時誰先到場。'],
    excerpts: [{ id: 'death', text: '林知夏的死亡記載距今五年。' }, { id: 'verdict', text: '舊案以意外結案。' }] },
  { id: 'yuan-inspection-report', title: '予安的短訊', source: '周予安／自行回覆', formedAt: '18:28', obtainedAt: '18:28', revealMinute: 1108, acquisition: 'message',
    matches: history => history.some(x => x.kind === 'schedule' && x.scheduleEntryId === 'yuan_check_backup_if_available' && x.scheduleStatus === 'applied'),
    body: ['予安：銘牌下真的另有 Recovery 接口，但我還不敢說它通向哪裡。', '我可以陪妳繼續查，不代表我已經答應斷開設備。'],
    excerpts: [{ id: 'independent', text: '予安在場時確認 Recovery 接口，但未同意停用。' }] },
  { id: 'yuan-no-inspection', title: '予安沒有回覆', source: '通話紀錄／自行查看', formedAt: '18:28', obtainedAt: '18:28', revealMinute: 1108, acquisition: 'message',
    matches: history => history.some(x => x.kind === 'schedule' && x.scheduleEntryId === 'yuan_cannot_inspect_from_post_office' && x.scheduleStatus === 'applied'),
    body: ['予安正在郵局，無法同時到車站附近檢查備援線。', '要查就得再安排另一條世界線，沒有人能同時做兩件事情。'],
    excerpts: [{ id: 'absence', text: '予安的既有行程使這次查證沒有發生。' }] },
  { id: 'station-blackout', title: '車站的燈', source: '你當時聽見的聲音', formedAt: '18:31', obtainedAt: '18:31', revealMinute: 1111, availableUntilMinute: 1119, acquisition: 'presence', matches: history => history.some(x => x.kind === 'event' && x.eventId === 'evt_1831_station'),
    body: ['舊車站那一帶忽然暗了。', '停電只有幾秒。遠處傳來一聲鐘響。', '你還不知道月台上發生了什麼。'], spatialScript: stationBlackoutSpatial, excerpts: [{ id: 'time', text: '18:31，車站停電，鐘響了一聲。' }] },
  { id: 'station-bulletin-wakaharu', title: '車站通報', source: '鎮內公告', formedAt: '18:40', obtainedAt: '18:40', revealMinute: 1120, acquisition: 'message', matches: variant('wakaharu_dies'),
    body: ['舊車站發現許若晴死亡。', '18:31 是現場異常發生的時間；通報沒有提供精確死亡時間。'], excerpts: [{ id: 'victim', text: '舊車站發現許若晴死亡；18:31 並非醫療推定的死亡時間。' }] },
  { id: 'station-bulletin-doctor', title: '車站通報', source: '鎮內公告', formedAt: '18:40', obtainedAt: '18:40', revealMinute: 1120, acquisition: 'message', matches: variant('doctor_dies'),
    body: ['舊車站發現陳柏勳死亡。', '若晴已被帶離車站。公告沒有記下停電原因。'], excerpts: [{ id: 'victim', text: '這一輪，舊車站發現的是陳柏勳。' }] },
  { id: 'station-bulletin-none', title: '車站通報', source: '鎮內公告', formedAt: '18:40', obtainedAt: '18:40', revealMinute: 1120, acquisition: 'message', matches: variant('no_death'),
    body: ['停電後，車站裡沒有人死亡。', '有人聽見鐘響；鐘樓已經停了五年。'], excerpts: [{ id: 'outcome', text: '18:31 仍然停電，但這次沒有人死亡。' }] },
  { id: 'reporter-message', title: '予安的留言', source: '周予安', formedAt: '21:20', obtainedAt: '21:20', revealMinute: 1280, acquisition: 'message', matches: emitted,
    body: ['庭安失去聯絡了。她最後一次回訊息是在車站那邊出事以後。', '我還不知道她去了哪裡。明天我再去問。'], excerpts: [{ id: 'missing', text: '21:20，予安說葉庭安失去聯絡。' }] },
];

export const recordById = (id: string) => STORY_RECORDS.find(record => record.id === id);

export const staticPlayerRecords = (loop: number): PlayerNarrativeRecord[] =>
  STORY_RECORDS.map(record => ({ ...record, sceneId: record.id, loopId: loop }));
