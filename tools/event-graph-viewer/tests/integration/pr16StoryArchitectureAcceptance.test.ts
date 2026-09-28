import { afterEach, expect, it, vi } from 'vitest';
import { loadAuthorStoryBundle } from '../../src/lib/loadAuthorStoryBundle';

const rawStoryFiles = import.meta.glob('../../../../story/**/*.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function stubRealStoryFetch() {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const pathname = String(input).replace(/^https?:\/\/[^/]+/, '');
    const suffix = pathname.replace(/^\/?story\//, '');
    const key = Object.keys(rawStoryFiles).find((candidate) => candidate.endsWith(`/story/${suffix}`));
    return new Response(key ? rawStoryFiles[key] : '', { status: key ? 200 : 404 });
  }));
}

afterEach(() => vi.unstubAllGlobals());

it('loads and validates the complete PR16 story architecture bundle', async () => {
  stubRealStoryFetch();
  const bundle = await loadAuthorStoryBundle('story/manifests/loop_01.yaml');

  expect(bundle.simulation.loop.range.start).toEqual({ day: 0, time: '06:12' });
  expect(bundle.narratives.map((scene) => scene.id)).toEqual(expect.arrayContaining([
    'prologue_arrival',
    'loop02_1420_reset_awareness',
    'loop03_1420_third_awake',
    'loop04_0612_hard_reset',
    'loop07_0920_worldline_31',
    'final_1831_convergence',
  ]));
  expect(bundle.storyDags.map((dag) => dag.id)).toEqual(expect.arrayContaining([
    'day_01_story_dag',
    'loop_03_story_dag',
    'loop_04_story_dag',
    'loop_05_story_dag',
    'loop_06_story_dag',
    'loop_07_story_dag',
    'final_story_dag',
  ]));
  expect(bundle.worldlinePaths.map((path) => path.id)).toEqual(expect.arrayContaining([
    'loop_01_baseline',
    'loop_02_wakaharu_saved_doctor_dies',
    'loop_03_no_death',
    'ending_a_tomorrow',
    'ending_b_once_more',
    'ending_c_forget_me',
  ]));
});
