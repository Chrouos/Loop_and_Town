import { useEffect, useState } from 'react';

export type PlayerChoiceOption = { id: string; label: string };

export type ChoiceSurfaceProps = {
  choices: PlayerChoiceOption[];
  onChoose: (id: string) => void;
};

const CHOICES_PER_PAGE = 3;

export function ChoiceSurface({ choices, onChoose }: ChoiceSurfaceProps) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(choices.length / CHOICES_PER_PAGE));
  const currentPage = Math.min(page, pageCount - 1);
  useEffect(() => { setPage(0); }, [choices.map(choice => choice.id).join('|')]);
  return (
    <div className="choice-surface" aria-label="可採取的行動">
      <div className="choice-surface__items">
        {choices.slice(currentPage * CHOICES_PER_PAGE, (currentPage + 1) * CHOICES_PER_PAGE).map((choice) => (
          <button className="choice-button" type="button" key={choice.id} onClick={() => onChoose(choice.id)}>
            {choice.label}
          </button>
        ))}
      </div>
      {pageCount > 1 && <nav className="choice-pagination" aria-label="行動選項分頁">
        <button type="button" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={currentPage === 0}>‹ 上頁</button>
        <span>{currentPage + 1} / {pageCount}</span>
        <button type="button" onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))} disabled={currentPage === pageCount - 1}>下頁 ›</button>
      </nav>}
    </div>
  );
}
