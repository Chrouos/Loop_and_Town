import { useState } from 'react';
import { splitNarrationPages } from './NarrationBeatPager';
import type { ArtifactDefinition } from '../../narrative/types';

export type ArtifactSurfaceProps = {
  artifact: ArtifactDefinition;
  initiallyOpened?: boolean;
  onOpened?: () => void;
};

export function ArtifactSurface({ artifact, initiallyOpened = false, onOpened }: ArtifactSurfaceProps) {
  const [state, setState] = useState<'front' | 'back' | 'open'>(initiallyOpened ? 'open' : 'front');
  const [page, setPage] = useState(0);
  const pages = splitNarrationPages(artifact.content.join('\n\n'), 90);
  const sheet = <div className="letter-sheet artifact-paged-sheet" aria-label="文件內容">
    <p>{pages[Math.min(page, pages.length - 1)]}</p>
    {pages.length > 1 && <nav className="artifact-page-controls" aria-label="文件分頁">
      <button type="button" disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹ 上頁</button>
      <span>{page + 1} / {pages.length}</span>
      <button type="button" disabled={page === pages.length - 1} onClick={() => setPage(p => p + 1)}>下頁 ›</button>
    </nav>}
  </div>;

  if (artifact.kind !== 'letter') {
    return (
      <section className="artifact-surface artifact-document">
        {sheet}
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
        sheet
      )}
    </section>
  );
}
