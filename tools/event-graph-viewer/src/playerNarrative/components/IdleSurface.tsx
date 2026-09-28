import { formatStoryMinute } from '../clock';
import type { UpcomingWorldEvent } from '../upcomingEvent';

export type IdleSurfaceProps = {
  upcomingEvent?: UpcomingWorldEvent | null;
  prose?: string;
  worldHandoff?: boolean;
  onHandoff?: () => void;
};

function formatRemainingMinutes(value: number): string {
  if (value < 60) return `還有 ${value} 分鐘`;
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return minutes > 0 ? `還有 ${hours} 小時 ${minutes} 分鐘` : `還有 ${hours} 小時`;
}

export function IdleSurface({ upcomingEvent, prose, worldHandoff = false, onHandoff = () => undefined }: IdleSurfaceProps) {
  return (
    <section className="quiet-surface" aria-label="目前狀態">
      <div className="quiet-center">
        <p>{prose ?? (worldHandoff ? '世界接手了這一輪。' : '世界沒有停下來。')}</p>
        {upcomingEvent && (
          <div className="quiet-next-event" aria-label="下一個時間點">
            <span>下一個時間點</span>
            <strong>{upcomingEvent.title}</strong>
            <time>{formatRemainingMinutes(upcomingEvent.remainingMinutes)} · {formatStoryMinute(upcomingEvent.minute)}</time>
          </div>
        )}
        <button className="world-handoff-button" type="button" onClick={onHandoff}>
          交還給世界
        </button>
        {worldHandoff && <span className="world-handoff-status" role="status">這一輪會自行繼續。</span>}
      </div>
    </section>
  );
}
