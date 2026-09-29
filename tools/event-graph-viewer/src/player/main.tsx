import { createRoot } from 'react-dom/client';
import { PlayerApp } from './PlayerApp';
import './player.css';
import './perception.css';
import './spatialText.css';

createRoot(document.getElementById('root')!).render(<PlayerApp />);
