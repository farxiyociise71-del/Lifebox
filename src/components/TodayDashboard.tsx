import React from 'react';
import {
  Sun,
  Bot,
  Calendar,
  Clock,
  GraduationCap,
  FileText,
  Star,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Plus,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import { LifeboxItem, UserProfile } from '../types';

interface TodayDashboardProps {
  items: LifeboxItem[];
  profile: UserProfile;
  onSelectItem: (item: LifeboxItem) => void;
  onSelectTab: (tab: any) => void;
  onOpenQuickAdd: () => void;
  onOpenAskStuff: () => void;
  onToggleReminderDone: (item: LifeboxItem) => void;
}

export const TodayDashboard: React.FC<TodayDashboardProps> = ({
  items,
  profile,
  onSelectItem,
  onSelectTab,
  onOpenQuickAdd,
  onOpenAskStuff,
  onToggleReminderDone,
}) => {
  const activeItems = items.filter((i) => !i.isTrash);
  const favorites = activeItems.filter((i) => i.favorite);
  const reminders = activeItems.filter((i) => i.reminder && !i.reminder.completed);
  const studentItems = activeItems.filter((i) => i.studentMeta?.flashcards?.length);
  const importantDocs = activeItems.filter(
    (i) => i.category === 'personal' || i.category === 'finance' || i.tags.includes('important') || i.tags.includes('expiry')
  );

  // Derive dynamic attention alerts from real saved user data
  const attentionItems = activeItems.filter((it) => {
    if (it.reminder && !it.reminder.completed) return true;
    const lowerTags = (it.tags || []).map((t) => t.toLowerCase());
    return lowerTags.some((t) => ['expiry', 'deadline', 'urgent', 'renew', 'exam'].includes(t));
  });

  // Time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const userDisplayName = profile?.username?.trim() ? profile.username.trim().split(' ')[0] : '';
  const greetingHeader = userDisplayName ? `${getGreeting()}, ${userDisplayName}` : getGreeting();

  const currentDateFormatted = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());

  return (
    <div className="space-y-6">
      {/* Hero Daily Briefing Greeting */}
      <div className="bg-black rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden border border-neutral-800 shadow-md">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-900 text-neutral-300 text-xs font-semibold mb-3 border border-neutral-800">
            <Sun className="w-3.5 h-3.5 text-white" />
            <span>{currentDateFormatted}</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black tracking-tight mb-2">
            {greetingHeader}
          </h1>
          <p className="text-neutral-300 text-sm sm:text-base leading-relaxed mb-6">
            {activeItems.length === 0
              ? 'Welcome to your private second brain. Save your notes, documents, screenshots, and ideas to keep everything in one place.'
              : "Here's what your LIFEBOX has organized and what may need your attention today."}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => onSelectTab('agent')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-black font-bold text-xs sm:text-sm shadow-md hover:bg-neutral-200 transition-all active:scale-95"
            >
              <Bot className="w-4 h-4 text-black" />
              <span>Launch AI Agent</span>
            </button>

            <button
              onClick={() => onOpenAskStuff()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-medium text-xs sm:text-sm border border-neutral-700 transition-all active:scale-95"
            >
              <Sparkles className="w-4 h-4 text-neutral-300" />
              <span>Quick Query</span>
            </button>

            <button
              onClick={onOpenQuickAdd}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-medium text-xs sm:text-sm border border-neutral-600 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Quick Save</span>
            </button>
          </div>
        </div>
      </div>

      {/* Daily Overview Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div
          onClick={() => onSelectTab('reminders')}
          className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-2xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-medium text-neutral-600">Reminders</span>
            <Clock className="w-4 h-4 text-neutral-900 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-neutral-900">{reminders.length}</div>
          <p className="text-[11px] text-neutral-500 mt-0.5">Tasks & alerts</p>
        </div>

        <div
          onClick={() => onSelectTab('student')}
          className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-2xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-medium text-neutral-600">Study Decks</span>
            <GraduationCap className="w-4 h-4 text-neutral-900 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-neutral-900">{studentItems.length}</div>
          <p className="text-[11px] text-neutral-500 mt-0.5">Flashcard topics</p>
        </div>

        <div
          onClick={() => onSelectTab('items')}
          className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-2xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-medium text-neutral-600">Key Documents</span>
            <FileText className="w-4 h-4 text-neutral-900 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-neutral-900">{importantDocs.length}</div>
          <p className="text-[11px] text-neutral-500 mt-0.5">Saved records</p>
        </div>

        <div
          onClick={() => onSelectTab('items')}
          className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-2xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-medium text-neutral-600">Favorites</span>
            <Star className="w-4 h-4 text-neutral-900 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-neutral-900">{favorites.length}</div>
          <p className="text-[11px] text-neutral-500 mt-0.5">Pinned items</p>
        </div>
      </div>

      {/* "Here's what may need your attention today" Section */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${attentionItems.length > 0 ? 'bg-black animate-ping' : 'bg-neutral-400'}`} />
            <h2 className="text-base font-bold text-neutral-900">Here's what may need your attention today</h2>
          </div>
          <span className="text-xs text-neutral-500 font-medium">Intelligent Briefing</span>
        </div>

        {attentionItems.length === 0 ? (
          <div className="p-6 rounded-xl bg-neutral-50 border border-neutral-200 text-center">
            <p className="text-xs sm:text-sm font-semibold text-neutral-800">No urgent deadlines or alerts</p>
            <p className="text-xs text-neutral-500 mt-1 max-w-md mx-auto">
              {activeItems.length === 0
                ? 'Your LIFEBOX is completely fresh. Click Quick Save above or add a note or document to begin.'
                : 'All your saved items are up to date with no pending overdue tasks.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {attentionItems.slice(0, 4).map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-xl bg-neutral-100 border border-neutral-200 flex items-start gap-3"
              >
                <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center shrink-0 mt-0.5">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-neutral-900 truncate">{item.title}</h4>
                  <p className="text-xs text-neutral-700 mt-0.5 line-clamp-2 leading-relaxed">
                    {item.reminder?.notes || item.summary || item.content || 'Active reminder in your LIFEBOX.'}
                  </p>
                  {item.reminder?.dueDate && (
                    <p className="text-[11px] font-semibold text-neutral-900 mt-1">
                      Due: {item.reminder.dueDate} {item.reminder.dueTime ? `at ${item.reminder.dueTime}` : ''}
                    </p>
                  )}
                  <button
                    onClick={() => onSelectItem(item)}
                    className="mt-2 text-xs font-bold text-black hover:underline inline-flex items-center gap-1"
                  >
                    <span>View Record</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Reminders & Quick To-Dos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-black" />
              <span>Pending Reminders & Deadlines</span>
            </h3>
            <button
              onClick={() => onSelectTab('reminders')}
              className="text-xs font-semibold text-black hover:underline"
            >
              View all ({reminders.length})
            </button>
          </div>

          {reminders.length === 0 ? (
            <p className="text-xs text-neutral-400 py-4 text-center">No pending reminders right now. All caught up!</p>
          ) : (
            <div className="space-y-2.5">
              {reminders.slice(0, 4).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 border border-neutral-200 hover:bg-neutral-100 transition-colors"
                >
                  <div className="flex items-center gap-2.5 truncate mr-2">
                    <button
                      onClick={() => onToggleReminderDone(item)}
                      className="text-neutral-400 hover:text-black transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                    <div className="truncate cursor-pointer" onClick={() => onSelectItem(item)}>
                      <p className="text-xs font-bold text-neutral-900 truncate">{item.title}</p>
                      <p className="text-[11px] text-neutral-500">
                        Due {item.reminder?.dueDate} {item.reminder?.dueTime ? `at ${item.reminder.dueTime}` : ''}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md ${
                      item.reminder?.priority === 'high'
                        ? 'bg-black text-white'
                        : 'bg-neutral-200 text-neutral-800'
                    }`}
                  >
                    {item.reminder?.priority || 'Normal'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recently Saved Items Stream */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-black" />
              <span>Recently Saved to LIFEBOX</span>
            </h3>
            <button
              onClick={() => onSelectTab('items')}
              className="text-xs font-semibold text-black hover:underline"
            >
              See all
            </button>
          </div>

          <div className="space-y-2.5">
            {activeItems.slice(0, 4).map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectItem(item)}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-neutral-100 border border-transparent hover:border-neutral-200 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3 truncate">
                  <div className="w-8 h-8 rounded-lg bg-neutral-100 group-hover:bg-black text-neutral-800 group-hover:text-white flex items-center justify-center shrink-0 font-bold text-xs transition-colors">
                    {item.type.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-bold text-neutral-900 truncate group-hover:text-black transition-colors">
                      {item.title}
                    </p>
                    <p className="text-[11px] text-neutral-500 capitalize">
                      {item.category} • {item.type}
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-black group-hover:translate-x-0.5 transition-all" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
