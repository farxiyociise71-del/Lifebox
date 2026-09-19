import React, { useState } from 'react';
import {
  Sparkles,
  X,
  Send,
  Loader2,
  FileText,
  ExternalLink,
  ArrowRight,
  Brain,
  MessageSquare,
} from 'lucide-react';
import { LifeboxItem } from '../types';
import { AiService, AskStuffResponse } from '../services/ai';

interface AskStuffDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: LifeboxItem[];
  onSelectItem: (item: LifeboxItem) => void;
  initialQuery?: string;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  matchedItems?: LifeboxItem[];
  suggestedQueries?: string[];
  timestamp: string;
}

export const AskStuffDrawer: React.FC<AskStuffDrawerProps> = ({
  isOpen,
  onClose,
  items,
  onSelectItem,
  initialQuery = '',
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);

  const availableItems = items.filter((i) => !i.isTrash && !i.locked);

  const initialWelcomeText =
    availableItems.length === 0
      ? "Hi! I'm your LIFEBOX assistant. You haven't saved any records yet.\n\nOnce you add notes, documents, photos, or voice memos, you can ask me to search, summarize, or extract details from them anytime. You can also ask me general questions or calculations right now."
      : "Hi! I'm your LIFEBOX assistant. What would you like to find or check in your saved records?";

  const initialSuggestions =
    availableItems.length === 0
      ? ['How do I save a note?', 'What is 25 × 8?', 'Can you explain photosynthesis?', 'Hi']
      : [
          `Search in ${availableItems[0]?.category || 'notes'}`,
          ...availableItems.slice(0, 2).map((item) => `What did I save about ${item.title.split(' ')[0]}?`),
          'Summarize my recent notes',
        ];

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: initialWelcomeText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      suggestedQueries: initialSuggestions,
    },
  ]);

  if (!isOpen) return null;

  const handleSubmit = async (textToSubmit?: string) => {
    const q = (textToSubmit || query).trim();
    if (!q || loading) return;

    const userMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      sender: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setQuery('');
    setLoading(true);

    try {
      const response: AskStuffResponse = await AiService.askMyStuff(q, items);
      const matchedRecords = items.filter((it) => response.matchedItemIds?.includes(it.id));

      const aiMsg: ChatMessage = {
        id: 'ai-' + Date.now(),
        sender: 'ai',
        text: response.answer,
        matchedItems: matchedRecords,
        suggestedQueries: response.suggestedQueries,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: 'err-' + Date.now(),
        sender: 'ai',
        text: 'Sorry, I had trouble searching your second brain just now. Please try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white w-full max-w-lg h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-200/80 flex items-center justify-between bg-gradient-to-r from-purple-50 to-indigo-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Ask My Stuff</h3>
              <p className="text-[11px] text-purple-700 font-medium">Grounded in your saved LIFEBOX records</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-white/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed shadow-2xs ${
                  msg.sender === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-xs font-medium'
                    : 'bg-slate-100/90 text-slate-800 rounded-bl-xs border border-slate-200/70 whitespace-pre-line'
                }`}
              >
                {msg.text}
              </div>

              {/* Matched Citations */}
              {msg.matchedItems && msg.matchedItems.length > 0 && (
                <div className="mt-2.5 w-full max-w-[88%] space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 flex items-center gap-1">
                    <span>Source:</span>
                    <span className="text-slate-500 font-normal">
                      {msg.matchedItems.length === 1 ? '1 verified saved record' : `${msg.matchedItems.length} verified saved records`}
                    </span>
                  </span>
                  {msg.matchedItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        onSelectItem(item);
                        onClose();
                      }}
                      className="p-2.5 rounded-xl bg-white border border-purple-200/80 hover:border-purple-400 hover:bg-purple-50/50 transition-all cursor-pointer flex items-center justify-between gap-2 shadow-2xs group"
                    >
                      <div className="truncate">
                        <p className="font-bold text-xs text-purple-950 truncate group-hover:text-purple-700 flex items-center gap-1.5">
                          <span>📄</span>
                          <span>{item.title}</span>
                        </p>
                        <p className="text-[11px] text-slate-500 capitalize">
                          {item.type} • {item.category}
                        </p>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-purple-400 group-hover:text-purple-700 shrink-0" />
                    </div>
                  ))}
                </div>
              )}

              {/* Suggested Followups */}
              {msg.suggestedQueries && msg.suggestedQueries.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5 max-w-[88%]">
                  {msg.suggestedQueries.map((sug, i) => (
                    <button
                      key={i}
                      onClick={() => handleSubmit(sug)}
                      className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-slate-100 hover:bg-purple-100 text-slate-600 hover:text-purple-800 transition-colors border border-slate-200/60"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              )}

              <span className="text-[10px] text-slate-400 mt-1 px-1">{msg.timestamp}</span>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 p-3 rounded-2xl border border-slate-200/60 w-fit">
              <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
              <span>Scanning your second brain...</span>
            </div>
          )}
        </div>

        {/* Drawer Input */}
        <div className="p-3 border-t border-slate-200 bg-white">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                availableItems.length === 0
                  ? "Ask anything, e.g. 'What is 25 * 8' or general knowledge..."
                  : "Search your saved notes, ideas, or questions..."
              }
              className="flex-1 text-xs sm:text-sm px-3.5 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
            />
            <button
              type="submit"
              disabled={!query.trim() || loading}
              className="p-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold transition-all shadow-2xs"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
