import { useEffect, useMemo, useState } from 'react';
import type { StoryBundle } from '../lib/loadSimulationStory';
import type { NarrativeSceneDefinition } from '../narrative/types';
import { applyChoiceEffects } from './choices';
import { freezeForeground, resumeWorld } from './clock';
import { reconcilePlayerRuntime, type PlayerRuntimeView } from './runtime';
import { readPlayerSession, writePlayerSession } from './storage';
import type { PlayerSessionV2 } from './model';
import { ActivitySurface } from './components/ActivitySurface';
import { ArtifactSurface } from './components/ArtifactSurface';
import { CharacterDrawer } from './components/CharacterDrawer';
import { ChoiceSurface } from './components/ChoiceSurface';
import { NarrativeSurface } from './components/NarrativeSurface';

export type PlayerNarrativeAppProps = { story: StoryBundle };

function formatMinute(value: number): string {
  const minute = ((value % 1440) + 1440) % 1440;
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

function settleCompletedActivity(session: PlayerSessionV2, view: PlayerRuntimeView): PlayerSessionV2 {
  if (!view.activeActivity || view.activeActivity.status !== 'complete') return session;
  return {
    ...session,
    currentLocation: view.currentLocation,
    activeActivity: null,
    activeTravel: null,
  };
}

export function PlayerNarrativeApp({ story }: PlayerNarrativeAppProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [session, setSession] = useState<PlayerSessionV2>(() => readPlayerSession(window.localStorage, Date.now()));
  const [visibleCount, setVisibleCount] = useState(1);
  const [sceneKey, setSceneKey] = useState<string | null>(null);
  const [ambientText, setAmbientText] = useState<string | undefined>();
  const [charactersOpen, setCharactersOpen] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const view = useMemo(() => reconcilePlayerRuntime(story, session, nowMs), [story, session, nowMs]);
  const sceneItem = view.queue.find((item) => item.kind === 'scene');
  const scene = sceneItem ? story.narrative.scenes.find((item) => item.id === sceneItem.id) ?? null : null;
  const speakerNames = useMemo(
    () => Object.fromEntries(story.narrative.characters.map((character) => [character.id, character.name])),
    [story],
  );

  useEffect(() => {
    if (!scene || session.foregroundFreeze) return;
    const frozen = freezeForeground(session, scene.id, nowMs);
    setSession(frozen);
    writePlayerSession(window.localStorage, frozen);
  }, [scene?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!scene) return;
    if (sceneKey !== scene.id) {
      setSceneKey(scene.id);
      setVisibleCount(1);
    }
  }, [scene, sceneKey]);

  useEffect(() => {
    if (scene) return;
    const beat = view.queue.find((item) => item.kind === 'ambient');
    if (!beat || session.consumedAmbientBeatIds.includes(beat.id)) return;
    const definition = view.activeActivity
      ? story.narrative.activities.find((item) => item.id === view.activeActivity?.activityId)
      : undefined;
    const prose = definition?.ambient?.find((item) => item.id === beat.id)?.text;
    const next = { ...session, consumedAmbientBeatIds: [...session.consumedAmbientBeatIds, beat.id] };
    setAmbientText(prose);
    setSession(next);
    writePlayerSession(window.localStorage, next);
  }, [scene, view.queue, view.activeActivity, session, story.narrative.activities]);

  useEffect(() => {
    if (scene || !view.activeActivity || view.activeActivity.status !== 'complete') return;
    const next = settleCompletedActivity(session, view);
    if (next === session) return;
    setSession(next);
    writePlayerSession(window.localStorage, next);
  }, [scene, view.activeActivity, view.currentLocation, session]); // eslint-disable-line react-hooks/exhaustive-deps

  function persist(next: PlayerSessionV2) {
    setSession(next);
    writePlayerSession(window.localStorage, next);
  }

  function finishScene(current: NarrativeSceneDefinition) {
    const settled = settleCompletedActivity(session, view);
    const consumed = settled.consumedSceneIds.includes(current.id)
      ? settled.consumedSceneIds
      : [...settled.consumedSceneIds, current.id];
    persist(resumeWorld({ ...settled, consumedSceneIds: consumed }, Date.now()));
    setSceneKey(null);
    setVisibleCount(1);
  }

  function choose(choiceId: string) {
    if (!scene) return;
    const choice = view.availableChoices.find((item) => item.id === choiceId);
    if (!choice) return;
    const settled = settleCompletedActivity(session, view);
    const applied = applyChoiceEffects(story, settled, choice, view.currentStoryMinute);
    const consumedSceneIds = applied.consumedSceneIds.includes(scene.id)
      ? applied.consumedSceneIds
      : [...applied.consumedSceneIds, scene.id];
    persist(resumeWorld({ ...applied, consumedSceneIds }, Date.now()));
    setSceneKey(null);
    setVisibleCount(1);
    setAmbientText(undefined);
  }

  const readableBlocks = scene?.blocks.filter((block) => block.type !== 'artifact') ?? [];
  const sceneComplete = visibleCount >= Math.max(1, readableBlocks.length);
  const artifact = scene?.artifactId
    ? story.narrative.artifacts.find((item) => item.id === scene.artifactId)
    : undefined;
  const letterOpenChoice = view.availableChoices.find((choice) => choice.id === 'letter_open');

  const activityDefinition = view.activeActivity
    ? story.narrative.activities.find((item) => item.id === view.activeActivity?.activityId)
    : undefined;

  return (
    <main className="player-narrative-shell">
      <header className="player-hud">
        <span className="place-label">灰潮鎮</span>
        <time>{formatMinute(view.currentStoryMinute)}</time>
      </header>

      <div className="player-stage">
        {scene ? (
          <>
            <NarrativeSurface
              blocks={readableBlocks}
              visibleCount={visibleCount}
              speakerNames={speakerNames}
              onContinue={!sceneComplete ? () => setVisibleCount((value) => value + 1) : undefined}
            />

            {sceneComplete && artifact && (
              <ArtifactSurface
                artifact={artifact}
                initiallyOpened={session.openedArtifactIds.includes(artifact.id) || scene.id === 'prologue_letter_opened'}
                onOpened={() => {
                  const openedArtifactIds = session.openedArtifactIds.includes(artifact.id)
                    ? session.openedArtifactIds
                    : [...session.openedArtifactIds, artifact.id];
                  persist({ ...session, openedArtifactIds });
                  if (letterOpenChoice) choose(letterOpenChoice.id);
                }}
              />
            )}

            {sceneComplete && !letterOpenChoice && view.availableChoices.length > 0 && (
              <ChoiceSurface choices={view.availableChoices} onChoose={choose} />
            )}

            {sceneComplete && view.availableChoices.length === 0 && (!artifact || session.openedArtifactIds.includes(artifact.id) || scene.id === 'prologue_letter_opened') && (
              <button className="continue-button scene-finish" type="button" onClick={() => finishScene(scene)}>繼續</button>
            )}
          </>
        ) : view.activeActivity && view.activeActivity.status === 'running' ? (
          <ActivitySurface
            timeLabel={formatMinute(view.currentStoryMinute)}
            title={activityDefinition?.presentation.idle ?? '正在路上……'}
            prose={ambientText}
          />
        ) : (
          <section className="quiet-surface">
            <p>{ambientText ?? '世界沒有停下來。'}</p>
          </section>
        )}
      </div>

      <nav className="player-tools" aria-label="輔助選單">
        <button type="button" onClick={() => setCharactersOpen(true)}>人物</button>
      </nav>

      <CharacterDrawer
        story={story.narrative}
        knownFactIds={session.knownFactIds}
        open={charactersOpen}
        onClose={() => setCharactersOpen(false)}
      />
    </main>
  );
}
