import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Sparkles,
  Send,
  Loader2,
  CheckCircle2,
  Brain,
  MessageSquare,
  Calendar,
  FileText,
  FolderPlus,
  Tag,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Clock,
  ExternalLink,
  Smile,
  Plus,
  Search,
  Trash2,
  Edit3,
  Check,
  X,
  PanelLeft,
  PanelLeftClose,
  Lightbulb,
  Zap,
  CheckSquare,
  Mic,
  Square,
  Volume2,
  VolumeX,
  Vibrate,
  Radio,
  Camera,
} from 'lucide-react';
import {
  LifeboxItem,
  Collection,
  AgentAction,
  AgentMessage,
  AiMode,
  StoredConversation,
} from '../types';
import { AiService } from '../services/ai';
import { SoundEngine } from '../utils/soundAndVibration';

interface AiAgentViewProps {
  items: LifeboxItem[];
  collections: Collection[];
  onAddItem: (item: LifeboxItem) => void;
  onUpdateItem: (item: LifeboxItem) => void;
  onAddCollection: (col: Collection) => void;
  onSelectItem: (item: LifeboxItem) => void;
  onOpenScanner?: () => void;
}

export const AiAgentView: React.FC<AiAgentViewProps> = ({
  items,
  collections,
  onAddItem,
  onUpdateItem,
  onAddCollection,
  onSelectItem,
  onOpenScanner,
}) => {
  // Mode: 'chat' (General Conversation) vs 'lifebox' (Search personal repository)
  const [mode, setMode] = useState<AiMode>('chat');

  // Input & state
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [executedActionIds, setExecutedActionIds] = useState<Set<string>>(new Set());
  const [expandedThoughts, setExpandedThoughts] = useState<Record<string, boolean>>({});

  // Conversations history sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [conversations, setConversations] = useState<StoredConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [conversationSearch, setConversationSearch] = useState('');
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editTitleInput, setEditTitleInput] = useState('');

  // Active messages feed
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Voice to text & Sound / Vibration state
  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const [voiceInterim, setVoiceInterim] = useState('');
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(SoundEngine.isSoundEnabled());
  const [vibrationEnabled, setVibrationEnabled] = useState(SoundEngine.isVibrationEnabled());
  const speechRecognizerRef = useRef<any>(null);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    SoundEngine.setSoundEnabled(next);
    if (next) SoundEngine.playCommandSuccess();
  };

  const toggleVibration = () => {
    const next = !vibrationEnabled;
    setVibrationEnabled(next);
    SoundEngine.setVibrationEnabled(next);
    if (next) SoundEngine.vibrate([50, 40, 50]);
  };

  const handleTestVibration = () => {
    SoundEngine.vibrate([60, 50, 60, 50, 100]);
    SoundEngine.playCommandSuccess();
  };

  const toggleVoiceToText = () => {
    if (isListeningVoice) {
      if (speechRecognizerRef.current) {
        try {
          speechRecognizerRef.current.stop();
        } catch {}
      }
      setIsListeningVoice(false);
      setVoiceInterim('');
      SoundEngine.playMicStop();
      return;
    }

    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      const simulated = prompt(
        'Speech Recognition not available in this browser. Enter voice text to dictate:'
      );
      if (simulated) {
        setInput((prev) => (prev ? prev + ' ' + simulated.trim() : simulated.trim()));
        SoundEngine.playCommandSuccess();
      }
      return;
    }

    try {
      const recognizer = new SpeechRecognitionClass();
      recognizer.continuous = true;
      recognizer.interimResults = true;
      recognizer.lang = 'en-US';

      recognizer.onstart = () => {
        setIsListeningVoice(true);
        setVoiceInterim('');
        SoundEngine.playMicStart();
      };

      recognizer.onresult = (event: any) => {
        let interim = '';
        let finalTrans = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const chunk = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTrans += chunk;
          } else {
            interim += chunk;
          }
        }

        if (interim) {
          setVoiceInterim(interim);
          SoundEngine.vibrate(12);
        }

        if (finalTrans) {
          setInput((prev) => (prev ? prev + ' ' + finalTrans.trim() : finalTrans.trim()));
          setVoiceInterim('');
          SoundEngine.vibrate([25, 25]);
        }
      };

      recognizer.onerror = (event: any) => {
        console.warn('Speech error:', event.error);
        setIsListeningVoice(false);
        setVoiceInterim('');
        if (event.error !== 'no-speech') {
          SoundEngine.playMicStop();
        }
      };

      recognizer.onend = () => {
        setIsListeningVoice(false);
        setVoiceInterim('');
      };

      speechRecognizerRef.current = recognizer;
      recognizer.start();
    } catch (e) {
      console.warn('Recognition start failed:', e);
      setIsListeningVoice(false);
    }
  };

  const handleToggleSpeakMessage = (msg: AgentMessage) => {
    if (speakingMessageId === msg.id) {
      SoundEngine.stopSpeaking();
      setSpeakingMessageId(null);
    } else {
      setSpeakingMessageId(msg.id);
      SoundEngine.speakText(msg.text, () => {
        setSpeakingMessageId(null);
      });
    }
  };

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const list = await AiService.getConversations();
      setConversations(list);
      if (list.length > 0 && !activeConversationId) {
        // Select the most recent conversation
        selectConversation(list[0]);
      } else if (list.length === 0) {
        startNewConversation('chat');
      }
    } catch (e) {
      console.warn('Could not load conversations:', e);
      startNewConversation('chat');
    }
  };

  const selectConversation = (conv: StoredConversation) => {
    setActiveConversationId(conv.id);
    setMode(conv.mode || 'chat');
    setMessages(conv.turns || []);
  };

  const startNewConversation = async (initialMode: AiMode = mode) => {
    const defaultTitle = initialMode === 'chat' ? 'New Chat' : 'New LIFEBOX Session';
    const newConv = await AiService.createConversation(defaultTitle, initialMode);
    setConversations((prev) => [newConv, ...prev.filter((c) => c.id !== newConv.id)]);
    setActiveConversationId(newConv.id);
    setMode(initialMode);
    setMessages([]);
  };

  const handleDeleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('Delete this conversation?')) return;
    await AiService.deleteConversation(id);
    const updated = conversations.filter((c) => c.id !== id);
    setConversations(updated);
    if (activeConversationId === id) {
      if (updated.length > 0) {
        selectConversation(updated[0]);
      } else {
        startNewConversation(mode);
      }
    }
  };

  const handleStartRename = (e: React.MouseEvent, conv: StoredConversation) => {
    e.stopPropagation();
    setEditingConvId(conv.id);
    setEditTitleInput(conv.title);
  };

  const handleSaveRename = async (e: React.MouseEvent | React.FormEvent, convId: string) => {
    e.stopPropagation();
    if (!editTitleInput.trim()) return;
    await AiService.updateConversation(convId, { title: editTitleInput.trim() });
    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, title: editTitleInput.trim() } : c))
    );
    setEditingConvId(null);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (messageText?: string) => {
    const textToSend = (messageText || input).trim();
    if (!textToSend || loading) return;

    SoundEngine.playSendSound();

    const userMessage: AgentMessage = {
      id: 'msg-u-' + Date.now(),
      sender: 'user',
      text: textToSend,
      aiMode: mode,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    const historyPayload = newMessages.slice(-8).map((m) => ({
      role: (m.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      text: m.text,
    }));

    try {
      const response = await AiService.sendConversationMessage({
        message: textToSend,
        mode,
        history: historyPayload,
        items,
        conversationId: activeConversationId || undefined,
      });

      SoundEngine.playReceiveSound();

      const agentMessageId = 'agent-' + Date.now();
      const agentMessage: AgentMessage = {
        id: agentMessageId,
        sender: 'agent',
        aiMode: mode,
        intent: response.intent,
        text: response.reply,
        thoughtSteps: response.thoughtSteps,
        actions: response.actions,
        matchedItemIds: response.matchedItemIds,
        sources: response.sources,
        suggestedFollowUps: response.suggestedFollowUps,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      const finalMessages = [...newMessages, agentMessage];
      setMessages(finalMessages);

      // Auto-update conversation title if it's the first turn
      if (activeConversationId) {
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id === activeConversationId) {
              const shouldRename = c.title === 'New Chat' || c.title === 'New LIFEBOX Session';
              return {
                ...c,
                title: shouldRename ? textToSend.slice(0, 36) : c.title,
                turns: finalMessages,
                updatedAt: new Date().toISOString(),
              };
            }
            return c;
          })
        );
      }

      // Auto-expand thought steps if available
      if (response.thoughtSteps && response.thoughtSteps.length > 0) {
        setExpandedThoughts((prev) => ({ ...prev, [agentMessageId]: true }));
      }
    } catch {
      const errorMessage: AgentMessage = {
        id: 'agent-err-' + Date.now(),
        sender: 'agent',
        aiMode: mode,
        text: 'I encountered an issue processing that message. Please try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const executeAction = (action: AgentAction) => {
    if (executedActionIds.has(action.id)) return;

    if (action.type === 'open_item' && action.payload.itemId) {
      const found = items.find((i) => i.id === action.payload.itemId);
      if (found) {
        onSelectItem(found);
      } else {
        const fallbackItem: LifeboxItem = {
          id: action.payload.itemId,
          title: action.payload.itemTitle || action.payload.title || 'Note',
          type: 'note',
          category: 'personal',
          collectionIds: [],
          content: action.payload.content || '',
          tags: [],
          pinned: false,
          favorite: false,
          locked: false,
          isTrash: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        onSelectItem(fallbackItem);
      }
    } else if (action.type === 'confirm_delete') {
      handleSend('yes');
    } else if (action.type === 'create_task') {
      const newTaskItem: LifeboxItem = {
        id: 'item-task-' + Date.now(),
        title: action.payload.title || 'New Task',
        type: 'task',
        category: 'work',
        collectionIds: [],
        content: action.payload.title || 'Task',
        tags: ['task', 'assistant-created'],
        pinned: false,
        favorite: false,
        locked: false,
        isTrash: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      onAddItem(newTaskItem);
    } else if (action.type === 'create_note') {
      const newItem: LifeboxItem = {
        id: 'item-agent-' + Date.now(),
        title: action.payload.title || 'Note',
        type: 'note',
        category: action.payload.category || 'ideas',
        collectionIds: [],
        content: action.payload.content || action.payload.title || '',
        tags: action.payload.tags || ['agent', 'assistant-created'],
        pinned: false,
        favorite: false,
        locked: false,
        isTrash: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      onAddItem(newItem);
    } else if (action.type === 'create_reminder') {
      const newReminderItem: LifeboxItem = {
        id: 'item-reminder-' + Date.now(),
        title: action.payload.title || 'Reminder',
        type: 'task',
        category: 'personal',
        collectionIds: [],
        content: `Reminder: ${action.payload.title}`,
        tags: ['reminder', 'assistant-created'],
        pinned: false,
        favorite: false,
        locked: false,
        isTrash: false,
        reminder: {
          dueDate: action.payload.dueDate || new Date().toISOString().split('T')[0],
          dueTime: action.payload.dueTime || '09:00 AM',
          completed: false,
          priority: action.payload.priority || 'medium',
          notes: action.payload.notes,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      onAddItem(newReminderItem);
    } else if (action.type === 'create_collection') {
      const newCol: Collection = {
        id: 'col-agent-' + Date.now(),
        name: action.payload.name || 'New Collection',
        description: action.payload.description || 'Created via AI Assistant',
        color: action.payload.color || 'neutral',
        createdAt: new Date().toISOString(),
      };
      onAddCollection(newCol);
    } else if (action.type === 'open_scanner') {
      if (onOpenScanner) {
        onOpenScanner();
      }
    }

    setExecutedActionIds((prev) => new Set([...prev, action.id]));
  };

  const toggleThoughts = (msgId: string) => {
    setExpandedThoughts((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  // Filter conversations
  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(conversationSearch.toLowerCase())
  );

  return (
    <div className="flex-1 flex h-[calc(100vh-65px)] bg-neutral-100 overflow-hidden">
      {/* Sidebar: Conversation History */}
      <div
        className={`${
          sidebarOpen ? 'w-72 lg:w-80' : 'w-0'
        } transition-all duration-300 ease-in-out bg-white border-r border-neutral-200 flex flex-col shrink-0 overflow-hidden z-20`}
      >
        <div className="p-3.5 border-b border-neutral-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-neutral-900" />
            <span className="text-xs font-bold text-neutral-900">Conversations</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-neutral-100 font-semibold text-neutral-600">
              {conversations.length}
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 lg:hidden"
            title="Close sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* New Conversation Actions */}
        <div className="p-3 border-b border-neutral-200 space-y-2">
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => startNewConversation('chat')}
              className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                mode === 'chat'
                  ? 'bg-neutral-900 border-black text-white shadow-2xs'
                  : 'bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ New Chat</span>
            </button>
            <button
              onClick={() => startNewConversation('lifebox')}
              className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                mode === 'lifebox'
                  ? 'bg-neutral-900 border-black text-white shadow-2xs'
                  : 'bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ LIFEBOX</span>
            </button>
          </div>

          {/* Search Conversations */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={conversationSearch}
              onChange={(e) => setConversationSearch(e.target.value)}
              placeholder="Search previous chats..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-black"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredConversations.length === 0 ? (
            <div className="text-center py-8 text-xs text-neutral-400">
              No conversations found
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isActive = activeConversationId === conv.id;
              const isEditing = editingConvId === conv.id;

              return (
                <div
                  key={conv.id}
                  onClick={() => selectConversation(conv)}
                  className={`group relative flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all ${
                    isActive
                      ? 'bg-neutral-900 text-white font-semibold'
                      : 'hover:bg-neutral-100 text-neutral-700 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                        isActive
                          ? 'bg-neutral-800 text-white'
                          : 'bg-neutral-100 text-neutral-800'
                      }`}
                    >
                      {conv.mode === 'lifebox' ? '🧠' : '💬'}
                    </div>

                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <div
                          className="flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            value={editTitleInput}
                            onChange={(e) => setEditTitleInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename(e, conv.id);
                              if (e.key === 'Escape') setEditingConvId(null);
                            }}
                            className="w-full text-xs px-1.5 py-0.5 border border-neutral-300 rounded-md bg-white text-black focus:outline-hidden"
                            autoFocus
                          />
                          <button
                            onClick={(e) => handleSaveRename(e, conv.id)}
                            className="p-1 hover:bg-neutral-200 rounded-md text-neutral-700"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => setEditingConvId(null)}
                            className="p-1 hover:bg-neutral-200 rounded-md text-neutral-700"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="text-xs truncate leading-snug">{conv.title}</div>
                          <div className={`flex items-center gap-2 text-[10px] mt-0.5 ${isActive ? 'text-neutral-400' : 'text-neutral-500'}`}>
                            <span
                              className={`px-1.5 py-0.2 rounded-sm font-semibold uppercase text-[9px] ${
                                isActive
                                  ? 'bg-neutral-800 text-neutral-200 border border-neutral-700'
                                  : 'bg-neutral-100 text-neutral-800 border border-neutral-200'
                              }`}
                            >
                              {conv.mode === 'lifebox' ? 'LIFEBOX' : 'Chat'}
                            </span>
                            <span>{conv.turns ? `${conv.turns.length} msgs` : ''}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {!isEditing && (
                    <div className="hidden group-hover:flex items-center gap-1 pl-2">
                      <button
                        onClick={(e) => handleStartRename(e, conv)}
                        className={`p-1 rounded-md ${isActive ? 'hover:bg-neutral-800 text-neutral-300' : 'hover:bg-neutral-200 text-neutral-500'}`}
                        title="Rename"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteConversation(e, conv.id)}
                        className={`p-1 rounded-md ${isActive ? 'hover:bg-neutral-800 text-neutral-300' : 'hover:bg-neutral-200 text-neutral-400 hover:text-red-600'}`}
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Conversation Canvas */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-neutral-100">
        {/* Top Header: Mode Switcher & Controls */}
        <div className="bg-white border-b border-neutral-200 px-4 lg:px-6 py-2.5 shrink-0">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-1.5 rounded-lg border border-neutral-200 text-neutral-700 hover:bg-neutral-100 transition-colors"
                title={sidebarOpen ? 'Collapse history' : 'Show history'}
              >
                <PanelLeft className="w-4 h-4" />
              </button>

              <div className="w-8 h-8 rounded-xl bg-black flex items-center justify-center text-white shadow-xs">
                <Bot className="w-4 h-4" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-sm font-bold text-neutral-900">
                    {mode === 'chat' ? 'Conversational AI' : 'LIFEBOX Second Brain'}
                  </h1>
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-neutral-800 bg-neutral-100 border border-neutral-300 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-neutral-900"></span>
                    Gemini 3.8 Flash Active
                  </span>
                </div>
                <p className="text-[11px] text-neutral-600">
                  {mode === 'chat'
                    ? 'General conversation & brainstorming. Personal notes are never searched automatically.'
                    : 'Personal second brain mode. Answers directly from your saved notes and repository.'}
                </p>
              </div>
            </div>

            {/* Sound, Vibration & Mode Switchers */}
            <div className="flex items-center flex-wrap gap-2 self-start sm:self-auto">
              <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl border border-neutral-200 text-xs">
                <button
                  type="button"
                  onClick={toggleSound}
                  className={`p-1.5 rounded-lg flex items-center gap-1 transition-colors ${
                    soundEnabled ? 'text-black bg-white shadow-2xs font-semibold' : 'text-neutral-500 hover:text-neutral-800'
                  }`}
                  title={soundEnabled ? 'Sound feedback ON (click to mute)' : 'Sound feedback MUTED (click to enable)'}
                >
                  {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                  <span className="hidden md:inline font-medium text-[11px]">{soundEnabled ? 'Sound ON' : 'Muted'}</span>
                </button>

                <button
                  type="button"
                  onClick={toggleVibration}
                  className={`p-1.5 rounded-lg flex items-center gap-1 transition-colors ${
                    vibrationEnabled ? 'text-black bg-white shadow-2xs font-semibold' : 'text-neutral-500 hover:text-neutral-800'
                  }`}
                  title={vibrationEnabled ? 'Vibration & Haptics ON (click to disable)' : 'Vibration & Haptics OFF (click to enable)'}
                >
                  <Vibrate className="w-3.5 h-3.5" />
                  <span className="hidden md:inline font-medium text-[11px]">{vibrationEnabled ? 'Haptics ON' : 'Off'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleTestVibration}
                  className="px-2 py-1 text-[10px] font-semibold text-neutral-600 hover:text-black hover:bg-neutral-200/60 rounded-md transition-colors"
                  title="Test sound & vibration pulse"
                >
                  Test
                </button>
              </div>

              {/* Prominent Mode Switcher */}
              <div className="flex items-center gap-1 p-1 bg-neutral-100 rounded-xl border border-neutral-200">
                <button
                  onClick={() => setMode('chat')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    mode === 'chat'
                      ? 'bg-black text-white shadow-2xs font-bold'
                      : 'text-neutral-700 hover:text-black'
                  }`}
                >
                  <span className="text-sm">💬</span>
                  <span>Mode B: Chat</span>
                </button>

                <button
                  onClick={() => setMode('lifebox')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    mode === 'lifebox'
                      ? 'bg-black text-white shadow-2xs font-bold'
                      : 'text-neutral-700 hover:text-black'
                  }`}
                >
                  <span className="text-sm">🧠</span>
                  <span>Mode A: LIFEBOX</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-6">
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.length === 0 ? (
              // Empty State tailored to current Mode
              <div className="py-10 text-center space-y-6">
                <div className="w-14 h-14 rounded-2xl bg-neutral-200 text-neutral-900 flex items-center justify-center mx-auto shadow-inner text-2xl">
                  {mode === 'chat' ? '💬' : '🧠'}
                </div>

                <div className="max-w-md mx-auto space-y-2">
                  <h3 className="text-base font-bold text-neutral-900">
                    {mode === 'chat' ? 'Conversational AI Mode' : 'LIFEBOX Mode (My Stuff)'}
                  </h3>
                  <p className="text-xs text-neutral-600 leading-relaxed">
                    {mode === 'chat'
                      ? 'Talk about anything, brainstorm ideas, ask for advice, or work through a problem. Chat mode will not search your personal notes unless you explicitly ask.'
                      : 'Ask me about your saved notes, documents, photos, reminders, tasks, or scans. I will search and recall your exact saved records.'}
                  </p>
                </div>

                {/* Quick Prompts */}
                <div className="max-w-xl mx-auto pt-2">
                  <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-3 flex items-center justify-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5 text-neutral-700" />
                    <span>Try starting with:</span>
                  </div>

                  <div className="flex flex-wrap justify-center gap-2">
                    {mode === 'chat' ? (
                      <>
                        <button
                          onClick={() => handleSend("I'm bored, what should I do?")}
                          className="text-xs px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-800 transition-all shadow-2xs"
                        >
                          "I'm bored, what should I do?"
                        </button>
                        <button
                          onClick={() => handleSend('I want to start a new project')}
                          className="text-xs px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-800 transition-all shadow-2xs"
                        >
                          "I want to start a new project"
                        </button>
                        <button
                          onClick={() => handleSend('I had a rough day')}
                          className="text-xs px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-800 transition-all shadow-2xs"
                        >
                          "I had a rough day"
                        </button>
                        <button
                          onClick={() => handleSend('Explain photosynthesis in simple terms')}
                          className="text-xs px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-800 transition-all shadow-2xs"
                        >
                          "Explain photosynthesis"
                        </button>
                        <button
                          onClick={() => handleSend("When is my friend's birthday?")}
                          className="text-xs px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-800 transition-all shadow-2xs"
                        >
                          "When is my friend's birthday?"
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleSend('Scan a document')}
                          className="text-xs px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-800 transition-all shadow-2xs flex items-center gap-1.5 font-medium"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>"Scan a document"</span>
                        </button>
                        <button
                          onClick={() => handleSend('Analyze my latest scan')}
                          className="text-xs px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-800 transition-all shadow-2xs flex items-center gap-1.5 font-medium"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>"Analyze my latest scan"</span>
                        </button>
                        <button
                          onClick={() => handleSend("When is my friend's birthday?")}
                          className="text-xs px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-800 transition-all shadow-2xs"
                        >
                          "When is my friend's birthday?"
                        </button>
                        <button
                          onClick={() => handleSend('What notes did I save recently?')}
                          className="text-xs px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-800 transition-all shadow-2xs"
                        >
                          "What notes did I save recently?"
                        </button>
                        <button
                          onClick={() => handleSend('Show my upcoming reminders')}
                          className="text-xs px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-800 transition-all shadow-2xs"
                        >
                          "Show my upcoming reminders"
                        </button>
                        <button
                          onClick={() => handleSend('What open tasks do I have?')}
                          className="text-xs px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-800 transition-all shadow-2xs"
                        >
                          "What open tasks do I have?"
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                const isUser = msg.sender === 'user';
                const isExpanded = expandedThoughts[msg.id] ?? false;

                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3.5 ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isUser && (
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs bg-black">
                        {msg.aiMode === 'lifebox' ? (
                          <Brain className="w-4 h-4" />
                        ) : (
                          <Bot className="w-4 h-4" />
                        )}
                      </div>
                    )}

                    <div
                      className={`max-w-2xl rounded-2xl p-4.5 ${
                        isUser
                          ? 'bg-black text-white rounded-tr-xs shadow-xs'
                          : 'bg-white border border-neutral-200 rounded-tl-xs shadow-2xs text-neutral-900'
                      }`}
                    >
                      {/* Mode Badge & Intent Header */}
                      {!isUser && (
                        <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-neutral-100">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-neutral-100 text-neutral-800 border border-neutral-200">
                              {msg.aiMode === 'lifebox' ? '🧠 LIFEBOX Mode' : '💬 Chat Mode'}
                            </span>

                            {msg.intent && (
                              <span className="text-[10px] font-mono text-neutral-400">
                                {msg.intent}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Thought Steps Trace */}
                      {!isUser && msg.thoughtSteps && msg.thoughtSteps.length > 0 && (
                        <div className="mb-3 border border-neutral-200 rounded-xl bg-neutral-50 p-2.5">
                          <button
                            onClick={() => toggleThoughts(msg.id)}
                            className="w-full flex items-center justify-between text-xs font-semibold text-neutral-900 hover:text-black"
                          >
                            <div className="flex items-center gap-1.5">
                              <Brain className="w-3.5 h-3.5 text-neutral-700" />
                              <span>Reasoning Trace ({msg.thoughtSteps.length} steps)</span>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5 text-neutral-500" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
                            )}
                          </button>

                          {isExpanded && (
                            <div className="mt-2 space-y-1 pt-2 border-t border-neutral-200">
                              {msg.thoughtSteps.map((step, sIdx) => (
                                <div
                                  key={sIdx}
                                  className="flex items-start gap-2 text-[11px] text-neutral-700 font-mono"
                                >
                                  <CheckCircle2 className="w-3 h-3 text-neutral-900 shrink-0 mt-0.5" />
                                  <span>{step}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Message Content */}
                      <div
                        className={`text-sm leading-relaxed whitespace-pre-wrap ${
                          isUser ? 'text-white' : 'text-neutral-900'
                        }`}
                      >
                        {msg.text}
                      </div>

                      {/* Referenced Items / Sources */}
                      {!isUser && msg.matchedItemIds && msg.matchedItemIds.length > 0 && (
                        <div className="mt-3.5 pt-3 border-t border-neutral-100">
                          <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                            <FileText className="w-3 h-3 text-neutral-400" />
                            <span>Referenced Saved Items ({msg.matchedItemIds.length})</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.matchedItemIds.map((itemId) => {
                              const matchedItem = items.find((i) => i.id === itemId);
                              if (!matchedItem) return null;
                              return (
                                <button
                                  key={itemId}
                                  onClick={() => onSelectItem(matchedItem)}
                                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-medium border border-neutral-200 transition-colors"
                                >
                                  <span>{matchedItem.title}</span>
                                  <ExternalLink className="w-3 h-3 text-neutral-500" />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Real Action Cards (Reminders, Notes, Tasks, Scans) */}
                      {!isUser && msg.actions && msg.actions.length > 0 && (
                        <div className="mt-4 pt-3.5 border-t border-neutral-100 space-y-2">
                          <div className="text-[11px] font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5 text-neutral-900" />
                            <span>Action Available</span>
                          </div>

                          {msg.actions.map((act) => {
                            const isExecuted = executedActionIds.has(act.id);
                            return (
                              <div
                                key={act.id}
                                className={`p-3 rounded-xl border transition-all ${
                                  isExecuted
                                    ? 'bg-neutral-100 border-neutral-300 text-neutral-700'
                                    : 'bg-neutral-50 border-neutral-200 text-neutral-950'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-start gap-2.5">
                                    <div
                                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                                        isExecuted
                                          ? 'bg-neutral-400 text-white'
                                          : 'bg-black text-white shadow-2xs'
                                      }`}
                                    >
                                      {act.type === 'create_note' && <FileText className="w-3.5 h-3.5" />}
                                      {act.type === 'create_reminder' && <Calendar className="w-3.5 h-3.5" />}
                                      {act.type === 'create_task' && <CheckSquare className="w-3.5 h-3.5" />}
                                      {act.type === 'open_item' && <ExternalLink className="w-3.5 h-3.5" />}
                                      {act.type === 'open_scanner' && <Camera className="w-3.5 h-3.5" />}
                                      {act.type === 'confirm_delete' && <Trash2 className="w-3.5 h-3.5 text-white" />}
                                      {act.type === 'create_collection' && <FolderPlus className="w-3.5 h-3.5" />}
                                    </div>
                                    <div>
                                      <h4 className="text-xs font-bold leading-snug">{act.label}</h4>
                                      <p className="text-[11px] text-neutral-500 mt-0.5">
                                        {act.type === 'create_reminder' &&
                                          `Date: ${act.payload.dueDate || 'Today'} • Time: ${act.payload.dueTime || '9:00 AM'}`}
                                        {act.type === 'create_note' && 'Saved in LIFEBOX repository'}
                                        {act.type === 'open_item' && 'Click to read full details'}
                                        {act.type === 'open_scanner' && 'Opens camera & intelligent OCR scanner'}
                                        {act.type === 'confirm_delete' && 'Requires confirmation to avoid accidental data loss'}
                                        {act.type === 'create_task' && 'Saved in your task list'}
                                      </p>
                                    </div>
                                  </div>

                                  <button
                                    onClick={() => executeAction(act)}
                                    disabled={isExecuted}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
                                      isExecuted
                                        ? 'bg-neutral-200 text-neutral-600 cursor-default'
                                        : act.type === 'confirm_delete'
                                        ? 'bg-red-600 hover:bg-red-700 text-white shadow-2xs active:scale-95'
                                        : 'bg-black hover:bg-neutral-800 text-white shadow-2xs active:scale-95'
                                    }`}
                                  >
                                    {isExecuted ? (
                                      <>
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        <span>Completed</span>
                                      </>
                                    ) : act.type === 'confirm_delete' ? (
                                      <>
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>Delete Note</span>
                                      </>
                                    ) : act.type === 'open_scanner' ? (
                                      <>
                                        <Camera className="w-3.5 h-3.5" />
                                        <span>Open Scanner</span>
                                      </>
                                    ) : act.type === 'open_item' ? (
                                      <>
                                        <ExternalLink className="w-3.5 h-3.5" />
                                        <span>Open</span>
                                      </>
                                    ) : (
                                      <>
                                        <Zap className="w-3.5 h-3.5" />
                                        <span>Apply</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Suggested Follow-Ups */}
                      {!isUser && msg.suggestedFollowUps && msg.suggestedFollowUps.length > 0 && (
                        <div className="mt-3.5 pt-2.5 border-t border-neutral-100 flex flex-wrap gap-1.5">
                          {msg.suggestedFollowUps.map((fUp, fIdx) => (
                            <button
                              key={fIdx}
                              onClick={() => handleSend(fUp)}
                              disabled={loading}
                              className="text-[11px] font-medium text-neutral-800 hover:text-black bg-neutral-100 hover:bg-neutral-200 px-2.5 py-1 rounded-lg border border-neutral-200 transition-colors"
                            >
                              {fUp}
                            </button>
                          ))}
                        </div>
                      )}

                      <div
                        className={`text-[10px] mt-2.5 flex items-center justify-between gap-2 ${
                          isUser ? 'text-neutral-400 text-right justify-end' : 'text-neutral-400'
                        }`}
                      >
                        {!isUser && (
                          <button
                            type="button"
                            onClick={() => handleToggleSpeakMessage(msg)}
                            className="inline-flex items-center gap-1 text-[11px] text-neutral-500 hover:text-black px-2 py-0.5 rounded-md hover:bg-neutral-100 transition-colors"
                            title={speakingMessageId === msg.id ? 'Stop voice playback' : 'Read aloud with voice'}
                          >
                            <Volume2
                              className={`w-3 h-3 ${
                                speakingMessageId === msg.id ? 'text-black animate-pulse' : ''
                              }`}
                            />
                            <span>{speakingMessageId === msg.id ? 'Stop Speaking' : 'Listen'}</span>
                          </button>
                        )}
                        <span>{msg.timestamp}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Loading Indicator */}
            {loading && (
              <div className="flex gap-3.5 justify-start">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs animate-pulse bg-black">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-white border border-neutral-200 rounded-2xl rounded-tl-xs p-3.5 shadow-2xs max-w-sm">
                  <div className="flex items-center gap-2.5 text-xs font-semibold text-neutral-800">
                    <Loader2 className="w-4 h-4 text-black animate-spin" />
                    <span>
                      {mode === 'lifebox'
                        ? 'Searching your LIFEBOX records...'
                        : 'Conversing naturally...'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Bar */}
        <div className="bg-white border-t border-neutral-200 p-3.5 shrink-0">
          <div className="max-w-3xl mx-auto">
            {/* Live Voice-to-Text Interim Bar */}
            {isListeningVoice && (
              <div className="mb-2.5 px-3.5 py-2.5 bg-neutral-900 text-white border border-black rounded-xl flex items-center justify-between gap-3 text-xs animate-fadeIn">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="relative flex h-3 w-3 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-bold text-white">Listening to voice:</span>
                    <div className="flex items-center gap-0.5 h-3.5">
                      <div className="w-1 bg-white rounded-full animate-bounce [animation-delay:0ms] h-3"></div>
                      <div className="w-1 bg-white rounded-full animate-bounce [animation-delay:150ms] h-2"></div>
                      <div className="w-1 bg-white rounded-full animate-bounce [animation-delay:300ms] h-3.5"></div>
                      <div className="w-1 bg-white rounded-full animate-bounce [animation-delay:450ms] h-2"></div>
                    </div>
                  </div>
                  <span className="italic text-neutral-300 truncate">
                    {voiceInterim || 'Speak now into your microphone...'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={toggleVoiceToText}
                  className="px-2.5 py-1 text-xs font-semibold text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg shrink-0 border border-neutral-700"
                >
                  Done
                </button>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              {/* Mode Toggle Button inside bar */}
              <button
                type="button"
                onClick={() => setMode(mode === 'chat' ? 'lifebox' : 'chat')}
                className={`flex items-center gap-1 px-2.5 py-2.5 rounded-xl border text-xs font-bold transition-all shrink-0 ${
                  mode === 'lifebox'
                    ? 'bg-black border-black text-white'
                    : 'bg-neutral-100 border-neutral-300 text-neutral-800'
                }`}
                title={`Switch mode (Currently: ${mode === 'chat' ? 'Chat' : 'LIFEBOX'})`}
              >
                <span>{mode === 'chat' ? '💬 Chat' : '🧠 LIFEBOX'}</span>
              </button>

              <div className="flex-1 relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    mode === 'chat'
                      ? 'Chat naturally, dictate with mic, ask anything... (e.g. "I want to start a project")'
                      : 'Search personal notes, reminders, scans, or memory... (e.g. "Scan document", "What open tasks do I have?")'
                  }
                  disabled={loading}
                  className="w-full pl-4 pr-11 py-2.5 rounded-xl border border-neutral-300 focus:outline-hidden focus:ring-2 focus:ring-black text-sm bg-neutral-50"
                />

                {/* Voice to text dictation button inside input */}
                <button
                  type="button"
                  onClick={toggleVoiceToText}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all ${
                    isListeningVoice
                      ? 'bg-black text-white shadow-xs animate-pulse ring-2 ring-neutral-400'
                      : 'text-neutral-400 hover:text-black hover:bg-neutral-100'
                  }`}
                  title={isListeningVoice ? 'Stop voice recording' : 'Dictate using voice-to-text (Web Speech)'}
                >
                  {isListeningVoice ? <Square className="w-4 h-4 fill-white" /> : <Mic className="w-4 h-4" />}
                </button>
              </div>

              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="px-4 py-2.5 rounded-xl text-white font-medium text-sm flex items-center gap-2 transition-all shrink-0 active:scale-95 disabled:opacity-50 bg-black hover:bg-neutral-800"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span className="hidden sm:inline">Send</span>
              </button>
            </form>

            <div className="flex items-center justify-between text-[11px] text-neutral-400 mt-2 px-1">
              <span>Press Enter to send or use the 🎙️ mic button to dictate voice to text.</span>
              <span>
                Active Mode:{' '}
                <strong className="text-neutral-900">
                  {mode === 'chat' ? 'Mode B: Chat (General AI)' : 'Mode A: LIFEBOX (My Stuff)'}
                </strong>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
