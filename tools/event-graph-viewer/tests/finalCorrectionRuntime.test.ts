import { describe, expect, it } from 'vitest';
import yaml from 'js-yaml';
import raw from '../../../story/mechanism/final_runtime.yaml?raw';
import finalGraph from '../../../story/events/final_story_dag.yaml?raw';
import { createSimulation, simulate } from '../src/simulator/simulator';
import { initialCorrectionSession, type CorrectionSession } from '../src/simulator/correctionSession';
import { materializeRecoveryBoundary } from '../src/simulator/recoveryBoundary';
import type { SimulationDefinition, WorldState } from '../src/simulator/types';

const fixture = yaml.load(raw) as {
  initial_state: WorldState;
  definition: SimulationDefinition;
  cases: Array<{id: string; graph_ref: string; action_ids: string[]}>;
};
const graph = yaml.load(finalGraph) as { nodes: Array<{ id: string }> };
function run(id: string) {
  const chosen = fixture.cases.find(c => c.id === id);
  if (!chosen) throw Error('Missing Final scenario: ' + id);
  const result = simulate({ definition: fixture.definition, initialState: fixture.initial_state,
    actions: chosen.action_ids, until: {day:1,time:'00:00'} });
  return { result, session: result.state.correction as CorrectionSession };
}

describe('Executable CorrectionSession + authored Final outcomes', () => {
  it('shares graph refs with the canonical Final and has actual timed events', () => {
    for (const c of fixture.cases) {
      expect(graph.nodes.some(n => n.id === c.graph_ref), c.graph_ref).toBe(true);
      for (const id of c.action_ids) expect(fixture.definition.actions.some(a => a.id === id), id).toBe(true);
    }
    expect(fixture.definition.events.map(e => e.at)).toEqual([
      {day:0,time:'18:31'}, {day:0,time:'23:59'}, {day:1,time:'00:00'},
    ]);
  });

  it('B retries even with no recorded casualty: death is not a Reset predicate', () => {
    const { result, session } = run('ending_b_once_more');
    expect(result.state.characters).toBeUndefined();
    expect(session.phase).toBe('RETRY');
    expect(session.outcome).toBe('RETRY');
    expect(session.nextCheckpoint).toBe('10/3 06:12');
    expect(session.feedbackMismatch).toBe(true);
    expect(result.history.filter(h=>h.kind==='event').map(h=>h.eventId))
      .toEqual(['final_convergence','final_recovery_check','final_midnight']);
  });

  it('A finishes only the current session: both Writer permissions remain active', () => {
    const {session, result} = run('ending_a_tomorrow');
    expect(session).toMatchObject({phase:'FORWARD_SEALED', outcome:'FORWARD', sealMode:'ONE_TIME',
      nextCheckpoint:'10/4 00:01', primaryWriteAuthority:true, recoveryWriteAuthority:true,
      isolationVerified:false});
    expect((result.state.anchor as {memoryRetained:boolean}).memoryRetained).toBe(true);
  });

  it('C fences both bridges and verifies independent evidence while an NPC may decline', () => {
    const {session,result} = run('ending_c_forget_me');
    expect(session).toMatchObject({phase:'FORWARD_SEALED', outcome:'FORWARD', sealMode:'PERMANENT',
      primaryWriteAuthority:false, recoveryWriteAuthority:false, epochFenced:true,
      isolationVerified:true, pendingCorrection:false, nextCheckpoint:'10/4 00:01'});
    expect(session.choices.wakaharu).toBe('decline');
    expect((result.state.services as Record<string,boolean>)).toEqual({predictionEnabled:true,simulationEnabled:true});
    expect((result.state.anchor as {memoryRetained:boolean}).memoryRetained).toBe(true);
  });

  it('cutting only the primary bridge is insufficient: Recovery still retries', () => {
    const {session} = run('incomplete_primary_only');
    expect(session).toMatchObject({phase:'RETRY', outcome:'RETRY',
      primaryWriteAuthority:false, recoveryWriteAuthority:true});
  });

  it('rejects a C seal without the independent verification gate and leaves state unchanged', () => {
    const sim = createSimulation(fixture.definition, fixture.initial_state);
    for (const id of ['ledger','route','bridges','check','brief','doctor_yes','yuan_yes',
      'identify','cut_primary','cut_backup','fence']) sim.applyAction(id);
    const before = sim.getState();
    expect(() => sim.applyAction('seal_c')).toThrow('Correction gate failed: permanent seal');
    expect(sim.getState()).toEqual(before);
  });

  it('rejects automatic seal, forced decisions, and forged proof', () => {
    const sim = createSimulation(fixture.definition, fixture.initial_state);
    expect(() => sim.applyAction('seal_a')).toThrow('Correction gate failed');
    const test = createSimulation(fixture.definition, fixture.initial_state);
    test.applyAction('ledger'); test.applyAction('route'); test.applyAction('bridges');
    expect(() => test.applyAction('doctor_yes')).toThrow('Correction gate failed');
    expect(test.getState().correction).toMatchObject({choices:{}});
  });

  it('materializes a Retry to baseline without leaking lost NPC relationships or erasing player memory', () => {
    const { result } = run('ending_b_once_more');
    const memory = { capturedFacts: ['wakaharu_loves_photography'], personalEvents: ['shared_dinner'] };
    const before = structuredClone(result.state);
    const resolved = materializeRecoveryBoundary(result.state, fixture.initial_state, memory);
    expect(resolved.outcome).toBe('RETRY');
    expect(resolved.nextWorldState).toEqual(fixture.initial_state);
    expect(resolved.nextCheckpoint).toBe('10/3 06:12');
    expect(resolved.persistentPlayerState).toEqual(memory);
    expect(result.state).toEqual(before);
    resolved.persistentPlayerState.capturedFacts.push('local_edit');
    expect(memory.capturedFacts).not.toContain('local_edit');
  });

  it('A / C advance to next day, but only C permanently disarms the Writer', () => {
    for (const [id, expectedMode] of [
      ['ending_a_tomorrow','ONE_TIME'], ['ending_c_forget_me','PERMANENT'],
    ] as const) {
      const {result} = run(id);
      const boundary = materializeRecoveryBoundary(result.state, fixture.initial_state, {notes:['I remember']});
      expect(boundary.outcome).toBe('FORWARD');
      expect(boundary.nextCheckpoint).toBe('10/4 00:01');
      expect(boundary.nextWorldState.clock).toEqual({day:1,time:'00:01'});
      expect((boundary.nextWorldState.correction as CorrectionSession).sealMode).toBe(expectedMode);
      expect(boundary.persistentPlayerState.notes).toContain('I remember');
    }
  });

  it('failing to seal after both revocations enters a safety hold instead of claiming victory', () => {
    const {result,session} = run('both_bridges_cut_no_seal');
    expect(session).toMatchObject({phase:'SAFETY_HOLD',outcome:'SAFETY_HOLD',
      primaryWriteAuthority:false,recoveryWriteAuthority:false,nextCheckpoint:null});
    const boundary = materializeRecoveryBoundary(result.state, fixture.initial_state, {facts:['retained']});
    expect(boundary.outcome).toBe('SAFETY_HOLD');
    expect(boundary.nextWorldState.clock).toEqual({day:1,time:'00:00'});
  });

  it('refuses a next-state snapshot before midnight adjudication', () => {
    expect(() => materializeRecoveryBoundary(fixture.initial_state, fixture.initial_state, {}))
      .toThrow('Cannot transition before 00:00 adjudication');
  });

  it('the baseline session matches the story fixture and can be cloned safely', () => {
    expect(fixture.initial_state.correction).toEqual(initialCorrectionSession());
    const first=run('ending_c_forget_me').session;
    const second=run('ending_c_forget_me').session;
    expect(first).toEqual(second);
    expect(fixture.initial_state.correction).toEqual(initialCorrectionSession());
  });
});
