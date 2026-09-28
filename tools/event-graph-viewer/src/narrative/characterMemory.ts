import type {
  CharacterInsightDefinition,
  CharacterQuestionDefinition,
  NarrativeFoundation,
} from './types';

export type PlayerCharacterFact = {
  id: string;
  summary: string;
};

export type PlayerCharacterInsight = Pick<CharacterInsightDefinition, 'id' | 'title' | 'presentation'>;

export type PlayerCharacterQuestion = Pick<CharacterQuestionDefinition, 'id' | 'text'>;

export type PlayerCharacterMemory = {
  characterId: string;
  name: string;
  occupation?: string;
  hometown?: string;
  facts: PlayerCharacterFact[];
  insights: PlayerCharacterInsight[];
  questions: PlayerCharacterQuestion[];
};

function factsForCharacter(story: NarrativeFoundation, characterId: string, knownFacts: Set<string>): PlayerCharacterFact[] {
  const character = story.characters.find((item) => item.id === characterId);
  if (!character) return [];
  const visibleIds = [...new Set([...character.knowledge.initial, ...character.knowledge.hidden])]
    .filter((factId) => knownFacts.has(factId));
  return visibleIds.flatMap((factId) => {
    const fact = story.knowledgeFacts.find((item) => item.id === factId);
    return fact?.characterId === characterId
      ? [{ id: fact.id, summary: fact.summary }]
      : [];
  });
}

function insightForPlayer(
  insight: CharacterInsightDefinition,
  knownFacts: Set<string>,
  knownInsights: Set<string>,
): PlayerCharacterInsight | undefined {
  if (!knownInsights.has(insight.id) || insight.retainedBy !== 'protagonist') return undefined;
  if ((insight.requiresFacts ?? []).some((factId) => !knownFacts.has(factId))) return undefined;
  return { id: insight.id, title: insight.title, presentation: insight.presentation };
}

function questionForPlayer(
  question: CharacterQuestionDefinition,
  knownFacts: Set<string>,
  knownInsights: Set<string>,
): PlayerCharacterQuestion | undefined {
  if ((question.requiresFacts ?? []).some((factId) => !knownFacts.has(factId))) return undefined;
  if (question.resolvedByInsightId && knownInsights.has(question.resolvedByInsightId)) return undefined;
  return { id: question.id, text: question.text };
}

export function projectCharacterMemory(
  story: NarrativeFoundation,
  knownFactIds: Iterable<string>,
  knownInsightIds: Iterable<string>,
): PlayerCharacterMemory[] {
  const knownFacts = new Set(knownFactIds);
  const knownInsights = new Set(knownInsightIds);
  return story.characters.map((character) => ({
    characterId: character.id,
    name: character.name,
    occupation: character.identity.occupation,
    hometown: character.identity.hometown,
    facts: factsForCharacter(story, character.id, knownFacts),
    insights: (story.characterInsights ?? [])
      .filter((insight) => insight.characterId === character.id)
      .flatMap((insight) => {
        const projected = insightForPlayer(insight, knownFacts, knownInsights);
        return projected ? [projected] : [];
      }),
    questions: (story.characterQuestions ?? [])
      .filter((question) => question.characterId === character.id)
      .flatMap((question) => {
        const projected = questionForPlayer(question, knownFacts, knownInsights);
        return projected ? [projected] : [];
      }),
  }));
}
