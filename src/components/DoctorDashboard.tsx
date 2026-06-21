import React, { useState } from 'react';
import { Shield, Key, Search, FileLock, ClipboardList, Send, Sparkles, Check, X, ShieldAlert, LogOut, Radio, RefreshCw, Layers, PlusCircle, Unlock, Lock, AlertTriangle, ChevronRight, QrCode, ScanLine, UploadCloud, Image, Camera, Paperclip, ZoomIn } from 'lucide-react';
import { UserProfile, MedicalRecord, AccessRequest, AuditLog } from '../types';
import { decryptRecord, checkDrugInteractions, generateHash } from '../utils/cryptoSim';
import QRScanner from './QRScanner';

interface DoctorDashboardProps {
  user: UserProfile;
  records: MedicalRecord[];
  requests: AccessRequest[];
  logs: AuditLog[];
  allUsers: UserProfile[];
  onLogout: () => void;
  onSubmitRequest: (patientId: string, patientName: string, justification: string) => void;
  onAddRecord: (record: MedicalRecord) => void;
  onAddLog: (action: string, status: 'SUCCESS' | 'WARNING' | 'ALERT', details: string) => void;
  onRevokeAccessDirectly: (requestId: string) => void;
}

export default function DoctorDashboard({
  user,
  records,
  requests,
  logs,
  allUsers,
  onLogout,
  onSubmitRequest,
  onAddRecord,
  onAddLog,
  onRevokeAccessDirectly
}: DoctorDashboardProps) {
  // Tabs: PATIENTS_SEARCH, ACTIVE_GRANTS, RECENT_LOGS
  const [activeTab, setActiveTab] = useState<'PATIENTS_SEARCH' | 'ACTIVE_GRANTS' | 'RECENT_LOGS'>('PATIENTS_SEARCH');

  // Requesting variables
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [requestJustification, setRequestJustification] = useState('');
  const [successRequestMessage, setSuccessRequestMessage] = useState('');

  // QR Code Scanner State
  const [showScanner, setShowScanner] = useState(false);
  const [scannedNotification, setScannedNotification] = useState<string | null>(null);

  const handleScanSuccess = (patientId: string, patientName: string) => {
    setSelectedPatientId(patientId);
    setScannedNotification(`Secure Identity verified! Scanned physical credentials for ${patientName} successfully.`);
    onAddLog(
      'QR Code Dossier Scanned',
      'SUCCESS',
      `Scanned physical QR credentials. Identified Primacy Patient: ${patientName} (${patientId}).`
    );
    // Clear notification after 6 seconds
    setTimeout(() => {
      setScannedNotification(null);
    }, 6000);
  };

  // Local decryptions triggers
  const [decryptedRecordIds, setDecryptedRecordIds] = useState<Record<string, string>>({});
  const [decryptionError, setDecryptionError] = useState<Record<string, string>>({});
  const [recordKeyInputs, setRecordKeyInputs] = useState<Record<string, string>>({});
  const [showingKeyInputIds, setShowingKeyInputIds] = useState<Record<string, boolean>>({});

  // Prescribing variables
  const [selectedGrantReq, setSelectedGrantReq] = useState<AccessRequest | null>(null);
  const [newPrescTitle, setNewPrescTitle] = useState('');
  const [newPrescCategory, setNewPrescCategory] = useState<'Prescription' | 'Lab Report' | 'Diagnosis' | 'Immunization'>('Prescription');
  const [newPrescDetails, setNewPrescDetails] = useState('');
  const [newPrescDrugs, setNewPrescDrugs] = useState('');
  const [newPrescPhotoUrl, setNewPrescPhotoUrl] = useState('');
  const [selectedZoomPhoto, setSelectedZoomPhoto] = useState<string | null>(null);

  // AI conflict interceptor state
  const [aiWarning, setAiWarning] = useState<{
    severity: 'CRITICAL' | 'MODERATE' | 'NONE';
    description: string;
    resolution: string;
  } | null>(null);

  const [simulationStep, setSimulationStep] = useState<'IDLE' | 'ANALYZING' | 'WARN_SHOWN'>('IDLE');

  const patientsList = allUsers.filter(u => u.role === 'PATIENT');
  const filteredRequestsByDoctor = requests.filter(req => req.doctorId === user.id);
  const filteredLogsByDoctor = logs.filter(log => {
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

  // Handler for Access Request Submission
  const handleRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId || !requestJustification) return;

    const patient = patientsList.find(p => p.id === selectedPatientId);
    if (!patient) return;

    onSubmitRequest(patient.id, patient.name, requestJustification);
    onAddLog(
      'Access Request Filed',
      'SUCCESS',
      `Doctor ${user.name} filed security ledger request for user ${patient.email}: "${requestJustification}"`
    );

    setSuccessRequestMessage(`Your authorization request has been published for ${patient.name}. Direct them to approve using their Primacy Private Key.`);
    setSelectedPatientId('');
    setRequestJustification('');
    setTimeout(() => setSuccessRequestMessage(''), 5000);
  };

  // Locally Decrypt primacy record payload using approved digital signature key
  const handleDecryptRecord = (rec: MedicalRecord, req: AccessRequest, passedKey?: string) => {
    if (req.status !== 'APPROVED') {
      const errs = { ...decryptionError, [rec.id]: 'Access Denied: Token approval is pending or revoked by medical patient.' };
      setDecryptionError(errs);
      return;
    }

    try {
      const finalKey = passedKey || user.privateKey || 'MOCK_PEM_PRIVATE_KEY';
      // Decode ciphertext back to plaintext local cryptogram
      const decodedPlain = decryptRecord(rec.encryptedContent, finalKey);
      
      setDecryptedRecordIds({
        ...decryptedRecordIds,
        [rec.id]: decodedPlain
      });

      // Clear any past error on success
      const errs = { ...decryptionError };
      delete errs[rec.id];
      setDecryptionError(errs);

      const isCustom = !!passedKey;
      onAddLog(
        isCustom ? 'Vault Record Decrypted with Custom Key' : 'Vault Record Decrypted',
        'SUCCESS',
        `Doctor Decryption validated. Opened record "${rec.title}" with valid ${isCustom ? 'manually input custom digital key' : 'digital transaction token'}.`
      );
    } catch (err: any) {
      setDecryptionError({
        ...decryptionError,
        [rec.id]: err.message || 'Validation Failure: Cryptographic handshake mismatch.'
      });
    }
  };

  // Pre-examine drugs with AI prior to appending records
  const triggerAiCheckingSequence = () => {
    if (!newPrescDrugs) {
      setAiWarning(null);
      return;
    }

    setSimulationStep('ANALYZING');
    const splitDrugs = newPrescDrugs.split(',').map(m => m.trim()).filter(Boolean);

    // Look for overall combinations including those in patient's past records if we have a patient
    const pastDrugs: string[] = [];
    if (selectedGrantReq) {
      const patientRecords = records.filter(r => r.patientId === selectedGrantReq.patientId);
      patientRecords.forEach(r => pastDrugs.push(...r.medicines));
    }

    const compiledMedList = [...splitDrugs, ...pastDrugs];

    setTimeout(() => {
      const evaluation = checkDrugInteractions(compiledMedList);
      setAiWarning(evaluation);
      setSimulationStep('WARN_SHOWN');

      if (evaluation.severity !== 'NONE') {
        onAddLog(
          'AI Contraindication Detected',
          evaluation.severity === 'CRITICAL' ? 'ALERT' : 'WARNING',
          `AI Interceptor scan raised warning of type ${evaluation.severity} for active drugs compilation: ${compiledMedList.join(', ')}.`
        );
      }
    }, 1200);
  };

  const handleDoctorFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewPrescPhotoUrl(reader.result as string);
        onAddLog(
          'Prescribing Image Appended',
          'SUCCESS',
          `Dr. Robert Chen uploaded local scan document: ${file.name} to buffer storage prior to pre-encryption.`
        );
      };
      reader.readAsDataURL(file);
    }
  };

  // Safe Prescribing Appension Submission
  const handleAppependRecordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGrantReq || !newPrescTitle || !newPrescDetails) return;

    const finalDrugsList = newPrescDrugs
      ? newPrescDrugs.split(',').map(m => m.trim()).filter(Boolean)
      : [];

    const simulatedEncrypted = `CIPHER_VAULT_AES_256:[IV:CH-${Math.floor(Math.random()*10000)}]:` + btoa(newPrescDetails);
    const simulatedHash = generateHash(newPrescDetails);

    const createdRecord: MedicalRecord = {
      id: `rec-${Math.random().toString(36).substring(2, 9)}`,
      patientId: selectedGrantReq.patientId,
      title: newPrescTitle,
      category: newPrescCategory,
      doctorName: user.name,
      date: new Date().toISOString().split('T')[0],
      details: newPrescDetails,
      encryptedContent: simulatedEncrypted,
      hash: simulatedHash,
      medicines: finalDrugsList,
      photoUrl: newPrescPhotoUrl || undefined
    };

    onAddRecord(createdRecord);
    onAddLog(
      'Audit Ledger Record Appended',
      'SUCCESS',
      `Dr. Robert Chen updated patient roster ledger. Appended new encrypted record with document attachment: "${newPrescTitle}".`
    );

    // Reset
    setNewPrescTitle('');
    setNewPrescDetails('');
    setNewPrescDrugs('');
    setNewPrescPhotoUrl('');
    setSelectedGrantReq(null);
    setAiWarning(null);
    setSimulationStep('IDLE');
  };

  return (
    <div id="doctor-dashboard-container" className="min-h-screen bg-[#fafafa] text-zinc-900 flex flex-col md:flex-row font-sans selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* Clinician Navigation Column */}
      <aside className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-zinc-200 flex flex-col justify-between shrink-0 shadow-sm">
        <div className="p-6">
          
          <div className="flex items-center gap-2 mb-8 animate-fade-in">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 shadow-sm overflow-hidden">
              <img src="/logo.jpeg" alt="MedSafe Logo" className="object-cover w-full h-full" />
            </div>
            <div>
              <h2 className="font-display font-bold text-zinc-900 leading-tight uppercase text-sm tracking-wide">
                Clinician Portal
              </h2>
              <p className="font-mono text-[9px] text-indigo-600 tracking-wider font-semibold">
                LICENSE VERIFIED
              </p>
            </div>
          </div>

          <div id="doctor-identity-teaser" className="bg-blue-50/60 rounded-xl p-4 border border-blue-200/60 mb-6 flex flex-col gap-0.5">
            <span className="text-[9px] font-mono text-blue-400 uppercase font-bold">Licensed Provider</span>
            <span className="font-display font-bold text-blue-950 text-xs truncate">{user.name}</span>
            <span className="text-[10px] text-blue-700 font-sans mt-0.5 font-semibold">{user.specialty}</span>
            <span className="text-[9px] font-mono text-blue-500 mt-1">{user.licenceNumber}</span>
          </div>

          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('PATIENTS_SEARCH')}
              className={`w-full text-left py-2.5 px-4 rounded-xl text-xs font-mono flex items-center gap-2.5 transition-all cursor-pointer ${
                activeTab === 'PATIENTS_SEARCH'
                  ? 'bg-teal-700 text-white border border-teal-800 font-bold shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 border border-transparent'
              }`}
            >
              <Search className="h-4 w-4" /> Global Directory Search
            </button>
            <button
              onClick={() => { setActiveTab('ACTIVE_GRANTS'); setSelectedGrantReq(null); }}
              className={`w-full text-left py-2.5 px-4 rounded-xl text-xs font-mono flex items-center justify-between transition-all cursor-pointer ${
                activeTab === 'ACTIVE_GRANTS'
                  ? 'bg-teal-700 text-white border border-teal-800 font-bold shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 border border-transparent'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <FileLock className="h-4 w-4" /> Approved Vaults
              </span>
              {filteredRequestsByDoctor.some(r => r.status === 'APPROVED') && (
                <span className="px-2 py-0.5 text-[8px] font-bold bg-zinc-900 text-white rounded font-mono">
                  {filteredRequestsByDoctor.filter(r => r.status === 'APPROVED').length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('RECENT_LOGS')}
              className={`w-full text-left py-2.5 px-4 rounded-xl text-xs font-mono flex items-center gap-2.5 transition-all cursor-pointer ${
                activeTab === 'RECENT_LOGS'
                  ? 'bg-teal-700 text-white border border-teal-800 font-bold shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 border border-transparent'
              }`}
            >
              <Radio className="h-4 w-4" />Interaction Log
            </button>
          </nav>

        </div>

        {/* Exit portal */}
        <div className="p-6 border-t border-zinc-200 bg-zinc-50/50">
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-red-200/60 bg-red-50/50 hover:bg-red-100/50 text-zinc-900 py-2.5 px-4 text-xs font-mono font-semibold tracking-wide transition-all shadow-sm cursor-pointer"
          >
            <LogOut className="h-4 w-4" /> Lock Clinician Key
          </button>
        </div>
      </aside>

      {/* Main Panel Column */}
      <main className="flex-1 p-6 md:p-8 lg:p-10 overflow-y-auto max-w-5xl">

        {/* TAB 1: Search Patient index and request access */}
        {activeTab === 'PATIENTS_SEARCH' && (
          <div id="doctor-search-vault-view" className="space-y-6">
            
            <div className="bg-teal-50/70 p-5 rounded-2xl border border-teal-100/60 mb-6">
              <h3 className="font-display text-2xl font-bold text-teal-950"> Directory Index</h3>
              <p className="text-sm font-sans text-teal-800/80 mt-1 leading-relaxed">
                Patient records are fully sealed with non-custodial keys. Input clinician criteria and purpose parameters below to request decryption authorization.
              </p>
            </div>

            {successRequestMessage && (
              <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 text-xs font-sans text-teal-850 leading-relaxed shadow-sm">
                {successRequestMessage}
              </div>
            )}

            {scannedNotification && (
              <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 text-xs font-sans text-indigo-950 flex items-center justify-between shadow-sm animate-fade-in animate-pulse">
                <span className="flex items-center gap-2 font-bold">
                  <Check className="h-4 w-4 text-indigo-650" />
                  {scannedNotification}
                </span>
                <button 
                  onClick={() => setScannedNotification(null)}
                  className="p-1 text-indigo-450 hover:text-indigo-950 text-xs cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Structured File Request Entry Form */}
            <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 border-b border-zinc-100 pb-3">
                <h4 className="font-display font-bold text-zinc-900 text-sm uppercase tracking-wide flex items-center gap-2">
                  <Send className="h-4 w-4 text-indigo-600 animate-pulse" /> Create Security Request
                </h4>
                <button
                  type="button"
                  onClick={() => setShowScanner(true)}
                  className="rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-800 py-1.5 px-3 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm self-start sm:self-auto"
                >
                  <QrCode className="h-4 w-4 text-indigo-650" /> Scan Patient QR
                </button>
              </div>

              <form onSubmit={handleRequestSubmit} className="space-y-4 text-xs font-sans">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[10px] font-mono text-zinc-500 uppercase font-semibold">
                        Select Patient Profile on Directory
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowScanner(true)}
                        className="text-[10px] font-mono text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-bold cursor-pointer hover:underline"
                      >
                        <ScanLine className="h-3 w-3" /> Quick QR Scanner
                      </button>
                    </div>
                    <select
                      required
                      value={selectedPatientId}
                      onChange={(e) => setSelectedPatientId(e.target.value)}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl py-2.5 px-3.5 text-zinc-900 focus:outline-none focus:border-zinc-400 transition-all cursor-pointer h-[42px] font-medium"
                    >
                      <option value="">-- Choose Sandbox Patient on Ledger --</option>
                      {patientsList.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.email})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-zinc-500 mb-1.5 uppercase font-semibold">
                      Clinician Access Periodicity
                    </label>
                    <div className="p-2.5 bg-zinc-55 border border-zinc-200 rounded-xl font-mono text-[10px] text-indigo-700 bg-zinc-50 flex items-center justify-between font-bold h-[42px]">
                      <span>SINGLE REVIEW EVALUATION SESSION</span>
                      <span>MAX 24 HOURS VALIDITY</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-zinc-500 mb-1.5 uppercase font-semibold">
                    Clinical Motive
                  </label>
                  <textarea
                    required
                    value={requestJustification}
                    onChange={(e) => setRequestJustification(e.target.value)}
                    placeholder="e.g. Evaluating past ECG logs and prescription conflicts ahead of prescribing lipid therapeutics."
                    rows={3}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl py-2.5 px-3 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 hover:bg-white transition-all leading-relaxed"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                >
                  Publish Authorization Request to Patient Ledger
                </button>
              </form>
            </div>

            {/* List of outstanding requests filed by this Doctor */}
            <div className="space-y-4">
              <h4 className="font-display font-bold text-zinc-900 text-xs uppercase tracking-wider">
                My Requests
              </h4>

              {filteredRequestsByDoctor.length === 0 ? (
                <div className="text-center p-8 border border-dashed border-zinc-200 bg-white rounded-2xl text-xs text-zinc-400 font-sans shadow-sm">
                  No previous ledger have been registered by your clinical license.
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredRequestsByDoctor.map((req) => {
                    return (
                      <div
                        key={req.id}
                        className="bg-white border border-zinc-200 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs font-mono shadow-sm"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-sans font-bold text-zinc-900 text-sm">
                              {req.patientName}
                            </span>
                            <span className="text-[10px] text-zinc-400">
                              Filed: {new Date(req.requestedAt).toLocaleDateString()}
                            </span>
                          </div>
                          
                          <p className="text-zinc-650 font-sans text-xs mt-1 leading-relaxed">
                            "{req.requestedPurpose}"
                          </p>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          {req.status === 'PENDING' && (
                            <span className="px-2.5 py-1 rounded bg-amber-50 text-amber-800 border border-amber-250 text-[10px] font-bold">
                              ⏳ WAITING PATIENT KEY SIGN
                            </span>
                          )}
                          {req.status === 'APPROVED' && (
                            <span className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-850 border border-emerald-200 text-[10px] font-bold">
                              ✓ KEY DECRYPT APPROVED
                            </span>
                          )}
                          {req.status === 'REJECTED' && (
                            <span className="px-2.5 py-1 rounded bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold">
                              ✕ ACCESS REJECTED
                            </span>
                          )}
                          {req.status === 'REVOKED' && (
                            <span className="px-2.5 py-1 rounded bg-zinc-100 text-zinc-550 border border-zinc-200 text-[10px] font-bold">
                              🛑 ACCESS REVOKED
                            </span>
                          )}

                          {req.status === 'APPROVED' && (
                            <button
                              onClick={() => setActiveTab('ACTIVE_GRANTS')}
                              className="py-1.5 px-3 rounded bg-zinc-900 hover:bg-zinc-800 text-white font-sans font-bold cursor-pointer transition-all border border-zinc-850 text-[10.5px] shadow-sm"
                            >
                             Vault Records →
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB 2: Decrypt approved list, prescribe and check AI interactions */}
        {activeTab === 'ACTIVE_GRANTS' && (
          <div id="doctor-grants-vault-view" className="space-y-6">
            
            <div className="bg-teal-50/70 p-5 rounded-2xl border border-teal-100/60 mb-6">
              <h3 className="font-display text-2xl font-bold text-teal-950"> Approved vaults</h3>
              <p className="text-sm font-sans text-teal-800/80 mt-1 leading-relaxed">
                Patients who have signed consent allow you to translate and view their medical files. You may also execute AI-conflict screens ahead of issuing medicines.
              </p>
            </div>

            {/* If a patient grant is chosen for prescribe appension */}
            {selectedGrantReq && (
              <div id="append-vault-prescription-modal" className="bg-white border border-zinc-250 rounded-2xl p-6 space-y-4 shadow-lg animate-fade-in">
                
                <div className="flex justify-between items-center border-b border-zinc-150 pb-2.5">
                  <div className="flex items-center gap-2">
                    <PlusCircle className="h-5 w-5 text-indigo-600" />
                    <h4 className="font-display font-bold text-zinc-900 text-sm uppercase">
                      New Secure Prescription File: {selectedGrantReq.patientName}
                    </h4>
                  </div>
                  <button
                    onClick={() => { setSelectedGrantReq(null); setAiWarning(null); setSimulationStep('IDLE'); }}
                    className="p-1 rounded bg-zinc-50 text-zinc-400 hover:text-zinc-700 cursor-pointer hover:bg-zinc-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <form onSubmit={handleAppependRecordSubmit} className="space-y-4 text-xs font-sans">
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-mono text-zinc-500 mb-1.5 uppercase font-semibold">Record Title</label>
                      <input
                        type="text"
                        required
                        value={newPrescTitle}
                        onChange={(e) => setNewPrescTitle(e.target.value)}
                        placeholder="e.g. Dynamic Hypertension Titration"
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl py-2 px-3 text-zinc-900 hover:bg-white focus:outline-none focus:border-zinc-400 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-zinc-500 mb-1.5 uppercase font-semibold">File Type Category</label>
                      <select
                        value={newPrescCategory}
                        onChange={(e) => setNewPrescCategory(e.target.value as any)}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl py-2 px-3 text-zinc-900 focus:outline-none h-[38px] cursor-pointer"
                      >
                        <option value="Prescription">Prescription File</option>
                        <option value="Diagnosis">Clinical Diagnosis</option>
                        <option value="Lab Report">Lab Work Summary</option>
                        <option value="Immunization">Immunization Record</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-zinc-500 mb-1.5 uppercase font-semibold">Clinical Content Payload (To Pre-Encrypt)</label>
                    <textarea
                      required
                      value={newPrescDetails}
                      onChange={(e) => setNewPrescDetails(e.target.value)}
                      placeholder="Add detailed clinical report, dosage directives and treatment plans."
                      rows={3}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl py-2.5 px-3 text-zinc-900 focus:outline-none hover:bg-white focus:border-zinc-400 transition-all leading-relaxed"
                    />
                  </div>

                  {/* AI Interaction Scanner Trigger Component */}
                  <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 space-y-3">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <div>
                        <label className="text-[10px] font-mono text-zinc-600 uppercase font-bold">Active Compounds to Check</label>
                        <p className="text-[10px] text-zinc-450 mt-0.5 font-medium">Separate with commas (e.g. Sildenafil, Furosemide, Simvastatin)</p>
                      </div>
                      
                      <button
                        type="button"
                        onClick={triggerAiCheckingSequence}
                        className="py-1 px-3.5 rounded bg-zinc-900 hover:bg-zinc-800 text-white font-mono font-bold text-[10px] flex items-center gap-1 cursor-pointer shadow-sm"
                      >
                        {simulationStep === 'ANALYZING' ? (
                          <>
                            <RefreshCw className="h-3 w-3 animate-spin text-zinc-300" /> Analyzing chemical pathways...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3.5 w-3.5 text-yellow-500" /> Run AI Conflict Screen
                          </>
                        )}
                      </button>
                    </div>

                    <input
                      type="text"
                      value={newPrescDrugs}
                      onChange={(e) => setNewPrescDrugs(e.target.value)}
                      placeholder="e.g. Nitroglycerin, Sildenafil"
                      className="w-full bg-white border border-zinc-200 rounded-lg py-1.5 px-3 text-zinc-900 text-xs placeholder-zinc-400 focus:outline-none focus:border-zinc-400 transition-all font-medium"
                    />

                    {/* Highly descriptive patient safety alarm box */}
                    {aiWarning && (
                      <div className={`p-4 rounded-lg border flex gap-3 text-xs leading-relaxed animate-fade-in ${
                        aiWarning.severity === 'CRITICAL'
                          ? 'bg-red-50 border-red-250 text-red-800'
                          : aiWarning.severity === 'MODERATE'
                            ? 'bg-amber-50 border-amber-250 text-amber-800'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      }`}>
                        <div className="space-y-1">
                          <h5 className="font-bold font-display uppercase tracking-wider flex items-center gap-1 text-[11px] font-bold">
                            <ShieldAlert className="h-4 w-4" /> AI INTERCEPT: {aiWarning.severity} PHARMACOLOGICAL WARNING
                          </h5>
                          <p className="font-sans text-[11px] leading-relaxed opacity-95">
                            {aiWarning.description}
                          </p>
                          <p className="font-sans text-[10px] leading-relaxed opacity-90 pt-1 italic">
                            <span className="font-bold underline">Urgent Clinician Resolution:</span> {aiWarning.resolution}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Safe Medical Photo Attachment for Doctor */}
                  <div className="space-y-2.5 pt-1.5 border-t border-zinc-150">
                    <label className="block text-[10px] font-mono text-zinc-500 uppercase font-semibold">
                      Attach Diagnostic Imaging or RX Scan Card
                    </label>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Drag & Drop File Selector */}
                      <div className="border border-dashed border-zinc-200 hover:border-zinc-350 rounded-xl p-4 bg-zinc-50 hover:bg-zinc-100/50 transition-all text-center relative flex flex-col justify-center items-center group min-h-[100px] bg-zinc-50/50">
                        <UploadCloud className="h-6 w-6 text-zinc-400 mb-1.5 group-hover:text-zinc-650 transition-colors" />
                        <p className="text-[10px] font-medium text-zinc-800">
                          Drag & drop or <span className="text-teal-600 font-bold hover:underline cursor-pointer">browse file</span>
                        </p>
                        <p className="text-[9px] text-zinc-400 mt-0.5">JPEG, PNG medical files up to 10MB</p>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleDoctorFileChange}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        />
                      </div>

                      {/* Presets library */}
                      <div className="bg-zinc-50/50 border border-zinc-200 rounded-xl p-3 flex flex-col justify-between">
                        <span className="text-[8px] font-mono text-zinc-400 uppercase font-bold block mb-1">Sandbox Presets:</span>
                        <div className="grid grid-cols-2 gap-1 text-[9px] font-medium">
                          <button
                            type="button"
                            onClick={() => {
                              setNewPrescPhotoUrl('https://picsum.photos/seed/eleanor_ecg/600/450');
                              onAddLog('Primacy Clinical Prescription Added', 'SUCCESS', 'Doctor configured Cardiology ECG Waveform Scan Preset.');
                            }}
                            className={`p-1.5 rounded-lg border text-left flex items-center gap-1 transition-all bg-white hover:bg-zinc-50 cursor-pointer ${newPrescPhotoUrl.includes('eleanor_ecg') ? 'border-teal-500 ring-1 ring-teal-500 text-teal-850 font-bold' : 'border-zinc-250 text-zinc-650'}`}
                          >
                            🩻 Einthoven ECG chart
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setNewPrescPhotoUrl('https://picsum.photos/seed/patient_mri/600/450');
                              onAddLog('Primacy Clinical Prescription Added', 'SUCCESS', 'Doctor configured Brain Cerebral MRI Preset.');
                            }}
                            className={`p-1.5 rounded-lg border text-left flex items-center gap-1 transition-all bg-white hover:bg-zinc-55 cursor-pointer ${newPrescPhotoUrl.includes('patient_mri') ? 'border-teal-500 ring-1 ring-teal-500 text-teal-850 font-bold' : 'border-zinc-250 text-zinc-650'}`}
                          >
                            🧠 Brain MRI Scan
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setNewPrescPhotoUrl('https://picsum.photos/seed/patient_xray/600/450');
                              onAddLog('Primacy Clinical Prescription Added', 'SUCCESS', 'Doctor configured Clinical Chest Radiology Scan.');
                            }}
                            className={`p-1.5 rounded-lg border text-left flex items-center gap-1 transition-all bg-white hover:bg-zinc-55 cursor-pointer ${newPrescPhotoUrl.includes('patient_xray') ? 'border-teal-500 ring-1 ring-teal-500 text-teal-850 font-bold' : 'border-zinc-250 text-zinc-650'}`}
                          >
                            🩻 Chest X-Ray
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setNewPrescPhotoUrl('https://picsum.photos/seed/eleanor_blood/600/450');
                              onAddLog('Primacy Clinical Prescription Added', 'SUCCESS', 'Doctor configured Blood Metabolic Panel Analytics.');
                            }}
                            className={`p-1.5 rounded-lg border text-left flex items-center gap-1 transition-all bg-white hover:bg-zinc-55 cursor-pointer ${newPrescPhotoUrl.includes('eleanor_blood') ? 'border-teal-500 ring-1 ring-teal-500 text-teal-850 font-bold' : 'border-zinc-250 text-zinc-650'}`}
                          >
                            🧪 Lab Assay Results
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Preview uploader indicator */}
                    {newPrescPhotoUrl && (
                      <div className="p-2.5 bg-teal-50/45 border border-teal-200 rounded-xl flex items-center justify-between animate-fade-in">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-10 h-10 rounded border border-zinc-200 overflow-hidden shrink-0">
                            <img
                              src={newPrescPhotoUrl}
                              alt="Clinician secure preview"
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <div className="min-w-0">
                            <span className="text-[9px] font-mono text-teal-700 font-bold block uppercase leading-none mb-1">✓ Attachment Mounted</span>
                            <span className="text-[8px] font-mono text-zinc-450 truncate block max-w-[200px] leading-none">
                              {newPrescPhotoUrl.startsWith('data:') ? 'Custom Clinician Uploaded Image Stream' : newPrescPhotoUrl}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setNewPrescPhotoUrl('')}
                          className="px-2 py-1 rounded bg-white hover:bg-red-50 text-red-650 hover:text-red-700 font-mono text-[9px] border border-zinc-200 hover:border-red-200 cursor-pointer transition-colors"
                        >
                          Remove Attachment
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => { setSelectedGrantReq(null); setAiWarning(null); setSimulationStep('IDLE'); }}
                      className="py-1.5 px-3.5 rounded-xl border border-zinc-200 bg-white text-zinc-500 font-bold hover:bg-zinc-50 cursor-pointer text-xs"
                    >
                      Dismiss Prescription
                    </button>
                    <button
                      type="submit"
                      disabled={aiWarning?.severity === 'CRITICAL'}
                      className={`py-1.5 px-4.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm ${
                        aiWarning?.severity === 'CRITICAL'
                          ? 'bg-zinc-100 text-zinc-400 border border-zinc-200 cursor-not-allowed'
                          : 'bg-zinc-900 hover:bg-zinc-800 text-white'
                      }`}
                    >
                      Authorize Encrypted Prescription Append
                    </button>
                  </div>
                </form>

              </div>
            )}

            {/* Active grants catalog */}
            <div className="space-y-6">
              {filteredRequestsByDoctor.filter(r => r.status === 'APPROVED').length === 0 ? (
                <div className="text-center p-12 border border-dashed border-zinc-250 bg-white rounded-2xl shadow-sm">
                  <FileLock className="h-9 w-9 text-zinc-400 mx-auto mb-3" />
                  <p className="text-zinc-500 text-sm font-sans font-medium">
                    You currently have no active patient vault reading grants. Go directory search to file handshakes.
                  </p>
                </div>
              ) : (
                filteredRequestsByDoctor
                  .filter(r => r.status === 'APPROVED')
                  .map((approveReq) => {
                    // Gather this patient's records
                    const patientRecords = records.filter(rec => rec.patientId === approveReq.patientId);

                    return (
                      <div
                        key={approveReq.id}
                        className="border border-zinc-200 bg-white rounded-2xl p-6 space-y-4 shadow-sm"
                      >
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-150 pb-3">
                          <div>
                            <span className="text-[9px] font-mono text-emerald-700 flex items-center gap-1 font-bold uppercase">
                              <Unlock className="h-3.5 w-3.5 text-emerald-600" /> Signed Read Grant Verified
                            </span>
                            <h4 className="font-display font-bold text-zinc-900 text-base md:text-lg">
                              {approveReq.patientName}
                            </h4>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setSelectedGrantReq(approveReq)}
                              className="py-1.5 px-3.5 rounded bg-zinc-900 hover:bg-zinc-800 text-white font-mono font-bold text-xs cursor-pointer transition-all flex items-center gap-1 shadow-sm"
                            >
                              + Prescribe Substance
                            </button>
                          </div>
                        </div>

                        {/* List of their records */}
                        <div className="space-y-4">
                          {patientRecords.length === 0 ? (
                            <p className="text-xs text-zinc-450 font-sans italic">Patient has no initial ledger records uploaded.</p>
                          ) : (
                            <div className="grid grid-cols-1 gap-3">
                              {patientRecords.map((rec) => {
                                const isOpened = decryptedRecordIds[rec.id];
                                const hasErr = decryptionError[rec.id];

                                return (
                                  <div
                                    key={rec.id}
                                    className="p-4 rounded-xl bg-zinc-50/60 border border-zinc-200 space-y-3"
                                  >
                                    <div className="flex justify-between items-start gap-3">
                                      <div>
                                        <span className="px-2 py-0.5 rounded bg-zinc-200 text-zinc-700 text-[9px] font-mono uppercase font-bold border border-zinc-250">
                                          {rec.category}
                                        </span>
                                        <h5 className="font-display font-bold text-zinc-900 mt-1 text-sm">{rec.title}</h5>
                                      </div>
                                      
                                      {isOpened ? (
                                        <span className="py-1 px-2.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono text-[9px] font-bold flex items-center gap-1">
                                          ✓ Decrypted
                                        </span>
                                      ) : (
                                        <div className="text-right">
                                          {!showingKeyInputIds[rec.id] ? (
                                            <button
                                              onClick={() => setShowingKeyInputIds({ ...showingKeyInputIds, [rec.id]: true })}
                                              className="py-1 px-3 rounded bg-white hover:bg-zinc-100 border border-zinc-200 text-teal-700 hover:text-teal-800 font-mono text-[10px] font-bold cursor-pointer transition-all flex items-center gap-1 shadow-sm"
                                            >
                                              <Key className="h-3 w-3" /> Local Decrypt
                                            </button>
                                          ) : (
                                            <div className="p-3 bg-zinc-100/60 border border-zinc-200 rounded-xl text-left space-y-2 animate-scale-up max-w-xs shrink-0">
                                              <label className="block text-[8px] font-mono text-zinc-550 uppercase font-bold">
                                                Provide Private Key PEM:
                                              </label>
                                              <textarea
                                                value={recordKeyInputs[rec.id] || ''}
                                                onChange={(e) => setRecordKeyInputs({ ...recordKeyInputs, [rec.id]: e.target.value })}
                                                placeholder="Paste private key block or use auto-fill below..."
                                                rows={3}
                                                className="w-full text-[9px] font-mono p-1.5 border border-zinc-250 rounded bg-white text-zinc-805 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
                                              />
                                              <div className="flex justify-between items-center gap-2">
                                                <button
                                                  type="button"
                                                  onClick={() => setRecordKeyInputs({ ...recordKeyInputs, [rec.id]: user.privateKey || 'MOCK_PEM_PRIVATE_KEY' })}
                                                  className="py-0.5 px-1 border border-zinc-200 rounded text-[7px] font-mono font-bold text-zinc-650 bg-white cursor-pointer hover:bg-zinc-50"
                                                >
                                                  ⚡ Auto-fill
                                                </button>
                                                <div className="flex gap-1">
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      const prev = { ...showingKeyInputIds };
                                                      delete prev[rec.id];
                                                      setShowingKeyInputIds(prev);
                                                    }}
                                                    className="py-0.5 px-1 border border-zinc-250 rounded text-[8px] font-mono text-zinc-650 bg-white cursor-pointer hover:bg-zinc-50"
                                                  >
                                                    Cancel
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => handleDecryptRecord(rec, approveReq, recordKeyInputs[rec.id])}
                                                    className="py-0.5 px-1.5 rounded bg-teal-600 text-white text-[8px] font-mono font-bold cursor-pointer hover:bg-teal-700 transition-colors"
                                                  >
                                                    Unlock
                                                  </button>
                                                </div>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>

                                    {/* Cipher visualization or plaintext result */}
                                    {isOpened ? (
                                      <div className="space-y-3 pt-1">
                                        <div className="bg-white p-3.5 rounded-lg border border-teal-200 text-xs font-sans text-zinc-805 leading-relaxed max-w-full">
                                          <span className="text-[9px] font-mono text-teal-700 flex items-center gap-1.5 mb-1.5 bg-teal-50 border border-teal-200/50 p-1 px-2 rounded font-bold">
                                            ✓ Decryption Authenticated: Plaintext output
                                          </span>
                                          <p className="font-medium text-zinc-800 leading-relaxed">{isOpened}</p>
                                        </div>

                                        {/* Render attached clinical photocard display if present */}
                                        {rec.photoUrl && (
                                          <div className="border border-zinc-200 rounded-xl bg-zinc-50/50 overflow-hidden shadow-sm max-w-sm animate-fade-in">
                                            <div className="p-2 border-b border-zinc-200 bg-white flex items-center justify-between">
                                              <span className="text-[8px] font-mono text-zinc-550 uppercase font-bold flex items-center gap-1">
                                                <Image className="h-3 w-3 text-zinc-400" /> Attached clinical scan
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
                                      <div className="bg-[#f0f0f0] p-3 rounded-lg border border-zinc-200 text-[10px] font-mono text-zinc-500 select-all line-clamp-1 truncate">
                                        ENCRYPTED CIPHER VAULT METADATA: {rec.encryptedContent}
                                      </div>
                                    )}

                                    {hasErr && (
                                      <div className="p-2.5 rounded bg-red-50 border border-red-200 text-[10px] leading-relaxed text-red-700 font-medium text-mono">
                                        ✖ Decryption error: {hasErr}
                                      </div>
                                    )}

                                    {/* Active pills indicator */}
                                    {rec.medicines.length > 0 && (
                                      <div className="flex flex-wrap items-center gap-1 text-[10px] font-mono text-zinc-400 font-semibold pt-1">
                                        <span>Patient Medicines:</span>
                                        {rec.medicines.map((m, i) => (
                                          <span key={i} className="px-1.5 py-0.5 bg-zinc-200 rounded text-zinc-800 uppercase border border-zinc-250 text-[9px]">
                                            {m}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                      </div>
                    );
                  })
              )}
            </div>

          </div>
        )}

        {/* TAB 3: Recent Ledger Logs */}
        {activeTab === 'RECENT_LOGS' && (
          <div id="doctor-logs-vault" className="space-y-6">
            
            <div className="bg-teal-50/70 p-5 rounded-2xl border border-teal-100/60 mb-6">
              <h3 className="font-display text-2xl font-bold text-teal-950">Immutable interaction Ledger</h3>
              <p className="text-sm font-sans text-teal-800/80 mt-1 leading-relaxed">
                Immutable sequencing recording secure clinical request submissions, digital authorizations, decrypters outputs and AI warnings on PIN directory.
              </p>
            </div>

            <div className="space-y-4">
              {filteredLogsByDoctor.map((log) => {
                return (
                  <div
                    key={log.id}
                    className="p-5 rounded-2xl bg-white border border-zinc-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs font-mono shadow-sm"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          log.status === 'SUCCESS' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : log.status === 'ALERT'
                              ? 'bg-red-50 text-red-650 border border-red-200'
                              : 'bg-amber-50 text-amber-750 border border-amber-250'
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
                        Actor profile: <span className="text-zinc-600 font-bold">{log.actorName}</span> ({log.actorRole})
                      </div>
                    </div>

                    <div className="text-left md:text-right shrink-0">
                      <span className="text-[9px] text-zinc-400 block uppercase font-bold">SHA256 Bloc Hash</span>
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

      </main>

      {showScanner && (
        <QRScanner
          allUsers={allUsers}
          onScanSuccess={handleScanSuccess}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Doctor High-Resolution Display Zoom Scanner Lightbox */}
      {selectedZoomPhoto && (
        <div 
          onClick={() => setSelectedZoomPhoto(null)}
          className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-zoom-out animate-fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-zinc-200 rounded-2xl p-4.5 max-w-3xl w-full max-h-[92vh] flex flex-col relative animate-scale-up shadow-2xl cursor-default"
          >
            <div className="flex justify-between items-center pb-2 border-b border-zinc-150 mb-3">
              <h4 className="font-mono font-bold text-zinc-900 text-xs uppercase tracking-tight">
                Primacy Cryptographic Clinician diagnostic Display Viewer
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
                alt="Clinical diagnostic high-resolution zoom display view"
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

    </div>
  );
}
