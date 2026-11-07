// Her phone's screen reader, out loud. This is the one voice in the game that is synthesized on purpose: the
// reader really is a synthesized voice, flat and quick, and it reads the time of a death the same way it reads
// an alarm. Only Mandarin voices are used; with none on the device the phone stays at its tick.

export interface ScreenReader {
  /** Inside a user gesture: iOS only lets speech start after one. Safe to call on every gesture (once is enough). */
  prime(): void;
  /**
   * Read `text` at `volume` (0..1, already shaped by the sliders). Returns whether a voice took it; `onEnd` runs
   * when it finishes, fails or is cut off.
   */
  speak(text: string, volume: number, onEnd?: () => void): boolean;
  setVolume(volume: number): void;
  stop(): void;
}

/** Screen-reader users listen fast; a little quicker than a person, still clear. */
const RATE = 1.2;

function synth(): SpeechSynthesis | null {
  try {
    return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
  } catch {
    return null;
  }
}

/** zh-TW first; a Mandarin voice from elsewhere reads Traditional characters too. Cantonese (zh-HK) would not. */
function pickVoice(s: SpeechSynthesis): SpeechSynthesisVoice | null {
  const voices = s.getVoices();
  const lang = (v: SpeechSynthesisVoice) => v.lang.replace('_', '-').toLowerCase();
  return voices.find((v) => lang(v) === 'zh-tw')
    ?? voices.find((v) => lang(v).startsWith('zh-hant') || /taiwan|台灣/i.test(v.name))
    ?? voices.find((v) => lang(v) === 'zh-cn' || lang(v).startsWith('cmn') || lang(v).startsWith('zh-hans'))
    ?? null;
}

/**
 * The lines her phone reads at full level; everything else (a message, the time on an ordinary hour) it reads
 * quietly, a sound in the room. The 18:00 hour (18:03 five years ago, the count to 18:31), a heart rate too high,
 * a death, 119, and the day running out at midnight. A script line's `loud:` overrides this either way.
 */
const MATTERS = [/十八點/, /心率/, /死亡/, /一一九|一，一，九/, /二十三點五十九分|零點零分/];

export function phoneMatters(text: string): boolean {
  const words = readable(text);
  return MATTERS.some((pattern) => pattern.test(words));
}

/** What is on screen, minus marks that are for the eye: phrase breaks, ellipses read as a pause anyway. */
export function readable(text: string): string {
  return text.replace(/\|/g, '').replace(/[「」『』]/g, '').trim();
}

type ReaderManifest = {
  lines: Record<string, string>;
  templates: readonly { before: string; after: string; clips: readonly [string, string] }[];
  numbers: Record<number, string>;
};

/**
 * The pre-rendered clips that read this line, in order (paths under public/audio/), or null when the line has none
 * and the device's own voice has to read it. A line with a number in it is the words before, the number, the words after.
 */
export function readerClipsFor(text: string, manifest: ReaderManifest): string[] | null {
  const words = readable(text);
  if (!words) return null;
  const whole = manifest.lines[words];
  if (whole) return [whole];
  for (const t of manifest.templates) {
    if (!words.startsWith(t.before) || !words.endsWith(t.after) || words.length <= t.before.length + t.after.length) continue;
    const middle = words.slice(t.before.length, words.length - t.after.length).trim();
    const number = /^\d+$/.test(middle) ? manifest.numbers[Number(middle)] : undefined;
    if (number) return [t.clips[0], number, t.clips[1]].filter((clip) => clip !== '');
  }
  return null;
}

export function createScreenReader(): ScreenReader {
  const s = synth();
  let voice: SpeechSynthesisVoice | null = null;
  let current: SpeechSynthesisUtterance | null = null;
  let primed = false;
  const findVoice = () => { if (s) voice = pickVoice(s); };
  if (s) {
    findVoice();
    try { s.addEventListener?.('voiceschanged', findVoice); } catch { /* older engines */ }
  }
  return {
    prime() {
      if (!s || primed) return;
      primed = true;
      try {
        const u = new SpeechSynthesisUtterance(' ');
        u.volume = 0;
        s.speak(u);
      } catch { /* ignore */ }
    },
    speak(text, volume, onEnd) {
      if (!s) return false;
      if (!voice) findVoice();
      if (!voice) return false;
      const words = readable(text);
      const level = Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 0));
      if (!words || level <= 0) return false;
      try {
        s.cancel();
        const u = new SpeechSynthesisUtterance(words);
        u.voice = voice;
        u.lang = voice.lang;
        u.rate = RATE;
        u.pitch = 1;
        u.volume = level;
        current = u;
        let ended = false;
        const end = (): void => {
          if (current === u) current = null;
          if (ended) return;
          ended = true;
          onEnd?.();
        };
        u.onend = end;
        u.onerror = end;
        s.speak(u);
        return true;
      } catch {
        return false; // a broken voice must never break the game
      }
    },
    setVolume(volume) {
      // An utterance cannot change volume once started; the next one picks it up.
      if (current) current.volume = Math.max(0, Math.min(1, volume));
    },
    stop() {
      current = null;
      try { s?.cancel(); } catch { /* ignore */ }
    },
  };
}
