import type { NarrativeFoundation, RelationshipDefinition } from './types';
import type {
  CharacterGraphDetail,
  CharacterGraphEdge,
  CharacterGraphMode,
  CharacterGraphProjection,
} from '../types/story';

function relationshipVisible(relationship: RelationshipDefinition, mode: CharacterGraphMode): boolean {
  if (mode === 'author') return true;
  if (relationship.visibility === 'public') return true;
  return mode === 'player-known' && relationship.visibility === 'player-known';
}

function edgeId(relationship: RelationshipDefinition, index: number): string {
  return `${relationship.from}->${relationship.to}:${relationship.type}:${index}`;
}

export function projectCharacterGraph(
  story: NarrativeFoundation,
  mode: CharacterGraphMode,
  playerKnownFactIds: Iterable<string> = [],
): CharacterGraphProjection {
  const knownFacts = new Set(playerKnownFactIds);
  const visibleRelationships = story.relationships.filter((relationship) => relationshipVisible(relationship, mode));
  const edges: CharacterGraphEdge[] = visibleRelationships.map((relationship, index) => ({
    id: edgeId(relationship, index),
    source: relationship.from,
    target: relationship.to,
    type: relationship.type,
    summary: relationship.summary,
    visibility: relationship.visibility,
  }));

  const nodes = story.characters.map((character) => ({
    id: character.id,
    name: character.name,
    occupation: character.identity.occupation,
    hometown: character.identity.hometown,
  }));

  const details: Record<string, CharacterGraphDetail> = {};
  for (const character of story.characters) {
    const authoredKnowledge = [...character.knowledge.initial, ...character.knowledge.hidden];
    const knowledgeIds = mode === 'author'
      ? [...new Set(authoredKnowledge)]
      : mode === 'player-known'
        ? [...new Set(authoredKnowledge.filter((factId) => knownFacts.has(factId)))]
        : [];

    details[character.id] = {
      characterId: character.id,
      name: character.name,
      backgroundSummary: character.background.summary,
      traits: [...character.personality.traits],
      relationshipEdgeIds: edges
        .filter((edge) => edge.source === character.id || edge.target === character.id)
        .map((edge) => edge.id),
      knowledgeIds,
      secrets: mode === 'author' ? [...character.secrets] : [],
      scheduleRef: mode === 'author' ? character.scheduleRef : undefined,
      narrativeAppearanceIds: mode === 'author'
        ? story.scenes
          .filter((scene) => scene.participants.includes(character.id))
          .map((scene) => scene.id)
        : [],
    };
  }

  return { mode, nodes, edges, details };
}
