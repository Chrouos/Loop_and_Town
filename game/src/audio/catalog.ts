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
  drawer_catch: '抽屜卡住的一下',
  cloth_rustle: '衣物摩擦',
  huddle_rustle: '有人湊在一起講話：衣服摩擦、身體挪動（不出人聲）',
  gasp_crowd: '人群的驚呼',
  cough: '一聲咳嗽',
  sigh: '嘆氣',
  breath: '近距離的呼吸',
  laugh_soft: '輕笑（年輕女生）',
  laugh_soft_adult: '輕笑（成年女性）',
  // the same three for men (予安, 陳醫生); the plain ids are women's
  sigh_m: '嘆氣（男聲）',
  breath_m: '近距離的呼吸（男聲）',
  laugh_soft_m: '輕笑（年輕男生）',
  laugh_soft_adult_m: '輕笑（成年男性）',
  kid_laugh: '小孩的笑聲',
  // strangers talking, heard as voices without words (recordings, never a synthesized voice)
  murmur_w: '女人在說話，聽不清內容',
  murmur_m: '男人在說話，聽不清內容',
  murmur_old: '老人家在說話，聽不清內容',
  murmur_child: '小孩在說話，聽不清內容',
  whisper: '有人壓低聲音說話',
  crowd_walla: '一大群人同時在講話，人聲吵雜',
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
  stove_flame: '瓦斯爐開小火的嘶嘶聲',
  pipe_gurgle: '水流在水管裡冒泡、咕嚕作響',
  glass_clink: '玻璃杯碰撞',
  camera_shutter: '相機快門',
  strap_click: '相機背帶的金屬扣',
  watch_tick: '一只手錶的滴答（貼近耳朵）',
  clock_tick: '座鐘擺錘的一聲滴答',
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
  // Caption-synchronized environmental effects (also used by ambience layers).
  rail_clack: '列車輪軌接縫', cabin_rattle: '車廂行李架晃動',
  wood_creak: '木頭吱響', house_tick: '木頭輕響', bird_chirp: '麻雀鳴叫',
  pigeon_coo: '鴿子咕叫', wing_flutter: '鳥振翅', drip: '水滴落下',
  rain_drop_near: '雨滴落在近處', rain_tap_glass: '雨滴敲窗', drip_metal: '水滴敲鐵皮',
  cart_roll: '推車輪子滾動', monitor_beep: '機器提示音', shutter_roll: '拉起鐵捲門',
  chopsticks: '碗筷碰撞', wok: '鍋鏟碰炒鍋', hdd_seek: '硬碟讀寫',
  pipe_knock: '水管敲響', tower_groan: '鐘樓結構低鳴', metal_groan: '金屬吱響', fridge_click: '冰箱啟動輕響',
  plastic_crinkle: '塑膠包裝揉響', broom_sweep: '掃把掃地', water_splash: '潑水', chop_thud: '砧板剁切',
  car_horn: '短促汽車喇叭', fry_sizzle: '油鍋煎炒滋響', garbage_melody: '垃圾車音樂',
  fan_hum: '風扇與馬達低鳴', flush_water: '沖水', cat_meow: '貓叫', cricket_chirp: '蟋蟀鳴叫',
  gecko_click: '壁虎叫聲', mosquito_buzz: '蚊子飛近', frog_croak: '青蛙鳴叫', owl_hoot: '貓頭鷹叫聲',
  scanner_beep: '刷卡或掃碼提示', call_chime: '叫號提示音', elevator_ding: '電梯抵達提示',
  photocopier: '影印機運轉', icecream_horn: '叭噗車喇叭', can_rattle: '空罐滾動', skate_roll: '滑板滾動',
  branch_snap: '樹枝折響', boat_engine: '漁船引擎', ship_horn: '船笛', mouse_squeak: '老鼠吱叫',
  air_flow: '空調送風', power_saw: '電鋸切割', excavator: '怪手作業', water_rush: '排水流動',
  leaf_rustle: '枯葉與草叢摩擦', fabric_flap: '旗布拍打', wire_whistle: '風吹電線',
  pebble_roll: '石頭隨水滾動', metal_rattle: '鬆動鐵皮碰撞',
} as const;
export type SfxId = keyof typeof SFX;

/**
 * What she would say the sound is, in two to four characters: the small caption under the
 * onomatopoeia, so 沙沙 can be told apart as paper, cloth or a pen. A script line can override it
 * with `src:`. Missing ids (interface sounds, her own heart) get no caption.
 */
export const SFX_SOURCE: Partial<Record<SfxId, string>> = {
  step: '腳步', step_heels: '硬底鞋', step_run: '有人在跑', step_wet: '踩水', cane_tap: '手杖',
  door_open: '開門', door_close: '關門', door_creak: '老門', door_slam: '甩門', shop_bell: '門鈴',
  key_jingle: '鑰匙', lock_turn: '門鎖', chair_scrape: '拖椅子', drawer: '抽屜', drawer_catch: '抽屜', cloth_rustle: '衣服',
  huddle_rustle: '有人湊近', gasp_crowd: '人群', cough: '咳嗽', sigh: '嘆氣', breath: '呼吸',
  laugh_soft: '笑聲', laugh_soft_adult: '笑聲', sigh_m: '嘆氣', breath_m: '呼吸', laugh_soft_m: '笑聲',
  laugh_soft_adult_m: '笑聲', kid_laugh: '小孩',
  murmur_w: '有人在聊天', murmur_m: '有人在聊天', murmur_old: '有人在聊天', murmur_child: '小孩在講話',
  whisper: '有人小聲說話', crowd_walla: '人聲吵雜',
  paper_rustle: '紙', page_turn: '翻頁', envelope: '信封', pen_scratch: '寫字', braille_stylus: '點字筆',
  cup_set: '杯子', spoon_stir: '湯匙', coffee_grind: '磨豆機', steam_hiss: '蒸汽', kettle: '水壺', stove_flame: '爐火',
  pipe_gurgle: '水管',
  glass_clink: '玻璃杯', camera_shutter: '快門', strap_click: '背帶扣', watch_tick: '手錶', clock_tick: '座鐘',
  clock_chime: '座鐘', clock_wind: '上發條', tools_clink: '工具', box_open: '盒子', box_close: '盒蓋',
  umbrella: '雨傘', lighter: '打火機', typing: '鍵盤', phone_buzz: '手機', phone_notify: '通知',
  phone_ring: '電話', phone_hangup: '掛斷', recorder_click: '錄音機', tape_hiss: '錄音帶', tape_rewind: '倒帶',
  static_burst: '雜訊', radio_noise: '收音機',
  train_brake: '煞車', train_horn: '鳴笛', train_door: '車門', station_chime: '廣播', car_pass: '車子',
  truck_pass_quiet: '貨車', truck_reverse: '倒車', bicycle_bell: '腳踏車', ball_bounce: '皮球',
  construction_drill: '施工', hammer: '敲打', dog_bark: '狗', seagull: '海鷗', crow: '烏鴉',
  siren_far: '警笛', bus_hiss: '公車',
  rain_burst: '驟雨', thunder_far: '打雷', wind_gust: '風', wave: '海浪',
  hum_rise: '嗡鳴', hum_fall: '嗡鳴', light_buzz: '燈管', blackout: '斷電', power_up: '來電',
  spark: '火花', metal_crash: '鐵架倒下', thud: '重物', glass_break: '玻璃', relay_click: '繼電器',
  bell_toll: '鐘樓', bell_toll_far: '遠處的鐘', tinnitus: '耳鳴',
  rail_clack: '鐵軌', cabin_rattle: '行李架', wood_creak: '木頭', house_tick: '木頭',
  bird_chirp: '麻雀', pigeon_coo: '鴿子', wing_flutter: '翅膀', drip: '滴水',
  rain_drop_near: '雨滴', rain_tap_glass: '雨打窗', drip_metal: '鐵皮滴水',
  cart_roll: '推車', monitor_beep: '機器', shutter_roll: '鐵捲門', chopsticks: '碗筷', wok: '炒鍋',
  hdd_seek: '硬碟', pipe_knock: '水管', tower_groan: '鐘樓', metal_groan: '金屬', fridge_click: '冰箱',
  plastic_crinkle: '包裝袋', broom_sweep: '掃地', water_splash: '潑水', chop_thud: '砧板',
  car_horn: '喇叭', fry_sizzle: '油鍋', garbage_melody: '垃圾車', fan_hum: '風扇', flush_water: '沖水',
  cat_meow: '貓', cricket_chirp: '蟋蟀', gecko_click: '壁虎', mosquito_buzz: '蚊子', frog_croak: '青蛙', owl_hoot: '貓頭鷹',
  scanner_beep: '掃碼', call_chime: '叫號', elevator_ding: '電梯', photocopier: '影印機', icecream_horn: '叭噗車',
  can_rattle: '空罐子', skate_roll: '滑板', branch_snap: '樹枝', boat_engine: '漁船', ship_horn: '船笛',
  mouse_squeak: '老鼠', air_flow: '空調', power_saw: '電鋸', excavator: '怪手', water_rush: '排水',
  leaf_rustle: '枯葉', fabric_flap: '旗子', wire_whistle: '電線', pebble_roll: '石頭', metal_rattle: '鐵皮',
};

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
/** What a voice comes through when it is not a person beside her: the sound is the device's, never a voice. */
export const VIAS = ['speaker', 'radio', 'tv', 'tape', 'phone'] as const;
export type Via = (typeof VIAS)[number];

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
