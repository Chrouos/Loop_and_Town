import { characterKnowsFact } from './knowledge';
import type { NarrativeDialogueBlock, NarrativeFoundation } from './types';

function assertUniqueIds(items: Array<{ id: string }>, label: string): void {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) throw new Error(`Duplicate ${label} ID: ${item.id}`);
    seen.add(item.id);
  }
}

export function validateNarrativeFoundation(story: NarrativeFoundation): void {
  assertUniqueIds(story.characters, 'Character');
  assertUniqueIds(story.knowledgeFacts, 'Knowledge Fact');
  assertUniqueIds(story.scenes, 'Narrative Scene');

  const characters = new Map(story.characters.map((character) => [character.id, character]));
  const factIds = new Set(story.knowledgeFacts.map((fact) => fact.id));

  for (const relationship of story.relationships) {
    if (!characters.has(relationship.from)) {
      throw new Error(`Relationship ${relationship.from}->${relationship.to}: unknown source character ${relationship.from}`);
    }
    if (!characters.has(relationship.to)) {
      throw new Error(`Relationship ${relationship.from}->${relationship.to}: unknown target character ${relationship.to}`);
    }
  }

  for (const character of story.characters) {
    for (const factId of [...character.knowledge.initial, ...character.knowledge.hidden]) {
      if (!factIds.has(factId)) {
        throw new Error(`Character ${character.id}: unknown fact ${factId}`);
      }
    }
  }

  for (const scene of story.scenes) {
    for (const participantId of scene.participants) {
      if (!characters.has(participantId)) {
        throw new Error(`Scene ${scene.id}: unknown participant ${participantId}`);
      }
    }

    for (const block of scene.blocks) {
      if (block.type !== 'dialogue') continue;
      validateDialogueBlock(scene.id, block, characters, factIds);
    }
  }
}

function validateDialogueBlock(
  sceneId: string,
  block: NarrativeDialogueBlock,
  characters: Map<string, NarrativeFoundation['characters'][number]>,
  factIds: Set<string>,
): void {
  const speaker = characters.get(block.speaker);
  if (!speaker) throw new Error(`Scene ${sceneId}: unknown speaker ${block.speaker}`);
  if (!block.factId) return;
  if (!factIds.has(block.factId)) throw new Error(`Scene ${sceneId}: unknown fact ${block.factId}`);
  if (!characterKnowsFact(speaker, block.factId)) {
    throw new Error(`Scene ${sceneId}: character ${block.speaker} does not know fact ${block.factId}`);
  }
}
