import { BaseCommand, BaseEventEnvelope, DecisionReadModel, OverrideRole } from './types';
import { EventSourcingLedger } from './EventSourcingLedger';
import { CommandDispatcher } from './CommandDispatcher';
import { DecisionProjection } from './DecisionProjection';
import crypto from 'crypto';

export class OverrideCommandHandler {

  /**
   * MAKER triggers this. Generates a NEW Decision Object linked to the parent.
   */
  static requestOverride(
    commandId: string,
    idempotencyKey: string,
    parentDecisionId: string,
    correlationId: string,
    makerUserId: string,
    reason: string
  ): void {
    
    // In real implementation, check auth: hasRole(makerUserId, 'MAKER')
    
    // We create a completely NEW aggregate ID for the override decision
    // Immutable rule: We never UPDATE the old decision.
    const newDecisionId = crypto.randomUUID();
    
    const command: BaseCommand = {
      command_id: commandId,
      idempotency_key: idempotencyKey,
      correlation_id: correlationId,
      actor: makerUserId,
      payload: { parentDecisionId, reason }
    };

    CommandDispatcher.dispatch(command, (cmd) => [
      CommandDispatcher.createEnvelope(
        'HumanOverrideRequested',
        newDecisionId,
        cmd.correlation_id,
        cmd.command_id,
        cmd.actor,
        1, // Version 1 of the NEW decision aggregate
        cmd.payload
      )
    ]);
  }

  /**
   * REVIEWER / EXECUTOR triggers this to assign ownership before approving.
   */
  static assignOverride(
    commandId: string,
    idempotencyKey: string,
    decisionId: string, // The NEW decision ID
    correlationId: string,
    assigneeUserId: string,
    assignmentReason: string
  ): void {
    // Check Auth: hasRole(assigneeUserId, 'REVIEWER')
    
    const currentVersion = EventSourcingLedger.getStream(decisionId).length;

    const command: BaseCommand = {
      command_id: commandId,
      idempotency_key: idempotencyKey,
      correlation_id: correlationId,
      actor: assigneeUserId,
      payload: { assignedTo: assigneeUserId, assignmentReason }
    };

    CommandDispatcher.dispatch(command, (cmd) => [
      CommandDispatcher.createEnvelope(
        'HumanOverrideRequested', // This could be 'GovernanceAssigned' logically
        decisionId,
        cmd.correlation_id,
        cmd.command_id,
        cmd.actor,
        currentVersion + 1,
        cmd.payload
      )
    ]);
  }

  /**
   * APPROVER triggers this to finalize the override execution.
   */
  static approveOverride(
    commandId: string,
    idempotencyKey: string,
    decisionId: string,
    correlationId: string,
    approverUserId: string,
    finalVerdict: 'EXECUTE' | 'REJECT' | 'PAPER_ONLY'
  ): void {
    // Check Auth: hasRole(approverUserId, 'APPROVER')
    
    const stream = EventSourcingLedger.getStream(decisionId);
    const currentVersion = stream.length;
    
    if (currentVersion === 0) {
      throw new Error("Cannot approve an override that doesn't exist.");
    }

    const command: BaseCommand = {
      command_id: commandId,
      idempotency_key: idempotencyKey,
      correlation_id: correlationId,
      actor: approverUserId,
      payload: { verdict: finalVerdict, override_policy_version: 'v1.0' }
    };

    CommandDispatcher.dispatch(command, (cmd) => [
      CommandDispatcher.createEnvelope(
        'HumanOverrideApproved',
        decisionId,
        cmd.correlation_id,
        cmd.command_id,
        cmd.actor,
        currentVersion + 1,
        cmd.payload
      )
    ]);
  }
}
