import { useState, type PointerEvent as ReactPointerEvent } from 'react';
import { claimsFor, judgeLink, unpinExcerpt } from './logic';
import { normalizeSave, type PlayerSave } from './model';
import { recordById } from './story';

type Props = { save: PlayerSave; onChange: (save: PlayerSave) => void; onNotice: (text: string) => void };

export function EvidenceBoard({ save, onChange, onNotice }: Props) {
  const [first, setFirst] = useState<string | null>(null);
  const [pair, setPair] = useState<[string, string] | null>(null);
  const [feedback, setFeedback] = useState('');
  const [dragging, setDragging] = useState<{ ref: string; x: number; y: number; startX: number; startY: number } | null>(null);
  const coords = (ref: string, index: number) => save.knowledge.positions[ref] ?? { x: 60 + (index % 3) * 260, y: 80 + Math.floor(index / 3) * 220 };
  function connect(ref: string) {
    if (!first) return setFirst(ref);
    if (first === ref) return setFirst(null);
    setPair([first, ref]); setFirst(null);
  }
  function move(ref: string, x: number, y: number) {
    const next = normalizeSave(save, save.lastConfirmedMs);
    next.knowledge.positions[ref] = { x: Math.max(0, Math.min(1000, x)), y: Math.max(0, Math.min(750, y)) };
    onChange(next);
  }
  function startDrag(e: ReactPointerEvent<HTMLElement>, ref: string, index: number) {
    if ((e.target as HTMLElement).closest('button')) return;
    const at = coords(ref, index);
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging({ ref, x: at.x, y: at.y, startX: e.clientX, startY: e.clientY });
  }
  function drag(e: ReactPointerEvent<HTMLElement>) {
    if (!dragging) return;
    const x = dragging.x + e.clientX - dragging.startX, y = dragging.y + e.clientY - dragging.startY;
    e.currentTarget.style.left = `${Math.max(0, x)}px`; e.currentTarget.style.top = `${Math.max(0, y)}px`;
  }
  function endDrag(e: ReactPointerEvent<HTMLElement>) {
    if (!dragging) return;
    move(dragging.ref, dragging.x + e.clientX - dragging.startX, dragging.y + e.clientY - dragging.startY);
    setDragging(null);
  }
  const lines = save.knowledge.connections.map(connection => {
    const [a, b] = connection.split('#')[0].split('|');
    const i = save.knowledge.pins.indexOf(a), j = save.knowledge.pins.indexOf(b);
    if (i < 0 || j < 0) return null;
    const p = coords(a, i), q = coords(b, j);
    return <line key={connection} x1={p.x + 105} y1={p.y + 72} x2={q.x + 105} y2={q.y + 72} />;
  });
  return <div className="board-wrap"><p>留下真正需要比對的句子。選兩張「連線」，再判斷它們能支持什麼說法。</p>{feedback && <p role="status" className="board-feedback">{feedback}</p>}
    <div className="board-canvas"><svg aria-hidden="true" className="evidence-lines" viewBox="0 0 1200 950">{lines}</svg>
      {save.knowledge.pins.map((ref, i) => {
        const [recordId, excerptId] = ref.split(':'); const source = recordById(recordId);
        const excerpt = source?.excerpts.find(x => x.id === excerptId); const at = coords(ref, i);
        return <article key={ref} className={`evidence-card ${first === ref ? 'chosen' : ''}`} style={{ left: at.x, top: at.y }} onPointerDown={e => startDrag(e, ref, i)} onPointerMove={drag} onPointerUp={endDrag}>
          <small>{source?.source} ／ {source?.formedAt}</small><p>{excerpt?.text}</p><div><button onClick={() => connect(ref)}>連線</button><button onClick={() => { const next = normalizeSave(save, save.lastConfirmedMs); onChange(unpinExcerpt(next, ref)); setPair(null); }}>移出</button></div>
          <span className="keyboard-move"><button aria-label={`向左移動${source?.title}`} onClick={() => move(ref, at.x - 20, at.y)}>←</button><button aria-label={`向右移動${source?.title}`} onClick={() => move(ref, at.x + 20, at.y)}>→</button><button aria-label={`向上移動${source?.title}`} onClick={() => move(ref, at.x, at.y - 20)}>↑</button><button aria-label={`向下移動${source?.title}`} onClick={() => move(ref, at.x, at.y + 20)}>↓</button></span>
        </article>;
      })}
      {!save.knowledge.pins.length && <p className="board-empty">推理桌上還沒有文字。回到信件，挑出值得留下的那句。</p>}
    </div>
    {pair && <div className="claim-panel"><p>這兩句話能讓你確定什麼？</p>{claimsFor(...pair).length ? claimsFor(...pair).map(claim => <button key={claim.id} onClick={() => { const next = normalizeSave(save, save.lastConfirmedMs); const result = judgeLink(next, pair[0], pair[1], claim.id); onChange(result.save); setFeedback(result.feedback); onNotice(result.feedback); setPair(null); }}>{claim.text}</button>) : <p>這兩份紀錄之間還缺一段可核對的資料。</p>}<button onClick={() => setPair(null)}>先不下結論</button></div>}
    {!!save.knowledge.connections.length && <div className="board-conclusions"><h3>目前可以支持的說法</h3>{save.knowledge.connections.map(c => <p key={c}>{c.endsWith('letter-after-death') ? '這封信是在姊姊死亡紀錄之後投遞的。交件人仍未知。' : '18:31 仍有異常，但這次沒有人死亡。'}</p>)}</div>}
  </div>;
}
