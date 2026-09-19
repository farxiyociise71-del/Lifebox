import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  X,
  Sparkles,
  History,
  FileText,
  Image as ImageIcon,
  FileCheck,
  Link2,
  Mic,
  Calendar,
  Tag,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { LifeboxItem, ItemType, ItemCategory } from '../types';

interface OmniSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: LifeboxItem[];
  onSelectItem: (item: LifeboxItem) => void;
  onSwitchToAskStuff: (query: string) => void;
}

const SEARCH_SUGGESTIONS = [
  'Show me everything about my science exam',
  'Find the picture where I saved my exam timetable',
  'Passport expiration date',
  'Meeting notes with Ahmed',
  'Explain photosynthesis notes',
  'Dr. Sarah Mitchell contact',
];

export const OmniSearchModal: React.FC<OmniSearchModalProps> = ({
  isOpen,
  onClose,
  items,
  onSelectItem,
  onSwitchToAskStuff,
}) => {
  const [query, setQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchHistory, setSearchHistory] = useState<string[]>([
    'science exam',
    'Ahmed',
    'photosynthesis',
  ]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        // toggle search
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    const qLower = query.toLowerCase().trim();
    const words = qLower.split(' ').filter((w) => w.length > 1);

    return items
      .filter((item) => {
        if (item.isTrash) return false;
        if (selectedType !== 'all' && item.type !== selectedType) return false;
        if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;

        const fullCorpus = [
          item.title,
          item.content,
          item.extractedText || '',
          item.summary || '',
          item.tags.join(' '),
          item.contactInfo?.name || '',
          item.locationInfo?.address || '',
          item.linkInfo?.url || '',
          item.reminder?.dueDate || '',
        ]
          .join(' ')
          .toLowerCase();

        // Exact substring match
        if (fullCorpus.includes(qLower)) return true;

        // Word overlap match (super search)
        return words.some((word) => fullCorpus.includes(word));
      })
      .slice(0, 12);
  }, [query, items, selectedType, selectedCategory]);

  if (!isOpen) return null;

  const handleSelectSuggestion = (text: string) => {
    setQuery(text);
    if (!searchHistory.includes(text)) {
      setSearchHistory((prev) => [text, ...prev.slice(0, 4)]);
    }
  };

  const handleItemClick = (item: LifeboxItem) => {
    if (query.trim() && !searchHistory.includes(query.trim())) {
      setSearchHistory((prev) => [query.trim(), ...prev.slice(0, 4)]);
    }
    onSelectItem(item);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-6 pt-16 sm:pt-20">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Search Header */}
        <div className="p-4 border-b border-slate-200/80 flex items-center gap-3">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by word, sentence, person, date, image OCR..."
            className="flex-1 text-sm sm:text-base font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-2 py-1 rounded-lg bg-slate-100"
          >
            ESC
          </button>
        </div>

        {/* Filter bar */}
        <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200/60 flex items-center justify-between gap-2 overflow-x-auto text-xs">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-slate-400 font-medium mr-1">Type:</span>
            {['all', 'note', 'photo', 'document', 'voice', 'link'].map((t) => (
              <button
                key={t}
                onClick={() => setSelectedType(t)}
                className={`px-2 py-1 rounded-lg capitalize transition-colors ${
                  selectedType === t
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Ask AI shortcut button */}
          {query && (
            <button
              onClick={() => {
                onSwitchToAskStuff(query);
                onClose();
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-100 text-purple-800 font-bold hover:bg-purple-200 transition-colors shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>Ask AI Brain</span>
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* If no query: show suggestions and history */}
          {!query.trim() ? (
            <div className="space-y-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Super Search Suggestions</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SEARCH_SUGGESTIONS.map((sug, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectSuggestion(sug)}
                      className="text-left p-2.5 rounded-xl bg-slate-50 hover:bg-indigo-50 text-xs font-medium text-slate-700 hover:text-indigo-900 border border-slate-200/60 hover:border-indigo-200 transition-colors"
                    >
                      "{sug}"
                    </button>
                  ))}
                </div>
              </div>

              {searchHistory.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" />
                    <span>Recent Searches</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {searchHistory.map((hist, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSelectSuggestion(hist)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs text-slate-600 font-medium"
                      >
                        {hist}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Search Results */
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 px-1 mb-1">
                <span>{searchResults.length} matches found</span>
                <span>Press Return or Click to Open</span>
              </div>

              {searchResults.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm font-bold text-slate-700 mb-1">No matching items</p>
                  <p className="text-xs text-slate-500 mb-3">
                    Didn't find any direct match for "{query}".
                  </p>
                  <button
                    onClick={() => {
                      onSwitchToAskStuff(query);
                      onClose();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 text-purple-700 font-bold text-xs border border-purple-200 hover:bg-purple-100"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Ask AI Second Brain to search by meaning</span>
                  </button>
                </div>
              ) : (
                searchResults.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className="p-3 rounded-xl hover:bg-slate-50 border border-slate-100 hover:border-slate-200 transition-all cursor-pointer flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-start gap-3 truncate">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                        {item.type.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="truncate">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                          {item.title}
                        </h4>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {item.summary || item.extractedText || item.content}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[10px] uppercase font-bold text-slate-400">
                            {item.category}
                          </span>
                          {item.tags.slice(0, 2).map((t, i) => (
                            <span
                              key={i}
                              className="text-[10px] text-slate-400 bg-slate-100 px-1 py-0.2 rounded"
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all shrink-0" />
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
