import React, { useState, useEffect } from 'react';
import {
  Settings,
  User,
  Shield,
  Download,
  Trash2,
  HardDrive,
  Lock,
  Sparkles,
  Check,
  Laptop,
  Smartphone,
  Globe,
  AlertTriangle,
  FileText,
  Key,
  LogOut,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { UserProfile, LifeboxItem, UserSession, SecurityAuditEvent } from '../types';
import { ApiService } from '../services/api';

interface SettingsViewProps {
  profile: UserProfile;
  onUpdateProfile: (profile: UserProfile) => void;
  items: LifeboxItem[];
  onResetToDemo: () => void;
  onLogout?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  profile,
  onUpdateProfile,
  items,
  onResetToDemo,
  onLogout,
}) => {
  const [username, setUsername] = useState(profile.username);
  const [email, setEmail] = useState(profile.email);
  const [isPinProtected, setIsPinProtected] = useState(profile.isPinProtected ?? true);
  const [minimizeAiData, setMinimizeAiData] = useState(profile.minimizeAiData ?? true);
  const [autoOcr, setAutoOcr] = useState(profile.autoOcrEnabled ?? true);
  const [autoTag, setAutoTag] = useState(profile.autoTagEnabled ?? true);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Sessions state
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<SecurityAuditEvent[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Change PIN modal state
  const [showPinModal, setShowPinModal] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinChangeError, setPinChangeError] = useState<string | null>(null);
  const [pinChangeSuccess, setPinChangeSuccess] = useState(false);

  // Delete Account modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load sessions and logs on mount
  useEffect(() => {
    loadSessions();
    loadAuditLogs();
  }, []);

  const loadSessions = async () => {
    setLoadingSessions(true);
    try {
      const data = await ApiService.getActiveSessions();
      setSessions(data);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    } finally {
      setLoadingSessions(false);
    }
  };

  const loadAuditLogs = async () => {
    setLoadingLogs(true);
    try {
      const data = await ApiService.getAuditLogs();
      setAuditLogs(data);
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await ApiService.revokeSession(sessionId);
      await loadSessions();
      await loadAuditLogs();
    } catch (err: any) {
      alert(err.message || 'Failed to revoke session');
    }
  };

  const handleRevokeOtherSessions = async () => {
    try {
      await ApiService.revokeOtherSessions();
      await loadSessions();
      await loadAuditLogs();
    } catch (err: any) {
      alert(err.message || 'Failed to revoke sessions');
    }
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated: UserProfile = {
      ...profile,
      username: username.trim(),
      email: email.trim(),
      isPinProtected,
      minimizeAiData,
      autoOcrEnabled: autoOcr,
      autoTagEnabled: autoTag,
    };
    onUpdateProfile(updated);

    try {
      await ApiService.updatePrivacySettings({
        minimizeAiData,
        autoOcrEnabled: autoOcr,
        autoTagEnabled: autoTag,
        isPinRequiredForLocked: isPinProtected,
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err) {
      console.error('Failed to update settings:', err);
    }
  };

  const handlePinUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinChangeError(null);
    if (newPin.length < 4 || newPin.length > 8) {
      setPinChangeError('PIN must be 4 to 8 digits');
      return;
    }

    try {
      await ApiService.updatePin(currentPin, newPin);
      setPinChangeSuccess(true);
      setTimeout(() => {
        setPinChangeSuccess(false);
        setShowPinModal(false);
        setCurrentPin('');
        setNewPin('');
      }, 1500);
      loadAuditLogs();
    } catch (err: any) {
      setPinChangeError(err.message || 'Failed to update PIN');
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError(null);
    if (!deletePassword) {
      setDeleteError('Password is required');
      return;
    }

    setIsDeleting(true);
    try {
      await ApiService.deleteAccount(deletePassword);
      setIsDeleting(false);
      setShowDeleteModal(false);
      if (onLogout) {
        onLogout();
      } else {
        window.location.reload();
      }
    } catch (err: any) {
      setIsDeleting(false);
      setDeleteError(err.message || 'Failed to delete account');
    }
  };

  const handleExportData = async () => {
    try {
      await ApiService.downloadDataExport();
      loadAuditLogs();
    } catch (err: any) {
      alert(err.message || 'Export failed');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl pb-16">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
          <Settings className="w-6 h-6 text-slate-700" />
          <span>Security & Account Governance</span>
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Server-side authentication, active device sessions, privacy controls, and data protection
        </p>
      </div>

      <form onSubmit={handleSavePreferences} className="space-y-6">
        {/* Profile Card */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <User className="w-4 h-4 text-indigo-600" />
            <span>User Identity & Authorization</span>
          </h2>

          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white font-black text-xl flex items-center justify-center shadow-md">
              {username.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">{username}</p>
              <p className="text-xs text-slate-500">{email}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Authenticated Session
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  AES-256-GCM Vault
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Display Name</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-semibold text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-semibold text-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Security & PIN Lock */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-600" />
              <span>Vault Protection & Access PIN</span>
            </h2>
            <button
              type="button"
              onClick={() => setShowPinModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-bold transition-all"
            >
              <Key className="w-3.5 h-3.5" />
              <span>Change PIN</span>
            </button>
          </div>

          <div className="space-y-3">
            <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer">
              <div>
                <p className="text-xs font-bold text-slate-800">Require PIN for Confidential Documents</p>
                <p className="text-[11px] text-slate-500">
                  Passports, ID cards, and locked records remain AES-256 encrypted until PIN is verified
                </p>
              </div>
              <input
                type="checkbox"
                checked={isPinProtected}
                onChange={(e) => setIsPinProtected(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
              />
            </label>

            <div className="p-3 rounded-2xl bg-amber-50/50 border border-amber-200 text-xs text-amber-800 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-600" />
                <span>Zero-Plaintext Architecture</span>
              </p>
              <p className="text-[11px] text-amber-700 leading-relaxed">
                PINs and passwords are salted and hashed using PBKDF2 with 100,000 iterations server-side.
                Brute-force protection temporarily locks verification after 5 consecutive failed attempts.
              </p>
            </div>
          </div>
        </div>

        {/* AI Privacy & Data Minimization */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span>AI Privacy & Data Minimization</span>
          </h2>

          <div className="space-y-2">
            <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer">
              <div>
                <p className="text-xs font-bold text-slate-800">PII Redaction & Data Minimization</p>
                <p className="text-[11px] text-slate-500">
                  Automatically redact credit cards, SSNs, phone numbers, and secrets before AI calls
                </p>
              </div>
              <input
                type="checkbox"
                checked={minimizeAiData}
                onChange={(e) => setMinimizeAiData(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer">
              <div>
                <p className="text-xs font-bold text-slate-800">Automatic Document OCR</p>
                <p className="text-[11px] text-slate-500">
                  Process text from uploads with file format and magic byte verification
                </p>
              </div>
              <input
                type="checkbox"
                checked={autoOcr}
                onChange={(e) => setAutoOcr(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
              />
            </label>
          </div>
        </div>

        {/* Active Sessions & Connected Devices */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-600" />
                <span>Active Sessions & Authorized Devices</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Review and revoke access for devices logged into your account
              </p>
            </div>
            {sessions.length > 1 && (
              <button
                type="button"
                onClick={handleRevokeOtherSessions}
                className="px-3 py-1.5 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-bold transition-colors"
              >
                Revoke All Others
              </button>
            )}
          </div>

          {loadingSessions ? (
            <div className="p-4 flex items-center justify-center text-slate-400 text-xs gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading active sessions...</span>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((sess) => (
                <div
                  key={sess.id}
                  className={`p-3 rounded-2xl border flex items-center justify-between text-xs ${
                    sess.isCurrent
                      ? 'bg-emerald-50/40 border-emerald-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600">
                      {sess.os.toLowerCase().includes('ios') || sess.os.toLowerCase().includes('android') ? (
                        <Smartphone className="w-4 h-4" />
                      ) : (
                        <Laptop className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">
                          {sess.browser} on {sess.os}
                        </span>
                        {sess.isCurrent && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-600 text-white">
                            This Device
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400">
                        IP: {sess.ip} • Last active:{' '}
                        {new Date(sess.lastActiveAt).toLocaleDateString()} at{' '}
                        {new Date(sess.lastActiveAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>

                  {!sess.isCurrent && (
                    <button
                      type="button"
                      onClick={() => handleRevokeSession(sess.id)}
                      className="px-2.5 py-1 rounded-lg text-rose-600 hover:bg-rose-50 text-[11px] font-bold transition-colors"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Security Audit Log */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              <span>Security & Access Audit Trail</span>
            </h2>
            <button
              type="button"
              onClick={loadAuditLogs}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              title="Refresh log"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
            {auditLogs.length === 0 ? (
              <p className="text-xs text-slate-400 p-2 text-center">No security events logged yet.</p>
            ) : (
              auditLogs.slice(0, 10).map((log) => (
                <div
                  key={log.id}
                  className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-start justify-between text-[11px]"
                >
                  <div>
                    <span
                      className={`inline-block font-mono font-bold text-[9px] px-1.5 py-0.5 rounded ${
                        log.eventType.includes('FAIL')
                          ? 'bg-rose-100 text-rose-700'
                          : log.eventType.includes('PURGE')
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-indigo-100 text-indigo-700'
                      }`}
                    >
                      {log.eventType}
                    </span>
                    <p className="text-slate-700 mt-1 font-medium">{log.details}</p>
                    <p className="text-slate-400 text-[10px]">
                      IP: {log.ip}
                    </p>
                  </div>
                  <span className="text-slate-400 text-[10px] whitespace-nowrap ml-2">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Data Portability & Account Governance */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-slate-600" />
            <span>Data Portability & Account Governance</span>
          </h2>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <p className="font-bold text-slate-800">Complete Data Archive (GDPR / CCPA Compliant)</p>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Download all saved items, collections, session history, and security logs in JSON
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportData}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold shadow-2xs shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Full Archive</span>
            </button>
          </div>

          <div className="p-3.5 rounded-2xl bg-rose-50/60 border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <p className="font-bold text-rose-900">Right to be Forgotten (Account Purge)</p>
              <p className="text-rose-700 text-[11px] mt-0.5">
                Permanently purge your account, all credentials, encrypted vaults, and item records
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-2xs shrink-0 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Account & Data</span>
            </button>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={onResetToDemo}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-500 hover:bg-slate-100 text-xs font-semibold transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset Sample Demo Vault</span>
            </button>

            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-sm transition-all active:scale-95"
            >
              {savedSuccess ? <Check className="w-4 h-4" /> : null}
              <span>{savedSuccess ? 'Settings Saved' : 'Save Settings'}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Change PIN Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 relative">
            <h3 className="text-base font-bold text-slate-900 mb-1">Update Security PIN</h3>
            <p className="text-xs text-slate-500 mb-4">
              Enter your current PIN and choose a new 4 to 8 digit code.
            </p>

            <form onSubmit={handlePinUpdate} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Current PIN</label>
                <input
                  type="password"
                  maxLength={8}
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter current PIN"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-center font-mono text-sm tracking-widest font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">New PIN</label>
                <input
                  type="password"
                  maxLength={8}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="New 4-8 digit PIN"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-center font-mono text-sm tracking-widest font-bold"
                  required
                />
              </div>

              {pinChangeError && (
                <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold text-rose-700">
                  {pinChangeError}
                </div>
              )}

              {pinChangeSuccess && (
                <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-700">
                  PIN updated securely with PBKDF2.
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs"
                >
                  Update PIN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-rose-200 relative">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-3">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-rose-900 mb-1">Confirm Permanent Account Purge</h3>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              This action cannot be undone. All your notes, uploaded files, AES-encrypted records, and credentials will be permanently erased.
            </p>

            <form onSubmit={handleDeleteAccount} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Confirm Account Password
                </label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold"
                  required
                />
                <p className="text-[10px] text-slate-400 mt-1">Default account password: LifeboxAdmin2026!</p>
              </div>

              {deleteError && (
                <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold text-rose-700">
                  {deleteError}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDeleting}
                  className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs flex items-center justify-center gap-1"
                >
                  {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Purge Everything</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
