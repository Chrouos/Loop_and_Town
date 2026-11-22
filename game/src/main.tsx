import { presentation } from './presentation.config';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GameApp } from './GameApp';

// Wait for every voice's face before the first frame so nothing is drawn in a fallback and then swapped
// (the story's hand, a screen, the cards, the menus: game.css). A slow network still gets the game
// after a few seconds, in whatever fonts are there.
const { story, phoneFace, stampFace, interfaceFace } = presentation.typography;
const FACES = [story.fontFamily, phoneFace, stampFace, interfaceFace];
const fontReady = Promise.race([
  Promise.all(FACES.map((face) => document.fonts?.load(`1em "${face}"`).catch(() => undefined))),
  new Promise((resolve) => setTimeout(resolve, 4000)),
]);

void fontReady.then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <GameApp />
    </StrictMode>,
  );
});
