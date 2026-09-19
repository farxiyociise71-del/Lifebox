import React, { useState } from 'react';
import { Lock, X, ShieldAlert, Loader2 } from 'lucide-react';
import { ApiService } from '../services/api';

interface PinPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (pin?: string) => void;
  title?: string;
  description?: string;
  itemId?: string; // If unlocking a specific vault item
}

export const PinPromptModal: React.FC<PinPromptModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  title = 'Enter Security PIN',
  description = 'Enter your 4-digit PIN to authenticate and decrypt sensitive vault items.',
  itemId,
}) => {
  const [pin, setPin] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  if (!isOpen) return null;

  const handleDigit = async (digit: string) => {
    if (isVerifying || isLockedOut) return;
    if (pin.length < 4) {
      const next = pin + digit;
      setPin(next);
      setErrorMessage(null);

      if (next.length === 4) {
        setIsVerifying(true);
        try {
          // Perform server-side PIN verification with brute-force protection
          await ApiService.verifyPin(next);
          setIsVerifying(false);
          onSuccess(next);
          setPin('');
          onClose();
        } catch (err: any) {
          setIsVerifying(false);
          setPin('');
          const msg = err.message || 'Incorrect PIN code';
          setErrorMessage(msg);
          if (msg.toLowerCase().includes('lock') || msg.toLowerCase().includes('too many')) {
            setIsLockedOut(true);
            setLockoutSeconds(300);
          }
        }
      }
    }
  };

  const handleBackspace = () => {
    if (isVerifying || isLockedOut) return;
    setPin((prev) => prev.slice(0, -1));
    setErrorMessage(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200/80 relative text-center">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mb-3">
          {isVerifying ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : isLockedOut ? (
            <ShieldAlert className="w-6 h-6 text-rose-600" />
          ) : (
            <Lock className="w-6 h-6" />
          )}
        </div>

        <h3 className="text-lg font-bold text-slate-900 mb-1">{title}</h3>
        <p className="text-xs text-slate-500 mb-6 leading-relaxed">{description}</p>

        {/* PIN Indicators */}
        <div className="flex justify-center gap-4 mb-6">
          {[0, 1, 2, 3].map((idx) => {
            const filled = pin.length > idx;
            return (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full transition-all duration-200 ${
                  errorMessage
                    ? 'bg-rose-500 scale-110'
                    : filled
                    ? 'bg-indigo-600 scale-105'
                    : 'bg-slate-200'
                }`}
              />
            );
          })}
        </div>

        {errorMessage && (
          <div className="p-2 mb-4 bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold text-rose-700">
            {errorMessage}
          </div>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-2.5 max-w-[240px] mx-auto mb-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              disabled={isVerifying || isLockedOut}
              onClick={() => handleDigit(digit)}
              className="w-16 h-14 rounded-xl bg-slate-100 hover:bg-slate-200/80 disabled:opacity-40 text-slate-800 text-lg font-bold transition-all active:scale-90 flex items-center justify-center mx-auto"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            disabled={isVerifying || isLockedOut}
            onClick={() => setPin('')}
            className="w-16 h-14 rounded-xl bg-slate-50 hover:bg-slate-100 disabled:opacity-40 text-slate-500 text-xs font-medium flex items-center justify-center mx-auto"
          >
            Clear
          </button>
          <button
            type="button"
            disabled={isVerifying || isLockedOut}
            onClick={() => handleDigit('0')}
            className="w-16 h-14 rounded-xl bg-slate-100 hover:bg-slate-200/80 disabled:opacity-40 text-slate-800 text-lg font-bold transition-all active:scale-90 flex items-center justify-center mx-auto"
          >
            0
          </button>
          <button
            type="button"
            disabled={isVerifying || isLockedOut}
            onClick={handleBackspace}
            className="w-16 h-14 rounded-xl bg-slate-50 hover:bg-slate-100 disabled:opacity-40 text-slate-500 text-xs font-medium flex items-center justify-center mx-auto"
          >
            ⌫
          </button>
        </div>

        <p className="text-[11px] text-slate-400 mt-4">Protected by server-side rate limiting and PBKDF2</p>
      </div>
    </div>
  );
};
