import { useCallback, useEffect, useRef, useState } from 'react';
import { loadSimulationStory } from '../lib/loadSimulationStory';
import type { SimulationDefinition, WorldState } from '../simulator/types';
import { displayMinute, timeAt } from './clock';
import { reconcilePlayer, visibleRecords } from './knowledge';
import { knownDiff, pinExcerpt } from './logic';
import { normalizeSave, type ActionId, type PlayerSave } from './model';
import { confirmAction } from './runtime';
import { LEGACY_KEY, exportSave, importLegacy, readSave, writeSave } from './storage';
import { EvidenceBoard } from './EvidenceBoard';
import { WorldlineNotebook } from './WorldlineNotebook';
import { recordById } from './story';

type Story = { definition: SimulationDefinition; initialState: WorldState };
type Props = { now?: () => number; storage?: Storage; loadStory?: () => Promise<Story> };
type Drawer = 'case' | 'board' | 'worldlines' | 'save' | null;

export function PlayerApp({ now = Date.now, storage = window.localStorage, loadStory = loadSimulationStory }: Props) {
  const [save, setSave] = useState<PlayerSave>(() => readSave(storage, now()));
  const [story, setStory] = useState<Story | null>(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [selected, setSelected] = useState('letter');
  const [importText, setImportText] = useState('');
  const [exporting, setExporting] = useState(false);
  const [currentMs, setCurrentMs] = useState(() => now());
  const opener = useRef<HTMLButtonElement | null>(null);

  const commit = useCallback((next: PlayerSave) => { const copy = normalizeSave(next, now()); setSave(copy); writeSave(storage, copy); }, [now, storage]);
  const refresh = useCallback((data: Story) => {
    const time = now();
    setCurrentMs(time);
    const next = reconcilePlayer(readSave(storage, time), time, data.definition, data.initialState);
    commit(next);
  }, [now, storage, commit]);

  useEffect(() => {
    let mounted = true;
    loadStory().then(data => { if (mounted) { setStory(data); refresh(data); } }).catch(e => { if (mounted) setError(e instanceof Error ? e.message : String(e)); });
    return () => { mounted = false; };
  }, [loadStory, refresh]);
  useEffect(() => {
    if (!story) return;
    const timer = window.setInterval(() => refresh(story), 15000);
    const visible = () => { if (!document.hidden) refresh(story); };
    const changed = () => refresh(story);
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('storage', changed);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', visible); window.removeEventListener('storage', changed); };
  }, [story, refresh]);
  useEffect(() => {
    if (!drawer) return;
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawer(null); };
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('keydown', close); opener.current?.focus(); };
  }, [drawer]);

  const clock = timeAt(save.anchorMs, Math.max(currentMs, save.lastConfirmedMs));
  const records = visibleRecords(save, clock.loop);
  const opened = save.knowledge.opened.includes('1:letter') || save.knowledge.opened.includes('letter');
  const record = records.find(x => x.id === selected) ?? records[0];
  const hasAction = (id: ActionId) => save.loops[clock.loop]?.actionIds.includes(id) ?? false;
  const canAct = clock.minute < 1100;
  const next = clock.minute < 1100 ? '18:20 前，你還能改變今晚的行程' : clock.minute < 1111 ? '18:31，舊車站' : clock.minute < 1120 ? '等候鎮上的通報' : clock.minute < 1280 ? '21:20，予安說會再聯絡' : '午夜，日期會回到今天';

  function showDrawer(value: Drawer, target?: HTMLButtonElement) { opener.current = target ?? null; setDrawer(value); setNote(''); }
  function choose(id: ActionId) {
    try { const nextSave = normalizeSave(save, now()); confirmAction(nextSave, id, now()); commit(nextSave); setNote(id === 'protect_wakaharu' ? '你答應在若晴出門前陪她留在家裡。' : '你請予安先到醫院，設法留住陳柏勳。'); }
    catch (e) { setNote(e instanceof Error ? e.message : String(e)); }
  }
  function openRecord(id: string) {
    const nextSave = normalizeSave(save, now());
    const readKey = `${clock.loop}:${id}`;
    if (!nextSave.knowledge.opened.includes(readKey)) nextSave.knowledge.opened.push(readKey);
    commit(nextSave); setSelected(id); setDrawer(null);
  }
  function pin(ref: string) {
    try { const nextSave = normalizeSave(save, now()); pinExcerpt(nextSave, ref); commit(nextSave); setNote('已放在推理桌上。'); }
    catch (e) { setNote(e instanceof Error ? e.message : String(e)); }
  }
  function importSave() {
    const nextSave = importLegacy(importText, normalizeSave(save, now()));
    commit(nextSave); setNote(nextSave === save ? '無法讀取這份存檔。' : '存檔已匯入；舊案卷的結論只作為個人筆記。');
    if (story) refresh(story);
  }

  return <div className="player-shell">
    <header className="player-header"><div className="wordmark">灰潮鎮 <span>／ 第七封信</span></div><div className="header-actions"><span className="town-time">鎮內 {displayMinute(clock.minute)}</span><button onClick={e => showDrawer('case', e.currentTarget)}>案卷 <i>{records.length}</i></button><button onClick={e => showDrawer('board', e.currentTarget)}>推理桌</button><button onClick={e => showDrawer('worldlines', e.currentTarget)}>世界線</button><button onClick={e => showDrawer('save', e.currentTarget)}>存檔</button></div></header>
    <main className="player-stage">
      {error ? <p role="alert">無法讀取鎮上的紀錄：{error}</p> : !story ? <p>正在取出案卷……</p> : !opened ? <div className="opening"><p>你回到灰潮鎮時，信已經躺在門縫裡。</p><p>信封沒有寄件地址。郵戳是昨天的。</p><p>寄件人那一欄，寫著林知夏。</p><p>她五年前就死了。</p><button className="envelope-button" onClick={() => openRecord('letter')} aria-label="拆開信封，讀姊姊的信"><span className="envelope" aria-hidden="true"><span className="envelope-flap"/><span className="envelope-name">林知夏　寄</span></span><span className="envelope-action">拆開信封</span></button></div> : <div className="reading-scene" key={`${clock.loop}:${record?.id}`}>
        <div className="document-top"><span>第 {clock.loop} 次今天</span><span>{record?.source}　／　{record?.formedAt}</span></div>
        <h1>{record?.title}</h1>
        <div className="document-lines">{record?.body.map((line, i) => <p key={i}>{line}</p>)}</div>
        {record?.excerpts.length ? <div className="excerpts"><span>留下你認為重要的句子</span>{record.excerpts.map(part => <button key={part.id} onClick={() => pin(`${record.id}:${part.id}`)}>{part.text}<span>＋</span></button>)}</div> : null}
        {record?.id === 'letter' && canAct ? <div className="decisions"><p>今晚之前，你可以做兩件事。你只能決定自己的行動；結果還沒有人知道。</p><button disabled={hasAction('protect_wakaharu')} onClick={() => choose('protect_wakaharu')}>{hasAction('protect_wakaharu') ? '已和若晴約好' : '保護若晴，陪她留在家裡'}</button><button disabled={hasAction('stop_doctor')} onClick={() => choose('stop_doctor')}>{hasAction('stop_doctor') ? '予安已答應去醫院' : '請予安幫忙攔住醫生'}</button></div> : null}
        {note && <p className="inline-note" role="status">{note}</p>}
      </div>}
    </main>
    <footer className="player-footer"><span>{next}</span><span>案卷只保存在這台裝置</span></footer>
    {drawer && <div className="drawer-shade" onMouseDown={e => { if (e.target === e.currentTarget) setDrawer(null); }}><section className={`drawer ${drawer === 'board' ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={drawer === 'case' ? '案卷' : drawer === 'board' ? '推理桌' : drawer === 'save' ? '存檔' : '世界線'}>
      <header><h2>{drawer === 'case' ? '案卷' : drawer === 'board' ? '推理桌' : drawer === 'save' ? '存檔' : '世界線歷史'}</h2><button autoFocus onClick={() => setDrawer(null)} aria-label="關閉">×</button></header>
      {drawer === 'case' && <div className="case-list">{records.map(item => <button key={item.id} onClick={() => openRecord(item.id)}><small>{item.source} · {item.obtainedAt}</small><strong>{item.title}</strong>{!save.knowledge.opened.includes(`${clock.loop}:${item.id}`) && <em>新</em>}</button>)}</div>}
      {drawer === 'board' && <EvidenceBoard save={save} onChange={commit} onNotice={setNote} />}
      {drawer === 'worldlines' && <WorldlineNotebook save={save} currentLoop={clock.loop} knownDiff={knownDiff} />}
      {drawer === 'save' && <div className="save-panel"><p>進度存在此瀏覽器。要換裝置，可以複製 JSON 後在新裝置貼上。</p><button onClick={() => setExporting(v => !v)}>顯示這台裝置的存檔</button>{exporting && <textarea readOnly aria-label="目前存檔" value={exportSave(save)} />}
        <p>舊網站若在另一個網址，先在舊網站的瀏覽器 Console 執行：</p><code>copy(localStorage.getItem('ash-town-bible-v1'))</code><p>把複製到的內容貼在下方，或選取 JSON 檔。</p><button onClick={() => { try { setImportText(storage.getItem(LEGACY_KEY) ?? ''); } catch { setNote('讀不到舊案卷。'); } }}>讀取此網址的舊案卷</button><input type="file" accept=".json,application/json" aria-label="選取存檔" onChange={async e => { const file = e.target.files?.[0]; if (file) setImportText(await file.text()); }} /><textarea aria-label="貼上存檔 JSON" value={importText} onChange={e => setImportText(e.target.value)} /><button onClick={importSave}>匯入存檔</button>{note && <p role="status">{note}</p>}{save.knowledge.notes.map((x, i) => <p key={i}>{x.text}</p>)}</div>}
    </section></div>}
  </div>;
}
