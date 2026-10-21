export type EntryWindow = 'dawn' | 'morning' | 'afternoon' | 'evening' | 'post-convergence' | 'late-night';

export function entryWindowFor(minute: number): EntryWindow {
  if (minute < 9 * 60) return 'dawn';
  if (minute < 12 * 60) return 'morning';
  if (minute < 16 * 60) return 'afternoon';
  if (minute < 18 * 60 + 31) return 'evening';
  if (minute < 22 * 60) return 'post-convergence';
  return 'late-night';
}

// Shown when nothing new has reached the protagonist for a while: the town keeps moving without a scene.
export function idleLine(window: EntryWindow): string {
  const lines: Record<EntryWindow, string> = {
    dawn: '鎮上的人還沒醒，只有海風在動。',
    morning: '鎮上的人各自走向今天的行程。',
    afternoon: '午後的灰潮鎮看起來和平常一樣，細節卻有些錯位。',
    evening: '傍晚的風從舊車站方向吹來，帶著還沒發生的消息。',
    'post-convergence': '停電之後，鎮上的低語一直沒有停。',
    'late-night': '鐘聲之前，灰潮鎮只剩下最後一段可以改寫的時間。',
  };
  return lines[window];
}

export function entryPresentation(window: EntryWindow): { label: string; lines: string[] } {
  const presentations: Record<EntryWindow, { label: string; lines: string[] }> = {
    dawn: { label: '清晨', lines: ['返程列車剛進站，灰潮鎮還沒有完全醒來。'] },
    morning: { label: '上午', lines: ['鎮上的人已經開始各自走向今天的行程。'] },
    afternoon: { label: '午後', lines: ['午後的灰潮鎮看起來和平常一樣，細節卻有些錯位。'] },
    evening: { label: '傍晚', lines: ['傍晚的風從舊車站方向吹來，帶著還沒發生的消息。'] },
    'post-convergence': { label: '停電之後', lines: ['你抵達時，舊車站的異常已經成為鎮上的低語。'] },
    'late-night': { label: '深夜', lines: ['鐘聲之前，灰潮鎮只剩下最後一段可以改寫的時間。'] },
  };
  return presentations[window];
}
