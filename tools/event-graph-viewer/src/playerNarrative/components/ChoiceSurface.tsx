export type PlayerChoiceOption = { id: string; label: string };

export type ChoiceSurfaceProps = {
  choices: PlayerChoiceOption[];
  onChoose: (id: string) => void;
};

export function ChoiceSurface({ choices, onChoose }: ChoiceSurfaceProps) {
  return (
    <div className="choice-surface" aria-label="可採取的行動">
      {choices.map((choice) => (
        <button className="choice-button" type="button" key={choice.id} onClick={() => onChoose(choice.id)}>
          {choice.label}
        </button>
      ))}
    </div>
  );
}
