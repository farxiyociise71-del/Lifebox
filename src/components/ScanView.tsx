import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  Upload,
  RotateCw,
  Sliders,
  Sparkles,
  Check,
  X,
  Trash2,
  Plus,
  ArrowRight,
  RefreshCw,
  Sun,
  Contrast as ContrastIcon,
  Filter,
  FileText,
  AlertCircle,
  Zap,
  ZapOff,
  SwitchCamera,
  Layers,
  Crop as CropIcon,
  CheckCircle,
} from 'lucide-react';
import { ScanPage, OCRResult, ScanAnalysis, ScannedDocument, CropInfo } from '../types';
import { applyImageFilters, compressScanImage } from '../utils/imageProcessing';
import { OcrService } from '../services/ocrService';
import { AiService } from '../services/ai';
import { ScanResultView } from './ScanResultView';

interface ScanViewProps {
  onClose?: () => void;
  onScanComplete?: (scan: ScannedDocument) => void;
  userToken?: string | null;
}

export const ScanView: React.FC<ScanViewProps> = ({ onClose, onScanComplete, userToken }) => {
  // Navigation mode within scan pipeline
  const [viewMode, setViewMode] = useState<'capture' | 'edit_page' | 'review'>('capture');

  // Camera & stream state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);

  // Multi-page document state
  const [pages, setPages] = useState<ScanPage[]>([]);
  const [editingPageIdx, setEditingPageIdx] = useState<number>(0);

  // Page image processing controls
  const [rotation, setRotation] = useState<number>(0);
  const [brightness, setBrightness] = useState<number>(0);
  const [contrast, setContrast] = useState<number>(0);
  const [filterMode, setFilterMode] = useState<'original' | 'grayscale' | 'bw_document' | 'high_contrast'>('bw_document');
  const [isApplyingFilter, setIsApplyingFilter] = useState<boolean>(false);
  const [editorPreviewSrc, setEditorPreviewSrc] = useState<string>('');

  // OCR & AI Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<{ step: number; text: string }>({
    step: 0,
    text: '',
  });
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [analysisResult, setAnalysisResult] = useState<ScanAnalysis | null>(null);

  // 1. Initialize camera stream
  const startCamera = useCallback(
    async (deviceId?: string) => {
      setIsCameraLoading(true);
      setCameraError(null);

      // Stop previous stream
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Camera access not supported by this browser. Please use file upload.');
        }

        const constraints: MediaStreamConstraints = {
          audio: false,
          video: deviceId
            ? { deviceId: { exact: deviceId } }
            : {
                facingMode: { ideal: 'environment' },
                width: { ideal: 1920 },
                height: { ideal: 1080 },
              },
        };

        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        setStream(mediaStream);

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          await videoRef.current.play().catch(() => null);
        }

        // Check if torch/flashlight is supported
        const videoTrack = mediaStream.getVideoTracks()[0];
        if (videoTrack) {
          const capabilities = (videoTrack.getCapabilities && (videoTrack.getCapabilities() as any)) || {};
          setHasTorch(Boolean(capabilities.torch));
        }

        // List video input devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        setCameraDevices(videoInputs);
        if (videoTrack && !deviceId) {
          const activeSettings = videoTrack.getSettings();
          if (activeSettings.deviceId) {
            setSelectedCameraId(activeSettings.deviceId);
          }
        }
      } catch (err: any) {
        console.warn('Camera stream error:', err);
        setCameraError(
          err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
            ? 'Camera permission was denied. You can still scan documents by uploading photos or files below.'
            : err.message || 'Unable to access camera.'
        );
      } finally {
        setIsCameraLoading(false);
      }
    },
    [stream]
  );

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Toggle torch / flash
  const toggleTorch = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (track) {
      try {
        const nextState = !isTorchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextState }],
        });
        setIsTorchOn(nextState);
      } catch (e) {
        console.warn('Torch toggle not supported:', e);
      }
    }
  };

  // 2. Capture a page frame from camera
  const captureFrame = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const rawDataUrl = canvas.toDataURL('image/jpeg', 0.95);

    // Apply clean document enhancement by default
    const enhanced = await applyImageFilters(rawDataUrl, { filter: 'bw_document' });
    const compressed = await compressScanImage(enhanced);

    const newPage: ScanPage = {
      id: 'page-' + Date.now() + '-' + pages.length,
      image: compressed,
      originalImage: rawDataUrl,
      pageNumber: pages.length + 1,
      rotation: 0,
      brightness: 0,
      contrast: 0,
      filter: 'bw_document',
    };

    setPages((prev) => [...prev, newPage]);
  };

  // 3. Fallback file upload & drag-drop
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
        continue;
      }

      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;
        if (dataUrl) {
          const enhanced = await applyImageFilters(dataUrl, { filter: 'bw_document' });
          const compressed = await compressScanImage(enhanced);

          const newPage: ScanPage = {
            id: 'page-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
            image: compressed,
            originalImage: dataUrl,
            pageNumber: pages.length + 1,
            rotation: 0,
            brightness: 0,
            contrast: 0,
            filter: 'bw_document',
          };

          setPages((prev) => [...prev, newPage]);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // 4. Open page editor
  const openPageEditor = (idx: number) => {
    const page = pages[idx];
    if (!page) return;
    setEditingPageIdx(idx);
    setRotation(page.rotation || 0);
    setBrightness(page.brightness || 0);
    setContrast(page.contrast || 0);
    setFilterMode((page.filter as any) || 'bw_document');
    setEditorPreviewSrc(page.image);
    setViewMode('edit_page');
  };

  // Apply edits to page in editor
  const handleApplyEditorChanges = async () => {
    const page = pages[editingPageIdx];
    if (!page) return;

    setIsApplyingFilter(true);
    try {
      const baseSrc = page.originalImage || page.image;
      const updatedImage = await applyImageFilters(baseSrc, {
        rotation,
        brightness,
        contrast,
        filter: filterMode,
      });

      const updatedPages = [...pages];
      updatedPages[editingPageIdx] = {
        ...page,
        image: updatedImage,
        rotation,
        brightness,
        contrast,
        filter: filterMode,
      };

      setPages(updatedPages);
      setViewMode('capture');
    } catch (e: any) {
      alert('Error enhancing image: ' + e.message);
    } finally {
      setIsApplyingFilter(false);
    }
  };

  // Rotate 90 deg clockwise
  const handleRotatePage = async (idx: number) => {
    const page = pages[idx];
    if (!page) return;
    const newRot = ((page.rotation || 0) + 90) % 360;
    const baseSrc = page.originalImage || page.image;
    const rotated = await applyImageFilters(baseSrc, {
      rotation: newRot,
      brightness: page.brightness,
      contrast: page.contrast,
      filter: page.filter as any,
    });

    const updated = [...pages];
    updated[idx] = {
      ...page,
      image: rotated,
      rotation: newRot,
    };
    setPages(updated);
  };

  // Delete page
  const handleDeletePage = (idx: number) => {
    const updated = pages.filter((_, i) => i !== idx).map((p, i) => ({ ...p, pageNumber: i + 1 }));
    setPages(updated);
  };

  // 5. Run full pipeline: OCR -> Document Understanding -> Review
  const handleRunOcrAndAnalyze = async () => {
    if (pages.length === 0) {
      alert('Please capture or upload at least one page to scan.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisProgress({ step: 1, text: 'Extracting optical characters via OCR engine...' });

    try {
      // 1. Run real OCR across page(s)
      const ocrResults: OCRResult[] = [];
      for (let i = 0; i < pages.length; i++) {
        setAnalysisProgress({
          step: 1,
          text: `Reading text from Page ${i + 1} of ${pages.length}...`,
        });

        const pageRes = await OcrService.recognize(pages[i].image, 'image/jpeg', (prog, msg) => {
          setAnalysisProgress({ step: 1, text: `Page ${i + 1}: ${msg}` });
        });
        ocrResults.push(pageRes);
      }

      // Combine text
      const combinedText = ocrResults
        .map((r, i) => (pages.length > 1 ? `[Page ${i + 1}]\n${r.text}` : r.text))
        .join('\n\n')
        .trim();

      const combinedBlocks = ocrResults.flatMap((r) => r.blocks || []);
      const avgConfidence = Math.round(
        ocrResults.reduce((acc, r) => acc + (r.confidence || 80), 0) / (ocrResults.length || 1)
      );

      const finalOcr: OCRResult = {
        text: combinedText,
        confidence: avgConfidence,
        blocks: combinedBlocks,
      };
      setOcrResult(finalOcr);

      // 2. Gemini Document Understanding
      setAnalysisProgress({
        step: 2,
        text: 'Analyzing document structure, extracting events & action items...',
      });

      const imagesToAnalyze = pages.map((p) => p.image);
      const analysis = await AiService.analyzeScannedDocument(imagesToAnalyze, combinedText);
      setAnalysisResult(analysis);

      // 3. Move to review screen
      setViewMode('review');
    } catch (err: any) {
      console.error('Scan processing error:', err);
      alert('Document scan analysis encountered an issue: ' + (err.message || 'Unknown error'));
    } finally {
      setIsAnalyzing(false);
    }
  };

  // If in Review Mode, render the interactive ScanResultView
  if (viewMode === 'review' && analysisResult && ocrResult) {
    return (
      <ScanResultView
        scanPages={pages}
        analysis={analysisResult}
        ocrResult={ocrResult}
        userToken={userToken}
        onRetake={() => setViewMode('capture')}
        onCancel={() => {
          if (onClose) onClose();
          else setViewMode('capture');
        }}
        onSaveSuccess={(savedScan) => {
          if (onScanComplete) onScanComplete(savedScan);
          if (onClose) onClose();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-neutral-950 text-neutral-100 overflow-hidden select-none">
      {/* Top Header */}
      <div className="bg-neutral-900 border-b border-neutral-800 px-4 py-3 flex items-center justify-between z-20">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-black shadow-xs">
            <Camera className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white">LIFEBOX Scanner</h1>
            <p className="text-[11px] text-neutral-400">
              {pages.length} {pages.length === 1 ? 'page' : 'pages'} in current scan
            </p>
          </div>
        </div>

        {/* Camera Selector & Flash Controls */}
        <div className="flex items-center space-x-2">
          {hasTorch && (
            <button
              onClick={toggleTorch}
              className={`p-2 rounded-lg border transition-colors ${
                isTorchOn
                  ? 'bg-neutral-100 text-black border-white'
                  : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-white'
              }`}
              title="Toggle Flash"
            >
              {isTorchOn ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
            </button>
          )}

          {cameraDevices.length > 1 && (
            <select
              value={selectedCameraId}
              onChange={(e) => {
                setSelectedCameraId(e.target.value);
                startCamera(e.target.value);
              }}
              className="bg-neutral-800 text-neutral-200 border border-neutral-700 text-xs rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-neutral-400"
            >
              {cameraDevices.map((dev, idx) => (
                <option key={dev.deviceId || idx} value={dev.deviceId}>
                  {dev.label || `Camera ${idx + 1}`}
                </option>
              ))}
            </select>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Viewport */}
      {viewMode === 'capture' && (
        <div className="flex-1 relative flex flex-col md:flex-row overflow-hidden">
          {/* Camera Viewfinder / Upload Dropzone */}
          <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
            {cameraError ? (
              /* Fallback File Upload Area */
              <div className="p-8 text-center max-w-md">
                <div className="w-16 h-16 bg-neutral-900 border border-neutral-800 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white">
                  <Upload className="w-8 h-8" />
                </div>
                <h3 className="text-base font-semibold text-white mb-2">Camera Unavailable</h3>
                <p className="text-xs text-neutral-400 mb-6 leading-relaxed">{cameraError}</p>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => handleFileUpload(e.target.files)}
                  accept="image/*,.pdf"
                  multiple
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-5 py-2.5 bg-white hover:bg-neutral-200 text-black text-xs font-semibold rounded-xl shadow-lg transition-all"
                >
                  Choose Photos or Document Files
                </button>
              </div>
            ) : (
              /* Live Camera Stream with Document Alignment Guides */
              <div className="relative w-full h-full flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover md:object-contain"
                />

                {/* Alignment Crosshairs & Overlay */}
                <div className="absolute inset-8 sm:inset-16 border-2 border-white/60 rounded-2xl pointer-events-none flex flex-col justify-between p-4 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                  <div className="flex justify-between">
                    <div className="w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-lg" />
                    <div className="w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-lg" />
                  </div>
                  <div className="text-center">
                    <span className="bg-black/80 backdrop-blur-xs text-[11px] text-neutral-200 font-medium px-3 py-1 rounded-full border border-neutral-700">
                      Align document inside border
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <div className="w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-lg" />
                    <div className="w-6 h-6 border-b-4 border-r-4 border-white rounded-br-lg" />
                  </div>
                </div>

                {/* Live Shutter Button Overlay */}
                <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center space-x-6 z-10">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-3 bg-neutral-900/80 hover:bg-neutral-800 text-neutral-200 rounded-full border border-neutral-700 transition-transform active:scale-95"
                    title="Upload image file"
                  >
                    <Upload className="w-5 h-5" />
                  </button>

                  <button
                    onClick={captureFrame}
                    className="w-18 h-18 rounded-full border-4 border-white bg-black hover:bg-neutral-900 flex items-center justify-center shadow-xl transition-transform active:scale-90"
                    title="Capture Document Page"
                  >
                    <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center">
                      <Camera className="w-6 h-6 text-black" />
                    </div>
                  </button>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => handleFileUpload(e.target.files)}
                    accept="image/*,.pdf"
                    multiple
                    className="hidden"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Right/Bottom Multi-page Tray */}
          <div className="w-full md:w-80 bg-neutral-900 border-t md:border-t-0 md:border-l border-neutral-800 flex flex-col h-64 md:h-auto">
            <div className="p-3 border-b border-neutral-800 flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-white" />
                Captured Pages ({pages.length})
              </span>
              {pages.length > 0 && (
                <button
                  onClick={() => setPages([])}
                  className="text-[11px] text-neutral-400 hover:text-white"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Pages Thumbnail List */}
            <div className="flex-1 p-3 overflow-y-auto space-y-3">
              {pages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 text-neutral-500">
                  <FileText className="w-8 h-8 text-neutral-700 mb-2" />
                  <p className="text-xs">No pages captured yet.</p>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    Click the shutter or upload files to add pages.
                  </p>
                </div>
              ) : (
                pages.map((page, idx) => (
                  <div
                    key={page.id}
                    className="bg-neutral-800/80 border border-neutral-700/80 rounded-xl p-2 flex items-center space-x-3 group hover:border-neutral-500 transition-all"
                  >
                    <div
                      onClick={() => openPageEditor(idx)}
                      className="relative w-14 h-18 bg-black rounded-lg overflow-hidden shrink-0 cursor-pointer border border-neutral-700"
                    >
                      <img src={page.image} alt={`Page ${idx + 1}`} className="w-full h-full object-cover" />
                      <span className="absolute bottom-1 right-1 bg-black/70 text-[9px] text-white px-1 rounded">
                        {idx + 1}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-neutral-200">Page {idx + 1}</div>
                      <div className="text-[10px] text-neutral-400 capitalize">
                        {page.filter?.replace('_', ' ') || 'Enhanced'} • {page.rotation || 0}°
                      </div>
                      <div className="flex items-center space-x-1 mt-2">
                        <button
                          onClick={() => openPageEditor(idx)}
                          className="px-2 py-1 bg-neutral-700 hover:bg-neutral-600 text-[10px] font-medium text-white rounded transition-colors"
                        >
                          Edit / Filter
                        </button>
                        <button
                          onClick={() => handleRotatePage(idx)}
                          className="p-1 text-neutral-400 hover:text-white hover:bg-neutral-700 rounded transition-colors"
                          title="Rotate 90°"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeletePage(idx)}
                          className="p-1 text-neutral-400 hover:text-white hover:bg-neutral-700 rounded transition-colors"
                          title="Delete Page"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Run OCR & Analysis Action Bar */}
            <div className="p-3 border-t border-neutral-800 bg-neutral-900/90">
              <button
                onClick={handleRunOcrAndAnalyze}
                disabled={pages.length === 0 || isAnalyzing}
                className="w-full py-2.5 bg-white hover:bg-neutral-200 disabled:opacity-50 text-black text-xs font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-black" />
                    <span>Finish & Analyze Scan ({pages.length})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page Image Processing & Enhancement Editor View */}
      {viewMode === 'edit_page' && pages[editingPageIdx] && (
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-black">
          {/* Main Preview */}
          <div className="flex-1 relative flex items-center justify-center p-4">
            <div className="relative max-w-full max-h-[75vh] aspect-3/4 bg-neutral-900 rounded-xl overflow-hidden border border-neutral-800 flex items-center justify-center shadow-2xl">
              <img
                src={editorPreviewSrc}
                alt="Editing Preview"
                className="w-full h-full object-contain"
              />
            </div>
          </div>

          {/* Tools Sidebar */}
          <div className="w-full md:w-80 bg-neutral-900 border-t md:border-t-0 md:border-l border-neutral-800 p-5 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-white" />
                  Enhance Page {editingPageIdx + 1}
                </h3>
                <button
                  onClick={() => setViewMode('capture')}
                  className="text-xs text-neutral-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>

              {/* Quick Rotation */}
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-2">Orientation</label>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      const next = (rotation + 90) % 360;
                      setRotation(next);
                      applyImageFilters(pages[editingPageIdx].originalImage || pages[editingPageIdx].image, {
                        rotation: next,
                        brightness,
                        contrast,
                        filter: filterMode,
                      }).then(setEditorPreviewSrc);
                    }}
                    className="flex-1 py-2 bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-200 rounded-lg flex items-center justify-center gap-1.5 border border-neutral-700"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    Rotate 90° ({rotation}°)
                  </button>
                </div>
              </div>

              {/* Document Filter Modes */}
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-2">Enhancement Filter</label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { id: 'bw_document', label: 'B&W Document' },
                    { id: 'grayscale', label: 'Grayscale' },
                    { id: 'high_contrast', label: 'High Contrast' },
                    { id: 'original', label: 'Original' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => {
                        setFilterMode(f.id as any);
                        applyImageFilters(pages[editingPageIdx].originalImage || pages[editingPageIdx].image, {
                          rotation,
                          brightness,
                          contrast,
                          filter: f.id as any,
                        }).then(setEditorPreviewSrc);
                      }}
                      className={`p-2 rounded-lg border text-left font-medium transition-colors ${
                        filterMode === f.id
                          ? 'bg-white text-black border-white'
                          : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-700'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Brightness slider */}
              <div>
                <div className="flex justify-between text-xs text-neutral-400 mb-1">
                  <span className="flex items-center gap-1">
                    <Sun className="w-3.5 h-3.5" /> Brightness
                  </span>
                  <span>{brightness}</span>
                </div>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  value={brightness}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setBrightness(val);
                    applyImageFilters(pages[editingPageIdx].originalImage || pages[editingPageIdx].image, {
                      rotation,
                      brightness: val,
                      contrast,
                      filter: filterMode,
                    }).then(setEditorPreviewSrc);
                  }}
                  className="w-full accent-white cursor-pointer"
                />
              </div>

              {/* Contrast slider */}
              <div>
                <div className="flex justify-between text-xs text-neutral-400 mb-1">
                  <span className="flex items-center gap-1">
                    <ContrastIcon className="w-3.5 h-3.5" /> Contrast
                  </span>
                  <span>{contrast}</span>
                </div>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  value={contrast}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setContrast(val);
                    applyImageFilters(pages[editingPageIdx].originalImage || pages[editingPageIdx].image, {
                      rotation,
                      brightness,
                      contrast: val,
                      filter: filterMode,
                    }).then(setEditorPreviewSrc);
                  }}
                  className="w-full accent-white cursor-pointer"
                />
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-6 flex space-x-2">
              <button
                onClick={() => setViewMode('capture')}
                className="flex-1 py-2 bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-300 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyEditorChanges}
                disabled={isApplyingFilter}
                className="flex-1 py-2 bg-white hover:bg-neutral-200 text-xs font-semibold text-black rounded-xl shadow-md transition-all flex items-center justify-center gap-1"
              >
                <Check className="w-4 h-4" />
                <span>Apply Edits</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OCR & AI Analysis Progress Overlay */}
      {isAnalyzing && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl space-y-4">
            <div className="relative w-16 h-16 mx-auto">
              <div className="w-16 h-16 rounded-full border-4 border-neutral-700 border-t-white animate-spin" />
              <Sparkles className="w-6 h-6 text-white absolute inset-0 m-auto animate-pulse" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white">Intelligent Document Processing</h3>
              <p className="text-xs text-neutral-400 mt-1 min-h-[32px]">{analysisProgress.text}</p>
            </div>

            <div className="w-full bg-neutral-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-white h-full transition-all duration-300"
                style={{ width: analysisProgress.step === 1 ? '50%' : '90%' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
