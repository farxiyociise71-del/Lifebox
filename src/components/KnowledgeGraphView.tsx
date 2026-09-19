import React, { useState, useMemo } from 'react';
import { Network, Sparkles, Tag, ArrowRight, ExternalLink } from 'lucide-react';
import { LifeboxItem } from '../types';

interface KnowledgeGraphViewProps {
  items: LifeboxItem[];
  onSelectItem: (item: LifeboxItem) => void;
}

export const KnowledgeGraphView: React.FC<KnowledgeGraphViewProps> = ({ items, onSelectItem }) => {
  const activeItems = items.filter((i) => !i.isTrash);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(activeItems[0]?.id || null);

  // Group tags and count occurrences to form topic clusters
  const tagClusters = useMemo(() => {
    const map: { [tag: string]: LifeboxItem[] } = {};
    activeItems.forEach((it) => {
      it.tags.forEach((t) => {
        if (!map[t]) map[t] = [];
        map[t].push(it);
      });
    });
    return map;
  }, [activeItems]);

  const selectedItem = activeItems.find((i) => i.id === selectedNodeId);

  // Find related items that share tags or category
  const relatedItems = useMemo(() => {
    if (!selectedItem) return [];
    return activeItems.filter((i) => {
      if (i.id === selectedItem.id) return false;
      const sharedTag = i.tags.some((t) => selectedItem.tags.includes(t));
      const sharedCat = i.category === selectedItem.category;
      return sharedTag || sharedCat;
    });
  }, [selectedItem, activeItems]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
          <Network className="w-6 h-6 text-fuchsia-600" />
          <span>Knowledge Graph & Connections</span>
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Phase 13: Visualize interconnected notes, documents, and related thoughts
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Graph Canvas Visualizer */}
        <div className="lg:col-span-2 bg-slate-950 rounded-3xl p-6 shadow-md border border-slate-800 text-white min-h-[420px] flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-400 z-10">
            <span className="flex items-center gap-1.5 font-bold text-fuchsia-400">
              <Sparkles className="w-4 h-4" />
              Neural Memory Cluster
            </span>
            <span>{activeItems.length} Nodes Connected</span>
          </div>

          {/* Interactive Constellation / Nodes */}
          <div className="my-8 relative flex-1 flex flex-wrap items-center justify-center gap-4 py-8">
            {activeItems.map((item, idx) => {
              const isSelected = item.id === selectedNodeId;
              const isRelated = relatedItems.some((r) => r.id === item.id);

              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedNodeId(item.id)}
                  className={`group relative p-3 rounded-2xl border transition-all duration-200 text-left max-w-[200px] ${
                    isSelected
                      ? 'bg-fuchsia-600 border-fuchsia-400 text-white ring-4 ring-fuchsia-500/30 scale-105 z-20'
                      : isRelated
                      ? 'bg-slate-800/90 border-fuchsia-500/50 text-slate-100 hover:scale-102'
                      : 'bg-slate-900/60 border-slate-700/60 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-fuchsia-200 mb-1">
                    <span>{item.category}</span>
                    <span>•</span>
                    <span>{item.type}</span>
                  </div>
                  <h4 className="text-xs font-bold truncate">{item.title}</h4>
                  <div className="flex items-center gap-1 mt-1 overflow-hidden">
                    {item.tags.slice(0, 2).map((t, i) => (
                      <span key={i} className="text-[9px] text-slate-300 bg-white/10 px-1 rounded">
                        #{t}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="text-[11px] text-slate-500 z-10 flex items-center justify-between">
            <span>Tap any node to view associative connections & backlink graph</span>
            <span className="text-fuchsia-400">Grounded in tags & context</span>
          </div>
        </div>

        {/* Node Inspector & Related Items */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="pb-3 border-b border-slate-100">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Selected Memory Node
              </span>
              <h3 className="font-bold text-slate-900 text-base mt-0.5">
                {selectedItem?.title || 'None selected'}
              </h3>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                {selectedItem?.summary || selectedItem?.content || selectedItem?.extractedText}
              </p>
            </div>

            {/* Related items list */}
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Associated Connections ({relatedItems.length})</span>
                <span className="text-fuchsia-600 text-[11px]">Direct Links</span>
              </div>

              {relatedItems.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">
                  No other items currently share tags with this note.
                </p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {relatedItems.map((rel) => (
                    <div
                      key={rel.id}
                      onClick={() => onSelectItem(rel)}
                      className="p-3 rounded-xl bg-slate-50 hover:bg-fuchsia-50/50 border border-slate-200/60 hover:border-fuchsia-200 transition-all cursor-pointer flex items-center justify-between gap-2 group"
                    >
                      <div className="truncate">
                        <h5 className="font-bold text-xs text-slate-800 group-hover:text-fuchsia-950 truncate">
                          {rel.title}
                        </h5>
                        <p className="text-[10px] text-slate-400 capitalize">
                          {rel.category} • {rel.type}
                        </p>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-fuchsia-600 shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {selectedItem && (
            <div className="pt-3 border-t border-slate-100">
              <button
                onClick={() => onSelectItem(selectedItem)}
                className="w-full py-2.5 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold text-xs shadow-2xs transition-all flex items-center justify-center gap-1.5"
              >
                <span>Open Full Memory Card</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
