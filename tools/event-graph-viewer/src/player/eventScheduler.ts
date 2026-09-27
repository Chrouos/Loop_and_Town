import { BELL_MINUTE, CONVERGENCE_MINUTE, LOOP_START_MINUTE, RESET_MINUTE, type CriticalBoundaryId } from './clock';
import type { LoopSave } from './model';
import { createSimulation } from '../simulator/simulator';
import { fromAbsoluteMinute, toAbsoluteMinute } from '../simulator/time';
import type { SimulationDefinition, SimulationResult, WorldState } from '../simulator/types';

export type AdvanceIntent = 'BOOTSTRAP' | 'OFFLINE' | 'FOREGROUND';

export type CriticalBoundary = {
  id: CriticalBoundaryId;
  minute: number;
  title: string;
};

export type AdvanceLoopInput = {
  definition: SimulationDefinition;
  initialState: WorldState;
  loop: LoopSave;
  fromMinute: number;
  targetMinute: number;
  intent: AdvanceIntent;
};

export type AdvanceLoopResult = {
  reachedMinute: number;
  pendingBoundary?: CriticalBoundaryId;
  simulation: SimulationResult;
};

const BOUNDARIES: CriticalBoundary[] = [
  { id: 'convergence', minute: CONVERGENCE_MINUTE, title: 'Convergence' },
  { id: 'bell', minute: BELL_MINUTE, title: 'Bell' },
  { id: 'reset', minute: RESET_MINUTE, title: 'Reset' },
];

export function firstCriticalBoundary(fromMinute: number, toMinute: number): CriticalBoundary | undefined {
  return BOUNDARIES.find(boundary => boundary.minute > fromMinute && boundary.minute <= toMinute);
}

function runSimulation(input: AdvanceLoopInput, targetMinute: number): SimulationResult {
  const simulation = createSimulation(input.definition, input.initialState);
  const actionMap = new Map(input.definition.actions.map(action => [action.id, action]));
  for (const actionId of input.loop.actionIds) {
    const action = actionMap.get(actionId);
    if (action && toAbsoluteMinute(action.at) <= targetMinute) simulation.applyAction(action);
  }
  simulation.runUntil(fromAbsoluteMinute(targetMinute));
  return { state: simulation.getState(), history: simulation.getHistory() };
}

function historyAfter(result: SimulationResult, fromMinute: number): SimulationResult {
  return { ...result, history: result.history.filter(entry => (entry.absoluteMinute ?? entry.minute) > fromMinute) };
}

export function advanceLoop(input: AdvanceLoopInput): AdvanceLoopResult {
  const fromMinute = Math.max(LOOP_START_MINUTE, input.fromMinute);
  const requestedTarget = Math.max(fromMinute, input.targetMinute);
  const pending = input.loop.clock.pendingCriticalBoundary;

  if (input.intent === 'FOREGROUND') {
    const boundary = BOUNDARIES.find(item => item.id === pending);
    if (!boundary) {
      const simulation = runSimulation(input, fromMinute);
      return { reachedMinute: fromMinute, simulation: historyAfter(simulation, fromMinute) };
    }
    const simulation = runSimulation(input, boundary.minute);
    return { reachedMinute: boundary.minute, simulation: historyAfter(simulation, fromMinute) };
  }

  const boundary = input.intent === 'OFFLINE'
    ? firstCriticalBoundary(fromMinute, requestedTarget)
    : undefined;
  const exactBootstrapBoundary = input.intent === 'BOOTSTRAP'
    ? BOUNDARIES.some(item => item.minute === requestedTarget && item.minute > fromMinute)
    : false;
  const reachedMinute = boundary?.minute ?? requestedTarget;
  const simulationTarget = exactBootstrapBoundary ? Math.max(fromMinute, reachedMinute - 1) : reachedMinute;
  const simulation = runSimulation(input, simulationTarget);
  return {
    reachedMinute,
    pendingBoundary: boundary?.id ?? (exactBootstrapBoundary ? BOUNDARIES.find(item => item.minute === requestedTarget)?.id : undefined),
    simulation: historyAfter(simulation, fromMinute),
  };
}
