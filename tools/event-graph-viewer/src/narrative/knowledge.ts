import type { CharacterDefinition } from './types';

export function characterKnowsFact(character: CharacterDefinition, factId: string): boolean {
  return character.knowledge.initial.includes(factId) || character.knowledge.hidden.includes(factId);
}
