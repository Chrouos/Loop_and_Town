import { getPath, hasPath, setPath } from './state';
import type { StateChange, WorldState } from './types';

// Author truth. Do not expose it as the player's automatically discovered knowledge.
export type EvidenceId = 'ledger_conflict' | 'bridge_map' | 'route_exposure' | 'independent_check';
export type ActorId = 'wakaharu' | 'doctor' | 'reporter' | 'detective' | 'yuan';
export type CorrectionSession = {
  phase: 'OPEN' | 'UNRESOLVED' | 'FORWARD_SEALED' | 'RETRY' | 'SAFETY_HOLD';
  feedbackMismatch: boolean;
  pendingCorrection: boolean;
  primaryWriteAuthority: boolean;
  recoveryWriteAuthority: boolean;
  bridgesIdentified: boolean;
  epochFenced: boolean;
  isolationVerified: boolean;
  riskDisclosed: boolean;
  evidence: Array<{ id: EvidenceId; source: ActorId }>;
  choices: Partial<Record<ActorId, 'participate' | 'decline'>>;
  sealMode: 'NONE' | 'ONE_TIME' | 'PERMANENT';
  finalCheckDone: boolean;
  outcome: 'PENDING' | 'FORWARD' | 'RETRY' | 'SAFETY_HOLD';
  nextCheckpoint: string | null;
};
export type CorrectionCommand =
  | { op: 'converge' | 'disclose_risk' | 'identify_bridges' | 'revoke_primary' | 'revoke_recovery'
    | 'fence_epoch' | 'verify_isolation' | 'seal_one_time' | 'seal_permanent' | 'final_check' | 'adjudicate' }
  | { op: 'record_evidence'; id: EvidenceId; source: ActorId }
  | { op: 'record_choice'; actor: ActorId; choice: 'participate' | 'decline' };

const ops = ['converge', 'record_evidence', 'record_choice', 'disclose_risk', 'identify_bridges',
  'revoke_primary', 'revoke_recovery', 'fence_epoch', 'verify_isolation',
  'seal_one_time', 'seal_permanent', 'final_check', 'adjudicate'];
const evidenceIds = ['ledger_conflict', 'bridge_map', 'route_exposure', 'independent_check'];
const actors = ['wakaharu', 'doctor', 'reporter', 'detective', 'yuan'];

export function initialCorrectionSession(): CorrectionSession {
  return {
    phase: 'OPEN', feedbackMismatch: false, pendingCorrection: false,
    primaryWriteAuthority: true, recoveryWriteAuthority: true,
    bridgesIdentified: false, epochFenced: false, isolationVerified: false,
    riskDisclosed: false, evidence: [], choices: {},
    sealMode: 'NONE', finalCheckDone: false, outcome: 'PENDING', nextCheckpoint: null,
  };
}

export function validateCorrectionCommand(value: unknown): asserts value is CorrectionCommand {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Malformed correction command');
  const c = value as Record<string, unknown>;
  if (!ops.includes(String(c.op))) throw new Error('Unknown correction operation');
  const additional = c.op === 'record_evidence' ? ['id', 'source'] : c.op === 'record_choice' ? ['actor', 'choice'] : [];
  if (Object.keys(c).some(k => k !== 'op' && !additional.includes(k))) throw new Error('Unexpected correction field');
  if (c.op === 'record_evidence' && (!evidenceIds.includes(String(c.id)) || !actors.includes(String(c.source)) || Object.keys(c).length !== 3))
    throw new Error('Invalid correction evidence');
  if (c.op === 'record_choice' && (!actors.includes(String(c.actor)) || !['participate', 'decline'].includes(String(c.choice)) || Object.keys(c).length !== 3))
    throw new Error('Invalid correction choice');
}

export function getCorrectionSession(state: WorldState): CorrectionSession {
  if (!hasPath(state, 'correction')) throw new Error('CorrectionSession not configured');
  const value = getPath(state, 'correction') as CorrectionSession;
  if (!value || !Array.isArray(value.evidence) || !value.choices || Array.isArray(value.choices))
    throw new Error('Malformed CorrectionSession');
  return value;
}

export function reduceCorrection(before: CorrectionSession, command: CorrectionCommand): CorrectionSession {
  const s = structuredClone(before);
  const requireGate = (ok: boolean, reason: string) => { if (!ok) throw new Error('Correction gate failed: ' + reason); };
  const recorded = (id: EvidenceId) => s.evidence.some(e => e.id === id);
  const distinctSources = () => new Set(s.evidence.map(e => e.source)).size;
  const informedParticipation = () => s.riskDisclosed && Object.values(s.choices).filter(x => x === 'participate').length >= 2;

  if (command.op === 'converge') {
    requireGate(s.phase === 'OPEN', 'convergence already recorded');
    s.phase = 'UNRESOLVED'; s.feedbackMismatch = true; s.pendingCorrection = true;
    return s;
  }
  if (command.op === 'final_check') {
    requireGate(!s.finalCheckDone && (s.phase === 'UNRESOLVED' || s.phase === 'FORWARD_SEALED'), 'invalid final check');
    s.finalCheckDone = true;
    return s;
  }
  if (command.op === 'adjudicate') {
    requireGate(s.finalCheckDone && s.outcome === 'PENDING', 'final check required');
    if (s.phase === 'FORWARD_SEALED') {
      s.outcome = 'FORWARD'; s.nextCheckpoint = '10/4 00:01';
    } else if (s.primaryWriteAuthority || s.recoveryWriteAuthority) {
      s.phase = 'RETRY'; s.outcome = 'RETRY'; s.nextCheckpoint = '10/3 06:12';
    } else {
      s.phase = 'SAFETY_HOLD'; s.outcome = 'SAFETY_HOLD';
    }
    return s;
  }
  requireGate(s.phase === 'UNRESOLVED' && !s.finalCheckDone, 'intervention window closed');
  switch (command.op) {
    case 'record_evidence':
      requireGate(!recorded(command.id), 'evidence already recorded');
      s.evidence.push({ id: command.id, source: command.source }); break;
    case 'disclose_risk':
      requireGate(recorded('ledger_conflict') && recorded('route_exposure') && distinctSources() >= 2, 'insufficient risk evidence');
      s.riskDisclosed = true; break;
    case 'record_choice':
      requireGate(s.riskDisclosed && !s.choices[command.actor], 'choice not informed or already made');
      s.choices[command.actor] = command.choice; break;
    case 'identify_bridges':
      requireGate(recorded('ledger_conflict') && recorded('bridge_map') && distinctSources() >= 2, 'bridge evidence missing');
      s.bridgesIdentified = true; break;
    case 'revoke_primary':
      requireGate(s.bridgesIdentified && informedParticipation(), 'primary writer revocation unauthorized');
      s.primaryWriteAuthority = false; break;
    case 'revoke_recovery':
      requireGate(s.bridgesIdentified && informedParticipation(), 'backup writer revocation unauthorized');
      s.recoveryWriteAuthority = false; break;
    case 'fence_epoch':
      requireGate(!s.primaryWriteAuthority && !s.recoveryWriteAuthority, 'both bridges must be revoked');
      s.epochFenced = true; break;
    case 'verify_isolation':
      requireGate(s.epochFenced && recorded('independent_check')
        && s.evidence.find(e => e.id === 'independent_check')?.source !== s.evidence.find(e => e.id === 'bridge_map')?.source,
        'independent isolation proof required');
      s.isolationVerified = true; break;
    case 'seal_one_time':
      requireGate(informedParticipation() && recorded('ledger_conflict'), 'one-time seal lacks informed participation');
      s.phase = 'FORWARD_SEALED'; s.sealMode = 'ONE_TIME'; s.pendingCorrection = false; break;
    case 'seal_permanent':
      requireGate(informedParticipation() && s.bridgesIdentified && !s.primaryWriteAuthority && !s.recoveryWriteAuthority
        && s.epochFenced && s.isolationVerified, 'permanent seal needs verified dual bridge isolation');
      s.phase = 'FORWARD_SEALED'; s.sealMode = 'PERMANENT'; s.pendingCorrection = false; break;
    default:
      throw new Error('Unsupported correction command: ' + command.op);
  }
  return s;
}

export function executeCorrectionCommand(state: WorldState, command: CorrectionCommand): StateChange {
  validateCorrectionCommand(command);
  return setPath(state, 'correction', reduceCorrection(getCorrectionSession(state), command));
}
