import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PlayerApp } from './PlayerApp';
import { PlayerEntryGate } from './PlayerEntryGate';
import { previewStorageForPath } from './previewStorage';
import './player.css';
import './perception.css';
import './spatialText.css';

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

const previewStorage = typeof window === 'undefined' ? undefined : previewStorageForPath(window.localStorage, window.location.pathname);

function PlayerEntrypoint() {
  const [entered, setEntered] = useState(false);
  return entered
    ? <PlayerApp storage={previewStorage} />
    : <PlayerEntryGate reducedMotion={prefersReducedMotion()} onEnter={() => setEntered(true)} />;
}

createRoot(document.getElementById('root')!).render(<PlayerEntrypoint />);
