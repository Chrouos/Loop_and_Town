import { describe, expect, it } from 'vitest';
import yaml from 'js-yaml';
import verifyYaml from '../../../.github/workflows/event-graph-viewer.yml?raw';
import deployYaml from '../../../.github/workflows/deploy-event-graph-viewer.yml?raw';

type Workflow = {
  on: Record<string, unknown>;
  permissions?: Record<string, string>;
  concurrency?: { group?: string; 'cancel-in-progress'?: boolean };
  jobs: Record<string, {
    if?: string;
    needs?: string;
    permissions?: Record<string, string>;
    steps: Array<{ name?: string; run?: string; uses?: string; with?: Record<string, string> }>;
  }>;
};
const verify = yaml.load(verifyYaml) as Workflow;
const deploy = yaml.load(deployYaml) as Workflow;
const steps = (workflow: Workflow, job: string) => workflow.jobs[job].steps;

describe('GitHub Actions CI/CD separation', () => {
  it('runs read-only PR checks for story, docs and workflow changes exactly once', () => {
    expect(verify.on).toHaveProperty('pull_request');
    expect(verify.on).not.toHaveProperty('push');
    const paths = (verify.on.pull_request as { paths: string[] }).paths;
    expect(paths).toContain('story/**');
    expect(paths).toContain('docs/**');
    expect(paths).toContain('tools/event-graph-viewer/**');
    expect(verify.permissions).toEqual({ contents: 'read' });
    expect(verify.concurrency?.['cancel-in-progress']).toBe(true);
    expect(steps(verify, 'verify-viewer').some(s => s.uses?.includes('upload-artifact'))).toBe(true);
    expect(steps(verify, 'verify-viewer').some(s => s.run === 'npm ci')).toBe(true);
    expect(steps(verify, 'verify-viewer').some(s => s.run === 'npm test')).toBe(true);
    expect(steps(verify, 'verify-viewer').some(s => s.run === 'npm run build')).toBe(true);
  });
  it('publishes only from main, never from a draft PR or branch dispatch', () => {
    expect(deploy.on).not.toHaveProperty('pull_request');
    expect((deploy.on.push as { branches: string[] }).branches).toEqual(['main']);
    expect(deploy.jobs.build.if).toContain("refs/heads/main");
    expect(deploy.jobs.deploy.if).toContain("refs/heads/main");
    expect(deploy.jobs.deploy.needs).toBe('build');
    expect(deploy.permissions).toEqual({ contents: 'read' });
    expect(deploy.jobs.deploy.permissions).toMatchObject({ pages: 'write', 'id-token': 'write' });
    expect(steps(deploy, 'build').some(s => s.run === 'npm ci')).toBe(true);
    expect(steps(deploy, 'build').some(s => s.uses?.includes('upload-pages-artifact'))).toBe(true);
    expect(steps(deploy, 'deploy').some(s => s.uses?.includes('deploy-pages'))).toBe(true);
  });
  it('build smoke tests require the Viewer and playable Player entry points', () => {
    for (const [workflow,job] of [[verify,'verify-viewer'],[deploy,'build']] as const) {
      const smoke = steps(workflow,job).find(s => s.name === 'Verify both entry points')?.run;
      expect(smoke).toContain('test -s dist/index.html');
      expect(smoke).toContain('test -s dist/player.html');
    }
  });
});
