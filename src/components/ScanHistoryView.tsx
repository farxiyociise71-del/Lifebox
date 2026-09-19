import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Download,
  Trash2,
  Calendar,
  Tag,
  Clock,
  ExternalLink,
  Plus,
  RefreshCw,
  Eye,
  CheckCircle2,
  AlertCircle,
  FileDown,
  Layers,
  Sparkles,
} from 'lucide-react';
import { ScannedDocument } from '../types';
import { generatePdfFromPages } from '../utils/imageProcessing';

interface ScanHistoryViewProps {
  onScanNew: () => void;
  userToken?: string | null;
}

export const ScanHistoryView: React.FC<ScanHistoryViewProps> = ({ onScanNew, userToken }) => {
  const [scans, setScans] = useState<ScannedDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [selectedScan, setSelectedScan] = useState<ScannedDocument | null>(null);
  const [previewPageIdx, setPreviewPageIdx] = useState(0);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchScans = async () => {
    setIsLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (userToken) headers['Authorization'] = `Bearer ${userToken}`;

      const res = await fetch('/api/scans', { headers });
      if (res.ok) {
        const data = await res.json();
        setScans(data.scans || []);
      }
    } catch (err) {
      console.warn('Failed to fetch scans:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchScans();
  }, [userToken]);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;

    setDeletingId(id);
    try {
      const headers: Record<string, string> = {};
      if (userToken) headers['Authorization'] = `Bearer ${userToken}`;

      const res = await fetch(`/api/scans/${id}`, {
        method: 'DELETE',
        headers,
      });

      if (res.ok) {
        setScans((prev) => prev.filter((s) => s.id !== id));
        if (selectedScan?.id === id) {
          setSelectedScan(null);
        }
      }
    } catch (err) {
      alert('Failed to delete scan');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownloadPdf = async (scan: ScannedDocument) => {
    if (!scan.pages || scan.pages.length === 0) return;
    try {
      setIsExportingPdf(true);
      const pdfBlob = await generatePdfFromPages(scan.pages, scan.title);
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${scan.title.replace(/[^a-zA-Z0-9_-]/g, '_') || 'scan'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Error generating PDF: ' + err.message);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const filteredScans = scans.filter((s) => {
    const matchesSearch =
      !searchQuery ||
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.extractedText && s.extractedText.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.tags && s.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))) ||
      (s.documentType && s.documentType.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesType =
      selectedTypeFilter === 'all' || s.documentType === selectedTypeFilter;

    return matchesSearch && matchesType;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-50 overflow-hidden">
      {/* Top Bar */}
      <div className="bg-white border-b border-neutral-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-neutral-900" />
            Document Scans & Records
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Real intelligent multi-page document scanner with OCR, entity extraction, and PDF export
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchScans}
            className="p-2 text-neutral-600 hover:text-black hover:bg-neutral-100 rounded-lg transition-colors border border-neutral-200"
            title="Refresh scans"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onScanNew}
            className="px-4 py-2 bg-black hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Scan New Document</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border-b border-neutral-200 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search scans, OCR text, tags..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-black focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-neutral-500 font-medium">Type:</span>
          <select
            value={selectedTypeFilter}
            onChange={(e) => setSelectedTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-black text-neutral-700"
          >
            <option value="all">All Documents</option>
            <option value="school_document">School / Academic</option>
            <option value="receipt">Receipts</option>
            <option value="invoice">Invoices</option>
            <option value="contract">Contracts</option>
            <option value="id_card">IDs</option>
            <option value="medical">Medical</option>
            <option value="note">Notes</option>
            <option value="document">General</option>
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6 overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 text-neutral-400">
            <RefreshCw className="w-8 h-8 animate-spin mb-2 text-neutral-900" />
            <p className="text-sm">Loading your scans...</p>
          </div>
        ) : filteredScans.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-72 text-center p-6 bg-white border border-dashed border-neutral-300 rounded-2xl max-w-lg mx-auto">
            <div className="w-14 h-14 bg-neutral-100 text-neutral-900 rounded-2xl flex items-center justify-center mb-3">
              <FileText className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-bold text-neutral-800">No scanned documents found</h3>
            <p className="text-xs text-neutral-500 mt-1 max-w-xs">
              {searchQuery
                ? 'No documents matched your search filter.'
                : 'Capture physical documents with your camera or upload files to extract OCR text and action items.'}
            </p>
            <button
              onClick={onScanNew}
              className="mt-4 px-4 py-2 bg-black hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Start First Scan</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {filteredScans.map((scan) => {
              const firstPage = scan.pages?.[0]?.image;
              const pageCount = scan.pages?.length || 1;

              return (
                <div
                  key={scan.id}
                  className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col group hover:border-neutral-400"
                >
                  {/* Thumbnail */}
                  <div
                    onClick={() => {
                      setSelectedScan(scan);
                      setPreviewPageIdx(0);
                    }}
                    className="relative aspect-4/3 bg-neutral-100 overflow-hidden cursor-pointer flex items-center justify-center"
                  >
                    {firstPage ? (
                      <img
                        src={firstPage}
                        alt={scan.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <FileText className="w-12 h-12 text-neutral-300" />
                    )}

                    <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-xs text-white text-[10px] font-mono px-2 py-0.5 rounded">
                      {pageCount} {pageCount === 1 ? 'page' : 'pages'}
                    </div>

                    <div className="absolute top-2 right-2 bg-black/90 backdrop-blur-xs text-white text-[10px] font-semibold px-2 py-0.5 rounded capitalize">
                      {scan.documentType.replace('_', ' ')}
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <h3
                        onClick={() => {
                          setSelectedScan(scan);
                          setPreviewPageIdx(0);
                        }}
                        className="text-sm font-semibold text-neutral-900 line-clamp-1 hover:underline cursor-pointer"
                        title={scan.title}
                      >
                        {scan.title}
                      </h3>

                      <p className="text-[11px] text-neutral-500 mt-1 line-clamp-2">
                        {scan.analysis?.summary || scan.extractedText?.slice(0, 100) || 'Scanned document stored in LIFEBOX.'}
                      </p>

                      {/* Tag list */}
                      {scan.tags && scan.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {scan.tags.slice(0, 3).map((tg, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded"
                            >
                              #{tg}
                            </span>
                          ))}
                          {scan.tags.length > 3 && (
                            <span className="text-[10px] text-neutral-400">+{scan.tags.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Bottom Metadata & Actions */}
                    <div className="pt-3 mt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-400">
                      <span className="text-[11px]">
                        {new Date(scan.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>

                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleDownloadPdf(scan)}
                          className="p-1.5 text-neutral-500 hover:text-black hover:bg-neutral-100 rounded transition-colors"
                          title="Download PDF"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedScan(scan);
                            setPreviewPageIdx(0);
                          }}
                          className="p-1.5 text-neutral-500 hover:text-black hover:bg-neutral-100 rounded transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(scan.id, scan.title)}
                          disabled={deletingId === scan.id}
                          className="p-1.5 text-neutral-400 hover:text-black hover:bg-neutral-100 rounded transition-colors"
                          title="Delete Scan"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detailed Modal Viewer */}
      {selectedScan && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50">
              <div className="flex items-center space-x-3">
                <FileText className="w-5 h-5 text-neutral-900" />
                <div>
                  <h2 className="text-base font-bold text-neutral-900">{selectedScan.title}</h2>
                  <p className="text-xs text-neutral-500">
                    {selectedScan.documentType.replace('_', ' ')} •{' '}
                    {new Date(selectedScan.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleDownloadPdf(selectedScan)}
                  disabled={isExportingPdf}
                  className="px-3 py-1.5 text-xs font-medium text-neutral-700 bg-white border border-neutral-200 hover:bg-neutral-100 rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5 text-neutral-500" />
                  {isExportingPdf ? 'Exporting...' : 'Export PDF'}
                </button>
                <button
                  onClick={() => setSelectedScan(null)}
                  className="p-1.5 text-neutral-400 hover:text-black hover:bg-neutral-200 rounded-lg transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 overflow-y-auto p-4 gap-6">
              {/* Left Column: Page Display */}
              <div className="flex flex-col items-center">
                <div className="w-full aspect-3/4 max-h-[420px] bg-black rounded-xl overflow-hidden flex items-center justify-center shadow-inner">
                  {selectedScan.pages?.[previewPageIdx] ? (
                    <img
                      src={selectedScan.pages[previewPageIdx].image}
                      alt={`Page ${previewPageIdx + 1}`}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <span className="text-neutral-500 text-xs">No image preview available</span>
                  )}
                </div>

                {/* Page Navigation */}
                {selectedScan.pages && selectedScan.pages.length > 1 && (
                  <div className="flex items-center gap-2 mt-3 overflow-x-auto">
                    {selectedScan.pages.map((p, idx) => (
                      <button
                        key={idx}
                        onClick={() => setPreviewPageIdx(idx)}
                        className={`w-10 h-14 rounded border-2 overflow-hidden ${
                          previewPageIdx === idx ? 'border-black ring-2 ring-neutral-300' : 'border-neutral-200'
                        }`}
                      >
                        <img src={p.image} alt={`p${idx}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Column: AI Analysis & OCR */}
              <div className="flex flex-col space-y-4 text-xs">
                {/* Summary */}
                <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200">
                  <h4 className="font-bold text-neutral-700 uppercase tracking-wider text-[11px] mb-1">
                    Document Summary
                  </h4>
                  <p className="text-neutral-600 leading-relaxed">
                    {selectedScan.analysis?.summary || 'Document scanned into LIFEBOX.'}
                  </p>
                </div>

                {/* Detected Events / Tasks */}
                {selectedScan.analysis?.events && selectedScan.analysis.events.length > 0 && (
                  <div className="bg-neutral-100 p-3 rounded-xl border border-neutral-200">
                    <h4 className="font-bold text-neutral-900 uppercase tracking-wider text-[11px] mb-1 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-neutral-900" />
                      Calendar Events Extracted
                    </h4>
                    <div className="space-y-1 mt-1.5">
                      {selectedScan.analysis.events.map((ev: any, i: number) => (
                        <div key={i} className="text-neutral-700">
                          • <span className="font-semibold">{ev.title}</span> {ev.date ? `(${ev.date})` : ''}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedScan.analysis?.tasks && selectedScan.analysis.tasks.length > 0 && (
                  <div className="bg-neutral-100 p-3 rounded-xl border border-neutral-200">
                    <h4 className="font-bold text-neutral-900 uppercase tracking-wider text-[11px] mb-1 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-neutral-900" />
                      Tasks & Deadlines Extracted
                    </h4>
                    <div className="space-y-1 mt-1.5">
                      {selectedScan.analysis.tasks.map((tk: any, i: number) => (
                        <div key={i} className="text-neutral-700">
                          • <span className="font-semibold">{tk.title}</span> {tk.dueDate ? `[Due: ${tk.dueDate}]` : ''}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* OCR Text Box */}
                <div className="flex-1 flex flex-col">
                  <h4 className="font-bold text-neutral-700 uppercase tracking-wider text-[11px] mb-1">
                    OCR Extracted Text
                  </h4>
                  <div className="flex-1 min-h-[120px] max-h-48 overflow-y-auto p-3 bg-neutral-900 text-neutral-100 rounded-xl font-mono text-[11px]">
                    <pre className="whitespace-pre-wrap font-sans">
                      {selectedScan.extractedText || 'No OCR text extracted.'}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
