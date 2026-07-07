export type RoutePath = 'FAST_EXTRACTION' | 'RULES_ENGINE' | 'DEEP_REASONING' | 'ESCALATION';

export type AIQueryType = 
  | 'NORMALIZE_DRUG_NAME'
  | 'ALLERGY_CONFLICT'
  | 'DRUG_INTERACTION'
  | 'FRAUD_CHECK'
  | 'GENERAL_CLINICAL_QUERY';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface AIQuery {
  id: string;
  type: AIQueryType;
  patientId: string;
  payload: Record<string, any>;
  riskLevel: RiskLevel;
}

export interface PatientMemory {
  facts: Record<string, string>; // Confirmed allergies, diagnoses
  experiences: string[];         // Prior prescriptions, adverse reactions
  summaries: string;             // Condensed profile
  beliefs: string[];             // Inferred risks awaiting clinical confirmation
}

export interface ExplainableSafetyReport {
  severity: 'CRITICAL' | 'MODERATE' | 'NONE';
  detected: string;
  whyItMatters: string;
  historicalContext: string[];
  actionRecommended: string;
}

export interface AnalysisResponse {
  routeUsed: RoutePath;
  explainableSafetyReport?: ExplainableSafetyReport;
  riskFingerprint: string[];
  normalizedData?: any;
}

export interface FraudCheckResponse {
  fraudSuspicionScore: number;
  flaggedReason: string;
  humanReviewRequired: boolean;
}

export interface ConsentVerificationRequest {
  patientId: string;
  requesterId: string;
  signature: string;
  purpose: string;
}

export interface ConsentVerificationResponse {
  authorized: boolean;
  grantedScopes: string[];
}
