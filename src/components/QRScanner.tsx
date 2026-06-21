import React, { useState, useEffect, useRef } from 'react';
import { Camera, Upload, X, ShieldAlert, Sparkles, Check, Play, RefreshCw, FolderOpen, ScanLine, FileText } from 'lucide-react';
import jsQR from 'jsqr';
import { UserProfile } from '../types';

interface QRScannerProps {
  allUsers: UserProfile[];
  onScanSuccess: (patientId: string, patientName: string) => void;
  onClose: () => void;
}

export default function QRScanner({ allUsers, onScanSuccess, onClose }: QRScannerProps) {
  const [scanMode, setScanMode] = useState<'CAMERA' | 'UPLOAD' | 'STATION'>('STATION');
  const [scannedPatient, setScannedPatient] = useState<UserProfile | null>(null);
  const [scanning, setScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Video feed variables
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // File upload state
  const fileInputRef = useRef<HTMLInputElement>(null);

  const patientsList = allUsers.filter(u => u.role === 'PATIENT');

  // Trigger synthesized audio confirmation chime
  const playAffirmativeBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = 'sine';
      // First high crisp tone, then slightly higher to sound pleasant
      oscillator.frequency.setValueAtTime(660, audioCtx.currentTime); // E5
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime + 0.08); // A5

      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.005, audioCtx.currentTime + 0.25);

      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.26);
    } catch (e) {
      console.log('Web Audio chime blocked/unsupported:', e);
    }
  };

  // Clean-up camera stream
  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setScanning(false);
  };

  // Turn on camera for real live qr read
  const startCamera = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setScannedPatient(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true'); // Required for iOS
        videoRef.current.play();
        setScanning(true);
        // Start decoding ticks
        animationFrameRef.current = requestAnimationFrame(decodeCameraTick);
      }
    } catch (err: any) {
      console.error('Camera initialization failed', err);
      setErrorMsg('Could not access media devices camera. Please verify camera hardware permissions or switch to Document Upload scanner mode.');
    }
  };

  const decodeCameraTick = () => {
    if (!videoRef.current || !canvasRef.current || streamRef.current === null) {
      animationFrameRef.current = requestAnimationFrame(decodeCameraTick);
      return;
    }

    if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Match sizes
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert'
        });

        if (code) {
          const parsedPayload = code.data.trim();
          handleScannedData(parsedPayload);
          // Stop camera tracking on successful scan
          stopCamera();
          return;
        }
      }
    }
    animationFrameRef.current = requestAnimationFrame(decodeCameraTick);
  };

  // Process decoded patient ID from QR code
  const handleScannedData = (data: string) => {
    // Find patient matching scanned value (could be direct ID or email address contained)
    const found = patientsList.find(p => p.id === data || p.email === data || data.toLowerCase().includes(p.id.toLowerCase()));
    
    if (found) {
      playAffirmativeBeep();
      setScannedPatient(found);
      setErrorMsg(null);
      setSuccessMsg(`Secure Cryptographic ID Matches Primacy Ledger!`);
    } else {
      setErrorMsg(`Unvalidated QR Data: "${data.substring(0, 50)}". Patient ID not recognized in current Primacy Ledger credentials registry.`);
      setScannedPatient(null);
    }
  };

  // Uploaded PNG / JPG QR code image parser
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setScannedPatient(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code) {
            handleScannedData(code.data.trim());
          } else {
            setErrorMsg('Unable to locate a valid QR code in the uploaded document. Ensure the image is focused and high contrast.');
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Active trigger for testing in sandbox (mock printout documentation card scan)
  const handleSimulatePhysicalScan = (patient: UserProfile) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setScannedPatient(null);
    setScanning(true);
    
    // Simulate holographic laser line scan wait
    setTimeout(() => {
      handleScannedData(patient.id);
      setScanning(false);
    }, 1500);
  };

  // Clear states when mode changes
  useEffect(() => {
    stopCamera();
    setErrorMsg(null);
    setSuccessMsg(null);
    setScannedPatient(null);

    if (scanMode === 'CAMERA') {
      startCamera();
    }

    return () => stopCamera();
  }, [scanMode]);

  const confirmAndBindPatient = () => {
    if (scannedPatient) {
      onScanSuccess(scannedPatient.id, scannedPatient.name);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-zinc-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div id="clinician-qr-scanner-card" className="w-full max-w-lg bg-white rounded-3xl border border-zinc-200 shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        
        {/* Banner with controls */}
        <div className="bg-zinc-900 text-white p-5 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-white/15 flex items-center justify-center text-indigo-400">
              <ScanLine className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-display font-bold text-sm tracking-wide uppercase">Clinician Document QR Scanner</h3>
              <p className="text-[10px] text-zinc-400 font-mono">PRIMACY PATIENT QUICK IDENTITY INTEGRATION</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mode Selector Navigation */}
        <div className="grid grid-cols-3 border-b border-zinc-100 bg-zinc-50 p-2 gap-1 text-xs shrink-0 font-mono font-bold">
          <button
            onClick={() => setScanMode('STATION')}
            className={`py-2 px-1 rounded-xl transition-all cursor-pointer text-center ${
              scanMode === 'STATION'
                ? 'bg-white text-zinc-900 shadow-sm border border-zinc-200'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            📋 Demo Station
          </button>
          <button
            onClick={() => setScanMode('CAMERA')}
            className={`py-2 px-1 rounded-xl transition-all cursor-pointer text-center ${
              scanMode === 'CAMERA'
                ? 'bg-white text-zinc-900 shadow-sm border border-zinc-200'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            📷 Live Camera
          </button>
          <button
            onClick={() => setScanMode('UPLOAD')}
            className={`py-2 px-1 rounded-xl transition-all cursor-pointer text-center ${
              scanMode === 'UPLOAD'
                ? 'bg-white text-zinc-900 shadow-sm border border-zinc-200'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            📁 File Upload
          </button>
        </div>

        {/* Tab View Container */}
        <div className="p-6 flex-1 overflow-y-auto space-y-6">

          {/* STATION: Demo Document simulation */}
          {scanMode === 'STATION' && (
            <div className="space-y-4">
              <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 text-xs text-indigo-950 font-sans leading-relaxed">
                <span className="font-bold flex items-center gap-1.5 mb-1 text-indigo-900">
                  <Sparkles className="h-4 w-4 text-indigo-600" /> Interactive Simulation Station
                </span>
                No webcam or custom printout folder ready? Simulate scanning high-contrast physical dossier codes. This uses authentic ledger processing.
              </div>

              <div className="space-y-2.5">
                <span className="text-[10px] font-mono text-zinc-400 uppercase font-semibold">Ready Dossier Documents:</span>
                {patientsList.map(p => (
                  <div 
                    key={p.id}
                    className="p-4 rounded-2xl bg-white border border-zinc-200/80 hover:border-zinc-300 flex items-center justify-between gap-4 transition-all shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      {/* Fake Document file thumbnail */}
                      <div className="h-10 w-10 bg-zinc-50 rounded-xl border border-zinc-200 flex flex-col items-center justify-center text-zinc-400">
                        <FileText className="h-5 w-5" />
                        <span className="text-[7px] font-mono font-bold leading-none mt-0.5">ID: {p.id.split('-')[1]}</span>
                      </div>
                      <div className="space-y-0.5">
                        <h4 className="font-display font-bold text-xs text-zinc-900">{p.name}</h4>
                        <p className="text-[10px] text-zinc-500 font-mono">{p.email}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleSimulatePhysicalScan(p)}
                      disabled={scanning}
                      className="py-1.5 px-3 bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-100 disabled:text-zinc-400 text-white rounded-xl text-[11px] font-mono font-bold cursor-pointer transition-all flex items-center gap-1 shadow-inner"
                    >
                      {scanning ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                      Scan Dossier
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CAMERA: Live WebRTC reader */}
          {scanMode === 'CAMERA' && (
            <div className="space-y-4">
              <div className="relative aspect-video w-full rounded-2xl bg-zinc-950 border border-zinc-800 overflow-hidden shadow-inner flex items-center justify-center">
                
                {/* Embedded Video Feed */}
                <video 
                  ref={videoRef}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                
                {/* Hidden decoding frame buffer canvas */}
                <canvas ref={canvasRef} className="hidden" />

                {/* Grid Overlay / Aim Finder */}
                {scanning && (
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                    {/* Retro bounding overlay brackets */}
                    <div className="w-56 h-56 border-2 border-white/25 rounded-3xl relative flex flex-col justify-between">
                      {/* Corner marks */}
                      <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-indigo-500 -mt-1 -ml-1 rounded-tl-lg" />
                      <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-indigo-500 -mt-1 -mr-1 rounded-tr-lg" />
                      <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-indigo-500 -ml-1 -mb-1 rounded-bl-lg" />
                      <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-indigo-500 -mr-1 -mb-1 rounded-br-lg" />
                      
                      {/* Interactive scanning ledger line indicator */}
                      <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_10px_#ef4444] animate-bounce" />
                    </div>
                    <span className="text-[10px] font-mono text-white bg-zinc-900/80 px-2.5 py-1 rounded-full mt-4 tracking-wider">
                      ALIGN QR CODE IN FRAME
                    </span>
                  </div>
                )}

                {!scanning && !errorMsg && !successMsg && (
                  <div className="flex flex-col items-center gap-2.5 text-zinc-500">
                    <Camera className="h-8 w-8 animate-pulse text-zinc-600" />
                    <span className="text-xs font-mono">Initializing capture pipeline...</span>
                  </div>
                )}

                {errorMsg && !scanning && (
                  <div className="absolute inset-x-0 bottom-0 p-4 bg-red-950/90 text-red-200 border-t border-red-900 text-xs font-mono text-center leading-relaxed">
                    Camera feed failed. Try Uploading an QR document directly.
                  </div>
                )}
              </div>

              <div className="text-center">
                <button
                  onClick={startCamera}
                  disabled={scanning}
                  className="py-1.5 px-4 bg-zinc-100 hover:bg-zinc-200 disabled:opacity-50 text-zinc-800 rounded-xl font-mono text-[10px] font-bold border border-zinc-200 cursor-pointer shadow-sm mx-auto"
                >
                  🔄 Restart Camera Stream
                </button>
              </div>
            </div>
          )}

          {/* UPLOAD: Manual QR drag & drop */}
          {scanMode === 'UPLOAD' && (
            <div className="space-y-4">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-zinc-200 hover:border-zinc-400 bg-zinc-50/50 hover:bg-zinc-50 rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-3 cursor-pointer transition-all h-[200px]"
              >
                <div className="h-11 w-11 rounded-full bg-white border border-zinc-200 flex items-center justify-center text-zinc-500 shadow-sm">
                  <Upload className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-display font-bold text-xs text-zinc-900">Upload Dossier Image</h4>
                  <p className="text-[11px] text-zinc-550 font-sans mt-0.5">Drag & drop or click to choose a PNG/JPG medical QR code screenshot</p>
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-200 text-[10px] font-sans text-zinc-500 leading-relaxed text-center">
                💡 Patients can display their digital QR health passes from their dashboard tabs. Screenshot those passes to parse instantly!
              </div>
            </div>
          )}

          {/* Feedback states inside container */}
          {scanning && scanMode !== 'CAMERA' && (
            <div className="space-y-2 text-center py-4">
              <div className="inline-flex relative h-10 w-10">
                <div className="absolute inset-0 rounded-full border-2 border-dashed border-indigo-600 animate-spin" />
                <div className="absolute inset-1.5 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
                  <ScanLine className="h-4.5 w-4.5" />
                </div>
              </div>
              <p className="text-xs font-mono font-bold text-zinc-700 animate-pulse">Scanning physical dossier credentials...</p>
            </div>
          )}

          {errorMsg && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs flex gap-3 text-red-800 leading-relaxed font-sans">
              <ShieldAlert className="h-5 w-5 shrink-0 text-red-650" />
              <div>
                <h5 className="font-bold uppercase tracking-wider text-[11px]">System Decryption Exception</h5>
                <p className="text-[11px] mt-0.5 opacity-90">{errorMsg}</p>
              </div>
            </div>
          )}

          {successMsg && scannedPatient && (
            <div className="p-5 bg-teal-50 border border-teal-200 rounded-3xl space-y-4">
              <div className="flex gap-3 text-teal-900 leading-relaxed font-sans">
                <div className="h-8 w-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 shrink-0 select-none">
                  <Check className="h-4.5 w-4.5 stroke-[3]" />
                </div>
                <div>
                  <h5 className="font-bold text-xs uppercase tracking-wider text-teal-950">Patient Secure Identity Verified</h5>
                  <p className="text-[11px] mt-0.5 opacity-90">{successMsg}</p>
                </div>
              </div>

              {/* Patient Card Preview */}
              <div className="bg-white rounded-2xl p-4 border border-teal-150 shadow-sm space-y-2 text-xs">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[8px] font-mono text-zinc-400 block uppercase font-bold">PRIMACY PATIENT</span>
                    <h4 className="font-display font-bold text-sm text-zinc-900">{scannedPatient.name}</h4>
                  </div>
                  <div className="px-2 py-0.5 bg-teal-50 text-teal-800 font-mono text-[9px] rounded font-bold border border-teal-150">
                    ID MATCH
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-100 text-[10px] font-mono leading-none">
                  <div>
                    <span className="text-zinc-400 block text-[8px] uppercase font-bold pb-0.5">Primacy ID Address</span>
                    <span className="text-zinc-700 font-bold truncate block">{scannedPatient.id}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[8px] uppercase font-bold pb-0.5">Email Directory</span>
                    <span className="text-zinc-700 font-bold truncate block">{scannedPatient.email}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={confirmAndBindPatient}
                className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs font-sans tracking-wide transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
              >
                Authenticate & Populate Justification Form
              </button>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
