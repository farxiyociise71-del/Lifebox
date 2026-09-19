import { Router, Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { dataStore, StoredScannedDocument, StoredItem } from '../data/store';
import { requireAuth, optionalAuth } from '../security/authMiddleware';
import { scrubPII, sanitizeString, validateUploadedFile } from '../security/sanitizer';
import { createRateLimiter } from '../security/rateLimit';

export const scanRouter = Router();

const scanRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 60,
  message: 'Scan service rate limit exceeded. Please wait a moment before sending more scan requests.',
});

scanRouter.use(scanRateLimiter);

let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

/**
 * 1. Multimodal OCR endpoint
 * Accepts imageBase64 and returns exact text, confidence, and line blocks.
 * Never invents text.
 */
scanRouter.post('/ocr', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body;
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'imageBase64 is required' });
    }

    const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    const fileValidation = validateUploadedFile(buffer, mimeType, 'scan_page.jpg', 15 * 1024 * 1024);
    if (!fileValidation.valid) {
      return res.status(400).json({ error: fileValidation.error || 'Invalid file payload' });
    }

    const ai = getGenAI();
    if (!ai) {
      return res.status(503).json({
        error: 'AI service unavailable. Local OCR engine fallback will be used.',
        text: '',
        confidence: 0,
        blocks: [],
      });
    }

    const prompt = `Perform strict, high-accuracy Optical Character Recognition (OCR) on this document image.
Read every line of typed, printed, or handwritten text accurately.
Do NOT summarize, invent, hallucinate, or interpret text that is not visible in the image.

Output valid JSON matching this schema:
{
  "text": "Exact transcribed text maintaining paragraphs and line breaks...",
  "confidence": 95,
  "blocks": [
    { "text": "First line or section of text", "confidence": 96 },
    { "text": "Second line or section of text", "confidence": 94 }
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: fileValidation.safeMimeType || 'image/jpeg',
              data: cleanBase64,
            },
          },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text || '{}';
    let parsed: any = {};
    try {
      parsed = JSON.parse(responseText);
    } catch {
      parsed = { text: responseText, confidence: 85, blocks: [] };
    }

    let ocrText = typeof parsed.text === 'string' ? parsed.text : '';
    if (ocrText) {
      const { scrubbed } = scrubPII(ocrText);
      ocrText = scrubbed;
    }

    return res.json({
      text: ocrText,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 90,
      blocks: Array.isArray(parsed.blocks) ? parsed.blocks : [],
    });
  } catch (err: any) {
    console.error('Scan OCR error:', err);
    return res.status(500).json({
      error: 'OCR extraction failed',
      text: '',
      confidence: 0,
      blocks: [],
    });
  }
});

/**
 * 2. Gemini Document Understanding endpoint
 * Extracts structured document understanding: title, summary, dates, tasks, events, reminders, people, locations.
 * Follows strict DO NOT INVENT INFORMATION constraint.
 */
scanRouter.post('/analyze', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { images = [], ocrText = '', hint = 'document' } = req.body;

    const ai = getGenAI();
    if (!ai) {
      return res.status(503).json({ error: 'Gemini service not configured' });
    }

    const parts: any[] = [];

    // Add up to 3 compressed images to prevent token overload
    if (Array.isArray(images)) {
      for (const img of images.slice(0, 3)) {
        if (typeof img === 'string' && img.length > 50) {
          const clean = img.replace(/^data:[^;]+;base64,/, '');
          parts.push({
            inlineData: {
              mimeType: 'image/jpeg',
              data: clean,
            },
          });
        }
      }
    }

    const prompt = `You are the LIFEBOX Intelligent Document Analyzer.
Analyze the provided document scan and OCR text.

CRITICAL INSTRUCTIONS:
- DO NOT INVENT OR HALLUCINATE INFORMATION.
- If the document does NOT state an event location, do NOT make one up. Leave location empty or omit it.
- If a date, time, or name is ambiguous or inferred with low certainty, set "uncertain": true.
- Extract any concrete tasks with due dates if explicitly mentioned (e.g. "Submit science assignment by September 25").
- Extract any reminders/deadlines (e.g. "Pay fee before October 1").
- Extract any calendar events (e.g. "Science examination, September 25, 9:00 AM").
- Extract names of people, locations, or organizations only if genuinely present in the document.

OCR text available from document:
"""
${(ocrText || '').slice(0, 8000)}
"""

Respond in strict JSON with this schema:
{
  "documentType": "school_document | receipt | invoice | contract | id_card | medical | letter | note | other",
  "title": "Clear concise document title (max 7 words)",
  "summary": "2-3 sentence accurate summary of the content",
  "dates": [
    { "date": "2026-09-25", "context": "Science examination date", "uncertain": false }
  ],
  "tasks": [
    { "title": "Submit science assignment", "dueDate": "2026-09-25", "priority": "high", "description": "Assignment submission details", "uncertain": false }
  ],
  "events": [
    { "title": "Science examination", "date": "2026-09-25", "time": "09:00", "location": "", "description": "Official exam sitting", "uncertain": false }
  ],
  "reminders": [
    { "title": "Pay school fee", "dueDate": "2026-10-01", "dueTime": "17:00", "notes": "Fee payment deadline", "uncertain": false }
  ],
  "people": ["Dr. Smith"],
  "locations": ["Room 402"],
  "organizations": ["Lincoln High School"],
  "tags": ["science", "exam", "school"],
  "entities": [
    { "type": "DATE", "value": "2026-09-25", "confidence": 0.95 },
    { "type": "TIME", "value": "09:00 AM", "confidence": 0.92 }
  ]
}`;

    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts,
      },
      config: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text || '{}';
    let parsed: any = {};
    try {
      parsed = JSON.parse(responseText);
    } catch {
      parsed = {
        documentType: hint,
        title: 'Scanned Document',
        summary: 'Scanned document processed into LIFEBOX.',
        dates: [],
        tasks: [],
        events: [],
        reminders: [],
        people: [],
        locations: [],
        organizations: [],
        tags: ['scan', hint],
      };
    }

    return res.json(parsed);
  } catch (err: any) {
    console.error('Scan analysis error:', err);
    return res.status(500).json({ error: 'Failed to analyze document with AI' });
  }
});

/**
 * 3. Create and store a new scan
 * Enforces authenticated session ownership.
 * Also synchronizes to user items so it shows up in DocumentsView, OmniSearch, and Ask My Stuff!
 */
scanRouter.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const {
      title,
      pages = [],
      extractedText = '',
      documentType = 'document',
      tags = [],
      analysis,
      originalFileReference,
      processedFileReference,
      status = 'processed',
    } = req.body;

    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'Title is required' });
    }

    const scanId = 'scan-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
    const safeTitle = sanitizeString(title, 150);
    const safeDocType = sanitizeString(documentType, 50) || 'document';
    const safeTags = Array.isArray(tags)
      ? tags.map((t: any) => sanitizeString(String(t), 30)).filter(Boolean)
      : ['scan'];

    const storedScan: StoredScannedDocument = {
      id: scanId,
      userId: user.id,
      title: safeTitle,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      pages: Array.isArray(pages) ? pages : [],
      extractedText: sanitizeString(extractedText, 50000),
      documentType: safeDocType,
      tags: safeTags,
      analysis: analysis || undefined,
      originalFileReference: originalFileReference ? sanitizeString(originalFileReference, 300) : undefined,
      processedFileReference: processedFileReference ? sanitizeString(processedFileReference, 300) : undefined,
      status: status || 'processed',
    };

    dataStore.saveScan(storedScan);

    // Synchronize to Lifebox StoredItem so DocumentsView, Global Search & Ask My Stuff see it
    const firstPageImage = storedScan.pages[0]?.image;
    const itemSync: StoredItem = {
      id: 'item-' + scanId,
      userId: user.id,
      title: safeTitle,
      type: 'document',
      category: safeDocType.includes('school') || safeDocType.includes('study') ? 'study' : safeDocType.includes('receipt') || safeDocType.includes('finance') ? 'finance' : 'personal',
      collectionIds: [],
      content: storedScan.analysis?.summary || storedScan.extractedText.slice(0, 500) || 'Scanned document stored in LIFEBOX.',
      mediaUrl: firstPageImage,
      mediaName: `${safeTitle}.pdf`,
      extractedText: storedScan.extractedText,
      summary: storedScan.analysis?.summary,
      tags: Array.from(new Set(['scan', safeDocType, ...safeTags])),
      pinned: false,
      favorite: false,
      locked: false,
      isTrash: false,
      createdAt: storedScan.createdAt,
      updatedAt: storedScan.updatedAt,
    };

    dataStore.saveItem(itemSync);

    return res.status(201).json({
      scan: storedScan,
      item: itemSync,
    });
  } catch (err: any) {
    console.error('Error saving scan:', err);
    return res.status(500).json({ error: 'Failed to save scanned document' });
  }
});

/**
 * 4. List scans for authenticated user
 */
scanRouter.get('/', requireAuth, (req: Request, res: Response) => {
  const user = req.user!;
  const scans = dataStore.getUserScans(user.id);
  return res.json({ scans });
});

/**
 * 5. Get a specific scan
 */
scanRouter.get('/:id', requireAuth, (req: Request, res: Response) => {
  const user = req.user!;
  const { id } = req.params;
  const scan = dataStore.getScanById(user.id, id);
  if (!scan) {
    return res.status(404).json({ error: 'Scanned document not found' });
  }
  return res.json({ scan });
});

/**
 * 6. Update scan metadata (rename, tags, status)
 */
scanRouter.patch('/:id', requireAuth, (req: Request, res: Response) => {
  const user = req.user!;
  const { id } = req.params;
  const { title, tags, status, documentType } = req.body;

  const updates: Partial<StoredScannedDocument> = {};
  if (title) updates.title = sanitizeString(title, 150);
  if (documentType) updates.documentType = sanitizeString(documentType, 50);
  if (status) updates.status = status;
  if (Array.isArray(tags)) {
    updates.tags = tags.map((t: any) => sanitizeString(String(t), 30)).filter(Boolean);
  }

  const updated = dataStore.updateScan(user.id, id, updates);
  if (!updated) {
    return res.status(404).json({ error: 'Scanned document not found' });
  }

  // Also update synced item if it exists
  const item = dataStore.getItemById(user.id, 'item-' + id);
  if (item) {
    if (updates.title) item.title = updates.title;
    if (updates.tags) item.tags = updates.tags;
    item.updatedAt = new Date().toISOString();
    dataStore.saveItem(item);
  }

  return res.json({ scan: updated });
});

/**
 * 7. Delete scan
 */
scanRouter.delete('/:id', requireAuth, (req: Request, res: Response) => {
  const user = req.user!;
  const { id } = req.params;

  const success = dataStore.deleteScan(user.id, id);
  if (!success) {
    return res.status(404).json({ error: 'Scanned document not found' });
  }

  // Also delete synced item
  dataStore.deleteItem(user.id, 'item-' + id, true);

  return res.json({ success: true, id });
});

/**
 * 8. User Confirmation Action: Create real Task from scan detection
 */
scanRouter.post('/:id/create-task', requireAuth, (req: Request, res: Response) => {
  const user = req.user!;
  const { id } = req.params;
  const { title, dueDate, priority = 'medium', description = '' } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Task title is required' });
  }

  const scan = dataStore.getScanById(user.id, id);

  const taskItem: StoredItem = {
    id: 'task-scan-' + Date.now(),
    userId: user.id,
    title: sanitizeString(title, 150),
    type: 'task',
    category: 'work',
    collectionIds: [],
    content: sanitizeString(description, 1000) || `Action item from scanned document: ${scan?.title || ''}`,
    tags: ['task', 'from-scan'],
    taskStatus: 'pending',
    priority: ['low', 'medium', 'high', 'urgent'].includes(priority) ? priority : 'medium',
    dueDate: dueDate ? sanitizeString(dueDate, 20) : undefined,
    relatedNoteId: scan ? 'item-' + scan.id : undefined,
    pinned: false,
    favorite: false,
    locked: false,
    isTrash: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  dataStore.saveItem(taskItem);
  return res.status(201).json({ item: taskItem, message: 'Task created from scan successfully' });
});

/**
 * 9. User Confirmation Action: Create real Calendar Event from scan detection
 */
scanRouter.post('/:id/create-event', requireAuth, (req: Request, res: Response) => {
  const user = req.user!;
  const { id } = req.params;
  const { title, date, time, location = '', description = '' } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Event title is required' });
  }

  const scan = dataStore.getScanById(user.id, id);

  const eventItem: StoredItem = {
    id: 'event-scan-' + Date.now(),
    userId: user.id,
    title: sanitizeString(title, 150),
    type: 'event',
    category: 'personal',
    collectionIds: [],
    content: sanitizeString(description, 1000) || `Calendar event from scanned document: ${scan?.title || ''}`,
    eventDate: date ? sanitizeString(date, 20) : new Date().toISOString().split('T')[0],
    dueTime: time ? sanitizeString(time, 10) : undefined,
    eventLocation: location ? sanitizeString(location, 100) : undefined,
    tags: ['event', 'calendar', 'from-scan'],
    relatedNoteId: scan ? 'item-' + scan.id : undefined,
    pinned: false,
    favorite: false,
    locked: false,
    isTrash: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  dataStore.saveItem(eventItem);
  return res.status(201).json({ item: eventItem, message: 'Calendar event created from scan successfully' });
});

/**
 * 10. User Confirmation Action: Create real Reminder from scan detection
 */
scanRouter.post('/:id/create-reminder', requireAuth, (req: Request, res: Response) => {
  const user = req.user!;
  const { id } = req.params;
  const { title, dueDate, dueTime = '09:00', notes = '' } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Reminder title is required' });
  }

  const scan = dataStore.getScanById(user.id, id);

  const reminderItem: StoredItem = {
    id: 'remind-scan-' + Date.now(),
    userId: user.id,
    title: sanitizeString(title, 150),
    type: 'note',
    category: 'personal',
    collectionIds: [],
    content: sanitizeString(notes, 1000) || `Reminder from scanned document: ${scan?.title || ''}`,
    reminder: {
      dueDate: dueDate ? sanitizeString(dueDate, 20) : new Date().toISOString().split('T')[0],
      dueTime: sanitizeString(dueTime, 10),
      completed: false,
      priority: 'medium',
      repeat: 'never',
      notes: sanitizeString(notes, 500),
    },
    tags: ['reminder', 'alert', 'from-scan'],
    relatedNoteId: scan ? 'item-' + scan.id : undefined,
    pinned: false,
    favorite: false,
    locked: false,
    isTrash: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  dataStore.saveItem(reminderItem);
  return res.status(201).json({ item: reminderItem, message: 'Reminder created from scan successfully' });
});
