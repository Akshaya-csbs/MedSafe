import React, { useState, useEffect } from 'react';
import { UserProfile, MedicalRecord, AccessRequest, AuditLog } from './types.js';
import { generateHash } from './utils/cryptoSim.js';

// Components
import LandingPage from './components/LandingPage.jsx';
import AuthPage from './components/AuthPage.jsx';
import PatientDashboard from './components/PatientDashboard.jsx';
import DoctorDashboard from './components/DoctorDashboard.jsx';
import { Loader2, RefreshCw } from 'lucide-react';

export default function App() {
  // Screens state: 'LANDING' | 'AUTH' | 'PATIENT_DASH' | 'DOCTOR_DASH'
  const [screen, setScreen] = useState<'LANDING' | 'AUTH' | 'PATIENT_DASH' | 'DOCTOR_DASH'>('LANDING');
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');

  // Shared state databases (hydrated via Real-Time API syncing)
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  const [isLoadingState, setIsLoadingState] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);

  // Sync state with server
  const fetchServerState = async (showIndicator = false) => {
    if (showIndicator) setIsSyncing(true);
    try {
      const response = await fetch('/api/state');
      if (!response.ok) {
        throw new Error(`Failed to fetch state from server: ${response.statusText}`);
      }
      const data = await response.json();
      setUsers(data.users || []);
      setRecords(data.records || []);
      setRequests(data.requests || []);
      setLogs(data.logs || []);
      setNetworkError(null);

      // Keep current user updated in real-time if logged in
      if (currentUser) {
        const freshUser = (data.users || []).find((u: UserProfile) => u.id === currentUser.id);
        if (freshUser) {
          // Keep private key if client-side simulation stored it
          setCurrentUser({
            ...freshUser,
            privateKey: currentUser.privateKey || freshUser.privateKey
          });
        }
      }
    } catch (err: any) {
      console.error('Error syncing real-time state:', err);
      setNetworkError('Server disconnected. Attempting to reconnect...');
    } finally {
      setIsLoadingState(false);
      setIsSyncing(false);
    }
  };

  // Poll state every 2 seconds for real-time synchronization between Patient and Doctor interfaces
  useEffect(() => {
    fetchServerState();
    const interval = setInterval(() => {
      fetchServerState();
    }, 2000);
    return () => clearInterval(interval);
  }, [currentUser?.id]);

  // Appends a new audit log with an immutable SHA-256 simulation block
  const handleAddLog = async (action: string, status: 'SUCCESS' | 'WARNING' | 'ALERT', details: string) => {
    const rawContent = `${action}-${details}-${Date.now()}`;
    const newLog: AuditLog = {
      id: `log-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date().toISOString(),
      action,
      actorName: currentUser ? currentUser.name : 'Primacy Ledger',
      actorRole: currentUser ? currentUser.role : 'PATIENT',
      status,
      hash: generateHash(rawContent),
      details
    };

    // Optimistic local state update
    setLogs(prev => [newLog, ...prev]);

    try {
      await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLog),
      });
    } catch (err) {
      console.error('Failed to post audit log:', err);
    }
  };

  // Auth screen pipeline triggers
  const handleAuthSuccess = (user: UserProfile) => {
    setCurrentUser(user);
    handleAddLog(
      'User Authentication Success',
      'SUCCESS',
      `Session established for authenticated ${user.role === 'PATIENT' ? 'Patient' : 'Clinician'}: ${user.email}`
    );
    if (user.role === 'PATIENT') {
      setScreen('PATIENT_DASH');
    } else {
      setScreen('DOCTOR_DASH');
    }
  };

  const handleRegisterUser = async (newUser: UserProfile) => {
    // Optimistic update
    setUsers(prev => [...prev, newUser]);
    try {
      await fetch('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });
    } catch (err) {
      console.error('Failed to register user to ledger:', err);
    }
  };

  // Records pipeline triggers
  const handleAddRecord = async (newRec: MedicalRecord) => {
    // Optimistic update
    setRecords(prev => [newRec, ...prev]);
    try {
      await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRec),
      });
    } catch (err) {
      console.error('Failed to save record to ledger:', err);
    }
  };

  // Requests pipeline triggers
  const handleUpdateRequestStatus = async (
    requestId: string,
    status: 'APPROVED' | 'REJECTED' | 'REVOKED',
    digitalSignature?: string
  ) => {
    // Optimistic update
    setRequests(prev =>
      prev.map(req => {
        if (req.id === requestId) {
          return {
            ...req,
            status,
            decidedAt: new Date().toISOString(),
            ...(digitalSignature ? { digitalSignature } : {})
          };
        }
        return req;
      })
    );

    try {
      await fetch('/api/requests/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, status, digitalSignature }),
      });
    } catch (err) {
      console.error('Failed to update access request:', err);
    }
  };

  // Submit doctor access requests dynamically
  const handleDoctorSubmitRequest = async (patientId: string, patientName: string, justification: string) => {
    if (!currentUser) return;
    
    const newRequest: AccessRequest = {
      id: `req-${Math.random().toString(36).substring(2, 9)}`,
      patientId,
      patientName,
      doctorId: currentUser.id,
      doctorName: currentUser.name,
      doctorSpecialty: currentUser.specialty || 'General Practitioner',
      requestedPurpose: justification,
      status: 'PENDING',
      requestedAt: new Date().toISOString()
    };

    // Optimistic update
    setRequests(prev => [newRequest, ...prev]);

    try {
      await fetch('/api/requests/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRequest),
      });
    } catch (err) {
      console.error('Failed to submit access request:', err);
    }
  };

  const handleLogout = () => {
    if (currentUser) {
      handleAddLog(
        'User Logged Out',
        'SUCCESS',
        `Secure session closed for ${currentUser.email}. Credentials keys uncommitted from active memory.`
      );
    }
    setCurrentUser(null);
    setScreen('LANDING');
  };

  // Trigger manual force synchronization
  const handleForceSync = () => {
    fetchServerState(true);
  };

  if (isLoadingState) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="h-8 w-8 text-teal-600 animate-spin" />
        <p className="text-sm font-mono text-zinc-500">Synchronizing Primacy Ledger Nodes...</p>
      </div>
    );
  }

  return (
    <div id="app-root-frame" className="min-h-screen bg-zinc-50 text-zinc-900 font-sans antialiased relative">
      
      {/* Real-time sync and server connectivity status badge */}
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2">
        {networkError ? (
          <div className="px-3 py-1.5 rounded-full bg-red-100 text-red-700 border border-red-200 text-xs font-mono flex items-center gap-1.5 shadow-sm animate-pulse">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            {networkError}
          </div>
        ) : (
          <button 
            onClick={handleForceSync}
            disabled={isSyncing}
            className="px-3 py-1.5 rounded-full bg-white text-zinc-600 border border-zinc-200 hover:border-zinc-300 text-xs font-mono flex items-center gap-1.5 shadow-sm cursor-pointer hover:bg-zinc-50 active:scale-95 transition-all"
            title="Real-Time Node Sync Active (Click to force refresh)"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            {isSyncing ? 'Syncing...' : 'Live Ledger Active'}
            <RefreshCw className={`h-3 w-3 ml-0.5 text-zinc-400 ${isSyncing ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {screen === 'LANDING' && (
        <LandingPage
          onGetStarted={() => { setAuthMode('REGISTER'); setScreen('AUTH'); }}
          onLogin={() => { setAuthMode('LOGIN'); setScreen('AUTH'); }}
        />
      )}

      {screen === 'AUTH' && (
        <AuthPage
          onBack={() => setScreen('LANDING')}
          onAuthSuccess={handleAuthSuccess}
          existingUsers={users}
          onRegisterUser={handleRegisterUser}
          initialMode={authMode}
        />
      )}

      {screen === 'PATIENT_DASH' && currentUser && (
        <PatientDashboard
          user={currentUser}
          records={records}
          requests={requests}
          logs={logs}
          onLogout={handleLogout}
          onAddRecord={handleAddRecord}
          onUpdateRequestHandler={handleUpdateRequestStatus}
          onAddLog={handleAddLog}
        />
      )}

      {screen === 'DOCTOR_DASH' && currentUser && (
        <DoctorDashboard
          user={currentUser}
          records={records}
          requests={requests}
          logs={logs}
          allUsers={users}
          onLogout={handleLogout}
          onSubmitRequest={handleDoctorSubmitRequest}
          onAddRecord={handleAddRecord}
          onAddLog={handleAddLog}
          onRevokeAccessDirectly={(reqId) => handleUpdateRequestStatus(reqId, 'REVOKED')}
        />
      )}
    </div>
  );
}
