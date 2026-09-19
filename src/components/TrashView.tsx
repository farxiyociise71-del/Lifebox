import React from 'react';
import { Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import { LifeboxItem } from '../types';

interface TrashViewProps {
  items: LifeboxItem[];
  onRestoreItem: (id: string) => void;
  onPermanentDeleteItem: (id: string) => void;
  onEmptyTrash: () => void;
}

export const TrashView: React.FC<TrashViewProps> = ({
  items,
  onRestoreItem,
  onPermanentDeleteItem,
  onEmptyTrash,
}) => {
  const trashItems = items.filter((i) => i.isTrash);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
            <Trash2 className="w-6 h-6 text-slate-500" />
            <span>Trash ({trashItems.length})</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Items moved to trash can be restored back to your second brain or permanently removed
          </p>
        </div>

        {trashItems.length > 0 && (
          <button
            onClick={() => {
              if (confirm('Permanently delete all items in trash? This cannot be undone.')) {
                onEmptyTrash();
              }
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>Empty Trash</span>
          </button>
        )}
      </div>

      {trashItems.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-12 text-center max-w-md mx-auto space-y-2">
          <Trash2 className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="font-bold text-slate-800 text-sm">Trash is empty</h3>
          <p className="text-xs text-slate-400">Deleted notes, documents, and scans will appear here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-2xs space-y-3">
          {trashItems.map((item) => (
            <div
              key={item.id}
              className="p-3.5 rounded-2xl border border-slate-200 flex items-center justify-between gap-3 bg-slate-50/60"
            >
              <div className="truncate">
                <h4 className="text-xs sm:text-sm font-bold text-slate-800 truncate">{item.title}</h4>
                <p className="text-[11px] text-slate-500 mt-0.5 capitalize">
                  {item.category} • {item.type} • Deleted {new Date(item.updatedAt).toLocaleDateString()}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => onRestoreItem(item.id)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-indigo-600 font-bold text-xs shadow-2xs transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore</span>
                </button>

                <button
                  onClick={() => {
                    if (confirm(`Permanently delete "${item.title}"?`)) {
                      onPermanentDeleteItem(item.id);
                    }
                  }}
                  className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                  title="Permanent Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
