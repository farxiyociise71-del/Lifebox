import React, { useState } from 'react';
import {
  FileText,
  Calendar,
  CheckSquare,
  Bell,
  Tag,
  Download,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ArrowLeft,
  Share2,
  AlertCircle,
  Clock,
  MapPin,
  Building,
  User as UserIcon,
  ShieldCheck,
  Layers,
  Save,
} from 'lucide-react';
import { ScanPage, ScanAnalysis, OCRResult, ScannedDocument, DetectedTask, DetectedEvent, DetectedReminder } from '../types';
import { generatePdfFromPages } from '../utils/imageProcessing';

interface ScanResultViewProps {
  scanPages: ScanPage[];
  analysis: ScanAnalysis;
  ocrResult: OCRResult;
  onSaveSuccess: (savedScan: ScannedDocument) => void;
  onRetake: () => void;
  onCancel: () => void;
  userToken?: string | null;
}

export const ScanResultView: React.FC<ScanResultViewProps> = ({
  scanPages,
  analysis: initialAnalysis,
  ocrResult,
  onSaveSuccess,
  onRetake,
  onCancel,
  userToken,
}) => {
  const [title, setTitle] = useState(initialAnalysis.title || 'Scanned Document');
  const [docType, setDocType] = useState(initialAnalysis.documentType || 'document');
  const [summary, setSummary] = useState(initialAnalysis.summary || '');
  const [tags, setTags] = useState<string[]>(initialAnalysis.tags || ['scan']);
  const [newTagInput, setNewTagInput] = useState('');

  // Selected action items that user can selectively approve
  const [tasks, setTasks] = useState<{ item: DetectedTask; selected: boolean }[]>(
    (initialAnalysis.tasks || []).map((t) => ({ item: t, selected: true }))
  );
  const [events, setEvents] = useState<{ item: DetectedEvent; selected: boolean }[]>(
    (initialAnalysis.events || []).map((e) => ({ item: e, selected: true }))
  );
  const [reminders, setReminders] = useState<{ item: DetectedReminder; selected: boolean }[]>(
    (initialAnalysis.reminders || []).map((r) => ({ item: r, selected: true }))
  );

  const [activePageIdx, setActivePageIdx] = useState(0);
  const [showOcrText, setShowOcrText] = useState(false);
  const [copiedOcr, setCopiedOcr] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleCopyOcr = () => {
    if (ocrResult.text) {
      navigator.clipboard.writeText(ocrResult.text);
      setCopiedOcr(true);
      setTimeout(() => setCopiedOcr(false), 2500);
    }
  };

  const handleAddTag = () => {
    if (newTagInput.trim()) {
      const clean = newTagInput.trim().toLowerCase();
      if (!tags.includes(clean)) {
        setTags([...tags, clean]);
      }
      setNewTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleDownloadPdf = async () => {
    try {
      setIsDownloadingPdf(true);
      const pdfBlob = await generatePdfFromPages(scanPages, title);
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/[^a-zA-Z0-9_-]/g, '_') || 'lifebox_scan'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Failed to generate PDF: ' + err.message);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleSaveDocument = async () => {
    setIsSaving(true);
    setStatusMessage('Saving document to LIFEBOX vault...');

    try {
      const payload = {
        title,
        documentType: docType,
        extractedText: ocrResult.text,
        tags,
        pages: scanPages,
        analysis: {
          ...initialAnalysis,
          title,
          documentType: docType,
          summary,
          tags,
          tasks: tasks.filter((t) => t.selected).map((t) => t.item),
          events: events.filter((e) => e.selected).map((e) => e.item),
          reminders: reminders.filter((r) => r.selected).map((r) => r.item),
        },
        status: 'processed',
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (userToken) {
        headers['Authorization'] = `Bearer ${userToken}`;
      }

      const res = await fetch('/api/scans', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server responded with ${res.status}`);
      }

      const data = await res.json();
      const savedScan: ScannedDocument = data.scan;

      // Now create approved tasks, events, and reminders if requested
      const approvedTasks = tasks.filter((t) => t.selected);
      for (const t of approvedTasks) {
        await fetch(`/api/scans/${savedScan.id}/create-task`, {
          method: 'POST',
          headers,
          body: JSON.stringify(t.item),
        }).catch(() => null);
      }

      const approvedEvents = events.filter((e) => e.selected);
      for (const ev of approvedEvents) {
        await fetch(`/api/scans/${savedScan.id}/create-event`, {
          method: 'POST',
          headers,
          body: JSON.stringify(ev.item),
        }).catch(() => null);
      }

      const approvedReminders = reminders.filter((r) => r.selected);
      for (const rm of approvedReminders) {
        await fetch(`/api/scans/${savedScan.id}/create-reminder`, {
          method: 'POST',
          headers,
          body: JSON.stringify(rm.item),
        }).catch(() => null);
      }

      setStatusMessage('Document & confirmed actions saved successfully!');
      setTimeout(() => {
        onSaveSuccess(savedScan);
      }, 700);
    } catch (err: any) {
      console.error('Save scan error:', err);
      alert('Could not save scan: ' + (err.message || 'Unknown error'));
      setIsSaving(false);
      setStatusMessage(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-neutral-50 overflow-y-auto">
      {/* Top Header */}
      <div className="bg-white border-b border-neutral-200 px-4 py-3 flex items-center justify-between sticky top-0 z-20 shadow-xs">
        <div className="flex items-center space-x-3">
          <button
            onClick={onRetake}
            className="p-2 text-neutral-500 hover:text-black hover:bg-neutral-100 rounded-lg transition-colors"
            title="Back to camera / edit"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-neutral-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-neutral-900" />
              Scan Intelligence Review
            </h1>
            <p className="text-xs text-neutral-500">
              {scanPages.length} {scanPages.length === 1 ? 'page' : 'pages'} • OCR Confidence {ocrResult.confidence}%
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            className="px-3 py-1.5 text-xs font-medium text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 text-neutral-500" />
            {isDownloadingPdf ? 'Exporting PDF...' : 'Download PDF'}
          </button>
          <button
            onClick={handleSaveDocument}
            disabled={isSaving}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-black hover:bg-neutral-800 rounded-lg flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save to LIFEBOX</span>
              </>
            )}
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="bg-neutral-100 border-b border-neutral-200 px-4 py-2 text-center text-xs font-medium text-neutral-900 animate-pulse">
          {statusMessage}
        </div>
      )}

      {/* Main Review Grid */}
      <div className="flex-1 max-w-7xl mx-auto w-full p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Multi-page Preview (5 cols) */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          {/* Active Page Card */}
          <div className="bg-white rounded-xl border border-neutral-200 p-3 shadow-xs flex flex-col items-center">
            <div className="relative w-full aspect-3/4 max-h-[460px] bg-black rounded-lg overflow-hidden flex items-center justify-center">
              {scanPages[activePageIdx] ? (
                <img
                  src={scanPages[activePageIdx].image}
                  alt={`Scan page ${activePageIdx + 1}`}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-neutral-400 text-sm">No page image</div>
              )}
              <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-xs text-white text-[11px] px-2 py-0.5 rounded font-mono">
                Page {activePageIdx + 1} of {scanPages.length}
              </div>
            </div>

            {/* Thumbnail pagination if multi-page */}
            {scanPages.length > 1 && (
              <div className="w-full flex items-center justify-center gap-2 mt-3 overflow-x-auto pb-1">
                {scanPages.map((page, idx) => (
                  <button
                    key={page.id || idx}
                    onClick={() => setActivePageIdx(idx)}
                    className={`relative w-12 h-16 rounded border-2 overflow-hidden transition-all shrink-0 ${
                      activePageIdx === idx
                        ? 'border-black ring-2 ring-neutral-300 scale-105'
                        : 'border-neutral-200 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={page.image} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
                    <span className="absolute bottom-0 right-0 bg-black/70 text-[9px] text-white px-1">
                      {idx + 1}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* OCR Extracted Text Drawer */}
          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-xs">
            <button
              onClick={() => setShowOcrText(!showOcrText)}
              className="w-full px-4 py-3 bg-neutral-50 hover:bg-neutral-100 flex items-center justify-between text-left transition-colors border-b border-neutral-200"
            >
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-neutral-900" />
                <span className="text-xs font-semibold text-neutral-900">Exact OCR Extracted Text</span>
                <span className="text-[10px] bg-neutral-200 text-neutral-700 px-1.5 py-0.5 rounded-full font-mono">
                  {ocrResult.blocks?.length || 0} blocks
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-neutral-500">{showOcrText ? 'Hide' : 'Show'}</span>
                {showOcrText ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
              </div>
            </button>

            {showOcrText && (
              <div className="p-4 bg-neutral-900 text-neutral-100 font-mono text-xs max-h-64 overflow-y-auto relative">
                <button
                  onClick={handleCopyOcr}
                  className="absolute top-2 right-2 px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-[10px] text-neutral-200 rounded flex items-center gap-1 border border-neutral-700"
                  title="Copy OCR Text"
                >
                  {copiedOcr ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3" />}
                  {copiedOcr ? 'Copied' : 'Copy'}
                </button>
                {ocrResult.text ? (
                  <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-neutral-200 pr-14">
                    {ocrResult.text}
                  </pre>
                ) : (
                  <p className="text-neutral-400 italic">No text recognized in this scan.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: AI Extracted Document Understanding & Action Items (7 cols) */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          {/* Metadata Card */}
          <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-xs space-y-4">
            <div>
              <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">
                Document Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm font-semibold text-neutral-900 bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-black focus:bg-white"
                placeholder="Give this scan a title..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">
                  Document Classification
                </label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-black"
                >
                  <option value="school_document">School / Academic Document</option>
                  <option value="receipt">Receipt / Financial Proof</option>
                  <option value="invoice">Invoice / Bill</option>
                  <option value="contract">Legal Contract / Agreement</option>
                  <option value="id_card">Identity Document / Card</option>
                  <option value="medical">Medical / Health Record</option>
                  <option value="letter">Official Letter / Notice</option>
                  <option value="note">Handwritten Note / Memo</option>
                  <option value="document">General Document</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">
                  Tags
                </label>
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    placeholder="Add tag..."
                    className="flex-1 px-2.5 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-black"
                  />
                  <button
                    onClick={handleAddTag}
                    className="px-2.5 py-1.5 text-xs font-medium bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Tag Pills */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {tags.map((tg) => (
                <span
                  key={tg}
                  className="inline-flex items-center gap-1 text-[11px] font-medium bg-neutral-100 text-neutral-800 border border-neutral-200 px-2 py-0.5 rounded-md"
                >
                  #{tg}
                  <button
                    onClick={() => handleRemoveTag(tg)}
                    className="text-neutral-500 hover:text-black ml-0.5"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            {/* Summary */}
            <div>
              <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">
                Executive Summary
              </label>
              <textarea
                rows={2}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className="w-full px-3 py-2 text-xs text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-black"
                placeholder="Brief summary of this document..."
              />
            </div>
          </div>

          {/* Action-First Confirmation Box: Tasks */}
          <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckSquare className="w-4 h-4 text-neutral-900" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800">
                  Detected Tasks & Actions ({tasks.length})
                </h3>
              </div>
              <span className="text-[11px] text-neutral-400">Select to add to your Tasks</span>
            </div>

            {tasks.length > 0 ? (
              <div className="space-y-2">
                {tasks.map((t, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start space-x-3 p-3 rounded-lg border transition-all ${
                      t.selected
                        ? 'bg-neutral-50 border-neutral-300'
                        : 'bg-neutral-50/50 border-neutral-200 opacity-60'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={t.selected}
                      onChange={(e) => {
                        const updated = [...tasks];
                        updated[idx].selected = e.target.checked;
                        setTasks(updated);
                      }}
                      className="mt-0.5 w-4 h-4 text-black rounded border-neutral-300 focus:ring-black cursor-pointer accent-black"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-neutral-900">{t.item.title}</p>
                        {t.item.priority && (
                          <span
                            className="text-[10px] font-medium uppercase px-1.5 py-0.5 rounded bg-neutral-200 text-neutral-800"
                          >
                            {t.item.priority}
                          </span>
                        )}
                      </div>
                      {t.item.dueDate && (
                        <p className="text-[11px] text-neutral-500 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" /> Due: {t.item.dueDate}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-neutral-400 italic">No specific tasks detected in this scan.</p>
            )}
          </div>

          {/* Action-First Confirmation Box: Events */}
          <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-neutral-900" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800">
                  Detected Calendar Events ({events.length})
                </h3>
              </div>
              <span className="text-[11px] text-neutral-400">Select to add to Calendar</span>
            </div>

            {events.length > 0 ? (
              <div className="space-y-2">
                {events.map((ev, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start space-x-3 p-3 rounded-lg border transition-all ${
                      ev.selected
                        ? 'bg-neutral-50 border-neutral-300'
                        : 'bg-neutral-50/50 border-neutral-200 opacity-60'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={ev.selected}
                      onChange={(e) => {
                        const updated = [...events];
                        updated[idx].selected = e.target.checked;
                        setEvents(updated);
                      }}
                      className="mt-0.5 w-4 h-4 text-black rounded border-neutral-300 focus:ring-black cursor-pointer accent-black"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-neutral-900">{ev.item.title}</p>
                      <div className="flex flex-wrap gap-2 text-[11px] text-neutral-500 mt-0.5">
                        {ev.item.date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-neutral-700" /> {ev.item.date} {ev.item.time || ''}
                          </span>
                        )}
                        {ev.item.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-neutral-700" /> {ev.item.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-neutral-400 italic">No scheduled events detected in this scan.</p>
            )}
          </div>

          {/* Action-First Confirmation Box: Reminders */}
          <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Bell className="w-4 h-4 text-neutral-900" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800">
                  Detected Deadlines & Reminders ({reminders.length})
                </h3>
              </div>
              <span className="text-[11px] text-neutral-400">Select to add to Reminders</span>
            </div>

            {reminders.length > 0 ? (
              <div className="space-y-2">
                {reminders.map((rm, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start space-x-3 p-3 rounded-lg border transition-all ${
                      rm.selected
                        ? 'bg-neutral-50 border-neutral-300'
                        : 'bg-neutral-50/50 border-neutral-200 opacity-60'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={rm.selected}
                      onChange={(e) => {
                        const updated = [...reminders];
                        updated[idx].selected = e.target.checked;
                        setReminders(updated);
                      }}
                      className="mt-0.5 w-4 h-4 text-black rounded border-neutral-300 focus:ring-black cursor-pointer accent-black"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-neutral-900">{rm.item.title}</p>
                      {rm.item.dueDate && (
                        <p className="text-[11px] text-neutral-500 mt-0.5">
                          Alert on: {rm.item.dueDate} {rm.item.dueTime || '09:00'}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-neutral-400 italic">No explicit reminders or deadlines detected.</p>
            )}
          </div>

          {/* Extracted Entities Chips (People, Locations, Organizations) */}
          {((initialAnalysis.people && initialAnalysis.people.length > 0) ||
            (initialAnalysis.locations && initialAnalysis.locations.length > 0) ||
            (initialAnalysis.organizations && initialAnalysis.organizations.length > 0)) && (
            <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-xs space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                Ground Entities Found
              </h3>
              <div className="flex flex-wrap gap-2 text-xs">
                {initialAnalysis.people?.map((p, i) => (
                  <span key={i} className="inline-flex items-center gap-1 bg-neutral-100 text-neutral-800 px-2 py-0.5 rounded-md">
                    <UserIcon className="w-3 h-3 text-neutral-500" /> {p}
                  </span>
                ))}
                {initialAnalysis.organizations?.map((o, i) => (
                  <span key={i} className="inline-flex items-center gap-1 bg-neutral-100 text-neutral-800 px-2 py-0.5 rounded-md">
                    <Building className="w-3 h-3 text-neutral-500" /> {o}
                  </span>
                ))}
                {initialAnalysis.locations?.map((l, i) => (
                  <span key={i} className="inline-flex items-center gap-1 bg-neutral-100 text-neutral-800 px-2 py-0.5 rounded-md">
                    <MapPin className="w-3 h-3 text-neutral-500" /> {l}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Confirmation Bar */}
          <div className="p-4 bg-neutral-100 border border-neutral-200 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-neutral-900">Ready to save & link to LIFEBOX?</p>
              <p className="text-[11px] text-neutral-600">
                Scans are safely encrypted and indexed for instant AI search and Ask My Stuff.
              </p>
            </div>
            <button
              onClick={handleSaveDocument}
              disabled={isSaving}
              className="px-5 py-2 text-xs font-semibold text-white bg-black hover:bg-neutral-800 rounded-lg shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50 shrink-0"
            >
              {isSaving ? 'Saving...' : 'Confirm & Save Document'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
