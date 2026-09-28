import { useEffect, useRef } from 'react';
import type { PlayerCharacterMemory } from '../../narrative/characterMemory';

export type CharacterDrawerProps = {
  memory: PlayerCharacterMemory[];
  open: boolean;
  onClose: () => void;
};

function monogram(name: string): string {
  return [...name][0] ?? '?';
}

export function CharacterDrawer({ memory, open, onClose }: CharacterDrawerProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) closeButtonRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <aside
      className="character-drawer"
      aria-label="人物"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <header>
        <h2>人物</h2>
        <button ref={closeButtonRef} type="button" aria-label="關閉人物" onClick={onClose}>關閉</button>
      </header>
      <div className="character-list">
        {memory.filter((character) => character.characterId !== 'protagonist').map((character) => (
          <article className="character-card" key={character.characterId}>
            <div className="character-identity">
              <div className="character-monogram" aria-hidden="true">{monogram(character.name)}</div>
              <div>
                <h3>{character.name}</h3>
                {(character.occupation || character.hometown) && (
                  <p className="character-role">
                    {character.occupation && <span>{character.occupation}</span>}
                    {character.occupation && character.hometown && <span aria-hidden="true"> · </span>}
                    {character.hometown && <span>{character.hometown}</span>}
                  </p>
                )}
              </div>
            </div>

            {character.facts.length > 0 && (
              <section className="character-memory" aria-labelledby={`${character.characterId}-facts`}>
                <h4 id={`${character.characterId}-facts`}>我記得的事</h4>
                <ul>{character.facts.map((fact) => <li key={fact.id}>{fact.summary}</li>)}</ul>
              </section>
            )}

            {character.insights.length > 0 && (
              <section className="character-memory" aria-labelledby={`${character.characterId}-insights`}>
                <h4 id={`${character.characterId}-insights`}>跨輪迴線索</h4>
                <ul>{character.insights.map((insight) => <li key={insight.id}><strong>{insight.title}</strong><span>{insight.presentation}</span></li>)}</ul>
              </section>
            )}

            {character.questions.length > 0 && (
              <section className="character-memory character-questions" aria-labelledby={`${character.characterId}-questions`}>
                <h4 id={`${character.characterId}-questions`}>還沒想通的事</h4>
                <ul>{character.questions.map((question) => <li key={question.id}>{question.text}</li>)}</ul>
              </section>
            )}
          </article>
        ))}
      </div>
    </aside>
  );
}
