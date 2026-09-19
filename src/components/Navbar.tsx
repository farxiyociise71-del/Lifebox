import React from 'react';
import {
  Brain,
  Search,
  Plus,
  Sparkles,
  Lock,
  Unlock,
  Settings,
  Sun,
  Trash2,
  Calendar,
  Compass,
  Bell,
  User,
} from 'lucide-react';
import { UserProfile, ViewTab } from '../types';

interface NavbarProps {
  currentTab: ViewTab;
  onSelectTab: (tab: ViewTab) => void;
  onOpenQuickAdd: () => void;
  onOpenSearch: () => void;
  onOpenAskStuff: () => void;
  onOpenSettings: () => void;
  onOpenNotifications?: () => void;
  unreadNotificationsCount?: number;
  onOpenProfile?: () => void;
  onOpenAuthModal?: () => void;
  profile: UserProfile;
  isUnlocked: boolean;
  onToggleLock: () => void;
  trashCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  onOpenQuickAdd,
  onOpenSearch,
  onOpenAskStuff,
  onOpenSettings,
  onOpenNotifications,
  unreadNotificationsCount = 0,
  onOpenProfile,
  onOpenAuthModal,
  profile,
  isUnlocked,
  onToggleLock,
  trashCount,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-neutral-200 px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Brand Logo */}
        <div
          onClick={() => onSelectTab('today')}
          className="flex items-center gap-3 cursor-pointer group select-none flex-shrink-0"
        >
          <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold tracking-tight text-black text-lg">LIFEBOX</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-neutral-100 text-neutral-900 border border-neutral-300">
                Second Brain
              </span>
            </div>
            <p className="text-xs text-neutral-500 hidden sm:block">Find, remember & act on everything</p>
          </div>
        </div>

        {/* Universal Search Bar Trigger */}
        <div className="flex-1 max-w-xl mx-2 sm:mx-6">
          <button
            onClick={onOpenSearch}
            className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-600 text-sm transition-colors border border-neutral-200 group"
          >
            <div className="flex items-center gap-2.5 truncate">
              <Search className="w-4 h-4 text-neutral-400 group-hover:text-black transition-colors" />
              <span className="truncate">Search notes, images, PDFs, people, dates...</span>
            </div>
            <kbd className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-500 bg-white px-2 py-0.5 rounded-md border border-neutral-300 shadow-2xs">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Ask My Stuff Button */}
          <button
            onClick={() => onSelectTab('agent')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-medium text-xs sm:text-sm border transition-all active:scale-95 ${
              currentTab === 'agent'
                ? 'bg-black text-white border-black shadow-xs'
                : 'bg-white hover:bg-neutral-100 text-black border-neutral-300 shadow-2xs'
            }`}
            title="Ask My Stuff AI Agent"
          >
            <Sparkles className={`w-4 h-4 ${currentTab === 'agent' ? 'text-white' : 'text-neutral-700'}`} />
            <span className="hidden sm:inline font-semibold">Ask My Stuff</span>
          </button>

          {/* Quick Add Button */}
          <button
            onClick={onOpenQuickAdd}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-black hover:bg-neutral-800 text-white font-medium text-xs sm:text-sm shadow-sm transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Save Anything</span>
          </button>

          {/* Notifications Bell */}
          {onOpenNotifications && (
            <button
              onClick={onOpenNotifications}
              className="relative p-2 rounded-xl border border-neutral-200 hover:bg-neutral-100 text-neutral-700 transition-colors"
              title="Alerts & Reminders"
            >
              <Bell className="w-4 h-4" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-black text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                </span>
              )}
            </button>
          )}

          {/* Privacy Lock Toggle */}
          <button
            onClick={onToggleLock}
            className={`p-2 rounded-xl border transition-all ${
              isUnlocked
                ? 'bg-black border-black text-white hover:bg-neutral-800'
                : 'bg-neutral-100 border-neutral-300 text-neutral-700 hover:bg-neutral-200'
            }`}
            title={isUnlocked ? 'Private items unlocked (Click to lock)' : 'Private items locked with PIN'}
          >
            {isUnlocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          </button>

          {/* Profile & Avatar */}
          <button
            onClick={() => onSelectTab('profile')}
            className="flex items-center gap-1.5 p-1 pr-2 rounded-xl hover:bg-neutral-100 transition-colors border border-transparent hover:border-neutral-200"
            title={`Signed in as ${profile.username}`}
          >
            <div className="w-7 h-7 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold ring-1 ring-neutral-400">
              {profile.username ? profile.username.charAt(0).toUpperCase() : 'U'}
            </div>
            <span className="text-xs font-medium text-neutral-800 hidden lg:inline max-w-[80px] truncate">
              {profile.username}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
