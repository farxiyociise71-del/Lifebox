import React, { useState, useRef } from 'react';
import {
  X,
  FileText,
  Image as ImageIcon,
  FileCheck,
  Link2,
  Mic,
  User,
  MapPin,
  Calendar,
  Sparkles,
  Loader2,
  Upload,
  Play,
  Square,
  Check,
} from 'lucide-react';
import { LifeboxItem, ItemType, ItemCategory, Collection } from '../types';
import { AiService } from '../services/ai';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveItem: (item: LifeboxItem) => void;
  collections: Collection[];
}

export const QuickAddModal: React.FC<QuickAddModalProps> = ({
  isOpen,
  onClose,
  onSaveItem,
  collections,
}) => {
  const [activeType, setActiveType] = useState<ItemType>('note');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ItemCategory>('personal');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('');
  const [content, setContent] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  // Media state
  const [mediaData, setMediaData] = useState<string>('');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [autoOcr, setAutoOcr] = useState(true);

  // Link state
  const [linkUrl, setLinkUrl] = useState('');

  // Contact state
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactCompany, setContactCompany] = useState('');

  // Location state
  const [locationAddress, setLocationAddress] = useState('');

  // Reminder state
  const [hasReminder, setHasReminder] = useState(false);
  const [reminderDate, setReminderDate] = useState(
    new Date(Date.now() + 86400000).toISOString().split('T')[0]
  );
  const [reminderTime, setReminderTime] = useState('09:00');
  const [reminderPriority, setReminderPriority] = useState<'low' | 'medium' | 'high'>('medium');

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<any>(null);

  if (!isOpen) return null;

  // File upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!title) {
      setTitle(file.name.replace(/\.[^/.]+$/, ''));
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setMediaData(base64);

      if (autoOcr && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
        setOcrLoading(true);
        try {
          const ocr = await AiService.performOcr(base64, file.type, activeType);
          if (ocr.suggestedTitle && !title) setTitle(ocr.suggestedTitle);
          if (ocr.extractedText) setContent(ocr.extractedText);
          if (ocr.tags && ocr.tags.length > 0) {
            setTagsInput((prev) => (prev ? `${prev}, ${ocr.tags.join(', ')}` : ocr.tags.join(', ')));
          }
        } catch (err) {
          console.error(err);
        } finally {
          setOcrLoading(false);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // Voice recording handlers
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (e) => {
        chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        const reader = new FileReader();
        reader.onloadend = () => {
          setMediaData(reader.result as string);
        };
        reader.readAsDataURL(blob);

        // Auto transcribe simulation / text note
        if (!content) {
          setContent('Voice memo recorded on ' + new Date().toLocaleString());
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      alert('Could not access microphone. Please allow audio permissions in browser.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  // Apply note template
  const applyTemplate = (templateName: string) => {
    if (templateName === 'lecture') {
      setTitle('Lecture: ' + (title || 'New Topic'));
      setCategory('study');
      setContent(`## Topic Overview
Main concepts discussed:

## Key Definitions
1. 
2. 

## Summary & Action Items
- Review by: 
- Practice questions: `);
    } else if (templateName === 'meeting') {
      setTitle('Meeting: ' + (title || 'Project Sync'));
      setCategory('work');
      setContent(`## Attendees:
- 

## Discussion Notes:
- 

## Decisions & Action Items:
- [ ] Task 1 (Assignee)
- [ ] Task 2`);
    } else if (templateName === 'checklist') {
      setContent(`- [ ] Step 1
- [ ] Step 2
- [ ] Step 3`);
    }
  };

  // Submit & Save
  const handleSave = () => {
    const finalTitle =
      title.trim() ||
      (activeType === 'contact' ? contactName : '') ||
      (activeType === 'link' ? linkUrl : '') ||
      `New ${activeType.toUpperCase()}`;

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    const newItem: LifeboxItem = {
      id: 'item-' + Date.now(),
      title: finalTitle,
      type: activeType,
      category,
      collectionIds: selectedCollectionId ? [selectedCollectionId] : [],
      content: content.trim(),
      mediaUrl: mediaData || undefined,
      tags: tags.length > 0 ? tags : [activeType, category],
      pinned: isPinned,
      favorite: isFavorite,
      locked: isLocked,
      isTrash: false,
      contactInfo:
        activeType === 'contact'
          ? {
              name: contactName,
              phone: contactPhone,
              email: contactEmail,
              company: contactCompany,
            }
          : undefined,
      locationInfo:
        activeType === 'location'
          ? {
              address: locationAddress,
            }
          : undefined,
      linkInfo:
        activeType === 'link' || activeType === 'webpage'
          ? {
              url: linkUrl,
              domain: linkUrl.replace(/^https?:\/\//, '').split('/')[0],
            }
          : undefined,
      reminder: hasReminder
        ? {
            dueDate: reminderDate,
            dueTime: reminderTime,
            completed: false,
            priority: reminderPriority,
          }
        : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSaveItem(newItem);
    onClose();
  };

  const typeTabs = [
    { id: 'note' as ItemType, label: 'Note', icon: FileText },
    { id: 'photo' as ItemType, label: 'Photo / Scan', icon: ImageIcon },
    { id: 'document' as ItemType, label: 'Document', icon: FileCheck },
    { id: 'link' as ItemType, label: 'Link', icon: Link2 },
    { id: 'voice' as ItemType, label: 'Voice Memo', icon: Mic },
    { id: 'contact' as ItemType, label: 'Contact', icon: User },
    { id: 'location' as ItemType, label: 'Location', icon: MapPin },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div>
            <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900">
              Save Anything to LIFEBOX
            </h2>
            <p className="text-xs text-slate-500">Capture information into your second brain</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Type Selector Tabs */}
        <div className="px-4 pt-3 pb-2 border-b border-slate-200/70 flex items-center gap-1.5 overflow-x-auto text-xs bg-white">
          {typeTabs.map((t) => {
            const Icon = t.icon;
            const isActive = activeType === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveType(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200/70 text-slate-600'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs sm:text-sm">
          {/* Title */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Science Exam Timetable, Photosynthesis Lecture, Passport..."
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
            />
          </div>

          {/* Type-Specific Fields */}
          {/* Note templates */}
          {activeType === 'note' && (
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium">Templates:</span>
              <button
                type="button"
                onClick={() => applyTemplate('lecture')}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs"
              >
                📚 School Lecture
              </button>
              <button
                type="button"
                onClick={() => applyTemplate('meeting')}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs"
              >
                👥 Meeting Notes
              </button>
              <button
                type="button"
                onClick={() => applyTemplate('checklist')}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs"
              >
                ☑️ Checklist
              </button>
            </div>
          )}

          {/* Photo / Scan / PDF Upload */}
          {(activeType === 'photo' || activeType === 'document') && (
            <div className="space-y-3">
              <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl p-6 text-center bg-slate-50/50 hover:bg-indigo-50/20 transition-all cursor-pointer relative">
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <Upload className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
                <p className="font-bold text-slate-800 text-xs sm:text-sm">
                  Click or drag image / scan / document here
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Supports PNG, JPG, WebP, PDF</p>
              </div>

              {mediaData && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-100 border border-slate-200">
                  <img
                    src={mediaData}
                    alt="Preview"
                    className="w-12 h-12 rounded-lg object-cover bg-white"
                  />
                  <div className="flex-1 truncate">
                    <p className="font-bold text-slate-800 truncate">Attachment Loaded</p>
                    <p className="text-[11px] text-emerald-600 font-semibold">Ready for Second Brain</p>
                  </div>
                  {ocrLoading && (
                    <div className="flex items-center gap-1.5 text-xs text-indigo-600 font-semibold">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Reading text (OCR)...</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Voice Memo Recorder */}
          {activeType === 'voice' && (
            <div className="p-5 rounded-2xl bg-purple-50/70 border border-purple-200/80 text-center space-y-3">
              <div className="flex justify-center items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                    isRecording
                      ? 'bg-rose-600 text-white animate-pulse'
                      : 'bg-purple-600 text-white shadow-sm'
                  }`}
                >
                  <Mic className="w-6 h-6" />
                </div>
              </div>

              <div>
                <div className="text-xl font-black font-mono text-purple-950">
                  {Math.floor(recordingSeconds / 60)
                    .toString()
                    .padStart(2, '0')}
                  :{(recordingSeconds % 60).toString().padStart(2, '0')}
                </div>
                <p className="text-xs text-purple-700 mt-0.5">
                  {isRecording ? 'Listening and capturing audio...' : audioUrl ? 'Voice note ready' : 'Tap record to capture voice thought'}
                </p>
              </div>

              <div className="flex justify-center gap-2">
                {!isRecording ? (
                  <button
                    type="button"
                    onClick={startRecording}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs"
                  >
                    Start Recording
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5"
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span>Stop Recording</span>
                  </button>
                )}
              </div>

              {audioUrl && (
                <audio controls src={audioUrl} className="w-full mt-2" />
              )}
            </div>
          )}

          {/* Link / Webpage input */}
          {activeType === 'link' && (
            <div>
              <label className="block font-bold text-slate-700 mb-1">URL / Link Address</label>
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com/article"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono text-xs"
              />
            </div>
          )}

          {/* Contact fields */}
          {activeType === 'contact' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="e.g. Ahmed Vance"
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="name@email.com"
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Company / Role</label>
                <input
                  type="text"
                  value={contactCompany}
                  onChange={(e) => setContactCompany(e.target.value)}
                  placeholder="e.g. University Faculty"
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900"
                />
              </div>
            </div>
          )}

          {/* Location field */}
          {activeType === 'location' && (
            <div>
              <label className="block font-bold text-slate-700 mb-1">Location Address or Place</label>
              <input
                type="text"
                value={locationAddress}
                onChange={(e) => setLocationAddress(e.target.value)}
                placeholder="e.g. Library Study Pod 4, 700 University Ave"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900"
              />
            </div>
          )}

          {/* Main Content Area / Notes */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Content / Notes / Transcription
            </label>
            <textarea
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Type or paste notes, transcription, meeting points..."
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs sm:text-sm font-sans"
            />
          </div>

          {/* Category & Collection Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ItemCategory)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-medium capitalize"
              >
                <option value="personal">Personal</option>
                <option value="study">Study & School</option>
                <option value="work">Work & Projects</option>
                <option value="finance">Finance & Receipts</option>
                <option value="health">Health & Medical</option>
                <option value="ideas">Ideas & Scratchpad</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Add to Collection</label>
              <select
                value={selectedCollectionId}
                onChange={(e) => setSelectedCollectionId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-medium"
              >
                <option value="">None (General Inbox)</option>
                {collections.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Tags (comma separated)</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. biology, exam, ahmed, passport, formula"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 text-xs"
            />
          </div>

          {/* Reminder Accordion */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                <input
                  type="checkbox"
                  checked={hasReminder}
                  onChange={(e) => setHasReminder(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <Calendar className="w-4 h-4 text-indigo-600" />
                <span>Set Date / Expiration Reminder</span>
              </label>
              <span className="text-[11px] text-slate-400">e.g. "Remind before passport expires"</span>
            </div>

            {hasReminder && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-200">
                <div>
                  <span className="block text-[11px] font-semibold text-slate-600 mb-0.5">Due Date</span>
                  <input
                    type="date"
                    value={reminderDate}
                    onChange={(e) => setReminderDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs"
                  />
                </div>
                <div>
                  <span className="block text-[11px] font-semibold text-slate-600 mb-0.5">Time</span>
                  <input
                    type="time"
                    value={reminderTime}
                    onChange={(e) => setReminderTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs"
                  />
                </div>
                <div>
                  <span className="block text-[11px] font-semibold text-slate-600 mb-0.5">Priority</span>
                  <select
                    value={reminderPriority}
                    onChange={(e) => setReminderPriority(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs capitalize"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High (Urgent)</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Quick flags: Pin, Favorite, Lock */}
          <div className="flex items-center gap-4 flex-wrap pt-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isPinned}
                onChange={(e) => setIsPinned(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span>📌 Pin to top</span>
            </label>

            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isFavorite}
                onChange={(e) => setIsFavorite(e.target.checked)}
                className="rounded text-rose-600 focus:ring-rose-500"
              />
              <span>⭐ Favorite</span>
            </label>

            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isLocked}
                onChange={(e) => setIsLocked(e.target.checked)}
                className="rounded text-amber-600 focus:ring-amber-500"
              />
              <span>🔒 Lock with PIN</span>
            </label>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-200/70 font-semibold text-xs sm:text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-sm transition-all active:scale-95 flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Save to LIFEBOX</span>
          </button>
        </div>
      </div>
    </div>
  );
};
