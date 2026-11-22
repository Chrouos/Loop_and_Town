export const FONT_SIZES = {
  small: { label: '小', scale: 0.9 },
  normal: { label: '標準', scale: 1 },
  large: { label: '大', scale: 1.2 },
  extraLarge: { label: '特大', scale: 1.4 },
  // Up to twice the standard size (Xbox Accessibility Guideline 101); a phone-sized stage caps it (game.css --ts).
  huge: { label: '超大', scale: 1.7 },
  double: { label: '最大', scale: 2 },
} as const;
export type FontSize = keyof typeof FONT_SIZES;

/** Player settings used by new saves and as fallbacks for missing saved values. */
export const defaultSettings = {
  audio: true,
  volume: 0.8,
  ambience: 0.7,
  sfx: 0.85,
  voice: 0.65,
  vibration: true,
  reader: true,
  motion: true,
  soundLabels: true,
  textSpeed: 11,
  fontSize: 'normal',
  autoAdvance: true,
  fastHeard: false,
  untimedChoices: false,
} as const;

type StoryTypography = {
  fontFamily: string;
  fontSize: { minRem: number; vw: number; maxRem: number };
  lineHeight: number;
  animation: 'fade-in' | 'slide-right' | 'none';
  exitAnimation: 'fade-out' | 'none';
};

/** Display settings shared by the game screens. */
export const presentation = {
  version: 'v0.002.001_261122',
  reading: {
    minSpeed: 4,
    maxSpeed: 30,
    instantReadSpeed: 24,
    pacedMinSpeed: 1,
    pacedMaxSpeed: 60,
    pauseMs: {
      newRow: 1000,
      writtenBeat: 760, // … or |
      dash: 420,
      sentence: 1000, // 。！？
      comma: 650,
      list: 500, // 、；：
    },
    heardLineTimeScale: 0.35,
    heardPauseTimeScale: 0.5,
  },
  typography: {
    smallScreenScale: 1.4,
    story: {
      // LXGW WenKai TC / Grey Tide Pixel / Noto Sans CJK TC / GenWanMin2 TW
      fontFamily: 'LXGW WenKai TC',
      fontSize: { minRem: 1.32, vw: 2.65, maxRem: 1.84 }, // 最小 rem / 以 vw 表示的相對大小 / 最大 rem
      lineHeight: 1.85,
      animation: 'fade-in', // fade-in 逐字淡入 / slide-right 從左往右滑入 / none 按原字速顯示
      exitAnimation: 'fade-out', // fade-out 淡出 / none 直接消失
    } as StoryTypography,
    narrationScale: 0.88,
    phoneSizeRem: 1.25,
    phoneMaxPx: 32,

    phoneFace: 'Grey Tide Pixel', // 手機台詞、畫面右上角的時間和地點。
    stampFace: 'Noto Sans CJK TC', // 畫面中央的章節卡和場景卡，用於標題、時間和地點。
    interfaceFace: 'GenWanMin2 TW', // 設定選單、按鈕、聲音測試和記憶面板的標題。
  },
} as const;
