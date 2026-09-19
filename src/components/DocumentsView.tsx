import React, { useState, useRef } from 'react';
import {
  FileText,
  UploadCloud,
  Search,
  Sparkles,
  Download,
  Trash2,
  Lock,
  Star,
  Tag,
  Eye,
  CheckCircle2,
  FileCheck,
  AlertCircle,
  FolderTree,
} from 'lucide-react';
import { LifeboxItem, Collection, ItemCategory } from '../types';
import { ApiService } from '../services/api';
import { AiService } from '../services/ai';

interface DocumentsViewProps {
  items: LifeboxItem[];
  collections: Collection[];
  isUnlocked: boolean;
  onSaveItem: (item: LifeboxItem) => void;
  onUpdateItem: (item: LifeboxItem) => void;
  onDeleteItem: (id: string) => void;
  onSelectItem: (item: LifeboxItem) => void;
}

export const DocumentsView: React.FC<DocumentsViewProps> = ({
  items,
  collections,
  isUnlocked,
  onSaveItem,
  onUpdateItem,
  onDeleteItem,
  onSelectItem,
}) => {
  const documents = items.filter(
    (it) => (it.type === 'document' || it.type === 'pdf') && !it.isTrash
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isUploading, setIsUploading] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<LifeboxItem | null>(null);
  const [summarizingId, setSummarizingId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();

      reader.onload = async (e) => {
        const content = (e.target?.result as string) || '';
        const isPdf = file.name.endsWith('.pdf') || file.type.includes('pdf');

        const newDoc: LifeboxItem = {
          id: 'item-doc-' + Date.now() + '-' + i,
          title: file.name.replace(/\.[^/.]+$/, ''),
          type: isPdf ? 'pdf' : 'document',
          category: 'work',
          collectionIds: [],
          content: content.slice(0, 5000), // Preview text
          mediaName: file.name,
          extractedText: content.slice(0, 15000),
          tags: ['document', isPdf ? 'pdf' : 'text'],
          pinned: false,
          favorite: false,
          locked: false,
          isTrash: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        onSaveItem(newDoc);
      };

      if (file.type.startsWith('text/') || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
        reader.readAsText(file);
      } else {
        reader.readAsDataURL(file);
      }
    }

    setIsUploading(false);
  };

  const handleSummarizeDoc = async (doc: LifeboxItem) => {
    setSummarizingId(doc.id);
    try {
      const textToSummarize = doc.extractedText || doc.content || doc.title;
      const res = await AiService.summarizeText(doc.title, textToSummarize);
      if (res.summary) {
        onUpdateItem({
          ...doc,
          summary: res.summary,
          keyPoints: res.keyPoints || [],
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.warn('Document summarization failed:', err);
    } finally {
      setSummarizingId(null);
    }
  };

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch =
      searchQuery === '' ||
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.extractedText && doc.extractedText.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (doc.summary && doc.summary.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory =
      selectedCategory === 'all' || doc.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-neutral-100 text-neutral-900 flex items-center justify-center border border-neutral-200">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-neutral-900">Document Repository</h1>
              <p className="text-xs text-neutral-500">
                PDFs, text files, and contracts with automatic text extraction and AI synthesis
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => handleFileUpload(e.target.files)}
            multiple
            accept=".pdf,.txt,.md,.doc,.docx"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="px-4 py-2 bg-black hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold shadow-sm flex items-center gap-2 transition-all active:scale-95"
          >
            <UploadCloud className="w-4 h-4" />
            <span>{isUploading ? 'Uploading...' : 'Upload Documents'}</span>
          </button>
        </div>
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFileUpload(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-neutral-300 hover:border-black bg-neutral-50 hover:bg-neutral-100 rounded-2xl p-6 text-center cursor-pointer transition-colors"
      >
        <UploadCloud className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
        <p className="text-xs font-semibold text-neutral-700">
          Click to browse or drop PDF & text documents here
        </p>
        <p className="text-[11px] text-neutral-400 mt-1">Supports PDF, Markdown, Plain Text, and DOC files</p>
      </div>

      {/* Search & Category Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search inside documents & summaries..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-black"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 text-xs">
          {['all', 'work', 'study', 'finance', 'personal'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-lg capitalize font-medium transition-colors ${
                selectedCategory === cat
                  ? 'bg-black text-white font-semibold shadow-2xs'
                  : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Documents Grid */}
      {filteredDocs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center text-neutral-400">
          <FileText className="w-12 h-12 mx-auto mb-3 text-neutral-300" />
          <h3 className="text-sm font-bold text-neutral-700">No Documents Uploaded</h3>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto mt-1 mb-4">
            Upload your lecture notes, receipts, manuals, or PDF reports to search and summarize them instantly.
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-black hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold"
          >
            Upload Your First Document
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocs.map((doc) => (
            <div
              key={doc.id}
              onClick={() => onSelectItem(doc)}
              className="bg-white rounded-2xl border border-neutral-200 p-5 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group hover:border-neutral-400"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-neutral-100 text-neutral-900 border border-neutral-200 flex items-center justify-center font-bold text-xs uppercase">
                      {doc.type === 'pdf' ? 'PDF' : 'DOC'}
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-neutral-900 group-hover:underline transition-colors line-clamp-1">
                        {doc.title}
                      </h3>
                      <span className="text-[10px] text-neutral-400">
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {doc.locked && <Lock className="w-3.5 h-3.5 text-neutral-700" />}
                </div>

                {doc.summary ? (
                  <div className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-[11px] text-neutral-700 leading-relaxed mb-3">
                    <span className="font-semibold text-neutral-900 mb-0.5 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-neutral-900" />
                      AI Takeaway
                    </span>
                    <p className="line-clamp-3">{doc.summary}</p>
                  </div>
                ) : (
                  <p className="text-xs text-neutral-500 line-clamp-3 leading-relaxed mb-3">
                    {doc.extractedText || doc.content || 'Document content indexed for search.'}
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-neutral-100 flex items-center justify-between text-xs">
                <span className="px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-600 text-[10px] font-semibold capitalize">
                  {doc.category}
                </span>

                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  {!doc.summary && (
                    <button
                      onClick={() => handleSummarizeDoc(doc)}
                      disabled={summarizingId === doc.id}
                      className="px-2 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-900 text-[11px] font-semibold flex items-center gap-1 border border-neutral-200"
                      title="Generate AI Summary"
                    >
                      <Sparkles className="w-3 h-3 text-neutral-900" />
                      <span>{summarizingId === doc.id ? 'Analyzing...' : 'Summarize'}</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      if (confirm('Delete this document?')) onDeleteItem(doc.id);
                    }}
                    className="p-1 text-neutral-400 hover:text-black rounded-md"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
