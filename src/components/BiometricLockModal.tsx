import React, { useState } from 'react';
import { Fingerprint, KeyRound, Lock, ShieldCheck, X } from 'lucide-react';
import {
  enrollBiometricPasskey,
  hasPasskeyConfigured,
  hasPinConfigured,
  setSecurityPin,
  verifyBiometricPasskey,
  verifySecurityPin,
} from '../lib/biometrics';

interface BiometricLockModalProps {
  mode: 'unlock' | 'configure';
  userEmail: string;
  onUnlock: () => void;
  onClose?: () => void;
}

export const BiometricLockModal: React.FC<BiometricLockModalProps> = ({
  mode,
  userEmail,
  onUnlock,
  onClose,
}) => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleBiometricVerify = async () => {
    setBusy(true);
    setErrorMessage(null);
    const result = await verifyBiometricPasskey();
    setBusy(false);
    if (result.ok) {
      onUnlock();
    } else {
      setErrorMessage(result.message);
    }
  };

  const handleBiometricEnroll = async () => {
    setBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);
    const result = await enrollBiometricPasskey(userEmail);
    setBusy(false);
    if (result.ok) {
      setStatusMessage(result.message);
    } else {
      setStatusMessage(result.message);
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (mode === 'unlock') {
      const valid = await verifySecurityPin(pin);
      if (valid) {
        onUnlock();
      } else {
        setErrorMessage('Incorrect PIN. Please try again.');
        setPin('');
      }
      return;
    }

    if (pin.length < 4 || !/^\d{4,6}$/.test(pin)) {
      setErrorMessage('Enter a 4 to 6 digit numeric PIN.');
      return;
    }
    if (pin !== confirmPin) {
      setErrorMessage('PIN entries do not match.');
      return;
    }
    await setSecurityPin(pin);
    setStatusMessage('Security PIN saved and Biometric Vault Lock enabled.');
    setPin('');
    setConfirmPin('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#11141B] p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-500 dark:text-indigo-400">
              {mode === 'unlock' ? <Lock className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {mode === 'unlock' ? 'Aether Vault Locked' : 'Biometric & PIN Security'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {mode === 'unlock'
                  ? 'Verify Touch ID, Face ID, or Security PIN to resume'
                  : 'Hardware passkey and local PIN protection'}
              </p>
            </div>
          </div>
          {mode === 'configure' && onClose && (
            <button
              onClick={onClose}
              aria-label="Close security settings"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="mt-5 space-y-4">
          {mode === 'unlock' && hasPasskeyConfigured() && (
            <button
              onClick={handleBiometricVerify}
              disabled={busy}
              className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
            >
              <Fingerprint className="w-5 h-5" />
              {busy ? 'Verifying Biometrics...' : 'Unlock with Biometrics'}
            </button>
          )}

          {mode === 'configure' && (
            <button
              onClick={handleBiometricEnroll}
              disabled={busy}
              className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 text-sm font-medium transition-colors"
            >
              <Fingerprint className="w-5 h-5" />
              {busy ? 'Requesting Hardware Key...' : 'Enroll Device Biometric Passkey'}
            </button>
          )}

          {(mode === 'configure' || hasPinConfigured()) && (
            <form onSubmit={handlePinSubmit} className="space-y-3 pt-2 border-t border-slate-200 dark:border-white/10">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                {mode === 'unlock' ? 'Security PIN' : 'Set 4–6 Digit Backup PIN'}
              </label>
              <div className="flex flex-col gap-2">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder={mode === 'unlock' ? 'Enter PIN' : 'Enter new 4–6 digit PIN'}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0A0C10] px-3.5 text-sm font-mono tracking-widest text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {mode === 'configure' && (
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="Confirm PIN"
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0A0C10] px-3.5 text-sm font-mono tracking-widest text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                )}
              </div>
              <button
                type="submit"
                className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <KeyRound className="w-4 h-4" />
                {mode === 'unlock' ? 'Unlock with PIN' : 'Save Security PIN'}
              </button>
            </form>
          )}

          {mode === 'unlock' && !hasPinConfigured() && !hasPasskeyConfigured() && (
            <button
              onClick={onUnlock}
              className="w-full min-h-[44px] rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500"
            >
              Continue to Workspace
            </button>
          )}

          {statusMessage && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 leading-relaxed">{statusMessage}</p>
          )}
          {errorMessage && (
            <p className="text-xs text-rose-600 dark:text-rose-400 leading-relaxed">{errorMessage}</p>
          )}
        </div>
      </div>
    </div>
  );
};
