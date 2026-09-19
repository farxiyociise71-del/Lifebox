import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  MapPin,
  CalendarDays,
} from 'lucide-react';
import { LifeboxItem, Collection } from '../types';

interface CalendarViewProps {
  items: LifeboxItem[];
  collections: Collection[];
  onSaveItem: (item: LifeboxItem) => void;
  onSelectItem: (item: LifeboxItem) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  items,
  collections,
  onSaveItem,
  onSelectItem,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');

  // Month navigation
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };
  const jumpToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDay(today.toISOString().split('T')[0]);
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleString('default', { month: 'long' });

  // Calculate calendar grid for month
  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  // Map calendar items by YYYY-MM-DD
  const itemsByDate: { [key: string]: LifeboxItem[] } = {};

  items.forEach((item) => {
    if (item.isTrash) return;

    const dateKey =
      item.eventDate ||
      item.dueDate ||
      item.reminder?.dueDate ||
      (item.type === 'task' && item.createdAt.split('T')[0]);

    if (dateKey) {
      if (!itemsByDate[dateKey]) itemsByDate[dateKey] = [];
      itemsByDate[dateKey].push(item);
    }
  });

  const selectedDayItems = itemsByDate[selectedDay] || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Calendar & Timeline</h1>
            <p className="text-xs text-slate-500">
              Synchronized view of events, scheduled reminders, and task deadlines
            </p>
          </div>
        </div>

        {/* Month Navigation Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={jumpToday}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Today
          </button>
          <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200">
            <button
              onClick={prevMonth}
              className="p-1 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-bold text-slate-800 min-w-[120px] text-center">
              {monthName} {year}
            </span>
            <button
              onClick={nextMonth}
              className="p-1 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-white transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid (2 cols on desktop) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          {/* Day Names Header */}
          <div className="grid grid-cols-7 text-center text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          {/* Calendar Cells */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty prefix slots */}
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <div key={`empty-${i}`} className="h-20 bg-slate-50/50 rounded-xl border border-transparent" />
            ))}

            {/* Days in Month */}
            {Array.from({ length: totalDays }).map((_, i) => {
              const dayNum = i + 1;
              const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const isSelected = dateKey === selectedDay;
              const isToday = dateKey === new Date().toISOString().split('T')[0];
              const dayItems = itemsByDate[dateKey] || [];

              return (
                <div
                  key={dayNum}
                  onClick={() => setSelectedDay(dateKey)}
                  className={`h-20 p-1.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-500/20'
                      : isToday
                      ? 'border-indigo-200 bg-slate-50'
                      : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${
                        isToday
                          ? 'bg-indigo-600 text-white'
                          : isSelected
                          ? 'text-indigo-700'
                          : 'text-slate-700'
                      }`}
                    >
                      {dayNum}
                    </span>
                    {dayItems.length > 0 && (
                      <span className="text-[9px] font-bold text-slate-400">
                        {dayItems.length}
                      </span>
                    )}
                  </div>

                  {/* Indicators for tasks/events */}
                  <div className="space-y-0.5 overflow-hidden">
                    {dayItems.slice(0, 2).map((item) => (
                      <div
                        key={item.id}
                        className={`text-[9px] truncate px-1 py-0.5 rounded-sm font-medium ${
                          item.type === 'event'
                            ? 'bg-purple-100 text-purple-800'
                            : item.type === 'task'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-indigo-100 text-indigo-800'
                        }`}
                      >
                        {item.title}
                      </div>
                    ))}
                    {dayItems.length > 2 && (
                      <span className="text-[8px] text-slate-400 font-semibold pl-1">
                        +{dayItems.length - 2} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Day Agenda Side Panel */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Agenda for
                </h3>
                <p className="text-sm font-bold text-slate-900">
                  {new Date(selectedDay + 'T00:00:00').toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </div>

              <button
                onClick={() => {
                  const newEvent: LifeboxItem = {
                    id: 'item-event-' + Date.now(),
                    title: 'New Event',
                    type: 'event',
                    category: 'personal',
                    collectionIds: [],
                    content: 'Scheduled event for ' + selectedDay,
                    eventDate: selectedDay,
                    tags: ['event'],
                    pinned: false,
                    favorite: false,
                    locked: false,
                    isTrash: false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  };
                  onSaveItem(newEvent);
                  onSelectItem(newEvent);
                }}
                className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            {/* Agenda Item Cards */}
            <div className="space-y-2.5">
              {selectedDayItems.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <CalendarDays className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-xs font-medium">Nothing scheduled for this day</p>
                </div>
              ) : (
                selectedDayItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => onSelectItem(item)}
                    className="p-3 rounded-xl border border-slate-200 hover:border-indigo-300 bg-slate-50/50 hover:bg-white transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${
                          item.type === 'event'
                            ? 'bg-purple-100 text-purple-700'
                            : item.type === 'task'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-indigo-100 text-indigo-700'
                        }`}
                      >
                        {item.type}
                      </span>
                      {item.eventLocation && (
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{item.eventLocation}</span>
                        </span>
                      )}
                    </div>
                    <h4 className="text-xs font-bold text-slate-900">{item.title}</h4>
                    <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                      {item.content}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
