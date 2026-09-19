import { Router, Request, Response } from 'express';
import { dataStore, StoredItem, StoredCollection } from '../data/store';
import { requireAuth } from '../security/authMiddleware';
import { sanitizeString } from '../security/sanitizer';
import { encryptVaultData, decryptVaultData, verifyPin } from '../security/crypto';
import { createRateLimiter } from '../security/rateLimit';

export const itemRouter = Router();

const itemsRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 120,
});

itemRouter.use(requireAuth, itemsRateLimiter);

const ALLOWED_CATEGORIES = ['personal', 'study', 'work', 'finance', 'health', 'ideas', 'archive'];
const ALLOWED_TYPES = ['note', 'photo', 'document', 'voice', 'link', 'scan', 'contact', 'location', 'task', 'event', 'screenshot', 'pdf', 'webpage'];

/**
 * Get all items for authenticated user
 */
itemRouter.get('/', (req: Request, res: Response) => {
  const user = req.user!;
  const items = dataStore.getUserItems(user.id);

  // Return items; if locked and encrypted, redact content preview until unlocked
  const sanitized = items.map((it) => {
    if (it.locked && it.isEncrypted) {
      return {
        ...it,
        content: '[ENCRYPTED VAULT ITEM - PIN REQUIRED]',
        extractedText: it.extractedText ? '[ENCRYPTED]' : undefined,
        mediaUrl: undefined, // do not leak locked media in list
      };
    }
    return it;
  });

  return res.json({ items: sanitized });
});

/**
 * Unlock and decrypt a specific sensitive vault item
 */
itemRouter.post('/:id/unlock', (req: Request, res: Response) => {
  const user = req.user!;
  const { id } = req.params;
  const { pin } = req.body;

  const item = dataStore.getItemById(user.id, id);
  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }

  if (!item.locked) {
    return res.json({ item });
  }

  // Verify PIN
  if (!pin || !verifyPin(String(pin), user.pinHash, user.pinSalt)) {
    return res.status(401).json({ error: 'Invalid PIN for vault item decryption' });
  }

  // If item is encrypted with AES-256-GCM, decrypt payload
  if (item.isEncrypted && item.encryptedPayload) {
    try {
      const decryptedString = decryptVaultData(item.encryptedPayload);
      const parsed = JSON.parse(decryptedString);
      return res.json({
        item: {
          ...item,
          content: parsed.content || '',
          extractedText: parsed.extractedText || item.extractedText,
          mediaUrl: parsed.mediaUrl || item.mediaUrl,
        },
      });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to decrypt vault item. Integrity check failed.' });
    }
  }

  return res.json({ item });
});

/**
 * Create a new item
 */
itemRouter.post('/', (req: Request, res: Response) => {
  const user = req.user!;
  const {
    title,
    type = 'note',
    category = 'personal',
    collectionIds = [],
    content = '',
    mediaUrl,
    mediaName,
    extractedText,
    summary,
    tags = [],
    pinned = false,
    favorite = false,
    locked = false,
    reminder,
    studentMeta,
  } = req.body;

  if (!title || typeof title !== 'string') {
    return res.status(400).json({ error: 'Title is required' });
  }

  const safeTitle = sanitizeString(title, 150);
  const safeCategory = ALLOWED_CATEGORIES.includes(category) ? category : 'personal';
  const safeType = ALLOWED_TYPES.includes(type) ? type : 'note';
  const safeTags = Array.isArray(tags)
    ? tags.map((t) => sanitizeString(String(t), 30)).filter(Boolean).slice(0, 15)
    : [];

  const itemId = 'item-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);

  // If item is marked locked/sensitive, encrypt content at rest using AES-256-GCM
  let isEncrypted = false;
  let encryptedPayload: any = undefined;
  let storedContent = sanitizeString(content, 50000);
  let storedExtracted = extractedText ? sanitizeString(extractedText, 50000) : undefined;
  let storedMediaUrl = mediaUrl;

  if (locked) {
    isEncrypted = true;
    const sensitiveData = JSON.stringify({
      content: storedContent,
      extractedText: storedExtracted,
      mediaUrl: storedMediaUrl,
    });
    encryptedPayload = encryptVaultData(sensitiveData);
    storedContent = '[ENCRYPTED VAULT ITEM - PIN REQUIRED]';
    storedExtracted = storedExtracted ? '[ENCRYPTED]' : undefined;
  }

  const newItem: StoredItem = {
    id: itemId,
    userId: user.id,
    title: safeTitle,
    type: safeType as any,
    category: safeCategory as any,
    collectionIds: Array.isArray(collectionIds) ? collectionIds.map((c: any) => String(c)) : [],
    content: storedContent,
    mediaUrl: locked ? undefined : storedMediaUrl,
    mediaName: mediaName ? sanitizeString(mediaName, 100) : undefined,
    extractedText: storedExtracted,
    summary: summary ? sanitizeString(summary, 1000) : undefined,
    tags: safeTags,
    pinned: Boolean(pinned),
    favorite: Boolean(favorite),
    locked: Boolean(locked),
    isEncrypted,
    encryptedPayload,
    isTrash: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    reminder: reminder || undefined,
    studentMeta: studentMeta || undefined,
    taskStatus: req.body.taskStatus || undefined,
    priority: req.body.priority || undefined,
    dueDate: req.body.dueDate || undefined,
    dueTime: req.body.dueTime || undefined,
    relatedEventId: req.body.relatedEventId || undefined,
    relatedNoteId: req.body.relatedNoteId || undefined,
    eventDate: req.body.eventDate || undefined,
    eventEndDate: req.body.eventEndDate || undefined,
    eventLocation: req.body.eventLocation || undefined,
    planDetails: req.body.planDetails || undefined,
  };

  dataStore.saveItem(newItem);
  return res.status(201).json({ item: newItem });
});

/**
 * Update an existing item
 */
itemRouter.put('/:id', (req: Request, res: Response) => {
  const user = req.user!;
  const { id } = req.params;
  const existing = dataStore.getItemById(user.id, id);

  if (!existing) {
    return res.status(404).json({ error: 'Item not found' });
  }

  const updates = req.body;
  if (updates.title) existing.title = sanitizeString(updates.title, 150);
  if (updates.category && ALLOWED_CATEGORIES.includes(updates.category)) existing.category = updates.category;
  if (updates.type && ALLOWED_TYPES.includes(updates.type)) existing.type = updates.type;
  if (Array.isArray(updates.collectionIds)) existing.collectionIds = updates.collectionIds.map((c: any) => String(c));
  if (Array.isArray(updates.tags)) {
    existing.tags = updates.tags.map((t: any) => sanitizeString(String(t), 30)).filter(Boolean).slice(0, 15);
  }
  if (typeof updates.pinned === 'boolean') existing.pinned = updates.pinned;
  if (typeof updates.favorite === 'boolean') existing.favorite = updates.favorite;
  if (typeof updates.isTrash === 'boolean') existing.isTrash = updates.isTrash;
  if (updates.reminder !== undefined) existing.reminder = updates.reminder;
  if (updates.studentMeta !== undefined) existing.studentMeta = updates.studentMeta;
  if (updates.taskStatus !== undefined) existing.taskStatus = updates.taskStatus;
  if (updates.priority !== undefined) existing.priority = updates.priority;
  if (updates.dueDate !== undefined) existing.dueDate = updates.dueDate;
  if (updates.dueTime !== undefined) existing.dueTime = updates.dueTime;
  if (updates.relatedEventId !== undefined) existing.relatedEventId = updates.relatedEventId;
  if (updates.relatedNoteId !== undefined) existing.relatedNoteId = updates.relatedNoteId;
  if (updates.eventDate !== undefined) existing.eventDate = updates.eventDate;
  if (updates.eventEndDate !== undefined) existing.eventEndDate = updates.eventEndDate;
  if (updates.eventLocation !== undefined) existing.eventLocation = updates.eventLocation;
  if (updates.planDetails !== undefined) existing.planDetails = updates.planDetails;

  // Handle content / locked state changes
  if (typeof updates.locked === 'boolean') {
    existing.locked = updates.locked;
  }

  if (updates.content !== undefined) {
    const rawContent = sanitizeString(updates.content, 50000);
    if (existing.locked) {
      existing.isEncrypted = true;
      existing.encryptedPayload = encryptVaultData(JSON.stringify({
        content: rawContent,
        extractedText: updates.extractedText || existing.extractedText,
        mediaUrl: updates.mediaUrl || existing.mediaUrl,
      }));
      existing.content = '[ENCRYPTED VAULT ITEM - PIN REQUIRED]';
    } else {
      existing.content = rawContent;
      existing.isEncrypted = false;
      existing.encryptedPayload = undefined;
      if (updates.mediaUrl !== undefined) existing.mediaUrl = updates.mediaUrl;
      if (updates.extractedText !== undefined) existing.extractedText = sanitizeString(updates.extractedText, 50000);
    }
  }

  dataStore.saveItem(existing);
  return res.json({ item: existing });
});

/**
 * Delete an item (soft-delete to trash or permanent)
 */
itemRouter.delete('/:id', (req: Request, res: Response) => {
  const user = req.user!;
  const { id } = req.params;
  const permanent = req.query.permanent === 'true';

  const success = dataStore.deleteItem(user.id, id, permanent);
  if (!success) {
    return res.status(404).json({ error: 'Item not found' });
  }

  return res.json({ success: true, permanent });
});

/**
 * Restore an item from trash
 */
itemRouter.post('/:id/restore', (req: Request, res: Response) => {
  const user = req.user!;
  const { id } = req.params;
  const success = dataStore.restoreItem(user.id, id);
  if (!success) {
    return res.status(404).json({ error: 'Item not found in trash' });
  }
  return res.json({ success: true });
});

/**
 * Empty trash
 */
itemRouter.post('/trash/empty', (req: Request, res: Response) => {
  const user = req.user!;
  const count = dataStore.emptyTrash(user.id);
  return res.json({ success: true, count });
});

// --- Collections Endpoints ---
itemRouter.get('/collections/all', (req: Request, res: Response) => {
  const user = req.user!;
  const cols = dataStore.getUserCollections(user.id);
  return res.json({ collections: cols });
});

itemRouter.post('/collections', (req: Request, res: Response) => {
  const user = req.user!;
  const { name, description = '', color = '#4f46e5', icon = 'Folder' } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Collection name is required' });
  }

  const newCol: StoredCollection = {
    id: 'col-' + Date.now(),
    userId: user.id,
    name: sanitizeString(name, 50),
    description: sanitizeString(description, 200),
    color: sanitizeString(color, 20),
    icon: sanitizeString(icon, 30),
    createdAt: new Date().toISOString(),
  };

  dataStore.saveCollection(newCol);
  return res.status(201).json({ collection: newCol });
});

itemRouter.delete('/collections/:id', (req: Request, res: Response) => {
  const user = req.user!;
  const { id } = req.params;
  const success = dataStore.deleteCollection(user.id, id);
  if (!success) {
    return res.status(404).json({ error: 'Collection not found' });
  }
  return res.json({ success: true });
});
