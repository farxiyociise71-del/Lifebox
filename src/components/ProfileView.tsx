import React, { useState } from 'react';
import {
  User,
  Mail,
  Globe,
  Clock,
  Bell,
  Save,
  LogOut,
  Shield,
  Sparkles,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { UserProfile } from '../types';
import { ApiService } from '../services/api';

interface ProfileViewProps {
  profile: UserProfile;
  onUpdateProfile: (updated: Partial<UserProfile>) => void;
  onOpenAuthModal: () => void;
  onSignOut: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  profile,
  onUpdateProfile,
  onOpenAuthModal,
  onSignOut,
}) => {
  const [username, setUsername] = useState(profile.username);
  const [email, setEmail] = useState(profile.email);
  const [language, setLanguage] = useState(profile.language || 'English (US)');
  const [timezone, setTimezone] = useState(profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [isSaved, setIsSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Notification prefs
  const [emailNotifs, setEmailNotifs] = useState(profile.notificationPreferences?.email ?? true);
  const [reminderNotifs, setReminderNotifs] = useState(profile.notificationPreferences?.reminders ?? true);
  const [dailyBriefing, setDailyBriefing] = useState(profile.notificationPreferences?.dailyBriefing ?? true);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updates: Partial<UserProfile> = {
        username: username.trim(),
        language,
        timezone,
        notificationPreferences: {
          email: emailNotifs,
          push: true,
          reminders: reminderNotifs,
          dailyBriefing,
        },
      };

      await ApiService.updateProfile(updates);
      onUpdateProfile(updates);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err: any) {
      alert('Failed to update profile: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header Profile Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center text-white text-xl font-bold shadow-md shadow-indigo-200">
            {profile.username ? profile.username.charAt(0).toUpperCase() : 'U'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">{profile.username}</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                Active Vault
              </span>
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              <span>{profile.email}</span>
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Member since {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'September 2026'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenAuthModal}
            className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Switch Account
          </button>
          <button
            onClick={onSignOut}
            className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Edit Profile Details */}
      <form onSubmit={handleSaveProfile} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-sm font-bold text-slate-900">Personal Information</h2>
          <p className="text-xs text-slate-500">Manage your identity and localization settings</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Display Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Email Address (Fixed)
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="email"
                disabled
                value={email}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 text-slate-500 cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Preferred Language
            </label>
            <div className="relative">
              <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden bg-white"
              >
                <option value="English (US)">English (US)</option>
                <option value="Spanish (Español)">Spanish (Español)</option>
                <option value="French (Français)">French (Français)</option>
                <option value="German (Deutsch)">German (Deutsch)</option>
                <option value="Japanese (日本語)">Japanese (日本語)</option>
                <option value="Chinese (Simplified)">Chinese (Simplified)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Timezone
            </label>
            <div className="relative">
              <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="border-t border-slate-100 pt-5 space-y-3">
          <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
            <Bell className="w-4 h-4 text-indigo-600" />
            <span>Notification & Digest Preferences</span>
          </h3>

          <div className="space-y-2">
            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80 cursor-pointer">
              <div>
                <span className="text-xs font-semibold text-slate-800 block">Task & Event Reminders</span>
                <span className="text-[11px] text-slate-500">
                  Receive browser notifications when a scheduled reminder is due
                </span>
              </div>
              <input
                type="checkbox"
                checked={reminderNotifs}
                onChange={(e) => setReminderNotifs(e.target.checked)}
                className="w-4 h-4 rounded-sm text-indigo-600 focus:ring-indigo-500 border-slate-300"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80 cursor-pointer">
              <div>
                <span className="text-xs font-semibold text-slate-800 block">Morning Briefing</span>
                <span className="text-[11px] text-slate-500">
                  Synthesize an autonomous briefing of upcoming tasks and priority items daily
                </span>
              </div>
              <input
                type="checkbox"
                checked={dailyBriefing}
                onChange={(e) => setDailyBriefing(e.target.checked)}
                className="w-4 h-4 rounded-sm text-indigo-600 focus:ring-indigo-500 border-slate-300"
              />
            </label>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          {isSaved ? (
            <div className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" />
              <span>Profile preferences saved!</span>
            </div>
          ) : (
            <span />
          )}

          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-all active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Profile'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
