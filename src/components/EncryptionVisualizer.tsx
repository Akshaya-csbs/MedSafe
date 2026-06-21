import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, Unlock, Loader2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface EncryptionVisualizerProps {
  plainText: string;
  cipherText: string;
  isEncrypting: boolean;
}

export default function EncryptionVisualizer({
  plainText,
  cipherText,
  isEncrypting,
}: EncryptionVisualizerProps) {
  const [scrambleText, setScrambleText] = useState('');
  const [animationStep, setAnimationStep] = useState<'IDLE' | 'READING' | 'CRYPTING' | 'SECURED'>('IDLE');

  useEffect(() => {
    if (isEncrypting) {
      setAnimationStep('READING');
      let t = 0;
      const interval = setInterval(() => {
        t += 1;
        if (t === 1) {
          setAnimationStep('CRYPTING');
        } else if (t === 3) {
          setAnimationStep('SECURED');
          clearInterval(interval);
        }
      }, 700);

      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+';
      const scrambleInterval = setInterval(() => {
        let sc = '';
        for (let i = 0; i < Math.min(plainText.length, 60); i++) {
          sc += chars[Math.floor(Math.random() * chars.length)];
        }
        setScrambleText(sc);
      }, 50);

      return () => {
        clearInterval(interval);
        clearInterval(scrambleInterval);
      };
    } else {
      setAnimationStep('IDLE');
    }
  }, [isEncrypting, plainText]);

  if (!isEncrypting && animationStep === 'IDLE') {
    return null;
  }

  return (
    <div id="encryption-visualizer-card" className="border border-zinc-200 bg-white rounded-2xl p-6 shadow-md animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          {animationStep === 'READING' && <Loader2 className="h-5 w-5 animate-spin text-zinc-600" />}
          {animationStep === 'CRYPTING' && <Sparkles className="h-5 w-5 animate-bounce text-amber-500" />}
          {animationStep === 'SECURED' && <ShieldCheck className="h-5 w-5 text-teal-600" />}
          <span className="font-display font-bold text-zinc-800 text-xs md:text-sm tracking-wide uppercase">
            {animationStep === 'READING' && 'Reading Private Ledger Plaintext'}
            {animationStep === 'CRYPTING' && 'Zero-Knowledge Asymmetric Encryption...'}
            {animationStep === 'SECURED' && 'Asymmetric Encrypted Vault Active'}
          </span>
        </div>
        <div className="inline-flex self-start sm:self-auto items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 text-xs font-mono font-bold text-zinc-700 border border-zinc-200">
          <Lock className="h-3.5 w-3.5 text-zinc-900" /> SECURE HANDSHAKE
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left Hand: Private Input */}
        <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200">
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 mb-2 font-bold uppercase">
            <Unlock className="h-3.5 w-3.5 text-amber-600" />
            Plaintext (Unencrypted)
          </div>
          <div className="font-sans text-xs md:text-sm text-zinc-800 max-h-[100px] overflow-y-auto break-words select-none leading-relaxed font-medium">
            {plainText}
          </div>
        </div>

        {/* Right Hand: Crypto Vault Cipher Output */}
        <div className="bg-teal-50/20 p-4 rounded-xl border border-teal-200 overflow-hidden relative">
          <div className="flex items-center gap-2 text-xs font-mono text-teal-700 mb-2 font-bold uppercase">
            <Lock className="h-3.5 w-3.5 text-teal-600" />
            Ciphertext (Encrypted Vault Payload)
          </div>
          <div className="font-mono text-xs text-teal-900 break-all h-[100px] overflow-y-auto leading-relaxed select-all">
            <AnimatePresence mode="wait">
              {animationStep === 'READING' && (
                <motion.span
                  key="reading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.6 }}
                  exit={{ opacity: 0 }}
                  className="text-zinc-500 italic"
                >
                  Encrypting with patient public key...
                </motion.span>
              )}
              {animationStep === 'CRYPTING' && (
                <motion.span
                  key="crypting"
                  initial={{ opacity: 1 }}
                  animate={{ opacity: [0.8, 1, 0.9] }}
                  className="text-amber-700 block break-words"
                >
                  {scrambleText}
                </motion.span>
              )}
              {animationStep === 'SECURED' && (
                <motion.span
                  key="secured"
                  initial={{ scale: 0.98, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-emerald-900 block select-all font-semibold break-all"
                >
                  {cipherText}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
