import React from 'react';
import {
  FileText,
  Image as ImageIcon,
  FileCode,
  FileCheck,
  Link2,
  Mic,
  User,
  MapPin,
  Pin,
  Heart,
  Lock,
  Calendar,
  Sparkles,
  GraduationCap,
  MoreVertical,
  Trash2,
  Copy,
} from 'lucide-react';
import { LifeboxItem } from '../types';

interface ItemCardProps {
  item: LifeboxItem;
  isUnlocked: boolean;
  onSelect: (item: LifeboxItem) => void;
  onTogglePin: (id: string, e: React.MouseEvent) => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onRequirePin: () => void;
}

export const ItemCard: React.FC<ItemCardProps> = ({
  item,
  isUnlocked,
  onSelect,
  onTogglePin,
  onToggleFavorite,
  onDelete,
  onRequirePin,
}) => {
  const isLocked = item.locked && !isUnlocked;

  const getTypeIcon = () => {
    switch (item.type) {
      case 'photo':
      case 'screenshot':
        return <ImageIcon className="w-3.5 h-3.5 text-neutral-800" />;
      case 'document':
      case 'pdf':
        return <FileCheck className="w-3.5 h-3.5 text-neutral-800" />;
      case 'link':
      case 'webpage':
        return <Link2 className="w-3.5 h-3.5 text-neutral-800" />;
      case 'voice':
        return <Mic className="w-3.5 h-3.5 text-neutral-800" />;
      case 'contact':
        return <User className="w-3.5 h-3.5 text-neutral-800" />;
      case 'location':
        return <MapPin className="w-3.5 h-3.5 text-neutral-800" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-neutral-800" />;
    }
  };

  const getCategoryColor = () => {
    return 'bg-neutral-100 text-neutral-800 border-neutral-200';
  };

  const handleClick = () => {
    if (isLocked) {
      onRequirePin();
    } else {
      onSelect(item);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`group relative bg-white rounded-2xl border transition-all duration-200 cursor-pointer p-4 flex flex-col justify-between hover:shadow-md hover:border-neutral-400 ${
        item.pinned ? 'border-black ring-1 ring-black/20 bg-neutral-50' : 'border-neutral-200'
      }`}
    >
      {/* Top badges & controls */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-neutral-100 text-neutral-800">
              {getTypeIcon()}
              <span className="capitalize">{item.type}</span>
            </span>
            <span className={`px-2 py-0.5 rounded-lg text-xs font-medium border capitalize ${getCategoryColor()}`}>
              {item.category}
            </span>
            {item.studentMeta?.flashcards && item.studentMeta.flashcards.length > 0 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-neutral-900 text-white">
                <GraduationCap className="w-3 h-3" />
                {item.studentMeta.flashcards.length} Cards
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => onTogglePin(item.id, e)}
              className={`p-1.5 rounded-lg hover:bg-neutral-100 transition-colors ${
                item.pinned ? 'text-black bg-neutral-200' : 'text-neutral-400 hover:text-black'
              }`}
              title={item.pinned ? 'Unpin' : 'Pin to top'}
            >
              <Pin className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => onToggleFavorite(item.id, e)}
              className={`p-1.5 rounded-lg hover:bg-neutral-100 transition-colors ${
                item.favorite ? 'text-black fill-black bg-neutral-200' : 'text-neutral-400 hover:text-black'
              }`}
              title="Favorite"
            >
              <Heart className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Locked Overlay or Content */}
        {isLocked ? (
          <div className="py-6 flex flex-col items-center justify-center text-center bg-neutral-50 rounded-xl border border-dashed border-neutral-300">
            <Lock className="w-6 h-6 text-neutral-400 mb-1.5" />
            <p className="text-xs font-bold text-neutral-800">Protected Item</p>
            <p className="text-[11px] text-neutral-500">Click & enter PIN to view</p>
          </div>
        ) : (
          <>
            {/* Image / Scan preview if available */}
            {item.mediaUrl && (
              <div className="mb-3 rounded-xl overflow-hidden bg-neutral-100 max-h-40 border border-neutral-200 relative">
                <img
                  src={item.mediaUrl}
                  alt={item.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-36 object-cover group-hover:scale-102 transition-transform duration-300"
                />
                {item.extractedText && (
                  <span className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-semibold px-2 py-0.5 rounded-md backdrop-blur-xs flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5 text-neutral-300" />
                    OCR Read
                  </span>
                )}
              </div>
            )}

            {/* Title */}
            <h3 className="font-bold text-neutral-900 text-sm sm:text-base leading-snug mb-1.5 line-clamp-2">
              {item.title}
            </h3>

            {/* Content or Summary excerpt */}
            <p className="text-xs text-neutral-600 line-clamp-3 leading-relaxed mb-3">
              {item.summary || item.content || item.extractedText || 'No text content.'}
            </p>

            {/* Audio player preview if voice note */}
            {item.type === 'voice' && (
              <div className="mb-3 p-2.5 rounded-xl bg-neutral-100 border border-neutral-200 flex items-center gap-2">
                <Mic className="w-4 h-4 text-neutral-900 animate-pulse" />
                <span className="text-xs font-medium text-neutral-900">Voice Recording</span>
              </div>
            )}

            {/* Contact details preview */}
            {item.contactInfo && (
              <div className="mb-3 p-2 rounded-xl bg-neutral-100 border border-neutral-200 text-xs text-neutral-900 space-y-0.5">
                {item.contactInfo.phone && <p className="truncate">📞 {item.contactInfo.phone}</p>}
                {item.contactInfo.email && <p className="truncate">✉️ {item.contactInfo.email}</p>}
              </div>
            )}

            {/* Location preview */}
            {item.locationInfo && (
              <div className="mb-3 p-2 rounded-xl bg-neutral-100 border border-neutral-200 text-xs text-neutral-900 truncate">
                📍 {item.locationInfo.address || 'Saved coordinate'}
              </div>
            )}

            {/* Link preview */}
            {item.linkInfo && (
              <div className="mb-3 p-2 rounded-xl bg-neutral-100 border border-neutral-200 text-xs text-neutral-900 truncate font-mono">
                🔗 {item.linkInfo.domain || item.linkInfo.url}
              </div>
            )}

            {/* Reminder pill if attached */}
            {item.reminder && (
              <div
                className={`mb-3 inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium border ${
                  item.reminder.completed
                    ? 'bg-neutral-100 text-neutral-500 line-through border-neutral-200'
                    : 'bg-black text-white border-black font-semibold'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>
                  Due {item.reminder.dueDate} {item.reminder.dueTime ? `at ${item.reminder.dueTime}` : ''}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer Tags & Meta */}
      <div className="pt-2.5 border-t border-neutral-100 flex items-center justify-between gap-2 text-[11px] text-neutral-400">
        <div className="flex items-center gap-1.5 flex-wrap overflow-hidden">
          {item.tags.slice(0, 3).map((tag, idx) => (
            <span
              key={idx}
              className="text-neutral-600 bg-neutral-100 px-1.5 py-0.5 rounded-md text-[10px] font-medium"
            >
              #{tag}
            </span>
          ))}
          {item.tags.length > 3 && (
            <span className="text-neutral-400 text-[10px]">+{item.tags.length - 3}</span>
          )}
        </div>

        <button
          onClick={(e) => onDelete(item.id, e)}
          className="p-1 text-neutral-400 hover:text-black rounded transition-colors"
          title="Delete item"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
