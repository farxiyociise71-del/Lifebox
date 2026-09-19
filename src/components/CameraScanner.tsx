import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Upload,
  RefreshCw,
  Sparkles,
  Check,
  FileText,
  Receipt,
  GraduationCap,
  BookOpen,
  Sliders,
  Loader2,
  Copy,
  Plus,
} from 'lucide-react';
import { LifeboxItem, ItemCategory } from '../types';
import { AiService } from '../services/ai';

interface CameraScannerProps {
  onSaveItem: (item: LifeboxItem) => void;
  onSelectItem: (item: LifeboxItem) => void;
}

type ScanMode = 'document' | 'receipt' | 'business_card' | 'handwriting' | 'book';

export const CameraScanner: React.FC<CameraScannerProps> = ({ onSaveItem, onSelectItem }) => {
  const [scanMode, setScanMode] = useState<ScanMode>('document');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isLiveCamera, setIsLiveCamera] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [filterMode, setFilterMode] = useState<'normal' | 'high_contrast' | 'grayscale'>('normal');

  // OCR results
  const [extractedText, setExtractedText] = useState('');
  const [suggestedTitle, setSuggestedTitle] = useState('');
  const [suggestedCategory, setSuggestedCategory] = useState<ItemCategory>('personal');
  const [tags, setTags] = useState<string[]>([]);
  const [summary, setSummary] = useState('');
  const [copied, setCopied] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsLiveCamera(true);
      setCapturedImage(null);
    } catch (err) {
      alert('Camera access denied or not available. You can upload an image file directly.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsLiveCamera(false);
  };

  const captureFrame = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setCapturedImage(dataUrl);
      stopCamera();
      runOcr(dataUrl);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setCapturedImage(dataUrl);
      runOcr(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const runOcr = async (base64Img: string) => {
    setIsProcessing(true);
    setSavedSuccess(false);
    try {
      const res = await AiService.performOcr(base64Img, 'image/jpeg', scanMode);
      setExtractedText(res.extractedText);
      setSuggestedTitle(res.suggestedTitle || `Scanned ${scanMode}`);
      setSuggestedCategory((res.suggestedCategory as ItemCategory) || 'personal');
      setTags(res.tags || ['scan', scanMode]);
      setSummary(res.summary || 'Scanned document saved to LIFEBOX.');
    } catch (err) {
      console.error(err);
      setExtractedText('OCR reading could not process this image.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveToLifebox = () => {
    if (!capturedImage) return;
    const newItem: LifeboxItem = {
      id: 'scan-' + Date.now(),
      title: suggestedTitle || `Scanned ${scanMode}`,
      type: scanMode === 'receipt' ? 'document' : 'photo',
      category: suggestedCategory,
      collectionIds: [],
      content: summary || 'Scanned media with text extraction.',
      mediaUrl: capturedImage,
      extractedText,
      summary,
      tags: tags.length ? tags : ['scanned', scanMode],
      pinned: false,
      favorite: false,
      locked: false,
      isTrash: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSaveItem(newItem);
    setSavedSuccess(true);
    setTimeout(() => {
      onSelectItem(newItem);
    }, 600);
  };

  const scanModes = [
    { id: 'document' as ScanMode, label: 'Document', icon: FileText },
    { id: 'receipt' as ScanMode, label: 'Receipt', icon: Receipt },
    { id: 'school_notes' as ScanMode, label: 'School Notes', icon: GraduationCap },
    { id: 'handwriting' as ScanMode, label: 'Handwriting', icon: BookOpen },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
            <Camera className="w-6 h-6 text-rose-500" />
            <span>Camera & Information Scanner</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Phase 5: Turn your camera into an AI information scanner with OCR & auto-summary
          </p>
        </div>

        <div className="flex items-center gap-2">
          {scanModes.map((mode) => {
            const Icon = mode.icon;
            const isActive = scanMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => setScanMode(mode.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{mode.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Camera / File Viewport */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
          <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-4/3 flex items-center justify-center border border-slate-800">
            {isLiveCamera ? (
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            ) : capturedImage ? (
              <img
                src={capturedImage}
                alt="Captured document"
                className={`w-full h-full object-contain ${
                  filterMode === 'high_contrast'
                    ? 'contrast-150 grayscale'
                    : filterMode === 'grayscale'
                    ? 'grayscale'
                    : ''
                }`}
              />
            ) : (
              <div className="text-center p-6 space-y-3">
                <Camera className="w-12 h-12 text-slate-600 mx-auto" />
                <p className="text-xs font-medium text-slate-400">
                  No scan captured yet. Start live camera or choose a photo.
                </p>
              </div>
            )}

            {/* Readability filter badges */}
            {capturedImage && (
              <div className="absolute top-3 right-3 flex items-center gap-1 bg-slate-900/80 backdrop-blur-md p-1 rounded-xl text-[10px] text-white">
                <button
                  onClick={() => setFilterMode('normal')}
                  className={`px-2 py-1 rounded-lg ${filterMode === 'normal' ? 'bg-indigo-600' : ''}`}
                >
                  Original
                </button>
                <button
                  onClick={() => setFilterMode('high_contrast')}
                  className={`px-2 py-1 rounded-lg ${filterMode === 'high_contrast' ? 'bg-indigo-600' : ''}`}
                >
                  Document B&W
                </button>
              </div>
            )}
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              {!isLiveCamera ? (
                <button
                  onClick={startCamera}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs"
                >
                  <Camera className="w-4 h-4" />
                  <span>Start Camera</span>
                </button>
              ) : (
                <button
                  onClick={captureFrame}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs animate-pulse"
                >
                  <Check className="w-4 h-4" />
                  <span>Capture Scan</span>
                </button>
              )}

              <label className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>Upload File</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {capturedImage && (
              <button
                onClick={() => runOcr(capturedImage)}
                disabled={isProcessing}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
                <span>Re-Analyze OCR</span>
              </button>
            )}
          </div>
        </div>

        {/* Right: AI OCR Results & One-Click Save */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-2xs space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-xs">
                  AI
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Extracted Intelligence</h3>
              </div>
              {isProcessing && (
                <div className="flex items-center gap-1.5 text-xs text-rose-600 font-bold">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Reading document...</span>
                </div>
              )}
            </div>

            {!capturedImage ? (
              <div className="py-16 text-center text-slate-400 space-y-2">
                <FileText className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs">Take or upload a photo to extract text, title, and tags</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Detected Document Title
                  </label>
                  <input
                    type="text"
                    value={suggestedTitle}
                    onChange={(e) => setSuggestedTitle(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-bold text-slate-900"
                  />
                </div>

                {summary && (
                  <div className="p-3 rounded-xl bg-purple-50/70 border border-purple-100 text-xs text-purple-950 space-y-1">
                    <span className="font-bold flex items-center gap-1 text-purple-900">
                      <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                      AI Document Summary
                    </span>
                    <p className="leading-relaxed">{summary}</p>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Extracted Text / OCR
                    </label>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(extractedText);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      {copied ? 'Copied!' : 'Copy Text'}
                    </button>
                  </div>
                  <textarea
                    rows={7}
                    value={extractedText}
                    onChange={(e) => setExtractedText(e.target.value)}
                    placeholder="OCR text will appear here..."
                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs text-slate-800 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {tags.map((t, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium text-[11px]"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {capturedImage && (
            <div className="pt-3 border-t border-slate-200">
              <button
                onClick={handleSaveToLifebox}
                disabled={isProcessing || savedSuccess}
                className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-emerald-600 text-white font-bold text-xs sm:text-sm shadow-md transition-all active:scale-98 flex items-center justify-center gap-2"
              >
                {savedSuccess ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Saved to LIFEBOX! Opening...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Save Scanned Document to LIFEBOX</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
