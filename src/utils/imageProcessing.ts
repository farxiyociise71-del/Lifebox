import { jsPDF } from 'jspdf';
import { CropInfo, ScanPage } from '../types';

export interface ProcessOptions {
  rotation?: number; // 0, 90, 180, 270
  brightness?: number; // -50 to +50
  contrast?: number; // -50 to +50
  filter?: 'original' | 'grayscale' | 'bw_document' | 'high_contrast';
  crop?: CropInfo;
}

/**
 * Loads an image from a Data URL or Blob URL into an HTMLImageElement
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('Failed to load image for processing: ' + e));
    img.src = src;
  });
}

/**
 * Applies rotation, crop, brightness, contrast, and document enhancement filters via HTML5 Canvas
 * Keeps original intact and returns the newly rendered JPEG data URL.
 */
export async function applyImageFilters(
  imageSrc: string,
  options: ProcessOptions = {}
): Promise<string> {
  const img = await loadImage(imageSrc);

  const rotation = (options.rotation || 0) % 360;
  const brightness = options.brightness || 0;
  const contrast = options.contrast || 0;
  const filter = options.filter || 'original';
  const crop = options.crop;

  // Determine post-rotation dimensions
  const is90or270 = rotation === 90 || rotation === 270;
  const srcW = is90or270 ? img.naturalHeight : img.naturalWidth;
  const srcH = is90or270 ? img.naturalWidth : img.naturalHeight;

  // Intermediate canvas for rotation
  const rotCanvas = document.createElement('canvas');
  rotCanvas.width = srcW;
  rotCanvas.height = srcH;
  const rotCtx = rotCanvas.getContext('2d');
  if (!rotCtx) throw new Error('Canvas 2D context unavailable');

  rotCtx.translate(srcW / 2, srcH / 2);
  rotCtx.rotate((rotation * Math.PI) / 180);
  rotCtx.drawImage(
    img,
    -img.naturalWidth / 2,
    -img.naturalHeight / 2,
    img.naturalWidth,
    img.naturalHeight
  );

  // Determine crop bounds
  let finalX = 0;
  let finalY = 0;
  let finalW = srcW;
  let finalH = srcH;

  if (crop && crop.width > 10 && crop.height > 10) {
    finalX = Math.max(0, Math.min(crop.x, srcW - 10));
    finalY = Math.max(0, Math.min(crop.y, srcH - 10));
    finalW = Math.min(crop.width, srcW - finalX);
    finalH = Math.min(crop.height, srcH - finalY);
  }

  // Final rendering canvas
  const canvas = document.createElement('canvas');
  canvas.width = finalW;
  canvas.height = finalH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  // Draw cropped section from rotated canvas
  ctx.drawImage(rotCanvas, finalX, finalY, finalW, finalH, 0, 0, finalW, finalH);

  // Apply pixel manipulation filters if needed
  if (brightness !== 0 || contrast !== 0 || filter !== 'original') {
    const imgData = ctx.getImageData(0, 0, finalW, finalH);
    const data = imgData.data;

    // Contrast factor: contrast is in [-50, 50]
    // factor formula: (259 * (contrast + 255)) / (255 * (259 - contrast))
    const cFactor =
      contrast !== 0
        ? (259 * (contrast * 2.55 + 255)) / (255 * (259 - contrast * 2.55))
        : 1;

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      // 1. Brightness adjustment
      if (brightness !== 0) {
        const bOffset = brightness * 2.55;
        r += bOffset;
        g += bOffset;
        b += bOffset;
      }

      // 2. Contrast adjustment
      if (contrast !== 0) {
        r = cFactor * (r - 128) + 128;
        g = cFactor * (g - 128) + 128;
        b = cFactor * (b - 128) + 128;
      }

      // 3. Filter mode
      if (filter === 'grayscale') {
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        r = gray;
        g = gray;
        b = gray;
      } else if (filter === 'bw_document') {
        // Document enhancement: adaptive-like high-contrast threshold for sharp black text on white page
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        const threshold = 135;
        const bw = gray > threshold ? 255 : Math.max(0, gray * 0.4);
        r = bw;
        g = bw;
        b = bw;
      } else if (filter === 'high_contrast') {
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        const amplified = (gray - 128) * 1.5 + 128;
        r = Math.min(255, Math.max(0, amplified));
        g = r;
        b = r;
      }

      data[i] = Math.min(255, Math.max(0, r));
      data[i + 1] = Math.min(255, Math.max(0, g));
      data[i + 2] = Math.min(255, Math.max(0, b));
    }

    ctx.putImageData(imgData, 0, 0);
  }

  return canvas.toDataURL('image/jpeg', 0.9);
}

/**
 * Resizes/compresses image appropriately to optimize performance
 * while keeping typography sharp for OCR & Gemini processing.
 */
export async function compressScanImage(
  dataUrl: string,
  maxWidth = 1600,
  maxHeight = 2000,
  quality = 0.88
): Promise<string> {
  const img = await loadImage(dataUrl);
  let { width, height } = img;

  if (width <= maxWidth && height <= maxHeight && dataUrl.length < 1.5 * 1024 * 1024) {
    return dataUrl;
  }

  if (width > maxWidth) {
    height = Math.round((height * maxWidth) / width);
    width = maxWidth;
  }
  if (height > maxHeight) {
    width = Math.round((width * maxHeight) / height);
    height = maxHeight;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;

  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Combines multiple scan pages into a clean, downloadable multi-page PDF
 */
export async function generatePdfFromPages(pages: ScanPage[], title: string): Promise<Blob> {
  if (!pages || pages.length === 0) {
    throw new Error('No pages provided to generate PDF');
  }

  // Create A4 PDF (portrait default: 210 x 297 mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 0; i < pages.length; i++) {
    if (i > 0) {
      doc.addPage();
    }

    const page = pages[i];
    const imgData = page.image;
    const img = await loadImage(imgData);

    // Calculate aspect fit within A4 margins (10mm padding)
    const margin = 10;
    const maxW = pageWidth - margin * 2;
    const maxH = pageHeight - margin * 2;

    const imgAspect = img.naturalWidth / img.naturalHeight;
    let renderW = maxW;
    let renderH = maxW / imgAspect;

    if (renderH > maxH) {
      renderH = maxH;
      renderW = maxH * imgAspect;
    }

    const posX = (pageWidth - renderW) / 2;
    const posY = (pageHeight - renderH) / 2;

    doc.addImage(imgData, 'JPEG', posX, posY, renderW, renderH, undefined, 'FAST');

    // Page footer label
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(
      `${title || 'LIFEBOX Scan'} • Page ${i + 1} of ${pages.length}`,
      pageWidth / 2,
      pageHeight - 4,
      { align: 'center' }
    );
  }

  return doc.output('blob');
}
