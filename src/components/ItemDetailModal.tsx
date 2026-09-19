import React, { useState } from 'react';
import {
  X,
  Pin,
  Heart,
  Lock,
  Unlock,
  Trash2,
  Copy,
  Sparkles,
  GraduationCap,
  Calendar,
  Share2,
  Download,
  Loader2,
  Check,
  CheckCircle2,
  Play,
  FileText,
  Volume2,
} from 'lucide-react';
import { LifeboxItem, Flashcard, QuizQuestion } from '../types';
import { AiService } from '../services/ai';
import confetti from 'canvas-confetti';

interface ItemDetailModalProps {
  item: LifeboxItem | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateItem: (item: LifeboxItem) => void;
  onDeleteItem: (id: string) => void;
  onDuplicateItem: (id: string) => void;
  isUnlocked: boolean;
  onRequirePin: () => void;
}

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({
  item,
  isOpen,
  onClose,
  onUpdateItem,
  onDeleteItem,
  onDuplicateItem,
  isUnlocked,
  onRequirePin,
}) => {
  if (!isOpen || !item) return null;

  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [content, setContent] = useState(item.content);
  const [summary, setSummary] = useState(item.summary || '');
  const [keyPoints, setKeyPoints] = useState<string[]>(item.keyPoints || []);
  const [tags, setTags] = useState<string[]>(item.tags || []);
  const [tagsInput, setTagsInput] = useState(item.tags.join(', '));

  // AI loading states
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  // Flashcards state
  const [flashcards, setFlashcards] = useState<Flashcard[]>(item.studentMeta?.flashcards || []);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>(item.studentMeta?.quizQuestions || []);
  const [activeQuizQuestionIdx, setActiveQuizQuestionIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState(0);

  const isLocked = item.locked && !isUnlocked;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleAiSummarize = async () => {
    setIsSummarizing(true);
    try {
      const res = await AiService.summarizeContent(item.title, item.content || item.extractedText || '');
      setSummary(res.summary);
      setKeyPoints(res.keyPoints);

      const updated = {
        ...item,
        summary: res.summary,
        keyPoints: res.keyPoints,
        tags: res.tags ? Array.from(new Set([...item.tags, ...res.tags])) : item.tags,
      };
      onUpdateItem(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleGenerateStudentQuiz = async () => {
    setIsGeneratingQuiz(true);
    try {
      const res = await AiService.generateQuiz(item.title, item.content || item.extractedText || '');
      const cards: Flashcard[] = res.flashcards.map((f, i) => ({
        id: 'fc-' + Date.now() + '-' + i,
        question: f.question,
        answer: f.answer,
      }));
      setFlashcards(cards);
      setQuizQuestions(res.quizQuestions);

      const updated: LifeboxItem = {
        ...item,
        studentMeta: {
          subject: item.category === 'study' ? 'Academics' : 'General',
          flashcards: cards,
          quizQuestions: res.quizQuestions,
        },
      };
      onUpdateItem(updated);
      confetti({ particleCount: 60, spread: 50 });
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const handleSaveEdits = () => {
    const updatedTags = tagsInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    const updated: LifeboxItem = {
      ...item,
      title: title.trim(),
      content: content.trim(),
      tags: updatedTags,
      summary,
      keyPoints,
      updatedAt: new Date().toISOString(),
    };
    onUpdateItem(updated);
    setIsEditing(false);
  };

  const handleAnswerQuiz = (optionIdx: number) => {
    if (selectedOption !== null) return;
    setSelectedOption(optionIdx);
    const q = quizQuestions[activeQuizQuestionIdx];
    if (q && optionIdx === q.answerIndex) {
      setQuizScore((prev) => prev + 1);
      confetti({ particleCount: 30, spread: 45 });
    }
  };

  const handleNextQuiz = () => {
    setSelectedOption(null);
    if (activeQuizQuestionIdx < quizQuestions.length - 1) {
      setActiveQuizQuestionIdx((prev) => prev + 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Header Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/80 gap-3">
          <div className="flex items-center gap-2 flex-wrap truncate">
            <span className="text-xs font-bold uppercase tracking-wide px-2.5 py-0.5 rounded-lg bg-indigo-100 text-indigo-800">
              {item.type}
            </span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-lg bg-slate-200/70 text-slate-700 capitalize">
              {item.category}
            </span>
            {item.locked && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Locked
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => {
                onUpdateItem({ ...item, pinned: !item.pinned });
              }}
              className={`p-2 rounded-xl border transition-colors ${
                item.pinned ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-200 text-slate-400 hover:text-slate-700'
              }`}
              title="Pin Item"
            >
              <Pin className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                onUpdateItem({ ...item, favorite: !item.favorite });
              }}
              className={`p-2 rounded-xl border transition-colors ${
                item.favorite ? 'bg-rose-50 border-rose-200 text-rose-500 fill-rose-500' : 'bg-white border-slate-200 text-slate-400 hover:text-rose-500'
              }`}
              title="Favorite"
            >
              <Heart className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                onUpdateItem({ ...item, locked: !item.locked });
              }}
              className={`p-2 rounded-xl border transition-colors ${
                item.locked ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-slate-200 text-slate-400'
              }`}
              title={item.locked ? 'Unlock item' : 'Lock item with PIN'}
            >
              {item.locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            </button>

            <button
              onClick={() => {
                onDuplicateItem(item.id);
                onClose();
              }}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
              title="Duplicate"
            >
              <Copy className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                onDeleteItem(item.id);
                onClose();
              }}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-rose-600 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200/60 transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-slate-800">
          {/* Locked notice */}
          {isLocked ? (
            <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-3">
              <Lock className="w-8 h-8 text-amber-500 mx-auto" />
              <h3 className="text-base font-bold text-slate-900">This item is protected by PIN</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Confidential and private records require your PIN code to inspect.
              </p>
              <button
                onClick={onRequirePin}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-xs hover:bg-indigo-700"
              >
                Enter PIN to Unlock
              </button>
            </div>
          ) : (
            <>
              {/* Title & Edit toggle */}
              <div className="flex items-start justify-between gap-3">
                {isEditing ? (
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="flex-1 text-lg sm:text-xl font-bold px-3 py-1.5 rounded-xl border border-indigo-400 focus:outline-none"
                  />
                ) : (
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 leading-snug">
                    {item.title}
                  </h1>
                )}

                <button
                  onClick={() => {
                    if (isEditing) handleSaveEdits();
                    else setIsEditing(true);
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors bg-slate-100 hover:bg-slate-200 text-slate-700"
                >
                  {isEditing ? 'Save Changes' : 'Edit Item'}
                </button>
              </div>

              {/* Media Image / Scan display */}
              {item.mediaUrl && (
                <div className="rounded-2xl overflow-hidden bg-slate-900 max-h-96 border border-slate-200 flex items-center justify-center relative">
                  <img
                    src={item.mediaUrl}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="max-h-96 w-full object-contain"
                  />
                </div>
              )}

              {/* Audio Player if Voice Memo */}
              {item.type === 'voice' && item.mediaUrl && (
                <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200/80 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-purple-900">
                    <Volume2 className="w-4 h-4 text-purple-600" />
                    <span>Voice Memo Playback</span>
                  </div>
                  <audio controls src={item.mediaUrl} className="w-full" />
                </div>
              )}

              {/* Contact Card if Contact */}
              {item.contactInfo && (
                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-1.5 text-xs sm:text-sm text-amber-950">
                  <h3 className="font-bold text-sm text-amber-900">📇 Contact Information</h3>
                  {item.contactInfo.name && <p><strong>Name:</strong> {item.contactInfo.name}</p>}
                  {item.contactInfo.phone && (
                    <p>
                      <strong>Phone:</strong>{' '}
                      <a href={`tel:${item.contactInfo.phone}`} className="text-indigo-600 underline">
                        {item.contactInfo.phone}
                      </a>
                    </p>
                  )}
                  {item.contactInfo.email && (
                    <p>
                      <strong>Email:</strong>{' '}
                      <a href={`mailto:${item.contactInfo.email}`} className="text-indigo-600 underline">
                        {item.contactInfo.email}
                      </a>
                    </p>
                  )}
                  {item.contactInfo.company && <p><strong>Company:</strong> {item.contactInfo.company}</p>}
                </div>
              )}

              {/* Location Card if Location */}
              {item.locationInfo && (
                <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 text-xs sm:text-sm text-indigo-950 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-indigo-900">📍 Saved Location</h3>
                    <p className="mt-0.5">{item.locationInfo.address || 'Saved GPS spot'}</p>
                  </div>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      item.locationInfo.address || ''
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700"
                  >
                    Open Map
                  </a>
                </div>
              )}

              {/* Link preview if Link */}
              {item.linkInfo && (
                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 text-xs sm:text-sm text-emerald-950 flex items-center justify-between gap-3">
                  <div className="truncate">
                    <h3 className="font-bold text-sm text-emerald-900">🔗 Web Bookmark</h3>
                    <p className="mt-0.5 truncate font-mono text-xs">{item.linkInfo.url}</p>
                  </div>
                  <a
                    href={item.linkInfo.url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 shrink-0"
                  >
                    Visit Link
                  </a>
                </div>
              )}

              {/* AI Intelligence Actions Toolbar */}
              <div className="flex items-center gap-2 flex-wrap p-3 rounded-2xl bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100">
                <button
                  onClick={handleAiSummarize}
                  disabled={isSummarizing}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white font-bold text-xs transition-all shadow-2xs active:scale-95"
                >
                  {isSummarizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>{summary ? 'Re-Summarize with AI' : 'AI Executive Summary'}</span>
                </button>

                <button
                  onClick={handleGenerateStudentQuiz}
                  disabled={isGeneratingQuiz}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-xs transition-all shadow-2xs active:scale-95"
                >
                  {isGeneratingQuiz ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <GraduationCap className="w-3.5 h-3.5" />
                  )}
                  <span>{flashcards.length > 0 ? 'Regenerate Flashcards & Quiz' : 'Create Flashcards & Quiz'}</span>
                </button>

                <button
                  onClick={() => handleCopy(item.content || item.extractedText || '')}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-200"
                >
                  {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedText ? 'Copied to Clipboard' : 'Copy Text'}</span>
                </button>
              </div>

              {/* AI Summary Card */}
              {summary && (
                <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    <span>AI Executive Summary & Key Takeaways</span>
                  </div>
                  <p className="text-xs sm:text-sm text-purple-950 leading-relaxed">{summary}</p>
                  {keyPoints && keyPoints.length > 0 && (
                    <ul className="list-disc pl-5 text-xs text-purple-900 space-y-1 pt-1">
                      {keyPoints.map((kp, idx) => (
                        <li key={idx}>{kp}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Main Notes Content */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Content & Notes
                </h3>
                {isEditing ? (
                  <textarea
                    rows={6}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full p-3 rounded-xl border border-indigo-300 font-sans text-xs sm:text-sm text-slate-900 focus:outline-none"
                  />
                ) : (
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-line">
                    {item.content || 'No text note.'}
                  </div>
                )}
              </div>

              {/* OCR Text if available */}
              {item.extractedText && (
                <div className="p-4 rounded-2xl bg-amber-50/40 border border-amber-200/80 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-amber-600" />
                      OCR Extracted Document Text
                    </span>
                    <button
                      onClick={() => handleCopy(item.extractedText || '')}
                      className="text-[11px] text-amber-800 underline hover:text-amber-950"
                    >
                      Copy OCR text
                    </button>
                  </div>
                  <pre className="text-xs font-mono text-amber-950 whitespace-pre-wrap bg-white/70 p-3 rounded-xl border border-amber-100">
                    {item.extractedText}
                  </pre>
                </div>
              )}

              {/* Student Flashcards & Interactive Quiz if generated */}
              {flashcards.length > 0 && (
                <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                      <GraduationCap className="w-4 h-4 text-blue-600" />
                      Student Mode: Flashcards ({flashcards.length})
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {flashcards.map((fc, i) => (
                      <div
                        key={fc.id || i}
                        className="p-3 rounded-xl bg-white border border-blue-200 text-xs shadow-2xs space-y-1.5"
                      >
                        <p className="font-bold text-blue-950">Q: {fc.question}</p>
                        <p className="text-slate-600 border-t border-slate-100 pt-1.5">
                          <strong>A:</strong> {fc.answer}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Interactive Quick Quiz */}
                  {quizQuestions.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-blue-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-blue-950">
                          Interactive Quiz (Question {activeQuizQuestionIdx + 1} of {quizQuestions.length})
                        </span>
                        <span className="text-xs font-bold text-emerald-700">
                          Score: {quizScore} / {quizQuestions.length}
                        </span>
                      </div>

                      <div className="p-3.5 rounded-xl bg-white border border-blue-200 text-xs space-y-2.5">
                        <p className="font-bold text-slate-900">
                          {quizQuestions[activeQuizQuestionIdx]?.q}
                        </p>

                        <div className="space-y-1.5">
                          {quizQuestions[activeQuizQuestionIdx]?.options.map((opt, optIdx) => {
                            const isCorrect = optIdx === quizQuestions[activeQuizQuestionIdx].answerIndex;
                            const isSelected = selectedOption === optIdx;
                            let btnStyle = 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800';

                            if (selectedOption !== null) {
                              if (isCorrect) {
                                btnStyle = 'bg-emerald-100 border-emerald-300 text-emerald-900 font-bold';
                              } else if (isSelected) {
                                btnStyle = 'bg-rose-100 border-rose-300 text-rose-900';
                              }
                            }

                            return (
                              <button
                                key={optIdx}
                                onClick={() => handleAnswerQuiz(optIdx)}
                                className={`w-full text-left p-2.5 rounded-xl border text-xs transition-colors ${btnStyle}`}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>

                        {selectedOption !== null && (
                          <div className="pt-2 flex items-center justify-between">
                            <p className="text-[11px] text-slate-500 italic">
                              {quizQuestions[activeQuizQuestionIdx]?.explanation}
                            </p>
                            {activeQuizQuestionIdx < quizQuestions.length - 1 && (
                              <button
                                onClick={handleNextQuiz}
                                className="px-3 py-1 rounded-lg bg-blue-600 text-white font-bold text-xs"
                              >
                                Next Question
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tags & Metadata */}
              <div className="pt-3 border-t border-slate-200 text-xs space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-slate-400 font-medium">Tags:</span>
                  {isEditing ? (
                    <input
                      type="text"
                      value={tagsInput}
                      onChange={(e) => setTagsInput(e.target.value)}
                      className="flex-1 px-2.5 py-1 rounded-lg border border-slate-200 text-xs"
                    />
                  ) : (
                    tags.map((t, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium text-xs"
                      >
                        #{t}
                      </span>
                    ))
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span>Saved on {new Date(item.createdAt).toLocaleString()}</span>
                  <span>ID: {item.id}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
