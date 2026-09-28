import type { ReactNode } from 'react';

type AmbientPromptProps = {
  children: ReactNode;
  onActivate?: () => void;
};

export function AmbientPrompt({ children, onActivate }: AmbientPromptProps) {
  if (!onActivate) return <p className="ambient-prompt">{children}</p>;
  return <button className="ambient-prompt ambient-prompt--action" type="button" onClick={onActivate}>
    <span>{children}</span>
    <span className="ambient-prompt__mark" aria-hidden="true">◇</span>
  </button>;
}
