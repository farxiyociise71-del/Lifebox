import React, { useState } from 'react';
import {
  Folder,
  Plus,
  Sparkles,
  Layers,
  ArrowRight,
  FolderOpen,
  Trash2,
  Tag,
  Loader2,
  Check,
} from 'lucide-react';
import { Collection, LifeboxItem } from '../types';
import { ItemCard } from './ItemCard';
import { AiService } from '../services/ai';
import confetti from 'canvas-confetti';

interface CollectionsViewProps {
  collections: Collection[];
  items: LifeboxItem[];
  isUnlocked: boolean;
  onSelectItem: (item: LifeboxItem) => void;
  onTogglePin: (id: string, e: React.MouseEvent) => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onDeleteItem: (id: string, e: React.MouseEvent) => void;
  onRequirePin: () => void;
  onCreateCollection: (name: string, description: string, color: string) => void;
  onDeleteCollection: (id: string) => void;
  onAutoOrganize: () => Promise<void>;
}

export const CollectionsView: React.FC<CollectionsViewProps> = ({
  collections,
  items,
  isUnlocked,
  onSelectItem,
  onTogglePin,
  onToggleFavorite,
  onDeleteItem,
  onRequirePin,
  onCreateCollection,
  onDeleteCollection,
  onAutoOrganize,
}) => {
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(
    collections[0]?.id || null
  );
  const [isCreating, setIsCreating] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColDesc, setNewColDesc] = useState('');
  const [newColColor, setNewColColor] = useState('#4f46e5');
  const [isOrganizing, setIsOrganizing] = useState(false);

  const activeCollection = collections.find((c) => c.id === activeCollectionId);
  const collectionItems = items.filter(
    (item) => !item.isTrash && activeCollectionId && item.collectionIds.includes(activeCollectionId)
  );

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColName.trim()) return;
    onCreateCollection(newColName.trim(), newColDesc.trim(), newColColor);
    setNewColName('');
    setNewColDesc('');
    setIsCreating(false);
  };

  const handleRunAutoOrganize = async () => {
    setIsOrganizing(true);
    try {
      await onAutoOrganize();
      confetti({ particleCount: 70, spread: 60 });
    } finally {
      setIsOrganizing(false);
    }
  };

  const colorOptions = ['#4f46e5', '#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
            <Layers className="w-6 h-6 text-indigo-600" />
            <span>Smart Collections & Folders</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Phase 4: Group knowledge by project, semester, identity, or custom workspace
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleRunAutoOrganize}
            disabled={isOrganizing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 font-bold text-xs border border-purple-200 transition-colors shadow-2xs"
          >
            {isOrganizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-purple-600" />}
            <span>AI Auto-Organize All Items</span>
          </button>

          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-2xs transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>New Collection</span>
          </button>
        </div>
      </div>

      {/* New Collection Form Modal / Panel */}
      {isCreating && (
        <form
          onSubmit={handleCreateSubmit}
          className="bg-white rounded-3xl border border-indigo-200 p-5 shadow-sm space-y-4 animate-in fade-in duration-150"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Create New Collection</h3>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Collection Name</label>
              <input
                type="text"
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                placeholder="e.g. Travel 2026, Tax Receipts, Research"
                className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-semibold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
              <input
                type="text"
                value={newColDesc}
                onChange={(e) => setNewColDesc(e.target.value)}
                placeholder="Short description of items kept here"
                className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600">Color Theme:</span>
            {colorOptions.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setNewColColor(c)}
                style={{ backgroundColor: c }}
                className={`w-6 h-6 rounded-full border-2 transition-transform ${
                  newColColor === c ? 'scale-125 border-slate-900' : 'border-white'
                }`}
              />
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-3 py-1.5 rounded-xl text-xs text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-xs hover:bg-indigo-700"
            >
              Save Collection
            </button>
          </div>
        </form>
      )}

      {/* Collections Grid Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
        {collections.map((col) => {
          const count = items.filter(
            (i) => !i.isTrash && i.collectionIds.includes(col.id)
          ).length;
          const isSelected = col.id === activeCollectionId;

          return (
            <div
              key={col.id}
              onClick={() => setActiveCollectionId(col.id)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'bg-indigo-50/60 border-indigo-300 ring-2 ring-indigo-200 shadow-sm'
                  : 'bg-white hover:bg-slate-50 border-slate-200/80 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-white"
                  style={{ backgroundColor: col.color || '#4f46e5' }}
                >
                  <Folder className="w-4 h-4" />
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete collection "${col.name}"? (Items will not be deleted)`)) {
                      onDeleteCollection(col.id);
                    }
                  }}
                  className="p-1 text-slate-300 hover:text-rose-600 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-xs sm:text-sm truncate">{col.name}</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">{count} items saved</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Active Collection Items View */}
      {activeCollection && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5" style={{ color: activeCollection.color }} />
              <div>
                <h2 className="text-base font-bold text-slate-900">{activeCollection.name}</h2>
                <p className="text-xs text-slate-500">
                  {activeCollection.description || 'Collection items'} • {collectionItems.length} items
                </p>
              </div>
            </div>
          </div>

          {collectionItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <Folder className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-xs">No items currently tagged to this collection.</p>
              <p className="text-[11px]">Edit an item or use Quick Add to add items to {activeCollection.name}.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {collectionItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  isUnlocked={isUnlocked}
                  onSelect={onSelectItem}
                  onTogglePin={onTogglePin}
                  onToggleFavorite={onToggleFavorite}
                  onDelete={onDeleteItem}
                  onRequirePin={onRequirePin}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
