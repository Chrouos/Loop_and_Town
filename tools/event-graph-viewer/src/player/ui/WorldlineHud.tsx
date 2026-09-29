type WorldlineHudProps = {
  loop: number;
  time: string;
  worldline?: string;
  showTime?: boolean;
};

export function WorldlineHud({ loop, time, worldline, showTime = true }: WorldlineHudProps) {
  return <aside className="worldline-hud" aria-label="世界線資訊">
    <span className="worldline-hud__loop">LOOP {String(loop).padStart(2, '0')}</span>
    {showTime && <time className="worldline-hud__time">{time}</time>}
    {worldline && <span className="worldline-hud__worldline">WORLDLINE {worldline}</span>}
  </aside>;
}
