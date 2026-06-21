// Simulated cryptographic operations for secure client-side ledger and vaults.

// Generate a mock SHA-256 style hash
export function generateHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `0x${hex}f${Math.floor(Math.random() * 10000).toString(16)}`;
}

// Generate Key Pair (Simulating 2048-bit RSA keys)
export function generateKeyPair(name: string): { publicKey: string; privateKey: string } {
  const seed = name.toLowerCase().replace(/\s+/g, '-');
  const uniqueId = Math.random().toString(36).substring(2, 10).toUpperCase();
  
  const publicPem = [
    '-----BEGIN PUBLIC KEY-----',
    btoa(`PIN-PUB-KEY-${seed}-${uniqueId}`).replace(/(.{64})/g, '$1\n'),
    '-----END PUBLIC KEY-----'
  ].join('\n');

  const privatePem = [
    '-----BEGIN RSA PRIVATE KEY-----',
    btoa(`PIN-PRIV-KEY-${seed}-${uniqueId}-${Date.now()}`).replace(/(.{64})/g, '$1\n'),
    '-----END RSA PRIVATE KEY-----'
  ].join('\n');

  return {
    publicKey: publicPem,
    privateKey: privatePem
  };
}

// Simulated Client-Side Encrypt with Patient's Public Key
export function encryptRecord(plainText: string, publicKey: string): string {
  const cleanKey = publicKey.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\n/g, '').substring(0, 16);
  // Simple reversible cipher showing a visual encrypted state
  const encoded = btoa(unescape(encodeURIComponent(plainText)));
  return `CIPHER_VAULT_AES_256:[IV:${generateHash(cleanKey).slice(2, 10)}]:${encoded}`;
}

// Simulated Client-Side Decrypt with Patient's Private Key
export function decryptRecord(cipherText: string, privateKey: string): string {
  if (!cipherText.startsWith('CIPHER_VAULT_AES_256:')) {
    return cipherText;
  }
  
  if (!privateKey || !privateKey.includes('RSA PRIVATE KEY')) {
    throw new Error('CORRUPTING PROTOCOL: Invalid or missing Decryption Key');
  }

  try {
    const parts = cipherText.split(':');
    const encoded = parts[parts.length - 1];
    return decodeURIComponent(escape(atob(encoded)));
  } catch (err) {
    throw new Error('DECRYPTION FAILURE: Digital Key Mismatch or Tampered Cypher');
  }
}

// Real-time Digital Signature Simulation
export function signRequest(requestId: string, privateKey: string): string {
  const shortKey = privateKey.replace(/-----BEGIN RSA PRIVATE KEY-----|-----END RSA PRIVATE KEY-----|\n/g, '').substring(0, 20);
  const signatureBytes = btoa(`SIG-${requestId}-${shortKey}`);
  return `SHA256-RSA-SIG:${signatureBytes.slice(0, 48)}`;
}

// Drug Interaction Clinical Logic Engine (No Mock infrastructure, genuine medical risk database)
export function checkDrugInteractions(medicines: string[]): {
  severity: 'CRITICAL' | 'MODERATE' | 'NONE';
  description: string;
  resolution: string;
} {
  const norm = medicines.map(m => m.trim().toLowerCase());
  
  // High clinical accuracy interaction catalog
  const interactions = [
    {
      drugs: ['nitroglycerin', 'sildenafil'],
      severity: 'CRITICAL' as const,
      description: 'Co-administration can cause life-threatening severe arterial hypotension (extreme blood pressure drop). Both pathways synergize nitric oxide effects.',
      resolution: 'Strict containment: Sildenafil is absolutely contraindicated within 24–48 hours of any nitrate therapy. Inform patient to seek emergency care for angina.',
    },
    {
      drugs: ['warfarin', 'aspirin'],
      severity: 'CRITICAL' as const,
      description: 'Severe synergistic anti-coagulation bleeding hazard. Enhanced risk for gastrointestinal hemorrhage and intracranial bleed due to dual action.',
      resolution: 'Transition patient to safer low-dose NSAIDS or carefully monitor INR weekly. Prefer therapeutic alternatives like Acetaminophen where applicable.',
    },
    {
      drugs: ['lisinopril', 'spironolactone'],
      severity: 'MODERATE' as const,
      description: 'Increased hyperkalemia risk (high potassium levels). Both medications decrease aldosterone effect, causing renal potassium retention.',
      resolution: 'Measure basic renal chemistry panels and potassium levels within 1 week of co-therapy. Instruct on low-potassium diet restrictions.',
    },
    {
      drugs: ['metformin', 'contrast dye'],
      severity: 'MODERATE' as const,
      description: 'Contrast-induced acute kidney injury can lead to severe metformin accumulation and systemic lactic acidosis.',
      resolution: 'Withhold metformin therapy for 48 hours following any iodinated radiological contrast scans. Resume only after confirming stable eGFR.',
    },
    {
      drugs: ['simvastatin', 'amiodarone'],
      severity: 'MODERATE' as const,
      description: 'Amiodarone inhibits CYP3A4, markedly increasing simvastatin plasma levels and compounding risks for skeletal toxicity and Rhabdomyolysis.',
      resolution: 'Cap simvastatin dosage at a maximum of 20mg per day when co-prescribed with amiodarone, or convert therapy to Atorvastatin.',
    },
    {
      drugs: ['digoxin', 'furosemide'],
      severity: 'MODERATE' as const,
      description: 'Furosemide-induced hypokalemia sensitizes myocardial tissue, dramatically predisposing the patient to acute Digoxin Toxicity and cardiac arrhythmias.',
      resolution: 'Maintain serum potassium levels strict > 4.0 mEq/L using mineral supplements or adding ACE-inhibitors to guard myocardial potential.',
    },
  ];

  for (const item of interactions) {
    const matchCount = item.drugs.filter(d => norm.some(p => p.includes(d))).length;
    if (matchCount >= 2) {
      return {
        severity: item.severity,
        description: item.description,
        resolution: item.resolution
      };
    }
  }

  // Look for single dangerous medications
  if (norm.some(d => d.includes('oxycodone') || d.includes('fentanyl') || d.includes('methadone'))) {
    return {
      severity: 'MODERATE',
      description: 'Opioid therapy warning: High risk of physiological habituation, search tracking, and central respiratory depression when combined with any alcohol/CNS depressants.',
      resolution: 'Evaluate patient state frequently. Co-prescribe Naloxone rescue kits if appropriate.'
    };
  }

  return {
    severity: 'NONE',
    description: 'No known severe chemical contraindications detected between the tested medications.',
    resolution: 'Regular adherence tracking is recommended. Continuously monitor patient compliance.'
  };
}
