// The shared vocabulary between scripts (story/*.yaml), the validator and the audio engine.
// Every id here must have a procedural implementation in sounds.ts / ambience.ts.

export const DIRECTIONS = ['front', 'front-right', 'right', 'back-right', 'back', 'back-left', 'left', 'front-left'] as const;
export type Direction = (typeof DIRECTIONS)[number];

export const DISTANCES = ['near', 'mid', 'far'] as const;
export type Distance = (typeof DISTANCES)[number];

export type SpatialPos = { dir: Direction | 'center'; dist: Distance };

// Angle in degrees, clockwise from front.
export const DIRECTION_ANGLE: Record<Direction, number> = {
  front: 0,
  'front-right': 45,
  right: 90,
  'back-right': 135,
  back: 180,
  'back-left': 225,
  left: 270,
  'front-left': 315,
};

export const SFX = {
  // people & movement
  step: '一步腳步聲（鞋底、硬地）',
  step_heels: '高跟或硬底鞋的腳步',
  step_run: '跑步的急促腳步',
  step_wet: '踩在濕地上的腳步',
  cane_tap: '白手杖點地',
  door_open: '門被打開',
  door_close: '門關上',
  door_creak: '老門軸的吱呀',
  door_slam: '門被用力甩上',
  shop_bell: '店門上的掛鈴',
  key_jingle: '一串鑰匙',
  lock_turn: '鑰匙轉動門鎖',
  chair_scrape: '椅子在地上拖動',
  drawer: '抽屜拉開',
  cloth_rustle: '衣物摩擦',
  huddle_rustle: '有人湊在一起講話：衣服摩擦、身體挪動（不出人聲）',
  gasp_crowd: '人群的驚呼',
  cough: '一聲咳嗽',
  sigh: '嘆氣',
  breath: '近距離的呼吸',
  laugh_soft: '輕笑',
  // the same three for men (予安, 陳醫生); the plain ids are women's
  sigh_m: '嘆氣（男聲）',
  breath_m: '近距離的呼吸（男聲）',
  laugh_soft_m: '輕笑（男聲）',
  kid_laugh: '小孩的笑聲',
  // objects
  paper_rustle: '紙張摩擦',
  page_turn: '翻頁',
  envelope: '信封被拿出／打開',
  pen_scratch: '筆在紙上寫',
  braille_stylus: '用點字板和點字筆打點字',
  cup_set: '瓷杯放在桌上',
  spoon_stir: '湯匙攪拌',
  coffee_grind: '磨豆機',
  steam_hiss: '咖啡機蒸汽',
  kettle: '水壺將滾',
  glass_clink: '玻璃杯碰撞',
  camera_shutter: '相機快門',
  strap_click: '相機背帶的金屬扣',
  watch_tick: '一只手錶的滴答（貼近耳朵）',
  clock_chime: '小座鐘報時',
  clock_wind: '轉動錶冠上發條',
  tools_clink: '小金屬工具碰撞',
  box_open: '盒蓋打開',
  box_close: '小金屬盒蓋扣上',
  umbrella: '撐開雨傘',
  lighter: '打火機',
  typing: '鍵盤打字',
  phone_buzz: '手機震動',
  phone_notify: '手機通知音',
  phone_ring: '電話鈴響',
  phone_hangup: '電話掛斷的嘟聲',
  recorder_click: '老錄音機按鍵',
  tape_hiss: '磁帶底噪',
  tape_rewind: '磁帶倒轉',
  static_burst: '一陣雜訊',
  radio_noise: '收音機的雜訊與底噪',
  // town
  train_brake: '列車煞車',
  train_horn: '列車鳴笛',
  train_door: '列車車門開關',
  station_chime: '車站廣播前的提示音',
  car_pass: '汽車駛過',
  truck_pass_quiet: '幾乎無聲的電動貨車貼近駛過',
  truck_reverse: '貨車倒車警示音',
  bicycle_bell: '腳踏車鈴',
  ball_bounce: '皮球彈跳',
  construction_drill: '遠處施工電鑽',
  hammer: '敲擊',
  dog_bark: '狗叫',
  seagull: '海鷗',
  crow: '烏鴉',
  siren_far: '遠處警笛',
  bus_hiss: '公車煞車放氣',
  // weather
  rain_burst: '一陣驟雨',
  thunder_far: '遠雷',
  wind_gust: '一陣風',
  wave: '浪拍岸',
  // anomaly
  hum_rise: '低頻嗡鳴逐漸升高',
  hum_fall: '嗡鳴降下消失',
  light_buzz: '燈管滋滋作響',
  blackout: '電力瞬間中斷的悶響',
  power_up: '備援電源啟動',
  spark: '電火花',
  metal_crash: '金屬重物倒塌',
  thud: '重物落地的悶響',
  glass_break: '玻璃碎裂',
  relay_click: '繼電器跳動',
  bell_toll: '巨大的鐘聲（鐘樓）',
  bell_toll_far: '遠方的鐘聲',
  heartbeat: '心跳',
  tinnitus: '耳鳴',
  silence_drop: '所有環境聲突然被抽走',
  // diegetic interface
  memory_keep: '記住一句話時的輕聲',
  focus_shift: '轉向時的空氣聲',
  choice_appear: '準備開口的細微聲',
  title_tone: '標題的低音',
} as const;
export type SfxId = keyof typeof SFX;

export const AMBIENCE = {
  train_interior: '行駛中的列車車廂',
  platform: '小站月台：風、遠處廣播、零星腳步',
  street_morning: '早晨街道：鳥、遠車、店家拉鐵門',
  street_evening: '傍晚街道：歸家的車、遠處電視',
  town_square: '鐘樓廣場：開闊、鴿子、風',
  construction_far: '遠處施工',
  old_house: '久無人住的老屋：室內底噪、木頭偶爾作響',
  house_night: '夜晚的老屋：冰箱低鳴、窗外蟲聲',
  clock_shop: '鐘錶店：滿室不同步的滴答',
  cafe: '咖啡店：低語、杯盤、咖啡機',
  hospital: '醫院走廊：空調、遠處廣播、推車',
  police_office: '派出所：電扇、遠處電話、打字',
  library: '圖書館：安靜、翻頁、空調',
  old_station_hall: '廢棄舊車站大廳：空曠回聲、風、滴水',
  maintenance_tunnel: '維修通道：狹窄、低頻嗡鳴、滴水',
  research_facility: '舊研究所：伺服器低鳴、空調',
  rain: '戶外雨聲',
  rain_on_window: '雨打在窗上（室內）',
  sea_far: '遠處海浪',
  night_insects: '夜晚蟲鳴',
  wind_open: '開闊處的風',
  restaurant: '小餐館：油鍋、碗筷、電視',
  room_tone: '幾乎無聲的房間',
  tower_square_night: '夜晚鐘樓廣場：風、遠車、安靜',
} as const;
export type AmbienceId = keyof typeof AMBIENCE;

// Per-speaker "voice presence": a faint sound at the speaker's position while they talk.
export const VOICES = {
  me: { pitch: 210, breath: 0.4 },
  yuan: { pitch: 120, breath: 0.3 },
  ruoqing: { pitch: 240, breath: 0.45 },
  boxun: { pitch: 105, breath: 0.25 },
  tingan: { pitch: 190, breath: 0.35 },
  zhiyuan: { pitch: 95, breath: 0.3 },
  zhixia: { pitch: 220, breath: 0.5 },
  man: { pitch: 115, breath: 0.3 },
  woman: { pitch: 205, breath: 0.35 },
  child: { pitch: 300, breath: 0.4 },
  old_man: { pitch: 100, breath: 0.5 },
  old_woman: { pitch: 180, breath: 0.5 },
  announcer: { pitch: 160, breath: 0.2 },
  phone: { pitch: 0, breath: 0 },
} as const;
export type VoiceId = keyof typeof VOICES;

export const VIBRATIONS = {
  tap: [12],
  buzz: [70, 50, 70],
  thud: [140],
  crash: [220, 60, 320],
  heartbeat: [28, 120, 40],
  bell: [90],
  long: [600],
} as const;
export type VibrationId = keyof typeof VIBRATIONS;

export function isSfx(id: string): id is SfxId {
  return Object.prototype.hasOwnProperty.call(SFX, id);
}

export function isAmbience(id: string): id is AmbienceId {
  return Object.prototype.hasOwnProperty.call(AMBIENCE, id);
}

export function isDirection(value: string): value is Direction {
  return (DIRECTIONS as readonly string[]).includes(value);
}
