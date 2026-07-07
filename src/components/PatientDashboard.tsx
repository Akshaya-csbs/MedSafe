import React, { useState } from 'react';
import { Shield, Key, FileText, Lock, Plus, Check, X, LogOut, Radio, HelpCircle, Eye, EyeOff, AlertTriangle, AlertCircle, Copy, Database, Sparkles, RefreshCcw, UploadCloud, Image, Camera, Paperclip, Search, ZoomIn } from 'lucide-react';
import { UserProfile, MedicalRecord, AccessRequest, AuditLog } from '../types';
import { encryptRecord, decryptRecord, generateHash, signRequest, checkDrugInteractions } from '../utils/cryptoSim';
import { HindsightMemoryManager, PatientMemory } from '../ai';
import EncryptionVisualizer from './EncryptionVisualizer';

interface PatientDashboardProps {
  user: UserProfile;
  records: MedicalRecord[];
  requests: AccessRequest[];
  logs: AuditLog[];
  onLogout: () => void;
  onAddRecord: (record: MedicalRecord) => void;
  onUpdateRequestHandler: (requestId: string, status: 'APPROVED' | 'REJECTED' | 'REVOKED', digitalSignature?: string) => void;
  onAddLog: (action: string, status: 'SUCCESS' | 'WARNING' | 'ALERT', details: string) => void;
}

export default function PatientDashboard({
  user,
  records,
  requests,
  logs,
  onLogout,
  onAddRecord,
  onUpdateRequestHandler,
  onAddLog,
}: PatientDashboardProps) {
  // Navigation internal view
  const [activeTab, setActiveTab] = useState<'LOCKER' | 'DOCTORS' | 'LEDGER' | 'KEYCARD'>('LOCKER');

  // AI Memory State
  const [healthSummary, setHealthSummary] = useState<PatientMemory | null>(null);

  React.useEffect(() => {
    async function fetchMemory() {
      const memoryManager = new HindsightMemoryManager();
      const memory = await memoryManager.recall(user.id, 'FULL_VAULT_ACCESS', 'mock_consent_token', user.id);
      setHealthSummary(memory);
    }
    fetchMemory();
  }, [user.id]);

  // Input States for New Record Creation
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<'Prescription' | 'Lab Report' | 'Diagnosis' | 'Immunization'>('Prescription');
  const [newDoctorName, setNewDoctorName] = useState('');
  const [newDetails, setNewDetails] = useState('');
  const [newDrugs, setNewDrugs] = useState('');
  const [newPhotoUrl, setNewPhotoUrl] = useState('');

  // Local decryptions triggers for patient's own vault
  const [decryptedRecordIds, setDecryptedRecordIds] = useState<Record<string, string>>({});
  const [decryptionError, setDecryptionError] = useState<Record<string, string>>({});
  const [recordKeyInputs, setRecordKeyInputs] = useState<Record<string, string>>({});
  const [showingKeyInputIds, setShowingKeyInputIds] = useState<Record<string, boolean>>({});
  const [selectedZoomPhoto, setSelectedZoomPhoto] = useState<string | null>(null);

  // Encryption Visualizer Intermediary State
  const [visualData, setVisualData] = useState<{
    plain: string;
    cipher: string;
    active: boolean;
  } | null>(null);

  // Secure prompt toggle for authorization
  const [signingRequestId, setSigningRequestId] = useState<string | null>(null);
  const [privateKeyConfirmInput, setPrivateKeyConfirmInput] = useState(user.privateKey || '');
  const [privateKeyError, setPrivateKeyError] = useState('');

  // Key card toggles
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [copiedText, setCopiedText] = useState<'PUBLIC' | 'PRIVATE' | null>(null);

  // Passcode verification states
  const [isPasscodeModalOpen, setIsPasscodeModalOpen] = useState(false);
  const [passcodeAttempt, setPasscodeAttempt] = useState('');
  const [passcodeError, setPasscodeError] = useState('');

  const handleShowKeyClick = () => {
    if (showPrivateKey) {
      setShowPrivateKey(false);
    } else {
      setPasscodeAttempt('');
      setPasscodeError('');
      setIsPasscodeModalOpen(true);
    }
  };

  const handleVerifyPasscode = (e: React.FormEvent) => {
    e.preventDefault();
    const correctPasscode = user.passcode || 'password'; // Default demo passcode fallback
    if (passcodeAttempt === correctPasscode) {
      setShowPrivateKey(true);
      setIsPasscodeModalOpen(false);
      setPasscodeAttempt('');
      setPasscodeError('');
      onAddLog(
        'Private Key Unlocked',
        'SUCCESS',
        `Primacy owner successfully validated passcode and unlocked key-card view.`
      );
    } else {
      setPasscodeError('Incorrect security passcode. Please enter the correct passcode.');
      onAddLog(
        'Failed Private Key Unlock Attempt',
        'ALERT',
        `An attempt to unlock the private key-card with an invalid passcode was blocked.`
      );
    }
  };

  const filteredRecords = records.filter(rec => rec.patientId === user.id);
  const filteredRequests = requests.filter(req => req.patientId === user.id);
  const filteredLogs = logs.filter(log => {
    const isActor = log.actorName === user.name;
    const detailsLower = log.details ? log.details.toLowerCase() : '';
    const actionLower = log.action ? log.action.toLowerCase() : '';
    const userNameLower = user.name ? user.name.toLowerCase() : '';
    const userEmailLower = user.email ? user.email.toLowerCase() : '';
    const userIdLower = user.id ? user.id.toLowerCase() : '';

    const isMentioned = 
      (userNameLower && (detailsLower.includes(userNameLower) || actionLower.includes(userNameLower))) ||
      (userEmailLower && (detailsLower.includes(userEmailLower) || actionLower.includes(userEmailLower))) ||
      (userIdLower && (detailsLower.includes(userIdLower) || actionLower.includes(userIdLower)));

    return isActor || isMentioned;
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewPhotoUrl(reader.result as string);
        onAddLog(
          'Diagnostic Image Uploaded',
          'SUCCESS',
          `Selected local patient scan document: ${file.name} (${Math.round(file.size / 1024)} KB) and processed key buffers ready for browser pre-encryption.`
        );
      };
      reader.readAsDataURL(file);
    }
  };

  // Trigger Local Asymmetric Record Encryption
  const handleCreateRecordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newDetails) return;

    const finalMedicinesList = newDrugs
      ? newDrugs.split(',').map(m => m.trim()).filter(Boolean)
      : [];

    const simulatedEncrypted = encryptRecord(newDetails, user.publicKey);
    const simulatedHash = generateHash(newDetails);

    // Trigger visualizer
    setVisualData({
      plain: newDetails,
      cipher: simulatedEncrypted,
      active: true,
    });

    // Save record to local state
    const createdRecord: MedicalRecord = {
      id: `rec-${Math.random().toString(36).substring(2, 9)}`,
      patientId: user.id,
      title: newTitle,
      category: newCategory,
      doctorName: newDoctorName || 'Self Uploaded',
      date: new Date().toISOString().split('T')[0],
      details: newDetails,
      encryptedContent: simulatedEncrypted,
      hash: simulatedHash,
      medicines: finalMedicinesList,
      photoUrl: newPhotoUrl || undefined,
    };

    setTimeout(() => {
      onAddRecord(createdRecord);
      onAddLog(
        'Record Vault Appended',
        'SUCCESS',
        `Authorized new ${newCategory}: "${newTitle}" encrypted via personal primacy key pair.`
      );
      // Reset
      setNewTitle('');
      setNewDoctorName('');
      setNewDetails('');
      setNewDrugs('');
      setNewPhotoUrl('');
      setShowAddForm(false);
      setVisualData(null);
    }, 2800);
  };

  // Trigger Asymmetric Digital signature confirmation sequence
  const handleApproveAccessRequest = (requestId: string) => {
    // Stage for private key sign
    setSigningRequestId(requestId);
    setPrivateKeyError('');
  };

  const handleSignConfirm = () => {
    if (!signingRequestId) return;

    if (!privateKeyConfirmInput || !privateKeyConfirmInput.includes('RSA PRIVATE KEY')) {
      setPrivateKeyError('Invalid signature credential. To construct digital signature, your full PEM private key is required.');
      return;
    }

    // Generate SHA-256 RSA Signature
    const simulatedSignature = signRequest(signingRequestId, privateKeyConfirmInput);
    const targetRequest = requests.find(req => req.id === signingRequestId);

    if (targetRequest) {
      onUpdateRequestHandler(signingRequestId, 'APPROVED', simulatedSignature);
      onAddLog(
        'Access Consent Signed',
        'SUCCESS',
        `Digital signature validated. Granted decrypted medical read token key metadata to ${targetRequest.doctorName}.`
      );
    }

    setSigningRequestId(null);
  };

  // Revoke Doctor's Read Access instantly (Zero-Knowledge revoking)
  const handleRevokeDoctorAccess = (req: AccessRequest) => {
    onUpdateRequestHandler(req.id, 'REVOKED');
    onAddLog(
      'Doctor Access Revoked',
      'ALERT',
      `Primacy user Eleanor Vance revoked medical decrypted read token key from ${req.doctorName}.`
    );
  };

  const handleDecryptSelfRecord = (rec: MedicalRecord, passedKey?: string) => {
    const finalKey = passedKey || user.privateKey || 'MOCK_PEM_PRIVATE_KEY';
    try {
      const decodedPlain = decryptRecord(rec.encryptedContent, finalKey);
      setDecryptedRecordIds({
        ...decryptedRecordIds,
        [rec.id]: decodedPlain,
      });

      // Clear any past error on success
      const errs = { ...decryptionError };
      delete errs[rec.id];
      setDecryptionError(errs);

      const isCustom = !!passedKey;
      onAddLog(
        isCustom ? 'Self Record Decrypted with Custom Key' : 'Self Record Decrypted',
        'SUCCESS',
        `Patient Eleanor Vance decrypted own record "${rec.title}" with valid ${isCustom ? 'manually input custom cryptographic key' : 'personal primacy credential key'}.`
      );
    } catch (err: any) {
      setDecryptionError({
        ...decryptionError,
        [rec.id]: err.message || 'Validation Failure: Cryptographic mismatch.'
      });
    }
  };

  const copyText = (txt: string, type: 'PUBLIC' | 'PRIVATE') => {
    navigator.clipboard.writeText(txt);
    setCopiedText(type);
    setTimeout(() => setCopiedText(null), 1500);
  };

  return (
    <div id="patient-dashboard-container" className="min-h-screen bg-[#fafafa] text-zinc-900 flex flex-col md:flex-row font-sans selection:bg-teal-100 selection:text-teal-900">
      
      {/* Visual Navigation Column */}
      <aside className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-zinc-200 flex flex-col justify-between shrink-0 shadow-sm">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8 animate-fade-in">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 shadow-sm overflow-hidden">
              <img src="/logo.jpeg" alt="MedSafe Logo" className="object-cover w-full h-full" />
            </div>
            <div>
              <h2 className="font-display font-bold text-zinc-900 leading-tight uppercase text-sm tracking-wide">
                Patient Locker
              </h2>
              <p className="font-mono text-[9px] text-teal-650 tracking-wider font-semibold">
                CRYPTOGRAPHIC ID ACTIVE
              </p>
            </div>
          </div>

          <div id="patient-identity-teaser" className="bg-blue-50/60 rounded-xl p-4 border border-blue-200/60 mb-6 flex flex-col">
            <span className="text-[9px] font-mono text-blue-400 uppercase font-semibold">Primacy Owner</span>
            <span className="font-display font-bold text-blue-950 text-sm truncate">{user.name}</span>
            <div className="mt-1.5 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[10px] font-mono text-blue-600 font-bold">Vault Connected</span>
            </div>
          </div>

          {/* Nav Tab Options */}
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('LOCKER')}
              className={`w-full text-left py-2.5 px-4 rounded-xl text-xs font-mono flex items-center gap-2.5 transition-all cursor-pointer ${
                activeTab === 'LOCKER'
                  ? 'bg-teal-700 text-white border border-teal-800 font-bold shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 border border-transparent'
              }`}
            >
              <FileText className="h-4 w-4" /> Secure Records ({filteredRecords.length})
            </button>
            <button
              onClick={() => { setActiveTab('DOCTORS'); setSigningRequestId(null); }}
              className={`w-full text-left py-2.5 px-4 rounded-xl text-xs font-mono flex items-center justify-between transition-all cursor-pointer ${
                activeTab === 'DOCTORS'
                  ? 'bg-teal-700 text-white border border-teal-800 font-bold shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 border border-transparent'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Shield className="h-4 w-4" /> Access & Approvals
              </span>
              {filteredRequests.some(r => r.status === 'PENDING') && (
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('LEDGER')}
              className={`w-full text-left py-2.5 px-4 rounded-xl text-xs font-mono flex items-center gap-2.5 transition-all cursor-pointer ${
                activeTab === 'LEDGER'
                  ? 'bg-teal-700 text-white border border-teal-800 font-bold shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 border border-transparent'
              }`}
            >
              <Radio className="h-4 w-4" /> Logs
            </button>
            <button
              onClick={() => setActiveTab('KEYCARD')}
              className={`w-full text-left py-2.5 px-4 rounded-xl text-xs font-mono flex items-center gap-2.5 transition-all cursor-pointer ${
                activeTab === 'KEYCARD'
                  ? 'bg-teal-700 text-white border border-teal-800 font-bold shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 border border-transparent'
              }`}
            >
              <Key className="h-4 w-4" /> Key Card
            </button>
          </nav>
        </div>

        {/* Logout widget */}
        <div className="p-6 border-t border-zinc-200 bg-zinc-50/50">
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-red-200/60 bg-red-50/50 hover:bg-red-100/50 text-zinc-900 py-2.5 px-4 text-xs font-mono font-semibold tracking-wide transition-all shadow-sm cursor-pointer"
          >
            <LogOut className="h-4 w-4" /> Shut Private Locker
          </button>
        </div>
      </aside>

      {/* Main Panel Area */}
      <main className="flex-1 p-6 md:p-8 lg:p-10 overflow-y-auto max-w-5xl">
        
        {/* TAB 1: Locker Dashboard Records */}
        {activeTab === 'LOCKER' && (
          <div id="patient-locker-view" className="space-y-6 bg-blue-50/30 backdrop-blur-sm p-6 md:p-8 rounded-3xl border border-blue-100/50 shadow-sm">
            
            {/* AI Health Summary */}
            {healthSummary && (
              <div className="bg-indigo-50/70 p-5 rounded-2xl border border-indigo-100/60 mb-6">
                <h3 className="font-display text-lg font-bold text-indigo-950 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-600" /> AI Health Summary (Hindsight Memory)
                </h3>
                <p className="text-sm font-sans text-indigo-800/80 mt-2 leading-relaxed">
                  {healthSummary.summaries}
                </p>
                <div className="mt-4 flex flex-col md:flex-row gap-4">
                  <div className="text-xs bg-white/60 p-3 rounded-lg flex-1">
                    <span className="font-bold text-indigo-900 block mb-1">Confirmed Facts:</span>
                    <ul className="list-disc list-inside text-indigo-700 space-y-0.5">
                      {Object.entries(healthSummary.facts).map(([key, val]) => (
                        <li key={key} className="capitalize">{key}: {val}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="text-xs bg-white/60 p-3 rounded-lg flex-1">
                    <span className="font-bold text-indigo-900 block mb-1">AI Inferred Beliefs:</span>
                    <ul className="list-disc list-inside text-indigo-700 space-y-0.5">
                      {healthSummary.beliefs.map((belief, idx) => (
                        <li key={idx}>{belief}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Header control */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-teal-50/70 p-5 rounded-2xl border border-teal-100/60 mb-6">
              <div>
                <h3 className="font-display text-2xl font-bold text-teal-950">Primacy Medical Records</h3>
                <p className="text-sm font-sans text-teal-800/80 mt-1 leading-relaxed">
                  Every document shown is encrypted locally prior to cloud transit. Only owners with Private Key credentials can unlock payloads.
                </p>
              </div>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-teal-800 hover:bg-teal-900 text-white font-bold px-4.5 py-2.5 text-xs tracking-wide transition-all shadow-sm cursor-pointer"
              >
                <Plus className="h-4 w-4" /> Add Record
              </button>
            </div>

            {/* Direct interactive sandbox encryptor */}
            {visualData?.active && (
              <EncryptionVisualizer
                plainText={visualData.plain}
                cipherText={visualData.cipher}
                isEncrypting={visualData.active}
              />
            )}

            {/* Add Record Form Panel */}
            {showAddForm && (
              <div id="add-record-panel" className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4 shadow-md">
                <div className="flex justify-between items-center pb-2 border-b border-zinc-150">
                  <h4 className="font-display font-bold text-zinc-900 text-sm uppercase tracking-wide">
                    Zero-Knowledge Record Generator
                  </h4>
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="text-zinc-400 hover:text-zinc-700 p-1.5 rounded hover:bg-zinc-100 cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <form onSubmit={handleCreateRecordSubmit} className="space-y-4 text-xs font-sans">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-mono text-zinc-500 mb-1.5 uppercase font-semibold">
                        Record Label / Title
                      </label>
                      <input
                        type="text"
                        required
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="e.g. Chest X-Ray, Blood panel"
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl py-2 px-3 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 transition-all hover:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-zinc-500 mb-1.5 uppercase font-semibold">
                        Category Type
                      </label>
                      <select
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value as any)}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl py-2 px-3 text-zinc-900 focus:outline-none h-[34px] cursor-pointer"
                      >
                        <option value="Prescription">Prescription</option>
                        <option value="Lab Report">Lab Report</option>
                        <option value="Diagnosis">Diagnosis</option>
                        <option value="Immunization">Immunization</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-zinc-500 mb-1.5 uppercase font-semibold">
                        Issuing Physician
                      </label>
                      <input
                        type="text"
                        value={newDoctorName}
                        onChange={(e) => setNewDoctorName(e.target.value)}
                        placeholder="e.g. Dr. Sarah Lin"
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl py-2 px-3 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 transition-all hover:bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-zinc-500 mb-1.5 uppercase font-semibold">
                      Clinical Report Payload (To Encrypt on Client-side)
                    </label>
                    <textarea
                      required
                      value={newDetails}
                      onChange={(e) => setNewDetails(e.target.value)}
                      placeholder="Write private diagnoses or lab stats. This text will undergo immediate local AES encrypting in your browser before saving."
                      rows={3}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl py-2 px-3 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 transition-all hover:bg-white leading-relaxed"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-zinc-500 mb-1.5 uppercase flex items-center justify-between font-semibold">
                      <span>Pharmacological Medicines list (Comma separated for AI Scanner check)</span>
                      <span className="text-teal-600 flex items-center gap-1 font-bold">
                        <Sparkles className="h-3 w-3 animate-spin text-teal-600" /> Cross-check active
                      </span>
                    </label>
                    <input
                      type="text"
                      value={newDrugs}
                      onChange={(e) => setNewDrugs(e.target.value)}
                      placeholder="e.g. Nitroglycerin, Sildenafil, Lisinopril, Spironolactone"
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl py-2 px-3 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 transition-all hover:bg-white"
                    />
                    <span className="text-[10px] text-zinc-500 font-sans mt-1.5 block leading-relaxed">
                      * AI checks cross-drug conflicts automatically if medications interact (e.g. Lisinopril + Spironolactone).
                    </span>
                  </div>

                  {/* Photo attachment section */}
                  <div className="space-y-2.5 pt-1.5 border-t border-zinc-100">
                    <label className="block text-[10px] font-mono text-zinc-500 uppercase font-semibold">
                      Attach Clinical Photo Card or Scan Document
                    </label>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Drag & Drop File Selector area */}
                      <div className="border border-dashed border-zinc-200 hover:border-zinc-350 rounded-xl p-4 bg-zinc-55 hover:bg-zinc-50 transition-all text-center relative flex flex-col justify-center items-center group min-h-[110px] bg-zinc-50/50">
                        <UploadCloud className="h-6 w-6 text-zinc-400 mb-1.5 group-hover:text-zinc-650 transition-colors" />
                        <p className="text-[10px] font-medium text-zinc-800">
                          Drag & drop or <span className="text-teal-600 font-bold hover:underline cursor-pointer">browse file</span>
                        </p>
                        <p className="text-[9px] text-zinc-400 mt-0.5">JPEG, PNG scans up to 10MB</p>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        />
                      </div>

                      {/* Demo Sandbox Presets library */}
                      <div className="bg-zinc-50/50 border border-zinc-200 rounded-xl p-3 flex flex-col justify-between">
                        <span className="text-[8px] font-mono text-zinc-400 uppercase font-bold block mb-1.5">Or choose high-res sandbox mock preset:</span>
                        <div className="grid grid-cols-2 gap-1.5 text-[9px] font-medium font-sans">
                          <button
                            type="button"
                            onClick={() => {
                              setNewPhotoUrl('https://picsum.photos/seed/patient_xray/600/450');
                              onAddLog('Diagnostic Preset Loaded', 'SUCCESS', 'Patient loaded high-resolution chest X-Ray (Diagnostic Template Preset).');
                            }}
                            className={`p-1.5 rounded-lg border text-left flex items-center gap-1 transition-all bg-white hover:bg-zinc-50 cursor-pointer ${newPhotoUrl.includes('patient_xray') ? 'border-teal-500 ring-1 ring-teal-500 text-teal-850 font-bold' : 'border-zinc-250 text-zinc-650'}`}
                          >
                            🩻 Chest X-Ray scan
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setNewPhotoUrl('https://picsum.photos/seed/patient_mri/600/450');
                              onAddLog('Diagnostic Preset Loaded', 'SUCCESS', 'Patient loaded high-resolution Cerebrum MRI Scan.');
                            }}
                            className={`p-1.5 rounded-lg border text-left flex items-center gap-1 transition-all bg-white hover:bg-zinc-50 cursor-pointer ${newPhotoUrl.includes('patient_mri') ? 'border-teal-500 ring-1 ring-teal-500 text-teal-850 font-bold' : 'border-zinc-250 text-zinc-650'}`}
                          >
                            🧠 Brain MRI scan
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setNewPhotoUrl('https://picsum.photos/seed/patient_ecg/600/450');
                              onAddLog('Diagnostic Preset Loaded', 'SUCCESS', 'Patient loaded clinical Einthoven Lead-II ECG paper sweep chart.');
                            }}
                            className={`p-1.5 rounded-lg border text-left flex items-center gap-1 transition-all bg-white hover:bg-zinc-50 cursor-pointer ${newPhotoUrl.includes('patient_ecg') ? 'border-teal-500 ring-1 ring-teal-500 text-teal-850 font-bold' : 'border-zinc-250 text-zinc-650'}`}
                          >
                            📈 Einthoven ECG chart
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setNewPhotoUrl('https://picsum.photos/seed/patient_prescription/600/450');
                              onAddLog('Diagnostic Preset Loaded', 'SUCCESS', 'Patient loaded physical prescription paper slip receipt.');
                            }}
                            className={`p-1.5 rounded-lg border text-left flex items-center gap-1 transition-all bg-white hover:bg-zinc-50 cursor-pointer ${newPhotoUrl.includes('patient_prescription') ? 'border-teal-500 ring-1 ring-teal-500 text-teal-850 font-bold' : 'border-zinc-250 text-zinc-650'}`}
                          >
                            📄 Prescription receipt
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Pre-upload attachment banner indicator */}
                    {newPhotoUrl && (
                      <div className="p-2.5 bg-teal-50/40 border border-teal-200 rounded-xl flex items-center justify-between animate-fade-in">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-10 h-10 rounded border border-zinc-200 overflow-hidden shrink-0">
                            <img
                              src={newPhotoUrl}
                              alt="Secure pre-encryption preview"
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <div className="min-w-0">
                            <span className="text-[9px] font-mono text-teal-700 font-bold block uppercase leading-none mb-1">✓ Active Image Staged for Encrypt</span>
                            <span className="text-[8px] font-mono text-zinc-450 truncate block max-w-[2400px] leading-none">
                              {newPhotoUrl.startsWith('data:') ? 'Custom Patient Uploaded Base64 Scan Data' : newPhotoUrl}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setNewPhotoUrl('')}
                          className="px-2 py-1 rounded bg-white hover:bg-red-50 text-red-650 hover:text-red-700 font-mono text-[9px] border border-zinc-200 hover:border-red-200 cursor-pointer transition-colors"
                        >
                          Delete Card
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="w-full inline-flex justify-center items-center rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold py-2.5 transition-all cursor-pointer font-mono text-xs shadow-sm"
                  >
                    Encrypt Document & Write to Ledger (Local Client Encryption)
                  </button>
                </form>
              </div>
            )}

            {/* List of active records */}
            <div className="space-y-4">
              {filteredRecords.length === 0 ? (
                <div className="text-center p-12 border border-dashed border-zinc-250 rounded-2xl bg-white shadow-sm">
                  <Database className="h-9 w-9 text-zinc-400 mx-auto mb-3" />
                  <p className="text-zinc-500 font-sans font-medium text-xs md:text-sm">No primacy patient records found. Create one now!</p>
                </div>
              ) : (
                filteredRecords.map((rec) => {
                  return (
                    <div
                      key={rec.id}
                      className="bg-white border border-zinc-200 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-start gap-6 shadow-sm hover:border-zinc-300 transition-all"
                    >
                      <div className="space-y-4 max-w-xl flex-1">
                        <div>
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <span className="px-2.5 py-1 text-[9px] font-mono rounded bg-teal-50 text-teal-700 border border-teal-200/50 font-bold uppercase">
                              {rec.category}
                            </span>
                            <span className="text-xs text-zinc-400 font-mono">
                              Issued: {rec.date} by {rec.doctorName}
                            </span>
                          </div>
                          <h4 className="font-display font-bold text-zinc-900 text-base md:text-lg">
                            {rec.title}
                          </h4>
                        </div>
                        
                        {/* Cipher text block */}
                        <div className="bg-zinc-50 p-3 py-2.5 rounded-xl border border-zinc-200/80">
                          <span className="text-[10px] font-mono text-teal-700 flex items-center gap-1.5 mb-1 uppercase font-bold">
                            <Lock className="h-3 w-3" /> Encrypted Cyphertext Block
                          </span>
                          <p className="font-mono text-[10px] text-zinc-500 truncate tracking-tight break-all select-all">
                            {rec.encryptedContent}
                          </p>
                        </div>

                        {/* Decrypted payload or locker */}
                        {decryptedRecordIds[rec.id] ? (
                          <div className="space-y-4 pt-1 animate-fade-in text-xs">
                            <div className="p-4 bg-teal-50/20 border border-teal-150 rounded-xl text-zinc-850 space-y-1">
                              <span className="text-[9px] font-mono text-teal-800 uppercase font-bold tracking-wider block">Plaintext Medical Diagnosis / Narrative</span>
                              <p className="leading-relaxed font-sans font-medium">{decryptedRecordIds[rec.id]}</p>
                            </div>

                            {rec.photoUrl && (
                              <div className="border border-zinc-200 rounded-xl bg-zinc-50 overflow-hidden shadow-sm max-w-sm">
                                <div className="p-2 border-b border-zinc-200 bg-white flex items-center justify-between">
                                  <span className="text-[8px] font-mono text-zinc-550 uppercase font-bold flex items-center gap-1">
                                    <Image className="h-3 w-3 text-zinc-400" /> Clinical scan attachment
                                  </span>
                                  <button
                                    onClick={() => setSelectedZoomPhoto(rec.photoUrl || null)}
                                    className="p-1 hover:bg-zinc-150 rounded text-teal-650 hover:text-teal-800 cursor-pointer flex items-center gap-1 text-[9px] font-mono font-bold"
                                  >
                                    <ZoomIn className="h-3 w-3" /> Click to Zoom
                                  </button>
                                </div>
                                <div className="relative group/pic aspect-video bg-zinc-150 cursor-pointer overflow-hidden" onClick={() => setSelectedZoomPhoto(rec.photoUrl || null)}>
                                  <img
                                    src={rec.photoUrl}
                                    alt={rec.title}
                                    className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
                                    referrerPolicy="no-referrer"
                                  />
                                  <div className="absolute inset-0 bg-zinc-950/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <span className="text-white text-[9px] font-mono bg-zinc-900/90 px-2 py-1 rounded-md font-bold">
                                      Expand Display Scans
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}

                          </div>
                        ) : (
                          <div className="text-[10px] font-mono text-zinc-400 italic">
                             Click "Decrypt Locally" button to verify this block with your private PKI keys.
                          </div>
                        )}

                        {rec.medicines.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
                            <span className="text-[10px] font-mono text-zinc-400 uppercase mr-1 font-semibold">
                              Covered Active Drug Lines:
                            </span>
                            {rec.medicines.map((sub, i) => (
                              <span key={i} className="px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 text-[10px] font-mono border border-zinc-200">
                                {sub}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Right-side status and unlock button */}
                      <div className="flex md:flex-col items-end gap-3 justify-between w-full md:w-auto shrink-0 border-t md:border-t-0 pt-4 md:pt-0 border-zinc-150">
                        <div className="text-left md:text-right">
                          <span className="text-[8px] font-mono text-zinc-400 block uppercase font-bold">SHA256 Ledger Hash</span>
                          <span className="font-mono text-[10px] text-zinc-550 font-bold select-all bg-zinc-50 border border-zinc-200 px-1.5 py-0.5 rounded">{rec.hash}</span>
                        </div>
                        
                        <div className="w-full md:w-auto text-right space-y-2">
                          {decryptedRecordIds[rec.id] ? (
                            <div className="inline-flex py-1 px-2.5 rounded-lg bg-emerald-50 border border-emerald-250 text-emerald-700 text-[10px] font-mono font-bold items-center gap-1.5 animate-fade-in">
                              <Check className="h-3.5 w-3.5" /> Decrypted Locally
                            </div>
                          ) : (
                            <div className="space-y-2 min-w-[240px]">
                              {!showingKeyInputIds[rec.id] ? (
                                <button
                                  onClick={() => setShowingKeyInputIds({ ...showingKeyInputIds, [rec.id]: true })}
                                  className="w-full md:w-auto inline-flex justify-center items-center gap-1 py-1.5 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-[11px] font-mono font-bold transition-all hover:scale-103 cursor-pointer shadow-sm"
                                >
                                  🔑 Decrypt Locally
                                </button>
                              ) : (
                                <div className="p-3 bg-zinc-55 border border-zinc-200 rounded-xl text-left space-y-2 animate-scale-up">
                                  <label className="block text-[9px] font-mono text-zinc-555 uppercase font-bold">
                                    Provide Private Key PEM Block:
                                  </label>
                                  <textarea
                                    value={recordKeyInputs[rec.id] || ''}
                                    onChange={(e) => setRecordKeyInputs({ ...recordKeyInputs, [rec.id]: e.target.value })}
                                    placeholder="Paste private key block here..."
                                    rows={4}
                                    className="w-full text-[9px] font-mono p-1.5 border border-zinc-250 rounded bg-white text-zinc-805 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
                                  />
                                  <div className="flex flex-wrap gap-1.5 justify-between">
                                    <button
                                      type="button"
                                      onClick={() => setRecordKeyInputs({ ...recordKeyInputs, [rec.id]: user.privateKey || '' })}
                                      className="py-1 px-1.5 border border-zinc-200 hover:border-zinc-300 rounded text-[8px] font-mono font-bold text-zinc-650 hover:text-zinc-800 bg-white hover:bg-zinc-50 cursor-pointer"
                                    >
                                      Demo Key Auto-fill
                                    </button>
                                    <div className="flex gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const prevInput = { ...showingKeyInputIds };
                                          delete prevInput[rec.id];
                                          setShowingKeyInputIds(prevInput);
                                        }}
                                        className="py-1 px-2 border border-zinc-200 hover:border-zinc-300 rounded text-[9px] font-mono text-zinc-650 bg-white hover:bg-zinc-100 cursor-pointer"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDecryptSelfRecord(rec, recordKeyInputs[rec.id])}
                                        className="py-1 px-2.5 rounded bg-teal-600 hover:bg-teal-700 text-white text-[9px] font-mono font-bold cursor-pointer transition-colors"
                                      >
                                        Unlock Payload
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {decryptionError[rec.id] && (
                            <span className="text-[9px] text-red-650 font-mono block mt-1 text-center md:text-right">{decryptionError[rec.id]}</span>
                          )}
                        </div>
                      </div>

                    </div>
                  );
                })
              )}
            </div>

          </div>
        )}

        {/* TAB 2: Access Requests & Doctor lists */}
        {activeTab === 'DOCTORS' && (
          <div id="patient-doctors-view" className="space-y-6 bg-blue-50/30 backdrop-blur-sm p-6 md:p-8 rounded-3xl border border-blue-100/50 shadow-sm">
            
            {/* Header control */}
            <div className="bg-teal-50/70 p-5 rounded-2xl border border-teal-100/60 mb-6">
              <h3 className="font-display text-2xl font-bold text-teal-950">Clinician Approvals Hub</h3>
              <p className="text-sm font-sans text-teal-800/80 mt-1 leading-relaxed">
                Doctors must seek express digital permission to see your medicine vault. Sign requests using your asymmetric key pair to activate safe read decryption.
              </p>
            </div>

            {/* Secret key sign sequence popup/overlay */}
            {signingRequestId && (
              <div id="private-key-signing-modal" className="bg-white border-2 border-orange-200 rounded-2xl p-6 space-y-4 shadow-lg animate-fade-in">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-orange-600 border border-orange-200">
                    <Key className="h-4.5 w-4.5" />
                  </span>
                  <h4 className="font-display font-bold text-zinc-900 text-sm uppercase tracking-wide">
                    Digital Signature credentials Required
                  </h4>
                </div>
                
                <p className="text-xs text-zinc-600 leading-relaxed font-sans">
                  The system requires your asymmetric private key (PEM format) to build audit trail and append signed token approvals. Enter your private key to sign the contract authorization.
                </p>

                {privateKeyError && (
                  <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-[10px] text-red-750">
                    {privateKeyError}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="block text-[10px] font-mono text-zinc-500 uppercase font-semibold">
                    Your PEM RSA Private Key (Auto-filled for ease of sandbox evaluation)
                  </label>
                  <textarea
                    rows={4}
                    value={privateKeyConfirmInput}
                    onChange={(e) => setPrivateKeyConfirmInput(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-[10px] text-zinc-950 font-mono focus:outline-none focus:border-zinc-400 transition-all hover:bg-white"
                    placeholder="-----BEGIN RSA PRIVATE KEY-----"
                  />
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setSigningRequestId(null)}
                    className="py-1.5 px-3.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-500 text-xs font-semibold cursor-pointer shadow-sm"
                  >
                    Cancel Action
                  </button>
                  <button
                    onClick={handleSignConfirm}
                    className="py-1.5 px-4.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs cursor-pointer shadow-sm"
                  >
                    Sign & Approve Access
                  </button>
                </div>
              </div>
            )}

            {/* List design */}
            <div className="space-y-4">
              {filteredRequests.length === 0 ? (
                <div className="text-center p-12 border border-dashed border-zinc-250 rounded-2xl bg-white shadow-sm">
                  <Shield id="empty-shield" className="h-9 w-9 text-zinc-400 mx-auto mb-3" />
                  <p className="text-zinc-500 font-sans font-medium text-xs md:text-sm">No credentials requests are currently registered on your profile.</p>
                </div>
              ) : (
                filteredRequests.map((req) => {
                  return (
                    <div
                      key={req.id}
                      className={`rounded-2xl p-6 border shadow-sm transition-all ${
                        req.status === 'PENDING'
                          ? 'border-amber-200 bg-amber-50/40'
                          : req.status === 'APPROVED'
                            ? 'border-zinc-200 bg-white hover:border-zinc-250'
                            : 'border-zinc-150 bg-[#f9f9f9]'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-display font-bold text-zinc-900 text-base">
                              {req.doctorName}
                            </span>
                            <span className="px-2 py-0.5 text-[9px] font-mono rounded bg-zinc-100 text-zinc-650 border border-zinc-200">
                              {req.doctorSpecialty}
                            </span>
                          </div>
                          
                          <p className="text-xs text-zinc-700 leading-relaxed max-w-xl font-sans">
                            <span className="text-[10px] font-mono text-zinc-400 block mb-0.5 uppercase font-semibold">Stated Purpose of Request:</span>
                            "{req.requestedPurpose}"
                          </p>

                          <div className="text-[10px] font-mono text-zinc-450 flex flex-wrap items-center gap-4 pt-1">
                            <span>Request Filed: {new Date(req.requestedAt).toLocaleString()}</span>
                            {req.decidedAt && <span>Decided: {new Date(req.decidedAt).toLocaleString()}</span>}
                          </div>

                          {req.digitalSignature && (
                            <div className="pt-2">
                              <span className="text-[9px] font-mono text-zinc-400 block uppercase font-semibold">Asymmetric Consent Signature</span>
                              <span className="font-mono text-[10px] text-teal-700 break-all select-all font-semibold">
                                {req.digitalSignature}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Actions for Approve or Revoke */}
                        <div className="flex flex-col items-end gap-2 shrink-0 w-full md:w-auto">
                          
                          {/* Active Status indicator badges */}
                          <div className="mb-2">
                            {req.status === 'PENDING' && (
                              <span className="px-2.5 py-1 text-[10px] font-mono bg-amber-100 text-amber-800 border border-amber-200 rounded-full font-bold">
                                ⏳ PENDING APPROVAL
                              </span>
                            )}
                            {req.status === 'APPROVED' && (
                              <span className="px-2.5 py-1 text-[10px] font-mono bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full font-bold flex items-center gap-1">
                                <Check className="h-3 w-3" /> ACTIVE DECRYPT TOKEN
                              </span>
                            )}
                            {req.status === 'REJECTED' && (
                              <span className="px-2.5 py-1 text-[10px] font-mono bg-red-50 text-red-700 border border-red-200 rounded-full font-bold">
                                ❌ DECLINED
                              </span>
                            )}
                            {req.status === 'REVOKED' && (
                              <span className="px-2.5 py-1 text-[10px] font-mono bg-zinc-100 text-zinc-500 border border-zinc-200 rounded-full font-bold">
                                🛑 REVOKED BY OWNER
                              </span>
                            )}
                          </div>

                          {req.status === 'PENDING' && (
                            <div className="flex gap-2 w-full md:w-auto">
                              <button
                                onClick={() => onUpdateRequestHandler(req.id, 'REJECTED')}
                                className="flex-1 md:flex-none py-1.5 px-3.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-red-600 hover:text-red-700 text-xs font-mono transition-all cursor-pointer font-bold shadow-sm"
                              >
                                Decline
                              </button>
                              <button
                                onClick={() => handleApproveAccessRequest(req.id)}
                                className="flex-1 md:flex-none py-1.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs font-mono tracking-wide transition-all cursor-pointer shadow-sm"
                              >
                                Approve & Sign
                              </button>
                            </div>
                          )}

                          {req.status === 'APPROVED' && (
                            <button
                              onClick={() => handleRevokeDoctorAccess(req)}
                              className="w-full md:w-auto py-1.5 px-4 rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 text-xs font-mono transition-all cursor-pointer font-bold shadow-sm"
                            >
                              Revoke Access Immediately
                            </button>
                          )}

                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        )}

        {/* TAB 3:  logs */}
        {activeTab === 'LEDGER' && (
          <div id="patient-ledger-view" className="space-y-6 bg-blue-50/30 backdrop-blur-sm p-6 md:p-8 rounded-3xl border border-blue-100/50 shadow-sm">
            
            {/* Header control */}
            <div className="bg-teal-50/70 p-5 rounded-2xl border border-teal-100/60 mb-6">
              <h3 className="font-display text-2xl font-bold text-teal-950">Immutable Ledger Audit Trail</h3>
              <p className="text-sm font-sans text-teal-800/80 mt-1 leading-relaxed">
                A system sequence containing cryptographically secure handshakes, decryption approvals, and record modifications. Fully immutable ledger representation.
              </p>
            </div>

            <div className="space-y-4">
              {filteredLogs.map((log) => {
                return (
                  <div
                    key={log.id}
                    className="p-5 rounded-2xl bg-white border border-zinc-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 font-mono text-xs shadow-sm hover:border-zinc-250 transition-all"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          log.status === 'SUCCESS' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-250' 
                            : log.status === 'ALERT'
                              ? 'bg-red-50 text-red-650 border border-red-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-250'
                        }`}>
                          {log.action}
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>
                      
                      <p className="text-zinc-700 font-sans text-xs leading-relaxed max-w-xl">
                        {log.details}
                      </p>

                      <div className="text-[10px] text-zinc-400">
                        Handshake actor: <span className="text-zinc-600 font-semibold">{log.actorName}</span> ({log.actorRole})
                      </div>
                    </div>

                    <div className="text-left md:text-right shrink-0">
                      <span className="text-[9px] text-zinc-400 block uppercase font-bold">Ledger Block Hash</span>
                      <span className="text-indigo-700 font-bold select-all font-mono text-xs">
                        {log.hash}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        )}

        {/* TAB 4: key management */}
        {activeTab === 'KEYCARD' && (
          <div id="patient-key-view" className="space-y-6 bg-blue-50/30 backdrop-blur-sm p-6 md:p-8 rounded-3xl border border-blue-100/50 shadow-sm">
            
            <div className="bg-teal-50/70 p-5 rounded-2xl border border-teal-100/60 mb-6">
              <h3 className="font-display text-2xl font-bold text-teal-950">Your Key Card</h3>
              <p className="text-sm font-sans text-teal-800/80 mt-1 leading-relaxed">
                Only you have the corresponding secret key which is needed to provide clinical decrypted read permissions.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
              {/* Cryptographic Key Card layout - Gorgeous minimalist silver card */}
              <div id="physical-cryptokey-card" className="relative w-full bg-gradient-to-br from-white via-blue-50/50 to-blue-100/50 p-8 rounded-3xl border border-blue-200/60 shadow-md overflow-hidden flex flex-col justify-between">
                {/* Subtle silver/grey details */}
                <div className="absolute top-0 right-0 w-44 h-44 bg-teal-500/[0.02] rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-blue-500/[0.04] rounded-full blur-3xl pointer-events-none" />
                
                <div className="relative z-10 space-y-6">
                  
                  {/* Branding line */}
                  <div className="flex justify-between items-start animate-fade-in">
                    <div className="flex items-center gap-2">
                      <Shield className="h-6 w-6 text-blue-950 animate-pulse" />
                      <div>
                        <h4 className="font-display font-black text-blue-950 tracking-wide text-xs uppercase leading-none">PRIMACY LEDGER</h4>
                        <p className="font-mono text-[7px] text-blue-500/80 tracking-widest leading-none mt-1 uppercase font-bold">PIN-SECURE-ID-V2</p>
                      </div>
                    </div>
                    {/* Holographic smart security chip */}
                    <div className="w-10 h-8 rounded-lg bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-500 border border-amber-300 relative shadow-inner overflow-hidden flex flex-col justify-between p-1.5 select-none opacity-90 h-8">
                      <div className="grid grid-cols-3 gap-0.5 h-1 w-full bg-blue-950/10" />
                      <div className="grid grid-cols-2 gap-0.5 h-2 w-full bg-blue-950/10" />
                    </div>
                  </div>

                  {/* Patient metadata */}
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-blue-200/60">
                    <div>
                      <span className="text-[8px] font-mono text-blue-400 block uppercase font-bold">Primacy Owner Profile</span>
                      <span className="font-display font-bold text-blue-900 text-xs uppercase">{user.name}</span>
                    </div>
                    <div>
                      <span className="text-[8px] font-mono text-blue-400 block uppercase font-bold">Root Address</span>
                      <span className="font-mono text-teal-700 text-[10px] tracking-tight truncate block select-all font-semibold">
                        {user.email}
                      </span>
                    </div>
                  </div>

                  {/* Key Status Indicators */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="bg-white/80 rounded-xl p-3 border border-blue-200/60 text-xs shadow-sm">
                      <span className="text-[8px] font-mono text-blue-400 block uppercase font-bold">Public Directory Key</span>
                      <div className="flex justify-between items-center mt-1">
                        <span className="font-mono text-teal-600 text-[10px] font-bold">PUBLISHED</span>
                        <button
                          onClick={() => copyText(user.publicKey, 'PUBLIC')}
                          className="text-[9px] font-mono text-blue-500 hover:text-blue-900 flex items-center gap-0.5 cursor-pointer font-bold"
                        >
                          {copiedText === 'PUBLIC' ? 'Copied' : <Copy className="h-3 w-3" />}
                        </button>
                      </div>
                    </div>

                    <div className="bg-white/80 rounded-xl p-3 border border-blue-200/60 text-xs shadow-sm">
                      <span className="text-[8px] font-mono text-blue-400 block uppercase font-bold">Private Consent Key</span>
                      <div className="flex justify-between items-center mt-1">
                        <span className="font-mono text-amber-600 text-[10px] font-bold">LOCAL HIDDEN</span>
                        <button
                          onClick={() => copyText(user.privateKey || '', 'PRIVATE')}
                          className="text-[9px] font-mono text-blue-500 hover:text-blue-900 flex items-center gap-0.5 cursor-pointer font-bold"
                        >
                          {copiedText === 'PRIVATE' ? 'Copied' : <Copy className="h-3 w-3" />}
                        </button>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* Primacy QR Code Document Pass Card */}
              <div id="physical-qr-pass-card" className="relative w-full bg-gradient-to-br from-white via-blue-50/50 to-blue-100/50 p-8 rounded-3xl border border-blue-200/60 shadow-md overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/[0.01] rounded-full blur-2xl pointer-events-none" />
                
                <div className="space-y-4">
                  {/* Top Header */}
                  <div className="flex justify-between items-start pb-2 border-b border-blue-200/60">
                    <div>
                      <h4 className="font-display font-black text-blue-950 tracking-wide text-xs uppercase leading-none">PHYSICAL DOSSIER QR</h4>
                      <p className="font-mono text-[7px] text-blue-500/80 tracking-wider mt-1 uppercase font-bold">SCAN-TO-IDENTIFY</p>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-blue-900 text-white font-mono text-[8px] font-bold">PRIMACY PASS</span>
                  </div>

                  {/* QR Image rendering centered and framed with styling */}
                  <div className="flex flex-col items-center justify-center py-2">
                    <div className="p-3 bg-white rounded-2xl border border-blue-200/60 shadow-sm flex items-center justify-center hover:scale-105 transition-all duration-300">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${user.id}`}
                        alt="Primacy Patient QR Code ID"
                        referrerPolicy="no-referrer"
                        className="w-[130px] h-[130px]"
                      />
                    </div>
                    <span className="font-mono text-[10px] text-teal-700 font-bold mt-3 text-center block tracking-tight select-all">
                      Primacy Patient Key: {user.id}
                    </span>
                  </div>

                  {/* Context note */}
                  <p className="text-[10px] font-sans text-zinc-450 leading-relaxed text-center">
                    Present this physical ledger pass to approved doctor networks. Scanning this QR auto-loads your medical identity in directory requests.
                  </p>
                </div>
              </div>
            </div>

            {/* Explanatory cards showing PEM outputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
              
              {/* Public key drawer */}
              <div className="bg-blue-50/50 rounded-2xl p-6 border border-blue-200/60 shadow-sm space-y-3 hover:border-blue-300/60 transition-all">
                <h5 className="font-display font-bold text-blue-950 text-xs uppercase tracking-wide flex items-center gap-2">
                  <Key className="h-4 w-4 text-teal-600" /> Public directory Key
                </h5>
                <p className="text-blue-500/80 text-xs font-sans leading-relaxed">
                  Used by third-party clinical vaults to pre-encrypt diagnoses payloads prior to ledger transmission. Shared publicly via primacy indexing directory.
                </p>
                <pre className="p-3 bg-white/80 rounded-xl text-[9px] font-mono text-teal-800 leading-relaxed max-h-[120px] overflow-y-auto break-all select-all border border-blue-200/60">
                  {user.publicKey}
                </pre>
              </div>

              {/* Private key drawer */}
              <div className="bg-blue-50/50 rounded-2xl p-6 border border-blue-200/60 shadow-sm space-y-3 hover:border-blue-300/60 transition-all">
                <div className="flex justify-between items-center">
                  <h5 className="font-display font-bold text-blue-950 text-xs uppercase tracking-wide flex items-center gap-2">
                    <Lock className="h-4 w-4 text-amber-600" /> Secret Private signature key
                  </h5>
                  <button
                    onClick={handleShowKeyClick}
                    className="p-1 px-2.5 rounded bg-white border border-blue-200/60 text-[10px] font-mono text-blue-500/80 hover:text-blue-900 hover:bg-blue-100/50 flex items-center gap-1 cursor-pointer font-bold"
                  >
                    {showPrivateKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    {showPrivateKey ? 'Hide key' : 'Show key'}
                  </button>
                </div>
                <p className="text-blue-500/80 text-xs font-sans leading-relaxed">
                  Required to complete digital consent. Keep safe. Private keys never travel over networks; signing actions execute securely in browser.
                </p>
                <div className="relative font-sans text-xs">
                  {showPrivateKey ? (
                    <pre className="p-3 bg-white/80 rounded-xl text-[9px] font-mono text-amber-800 leading-relaxed max-h-[120px] overflow-y-auto break-all select-all border border-blue-200/60">
                      {user.privateKey}
                    </pre>
                  ) : (
                    <div className="bg-white/80 rounded-xl p-6 text-center text-xs font-mono text-blue-400 border border-blue-200/60 block tracking-wider uppercase select-none italic py-[42px]">
                      •••• Key is locked for security ••••
                    </div>
                  )}
                </div>
              </div>

            </div>

          </div>
        )}

      </main>

      {/* High-Resolution Zoom Display Lightbox Modal Dialog */}
      {selectedZoomPhoto && (
        <div 
          onClick={() => setSelectedZoomPhoto(null)}
          className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-zoom-out animate-fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-zinc-200 rounded-2xl p-4 max-w-3xl w-full max-h-[92vh] flex flex-col relative animate-scale-up shadow-2xl cursor-default"
          >
            <div className="flex justify-between items-center pb-2.5 border-b border-zinc-150 mb-3.5">
              <h4 className="font-mono font-bold text-zinc-900 text-xs uppercase tracking-tight">
               Cryptographic Patient diagnostic Display Viewer
              </h4>
              <button
                onClick={() => setSelectedZoomPhoto(null)}
                className="text-zinc-400 hover:text-zinc-700 p-1.5 rounded-lg hover:bg-zinc-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="rounded-xl overflow-hidden border border-zinc-200 bg-zinc-950 flex items-center justify-center flex-1 min-h-0">
              <img
                src={selectedZoomPhoto}
                alt="Patient diagnostic high-resolution display view"
                className="max-w-full max-h-[64vh] object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            
            <div className="mt-3.5 p-3 bg-zinc-50 border border-zinc-150 rounded-xl font-mono text-[9px] text-zinc-500 leading-relaxed text-center">
              🔒 256-Bit Encrypted Block Transit Integrity Validated • Referred as Direct Raw Sandbox Image Element • ReferrerPolicy "no-referrer"
            </div>
          </div>
        </div>
      )}

      {/* Passcode Unlock Modal Dialogue */}
      {isPasscodeModalOpen && (
        <div 
          className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-zinc-200 rounded-3xl p-6 max-w-sm w-full relative animate-scale-up shadow-2xl"
          >
            <div className="flex justify-between items-start pb-4 border-b border-zinc-150 mb-4">
              <div className="flex items-center gap-2.5 text-zinc-900">
                <div className="p-2 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 shadow-sm">
                  <Lock className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="font-display font-bold text-sm tracking-tight text-zinc-900 animate-pulse">
                    Unlock Private Key
                  </h4>
                  <p className="text-[10px] font-sans text-zinc-500 mt-0.5 uppercase tracking-wide">
                    Verification Required
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPasscodeModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 p-1.5 rounded-lg hover:bg-zinc-100 cursor-pointer transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <form onSubmit={handleVerifyPasscode} className="space-y-4">
              <p className="text-xs text-zinc-500 leading-relaxed font-sans">
                Please enter your security passcode to display your private signature key.
              </p>

              {passcodeError && (
                <div id="passcode-error-box" className="p-3 rounded-xl bg-red-50 border border-red-200 text-[11px] font-medium text-red-700 leading-relaxed">
                  ⚠️ {passcodeError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-[10px] font-mono text-zinc-550 uppercase tracking-wider">
                  Passcode
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  value={passcodeAttempt}
                  onChange={(e) => setPasscodeAttempt(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl py-2.5 px-3.5 text-sm font-mono text-zinc-900 focus:outline-none focus:border-zinc-400 hover:bg-white transition-all shadow-inner"
                />
              </div>

              {!user.passcode && (
                <div className="p-2.5 rounded-xl bg-amber-50/50 border border-amber-200/50 text-[9px] font-sans text-amber-800 leading-normal">
                  💡 <strong>Demo Profile Tip:</strong> Since you did not register this session, use the default testing passcode: <span className="font-mono bg-amber-100/50 px-1 py-0.5 rounded text-amber-905 select-all font-bold">password</span>
                </div>
              )}

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPasscodeModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-zinc-200 hover:border-zinc-300 text-xs font-mono font-bold text-zinc-650 hover:text-zinc-900 cursor-pointer bg-white transition-all text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-mono font-bold text-white cursor-pointer transition-all text-center shadow-sm"
                >
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
