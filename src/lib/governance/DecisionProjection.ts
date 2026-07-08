import { BaseEventEnvelope, DecisionReadModel } from './types';

export class DecisionProjection {
  // In Phase 1, we mock the PostgreSQL `decision_read_model` table.
  private static readModelTable = new Map<string, DecisionReadModel>();

  /**
   * Synchronously projects an event into the Read Model.
   * This is called by the CommandDispatcher immediately after saving to the EventStore.
   */
  static apply(event: BaseEventEnvelope): void {
    const id = event.aggregate_id;
    let model = this.readModelTable.get(id);

    if (!model) {
      // Initialize if this is the first event for this aggregate
      model = {
        decision_id: id,
        parent_decision_id: event.payload?.parentDecisionId,
        override_chain_depth: event.payload?.parentDecisionId ? 1 : 0, // Simplified for Phase 1
        correlation_id: event.correlation_id,
        current_state: 'PENDING',
        prediction_probability: 0,
        decision_confidence: 0,
        created_at: event.event_time,
        last_updated_at: event.event_time,
        last_event_version: 0,
        projection_hash: ''
      };
    }

    // Protection against out-of-order projections
    if (event.version <= model.last_event_version) return;

    // Projection Logic (Fold state)
    switch (event.event_type) {
      case 'PredictionCreated':
        model.prediction_probability = event.payload.probability;
        break;
      
      case 'GovernanceReviewed':
        model.current_state = 'UNDER_REVIEW';
        // Note: The Decision Confidence is updated here, independent of the model's confidence!
        model.decision_confidence = event.payload.decisionConfidence;
        break;
        
      case 'HumanOverrideRequested':
        if (event.payload.assignedTo) {
           model.current_state = 'ASSIGNED';
           model.assigned_to = event.payload.assignedTo;
           model.assigned_at = event.event_time;
           model.assignment_reason = event.payload.assignmentReason;
        } else {
           model.current_state = 'OVERRIDE_PENDING';
        }
        break;

      case 'DecisionApproved':
      case 'HumanOverrideApproved':
        model.current_state = 'APPROVED';
        model.final_verdict = event.payload.verdict || 'EXECUTE';
        break;

      case 'DecisionRejected':
      case 'HumanOverrideRejected':
        model.current_state = 'REJECTED';
        model.final_verdict = 'REJECT';
        break;
    }

    model.last_updated_at = event.event_time;
    model.last_event_version = event.version;
    
    // Very basic deterministic hash representation (Phase 1)
    model.projection_hash = this.generateHash(model);

    this.readModelTable.set(id, model);
  }

  private static generateHash(model: DecisionReadModel): string {
    const dataString = `${model.decision_id}:${model.current_state}:${model.prediction_probability}:${model.decision_confidence}:${model.final_verdict}:${model.last_event_version}`;
    let hash = 0;
    for (let i = 0; i < dataString.length; i++) {
      hash = ((hash << 5) - hash) + dataString.charCodeAt(i);
      hash |= 0; 
    }
    return hash.toString(16);
  }

  /**
   * Disaster Recovery: Rebuild the entire projection from the Event Store.
   */
  static rebuild(eventStream: BaseEventEnvelope[]): void {
    this.readModelTable.clear();
    for (const event of eventStream) {
      this.apply(event);
    }
  }

  static get(aggregateId: string): DecisionReadModel | undefined {
    return this.readModelTable.get(aggregateId);
  }
}
