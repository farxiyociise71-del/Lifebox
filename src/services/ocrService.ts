import { OCRResult, OCRBlock } from '../types';
import { createWorker } from 'tesseract.js';

let tesseractWorkerPromise: Promise<any> | null = null;

async function getTesseractWorker() {
  if (!tesseractWorkerPromise) {
    tesseractWorkerPromise = (async () => {
      const worker = await createWorker('eng');
      return worker;
    })();
  }
  return tesseractWorkerPromise;
}

export const OcrService = {
  /**
   * Performs genuine OCR on an image data URL / base64 string.
   * Leverages server-side multimodal OCR first for highest accuracy,
   * with client-side Tesseract.js fallback.
   * Returns exact text, confidence, and bounding/line blocks.
   * Never invents text.
   */
  async recognize(
    imageBase64: string,
    mimeType = 'image/jpeg',
    onProgress?: (progress: number, statusText: string) => void
  ): Promise<OCRResult> {
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      throw new Error('Invalid image data provided for OCR');
    }

    onProgress?.(15, 'Sending image to OCR engine...');

    // 1. Try server-side OCR endpoint first
    try {
      const response = await fetch('/api/scans/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mimeType }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data && typeof data.text === 'string') {
          onProgress?.(100, 'OCR text extraction complete');
          return {
            text: data.text.trim(),
            confidence: typeof data.confidence === 'number' ? data.confidence : 90,
            blocks: Array.isArray(data.blocks) ? data.blocks : [],
          };
        }
      }
    } catch (serverErr) {
      console.warn('Server OCR endpoint unavailable, falling back to local Tesseract OCR engine:', serverErr);
    }

    // 2. Client-side Tesseract.js OCR engine
    onProgress?.(35, 'Initializing local Tesseract OCR engine...');
    try {
      const worker = await getTesseractWorker();
      onProgress?.(60, 'Reading text from image characters...');

      const result = await worker.recognize(imageBase64);
      onProgress?.(95, 'Structuring OCR lines & blocks...');

      const blocks: OCRBlock[] = [];
      if (result.data && Array.isArray((result.data as any).lines)) {
        for (const line of (result.data as any).lines) {
          if (line.text && line.text.trim()) {
            blocks.push({
              text: line.text.trim(),
              confidence: Math.round(line.confidence || 80),
              bbox: line.bbox
                ? {
                    x0: line.bbox.x0,
                    y0: line.bbox.y0,
                    x1: line.bbox.x1,
                    y1: line.bbox.y1,
                  }
                : undefined,
            });
          }
        }
      }

      const text = (result.data?.text || '').trim();
      const confidence = Math.round(result.data?.confidence || 0);

      onProgress?.(100, 'OCR complete');

      return {
        text,
        confidence,
        blocks,
      };
    } catch (err: any) {
      console.error('OCR engine failed to recognize image:', err);
      throw new Error(
        err?.message ? `OCR Recognition failed: ${err.message}` : 'OCR Recognition failed on this image.'
      );
    }
  },

  /**
   * Scans a canvas or image for Barcode / QR code if supported by browser
   */
  async detectBarcodeOrQr(imageSrc: string): Promise<string | null> {
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        const BarcodeDetectorClass = (window as any).BarcodeDetector;
        const formats = await BarcodeDetectorClass.getSupportedFormats();
        const detector = new BarcodeDetectorClass({ formats });

        const img = new Image();
        img.src = imageSrc;
        await new Promise((res) => (img.onload = res));

        const barcodes = await detector.detect(img);
        if (barcodes && barcodes.length > 0) {
          return barcodes[0].rawValue || barcodes[0].displayValue || null;
        }
      } catch (e) {
        console.warn('BarcodeDetector error:', e);
      }
    }
    return null;
  },
};
