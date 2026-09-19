import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  KeyRound,
  Lock,
  Unlock,
  Smartphone,
  Laptop,
  Globe,
  Download,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  LogOut,
  History,
  FileSpreadsheet,
} from 'lucide-react';
import { UserProfile, UserSession, SecurityAuditEvent, LifeboxItem } from '../types';
import { ApiService } from '../services/api';

interface SecurityCenterViewProps {
  profile: UserProfile;
  isUnlocked: boolean;
  items: LifeboxItem[];
  onUpdateProfile: (profile: Partial<UserProfile>) => void;
  onRequirePin: () => void;
  onSignOut: () => void;
}

export const SecurityCenterView: React.FC<SecurityCenterViewProps> = ({
  profile,
  isUnlocked,
  items,
  onUpdateProfile,
  onRequirePin,
  onSignOut,
}) => {
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [auditLogs, setAuditLogs] = useState<SecurityAuditEvent[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [pinChangeSuccess, setPinChangeSuccess] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Load active sessions and audit logs
  const loadSecurityData = async () => {
    setLoadingSessions(true);
    try {
      const sess = await ApiService.getSessions();
      setSessions(sess);
      const logs = await ApiService.getAuditLogs();
      setAuditLogs(logs);
    } catch (err) {
      console.warn('Could not fetch sessions/logs:', err);
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    loadSecurityData();
  }, []);

  const handleUpdatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length !== 4) {
      alert('Security PIN must be exactly 4 digits.');
      return;
    }

    try {
      await ApiService.updateProfile({ pinCode: newPin });
      onUpdateProfile({ pinCode: newPin, isPinProtected: true });
      setPinChangeSuccess(true);
      setNewPin('');
      setTimeout(() => setPinChangeSuccess(false), 3000);
    } catch (err: any) {
      alert('Failed to update PIN: ' + err.message);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    if (!confirm('Revoke this session? That device will be signed out immediately.')) return;
    try {
      await ApiService.revokeSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err: any) {
      alert('Failed to revoke session: ' + err.message);
    }
  };

  const handleExportData = () => {
    setExportLoading(true);
    try {
      const exportObject = {
        exportDate: new Date().toISOString(),
        user: {
          username: profile.username,
          email: profile.email,
        },
        itemsCount: items.length,
        items: items,
      };

      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportObject, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `lifebox-export-${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err: any) {
      alert('Data export failed: ' + err.message);
    } finally {
      setExportLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      setDeleteError('Please enter your password to confirm permanent account deletion.');
      return;
    }

    try {
      await ApiService.deleteAccount(deletePassword);
      alert('Your account and all associated encrypted data have been permanently wiped.');
      onSignOut();
    } catch (err: any) {
      setDeleteError(err.message || 'Account purge failed. Incorrect password.');
    }
  };

  const lockedCount = items.filter((it) => it.locked).length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Security & Privacy Center</h1>
            <p className="text-xs text-slate-500">
              Hardware-accelerated AES-256-GCM vault, device sessions, and audit logging
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Encryption & Vault Status */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
            <Lock className="w-4 h-4 text-indigo-600" />
            <span>Vault Encryption Status</span>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-100 space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>AES-256-GCM Active</span>
            </div>
            <p className="text-[11px] text-emerald-700 leading-relaxed">
              Locked items are encrypted at rest with zero-knowledge keys. Only decrypted upon PIN verification.
            </p>
          </div>

          <div className="text-xs text-slate-600 space-y-2">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span>Encrypted Items:</span>
              <span className="font-bold text-slate-900">{lockedCount}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span>Vault Session:</span>
              <span className={`font-bold ${isUnlocked ? 'text-emerald-600' : 'text-amber-600'}`}>
                {isUnlocked ? 'Unlocked' : 'Locked'}
              </span>
            </div>
          </div>

          {!isUnlocked && (
            <button
              onClick={onRequirePin}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors"
            >
              Unlock Vault with PIN
            </button>
          )}
        </div>

        {/* Change Vault PIN */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
            <KeyRound className="w-4 h-4 text-purple-600" />
            <span>Update Vault PIN</span>
          </div>
          <p className="text-xs text-slate-500">
            Change the 4-digit code required to reveal private files and sensitive notes.
          </p>

          <form onSubmit={handleUpdatePin} className="space-y-3">
            <div>
              <input
                type="text"
                maxLength={4}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                placeholder="New 4-digit PIN"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden font-mono tracking-widest text-center text-slate-800"
              />
            </div>

            {pinChangeSuccess && (
              <div className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>PIN updated successfully!</span>
              </div>
            )}

            <button
              type="submit"
              disabled={newPin.length !== 4}
              className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors"
            >
              Save New PIN
            </button>
          </form>
        </div>

        {/* Export & Data Sovereignty */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <Download className="w-4 h-4 text-sky-600" />
              <span>Full Data Export</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Download your complete second brain database in open JSON format anytime.
            </p>
          </div>

          <button
            onClick={handleExportData}
            disabled={exportLoading}
            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border border-slate-200 transition-colors"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Download All Data (.JSON)</span>
          </button>
        </div>
      </div>

      {/* Active Device Sessions */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900">Active Device Sessions</h2>
          </div>
          <button
            onClick={loadSecurityData}
            disabled={loadingSessions}
            className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingSessions ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {sessions.length === 0 ? (
            <p className="text-xs text-slate-400 py-3">No other active sessions.</p>
          ) : (
            sessions.map((sess) => (
              <div key={sess.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                    <Laptop className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">{sess.browser} on {sess.os}</span>
                      {sess.isCurrent && (
                        <span className="px-1.5 py-0.5 rounded-sm bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          Current Device
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400">
                      IP: {sess.ip} • Last active: {new Date(sess.lastActiveAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                {!sess.isCurrent && (
                  <button
                    onClick={() => handleRevokeSession(sess.id)}
                    className="px-2.5 py-1 rounded-lg text-rose-600 hover:bg-rose-50 text-xs font-semibold border border-rose-200"
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Security Audit Log */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <History className="w-4 h-4 text-slate-600" />
          <h2 className="text-sm font-bold text-slate-900">Security Audit Log</h2>
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto">
          {auditLogs.length === 0 ? (
            <p className="text-xs text-slate-400">No security audit logs recorded yet.</p>
          ) : (
            auditLogs.map((log) => (
              <div
                key={log.id}
                className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-bold text-slate-800 uppercase tracking-wider text-[10px] mr-2">
                    {log.eventType}
                  </span>
                  <span className="text-slate-600">{log.details}</span>
                </div>
                <span className="text-[10px] text-slate-400 shrink-0">
                  {new Date(log.timestamp).toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Dangerous: Permanent Delete Account */}
      <div className="bg-rose-50/70 rounded-2xl border border-rose-200 p-5 shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-rose-900 font-bold text-sm">
          <AlertTriangle className="w-4 h-4 text-rose-600" />
          <span>Right to be Forgotten (Account Purge)</span>
        </div>
        <p className="text-xs text-rose-800 leading-relaxed">
          Permanently eradicate your account, encryption keys, and all uploaded notes and media from the server. This action is irreversible.
        </p>

        {!deleteConfirmOpen ? (
          <button
            onClick={() => setDeleteConfirmOpen(true)}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold transition-colors"
          >
            Delete Account Permanently
          </button>
        ) : (
          <div className="space-y-3 pt-2">
            {deleteError && (
              <div className="text-xs text-rose-700 font-semibold">{deleteError}</div>
            )}
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Confirm your password..."
              className="w-full max-w-sm px-3 py-1.5 text-xs bg-white border border-rose-300 rounded-xl focus:outline-hidden"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs text-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                className="px-4 py-1.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold"
              >
                Confirm Irreversible Deletion
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
