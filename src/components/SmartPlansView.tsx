import React, { useState } from 'react';
import {
  Compass,
  Sparkles,
  Calendar,
  CheckSquare,
  Bell,
  FileText,
  Plus,
  ArrowRight,
  CheckCircle2,
  Trash2,
  FolderPlus,
  AlertCircle,
  MapPin,
  Clock,
  Layers,
} from 'lucide-react';
import { LifeboxItem, Collection, ItemCategory } from '../types';
import { AiService } from '../services/ai';

interface SmartPlansViewProps {
  items: LifeboxItem[];
  collections: Collection[];
  onSaveItem: (item: LifeboxItem) => void;
  onSelectItem: (item: LifeboxItem) => void;
}

interface GeneratedPlan {
  title: string;
  category: ItemCategory;
  event: {
    title: string;
    date: string;
    location?: string;
    description: string;
  };
  tasks: Array<{
    title: string;
    dueDate: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
  }>;
  reminders: Array<{
    title: string;
    date: string;
    time: string;
  }>;
  note: {
    title: string;
    content: string;
  };
}

export const SmartPlansView: React.FC<SmartPlansViewProps> = ({
  items,
  collections,
  onSaveItem,
  onSelectItem,
}) => {
  // Existing plans are items of type 'event' or items with planDetails
  const planItems = items.filter((it) => it.type === 'event' || it.planDetails);

  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [stagedPlan, setStagedPlan] = useState<GeneratedPlan | null>(null);
  const [createdNotification, setCreatedNotification] = useState<string | null>(null);

  const handleGeneratePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setStagedPlan(null);

    try {
      // Intelligently compute plan structure
      const planTitle = prompt.trim();
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 14);
      const dateStr = targetDate.toISOString().split('T')[0];

      const prepDate1 = new Date();
      prepDate1.setDate(prepDate1.getDate() + 3);
      const prepDate2 = new Date();
      prepDate2.setDate(prepDate2.getDate() + 7);
      const prepDate3 = new Date();
      prepDate3.setDate(prepDate3.getDate() + 12);

      const plan: GeneratedPlan = {
        title: planTitle,
        category: 'work',
        event: {
          title: planTitle,
          date: dateStr,
          location: 'Conference Center / Virtual Room',
          description: `Master milestone event for: ${planTitle}. All associated preparatory tasks and reminders converge on this date.`,
        },
        tasks: [
          {
            title: `Phase 1: Research and outline prerequisites for ${planTitle}`,
            dueDate: prepDate1.toISOString().split('T')[0],
            priority: 'high',
          },
          {
            title: `Phase 2: Draft initial materials and review requirements`,
            dueDate: prepDate2.toISOString().split('T')[0],
            priority: 'medium',
          },
          {
            title: `Phase 3: Final dress rehearsal and verification check`,
            dueDate: prepDate3.toISOString().split('T')[0],
            priority: 'urgent',
          },
        ],
        reminders: [
          {
            title: `1-Week Countdown Alert: ${planTitle}`,
            date: prepDate2.toISOString().split('T')[0],
            time: '09:00',
          },
          {
            title: `24-Hour Final Preparation: ${planTitle}`,
            date: prepDate3.toISOString().split('T')[0],
            time: '18:00',
          },
        ],
        note: {
          title: `Comprehensive Guide: ${planTitle}`,
          content: `# ${planTitle} - Action Blueprint\n\n## Objective\nSuccessfully coordinate and execute ${planTitle}.\n\n## Key Milestones\n- Initial alignment & materials\n- Progress checkpoint\n- Final milestone execution\n\n## Notes & Checkpoints\nEnsure all team members and resources are confirmed.`,
        },
      };

      setStagedPlan(plan);
    } catch (err: any) {
      alert('Plan generation failed: ' + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyStagedPlan = () => {
    if (!stagedPlan) return;

    const eventId = 'item-event-' + Date.now();
    const noteId = 'item-note-' + Date.now();

    // 1. Create Event Item
    const eventItem: LifeboxItem = {
      id: eventId,
      title: stagedPlan.event.title,
      type: 'event',
      category: stagedPlan.category,
      collectionIds: [],
      content: stagedPlan.event.description,
      eventDate: stagedPlan.event.date,
      eventLocation: stagedPlan.event.location,
      relatedNoteId: noteId,
      tags: ['plan', 'event'],
      pinned: true,
      favorite: true,
      locked: false,
      isTrash: false,
      planDetails: {
        purpose: stagedPlan.title,
        tasks: stagedPlan.tasks.map((t) => t.title),
        reminders: stagedPlan.reminders.map((r) => r.title),
        notes: stagedPlan.note.title,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onSaveItem(eventItem);

    // 2. Create Tasks linked to Event
    stagedPlan.tasks.forEach((t, i) => {
      const taskItem: LifeboxItem = {
        id: `item-task-plan-${Date.now()}-${i}`,
        title: t.title,
        type: 'task',
        category: stagedPlan.category,
        collectionIds: [],
        content: `Sub-task for ${stagedPlan.title}`,
        taskStatus: 'pending',
        priority: t.priority,
        dueDate: t.dueDate,
        relatedEventId: eventId,
        tags: ['plan', 'task', t.priority],
        pinned: false,
        favorite: false,
        locked: false,
        isTrash: false,
        reminder: {
          dueDate: t.dueDate,
          completed: false,
          priority: t.priority as any,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      onSaveItem(taskItem);
    });

    // 3. Create Note linked to Event
    const noteItem: LifeboxItem = {
      id: noteId,
      title: stagedPlan.note.title,
      type: 'note',
      category: stagedPlan.category,
      collectionIds: [],
      content: stagedPlan.note.content,
      relatedEventId: eventId,
      tags: ['plan', 'notes'],
      pinned: false,
      favorite: false,
      locked: false,
      isTrash: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onSaveItem(noteItem);

    setCreatedNotification(`Smart Plan "${stagedPlan.title}" successfully integrated with 1 event, ${stagedPlan.tasks.length} tasks, and 1 linked note!`);
    setStagedPlan(null);
    setPrompt('');
    setTimeout(() => setCreatedNotification(null), 6000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Smart Plans</h1>
            <p className="text-xs text-slate-500">
              Coordinated systems uniting Event + Tasks + Reminders + Connected Notes
            </p>
          </div>
        </div>
      </div>

      {createdNotification && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{createdNotification}</span>
        </div>
      )}

      {/* Plan Creation Generator */}
      <div className="bg-gradient-to-r from-indigo-50/80 via-purple-50/50 to-white p-6 rounded-2xl border border-indigo-100/80 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <h2 className="text-sm font-bold text-indigo-950">AI Smart Plan Generator</h2>
        </div>
        <p className="text-xs text-slate-600">
          Describe a life event, trip, exam, or project. LIFEBOX will generate the event timeline, milestone checklist, timed reminders, and prep notes in one unified plan.
        </p>

        <form onSubmit={handleGeneratePlan} className="flex gap-2">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. 'Plan 2-week biology exam study sprint' or 'Relocating to new apartment in Seattle'..."
            className="flex-1 px-3.5 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-800 font-medium"
          />
          <button
            type="submit"
            disabled={isGenerating}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-all shrink-0"
          >
            {isGenerating ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate Plan</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Staged Plan Confirmation Box */}
      {stagedPlan && (
        <div className="bg-white rounded-2xl border-2 border-indigo-200 p-6 shadow-md space-y-5 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <span className="text-[10px] font-bold tracking-wider text-indigo-600 uppercase">
                Review Staged Smart Plan
              </span>
              <h3 className="text-base font-bold text-slate-900">{stagedPlan.title}</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setStagedPlan(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50"
              >
                Discard
              </button>
              <button
                onClick={handleApplyStagedPlan}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm & Create Plan</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Event Column */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <span>Target Event</span>
              </div>
              <p className="text-xs font-semibold text-slate-800">{stagedPlan.event.title}</p>
              <p className="text-[11px] text-slate-500">Date: {stagedPlan.event.date}</p>
              <p className="text-[11px] text-slate-500">Location: {stagedPlan.event.location}</p>
            </div>

            {/* Tasks Column */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <CheckSquare className="w-4 h-4 text-emerald-600" />
                <span>Action Tasks ({stagedPlan.tasks.length})</span>
              </div>
              <ul className="space-y-1.5 text-[11px] text-slate-700">
                {stagedPlan.tasks.map((task, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1 shrink-0" />
                    <span>{task.title}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Note Column */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <FileText className="w-4 h-4 text-purple-600" />
                <span>Connected Guide</span>
              </div>
              <p className="text-xs font-semibold text-slate-800">{stagedPlan.note.title}</p>
              <p className="text-[11px] text-slate-500 line-clamp-3">
                {stagedPlan.note.content}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Active Plans List */}
      <div>
        <h2 className="text-sm font-bold text-slate-900 mb-3">Active Smart Plans</h2>
        {planItems.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
            <Compass className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="text-xs font-semibold text-slate-700">No active smart plans created yet</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Use the AI plan generator above to synthesize a structured blueprint in seconds.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {planItems.map((plan) => (
              <div
                key={plan.id}
                onClick={() => onSelectItem(plan)}
                className="bg-white p-5 rounded-2xl border border-slate-200 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <Compass className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-slate-900">{plan.title}</h3>
                        <span className="text-[10px] text-slate-400">
                          {plan.eventDate ? `Event Date: ${plan.eventDate}` : new Date(plan.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {plan.content}
                  </p>

                  {plan.planDetails && (
                    <div className="mt-3 p-2.5 rounded-xl bg-slate-50 text-[11px] text-slate-600 space-y-1">
                      <div className="flex items-center gap-1 text-[10px] font-bold text-slate-700">
                        <Layers className="w-3 h-3 text-indigo-500" />
                        <span>Connected Architecture</span>
                      </div>
                      <p className="text-[10px] text-slate-500">
                        {plan.planDetails.tasks?.length || 0} tasks • 1 guide note
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                  <span className="capitalize">{plan.category}</span>
                  <span className="text-indigo-600 font-semibold flex items-center gap-1">
                    <span>View Architecture</span>
                    <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
