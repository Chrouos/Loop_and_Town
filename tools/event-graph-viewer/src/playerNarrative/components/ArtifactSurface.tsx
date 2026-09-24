import { useState } from 'react';
import type { ArtifactDefinition } from '../../narrative/types';

export type ArtifactSurfaceProps = {
  artifact: ArtifactDefinition;
  initiallyOpened?: boolean;
  onOpened?: () => void;
};

export function ArtifactSurface({ artifact, initiallyOpened = false, onOpened }: ArtifactSurfaceProps) {
  const [state, setState] = useState<'front' | 'back' | 'open'>(initiallyOpened ? 'open' : 'front');

  if (artifact.kind !== 'letter') {
    return (
      <section className="artifact-surface artifact-document">
        <div className="artifact-sheet">
          {artifact.content.map((line, index) => <p key={index}>{line}</p>)}
        </div>
      </section>
    );
  }

  function openLetter() {
    setState('open');
    onOpened?.();
  }

  return (
    <section className="artifact-surface" aria-label="信件">
      {state !== 'open' ? (
        <div className={`envelope-card envelope-${state}`}>
          <div className="envelope-face">
            {state === 'front' ? (
              <>
                <span className="envelope-small">灰潮鎮</span>
                <strong>林知夏</strong>
              </>
            ) : (
              <>
                <span className="postmark">灰潮郵局 · 昨日</span>
                <span className="envelope-small">沒有寄件地址</span>
              </>
            )}
          </div>
          {state === 'front' ? (
            <button className="artifact-action" type="button" onClick={() => setState('back')}>翻到背面</button>
          ) : (
            <button className="artifact-action" type="button" onClick={openLetter}>拆開信封</button>
          )}
        </div>
      ) : (
        <div className="letter-sheet">
          {artifact.content.map((line, index) => <p key={index}>{line}</p>)}
        </div>
      )}
    </section>
  );
}
