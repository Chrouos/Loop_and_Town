export type InterruptSurfaceProps = {
  cue?: string;
  title: string;
  body?: string;
  actionLabel?: string;
  onOpen?: () => void;
};

export function InterruptSurface({ cue = '嗡——', title, body, actionLabel = '查看', onOpen }: InterruptSurfaceProps) {
  return (
    <aside className="interrupt-surface" aria-label="新動靜">
      <span className="interrupt-cue">{cue}</span>
      <strong>{title}</strong>
      {body && <p>{body}</p>}
      {onOpen && <button type="button" onClick={onOpen}>{actionLabel}</button>}
    </aside>
  );
}
