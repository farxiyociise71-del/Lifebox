import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  Plus,
  Inbox,
  FileText,
  Image as ImageIcon,
  FileCheck,
  Link2,
  Mic,
  Pin,
  Heart,
} from 'lucide-react';
import { LifeboxItem, ItemCategory, ItemType } from '../types';
import { ItemCard } from './ItemCard';

interface ItemGridProps {
  items: LifeboxItem[];
  isUnlocked: boolean;
  onSelectItem: (item: LifeboxItem) => void;
  onTogglePin: (id: string, e: React.MouseEvent) => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onDeleteItem: (id: string, e: React.MouseEvent) => void;
  onRequirePin: () => void;
  onOpenQuickAdd: () => void;
  title?: string;
  initialTypeFilter?: string;
}

export const ItemGrid: React.FC<ItemGridProps> = ({
  items,
  isUnlocked,
  onSelectItem,
  onTogglePin,
  onToggleFavorite,
  onDeleteItem,
  onRequirePin,
  onOpenQuickAdd,
  title = 'All Items',
  initialTypeFilter = 'all',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>(initialTypeFilter);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [onlyPinned, setOnlyPinned] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title'>('newest');

  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        if (item.isTrash) return false;
        if (selectedType !== 'all' && item.type !== selectedType) return false;
        if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
        if (onlyFavorites && !item.favorite) return false;
        if (onlyPinned && !item.pinned) return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = item.title.toLowerCase().includes(q);
          const matchContent = item.content.toLowerCase().includes(q);
          const matchOcr = (item.extractedText || '').toLowerCase().includes(q);
          const matchTags = item.tags.some((t) => t.toLowerCase().includes(q));
          if (!matchTitle && !matchContent && !matchOcr && !matchTags) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Pinned always come first if not strictly sorting by title
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;

        if (sortBy === 'newest') {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (sortBy === 'oldest') {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        return a.title.localeCompare(b.title);
      });
  }, [items, searchQuery, selectedType, selectedCategory, onlyFavorites, onlyPinned, sortBy]);

  const typeOptions = [
    { id: 'all', label: 'All' },
    { id: 'note', label: 'Notes' },
    { id: 'photo', label: 'Photos & Scans' },
    { id: 'document', label: 'Documents' },
    { id: 'link', label: 'Links' },
    { id: 'voice', label: 'Voice' },
    { id: 'contact', label: 'Contacts' },
    { id: 'location', label: 'Locations' },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">{title}</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {filteredItems.length} item{filteredItems.length === 1 ? '' : 's'} indexed in your second brain
          </p>
        </div>

        <button
          onClick={onOpenQuickAdd}
          className="self-start sm:self-auto flex items-center gap-1.5 px-4 py-2 rounded-xl bg-black hover:bg-neutral-800 text-white font-semibold text-xs sm:text-sm shadow-sm transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Add Item</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl p-3 border border-neutral-200 shadow-2xs space-y-3">
        {/* Search input + Sort + Quick toggles */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter current view by text, tag, content..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-neutral-50 border border-neutral-200 text-xs sm:text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Favorites toggle */}
            <button
              onClick={() => setOnlyFavorites((prev) => !prev)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                onlyFavorites
                  ? 'bg-black border-black text-white font-semibold'
                  : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${onlyFavorites ? 'fill-white text-white' : ''}`} />
              <span>Favorites</span>
            </button>

            {/* Pinned toggle */}
            <button
              onClick={() => setOnlyPinned((prev) => !prev)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                onlyPinned
                  ? 'bg-black border-black text-white font-semibold'
                  : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              <Pin className="w-3.5 h-3.5" />
              <span>Pinned</span>
            </button>

            {/* Sort selector */}
            <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white border border-neutral-200 text-xs text-neutral-700">
              <ArrowUpDown className="w-3.5 h-3.5 text-neutral-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-xs text-neutral-700 font-medium focus:outline-none cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="title">Alphabetical (A-Z)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Type pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {typeOptions.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setSelectedType(opt.id)}
              className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition-all ${
                selectedType === opt.id
                  ? 'bg-black text-white shadow-2xs font-semibold'
                  : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid or Empty state */}
      {filteredItems.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-neutral-300 p-12 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-neutral-100 text-neutral-900 flex items-center justify-center mb-3">
            <Inbox className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-neutral-900 mb-1">No items found</h3>
          <p className="text-xs text-neutral-500 mb-4 leading-relaxed">
            {searchQuery
              ? `No items matched your query "${searchQuery}". Try adjusting your filters.`
              : 'Your LIFEBOX is ready. Start saving thoughts, photos, documents, and contacts!'}
          </p>
          <button
            onClick={onOpenQuickAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-black hover:bg-neutral-800 text-white font-medium text-xs shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Save First Item</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
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
  );
};
