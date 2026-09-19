import React, { useState } from 'react';
import {
  GraduationCap,
  Sparkles,
  BookOpen,
  Calendar,
  CheckCircle2,
  Brain,
  RotateCcw,
  ArrowRight,
  HelpCircle,
  Loader2,
  Plus,
} from 'lucide-react';
import { LifeboxItem, Flashcard, QuizQuestion } from '../types';
import { AiService } from '../services/ai';
import confetti from 'canvas-confetti';

interface StudentHubProps {
  items: LifeboxItem[];
  onSelectItem: (item: LifeboxItem) => void;
  onUpdateItem: (item: LifeboxItem) => void;
  onOpenQuickAdd: () => void;
}

export const StudentHub: React.FC<StudentHubProps> = ({
  items,
  onSelectItem,
  onUpdateItem,
  onOpenQuickAdd,
}) => {
  // Find study items
  const studyItems = items.filter(
    (i) => !i.isTrash && (i.category === 'study' || i.studentMeta || i.tags.includes('exam'))
  );

  // Active study deck
  const [selectedItemId, setSelectedItemId] = useState<string>(
    studyItems[0]?.id || ''
  );
  const activeItem = studyItems.find((i) => i.id === selectedItemId) || studyItems[0];

  // Flashcards state
  const flashcards = activeItem?.studentMeta?.flashcards || [];
  const [currentCardIdx, setCurrentCardIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Homework explainer
  const [explainTopic, setExplainTopic] = useState('');
  const [explaining, setExplaining] = useState(false);
  const [explanationResult, setExplanationResult] = useState('');

  // AI flashcard generation for current active item
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateDeck = async () => {
    if (!activeItem) return;
    setIsGenerating(true);
    try {
      const res = await AiService.generateQuiz(
        activeItem.title,
        activeItem.content || activeItem.extractedText || ''
      );
      const cards: Flashcard[] = res.flashcards.map((f, i) => ({
        id: 'fc-' + Date.now() + '-' + i,
        question: f.question,
        answer: f.answer,
      }));

      const updated: LifeboxItem = {
        ...activeItem,
        studentMeta: {
          subject: 'Biology / Academics',
          flashcards: cards,
          quizQuestions: res.quizQuestions,
        },
      };
      onUpdateItem(updated);
      confetti({ particleCount: 70, spread: 60 });
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExplainHomework = async () => {
    if (!explainTopic.trim()) return;
    setExplaining(true);
    try {
      const response = await AiService.askMyStuff(
        `Explain this academic topic simply as a tutor: ${explainTopic}. If any saved study materials relate to it, reference them.`,
        studyItems
      );
      setExplanationResult(response.answer);
    } catch (err) {
      setExplanationResult('Could not explain this topic right now.');
    } finally {
      setExplaining(false);
    }
  };

  const handleNextCard = () => {
    setIsFlipped(false);
    if (currentCardIdx < flashcards.length - 1) {
      setCurrentCardIdx((prev) => prev + 1);
    } else {
      setCurrentCardIdx(0);
    }
  };

  const handlePrevCard = () => {
    setIsFlipped(false);
    if (currentCardIdx > 0) {
      setCurrentCardIdx((prev) => prev - 1);
    } else {
      setCurrentCardIdx(flashcards.length - 1);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-neutral-900 flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-black" />
            <span>LIFEBOX for Students</span>
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Study guides, AI flashcard trainer, exam deadlines & homework explainer
          </p>
        </div>

        <button
          onClick={onOpenQuickAdd}
          className="self-start sm:self-auto flex items-center gap-1.5 px-4 py-2 rounded-xl bg-black hover:bg-neutral-800 text-white font-semibold text-xs sm:text-sm shadow-xs transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Save Lecture or Syllabus</span>
        </button>
      </div>

      {/* Main Grid: Deck selector + Interactive Flashcards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Study Subjects & Topics */}
        <div className="bg-white rounded-3xl border border-neutral-200 p-5 shadow-2xs space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
            Study Subjects & Notes ({studyItems.length})
          </h2>

          <div className="space-y-2">
            {studyItems.map((item) => {
              const isSelected = item.id === (activeItem?.id || '');
              const cardCount = item.studentMeta?.flashcards?.length || 0;

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setSelectedItemId(item.id);
                    setCurrentCardIdx(0);
                    setIsFlipped(false);
                  }}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-neutral-100 border-black ring-1 ring-neutral-900'
                      : 'hover:bg-neutral-50 border-neutral-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-neutral-900 truncate mr-2">
                      {item.title}
                    </h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-800 shrink-0">
                      {cardCount} cards
                    </span>
                  </div>

                  <p className="text-[11px] text-neutral-500 line-clamp-1 mt-1">
                    {item.content || item.extractedText}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Center/Right: Interactive Flashcards Trainer */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-neutral-200 p-6 shadow-2xs space-y-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-black" />
                <h3 className="font-bold text-neutral-900 text-sm">
                  Active Study Deck: {activeItem?.title || 'No study note selected'}
                </h3>
              </div>

              {activeItem && (
                <button
                  onClick={handleGenerateDeck}
                  disabled={isGenerating}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-black font-bold text-xs border border-neutral-300 transition-colors"
                >
                  {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-black" />}
                  <span>{flashcards.length > 0 ? 'Regenerate Deck' : 'Generate AI Flashcards'}</span>
                </button>
              )}
            </div>

            {/* Flashcard View */}
            {flashcards.length === 0 ? (
              <div className="py-16 text-center text-neutral-400 space-y-3">
                <BookOpen className="w-12 h-12 mx-auto text-neutral-300" />
                <p className="text-xs font-medium">No flashcards yet for this topic.</p>
                <button
                  onClick={handleGenerateDeck}
                  disabled={isGenerating}
                  className="px-4 py-2 rounded-xl bg-black text-white font-bold text-xs shadow-xs hover:bg-neutral-800"
                >
                  Generate AI Flashcards from Notes
                </button>
              </div>
            ) : (
              <div className="py-4 space-y-4">
                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <span>
                    Card {currentCardIdx + 1} of {flashcards.length}
                  </span>
                  <span>Click card to reveal answer</span>
                </div>

                {/* 3D Flashcard Flip box */}
                <div
                  onClick={() => setIsFlipped(!isFlipped)}
                  className="min-h-[220px] rounded-3xl p-8 cursor-pointer flex flex-col justify-center items-center text-center transition-all duration-300 select-none shadow-sm border bg-neutral-50 border-neutral-300 hover:border-black"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-2">
                    {isFlipped ? 'Answer' : 'Question'} (Tap to flip)
                  </span>
                  <p className="text-base sm:text-lg font-bold text-neutral-900 max-w-md leading-relaxed">
                    {isFlipped
                      ? flashcards[currentCardIdx]?.answer
                      : flashcards[currentCardIdx]?.question}
                  </p>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={handlePrevCard}
                    className="px-4 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold text-xs"
                  >
                    Previous
                  </button>

                  <button
                    onClick={() => setIsFlipped(!isFlipped)}
                    className="flex items-center gap-1 px-4 py-2 rounded-xl bg-neutral-100 text-black hover:bg-neutral-200 font-bold text-xs border border-neutral-300"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Flip Card</span>
                  </button>

                  <button
                    onClick={handleNextCard}
                    className="px-4 py-2 rounded-xl bg-black hover:bg-neutral-800 text-white font-bold text-xs shadow-xs"
                  >
                    Next Card
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Homework Explainer & Concept Tutor */}
      <div className="bg-white rounded-3xl border border-neutral-200 p-6 shadow-2xs space-y-4">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-black" />
          <div>
            <h3 className="font-bold text-neutral-900 text-sm">AI Homework & Concept Explainer</h3>
            <p className="text-xs text-neutral-500">
              Ask LIFEBOX to explain difficult concepts grounded in your saved lectures and syllabus.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={explainTopic}
            onChange={(e) => setExplainTopic(e.target.value)}
            placeholder="e.g. Explain light-dependent vs Calvin cycle in photosynthesis..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-black"
          />
          <button
            onClick={handleExplainHomework}
            disabled={explaining || !explainTopic.trim()}
            className="px-5 py-2.5 rounded-xl bg-black hover:bg-neutral-800 disabled:opacity-50 text-white font-bold text-xs sm:text-sm shadow-xs flex items-center justify-center gap-1.5 shrink-0"
          >
            {explaining ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-white" />}
            <span>Explain Topic</span>
          </button>
        </div>

        {explanationResult && (
          <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 text-xs sm:text-sm text-neutral-900 leading-relaxed space-y-2">
            <h4 className="font-bold text-neutral-950">Tutor Explanation:</h4>
            <p className="whitespace-pre-line">{explanationResult}</p>
          </div>
        )}
      </div>
    </div>
  );
};
