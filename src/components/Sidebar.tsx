import React from 'react';
import {
  Sun,
  Bot,
  Inbox,
  FolderTree,
  FileText,
  Camera,
  Calendar,
  GraduationCap,
  Network,
  Trash2,
  Settings,
  Sparkles,
  ShieldCheck,
  FileCode,
  Image as ImageIcon,
  Mic,
  CheckSquare,
  Compass,
  User,
  Search,
} from 'lucide-react';
import { ViewTab } from '../types';

interface SidebarProps {
  currentTab: ViewTab;
  onSelectTab: (tab: ViewTab) => void;
  counts: {
    total: number;
    notes: number;
    documents?: number;
    photos?: number;
    voice?: number;
    tasks?: number;
    reminders: number;
    student: number;
    trash: number;
  };
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab, counts }) => {
  const primaryNav = [
    { id: 'today' as ViewTab, label: 'Home', icon: Sun },
    { id: 'agent' as ViewTab, label: 'LIFEBOX AI', icon: Bot, badge: 'Chat' },
    { id: 'notes' as ViewTab, label: 'Notes', icon: FileText, badge: counts.notes },
    { id: 'documents' as ViewTab, label: 'Documents', icon: FileCode, badge: counts.documents },
    { id: 'scanner' as ViewTab, label: 'Document Scanner', icon: Camera, badge: 'AI' },
    { id: 'photos' as ViewTab, label: 'Photos & Scans', icon: ImageIcon, badge: counts.photos },
    { id: 'voice' as ViewTab, label: 'Voice Notes', icon: Mic, badge: counts.voice },
    { id: 'tasks' as ViewTab, label: 'Tasks', icon: CheckSquare, badge: counts.tasks },
    { id: 'plans' as ViewTab, label: 'Smart Plans', icon: Compass, badge: 'New' },
    { id: 'calendar' as ViewTab, label: 'Calendar', icon: Calendar, badge: counts.reminders },
    { id: 'collections' as ViewTab, label: 'Collections', icon: FolderTree },
    { id: 'items' as ViewTab, label: 'All Items', icon: Inbox, badge: counts.total },
  ];

  const secondaryNav = [
    { id: 'security' as ViewTab, label: 'Security Center', icon: ShieldCheck },
    { id: 'profile' as ViewTab, label: 'My Profile', icon: User },
    { id: 'student' as ViewTab, label: 'Student Mode', icon: GraduationCap, badge: counts.student },
    { id: 'graph' as ViewTab, label: 'Knowledge Graph', icon: Network },
    { id: 'trash' as ViewTab, label: 'Trash', icon: Trash2, badge: counts.trash > 0 ? counts.trash : undefined },
  ];

  return (
    <aside className="w-64 bg-neutral-50 border-r border-neutral-200 p-3 flex flex-col justify-between shrink-0 hidden md:flex min-h-[calc(100vh-65px)] overflow-y-auto">
      <div className="space-y-4">
        {/* Core Primary Navigation */}
        <div className="space-y-0.5">
          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
            Workspace
          </div>
          {primaryNav.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-black text-white shadow-xs border border-black font-bold'
                    : 'text-neutral-600 hover:text-black hover:bg-neutral-200/70'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-neutral-500'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      isActive
                        ? 'bg-neutral-800 text-white font-bold'
                        : 'bg-neutral-200 text-neutral-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* System & Tools */}
        <div className="space-y-0.5 pt-2 border-t border-neutral-200">
          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
            Security & System
          </div>
          {secondaryNav.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-black text-white shadow-xs border border-black font-bold'
                    : 'text-neutral-600 hover:text-black hover:bg-neutral-200/70'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-neutral-500'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-neutral-200 text-neutral-700">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom info banner */}
      <div className="pt-3 border-t border-neutral-200 space-y-2 mt-4">
        <button
          onClick={() => onSelectTab('settings')}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all ${
            currentTab === 'settings'
              ? 'bg-black text-white font-bold border border-black shadow-2xs'
              : 'text-neutral-600 hover:bg-neutral-200/70 font-medium'
          }`}
        >
          <Settings className={`w-4 h-4 ${currentTab === 'settings' ? 'text-white' : 'text-neutral-500'}`} />
          <span>Settings & Backup</span>
        </button>

        <div className="p-2.5 rounded-xl bg-white border border-neutral-200 shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-semibold text-neutral-900 mb-0.5">
            <ShieldCheck className="w-3.5 h-3.5 text-black" />
            <span>Vault Protected</span>
          </div>
          <p className="text-[10px] text-neutral-500 leading-tight">
            AES-256-GCM hardware encryption active.
          </p>
        </div>
      </div>
    </aside>
  );
};
