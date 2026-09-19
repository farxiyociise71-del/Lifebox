import React, { useState } from 'react';
import {
  CheckSquare,
  Square,
  Clock,
  Calendar,
  AlertCircle,
  Plus,
  Filter,
  Trash2,
  Tag,
  Link,
  CheckCircle2,
  ArrowRight,
  Flame,
} from 'lucide-react';
import { LifeboxItem, Collection, ItemCategory } from '../types';

interface TasksViewProps {
  items: LifeboxItem[];
  collections: Collection[];
  onSaveItem: (item: LifeboxItem) => void;
  onUpdateItem: (item: LifeboxItem) => void;
  onDeleteItem: (id: string) => void;
  onSelectItem: (item: LifeboxItem) => void;
}

export const TasksView: React.FC<TasksViewProps> = ({
  items,
  collections,
  onSaveItem,
  onUpdateItem,
  onDeleteItem,
  onSelectItem,
}) => {
  // Tasks are items of type 'task' OR items that have reminder/dueDate
  const taskItems = items.filter(
    (it) => (it.type === 'task' || Boolean(it.taskStatus) || Boolean(it.reminder)) && !it.isTrash
  );

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [quickTitle, setQuickTitle] = useState('');
  const [quickDueDate, setQuickDueDate] = useState('');
  const [quickPriority, setQuickPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');

  const handleQuickAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;

    const newTask: LifeboxItem = {
      id: 'item-task-' + Date.now(),
      title: quickTitle.trim(),
      type: 'task',
      category: 'work',
      collectionIds: [],
      content: 'Actionable task created in Tasks view',
      taskStatus: 'pending',
      priority: quickPriority,
      dueDate: quickDueDate || new Date().toISOString().split('T')[0],
      tags: ['task', quickPriority],
      pinned: false,
      favorite: false,
      locked: false,
      isTrash: false,
      reminder: {
        dueDate: quickDueDate || new Date().toISOString().split('T')[0],
        completed: false,
        priority: quickPriority as any,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSaveItem(newTask);
    setQuickTitle('');
    setQuickDueDate('');
  };

  const toggleTaskStatus = (task: LifeboxItem) => {
    const isDone = task.taskStatus === 'completed' || task.reminder?.completed;
    const nextStatus = isDone ? 'pending' : 'completed';

    const updated: LifeboxItem = {
      ...task,
      taskStatus: nextStatus,
      reminder: task.reminder
        ? {
            ...task.reminder,
            completed: !isDone,
          }
        : undefined,
      updatedAt: new Date().toISOString(),
    };

    onUpdateItem(updated);
  };

  const filteredTasks = taskItems.filter((t) => {
    const isCompleted = t.taskStatus === 'completed' || t.reminder?.completed;
    const currentStatus = t.taskStatus || (isCompleted ? 'completed' : 'pending');

    if (statusFilter === 'pending' && isCompleted) return false;
    if (statusFilter === 'completed' && !isCompleted) return false;
    if (statusFilter === 'in_progress' && t.taskStatus !== 'in_progress') return false;

    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;

    return true;
  });

  const totalCount = taskItems.length;
  const completedCount = taskItems.filter(
    (t) => t.taskStatus === 'completed' || t.reminder?.completed
  ).length;
  const percentDone = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <CheckSquare className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Task Management & Priorities</h1>
            <p className="text-xs text-slate-500">
              Track actionable items, deadlines, and project milestones
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200/80">
          <div className="text-right">
            <span className="text-xs font-bold text-slate-800">{completedCount} of {totalCount} Done</span>
            <span className="text-[10px] text-slate-400 block">{percentDone}% completed</span>
          </div>
          <div className="w-24 h-2.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
              style={{ width: `${percentDone}%` }}
            />
          </div>
        </div>
      </div>

      {/* Quick Add Form */}
      <form
        onSubmit={handleQuickAddTask}
        className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center gap-2"
      >
        <div className="relative flex-1 w-full">
          <input
            type="text"
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            placeholder="Add a new task (e.g. 'Review biology flashcards' or 'Prepare Q3 slide deck')..."
            className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <input
            type="date"
            value={quickDueDate}
            onChange={(e) => setQuickDueDate(e.target.value)}
            className="px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-600 focus:outline-hidden"
          />

          <select
            value={quickPriority}
            onChange={(e) => setQuickPriority(e.target.value as any)}
            className="px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-hidden"
          >
            <option value="low">Low Priority</option>
            <option value="medium">Medium</option>
            <option value="high">High Priority</option>
            <option value="urgent">Urgent</option>
          </select>

          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Task</span>
          </button>
        </div>
      </form>

      {/* Status & Priority Filter Pills */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {[
            { id: 'all', label: 'All Tasks' },
            { id: 'pending', label: 'To Do' },
            { id: 'completed', label: 'Completed' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                statusFilter === tab.id
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-slate-400 font-medium">Priority:</span>
          {['all', 'urgent', 'high', 'medium', 'low'].map((pri) => (
            <button
              key={pri}
              onClick={() => setPriorityFilter(pri)}
              className={`px-2 py-0.5 rounded-md capitalize text-[11px] font-medium transition-colors ${
                priorityFilter === pri
                  ? 'bg-indigo-100 text-indigo-800 font-bold'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {pri}
            </button>
          ))}
        </div>
      </div>

      {/* Task Items List */}
      <div className="space-y-2">
        {filteredTasks.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400">
            <CheckSquare className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="text-xs font-semibold text-slate-700">No tasks in this view</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Type in the box above to quickly capture tasks and track due dates.
            </p>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const isDone = task.taskStatus === 'completed' || task.reminder?.completed;
            const priorityColor =
              task.priority === 'urgent'
                ? 'bg-rose-100 text-rose-800 border-rose-200'
                : task.priority === 'high'
                ? 'bg-amber-100 text-amber-800 border-amber-200'
                : task.priority === 'low'
                ? 'bg-slate-100 text-slate-600 border-slate-200'
                : 'bg-blue-100 text-blue-800 border-blue-200';

            return (
              <div
                key={task.id}
                className={`bg-white p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                  isDone
                    ? 'border-slate-200 bg-slate-50/50 opacity-60'
                    : 'border-slate-200 hover:border-indigo-200 shadow-2xs'
                }`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <button
                    onClick={() => toggleTaskStatus(task)}
                    className="p-1 text-slate-400 hover:text-indigo-600 transition-colors shrink-0"
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-100" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <span
                      onClick={() => onSelectItem(task)}
                      className={`text-xs font-semibold cursor-pointer truncate block hover:text-indigo-600 transition-colors ${
                        isDone ? 'line-through text-slate-400' : 'text-slate-900'
                      }`}
                    >
                      {task.title}
                    </span>

                    <div className="flex items-center gap-2.5 mt-0.5 text-[10px] text-slate-400">
                      {(task.dueDate || task.reminder?.dueDate) && (
                        <span className="flex items-center gap-1 text-slate-500">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{task.dueDate || task.reminder?.dueDate}</span>
                        </span>
                      )}
                      <span className="capitalize">{task.category}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {task.priority && (
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${priorityColor}`}
                    >
                      {task.priority}
                    </span>
                  )}

                  <button
                    onClick={() => onDeleteItem(task.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
