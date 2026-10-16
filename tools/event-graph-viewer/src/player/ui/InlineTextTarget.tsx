type InlineTextTargetProps = {
  children: string;
  available: boolean;
  focused?: boolean;
  onAttend: () => void;
  onPreview?: (focused: boolean) => void;
};
/** An unobtrusive piece of narration: discoverable by keyboard/touch without leaking importance. */
export function InlineTextTarget({ children, available, focused = false, onAttend, onPreview }: InlineTextTargetProps) {
  if (!available) return <span>{children}</span>;
  return <button
    className="inline-text-target"
    type="button"
    aria-label={`留意：${children}`}
    aria-pressed={focused}
    onPointerEnter={() => onPreview?.(true)}
    onPointerLeave={() => onPreview?.(false)}
    onFocus={() => onPreview?.(true)}
    onBlur={() => onPreview?.(false)}
    onClick={onAttend}
  >{children}</button>;
}
