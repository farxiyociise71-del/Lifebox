import fs from 'fs';
import path from 'path';
import { hashPassword, hashPin, encryptVaultData, decryptVaultData, generateSecureToken } from '../security/crypto';

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  passwordSalt: string;
  pinHash: string;
  pinSalt: string;
  isPinRequiredForLocked: boolean;
  isPinProtected: boolean;
  aiSummariesEnabled: boolean;
  autoOcrEnabled: boolean;
  autoTagEnabled: boolean;
  minimizeAiData: boolean;
  theme: 'light' | 'dark' | 'system';
  createdAt: string;
  updatedAt: string;
}

export interface SessionRecord {
  id: string;
  token: string;
  userId: string;
  ip: string;
  userAgent: string;
  browser: string;
  os: string;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
}

export interface EncryptedVaultPayload {
  iv: string;
  ciphertext: string;
  authTag: string;
}

export interface StoredItem {
  id: string;
  userId: string;
  title: string;
  type: 'note' | 'photo' | 'document' | 'voice' | 'link' | 'scan' | 'contact' | 'location' | 'task' | 'event' | 'screenshot' | 'pdf' | 'webpage';
  category: 'personal' | 'study' | 'work' | 'finance' | 'health' | 'ideas' | 'archive';
  collectionIds: string[];
  content: string;
  mediaUrl?: string;
  mediaName?: string;
  extractedText?: string;
  summary?: string;
  tags: string[];
  pinned: boolean;
  favorite: boolean;
  locked: boolean;
  isEncrypted?: boolean;
  encryptedPayload?: EncryptedVaultPayload;
  isTrash: boolean;
  createdAt: string;
  updatedAt: string;
  reminder?: any;
  studentMeta?: any;
  taskStatus?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string;
  dueTime?: string;
  relatedEventId?: string;
  relatedNoteId?: string;
  eventDate?: string;
  eventEndDate?: string;
  eventLocation?: string;
  planDetails?: any;
}

export interface StoredCollection {
  id: string;
  userId: string;
  name: string;
  description: string;
  color: string;
  icon?: string;
  createdAt: string;
}

export interface StoredConversation {
  id: string;
  userId: string;
  title: string;
  mode: 'chat' | 'lifebox';
  turns: Array<{
    id?: string;
    role: 'user' | 'assistant' | 'agent';
    text: string;
    intent?: string;
    mode?: 'chat' | 'lifebox';
    matchedItemIds?: string[];
    sources?: any[];
    actions?: any[];
    thoughtSteps?: string[];
    suggestedFollowUps?: string[];
    timestamp?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface SecurityAuditEvent {
  id: string;
  userId: string;
  eventType: 'LOGIN' | 'FAILED_LOGIN' | 'PIN_VERIFY' | 'FAILED_PIN' | 'PASSWORD_CHANGE' | 'SESSION_REVOKED' | 'DATA_EXPORTED' | 'ACCOUNT_PURGED';
  ip: string;
  userAgent: string;
  timestamp: string;
  details: string;
}

export interface StoredScanPage {
  id: string;
  image: string;
  originalImage?: string;
  pageNumber: number;
  extractedText?: string;
  rotation: number;
  cropInfo?: { x: number; y: number; width: number; height: number };
  brightness?: number;
  contrast?: number;
  filter?: string;
}

export interface StoredScannedDocument {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  pages: StoredScanPage[];
  extractedText: string;
  documentType: string;
  tags: string[];
  analysis?: any;
  originalFileReference?: string;
  processedFileReference?: string;
  status?: 'processed' | 'draft' | 'archived';
}

// Persistent JSON file-backed data store (Production-grade, zero fake seed data)
class MemoryDataStore {
  private users = new Map<string, UserRecord>();
  private sessions = new Map<string, SessionRecord>();
  private items = new Map<string, StoredItem>();
  private scans = new Map<string, StoredScannedDocument>();
  private collections = new Map<string, StoredCollection>();
  private conversations = new Map<string, StoredConversation>();
  private auditLogs: SecurityAuditEvent[] = [];
  private dbPath: string;

  constructor() {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch (err) {
        console.error('Failed to create data directory:', err);
      }
    }
    this.dbPath = path.join(dataDir, 'lifebox-db.json');
    this.loadFromDisk();
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(this.dbPath)) {
        const raw = fs.readFileSync(this.dbPath, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data.users)) {
          data.users.forEach((u: UserRecord) => this.users.set(u.id, u));
        }
        if (Array.isArray(data.sessions)) {
          data.sessions.forEach((s: SessionRecord) => this.sessions.set(s.token, s));
        }
        if (Array.isArray(data.items)) {
          data.items.forEach((it: StoredItem) => this.items.set(it.id, it));
        }
        if (Array.isArray(data.scans)) {
          data.scans.forEach((sc: StoredScannedDocument) => this.scans.set(sc.id, sc));
        }
        if (Array.isArray(data.collections)) {
          data.collections.forEach((c: StoredCollection) => this.collections.set(c.id, c));
        }
        if (Array.isArray(data.conversations)) {
          data.conversations.forEach((c: StoredConversation) => this.conversations.set(c.id, c));
        }
        if (Array.isArray(data.auditLogs)) {
          this.auditLogs = data.auditLogs;
        }
      }
    } catch (err) {
      console.warn('Could not load existing database file, starting clean:', err);
    }
  }

  private saveToDisk() {
    try {
      const payload = {
        users: Array.from(this.users.values()),
        sessions: Array.from(this.sessions.values()),
        items: Array.from(this.items.values()),
        scans: Array.from(this.scans.values()),
        collections: Array.from(this.collections.values()),
        conversations: Array.from(this.conversations.values()),
        auditLogs: this.auditLogs.slice(0, 500),
      };
      fs.writeFileSync(this.dbPath, JSON.stringify(payload, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write database to disk:', err);
    }
  }

  // --- User Operations ---
  getUserById(id: string): UserRecord | undefined {
    return this.users.get(id);
  }

  getUserByEmail(email: string): UserRecord | undefined {
    const target = email.toLowerCase().trim();
    for (const u of this.users.values()) {
      if (u.email.toLowerCase() === target) return u;
    }
    return undefined;
  }

  saveUser(user: UserRecord): void {
    user.updatedAt = new Date().toISOString();
    this.users.set(user.id, user);
    this.saveToDisk();
  }

  // --- Session Operations ---
  createSession(userId: string, reqIp: string, userAgent: string): SessionRecord {
    // Parse human-readable browser and OS
    let browser = 'Chrome / WebKit';
    let os = 'Desktop Browser';
    const ua = userAgent.toLowerCase();
    if (ua.includes('firefox')) browser = 'Firefox';
    else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
    else if (ua.includes('edge')) browser = 'Edge';
    else if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) browser = 'Mobile Browser';

    if (ua.includes('macintosh') || ua.includes('mac os')) os = 'macOS';
    else if (ua.includes('windows')) os = 'Windows';
    else if (ua.includes('linux')) os = 'Linux';
    else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';
    else if (ua.includes('android')) os = 'Android';

    const token = generateSecureToken(32);
    const session: SessionRecord = {
      id: 'sess-' + generateSecureToken(8),
      token,
      userId,
      ip: reqIp,
      userAgent: userAgent.slice(0, 200),
      browser,
      os,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(), // 30 days
    };

    this.sessions.set(token, session);
    this.saveToDisk();
    return session;
  }

  getSession(token: string): SessionRecord | null {
    const session = this.sessions.get(token);
    if (!session) return null;
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      this.sessions.delete(token);
      return null;
    }
    session.lastActiveAt = new Date().toISOString();
    return session;
  }

  revokeSession(token: string): boolean {
    return this.sessions.delete(token);
  }

  getUserSessions(userId: string): SessionRecord[] {
    const result: SessionRecord[] = [];
    const now = Date.now();
    for (const [token, s] of this.sessions.entries()) {
      if (s.userId === userId) {
        if (new Date(s.expiresAt).getTime() < now) {
          this.sessions.delete(token);
        } else {
          result.push(s);
        }
      }
    }
    return result.sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime());
  }

  revokeOtherSessions(userId: string, currentToken: string): number {
    let count = 0;
    for (const [token, s] of this.sessions.entries()) {
      if (s.userId === userId && token !== currentToken) {
        this.sessions.delete(token);
        count++;
      }
    }
    return count;
  }

  // --- Item Operations (Enforcing userId authorization) ---
  getUserItems(userId: string): StoredItem[] {
    const result: StoredItem[] = [];
    for (const item of this.items.values()) {
      if (item.userId === userId) {
        result.push({ ...item });
      }
    }
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getItemById(userId: string, itemId: string): StoredItem | undefined {
    const item = this.items.get(itemId);
    if (item && item.userId === userId) {
      return { ...item };
    }
    return undefined;
  }

  saveItem(item: StoredItem): StoredItem {
    item.updatedAt = new Date().toISOString();
    this.items.set(item.id, item);
    this.saveToDisk();
    return item;
  }

  deleteItem(userId: string, itemId: string, permanent = false): boolean {
    const item = this.items.get(itemId);
    if (!item || item.userId !== userId) return false;

    if (permanent) {
      const res = this.items.delete(itemId);
      this.saveToDisk();
      return res;
    } else {
      item.isTrash = true;
      item.updatedAt = new Date().toISOString();
      this.saveToDisk();
      return true;
    }
  }

  restoreItem(userId: string, itemId: string): boolean {
    const item = this.items.get(itemId);
    if (!item || item.userId !== userId) return false;
    item.isTrash = false;
    item.updatedAt = new Date().toISOString();
    this.saveToDisk();
    return true;
  }

  // --- Specialized Entity Listing Methods (Action-First Architecture) ---
  getNotes(
    userId: string,
    filter?: { dateFrom?: string; dateTo?: string; search?: string; limit?: number }
  ): StoredItem[] {
    const items = this.getUserItems(userId).filter(
      (it) =>
        !it.isTrash &&
        !it.locked &&
        (it.type === 'note' ||
          it.category === 'ideas' ||
          it.category === 'study' ||
          (!it.reminder && it.type !== 'task' && it.type !== 'document' && it.type !== 'photo' && it.type !== 'voice'))
    );
    return this.applyFilters(items, filter);
  }

  getDocuments(
    userId: string,
    filter?: { search?: string; limit?: number }
  ): StoredItem[] {
    const items = this.getUserItems(userId).filter(
      (it) =>
        !it.isTrash &&
        !it.locked &&
        (it.type === 'document' || it.type === 'pdf' || it.type === 'scan' || it.category === 'finance')
    );
    return this.applyFilters(items, filter);
  }

  getScans(
    userId: string,
    filter?: { dateFrom?: string; dateTo?: string; search?: string; limit?: number }
  ): StoredItem[] {
    const items = this.getUserItems(userId).filter(
      (it) =>
        !it.isTrash &&
        !it.locked &&
        (it.type === 'scan' ||
          it.tags?.includes('scan') ||
          it.tags?.includes('scanner') ||
          Boolean(it.extractedText && (it.type === 'document' || it.type === 'photo')))
    );
    return this.applyFilters(items, filter);
  }

  // --- Dedicated ScannedDocument Operations ---
  saveScan(scan: StoredScannedDocument): StoredScannedDocument {
    scan.updatedAt = new Date().toISOString();
    if (!scan.createdAt) scan.createdAt = scan.updatedAt;
    this.scans.set(scan.id, scan);
    this.saveToDisk();
    return scan;
  }

  getUserScans(userId: string): StoredScannedDocument[] {
    const result: StoredScannedDocument[] = [];
    for (const scan of this.scans.values()) {
      if (scan.userId === userId) {
        result.push({ ...scan });
      }
    }
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getScanById(userId: string, scanId: string): StoredScannedDocument | undefined {
    const scan = this.scans.get(scanId);
    if (scan && scan.userId === userId) {
      return { ...scan };
    }
    return undefined;
  }

  updateScan(
    userId: string,
    scanId: string,
    updates: Partial<StoredScannedDocument>
  ): StoredScannedDocument | undefined {
    const scan = this.scans.get(scanId);
    if (!scan || scan.userId !== userId) return undefined;
    Object.assign(scan, updates, { updatedAt: new Date().toISOString() });
    this.saveToDisk();
    return { ...scan };
  }

  deleteScan(userId: string, scanId: string): boolean {
    const scan = this.scans.get(scanId);
    if (!scan || scan.userId !== userId) return false;
    const res = this.scans.delete(scanId);
    if (res) this.saveToDisk();
    return res;
  }

  getTasks(
    userId: string,
    filter?: { dateFrom?: string; dateTo?: string; search?: string; status?: string; limit?: number }
  ): StoredItem[] {
    const items = this.getUserItems(userId).filter(
      (it) => !it.isTrash && !it.locked && (it.type === 'task' || Boolean(it.taskStatus))
    );
    return this.applyFilters(items, filter);
  }

  getReminders(
    userId: string,
    filter?: { dateFrom?: string; dateTo?: string; search?: string; limit?: number }
  ): StoredItem[] {
    const items = this.getUserItems(userId).filter(
      (it) => !it.isTrash && !it.locked && Boolean(it.reminder)
    );
    return this.applyFilters(items, filter);
  }

  getEvents(
    userId: string,
    filter?: { dateFrom?: string; dateTo?: string; search?: string; limit?: number }
  ): StoredItem[] {
    const items = this.getUserItems(userId).filter(
      (it) =>
        !it.isTrash &&
        !it.locked &&
        (it.type === 'event' || Boolean(it.eventDate) || Boolean(it.reminder?.dueDate))
    );
    return this.applyFilters(items, filter);
  }

  private applyFilters(
    items: StoredItem[],
    filter?: { dateFrom?: string; dateTo?: string; search?: string; limit?: number }
  ): StoredItem[] {
    let result = items;
    if (filter?.dateFrom) {
      result = result.filter(
        (it) => (it.createdAt || '') >= filter.dateFrom! || (it.updatedAt || '') >= filter.dateFrom!
      );
    }
    if (filter?.dateTo) {
      result = result.filter(
        (it) => (it.createdAt || '') <= filter.dateTo! || (it.updatedAt || '') <= filter.dateTo!
      );
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      result = result.filter(
        (it) =>
          it.title.toLowerCase().includes(q) ||
          (it.content && it.content.toLowerCase().includes(q)) ||
          (it.extractedText && it.extractedText.toLowerCase().includes(q)) ||
          (it.tags && it.tags.some((t) => t.toLowerCase().includes(q)))
      );
    }
    if (filter?.limit && filter.limit > 0) {
      result = result.slice(0, filter.limit);
    }
    return result;
  }

  emptyTrash(userId: string): number {
    let count = 0;
    for (const [id, it] of this.items.entries()) {
      if (it.userId === userId && it.isTrash) {
        this.items.delete(id);
        count++;
      }
    }
    if (count > 0) this.saveToDisk();
    return count;
  }

  // --- Collections Operations ---
  getUserCollections(userId: string): StoredCollection[] {
    const result: StoredCollection[] = [];
    for (const col of this.collections.values()) {
      if (col.userId === userId) {
        result.push({ ...col });
      }
    }
    return result;
  }

  saveCollection(col: StoredCollection): StoredCollection {
    this.collections.set(col.id, col);
    this.saveToDisk();
    return col;
  }

  deleteCollection(userId: string, colId: string): boolean {
    const col = this.collections.get(colId);
    if (!col || col.userId !== userId) return false;
    const res = this.collections.delete(colId);
    if (res) this.saveToDisk();
    return res;
  }

  // --- Conversations Operations (Per User) ---
  getUserConversations(userId: string): StoredConversation[] {
    const result: StoredConversation[] = [];
    for (const conv of this.conversations.values()) {
      if (conv.userId === userId) {
        result.push({ ...conv });
      }
    }
    return result.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
  }

  getConversationById(userId: string, convId: string): StoredConversation | undefined {
    const conv = this.conversations.get(convId);
    if (conv && conv.userId === userId) {
      return { ...conv };
    }
    return undefined;
  }

  saveConversation(conv: StoredConversation): StoredConversation {
    conv.updatedAt = new Date().toISOString();
    if (!conv.createdAt) conv.createdAt = conv.updatedAt;
    this.conversations.set(conv.id, conv);
    this.saveToDisk();
    return conv;
  }

  deleteConversation(userId: string, convId: string): boolean {
    const conv = this.conversations.get(convId);
    if (!conv || conv.userId !== userId) return false;
    const res = this.conversations.delete(convId);
    if (res) this.saveToDisk();
    return res;
  }

  // --- Audit Logging ---
  logAuditEvent(event: Omit<SecurityAuditEvent, 'id' | 'timestamp'>): void {
    this.auditLogs.unshift({
      ...event,
      id: 'audit-' + generateSecureToken(6),
      timestamp: new Date().toISOString(),
    });
    // Keep last 500 audit events
    if (this.auditLogs.length > 500) {
      this.auditLogs.pop();
    }
    this.saveToDisk();
  }

  getUserAuditLogs(userId: string): SecurityAuditEvent[] {
    return this.auditLogs.filter(a => a.userId === userId);
  }

  // --- Total Account Purge (Right to be Forgotten) ---
  purgeUserData(userId: string): void {
    // 1. Delete all user items
    for (const [id, it] of this.items.entries()) {
      if (it.userId === userId) this.items.delete(id);
    }
    // 2. Delete all user scans
    for (const [id, sc] of this.scans.entries()) {
      if (sc.userId === userId) this.scans.delete(id);
    }
    // 3. Delete all collections
    for (const [id, col] of this.collections.entries()) {
      if (col.userId === userId) this.collections.delete(id);
    }
    // 3. Delete all conversations
    for (const [id, conv] of this.conversations.entries()) {
      if (conv.userId === userId) this.conversations.delete(id);
    }
    // 4. Delete all sessions
    for (const [token, s] of this.sessions.entries()) {
      if (s.userId === userId) this.sessions.delete(token);
    }
    // 5. Delete user record
    this.users.delete(userId);
    // 6. Log audit event
    this.logAuditEvent({
      userId,
      eventType: 'ACCOUNT_PURGED',
      ip: 'internal',
      userAgent: 'system',
      details: 'All user data, records, sessions, and credentials permanently purged.',
    });
    this.saveToDisk();
  }
}

export const dataStore = new MemoryDataStore();
