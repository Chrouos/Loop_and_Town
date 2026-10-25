import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GameApp } from './GameApp';

// Wait for the text face before the first frame so nothing is drawn in a fallback and then swapped.
// A slow network still gets the game after a few seconds, in whatever font is there.
const fontReady = Promise.race([
  document.fonts?.load('1em Iansui').catch(() => undefined),
  new Promise((resolve) => setTimeout(resolve, 4000)),
]);

void fontReady.then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <GameApp />
    </StrictMode>,
  );
});
