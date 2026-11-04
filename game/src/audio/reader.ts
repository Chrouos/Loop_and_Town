// Her phone's screen reader, out loud. This is the one voice in the game that is synthesized on purpose: the
// reader really is a synthesized voice, flat and quick, and it reads the time of a death the same way it reads
// an alarm. Only Mandarin voices are used; with none on the device the phone stays at its tick.

export interface ScreenReader {
  /** Inside a user gesture: iOS only lets speech start after one. */
  prime(): void;
  speak(text: string, volume: number): void;
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

/** What is on screen, minus marks that are for the eye: phrase breaks, ellipses read as a pause anyway. */
export function readable(text: string): string {
  return text.replace(/\|/g, '').replace(/[「」『』]/g, '').trim();
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
    speak(text, volume) {
      if (!s) return;
      if (!voice) findVoice();
      if (!voice) return;
      const words = readable(text);
      if (!words) return;
      try {
        s.cancel();
        const u = new SpeechSynthesisUtterance(words);
        u.voice = voice;
        u.lang = voice.lang;
        u.rate = RATE;
        u.pitch = 1;
        u.volume = Math.max(0, Math.min(1, volume));
        current = u;
        u.onend = () => { if (current === u) current = null; };
        s.speak(u);
      } catch { /* a broken voice must never break the game */ }
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
