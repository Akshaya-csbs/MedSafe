import { FraudCheckResponse } from '../types';

export class FraudDetector {
  /**
   * Analyzes activity to assign a fraud suspicion score.
   */
  public analyzeActivity(
    patientId: string, 
    activityType: string, 
    medication: string, 
    recentAccessLogs: any[]
  ): FraudCheckResponse {
    
    // In a production system, this involves anomaly detection algorithms
    // on geographical access, time-of-day access, and overlapping refill patterns.

    let score = 10; // Base score
    let flaggedReason = "Standard behavior within normal parameters.";
    let humanReviewRequired = false;

    if (activityType === 'EARLY_REFILL_REQUEST') {
      // Mock logic: check if there are multiple requests
      const recentRefills = recentAccessLogs.filter(log => log.action === 'REFILL_REQUEST' && log.medication === medication);
      
      if (recentRefills.length > 1) {
        score = 85;
        flaggedReason = `Multiple early refill requests detected for ${medication} across different clinical endpoints within a short time frame.`;
        humanReviewRequired = true;
      } else {
        score = 35;
        flaggedReason = "Early refill requested, but no widespread duplicate requests detected.";
      }
    }

    if (activityType === 'UNUSUAL_GEO_ACCESS') {
      score = 75;
      flaggedReason = "Clinical request originated from an IP outside the patient's registered state boundary.";
      humanReviewRequired = true;
    }

    return {
      fraudSuspicionScore: score,
      flaggedReason,
      humanReviewRequired
    };
  }
}
