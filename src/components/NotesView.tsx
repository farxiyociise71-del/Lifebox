import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Plus,
  Search,
  Sparkles,
  Save,
  Check,
  Tag,
  FolderTree,
  Pin,
  Star,
  Lock,
  Unlock,
  Trash2,
  Copy,
  ArrowRight,
  X,
  Languages,
  Wand2,
  ListTodo,
  Calendar,
  Users,
  MapPin,
  AlertCircle,
  HelpCircle,
  CheckSquare,
  Bold,
  Italic,
  Code,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
} from 'lucide-react';
import { LifeboxItem, Collection, ItemCategory } from '../types';
import { ApiService } from '../services/api';

interface NotesViewProps {
  items: LifeboxItem[];
  collections: Collection[];
  isUnlocked: boolean;
  onSaveItem: (item: LifeboxItem) => void;
  onUpdateItem: (item: LifeboxItem) => void;
  onDeleteItem: (id: string) => void;
  onRequirePin: () => void;
}

export const NotesView: React.FC<NotesViewProps> = ({
  items,
  collections,
  isUnlocked,
  onSaveItem,
  onUpdateItem,
  onDeleteItem,
  onRequirePin,
}) => {
  // Filter active notes
  const notes = items.filter((it) => it.type === 'note' && !it.isTrash);

  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(notes[0]?.id || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all');

  // Active note state
  const currentNote = notes.find((n) => n.id === selectedNoteId);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<ItemCategory>('personal');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [pinned, setPinned] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [locked, setLocked] = useState(false);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([]);

  // Autosave status
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'dirty'>('saved');
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // AI Writing Assistant states
  const [isAiToolOpen, setIsAiToolOpen] = useState(false);
  const [aiAction, setAiAction] = useState<string>('improve');
  const [aiLanguage, setAiLanguage] = useState('Spanish');
  const [aiTone, setAiTone] = useState('Professional');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResultModalOpen, setAiResultModalOpen] = useState(false);
  const [aiResultText, setAiResultText] = useState('');
  const [copiedStatus, setCopiedStatus] = useState(false);

  // Sync editor fields when selected note changes
  useEffect(() => {
    if (currentNote) {
      setTitle(currentNote.title);
      setContent(currentNote.content);
      setCategory(currentNote.category);
      setTags(currentNote.tags || []);
      setPinned(currentNote.pinned);
      setFavorite(currentNote.favorite);
      setLocked(currentNote.locked);
      setSelectedCollectionIds(currentNote.collectionIds || []);
      setSaveStatus('saved');
    } else if (notes.length > 0 && !selectedNoteId) {
      setSelectedNoteId(notes[0].id);
    }
  }, [selectedNoteId]);

  // Handle autosave with debounce
  const triggerAutosave = (newTitle: string, newContent: string, newCategory: ItemCategory, newTags: string[]) => {
    if (!currentNote) return;
    setSaveStatus('dirty');

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      setSaveStatus('saving');
      const updated: LifeboxItem = {
        ...currentNote,
        title: newTitle.trim() || 'Untitled Note',
        content: newContent,
        category: newCategory,
        tags: newTags,
        pinned,
        favorite,
        locked,
        collectionIds: selectedCollectionIds,
        updatedAt: new Date().toISOString(),
      };
      onUpdateItem(updated);
      setSaveStatus('saved');
    }, 800);
  };

  const handleCreateNewNote = () => {
    const newNote: LifeboxItem = {
      id: 'item-note-' + Date.now(),
      title: 'Untitled Note',
      type: 'note',
      category: 'personal',
      collectionIds: [],
      content: '',
      tags: ['notes'],
      pinned: false,
      favorite: false,
      locked: false,
      isTrash: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onSaveItem(newNote);
    setSelectedNoteId(newNote.id);
  };

  // Markdown format insertion helpers
  const insertFormatting = (prefix: string, suffix = '') => {
    const textarea = document.getElementById('note-content-area') as HTMLTextAreaElement | null;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.substring(start, end);
    const replacement = `${prefix}${selected || 'text'}${suffix}`;

    const newContent = content.substring(0, start) + replacement + content.substring(end);
    setContent(newContent);
    triggerAutosave(title, newContent, category, tags);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + (selected.length || 4));
    }, 50);
  };

  // AI Writing Tool execution
  const executeAiWritingTool = async (action: string) => {
    if (!content.trim() && !title.trim()) {
      alert('Please add some text to your note before using the AI writing assistant.');
      return;
    }

    setAiAction(action);
    setAiLoading(true);
    setIsAiToolOpen(false);

    try {
      const res = await ApiService.aiWritingTool({
        action,
        text: content || title,
        context: `Note Title: ${title}. Category: ${category}`,
        targetLanguage: aiLanguage,
        targetTone: aiTone,
      });

      setAiResultText(res.result || '');
      setAiResultModalOpen(true);
    } catch (err: any) {
      alert('AI Writing assistant error: ' + (err.message || 'Service unavailable'));
    } finally {
      setAiLoading(false);
    }
  };

  // Filtered notes list
  const filteredNotes = notes.filter((n) => {
    const matchesSearch =
      searchQuery === '' ||
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory =
      activeCategoryFilter === 'all' || n.category === activeCategoryFilter;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex h-[calc(100vh-125px)] bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-xs">
      {/* Sidebar: Notes List */}
      <div className="w-80 border-r border-neutral-200 bg-neutral-50/60 flex flex-col shrink-0">
        {/* Header & New Note */}
        <div className="p-3.5 border-b border-neutral-200 bg-white space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-neutral-900" />
              <h2 className="font-bold text-neutral-900 text-sm">Notes & Outlines</h2>
            </div>
            <button
              onClick={handleCreateNewNote}
              className="px-2.5 py-1.5 bg-black hover:bg-neutral-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Note</span>
            </button>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your notes..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-100 border border-neutral-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-black"
            />
          </div>

          {/* Category Pill Filters */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar text-[11px]">
            {['all', 'personal', 'study', 'work', 'ideas'].map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategoryFilter(cat)}
                className={`px-2 py-0.5 rounded-md capitalize font-medium whitespace-nowrap transition-colors ${
                  activeCategoryFilter === cat
                    ? 'bg-black text-white font-semibold'
                    : 'text-neutral-500 hover:bg-neutral-200/60'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Notes Items List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredNotes.length === 0 ? (
            <div className="p-8 text-center text-neutral-400">
              <FileText className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
              <p className="text-xs font-medium">No notes match your filter</p>
              <button
                onClick={handleCreateNewNote}
                className="mt-3 text-xs text-neutral-900 font-semibold hover:underline"
              >
                Create a note now
              </button>
            </div>
          ) : (
            filteredNotes.map((note) => {
              const isSelected = note.id === selectedNoteId;
              return (
                <div
                  key={note.id}
                  onClick={() => setSelectedNoteId(note.id)}
                  className={`p-3 rounded-xl cursor-pointer transition-all border ${
                    isSelected
                      ? 'bg-white border-neutral-400 shadow-xs'
                      : 'border-transparent hover:bg-white/80 hover:border-neutral-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <h3 className="text-xs font-bold text-neutral-900 truncate">
                      {note.title || 'Untitled'}
                    </h3>
                    <div className="flex items-center gap-1 shrink-0">
                      {note.pinned && <Pin className="w-3 h-3 text-neutral-900" />}
                      {note.favorite && <Star className="w-3 h-3 text-neutral-900 fill-neutral-900" />}
                      {note.locked && <Lock className="w-3 h-3 text-neutral-700" />}
                    </div>
                  </div>
                  <p className="text-[11px] text-neutral-500 line-clamp-2 leading-relaxed">
                    {note.content || 'Empty note...'}
                  </p>
                  <div className="flex items-center gap-2 mt-2 text-[10px] text-neutral-400">
                    <span className="capitalize">{note.category}</span>
                    <span>•</span>
                    <span>{new Date(note.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Panel: Note Editor */}
      {currentNote ? (
        <div className="flex-1 flex flex-col bg-white overflow-hidden">
          {/* Note Editor Header */}
          <div className="p-3.5 border-b border-neutral-200 flex items-center justify-between gap-3 bg-white">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  triggerAutosave(e.target.value, content, category, tags);
                }}
                placeholder="Note Title..."
                className="text-base font-bold text-neutral-900 bg-transparent border-none focus:outline-hidden w-full"
              />
              <div className="flex items-center gap-1 shrink-0">
                {saveStatus === 'saved' && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-neutral-900 font-medium">
                    <Check className="w-3.5 h-3.5" />
                    <span>Saved</span>
                  </span>
                )}
                {saveStatus === 'saving' && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-neutral-500 font-medium animate-pulse">
                    <Save className="w-3.5 h-3.5" />
                    <span>Saving...</span>
                  </span>
                )}
              </div>
            </div>

            {/* Note Actions Bar */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* AI Writing Assistant Menu Trigger */}
              <div className="relative">
                <button
                  onClick={() => setIsAiToolOpen((prev) => !prev)}
                  disabled={aiLoading}
                  className="px-2.5 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-900 font-semibold text-xs flex items-center gap-1.5 border border-neutral-300 shadow-2xs transition-all active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5 text-neutral-900" />
                  <span>{aiLoading ? 'AI Writing...' : 'AI Writing Tools'}</span>
                </button>

                {/* AI Tools Dropdown Menu */}
                {isAiToolOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-64 bg-white rounded-xl shadow-xl border border-neutral-200 p-2 z-40 space-y-1">
                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                      Refine & Polish
                    </div>
                    <button
                      onClick={() => executeAiWritingTool('improve')}
                      className="w-full text-left px-2.5 py-1.5 text-xs text-neutral-700 hover:bg-neutral-100 hover:text-black rounded-lg flex items-center gap-2"
                    >
                      <Wand2 className="w-3.5 h-3.5 text-neutral-700" />
                      <span>Improve Writing</span>
                    </button>
                    <button
                      onClick={() => executeAiWritingTool('fix_grammar')}
                      className="w-full text-left px-2.5 py-1.5 text-xs text-neutral-700 hover:bg-neutral-100 hover:text-black rounded-lg flex items-center gap-2"
                    >
                      <Check className="w-3.5 h-3.5 text-neutral-700" />
                      <span>Fix Grammar & Spelling</span>
                    </button>
                    <button
                      onClick={() => executeAiWritingTool('summarize')}
                      className="w-full text-left px-2.5 py-1.5 text-xs text-neutral-700 hover:bg-neutral-100 hover:text-black rounded-lg flex items-center gap-2"
                    >
                      <FileText className="w-3.5 h-3.5 text-neutral-700" />
                      <span>Summarize Takeaways</span>
                    </button>
                    <button
                      onClick={() => executeAiWritingTool('expand')}
                      className="w-full text-left px-2.5 py-1.5 text-xs text-neutral-700 hover:bg-neutral-100 hover:text-black rounded-lg flex items-center gap-2"
                    >
                      <ArrowRight className="w-3.5 h-3.5 text-neutral-700" />
                      <span>Expand Content</span>
                    </button>
                    <button
                      onClick={() => executeAiWritingTool('shorten')}
                      className="w-full text-left px-2.5 py-1.5 text-xs text-neutral-700 hover:bg-neutral-100 hover:text-black rounded-lg flex items-center gap-2"
                    >
                      <List className="w-3.5 h-3.5 text-neutral-700" />
                      <span>Condense / Shorten</span>
                    </button>

                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400 pt-1 border-t border-neutral-100">
                      Transform & Extract
                    </div>
                    <button
                      onClick={() => executeAiWritingTool('create_checklist')}
                      className="w-full text-left px-2.5 py-1.5 text-xs text-neutral-700 hover:bg-neutral-100 hover:text-black rounded-lg flex items-center gap-2"
                    >
                      <ListTodo className="w-3.5 h-3.5 text-neutral-700" />
                      <span>Convert to Checklist</span>
                    </button>
                    <button
                      onClick={() => executeAiWritingTool('create_tasks')}
                      className="w-full text-left px-2.5 py-1.5 text-xs text-neutral-700 hover:bg-neutral-100 hover:text-black rounded-lg flex items-center gap-2"
                    >
                      <CheckSquare className="w-3.5 h-3.5 text-neutral-700" />
                      <span>Extract Actionable Tasks</span>
                    </button>
                    <button
                      onClick={() => executeAiWritingTool('extract_dates')}
                      className="w-full text-left px-2.5 py-1.5 text-xs text-neutral-700 hover:bg-neutral-100 hover:text-black rounded-lg flex items-center gap-2"
                    >
                      <Calendar className="w-3.5 h-3.5 text-neutral-700" />
                      <span>Extract Dates & Deadlines</span>
                    </button>
                    <button
                      onClick={() => executeAiWritingTool('extract_people')}
                      className="w-full text-left px-2.5 py-1.5 text-xs text-neutral-700 hover:bg-neutral-100 hover:text-black rounded-lg flex items-center gap-2"
                    >
                      <Users className="w-3.5 h-3.5 text-neutral-700" />
                      <span>Extract People & Roles</span>
                    </button>
                    <button
                      onClick={() => executeAiWritingTool('generate_ideas')}
                      className="w-full text-left px-2.5 py-1.5 text-xs text-neutral-700 hover:bg-neutral-100 hover:text-black rounded-lg flex items-center gap-2"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-neutral-700" />
                      <span>Brainstorm Ideas</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Pin, Favorite, Lock buttons */}
              <button
                onClick={() => {
                  const next = !pinned;
                  setPinned(next);
                  onUpdateItem({ ...currentNote, pinned: next, updatedAt: new Date().toISOString() });
                }}
                className={`p-1.5 rounded-lg border text-xs transition-colors ${
                  pinned ? 'bg-neutral-100 text-neutral-900 border-neutral-300' : 'text-neutral-400 border-neutral-200 hover:bg-neutral-50'
                }`}
                title="Pin Note"
              >
                <Pin className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => {
                  const next = !favorite;
                  setFavorite(next);
                  onUpdateItem({ ...currentNote, favorite: next, updatedAt: new Date().toISOString() });
                }}
                className={`p-1.5 rounded-lg border text-xs transition-colors ${
                  favorite ? 'bg-neutral-100 text-neutral-900 border-neutral-300 fill-neutral-900' : 'text-neutral-400 border-neutral-200 hover:bg-neutral-50'
                }`}
                title="Favorite"
              >
                <Star className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => {
                  if (!isUnlocked && !locked) {
                    onRequirePin();
                    return;
                  }
                  const next = !locked;
                  setLocked(next);
                  onUpdateItem({ ...currentNote, locked: next, updatedAt: new Date().toISOString() });
                }}
                className={`p-1.5 rounded-lg border text-xs transition-colors ${
                  locked ? 'bg-neutral-900 text-white border-neutral-900' : 'text-neutral-400 border-neutral-200 hover:bg-neutral-50'
                }`}
                title={locked ? 'Locked in Vault' : 'Unlocked'}
              >
                {locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={() => {
                  if (confirm('Move note to trash?')) {
                    onDeleteItem(currentNote.id);
                  }
                }}
                className="p-1.5 rounded-lg border border-neutral-200 text-neutral-400 hover:text-black hover:bg-neutral-100 transition-colors"
                title="Delete Note"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Formatting Toolbar */}
          <div className="px-4 py-2 border-b border-neutral-100 bg-neutral-50/50 flex items-center gap-1 text-neutral-600 text-xs overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => insertFormatting('# ')}
              className="p-1.5 hover:bg-neutral-200/60 rounded-md"
              title="Heading 1"
            >
              <Heading1 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('## ')}
              className="p-1.5 hover:bg-neutral-200/60 rounded-md"
              title="Heading 2"
            >
              <Heading2 className="w-3.5 h-3.5" />
            </button>
            <span className="text-neutral-300">|</span>
            <button
              type="button"
              onClick={() => insertFormatting('**', '**')}
              className="p-1.5 hover:bg-neutral-200/60 rounded-md"
              title="Bold"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('*', '*')}
              className="p-1.5 hover:bg-neutral-200/60 rounded-md"
              title="Italic"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('`', '`')}
              className="p-1.5 hover:bg-neutral-200/60 rounded-md"
              title="Code"
            >
              <Code className="w-3.5 h-3.5" />
            </button>
            <span className="text-neutral-300">|</span>
            <button
              type="button"
              onClick={() => insertFormatting('- ')}
              className="p-1.5 hover:bg-neutral-200/60 rounded-md"
              title="Bullet List"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('1. ')}
              className="p-1.5 hover:bg-neutral-200/60 rounded-md"
              title="Numbered List"
            >
              <ListOrdered className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('- [ ] ')}
              className="p-1.5 hover:bg-neutral-200/60 rounded-md"
              title="Checklist Item"
            >
              <CheckSquare className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('> ')}
              className="p-1.5 hover:bg-neutral-200/60 rounded-md"
              title="Quote"
            >
              <Quote className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Textarea Editor Area */}
          <div className="flex-1 p-6 overflow-y-auto">
            <textarea
              id="note-content-area"
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                triggerAutosave(title, e.target.value, category, tags);
              }}
              placeholder="Write your note in Markdown... Press AI Writing Tools for assistance."
              className="w-full h-full min-h-[350px] resize-none border-none focus:outline-hidden text-sm leading-relaxed text-neutral-800 placeholder-neutral-300 font-sans"
            />
          </div>

          {/* Note Footer: Tags & Category Settings */}
          <div className="p-3 border-t border-neutral-200 bg-neutral-50/70 flex items-center justify-between text-xs text-neutral-500">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-neutral-400" />
                <span className="text-[11px] font-medium text-neutral-600">Tags:</span>
                <div className="flex items-center gap-1">
                  {tags.map((t, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md bg-white border border-neutral-200 text-neutral-700 text-[10px] font-semibold"
                    >
                      #{t}
                    </span>
                  ))}
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && tagInput.trim()) {
                        e.preventDefault();
                        const next = [...tags, tagInput.trim().replace(/^#/, '')];
                        setTags(next);
                        setTagInput('');
                        triggerAutosave(title, content, category, next);
                      }
                    }}
                    placeholder="+ add tag..."
                    className="w-20 px-1 py-0.5 text-[11px] bg-transparent border-none focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={category}
                onChange={(e) => {
                  const next = e.target.value as ItemCategory;
                  setCategory(next);
                  triggerAutosave(title, content, next, tags);
                }}
                className="px-2 py-1 rounded-md bg-white border border-neutral-200 text-neutral-700 text-xs focus:outline-hidden capitalize"
              >
                <option value="personal">Personal</option>
                <option value="study">Study</option>
                <option value="work">Work</option>
                <option value="finance">Finance</option>
                <option value="health">Health</option>
                <option value="ideas">Ideas</option>
              </select>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-neutral-400 bg-white">
          <FileText className="w-12 h-12 text-neutral-300 mb-3" />
          <h3 className="text-sm font-bold text-neutral-700">No Note Selected</h3>
          <p className="text-xs text-neutral-400 max-w-sm mt-1 mb-4">
            Select an existing note from the list on the left, or create a brand new note to begin writing.
          </p>
          <button
            onClick={handleCreateNewNote}
            className="px-4 py-2 bg-black hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold shadow-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create First Note</span>
          </button>
        </div>
      )}

      {/* AI Writing Review Modal */}
      {aiResultModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 bg-neutral-100 border-b border-neutral-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-neutral-900" />
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">
                    AI Writing Result: {aiAction.replace('_', ' ').toUpperCase()}
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    Review generated output before deciding how to apply it
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAiResultModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-black rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto bg-neutral-50">
              <div className="p-4 rounded-xl bg-white border border-neutral-200 text-xs leading-relaxed font-mono whitespace-pre-wrap text-neutral-800">
                {aiResultText}
              </div>
            </div>

            <div className="p-4 bg-white border-t border-neutral-200 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(aiResultText);
                  setCopiedStatus(true);
                  setTimeout(() => setCopiedStatus(false), 2000);
                }}
                className="px-3 py-2 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedStatus ? 'Copied!' : 'Copy to Clipboard'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAiResultModalOpen(false)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-neutral-600 hover:bg-neutral-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const merged = content ? `${content}\n\n${aiResultText}` : aiResultText;
                    setContent(merged);
                    triggerAutosave(title, merged, category, tags);
                    setAiResultModalOpen(false);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-neutral-200 hover:bg-neutral-300 text-neutral-900 text-xs font-semibold transition-colors"
                >
                  Append to Note
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setContent(aiResultText);
                    triggerAutosave(title, aiResultText, category, tags);
                    setAiResultModalOpen(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-black hover:bg-neutral-800 text-white text-xs font-semibold shadow-xs"
                >
                  Replace Note Content
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
