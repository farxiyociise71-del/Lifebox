import React, { useState, useRef } from 'react';
import {
  Image as ImageIcon,
  Upload,
  Camera,
  Search,
  Sparkles,
  Lock,
  Star,
  Trash2,
  Eye,
  Tag,
  Maximize2,
  FileSearch,
} from 'lucide-react';
import { LifeboxItem, Collection } from '../types';
import { AiService } from '../services/ai';

interface PhotosViewProps {
  items: LifeboxItem[];
  collections: Collection[];
  isUnlocked: boolean;
  onSaveItem: (item: LifeboxItem) => void;
  onUpdateItem: (item: LifeboxItem) => void;
  onDeleteItem: (id: string) => void;
  onSelectItem: (item: LifeboxItem) => void;
  onOpenScanner: () => void;
}

export const PhotosView: React.FC<PhotosViewProps> = ({
  items,
  collections,
  isUnlocked,
  onSaveItem,
  onUpdateItem,
  onDeleteItem,
  onSelectItem,
  onOpenScanner,
}) => {
  const photoItems = items.filter(
    (it) => (it.type === 'photo' || it.type === 'screenshot' || it.type === 'scan') && !it.isTrash
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'photo' | 'screenshot' | 'scan'>('all');
  const [activeModalItem, setActiveModalItem] = useState<LifeboxItem | null>(null);
  const [isOcrProcessing, setIsOcrProcessing] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File, idx) => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Url = event.target?.result as string;
        const isScreenshot = file.name.toLowerCase().includes('screenshot') || file.name.toLowerCase().includes('screen');

        const newItem: LifeboxItem = {
          id: 'item-photo-' + Date.now() + '-' + idx,
          title: file.name.replace(/\.[^/.]+$/, ''),
          type: isScreenshot ? 'screenshot' : 'photo',
          category: 'personal',
          collectionIds: [],
          content: 'Uploaded image: ' + file.name,
          mediaUrl: base64Url,
          mediaName: file.name,
          tags: [isScreenshot ? 'screenshot' : 'photo'],
          pinned: false,
          favorite: false,
          locked: false,
          isTrash: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        onSaveItem(newItem);

        // Auto OCR trigger
        try {
          setIsOcrProcessing(newItem.id);
          const ocrRes = await AiService.performOcr(base64Url, file.type || 'image/jpeg', isScreenshot ? 'screenshot' : 'photo');
          if (ocrRes.extractedText) {
            onUpdateItem({
              ...newItem,
              extractedText: ocrRes.extractedText,
              tags: Array.from(new Set([...newItem.tags, ...(ocrRes.tags || [])])),
              summary: ocrRes.summary,
              updatedAt: new Date().toISOString(),
            });
          }
        } catch (err) {
          console.warn('OCR error:', err);
        } finally {
          setIsOcrProcessing(null);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const filteredPhotos = photoItems.filter((item) => {
    const matchesFilter = filterType === 'all' || item.type === filterType;
    const matchesSearch =
      searchQuery === '' ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.extractedText && item.extractedText.toLowerCase().includes(searchQuery.toLowerCase())) ||
      item.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-neutral-100 text-black flex items-center justify-center border border-neutral-200">
            <ImageIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-neutral-900">Photos & Visual Gallery</h1>
            <p className="text-xs text-neutral-500">
              Screenshots, whiteboards, and photo receipts with searchable OCR text
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handlePhotoUpload}
            multiple
            accept="image/*"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2 bg-black hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-all active:scale-95"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Images</span>
          </button>
          <button
            onClick={onOpenScanner}
            className="px-3.5 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <Camera className="w-4 h-4 text-black" />
            <span>Camera Scanner</span>
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search text recognized inside images..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-black"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 text-xs">
          {[
            { id: 'all', label: 'All Media' },
            { id: 'photo', label: 'Photos' },
            { id: 'screenshot', label: 'Screenshots' },
            { id: 'scan', label: 'Scanned Documents' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id as any)}
              className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
                filterType === tab.id
                  ? 'bg-black text-white font-semibold shadow-2xs'
                  : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Photos Grid */}
      {filteredPhotos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center text-neutral-400">
          <ImageIcon className="w-12 h-12 mx-auto mb-3 text-neutral-300" />
          <h3 className="text-sm font-bold text-neutral-700">No Photos or Screenshots Saved</h3>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto mt-1 mb-4">
            Upload pictures of slides, receipts, or screenshots. LIFEBOX will automatically read any text inside them.
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-black hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold"
          >
            Upload Photo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredPhotos.map((item) => (
            <div
              key={item.id}
              onClick={() => onSelectItem(item)}
              className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
            >
              {/* Image Preview Container */}
              <div className="relative aspect-4/3 bg-neutral-100 overflow-hidden flex items-center justify-center">
                {item.mediaUrl ? (
                  <img
                    src={item.mediaUrl}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <ImageIcon className="w-10 h-10 text-neutral-300" />
                )}

                {item.locked && (
                  <div className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/70 text-white backdrop-blur-xs">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                )}

                {item.extractedText && (
                  <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/70 text-white text-[10px] font-semibold backdrop-blur-xs flex items-center gap-1">
                    <FileSearch className="w-3 h-3 text-white" />
                    <span>OCR Indexed</span>
                  </div>
                )}
              </div>

              {/* Info Details */}
              <div className="p-3">
                <h3 className="text-xs font-bold text-neutral-900 truncate group-hover:underline transition-colors">
                  {item.title}
                </h3>
                {item.extractedText && (
                  <p className="text-[10px] text-neutral-400 line-clamp-1 mt-0.5">
                    "{item.extractedText.slice(0, 60)}..."
                  </p>
                )}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-neutral-100 text-[10px] text-neutral-400">
                  <span className="capitalize">{item.type}</span>
                  <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
