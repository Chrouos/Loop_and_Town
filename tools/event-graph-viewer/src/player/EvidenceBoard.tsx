import { useState, type PointerEvent as ReactPointerEvent } from 'react';
import { addMemoryToWall, addPlayerNote, connectWallRefs, removeWallRef, unpinExcerpt } from './logic';
import { normalizeSave, type PlayerSave } from './model';
import { recordById } from './story';

type Props = { save: PlayerSave; onChange: (save: PlayerSave) => void; onNotice: (text: string) => void };

export function EvidenceBoard({ save, onChange, onNotice }: Props) {
  const [first, setFirst] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [noteText, setNoteText] = useState('');
  const [dragging, setDragging] = useState<{ ref: string; x: number; y: number; startX: number; startY: number } | null>(null);
  const refs = [...save.knowledge.pins, ...save.knowledge.wallRefs];
  const coords = (ref: string, index: number) => save.knowledge.positions[ref] ?? { x: 60 + (index % 3) * 260, y: 80 + Math.floor(index / 3) * 220 };
  const memoryFor = (ref: string) => save.knowledge.memories.find(memory => memory.id === ref);
  const refLabel = (ref: string) => {
    const memory = memoryFor(ref);
    if (memory) return memory.title;
    const [recordId, excerptId] = ref.split(':');
    return recordById(recordId)?.excerpts.find(excerpt => excerpt.id === excerptId)?.text ?? ref;
  };
  function connect(ref: string) {
    if (!first) return setFirst(ref);
    if (first === ref) return setFirst(null);
    const next = normalizeSave(save, save.lastConfirmedMs);
    connectWallRefs(next, first, ref);
    const key = [first, ref].sort().join('|');
    if (!next.knowledge.connections.includes(key)) next.knowledge.connections.push(key);
    onChange(next);
    setFeedback('已建立玩家連線；這不代表系統替你判定因果。');
    onNotice('已建立玩家連線。');
    setFirst(null);
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
  function remove(ref: string) {
    const next = normalizeSave(save, save.lastConfirmedMs);
    onChange(ref.startsWith('memory:') ? removeWallRef(next, ref) : unpinExcerpt(next, ref));
    setFirst(null);
  }
  function addNote() {
    const next = normalizeSave(save, save.lastConfirmedMs);
    addPlayerNote(next, noteText);
    onChange(next);
    setNoteText('');
  }
  const lines = save.knowledge.connections.map(connection => {
    const [a, b] = connection.split('#')[0].split('|');
    const i = refs.indexOf(a), j = refs.indexOf(b);
    if (i < 0 || j < 0) return null;
    const p = coords(a, i), q = coords(b, j);
    return <line key={connection} x1={p.x + 105} y1={p.y + 72} x2={q.x + 105} y2={q.y + 72} />;
  });
  return <div className="board-wrap">
    <p>記憶庫保存你捕捉到的片段。推理牆只記錄你自己放上去的記憶、連線與註記。</p>
    {feedback && <p role="status" className="board-feedback">{feedback}</p>}
    <section className="memory-library" aria-label="記憶庫">
      <h3>記憶庫</h3>
      {save.knowledge.memories.length ? save.knowledge.memories.map(memory => <div key={memory.id}>
        <strong>{memory.title}</strong><small>第 {memory.sourceLoop} 輪 · {memory.kind}</small>
        <p>{memory.content.join(' ')}</p>
        <button disabled={save.knowledge.wallRefs.includes(memory.id)} onClick={() => { const next = normalizeSave(save, save.lastConfirmedMs); onChange(addMemoryToWall(next, memory.id)); }}>放到推理牆</button>
      </div>) : <p>還沒有持久記憶。先在世界裡感知，再選擇捕捉。</p>}
    </section>
    <div className="board-canvas"><svg aria-hidden="true" className="evidence-lines" viewBox="0 0 1200 950">{lines}</svg>
      {refs.map((ref, i) => {
        const memory = memoryFor(ref);
        const [recordId, excerptId] = ref.split(':');
        const source = recordById(recordId);
        const excerpt = source?.excerpts.find(x => x.id === excerptId);
        const at = coords(ref, i);
        return <article key={ref} className={`evidence-card ${first === ref ? 'chosen' : ''}`} style={{ left: at.x, top: at.y }} onPointerDown={e => startDrag(e, ref, i)} onPointerMove={drag} onPointerUp={endDrag}>
          <small>{memory ? `第 ${memory.sourceLoop} 輪 · ${memory.kind}` : `${source?.source} ／ ${source?.formedAt}`}</small>
          <strong>{memory?.title ?? source?.title}</strong>
          <p>{memory ? memory.content.join(' ') : excerpt?.text}</p>
          <div><button onClick={() => connect(ref)}>連線</button><button onClick={() => remove(ref)}>移出</button></div>
          <span className="keyboard-move"><button aria-label={`向左移動${refLabel(ref)}`} onClick={() => move(ref, at.x - 20, at.y)}>←</button><button aria-label={`向右移動${refLabel(ref)}`} onClick={() => move(ref, at.x + 20, at.y)}>→</button><button aria-label={`向上移動${refLabel(ref)}`} onClick={() => move(ref, at.x, at.y - 20)}>↑</button><button aria-label={`向下移動${refLabel(ref)}`} onClick={() => move(ref, at.x, at.y + 20)}>↓</button></span>
        </article>;
      })}
      {!refs.length && <p className="board-empty">推理牆上還沒有內容。從記憶庫放入一段，或回到信件挑出句子。</p>}
    </div>
    <section className="wall-notes" aria-label="推理牆註記">
      <h3>玩家註記</h3>
      <textarea aria-label="推理牆註記" value={noteText} onChange={event => setNoteText(event.target.value)} placeholder="寫下你自己的問題或假設……" />
      <button onClick={addNote}>新增註記</button>
      {save.knowledge.notes.filter(note => note.source === 'player').map((note, index) => <p key={`${index}:${note.text}`}>{note.text}</p>)}
    </section>
    {!!save.knowledge.connections.length && <section className="board-connections"><h3>玩家連線</h3><p>連線只是你的思考痕跡，不是系統判定的矛盾或因果。</p>{save.knowledge.connections.map(connection => <p key={connection}>{connection.split('#')[0].split('|').map(refLabel).join(' ↔ ')}</p>)}</section>}
  </div>;
}
