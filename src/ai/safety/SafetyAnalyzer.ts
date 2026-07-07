import { ExplainableSafetyReport, PatientMemory } from '../types';

export class SafetyAnalyzer {
  /**
   * Analyzes a new prescription against the patient's existing memory context
   * to produce an explainable safety report and a risk fingerprint.
   */
  public analyzePrescription(newPrescription: string, memory: PatientMemory): {
    report: ExplainableSafetyReport;
    riskFingerprint: string[];
  } {
    // In a real system, this would query a pharmacological database 
    // and an LLM to identify deep interactions based on the memory.facts and memory.experiences.
    
    const riskFingerprint: string[] = [];
    
    // Mock Safety Intelligence Logic
    const isPenicillinAllergy = memory.facts.allergies?.toLowerCase().includes('penicillin');
    const isPrescribingPenicillin = newPrescription.toLowerCase().includes('amoxicillin') || newPrescription.toLowerCase().includes('penicillin');

    if (isPenicillinAllergy && isPrescribingPenicillin) {
      riskFingerprint.push('SEVERE_ALLERGY_CONFLICT');
      return {
        report: {
          severity: 'CRITICAL',
          detected: 'Severe Allergy Conflict Detected',
          whyItMatters: 'The patient has a confirmed allergy to Penicillin, which can cause anaphylaxis if exposed.',
          historicalContext: [`Fact: Verified Penicillin allergy.`],
          actionRecommended: 'ABORT PRESCRIPTION. Select a non-penicillin antibiotic alternative (e.g., Macrolides).'
        },
        riskFingerprint
      };
    }

    // Checking for interactions with previous experiences
    const hasDizzinessExperience = memory.experiences.some(exp => exp.toLowerCase().includes('dizziness') && exp.toLowerCase().includes('lisinopril'));
    const isPrescribingAceInhibitor = newPrescription.toLowerCase().includes('lisinopril') || newPrescription.toLowerCase().includes('enalapril');

    if (hasDizzinessExperience && isPrescribingAceInhibitor) {
      riskFingerprint.push('ACE_INHIBITOR_SENSITIVITY');
      return {
        report: {
          severity: 'MODERATE',
          detected: 'Potential Adverse Reaction Recurrence',
          whyItMatters: 'Patient previously reported dizziness while on Lisinopril.',
          historicalContext: memory.experiences.filter(exp => exp.includes('dizziness')),
          actionRecommended: 'Consider an ARB alternative or monitor blood pressure closely post-administration.'
        },
        riskFingerprint
      };
    }

    // Default safe response
    return {
      report: {
        severity: 'NONE',
        detected: 'No major interactions detected',
        whyItMatters: 'The prescribed medication does not conflict with known allergies or past experiences in the patient vault.',
        historicalContext: [],
        actionRecommended: 'Proceed with prescription.'
      },
      riskFingerprint
    };
  }
}
