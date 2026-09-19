import React, { useState } from 'react';
import {
  Clock,
  Calendar,
  CheckCircle2,
  Circle,
  Plus,
  AlertCircle,
  ShieldAlert,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { LifeboxItem, Reminder } from '../types';

interface RemindersViewProps {
  items: LifeboxItem[];
  onSelectItem: (item: LifeboxItem) => void;
  onUpdateItem: (item: LifeboxItem) => void;
  onOpenQuickAdd: () => void;
}

export const RemindersView: React.FC<RemindersViewProps> = ({
  items,
  onSelectItem,
  onUpdateItem,
  onOpenQuickAdd,
}) => {
  const [filter, setFilter] = useState<'pending' | 'completed' | 'all'>('pending');

  const reminderItems = items.filter((i) => !i.isTrash && i.reminder);

  const filteredItems = reminderItems.filter((i) => {
    if (filter === 'pending') return !i.reminder?.completed;
    if (filter === 'completed') return i.reminder?.completed;
    return true;
  });

  const toggleCompleted = (item: LifeboxItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.reminder) return;
    const updated: LifeboxItem = {
      ...item,
      reminder: {
        ...item.reminder,
        completed: !item.reminder.completed,
      },
    };
    onUpdateItem(updated);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-neutral-900 flex items-center gap-2">
            <Clock className="w-6 h-6 text-black" />
            <span>Reminders & Expiration Alerts</span>
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Never forget an exam date, passport renewal, warranty, or follow-up
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white rounded-xl border border-neutral-200 p-1 text-xs font-semibold text-neutral-600">
            <button
              onClick={() => setFilter('pending')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                filter === 'pending' ? 'bg-black text-white shadow-2xs' : 'hover:bg-neutral-100'
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                filter === 'completed' ? 'bg-black text-white shadow-2xs' : 'hover:bg-neutral-100'
              }`}
            >
              Done
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                filter === 'all' ? 'bg-black text-white shadow-2xs' : 'hover:bg-neutral-100'
              }`}
            >
              All
            </button>
          </div>

          <button
            onClick={onOpenQuickAdd}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-black hover:bg-neutral-800 text-white font-semibold text-xs shadow-2xs transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add Reminder</span>
          </button>
        </div>
      </div>

      {/* Smart Expiration Radar Highlight */}
      <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-neutral-100 text-black flex items-center justify-center shrink-0 mt-0.5">
          <ShieldAlert className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <h4 className="text-xs font-bold text-neutral-900">Intelligent Document Radar</h4>
          <p className="text-xs text-neutral-600 mt-0.5 leading-relaxed">
            LIFEBOX watches dates in your scanned papers and tickets. Example: Passport validity is tracked to notify you 6 months prior to expiry.
          </p>
        </div>
      </div>

      {/* Reminders List */}
      <div className="bg-white rounded-3xl border border-neutral-200 p-5 shadow-2xs space-y-3">
        {filteredItems.length === 0 ? (
          <div className="py-12 text-center text-neutral-400 space-y-2">
            <Clock className="w-10 h-10 mx-auto text-neutral-300" />
            <p className="text-xs font-semibold">No reminders found in this category.</p>
            <p className="text-[11px]">Attach a reminder date when saving an item or editing existing notes.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredItems.map((item) => {
              const isDone = item.reminder?.completed;
              return (
                <div
                  key={item.id}
                  onClick={() => onSelectItem(item)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isDone
                      ? 'bg-neutral-50 border-neutral-200/60 opacity-60'
                      : 'bg-white hover:bg-neutral-50 border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <button
                      onClick={(e) => toggleCompleted(item, e)}
                      className="p-1 text-neutral-400 hover:text-black transition-colors shrink-0"
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-5 h-5 text-black" />
                      ) : (
                        <Circle className="w-5 h-5 text-neutral-400 hover:text-black" />
                      )}
                    </button>

                    <div className="truncate">
                      <h4
                        className={`text-xs sm:text-sm font-bold text-neutral-900 truncate ${
                          isDone ? 'line-through text-neutral-400' : ''
                        }`}
                      >
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-neutral-500 mt-0.5 flex items-center gap-2">
                        <span className="flex items-center gap-1 font-semibold text-neutral-900">
                          <Calendar className="w-3 h-3" />
                          Due: {item.reminder?.dueDate}{' '}
                          {item.reminder?.dueTime ? `at ${item.reminder.dueTime}` : ''}
                        </span>
                        <span>•</span>
                        <span className="capitalize">{item.category}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md ${
                        item.reminder?.priority === 'high'
                          ? 'bg-black text-white'
                          : 'bg-neutral-100 text-neutral-800'
                      }`}
                    >
                      {item.reminder?.priority || 'normal'}
                    </span>
                    <ArrowRight className="w-4 h-4 text-neutral-300" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
