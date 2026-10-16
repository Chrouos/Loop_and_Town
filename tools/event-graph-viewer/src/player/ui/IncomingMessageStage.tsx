import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { PlayerNarrativeRecord } from '../story';
import './incomingMessageStage.css';

type Props = {
  messages: PlayerNarrativeRecord[];
  onRead: (id: string) => void;
  /** Makes tests/assistive tools aware of the number of available messages. */
  label?: string;
};

/**
 * This is only a view over already-delivered messages.
 * Paging never marks a message read, consumes Attention, or changes world time.
 * The caller validates read/open transactions.
 */
export function IncomingMessageStage({ messages, onRead, label = '鎮上新消息' }: Props) {
  const [viewport, api] = useEmblaCarousel({ align: 'start', containScroll: false, loop: false });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const reducedMotion = useReducedMotion();
  const ids = useMemo(() => messages.map(item => item.id).join('|'), [messages]);
  const sync = useCallback(() => { if (api) setSelectedIndex(api.selectedScrollSnap()); }, [api]);

  useEffect(() => {
    if (!api) return;
    sync();
    api.on('select', sync);
    api.on('reInit', sync);
    return () => { api.off('select', sync); api.off('reInit', sync); };
  }, [api, sync]);

  useEffect(() => {
    if (!api) return;
    api.scrollTo(0, true);
    setSelectedIndex(0);
  }, [api, ids]);

  const go = (direction: 'previous' | 'next') => {
    const next = Math.max(0, Math.min(messages.length - 1, selectedIndex + (direction === 'previous' ? -1 : 1)));
    setSelectedIndex(next);
    api?.scrollTo(next);
  };
  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowLeft') { event.preventDefault(); go('previous'); }
    if (event.key === 'ArrowRight') { event.preventDefault(); go('next'); }
  }
  if (!messages.length) return null;
  const active = Math.min(selectedIndex, messages.length - 1);
  return (
    <section className="incoming-message-stage" role="region" aria-label={label} onKeyDown={onKeyDown}>
      <header className="incoming-message-stage__header">
        <span>……手機輕輕震了一下。</span>
        <span>{messages.length} 則訊息</span>
      </header>
      <div className="incoming-message-stage__viewport" ref={viewport}>
        <div className="incoming-message-stage__track">
          {messages.map((item, index) => (
            <article className="incoming-message-stage__slide" key={item.id}
              aria-hidden={index !== active} data-active={index === active ? 'true' : 'false'}>
              <small className="incoming-message-stage__source">{item.source}　·　{item.formedAt}</small>
              <h2>{item.title}</h2>
              <p className="incoming-message-stage__hint">有人留下了一段訊息。</p>
              <button type="button" className="incoming-message-stage__read"
                aria-label={`閱讀新消息：${item.title}`}
                tabIndex={index === active ? 0 : -1}
                onClick={() => onRead(item.id)}>閱讀這段訊息 <span aria-hidden="true">↗</span></button>
            </article>
          ))}
        </div>
      </div>
      <footer className="incoming-message-stage__footer">
        <div className="incoming-message-stage__switch">
          <button type="button" aria-label="上一則消息" disabled={active === 0} onClick={() => go('previous')}>←</button>
          <button type="button" aria-label="下一則消息" disabled={active === messages.length - 1} onClick={() => go('next')}>→</button>
        </div>
        <span className="incoming-message-stage__count" aria-label={`第 ${active + 1} 則，共 ${messages.length} 則`}>
          {String(active + 1).padStart(2, '0')} / {String(messages.length).padStart(2, '0')}
        </span>
      </footer>
      <div className="incoming-message-stage__live" aria-live="polite" aria-atomic="true">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={messages[active]?.id}
            initial={reducedMotion ? false : { opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: -5 }}
            transition={{ duration: reducedMotion ? 0 : 0.22 }}>
            {messages[active]?.title}
          </motion.span>
        </AnimatePresence>
      </div>
    </section>
  );
}
