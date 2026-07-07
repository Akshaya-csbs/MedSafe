import { AIQuery, RoutePath } from '../types';

export class CascadeRouter {
  /**
   * Routes the incoming query to the most appropriate processing path
   * based on its complexity, risk level, and urgency.
   */
  public routeRequest(query: AIQuery): RoutePath {
    // 1. Check for immediate extraction tasks
    if (query.type === 'NORMALIZE_DRUG_NAME') {
      return 'FAST_EXTRACTION';
    }
    
    // 2. Check for high-risk or deep analytical tasks
    if (
      query.riskLevel === 'HIGH' || 
      query.type === 'ALLERGY_CONFLICT' || 
      query.type === 'DRUG_INTERACTION'
    ) {
      return 'DEEP_REASONING';
    }

    // 3. Check if the task is ambiguous or escalates beyond rules
    if (query.type === 'FRAUD_CHECK' && query.riskLevel === 'MEDIUM') {
      // Fraud checks might start as rules, but medium risk escalates to reasoning
      return 'ESCALATION';
    }

    // 4. Default fallback to standard deterministic checks
    return 'RULES_ENGINE';
  }

  /**
   * Generates a routing explanation to maintain explainability.
   */
  public getRoutingExplanation(query: AIQuery, route: RoutePath): string {
    switch (route) {
      case 'FAST_EXTRACTION':
        return `Query ${query.id} routed to FAST_EXTRACTION due to low-complexity type: ${query.type}.`;
      case 'DEEP_REASONING':
        return `Query ${query.id} routed to DEEP_REASONING due to elevated risk level (${query.riskLevel}) or complex task type (${query.type}).`;
      case 'ESCALATION':
        return `Query ${query.id} routed to ESCALATION due to ambiguity or boundary risk level.`;
      case 'RULES_ENGINE':
      default:
        return `Query ${query.id} routed to RULES_ENGINE as a standard deterministic processing path.`;
    }
  }
}
