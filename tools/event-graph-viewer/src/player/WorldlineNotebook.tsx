import { useState } from 'react';
import { visibleRecords } from './knowledge';
import type { KnownDiff } from './logic';
import type { PlayerSave } from './model';

export function WorldlineNotebook({ save, currentLoop, knownDiff }: { save: PlayerSave; currentLoop: number; knownDiff: (save: PlayerSave, a: number, b: number) => KnownDiff }) {
  const [left, setLeft] = useState(Math.max(1, currentLoop - 1));
  const [right, setRight] = useState(currentLoop);
  const loops = Array.from({ length: Math.min(currentLoop, 30) }, (_, i) => Math.max(1, currentLoop - 29) + i);
  const diff = knownDiff(save, left, right);
  const actions = (loop: number) => {
    const ids = save.loops[loop]?.actionIds ?? [];
    if (!ids.length) return '沒有留下介入紀錄';
    return ids.map(id => id === 'protect_wakaharu' ? '你陪若晴留在家' : '你請予安留住醫生').join('；');
  };
  return <div className="worldlines"><p>只比較你拿到的紀錄。空白的地方，鎮上可能已經發生了事，只是你還不知道。</p>
    <div className="worldline-select"><label>左邊 <select value={left} onChange={e => setLeft(Number(e.target.value))}>{loops.map(n => <option key={n} value={n}>第 {n} 次今天</option>)}</select></label><label>右邊 <select value={right} onChange={e => setRight(Number(e.target.value))}>{loops.map(n => <option key={n} value={n}>第 {n} 次今天</option>)}</select></label></div>
    <div className="worldline-pair"><section><small>第 {left} 次</small><p>當時：{actions(left)}</p><strong>{diff.left}</strong><p>{visibleRecords(save, left).some(r => r.id === 'reporter-message') ? '21:20：予安說庭安失去聯絡' : '21:14：尚未查到消息'}</p></section><section><small>第 {right} 次</small><p>當時：{actions(right)}</p><strong>{diff.right}</strong><p>{visibleRecords(save, right).some(r => r.id === 'reporter-message') ? '21:20：予安說庭安失去聯絡' : '21:14：尚未查到消息'}</p></section></div>
    {diff.candidateInvariant && <p className="invariant">{diff.candidateInvariant}</p>}
  </div>;
}
