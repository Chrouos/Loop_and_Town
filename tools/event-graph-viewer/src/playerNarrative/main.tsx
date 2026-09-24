import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { loadSimulationStory, type StoryBundle } from '../lib/loadSimulationStory';
import { PlayerNarrativeApp } from './PlayerNarrativeApp';
import './playerNarrative.css';

function Bootstrap() {
  const [story, setStory] = useState<StoryBundle | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSimulationStory('story/manifests/loop_01.yaml')
      .then(setStory)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason)));
  }, []);

  if (error) return <main className="player-narrative-shell"><section className="quiet-surface">故事資料載入失敗：{error}</section></main>;
  if (!story) return <main className="player-narrative-shell"><section className="quiet-surface">回到灰潮鎮……</section></main>;
  return <PlayerNarrativeApp story={story} />;
}

createRoot(document.getElementById('root')!).render(<Bootstrap />);
