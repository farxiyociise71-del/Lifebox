import React from 'react';
import {
  Bell,
  X,
  CheckCircle2,
  Clock,
  ShieldCheck,
  CheckSquare,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { NotificationItem, ViewTab } from '../types';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onMarkAllAsRead: () => void;
  onSelectNotification: (notif: NotificationItem) => void;
  onRequestBrowserPermissions: () => void;
  browserPermissionStatus: NotificationPermission;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAllAsRead,
  onSelectNotification,
  onRequestBrowserPermissions,
  browserPermissionStatus,
}) => {
  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 backdrop-blur-2xs">
      <div
        className="w-full max-w-sm bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col justify-between animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900">Notifications</h2>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllAsRead}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold"
              >
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Browser Permission Banner */}
        {browserPermissionStatus !== 'granted' && (
          <div className="p-3 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-indigo-900">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="text-[11px]">Enable browser notifications for reminders</span>
            </div>
            <button
              onClick={onRequestBrowserPermissions}
              className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-[10px] font-semibold shrink-0"
            >
              Enable
            </button>
          </div>
        )}

        {/* Notification Items List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {notifications.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Bell className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-xs font-semibold text-slate-700">All caught up!</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                No active notifications or overdue reminders.
              </p>
            </div>
          ) : (
            notifications.map((notif) => {
              const icon =
                notif.type === 'reminder' ? (
                  <Clock className="w-4 h-4 text-purple-600" />
                ) : notif.type === 'task' ? (
                  <CheckSquare className="w-4 h-4 text-emerald-600" />
                ) : notif.type === 'security' ? (
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                ) : (
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                );

              return (
                <div
                  key={notif.id}
                  onClick={() => {
                    onSelectNotification(notif);
                    onClose();
                  }}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                    notif.read
                      ? 'bg-white border-slate-200/80 opacity-75'
                      : 'bg-indigo-50/40 border-indigo-200 shadow-2xs'
                  }`}
                >
                  <div className="p-2 rounded-lg bg-white shadow-2xs border border-slate-100 shrink-0">
                    {icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-xs font-bold text-slate-900 truncate">
                        {notif.title}
                      </h4>
                      <span className="text-[9px] text-slate-400 shrink-0">
                        {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                      {notif.message}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 text-center text-[10px] text-slate-400">
          LIFEBOX Local Alert Engine
        </div>
      </div>
    </div>
  );
};
