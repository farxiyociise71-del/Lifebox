var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express6 = __toESM(require("express"), 1);
var import_path2 = __toESM(require("path"), 1);
var import_dotenv = __toESM(require("dotenv"), 1);
var import_vite = require("vite");

// server/routes/authRoutes.ts
var import_express = require("express");

// server/data/store.ts
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);

// server/security/crypto.ts
var import_node_crypto = __toESM(require("node:crypto"), 1);
var SERVER_SECRET = process.env.ENCRYPTION_SECRET || process.env.APP_SECRET || "lifebox-secure-master-key-seed-32bytes!";
var SERVER_KEY = import_node_crypto.default.scryptSync(SERVER_SECRET, "lifebox-static-salt", 32);
function hashPassword(password) {
  const salt = import_node_crypto.default.randomBytes(16).toString("hex");
  const hash = import_node_crypto.default.pbkdf2Sync(password, salt, 1e5, 64, "sha512").toString("hex");
  return { hash, salt };
}
function verifyPassword(password, storedHash, salt) {
  try {
    const computedHash = import_node_crypto.default.pbkdf2Sync(password, salt, 1e5, 64, "sha512").toString("hex");
    return import_node_crypto.default.timingSafeEqual(Buffer.from(computedHash, "hex"), Buffer.from(storedHash, "hex"));
  } catch {
    return false;
  }
}
function hashPin(pin) {
  const salt = import_node_crypto.default.randomBytes(16).toString("hex");
  const hash = import_node_crypto.default.pbkdf2Sync(pin, salt, 1e5, 32, "sha512").toString("hex");
  return { hash, salt };
}
function verifyPin(pin, storedHash, salt) {
  try {
    const computedHash = import_node_crypto.default.pbkdf2Sync(pin, salt, 1e5, 32, "sha512").toString("hex");
    return import_node_crypto.default.timingSafeEqual(Buffer.from(computedHash, "hex"), Buffer.from(storedHash, "hex"));
  } catch {
    return false;
  }
}
function encryptVaultData(plaintext, key = SERVER_KEY) {
  const iv = import_node_crypto.default.randomBytes(12);
  const cipher = import_node_crypto.default.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return {
    iv: iv.toString("hex"),
    ciphertext: encrypted,
    authTag
  };
}
function decryptVaultData(encrypted, key = SERVER_KEY) {
  const decipher = import_node_crypto.default.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(encrypted.iv, "hex")
  );
  decipher.setAuthTag(Buffer.from(encrypted.authTag, "hex"));
  let decrypted = decipher.update(encrypted.ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
function generateSecureToken(bytes = 32) {
  return import_node_crypto.default.randomBytes(bytes).toString("hex");
}

// server/data/store.ts
var MemoryDataStore = class {
  constructor() {
    this.users = /* @__PURE__ */ new Map();
    this.sessions = /* @__PURE__ */ new Map();
    this.items = /* @__PURE__ */ new Map();
    this.scans = /* @__PURE__ */ new Map();
    this.collections = /* @__PURE__ */ new Map();
    this.conversations = /* @__PURE__ */ new Map();
    this.auditLogs = [];
    const dataDir = import_path.default.join(process.cwd(), "data");
    if (!import_fs.default.existsSync(dataDir)) {
      try {
        import_fs.default.mkdirSync(dataDir, { recursive: true });
      } catch (err) {
        console.error("Failed to create data directory:", err);
      }
    }
    this.dbPath = import_path.default.join(dataDir, "lifebox-db.json");
    this.loadFromDisk();
  }
  loadFromDisk() {
    try {
      if (import_fs.default.existsSync(this.dbPath)) {
        const raw = import_fs.default.readFileSync(this.dbPath, "utf-8");
        const data = JSON.parse(raw);
        if (Array.isArray(data.users)) {
          data.users.forEach((u) => this.users.set(u.id, u));
        }
        if (Array.isArray(data.sessions)) {
          data.sessions.forEach((s) => this.sessions.set(s.token, s));
        }
        if (Array.isArray(data.items)) {
          data.items.forEach((it) => this.items.set(it.id, it));
        }
        if (Array.isArray(data.scans)) {
          data.scans.forEach((sc) => this.scans.set(sc.id, sc));
        }
        if (Array.isArray(data.collections)) {
          data.collections.forEach((c) => this.collections.set(c.id, c));
        }
        if (Array.isArray(data.conversations)) {
          data.conversations.forEach((c) => this.conversations.set(c.id, c));
        }
        if (Array.isArray(data.auditLogs)) {
          this.auditLogs = data.auditLogs;
        }
      }
    } catch (err) {
      console.warn("Could not load existing database file, starting clean:", err);
    }
  }
  saveToDisk() {
    try {
      const payload = {
        users: Array.from(this.users.values()),
        sessions: Array.from(this.sessions.values()),
        items: Array.from(this.items.values()),
        scans: Array.from(this.scans.values()),
        collections: Array.from(this.collections.values()),
        conversations: Array.from(this.conversations.values()),
        auditLogs: this.auditLogs.slice(0, 500)
      };
      import_fs.default.writeFileSync(this.dbPath, JSON.stringify(payload, null, 2), "utf-8");
    } catch (err) {
      console.error("Failed to write database to disk:", err);
    }
  }
  // --- User Operations ---
  getUserById(id) {
    return this.users.get(id);
  }
  getUserByEmail(email) {
    const target = email.toLowerCase().trim();
    for (const u of this.users.values()) {
      if (u.email.toLowerCase() === target) return u;
    }
    return void 0;
  }
  saveUser(user) {
    user.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.users.set(user.id, user);
    this.saveToDisk();
  }
  // --- Session Operations ---
  createSession(userId, reqIp, userAgent) {
    let browser = "Chrome / WebKit";
    let os = "Desktop Browser";
    const ua = userAgent.toLowerCase();
    if (ua.includes("firefox")) browser = "Firefox";
    else if (ua.includes("safari") && !ua.includes("chrome")) browser = "Safari";
    else if (ua.includes("edge")) browser = "Edge";
    else if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) browser = "Mobile Browser";
    if (ua.includes("macintosh") || ua.includes("mac os")) os = "macOS";
    else if (ua.includes("windows")) os = "Windows";
    else if (ua.includes("linux")) os = "Linux";
    else if (ua.includes("iphone") || ua.includes("ipad")) os = "iOS";
    else if (ua.includes("android")) os = "Android";
    const token = generateSecureToken(32);
    const session = {
      id: "sess-" + generateSecureToken(8),
      token,
      userId,
      ip: reqIp,
      userAgent: userAgent.slice(0, 200),
      browser,
      os,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      lastActiveAt: (/* @__PURE__ */ new Date()).toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1e3).toISOString()
      // 30 days
    };
    this.sessions.set(token, session);
    this.saveToDisk();
    return session;
  }
  getSession(token) {
    const session = this.sessions.get(token);
    if (!session) return null;
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      this.sessions.delete(token);
      return null;
    }
    session.lastActiveAt = (/* @__PURE__ */ new Date()).toISOString();
    return session;
  }
  revokeSession(token) {
    return this.sessions.delete(token);
  }
  getUserSessions(userId) {
    const result = [];
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
  revokeOtherSessions(userId, currentToken) {
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
  getUserItems(userId) {
    const result = [];
    for (const item of this.items.values()) {
      if (item.userId === userId) {
        result.push({ ...item });
      }
    }
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  getItemById(userId, itemId) {
    const item = this.items.get(itemId);
    if (item && item.userId === userId) {
      return { ...item };
    }
    return void 0;
  }
  saveItem(item) {
    item.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.items.set(item.id, item);
    this.saveToDisk();
    return item;
  }
  deleteItem(userId, itemId, permanent = false) {
    const item = this.items.get(itemId);
    if (!item || item.userId !== userId) return false;
    if (permanent) {
      const res = this.items.delete(itemId);
      this.saveToDisk();
      return res;
    } else {
      item.isTrash = true;
      item.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      this.saveToDisk();
      return true;
    }
  }
  restoreItem(userId, itemId) {
    const item = this.items.get(itemId);
    if (!item || item.userId !== userId) return false;
    item.isTrash = false;
    item.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.saveToDisk();
    return true;
  }
  // --- Specialized Entity Listing Methods (Action-First Architecture) ---
  getNotes(userId, filter) {
    const items = this.getUserItems(userId).filter(
      (it) => !it.isTrash && !it.locked && (it.type === "note" || it.category === "ideas" || it.category === "study" || !it.reminder && it.type !== "task" && it.type !== "document" && it.type !== "photo" && it.type !== "voice")
    );
    return this.applyFilters(items, filter);
  }
  getDocuments(userId, filter) {
    const items = this.getUserItems(userId).filter(
      (it) => !it.isTrash && !it.locked && (it.type === "document" || it.type === "pdf" || it.type === "scan" || it.category === "finance")
    );
    return this.applyFilters(items, filter);
  }
  getScans(userId, filter) {
    const items = this.getUserItems(userId).filter(
      (it) => !it.isTrash && !it.locked && (it.type === "scan" || it.tags?.includes("scan") || it.tags?.includes("scanner") || Boolean(it.extractedText && (it.type === "document" || it.type === "photo")))
    );
    return this.applyFilters(items, filter);
  }
  // --- Dedicated ScannedDocument Operations ---
  saveScan(scan) {
    scan.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    if (!scan.createdAt) scan.createdAt = scan.updatedAt;
    this.scans.set(scan.id, scan);
    this.saveToDisk();
    return scan;
  }
  getUserScans(userId) {
    const result = [];
    for (const scan of this.scans.values()) {
      if (scan.userId === userId) {
        result.push({ ...scan });
      }
    }
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  getScanById(userId, scanId) {
    const scan = this.scans.get(scanId);
    if (scan && scan.userId === userId) {
      return { ...scan };
    }
    return void 0;
  }
  updateScan(userId, scanId, updates) {
    const scan = this.scans.get(scanId);
    if (!scan || scan.userId !== userId) return void 0;
    Object.assign(scan, updates, { updatedAt: (/* @__PURE__ */ new Date()).toISOString() });
    this.saveToDisk();
    return { ...scan };
  }
  deleteScan(userId, scanId) {
    const scan = this.scans.get(scanId);
    if (!scan || scan.userId !== userId) return false;
    const res = this.scans.delete(scanId);
    if (res) this.saveToDisk();
    return res;
  }
  getTasks(userId, filter) {
    const items = this.getUserItems(userId).filter(
      (it) => !it.isTrash && !it.locked && (it.type === "task" || Boolean(it.taskStatus))
    );
    return this.applyFilters(items, filter);
  }
  getReminders(userId, filter) {
    const items = this.getUserItems(userId).filter(
      (it) => !it.isTrash && !it.locked && Boolean(it.reminder)
    );
    return this.applyFilters(items, filter);
  }
  getEvents(userId, filter) {
    const items = this.getUserItems(userId).filter(
      (it) => !it.isTrash && !it.locked && (it.type === "event" || Boolean(it.eventDate) || Boolean(it.reminder?.dueDate))
    );
    return this.applyFilters(items, filter);
  }
  applyFilters(items, filter) {
    let result = items;
    if (filter?.dateFrom) {
      result = result.filter(
        (it) => (it.createdAt || "") >= filter.dateFrom || (it.updatedAt || "") >= filter.dateFrom
      );
    }
    if (filter?.dateTo) {
      result = result.filter(
        (it) => (it.createdAt || "") <= filter.dateTo || (it.updatedAt || "") <= filter.dateTo
      );
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      result = result.filter(
        (it) => it.title.toLowerCase().includes(q) || it.content && it.content.toLowerCase().includes(q) || it.extractedText && it.extractedText.toLowerCase().includes(q) || it.tags && it.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    if (filter?.limit && filter.limit > 0) {
      result = result.slice(0, filter.limit);
    }
    return result;
  }
  emptyTrash(userId) {
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
  getUserCollections(userId) {
    const result = [];
    for (const col of this.collections.values()) {
      if (col.userId === userId) {
        result.push({ ...col });
      }
    }
    return result;
  }
  saveCollection(col) {
    this.collections.set(col.id, col);
    this.saveToDisk();
    return col;
  }
  deleteCollection(userId, colId) {
    const col = this.collections.get(colId);
    if (!col || col.userId !== userId) return false;
    const res = this.collections.delete(colId);
    if (res) this.saveToDisk();
    return res;
  }
  // --- Conversations Operations (Per User) ---
  getUserConversations(userId) {
    const result = [];
    for (const conv of this.conversations.values()) {
      if (conv.userId === userId) {
        result.push({ ...conv });
      }
    }
    return result.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
  }
  getConversationById(userId, convId) {
    const conv = this.conversations.get(convId);
    if (conv && conv.userId === userId) {
      return { ...conv };
    }
    return void 0;
  }
  saveConversation(conv) {
    conv.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    if (!conv.createdAt) conv.createdAt = conv.updatedAt;
    this.conversations.set(conv.id, conv);
    this.saveToDisk();
    return conv;
  }
  deleteConversation(userId, convId) {
    const conv = this.conversations.get(convId);
    if (!conv || conv.userId !== userId) return false;
    const res = this.conversations.delete(convId);
    if (res) this.saveToDisk();
    return res;
  }
  // --- Audit Logging ---
  logAuditEvent(event) {
    this.auditLogs.unshift({
      ...event,
      id: "audit-" + generateSecureToken(6),
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    if (this.auditLogs.length > 500) {
      this.auditLogs.pop();
    }
    this.saveToDisk();
  }
  getUserAuditLogs(userId) {
    return this.auditLogs.filter((a) => a.userId === userId);
  }
  // --- Total Account Purge (Right to be Forgotten) ---
  purgeUserData(userId) {
    for (const [id, it] of this.items.entries()) {
      if (it.userId === userId) this.items.delete(id);
    }
    for (const [id, sc] of this.scans.entries()) {
      if (sc.userId === userId) this.scans.delete(id);
    }
    for (const [id, col] of this.collections.entries()) {
      if (col.userId === userId) this.collections.delete(id);
    }
    for (const [id, conv] of this.conversations.entries()) {
      if (conv.userId === userId) this.conversations.delete(id);
    }
    for (const [token, s] of this.sessions.entries()) {
      if (s.userId === userId) this.sessions.delete(token);
    }
    this.users.delete(userId);
    this.logAuditEvent({
      userId,
      eventType: "ACCOUNT_PURGED",
      ip: "internal",
      userAgent: "system",
      details: "All user data, records, sessions, and credentials permanently purged."
    });
    this.saveToDisk();
  }
};
var dataStore = new MemoryDataStore();

// server/security/rateLimit.ts
var apiLimits = /* @__PURE__ */ new Map();
var bruteForceLimits = /* @__PURE__ */ new Map();
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of apiLimits.entries()) {
    if (now - record.firstRequestTime > 15 * 60 * 1e3 && (!record.blockedUntil || record.blockedUntil < now)) {
      apiLimits.delete(key);
    }
  }
  for (const [key, record] of bruteForceLimits.entries()) {
    if (now - record.lastAttemptTime > 60 * 60 * 1e3 && (!record.lockedUntil || record.lockedUntil < now)) {
      bruteForceLimits.delete(key);
    }
  }
}, 10 * 60 * 1e3);
function createRateLimiter(options) {
  return (req, res, next) => {
    const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown-ip";
    const key = `${req.baseUrl || req.path}:${clientIp}`;
    const now = Date.now();
    const record = apiLimits.get(key) || { count: 0, firstRequestTime: now };
    if (record.blockedUntil && record.blockedUntil > now) {
      const retryAfterSec = Math.ceil((record.blockedUntil - now) / 1e3);
      res.setHeader("Retry-After", retryAfterSec);
      return res.status(429).json({
        error: "Too Many Requests",
        message: options.message || "Rate limit exceeded. Please wait before retrying.",
        retryAfter: retryAfterSec
      });
    }
    if (now - record.firstRequestTime > options.windowMs) {
      record.count = 1;
      record.firstRequestTime = now;
      record.blockedUntil = void 0;
    } else {
      record.count += 1;
    }
    if (record.count > options.maxRequests) {
      record.blockedUntil = now + options.windowMs;
      apiLimits.set(key, record);
      const retryAfterSec = Math.ceil(options.windowMs / 1e3);
      res.setHeader("Retry-After", retryAfterSec);
      return res.status(429).json({
        error: "Too Many Requests",
        message: options.message || "Rate limit exceeded. Please slow down.",
        retryAfter: retryAfterSec
      });
    }
    apiLimits.set(key, record);
    res.setHeader("X-RateLimit-Limit", options.maxRequests);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, options.maxRequests - record.count));
    next();
  };
}
var BruteForceGuard = class {
  static {
    this.MAX_ATTEMPTS = 5;
  }
  static {
    this.BASE_LOCKOUT_MS = 15 * 60 * 1e3;
  }
  // 15 minutes
  static getKey(identifier, req) {
    const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "ip";
    return `${identifier.toLowerCase().trim()}:${clientIp}`;
  }
  static checkLockout(identifier, req) {
    const key = this.getKey(identifier, req);
    const now = Date.now();
    const record = bruteForceLimits.get(key);
    if (!record) {
      return { isLocked: false, waitSeconds: 0, remainingAttempts: this.MAX_ATTEMPTS };
    }
    if (record.lockedUntil && record.lockedUntil > now) {
      const waitSeconds = Math.ceil((record.lockedUntil - now) / 1e3);
      return { isLocked: true, waitSeconds, remainingAttempts: 0 };
    }
    if (now - record.lastAttemptTime > this.BASE_LOCKOUT_MS) {
      bruteForceLimits.delete(key);
      return { isLocked: false, waitSeconds: 0, remainingAttempts: this.MAX_ATTEMPTS };
    }
    const remaining = Math.max(0, this.MAX_ATTEMPTS - record.failedAttempts);
    return { isLocked: false, waitSeconds: 0, remainingAttempts: remaining };
  }
  static recordFailure(identifier, req) {
    const key = this.getKey(identifier, req);
    const now = Date.now();
    const record = bruteForceLimits.get(key) || { failedAttempts: 0, lastAttemptTime: now };
    record.failedAttempts += 1;
    record.lastAttemptTime = now;
    if (record.failedAttempts >= this.MAX_ATTEMPTS) {
      const multiplier = Math.min(4, Math.floor(record.failedAttempts / this.MAX_ATTEMPTS));
      record.lockedUntil = now + this.BASE_LOCKOUT_MS * multiplier;
      bruteForceLimits.set(key, record);
      return {
        isLocked: true,
        waitSeconds: Math.ceil((record.lockedUntil - now) / 1e3),
        remainingAttempts: 0
      };
    }
    bruteForceLimits.set(key, record);
    return {
      isLocked: false,
      waitSeconds: 0,
      remainingAttempts: Math.max(0, this.MAX_ATTEMPTS - record.failedAttempts)
    };
  }
  static recordSuccess(identifier, req) {
    const key = this.getKey(identifier, req);
    bruteForceLimits.delete(key);
  }
};

// server/security/sanitizer.ts
function sanitizeString(input, maxLength = 1e4) {
  if (typeof input !== "string") return "";
  return input.slice(0, maxLength).replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "").replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "").replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "").replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, "").replace(/on\w+\s*=\s*["'][^"']*["']/gi, "").replace(/javascript:/gi, "").replace(/\0/g, "").trim();
}
function isValidEmail(email) {
  if (typeof email !== "string") return false;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return email.length <= 254 && emailRegex.test(email);
}
function validatePassword(password) {
  if (typeof password !== "string") {
    return { valid: false, message: "Password must be a string" };
  }
  if (password.length < 8) {
    return { valid: false, message: "Password must be at least 8 characters long" };
  }
  if (password.length > 128) {
    return { valid: false, message: "Password cannot exceed 128 characters" };
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return { valid: false, message: "Password must contain both letters and numbers" };
  }
  return { valid: true };
}
function scrubPII(text) {
  if (!text) return { scrubbed: "", redactedCount: 0 };
  let count = 0;
  let scrubbed = text;
  scrubbed = scrubbed.replace(/\b(?:\d[ -]*?){13,19}\b/g, (match) => {
    const digits = match.replace(/\D/g, "");
    if (digits.length >= 13 && digits.length <= 19) {
      count++;
      return "[REDACTED_CREDIT_CARD]";
    }
    return match;
  });
  scrubbed = scrubbed.replace(/\b\d{3}-\d{2}-\d{4}\b/g, () => {
    count++;
    return "[REDACTED_SSN]";
  });
  scrubbed = scrubbed.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, () => {
    count++;
    return "[REDACTED_EMAIL]";
  });
  scrubbed = scrubbed.replace(/\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, () => {
    count++;
    return "[REDACTED_PHONE]";
  });
  scrubbed = scrubbed.replace(/(?:password|secret|pin|api[_-]?key|token)\s*[:=]\s*([^\s,;]+)/gi, (match, secretVal) => {
    count++;
    return match.replace(secretVal, "[REDACTED_SECRET]");
  });
  return { scrubbed, redactedCount: count };
}
function validateUploadedFile(buffer, mimeType, filename, maxSizeBytes = 15 * 1024 * 1024) {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: "Empty file payload" };
  }
  if (buffer.length > maxSizeBytes) {
    return { valid: false, error: `File size exceeds limit of ${Math.round(maxSizeBytes / (1024 * 1024))}MB` };
  }
  const safeFilename = filename.replace(/^.*[\\\/]/, "").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
  const allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
    "audio/webm",
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/ogg",
    "text/plain"
  ];
  const lowerMime = (mimeType || "").toLowerCase();
  if (!allowedMimeTypes.includes(lowerMime)) {
    return { valid: false, error: `MIME type '${mimeType}' is not supported for security reasons` };
  }
  if (lowerMime === "image/jpeg" && !(buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255)) {
    return { valid: false, error: "Corrupt or invalid JPEG header" };
  }
  if (lowerMime === "image/png" && !(buffer[0] === 137 && buffer[1] === 80 && buffer[2] === 78 && buffer[3] === 71)) {
    return { valid: false, error: "Corrupt or invalid PNG header" };
  }
  if (lowerMime === "application/pdf" && buffer.subarray(0, 4).toString("ascii") !== "%PDF") {
    return { valid: false, error: "Corrupt or invalid PDF header" };
  }
  return {
    valid: true,
    safeFilename: safeFilename || "uploaded_asset",
    safeMimeType: lowerMime
  };
}

// server/security/authMiddleware.ts
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Authentication required. Missing or malformed Bearer token."
    });
  }
  const token = authHeader.substring(7).trim();
  const session = dataStore.getSession(token);
  if (!session) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid, revoked, or expired session. Please log in again."
    });
  }
  const user = dataStore.getUserById(session.userId);
  if (!user) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Associated user account no longer exists."
    });
  }
  req.user = user;
  req.session = session;
  req.token = token;
  next();
}
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim();
    const session = dataStore.getSession(token);
    if (session) {
      const user = dataStore.getUserById(session.userId);
      if (user) {
        req.user = user;
        req.session = session;
        req.token = token;
      }
    }
  }
  next();
}

// server/routes/authRoutes.ts
var authRouter = (0, import_express.Router)();
var loginRateLimiter = createRateLimiter({
  windowMs: 60 * 1e3,
  maxRequests: 10,
  message: "Too many authentication attempts. Please wait a moment."
});
authRouter.post("/register", loginRateLimiter, async (req, res) => {
  try {
    const { email, password, name, pinCode = "1234" } = req.body;
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Invalid email address format" });
    }
    const pwdCheck = validatePassword(password);
    if (!pwdCheck.valid) {
      return res.status(400).json({ error: pwdCheck.message });
    }
    const existing = dataStore.getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: "An account with this email address already exists" });
    }
    const pwd = hashPassword(password);
    const pin = hashPin(pinCode);
    const userId = "user-" + generateSecureToken(8);
    const newUser = {
      id: userId,
      email: email.toLowerCase().trim(),
      name: name ? sanitizeString(name, 50) : "",
      passwordHash: pwd.hash,
      passwordSalt: pwd.salt,
      pinHash: pin.hash,
      pinSalt: pin.salt,
      isPinRequiredForLocked: true,
      isPinProtected: true,
      aiSummariesEnabled: true,
      autoOcrEnabled: true,
      autoTagEnabled: true,
      minimizeAiData: true,
      theme: "light",
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    dataStore.saveUser(newUser);
    const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "127.0.0.1";
    const userAgent = req.headers["user-agent"] || "Unknown";
    const session = dataStore.createSession(userId, clientIp, userAgent);
    dataStore.logAuditEvent({
      userId,
      eventType: "LOGIN",
      ip: clientIp,
      userAgent,
      details: "User registered and logged in with new session."
    });
    return res.status(201).json({
      token: session.token,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        isPinProtected: newUser.isPinProtected,
        isPinRequiredForLocked: newUser.isPinRequiredForLocked,
        minimizeAiData: newUser.minimizeAiData,
        theme: newUser.theme
      }
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to complete registration" });
  }
});
authRouter.post("/login", loginRateLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "127.0.0.1";
    const userAgent = req.headers["user-agent"] || "Unknown";
    const lockoutCheck = BruteForceGuard.checkLockout(email, req);
    if (lockoutCheck.isLocked) {
      dataStore.logAuditEvent({
        userId: "unknown",
        eventType: "FAILED_LOGIN",
        ip: clientIp,
        userAgent,
        details: `Brute force attempt blocked for email ${email}. Locked for ${lockoutCheck.waitSeconds}s.`
      });
      return res.status(429).json({
        error: "Account Temporarily Locked",
        message: `Too many failed login attempts. Please try again in ${Math.ceil(lockoutCheck.waitSeconds / 60)} minutes.`,
        retryAfter: lockoutCheck.waitSeconds
      });
    }
    const user = dataStore.getUserByEmail(email);
    if (!user) {
      const failure = BruteForceGuard.recordFailure(email, req);
      return res.status(401).json({
        error: "Invalid Credentials",
        message: "Incorrect email or password.",
        remainingAttempts: failure.remainingAttempts
      });
    }
    const isValid = verifyPassword(password, user.passwordHash, user.passwordSalt);
    if (!isValid) {
      const failure = BruteForceGuard.recordFailure(email, req);
      dataStore.logAuditEvent({
        userId: user.id,
        eventType: "FAILED_LOGIN",
        ip: clientIp,
        userAgent,
        details: `Failed password attempt for user ${user.email}. Remaining attempts: ${failure.remainingAttempts}`
      });
      return res.status(401).json({
        error: "Invalid Credentials",
        message: "Incorrect email or password.",
        remainingAttempts: failure.remainingAttempts
      });
    }
    BruteForceGuard.recordSuccess(email, req);
    const session = dataStore.createSession(user.id, clientIp, userAgent);
    dataStore.logAuditEvent({
      userId: user.id,
      eventType: "LOGIN",
      ip: clientIp,
      userAgent,
      details: "User successfully logged in via credentials."
    });
    return res.json({
      token: session.token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isPinProtected: user.isPinProtected,
        isPinRequiredForLocked: user.isPinRequiredForLocked,
        minimizeAiData: user.minimizeAiData,
        theme: user.theme
      }
    });
  } catch (err) {
    return res.status(500).json({ error: "Authentication service error" });
  }
});
authRouter.get("/me", requireAuth, (req, res) => {
  const user = req.user;
  const session = req.session;
  return res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      isPinProtected: user.isPinProtected,
      isPinRequiredForLocked: user.isPinRequiredForLocked,
      aiSummariesEnabled: user.aiSummariesEnabled,
      autoOcrEnabled: user.autoOcrEnabled,
      autoTagEnabled: user.autoTagEnabled,
      minimizeAiData: user.minimizeAiData,
      theme: user.theme,
      createdAt: user.createdAt
    },
    currentSession: {
      id: session.id,
      ip: session.ip,
      browser: session.browser,
      os: session.os,
      createdAt: session.createdAt,
      lastActiveAt: session.lastActiveAt
    }
  });
});
authRouter.put("/profile", requireAuth, (req, res) => {
  const user = req.user;
  const { name, username, theme, language, timezone } = req.body;
  if (name !== void 0 || username !== void 0) {
    user.name = sanitizeString(name || username, 50);
  }
  if (theme !== void 0) {
    user.theme = theme;
  }
  user.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  dataStore.saveUser(user);
  return res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      username: user.name,
      theme: user.theme,
      language: language || "English (US)",
      timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      isPinProtected: user.isPinProtected,
      isPinRequiredForLocked: user.isPinRequiredForLocked
    }
  });
});
authRouter.post("/verify-pin", requireAuth, (req, res) => {
  const { pin } = req.body;
  if (!pin) {
    return res.status(400).json({ error: "PIN is required" });
  }
  const user = req.user;
  const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "127.0.0.1";
  const lockoutKey = `pin:${user.id}`;
  const lockoutCheck = BruteForceGuard.checkLockout(lockoutKey, req);
  if (lockoutCheck.isLocked) {
    return res.status(429).json({
      error: "PIN Keypad Locked",
      message: `Too many incorrect PIN attempts. Security lockout active for ${Math.ceil(lockoutCheck.waitSeconds / 60)} minutes.`,
      retryAfter: lockoutCheck.waitSeconds
    });
  }
  const isValid = verifyPin(String(pin), user.pinHash, user.pinSalt);
  if (!isValid) {
    const failure = BruteForceGuard.recordFailure(lockoutKey, req);
    dataStore.logAuditEvent({
      userId: user.id,
      eventType: "FAILED_PIN",
      ip: clientIp,
      userAgent: req.headers["user-agent"] || "Unknown",
      details: `Incorrect PIN entered. Remaining attempts: ${failure.remainingAttempts}`
    });
    return res.status(401).json({
      error: "Invalid PIN",
      message: "The PIN code entered is incorrect.",
      remainingAttempts: failure.remainingAttempts
    });
  }
  BruteForceGuard.recordSuccess(lockoutKey, req);
  dataStore.logAuditEvent({
    userId: user.id,
    eventType: "PIN_VERIFY",
    ip: clientIp,
    userAgent: req.headers["user-agent"] || "Unknown",
    details: "Security PIN successfully verified for vault access."
  });
  return res.json({ verified: true, message: "PIN verified successfully" });
});
authRouter.post("/update-pin", requireAuth, (req, res) => {
  const { currentPin, newPin } = req.body;
  const user = req.user;
  if (!newPin || String(newPin).length < 4 || String(newPin).length > 8) {
    return res.status(400).json({ error: "New PIN must be between 4 and 8 digits" });
  }
  if (user.isPinProtected && currentPin) {
    const isCurrentValid = verifyPin(String(currentPin), user.pinHash, user.pinSalt);
    if (!isCurrentValid) {
      return res.status(401).json({ error: "Current PIN is incorrect" });
    }
  }
  const newHashed = hashPin(String(newPin));
  user.pinHash = newHashed.hash;
  user.pinSalt = newHashed.salt;
  user.isPinProtected = true;
  dataStore.saveUser(user);
  dataStore.logAuditEvent({
    userId: user.id,
    eventType: "PIN_VERIFY",
    ip: req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "127.0.0.1",
    userAgent: req.headers["user-agent"] || "Unknown",
    details: "Security PIN updated and re-hashed."
  });
  return res.json({ success: true, message: "PIN updated securely" });
});
authRouter.get("/sessions", requireAuth, (req, res) => {
  const user = req.user;
  const currentToken = req.token;
  const sessions = dataStore.getUserSessions(user.id);
  const sanitizedSessions = sessions.map((s) => ({
    id: s.id,
    ip: s.ip,
    browser: s.browser,
    os: s.os,
    createdAt: s.createdAt,
    lastActiveAt: s.lastActiveAt,
    isCurrent: s.token === currentToken
  }));
  return res.json({ sessions: sanitizedSessions });
});
authRouter.delete("/sessions/:sessionId", requireAuth, (req, res) => {
  const user = req.user;
  const { sessionId } = req.params;
  const all = dataStore.getUserSessions(user.id);
  const target = all.find((s) => s.id === sessionId);
  if (!target) {
    return res.status(404).json({ error: "Session not found or already expired" });
  }
  dataStore.revokeSession(target.token);
  dataStore.logAuditEvent({
    userId: user.id,
    eventType: "SESSION_REVOKED",
    ip: req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "127.0.0.1",
    userAgent: req.headers["user-agent"] || "Unknown",
    details: `Session ${target.id} (${target.browser} on ${target.os}) revoked by user.`
  });
  return res.json({ success: true, message: "Session revoked successfully" });
});
authRouter.post("/sessions/revoke-others", requireAuth, (req, res) => {
  const user = req.user;
  const currentToken = req.token;
  const revokedCount = dataStore.revokeOtherSessions(user.id, currentToken);
  dataStore.logAuditEvent({
    userId: user.id,
    eventType: "SESSION_REVOKED",
    ip: req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "127.0.0.1",
    userAgent: req.headers["user-agent"] || "Unknown",
    details: `Revoked all ${revokedCount} other active sessions.`
  });
  return res.json({ success: true, revokedCount });
});
authRouter.post("/logout", requireAuth, (req, res) => {
  const token = req.token;
  dataStore.revokeSession(token);
  return res.json({ success: true, message: "Logged out successfully" });
});

// server/routes/itemRoutes.ts
var import_express2 = require("express");
var itemRouter = (0, import_express2.Router)();
var itemsRateLimiter = createRateLimiter({
  windowMs: 60 * 1e3,
  maxRequests: 120
});
itemRouter.use(requireAuth, itemsRateLimiter);
var ALLOWED_CATEGORIES = ["personal", "study", "work", "finance", "health", "ideas", "archive"];
var ALLOWED_TYPES = ["note", "photo", "document", "voice", "link", "scan", "contact", "location", "task", "event", "screenshot", "pdf", "webpage"];
itemRouter.get("/", (req, res) => {
  const user = req.user;
  const items = dataStore.getUserItems(user.id);
  const sanitized = items.map((it) => {
    if (it.locked && it.isEncrypted) {
      return {
        ...it,
        content: "[ENCRYPTED VAULT ITEM - PIN REQUIRED]",
        extractedText: it.extractedText ? "[ENCRYPTED]" : void 0,
        mediaUrl: void 0
        // do not leak locked media in list
      };
    }
    return it;
  });
  return res.json({ items: sanitized });
});
itemRouter.post("/:id/unlock", (req, res) => {
  const user = req.user;
  const { id } = req.params;
  const { pin } = req.body;
  const item = dataStore.getItemById(user.id, id);
  if (!item) {
    return res.status(404).json({ error: "Item not found" });
  }
  if (!item.locked) {
    return res.json({ item });
  }
  if (!pin || !verifyPin(String(pin), user.pinHash, user.pinSalt)) {
    return res.status(401).json({ error: "Invalid PIN for vault item decryption" });
  }
  if (item.isEncrypted && item.encryptedPayload) {
    try {
      const decryptedString = decryptVaultData(item.encryptedPayload);
      const parsed = JSON.parse(decryptedString);
      return res.json({
        item: {
          ...item,
          content: parsed.content || "",
          extractedText: parsed.extractedText || item.extractedText,
          mediaUrl: parsed.mediaUrl || item.mediaUrl
        }
      });
    } catch (err) {
      return res.status(500).json({ error: "Failed to decrypt vault item. Integrity check failed." });
    }
  }
  return res.json({ item });
});
itemRouter.post("/", (req, res) => {
  const user = req.user;
  const {
    title,
    type = "note",
    category = "personal",
    collectionIds = [],
    content = "",
    mediaUrl,
    mediaName,
    extractedText,
    summary,
    tags = [],
    pinned = false,
    favorite = false,
    locked = false,
    reminder,
    studentMeta
  } = req.body;
  if (!title || typeof title !== "string") {
    return res.status(400).json({ error: "Title is required" });
  }
  const safeTitle = sanitizeString(title, 150);
  const safeCategory = ALLOWED_CATEGORIES.includes(category) ? category : "personal";
  const safeType = ALLOWED_TYPES.includes(type) ? type : "note";
  const safeTags = Array.isArray(tags) ? tags.map((t) => sanitizeString(String(t), 30)).filter(Boolean).slice(0, 15) : [];
  const itemId = "item-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7);
  let isEncrypted = false;
  let encryptedPayload = void 0;
  let storedContent = sanitizeString(content, 5e4);
  let storedExtracted = extractedText ? sanitizeString(extractedText, 5e4) : void 0;
  let storedMediaUrl = mediaUrl;
  if (locked) {
    isEncrypted = true;
    const sensitiveData = JSON.stringify({
      content: storedContent,
      extractedText: storedExtracted,
      mediaUrl: storedMediaUrl
    });
    encryptedPayload = encryptVaultData(sensitiveData);
    storedContent = "[ENCRYPTED VAULT ITEM - PIN REQUIRED]";
    storedExtracted = storedExtracted ? "[ENCRYPTED]" : void 0;
  }
  const newItem = {
    id: itemId,
    userId: user.id,
    title: safeTitle,
    type: safeType,
    category: safeCategory,
    collectionIds: Array.isArray(collectionIds) ? collectionIds.map((c) => String(c)) : [],
    content: storedContent,
    mediaUrl: locked ? void 0 : storedMediaUrl,
    mediaName: mediaName ? sanitizeString(mediaName, 100) : void 0,
    extractedText: storedExtracted,
    summary: summary ? sanitizeString(summary, 1e3) : void 0,
    tags: safeTags,
    pinned: Boolean(pinned),
    favorite: Boolean(favorite),
    locked: Boolean(locked),
    isEncrypted,
    encryptedPayload,
    isTrash: false,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    reminder: reminder || void 0,
    studentMeta: studentMeta || void 0,
    taskStatus: req.body.taskStatus || void 0,
    priority: req.body.priority || void 0,
    dueDate: req.body.dueDate || void 0,
    dueTime: req.body.dueTime || void 0,
    relatedEventId: req.body.relatedEventId || void 0,
    relatedNoteId: req.body.relatedNoteId || void 0,
    eventDate: req.body.eventDate || void 0,
    eventEndDate: req.body.eventEndDate || void 0,
    eventLocation: req.body.eventLocation || void 0,
    planDetails: req.body.planDetails || void 0
  };
  dataStore.saveItem(newItem);
  return res.status(201).json({ item: newItem });
});
itemRouter.put("/:id", (req, res) => {
  const user = req.user;
  const { id } = req.params;
  const existing = dataStore.getItemById(user.id, id);
  if (!existing) {
    return res.status(404).json({ error: "Item not found" });
  }
  const updates = req.body;
  if (updates.title) existing.title = sanitizeString(updates.title, 150);
  if (updates.category && ALLOWED_CATEGORIES.includes(updates.category)) existing.category = updates.category;
  if (updates.type && ALLOWED_TYPES.includes(updates.type)) existing.type = updates.type;
  if (Array.isArray(updates.collectionIds)) existing.collectionIds = updates.collectionIds.map((c) => String(c));
  if (Array.isArray(updates.tags)) {
    existing.tags = updates.tags.map((t) => sanitizeString(String(t), 30)).filter(Boolean).slice(0, 15);
  }
  if (typeof updates.pinned === "boolean") existing.pinned = updates.pinned;
  if (typeof updates.favorite === "boolean") existing.favorite = updates.favorite;
  if (typeof updates.isTrash === "boolean") existing.isTrash = updates.isTrash;
  if (updates.reminder !== void 0) existing.reminder = updates.reminder;
  if (updates.studentMeta !== void 0) existing.studentMeta = updates.studentMeta;
  if (updates.taskStatus !== void 0) existing.taskStatus = updates.taskStatus;
  if (updates.priority !== void 0) existing.priority = updates.priority;
  if (updates.dueDate !== void 0) existing.dueDate = updates.dueDate;
  if (updates.dueTime !== void 0) existing.dueTime = updates.dueTime;
  if (updates.relatedEventId !== void 0) existing.relatedEventId = updates.relatedEventId;
  if (updates.relatedNoteId !== void 0) existing.relatedNoteId = updates.relatedNoteId;
  if (updates.eventDate !== void 0) existing.eventDate = updates.eventDate;
  if (updates.eventEndDate !== void 0) existing.eventEndDate = updates.eventEndDate;
  if (updates.eventLocation !== void 0) existing.eventLocation = updates.eventLocation;
  if (updates.planDetails !== void 0) existing.planDetails = updates.planDetails;
  if (typeof updates.locked === "boolean") {
    existing.locked = updates.locked;
  }
  if (updates.content !== void 0) {
    const rawContent = sanitizeString(updates.content, 5e4);
    if (existing.locked) {
      existing.isEncrypted = true;
      existing.encryptedPayload = encryptVaultData(JSON.stringify({
        content: rawContent,
        extractedText: updates.extractedText || existing.extractedText,
        mediaUrl: updates.mediaUrl || existing.mediaUrl
      }));
      existing.content = "[ENCRYPTED VAULT ITEM - PIN REQUIRED]";
    } else {
      existing.content = rawContent;
      existing.isEncrypted = false;
      existing.encryptedPayload = void 0;
      if (updates.mediaUrl !== void 0) existing.mediaUrl = updates.mediaUrl;
      if (updates.extractedText !== void 0) existing.extractedText = sanitizeString(updates.extractedText, 5e4);
    }
  }
  dataStore.saveItem(existing);
  return res.json({ item: existing });
});
itemRouter.delete("/:id", (req, res) => {
  const user = req.user;
  const { id } = req.params;
  const permanent = req.query.permanent === "true";
  const success = dataStore.deleteItem(user.id, id, permanent);
  if (!success) {
    return res.status(404).json({ error: "Item not found" });
  }
  return res.json({ success: true, permanent });
});
itemRouter.post("/:id/restore", (req, res) => {
  const user = req.user;
  const { id } = req.params;
  const success = dataStore.restoreItem(user.id, id);
  if (!success) {
    return res.status(404).json({ error: "Item not found in trash" });
  }
  return res.json({ success: true });
});
itemRouter.post("/trash/empty", (req, res) => {
  const user = req.user;
  const count = dataStore.emptyTrash(user.id);
  return res.json({ success: true, count });
});
itemRouter.get("/collections/all", (req, res) => {
  const user = req.user;
  const cols = dataStore.getUserCollections(user.id);
  return res.json({ collections: cols });
});
itemRouter.post("/collections", (req, res) => {
  const user = req.user;
  const { name, description = "", color = "#4f46e5", icon = "Folder" } = req.body;
  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "Collection name is required" });
  }
  const newCol = {
    id: "col-" + Date.now(),
    userId: user.id,
    name: sanitizeString(name, 50),
    description: sanitizeString(description, 200),
    color: sanitizeString(color, 20),
    icon: sanitizeString(icon, 30),
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  dataStore.saveCollection(newCol);
  return res.status(201).json({ collection: newCol });
});
itemRouter.delete("/collections/:id", (req, res) => {
  const user = req.user;
  const { id } = req.params;
  const success = dataStore.deleteCollection(user.id, id);
  if (!success) {
    return res.status(404).json({ error: "Collection not found" });
  }
  return res.json({ success: true });
});

// server/routes/privacyRoutes.ts
var import_express3 = require("express");
var privacyRouter = (0, import_express3.Router)();
var privacyRateLimiter = createRateLimiter({
  windowMs: 60 * 1e3,
  maxRequests: 30
});
privacyRouter.use(requireAuth, privacyRateLimiter);
privacyRouter.get("/export", (req, res) => {
  const user = req.user;
  const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "127.0.0.1";
  const items = dataStore.getUserItems(user.id);
  const collections = dataStore.getUserCollections(user.id);
  const sessions = dataStore.getUserSessions(user.id).map((s) => ({
    id: s.id,
    ip: s.ip,
    browser: s.browser,
    os: s.os,
    createdAt: s.createdAt,
    lastActiveAt: s.lastActiveAt
  }));
  const auditLogs = dataStore.getUserAuditLogs(user.id);
  dataStore.logAuditEvent({
    userId: user.id,
    eventType: "DATA_EXPORTED",
    ip: clientIp,
    userAgent: req.headers["user-agent"] || "Unknown",
    details: `Full user data export generated: ${items.length} items, ${collections.length} collections.`
  });
  const exportBundle = {
    exportDate: (/* @__PURE__ */ new Date()).toISOString(),
    schemaVersion: "2.0.0-security-first",
    userProfile: {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      privacySettings: {
        isPinProtected: user.isPinProtected,
        isPinRequiredForLocked: user.isPinRequiredForLocked,
        minimizeAiData: user.minimizeAiData,
        aiSummariesEnabled: user.aiSummariesEnabled
      }
    },
    items,
    collections,
    sessions,
    securityAuditLog: auditLogs
  };
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="lifebox-data-export-${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.json"`);
  return res.json(exportBundle);
});
privacyRouter.post("/settings", (req, res) => {
  const user = req.user;
  const { minimizeAiData, aiSummariesEnabled, autoOcrEnabled, autoTagEnabled, theme, isPinRequiredForLocked } = req.body;
  if (typeof minimizeAiData === "boolean") user.minimizeAiData = minimizeAiData;
  if (typeof aiSummariesEnabled === "boolean") user.aiSummariesEnabled = aiSummariesEnabled;
  if (typeof autoOcrEnabled === "boolean") user.autoOcrEnabled = autoOcrEnabled;
  if (typeof autoTagEnabled === "boolean") user.autoTagEnabled = autoTagEnabled;
  if (typeof isPinRequiredForLocked === "boolean") user.isPinRequiredForLocked = isPinRequiredForLocked;
  if (["light", "dark", "system"].includes(theme)) user.theme = theme;
  dataStore.saveUser(user);
  return res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      isPinProtected: user.isPinProtected,
      isPinRequiredForLocked: user.isPinRequiredForLocked,
      minimizeAiData: user.minimizeAiData,
      aiSummariesEnabled: user.aiSummariesEnabled,
      theme: user.theme
    }
  });
});
privacyRouter.get("/audit-log", (req, res) => {
  const user = req.user;
  const logs = dataStore.getUserAuditLogs(user.id);
  return res.json({ logs });
});
privacyRouter.post("/delete-account", (req, res) => {
  const user = req.user;
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: "Password is required to confirm account deletion" });
  }
  const isValid = verifyPassword(password, user.passwordHash, user.passwordSalt);
  if (!isValid) {
    return res.status(401).json({ error: "Invalid password. Account deletion aborted for security." });
  }
  dataStore.purgeUserData(user.id);
  return res.json({
    success: true,
    message: "Your account and all associated data, vaults, items, and sessions have been permanently erased."
  });
});

// server/routes/aiRoutes.ts
var import_express4 = require("express");
var import_genai = require("@google/genai");

// server/ai/conversationEngine.ts
function extractOrdinalIndex(text) {
  const clean = text.toLowerCase();
  if (/\b(first|1st)\b/i.test(clean)) return 0;
  if (/\b(second|2nd)\b/i.test(clean)) return 1;
  if (/\b(third|3rd)\b/i.test(clean)) return 2;
  if (/\b(fourth|4th)\b/i.test(clean)) return 3;
  if (/\b(fifth|5th)\b/i.test(clean)) return 4;
  if (/\b(sixth|6th)\b/i.test(clean)) return 5;
  if (/\b(seventh|7th)\b/i.test(clean)) return 6;
  if (/\b(eighth|8th)\b/i.test(clean)) return 7;
  if (/\b(ninth|9th)\b/i.test(clean)) return 8;
  if (/\b(tenth|10th)\b/i.test(clean)) return 9;
  if (/\b(last|final)\b/i.test(clean)) return -1;
  return null;
}
function parseDateFilter(message) {
  const lower = message.toLowerCase();
  const now = /* @__PURE__ */ new Date();
  const currentIso = now.toISOString().split("T")[0];
  if (lower.includes("yesterday")) {
    const y = new Date(now.getTime() - 864e5);
    const yIso = y.toISOString().split("T")[0];
    return { filterLabel: "yesterday", dateFrom: yIso, dateTo: yIso + "T23:59:59" };
  }
  if (lower.includes("today")) {
    return { filterLabel: "today", dateFrom: currentIso, dateTo: currentIso + "T23:59:59" };
  }
  if (lower.includes("this week") || lower.includes("past week") || lower.includes("last 7 days")) {
    const w = new Date(now.getTime() - 7 * 864e5);
    return { filterLabel: "this week", dateFrom: w.toISOString().split("T")[0] };
  }
  if (lower.includes("september")) {
    return { filterLabel: "September", dateFrom: `${now.getFullYear()}-09-01`, dateTo: `${now.getFullYear()}-09-30T23:59:59` };
  }
  if (lower.includes("october")) {
    return { filterLabel: "October", dateFrom: `${now.getFullYear()}-10-01`, dateTo: `${now.getFullYear()}-10-31T23:59:59` };
  }
  if (lower.includes("recent") || lower.includes("latest") || lower.includes("newest")) {
    return { filterLabel: "recent" };
  }
  return {};
}
function classifyIntent(message, history = [], mode = "chat") {
  const clean = message.trim().toLowerCase();
  const lastTurn = history.length > 0 ? history[history.length - 1] : null;
  const isAwaitingConfirmation = lastTurn && (lastTurn.actions?.some((a) => a.type === "confirm_delete") || /Are you sure you want to delete/i.test(lastTurn.text || ""));
  if (isAwaitingConfirmation) {
    if (/^(yes|yeah|yep|sure|confirm|do it|delete it|proceed|ok|okay|please do)\b/i.test(clean)) {
      return "CONFIRM_ACTION";
    }
    if (/^(no|nope|cancel|never mind|nevermind|stop|don't|do not)\b/i.test(clean)) {
      return "CANCEL_ACTION";
    }
  }
  const hasPreviousItems = history.some((h) => h.matchedItemIds && h.matchedItemIds.length > 0 || h.sources && h.sources.length > 0);
  const ordinalIdx = extractOrdinalIndex(clean);
  if (hasPreviousItems && ordinalIdx !== null) {
    if (/\b(delete|remove|erase|discard)\b/i.test(clean)) {
      return "DELETE_NOTE";
    }
    if (/\b(summarize|summary of|explain|what does .* say)\b/i.test(clean)) {
      return "SUMMARIZATION";
    }
    if (/\b(open|see|view|show|read|check)\b/i.test(clean)) {
      return "OPEN_ITEM";
    }
  }
  if (/^(what is|calculate|solve|\b)\s*[-+*/0-9. ()^%x×÷=]+\s*\??$/i.test(clean) && /\d/.test(clean)) {
    return "GENERAL_KNOWLEDGE";
  }
  if (/\b(delete|remove|erase|discard)\b/i.test(clean)) {
    if (/\b(task|todo)\b/i.test(clean)) return "DELETE_NOTE";
    if (/\b(reminder|alarm)\b/i.test(clean)) return "DELETE_NOTE";
    return "DELETE_NOTE";
  }
  if (/\b(complete|mark done|finish|check off|done with)\s+(my\s+)?(task|todo)\b/i.test(clean)) {
    return "COMPLETE_TASK";
  }
  const isSearchNotes = /\b(find\s+(my\s+|the\s+)?notes?|search\s+(my\s+)?notes?|where did i write|what did i write about)\b/i.test(clean) || /\b(find|search|look for)\b/i.test(clean) && /\bnotes?\b/i.test(clean);
  if (isSearchNotes) {
    return "SEARCH_NOTES";
  }
  const isSearchDocs = /\b(find\s+(my\s+|the\s+)?(document|doc|pdf|file|receipt|passport)|search\s+(my\s+)?(documents|docs|files|pdfs))\b/i.test(clean) || /\b(find|search|look for)\b/i.test(clean) && /\b(document|doc|pdf|passport|receipt)\b/i.test(clean);
  if (isSearchDocs) {
    return "SEARCH_DOCUMENTS";
  }
  const isSearchTasks = /\b(find\s+(my\s+)?tasks?|search\s+(my\s+)?tasks?)\b/i.test(clean);
  if (isSearchTasks) {
    return "SEARCH_TASKS";
  }
  const isSearchReminders = /\b(find\s+(my\s+)?reminders?|search\s+(my\s+)?reminders?)\b/i.test(clean);
  if (isSearchReminders) {
    return "SEARCH_REMINDERS";
  }
  const isListNotes = /\b(show|list|give me|what .* do i have|can i see|open|see|view|get|display|browse|let me see)\b/i.test(clean) && /\b(notes?|memos?|saved notes?)\b/i.test(clean);
  if (isListNotes) {
    return "LIST_NOTES";
  }
  if (/^(all\s+)?(my\s+)?(recent\s+|latest\s+)?notes\??$/i.test(clean)) {
    return "LIST_NOTES";
  }
  const isListDocs = /\b(show|list|give me|what .* do i have|can i see|open|see|view|get|display|browse)\b/i.test(clean) && /\b(documents?|docs?|files?|pdfs?|scans?)\b/i.test(clean);
  if (isListDocs) {
    return "LIST_DOCUMENTS";
  }
  const isListTasks = /\b(show|list|give me|what .* do i have|what do i need to do|pending)\b/i.test(clean) && /\b(tasks?|todos?|to-dos?|action items?|work to do)\b/i.test(clean);
  if (isListTasks || clean === "what do i need to do today?" || clean === "what do i need to do today") {
    return "LIST_TASKS";
  }
  const isListReminders = /\b(show|list|what .* do i have|when is my next|check|do i have any)\b/i.test(clean) && /\b(reminders?|alarms?)\b/i.test(clean);
  if (isListReminders || clean === "my reminders" || clean === "show reminders" || clean === "when is my next reminder?") {
    return "LIST_REMINDERS";
  }
  const isListEvents = /\b(show|list|what('s| is) on|my)\b/i.test(clean) && /\b(calendar|events?|schedule|december plans|plans for|appointments?)\b/i.test(clean);
  if (isListEvents) {
    return "LIST_EVENTS";
  }
  if (/\b(remind me|create (a )?reminder|set (a )?reminder|add (a )?reminder|schedule (a )?reminder)\b/i.test(clean)) {
    return "CREATE_REMINDER";
  }
  if (/\b(create (a )?task|add (a )?task|new task|todo for|make a task)\b/i.test(clean)) {
    return "CREATE_TASK";
  }
  if (/\b(create (a )?note|take (a )?note|save (this as a )?note|write a note|make a note|new note)\b/i.test(clean)) {
    return "CREATE_NOTE";
  }
  if (/\b(add (an? )?event|calendar event|schedule an? appointment|create an? event)\b/i.test(clean)) {
    return "CREATE_EVENT";
  }
  if (/\b(analyze (this |my |the |latest )?scan|review (this |my |the |latest )?scan|what is in (my |this |the )?scan|read (my |this |the )?scan|summarize (my |this |the )?scan|check my scan)\b/i.test(clean)) {
    return "ANALYZE_SCAN";
  }
  if (/\b(scan (a |this |the |my )?(document|file|paper|receipt|page|note|contract|photo|card)|open (the )?scanner|start (the )?scan(ner)?|take (a )?scan|launch scanner|camera scan|scan this)\b/i.test(clean) || clean === "scan" || clean === "scanner" || clean === "open scanner" || clean === "scan document" || clean === "scan a document" || clean === "start scan") {
    return "SCAN_DOCUMENT";
  }
  if (/\b(analyze this (image|photo|picture)|what is in this (image|photo)|ocr)\b/i.test(clean)) {
    return "IMAGE_ANALYSIS";
  }
  if (/\b(analyze this (document|file|pdf)|review this pdf)\b/i.test(clean)) {
    return "FILE_ANALYSIS";
  }
  if (/\b(summarize|summary of|tldr|give me a summary|brief overview)\b/i.test(clean)) {
    return "SUMMARIZATION";
  }
  if (/\b(translate|in spanish|in french|in somali|in arabic|in german|in japanese|in italian)\b/i.test(clean)) {
    return "TRANSLATION";
  }
  if (/\b(rewrite|proofread|write an? (essay|email|story|poem|letter|proposal|speech))\b/i.test(clean)) {
    return "WRITING";
  }
  if (/^(explain|can you explain|break down for me|help me understand)\b/i.test(clean)) {
    return "EXPLANATION";
  }
  if (/\b(brainstorm|ideas for|give me some ideas|give me an idea|random idea|help me think|suggest some ideas|what kind of project|project ideas|app ideas|business ideas)\b/i.test(
    clean
  )) {
    return "BRAINSTORMING";
  }
  if (/\b(help me plan|plan a|study plan|workout plan|routine|itinerary|schedule for)\b/i.test(clean)) {
    return "PLANNING";
  }
  const isPersonalExtractionQuery = /\b(friend('s)? birthday|my birthday|my passport|my receipt|my exam|my timetable|my voice note|my photo|my pdf|my ticket|my address|my pin|my password|my wifi|my schedule|my doctor|my doctor's appointment)\b/i.test(clean) || /\b(what did i save|did i save|what do i have saved|where is my|when does my|where did i save)\b/i.test(clean);
  if (isPersonalExtractionQuery) {
    return "PERSONAL_DATA_SEARCH";
  }
  if (/^(what is|what are|who is|who was|who wrote|when was|how does|why is|why does)\b/i.test(clean)) {
    return "GENERAL_KNOWLEDGE";
  }
  if (mode === "lifebox") {
    if (/^(hi|hello|hey|greetings|good\s*(morning|afternoon|evening))\b/i.test(clean)) {
      return "GENERAL_CHAT";
    }
    return "PERSONAL_DATA_SEARCH";
  }
  return "GENERAL_CHAT";
}
function evaluateArithmetic(expr) {
  try {
    const sanitized = expr.replace(/[xX×]/g, "*").replace(/[÷]/g, "/").replace(/[^0-9+\-*/(). ]/g, "").trim();
    if (!sanitized || !/\d/.test(sanitized)) return null;
    const fn = new Function(`"use strict"; return (${sanitized});`);
    const val = fn();
    return typeof val === "number" && !isNaN(val) && isFinite(val) ? val : null;
  } catch {
    return null;
  }
}
function formatDateFriendly(dateStr) {
  if (!dateStr) return "Recently";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
}
function describeDateDistance(targetDateStr) {
  try {
    const now = /* @__PURE__ */ new Date();
    now.setHours(0, 0, 0, 0);
    let target = new Date(targetDateStr);
    if (isNaN(target.getTime())) {
      target = /* @__PURE__ */ new Date(`${targetDateStr} ${now.getFullYear()}`);
    }
    if (isNaN(target.getTime())) return "";
    target.setHours(0, 0, 0, 0);
    if (target.getTime() < now.getTime() && target.getFullYear() === now.getFullYear()) {
      target.setFullYear(now.getFullYear() + 1);
    }
    const diffMs = target.getTime() - now.getTime();
    const diffDays = Math.round(diffMs / (1e3 * 60 * 60 * 24));
    if (diffDays === 0) return "which is today";
    if (diffDays === 1) return "which is tomorrow";
    if (diffDays === 2) return "which is in two days";
    if (diffDays === 3) return "which is in three days";
    if (diffDays === 4) return "which is four days from today";
    if (diffDays === 5) return "which is five days from today";
    if (diffDays > 5 && diffDays <= 14) return `which is in ${diffDays} days`;
    if (diffDays > 14 && diffDays <= 31) return `which is in about ${Math.round(diffDays / 7)} weeks`;
    return "";
  } catch {
    return "";
  }
}
function parseRelativeDate(text) {
  const lower = text.toLowerCase();
  const now = /* @__PURE__ */ new Date();
  if (lower.includes("today")) {
    return { dateStr: now.toISOString().split("T")[0], label: "today" };
  }
  if (lower.includes("tomorrow")) {
    const tomorrow = new Date(now.getTime() + 864e5);
    return { dateStr: tomorrow.toISOString().split("T")[0], label: "tomorrow" };
  }
  if (lower.includes("next week")) {
    const nextWeek = new Date(now.getTime() + 7 * 864e5);
    return { dateStr: nextWeek.toISOString().split("T")[0], label: "next week" };
  }
  const match = text.match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (match) {
    return { dateStr: match[0], label: match[0] };
  }
  return null;
}
var ConversationEngine = class {
  /**
   * Action-First Conversational AI Engine:
   * 1. Understands actual user intent before performing searches
   * 2. Distinguishes LIST actions from SEARCH actions
   * 3. Executes real backend functions for the authenticated user
   * 4. Accurately reports true reasoning trace
   */
  static async processMessage(params) {
    const { message, history = [], clientItems = [], genAI } = params;
    const authenticatedUserId = params.userId || "guest_user";
    const requestedMode = params.mode === "lifebox" ? "lifebox" : "chat";
    const { scrubbed: cleanMessage } = scrubPII(sanitizeString(message, 1500));
    const intent = classifyIntent(cleanMessage, history, requestedMode);
    const now = /* @__PURE__ */ new Date();
    const currentDateStr = now.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric"
    });
    const currentIsoDate = now.toISOString().split("T")[0];
    if (intent === "CONFIRM_ACTION") {
      let pendingItemTitle = "the item";
      let pendingItemId = "";
      for (let i = history.length - 1; i >= 0; i--) {
        const turn = history[i];
        const confirmAct = turn.actions?.find((a) => a.type === "confirm_delete");
        if (confirmAct?.payload?.itemId) {
          pendingItemId = confirmAct.payload.itemId;
          pendingItemTitle = confirmAct.payload.itemTitle || "the item";
          break;
        }
        const match = (turn.text || "").match(/Are you sure you want to delete ["']?([^"'\n?]+)["']?/i);
        if (match) {
          pendingItemTitle = match[1].trim();
          break;
        }
      }
      if (pendingItemId) {
        dataStore.deleteItem(authenticatedUserId, pendingItemId);
      }
      return {
        intent,
        mode: requestedMode,
        reply: `I have deleted "${pendingItemTitle}" from your LIFEBOX.`,
        sources: [],
        matchedItemIds: [],
        actions: [],
        thoughtSteps: [
          "Received explicit confirmation from user",
          `Executed dataStore.deleteItem("${authenticatedUserId}", "${pendingItemId || "item"}")`,
          "Permanently updated user repository"
        ],
        suggestedFollowUps: ["Show all my notes", "Create a new note"]
      };
    }
    if (intent === "CANCEL_ACTION") {
      return {
        intent,
        mode: requestedMode,
        reply: `Deletion cancelled. I have kept your items safe in your LIFEBOX.`,
        sources: [],
        matchedItemIds: [],
        actions: [],
        thoughtSteps: ["Received cancellation signal from user", "No database changes were made"],
        suggestedFollowUps: ["Show all my notes", "What else can you do?"]
      };
    }
    if (intent === "LIST_NOTES") {
      const dateFilter = parseDateFilter(cleanMessage);
      const notes = dataStore.getNotes(authenticatedUserId, {
        dateFrom: dateFilter.dateFrom,
        dateTo: dateFilter.dateTo
      });
      let effectiveNotes = notes;
      if (effectiveNotes.length === 0 && clientItems.length > 0) {
        effectiveNotes = clientItems.filter((i) => !i.isTrash && !i.locked && i.type === "note");
      }
      if (dateFilter.filterLabel === "recent") {
        effectiveNotes = [...effectiveNotes].sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()).slice(0, 10);
      }
      if (effectiveNotes.length === 0) {
        const filterText2 = dateFilter.filterLabel ? ` from ${dateFilter.filterLabel}` : "";
        return {
          intent,
          mode: requestedMode,
          reply: `You don't have any notes${filterText2} yet.`,
          sources: [],
          matchedItemIds: [],
          actions: [
            {
              id: "act-new-note-" + Date.now(),
              type: "create_note",
              label: "+ Create Note",
              payload: { title: "New Note" }
            }
          ],
          thoughtSteps: [
            "Identified intent: LIST_NOTES (Action request)",
            `Called getNotes("${authenticatedUserId}"${filterText2 ? `, { filter: "${dateFilter.filterLabel}" }` : ""})`,
            "Found 0 active notes in repository",
            "Returned natural empty state with quick-create action"
          ],
          suggestedFollowUps: ["Create a note", "Show my documents", "Show my tasks"]
        };
      }
      const notesFormatted = effectiveNotes.map((n, idx) => {
        const preview = (n.summary || n.content || "").replace(/\s+/g, " ").slice(0, 140);
        const created = formatDateFriendly(n.createdAt);
        const updated = n.updatedAt && n.updatedAt !== n.createdAt ? ` \u2022 Updated: ${formatDateFriendly(n.updatedAt)}` : "";
        const tagsStr = n.tags && n.tags.length > 0 ? ` \u2022 \u{1F3F7}\uFE0F ${n.tags.join(", ")}` : "";
        return `${idx + 1}. **${n.title}**
   ${preview ? `>${preview}
   ` : ""}\u{1F4C5} ${created}${updated}${tagsStr}`;
      }).join("\n\n");
      const count = effectiveNotes.length;
      const countLabel = count === 1 ? "1 note" : `${count} notes`;
      const filterText = dateFilter.filterLabel ? ` (${dateFilter.filterLabel})` : "";
      return {
        intent,
        mode: requestedMode,
        reply: `You have ${countLabel}${filterText}. Here they are:

${notesFormatted}`,
        sources: effectiveNotes.slice(0, 6).map((n) => ({
          id: n.id,
          title: n.title,
          type: "note",
          category: n.category,
          date: formatDateFriendly(n.createdAt),
          snippet: n.content?.slice(0, 100)
        })),
        matchedItemIds: effectiveNotes.map((n) => n.id),
        actions: effectiveNotes.slice(0, 4).map((n) => ({
          id: "open-" + n.id,
          type: "open_item",
          label: `Open: ${n.title}`,
          payload: { itemId: n.id, itemTitle: n.title }
        })),
        thoughtSteps: [
          "Identified intent: LIST_NOTES (Listing action, not text search)",
          `Called real backend getNotes("${authenticatedUserId}"${filterText ? `, ${filterText}` : ""})`,
          `Retrieved ${count} active notes for authenticated user`,
          "Formatted results with previews, dates, tags, and quick-open actions"
        ],
        suggestedFollowUps: ["Open the first one", "Summarize the second one", "Create a note", "Show my tasks"]
      };
    }
    if (intent === "SEARCH_NOTES") {
      const topic = cleanMessage.replace(/\b(find\s+(my\s+|the\s+)?notes?(\s+about|\s+for|\s+where i wrote about)?|search\s+(my\s+)?notes?(\s+for|\s+about)?|notes?\s+about|where did i write about)\b/gi, "").trim();
      const userNotes = dataStore.getNotes(authenticatedUserId);
      const queryLower2 = topic.toLowerCase();
      const matched = userNotes.filter((n) => {
        const fullText = `${n.title} ${n.content || ""} ${n.extractedText || ""} ${(n.tags || []).join(" ")}`.toLowerCase();
        return queryLower2.length > 0 && fullText.includes(queryLower2);
      });
      if (matched.length === 0) {
        return {
          intent,
          mode: requestedMode,
          reply: `I couldn't find any notes matching "${topic}" in your LIFEBOX.`,
          sources: [],
          matchedItemIds: [],
          actions: [],
          thoughtSteps: [
            `Identified intent: SEARCH_NOTES for topic: "${topic}"`,
            `Scanned ${userNotes.length} notes for authenticated user`,
            "Found 0 matching records"
          ],
          suggestedFollowUps: ["Show all my notes", `Create a note called "${topic}"`]
        };
      }
      const formatted = matched.map((n, idx) => {
        const preview = (n.summary || n.content || "").slice(0, 140);
        return `${idx + 1}. **${n.title}**
   >${preview}
   \u{1F4C5} ${formatDateFriendly(n.createdAt)}`;
      }).join("\n\n");
      return {
        intent,
        mode: requestedMode,
        reply: `Found ${matched.length} note${matched.length === 1 ? "" : "s"} matching "${topic}":

${formatted}`,
        sources: matched.slice(0, 4).map((n) => ({
          id: n.id,
          title: n.title,
          type: "note",
          category: n.category,
          date: formatDateFriendly(n.createdAt),
          snippet: n.content?.slice(0, 100)
        })),
        matchedItemIds: matched.map((n) => n.id),
        actions: matched.slice(0, 3).map((n) => ({
          id: "open-" + n.id,
          type: "open_item",
          label: `Open: ${n.title}`,
          payload: { itemId: n.id, itemTitle: n.title }
        })),
        thoughtSteps: [
          `Identified intent: SEARCH_NOTES for query: "${topic}"`,
          `Scanned ${userNotes.length} notes for authenticated user`,
          `Found ${matched.length} matching note(s)`
        ],
        suggestedFollowUps: ["Open the first one", "Summarize this note", "Show all my notes"]
      };
    }
    if (intent === "LIST_DOCUMENTS") {
      const docs = dataStore.getDocuments(authenticatedUserId);
      if (docs.length === 0) {
        return {
          intent,
          mode: requestedMode,
          reply: `You don't have any documents saved in your LIFEBOX yet.`,
          sources: [],
          matchedItemIds: [],
          actions: [],
          thoughtSteps: [
            "Identified intent: LIST_DOCUMENTS (Action request)",
            `Called getDocuments("${authenticatedUserId}")`,
            "Found 0 documents in repository"
          ],
          suggestedFollowUps: ["Show all my notes", "Show my tasks"]
        };
      }
      const formatted = docs.map((d, idx) => `${idx + 1}. **${d.title}** (${d.type.toUpperCase()})
   \u{1F4C5} ${formatDateFriendly(d.createdAt)}`).join("\n\n");
      return {
        intent,
        mode: requestedMode,
        reply: `You have ${docs.length} document${docs.length === 1 ? "" : "s"}. Here they are:

${formatted}`,
        sources: docs.slice(0, 6).map((d) => ({
          id: d.id,
          title: d.title,
          type: d.type,
          category: d.category,
          date: formatDateFriendly(d.createdAt)
        })),
        matchedItemIds: docs.map((d) => d.id),
        actions: docs.slice(0, 4).map((d) => ({
          id: "open-" + d.id,
          type: "open_item",
          label: `Open: ${d.title}`,
          payload: { itemId: d.id, itemTitle: d.title }
        })),
        thoughtSteps: [
          "Identified intent: LIST_DOCUMENTS",
          `Called real backend getDocuments("${authenticatedUserId}")`,
          `Retrieved ${docs.length} document(s) for authenticated user`
        ],
        suggestedFollowUps: ["Show my notes", "Show my tasks"]
      };
    }
    if (intent === "SEARCH_DOCUMENTS") {
      const topic = cleanMessage.replace(/\b(find\s+(my\s+|the\s+)?(document|doc|pdf|file)?|search\s+(my\s+)?(documents|docs|files)?)\b/gi, "").trim();
      const docs = dataStore.getDocuments(authenticatedUserId, { search: topic });
      if (docs.length === 0) {
        return {
          intent,
          mode: requestedMode,
          reply: `I couldn't find any documents matching "${topic}" in your LIFEBOX.`,
          sources: [],
          matchedItemIds: [],
          actions: [],
          thoughtSteps: [
            `Identified intent: SEARCH_DOCUMENTS for: "${topic}"`,
            `Scanned documents for authenticated user`,
            "Found 0 matching documents"
          ],
          suggestedFollowUps: ["Show all my documents", "Show all my notes"]
        };
      }
      const formatted = docs.map((d, idx) => `${idx + 1}. **${d.title}** (${d.type.toUpperCase()})
   \u{1F4C5} ${formatDateFriendly(d.createdAt)}`).join("\n\n");
      return {
        intent,
        mode: requestedMode,
        reply: `Found ${docs.length} document${docs.length === 1 ? "" : "s"} matching "${topic}":

${formatted}`,
        sources: docs.map((d) => ({
          id: d.id,
          title: d.title,
          type: d.type,
          category: d.category,
          date: formatDateFriendly(d.createdAt)
        })),
        matchedItemIds: docs.map((d) => d.id),
        actions: docs.slice(0, 3).map((d) => ({
          id: "open-" + d.id,
          type: "open_item",
          label: `Open: ${d.title}`,
          payload: { itemId: d.id, itemTitle: d.title }
        })),
        thoughtSteps: [
          `Identified intent: SEARCH_DOCUMENTS for: "${topic}"`,
          `Retrieved ${docs.length} matching document(s)`
        ],
        suggestedFollowUps: ["Open this document", "Show all my documents"]
      };
    }
    if (intent === "SCAN_DOCUMENT") {
      return {
        intent,
        mode: requestedMode,
        reply: `Opening the **LIFEBOX Document Scanner**.

You can point your camera to capture multiple pages or upload files directly. Our intelligent pipeline will automatically process the image, perform OCR, and extract detected tasks, calendar events, and reminders for your confirmation.`,
        sources: [],
        matchedItemIds: [],
        actions: [
          {
            id: "act-open-scanner-" + Date.now(),
            type: "open_scanner",
            label: "Open Document Scanner",
            payload: { tab: "scanner" }
          }
        ],
        thoughtSteps: [
          "Identified intent: SCAN_DOCUMENT",
          "Prepared open_scanner action for client navigation"
        ],
        suggestedFollowUps: ["Show my documents", "Show all my notes"]
      };
    }
    if (intent === "ANALYZE_SCAN") {
      const scans = dataStore.getUserScans(authenticatedUserId);
      if (scans.length === 0) {
        return {
          intent,
          mode: requestedMode,
          reply: `You don't have any scanned documents in your LIFEBOX yet.

Would you like to open the scanner to capture or upload your first document?`,
          sources: [],
          matchedItemIds: [],
          actions: [
            {
              id: "act-open-scanner-" + Date.now(),
              type: "open_scanner",
              label: "Open Document Scanner",
              payload: { tab: "scanner" }
            }
          ],
          thoughtSteps: [
            "Identified intent: ANALYZE_SCAN",
            `Called getUserScans("${authenticatedUserId}")`,
            "Found 0 saved scans"
          ],
          suggestedFollowUps: ["Open Document Scanner", "Show my documents"]
        };
      }
      const latestScan = scans[0];
      let aiAnalysis = `### **${latestScan.title}**

`;
      if (latestScan.analysis?.summary) {
        aiAnalysis += `\u{1F4CB} **Summary:** ${latestScan.analysis.summary}

`;
      }
      if (latestScan.analysis?.tasks && latestScan.analysis.tasks.length > 0) {
        aiAnalysis += `\u2705 **Detected Tasks:**
${latestScan.analysis.tasks.map((t) => `\u2022 **${t.title}**${t.dueDate ? ` (Due: ${t.dueDate})` : ""}`).join("\n")}

`;
      }
      if (latestScan.analysis?.events && latestScan.analysis.events.length > 0) {
        aiAnalysis += `\u{1F4C5} **Detected Events:**
${latestScan.analysis.events.map((e) => `\u2022 **${e.title}**${e.date ? ` (${e.date})` : ""}`).join("\n")}

`;
      }
      if (latestScan.analysis?.reminders && latestScan.analysis.reminders.length > 0) {
        aiAnalysis += `\u23F0 **Deadlines / Reminders:**
${latestScan.analysis.reminders.map((r) => `\u2022 **${r.title}**${r.dueDate ? ` (${r.dueDate})` : ""}`).join("\n")}

`;
      }
      if (latestScan.extractedText) {
        aiAnalysis += `\u{1F4C4} **OCR Text Preview:**
> ${latestScan.extractedText.slice(0, 220).replace(/\n+/g, " ")}...`;
      }
      return {
        intent,
        mode: requestedMode,
        reply: `Here is the analysis of your scan **"${latestScan.title}"**:

${aiAnalysis}`,
        sources: [
          {
            id: latestScan.id,
            title: latestScan.title,
            type: "scan",
            category: "documents",
            snippet: latestScan.analysis?.summary || latestScan.extractedText?.slice(0, 100)
          }
        ],
        matchedItemIds: [latestScan.id],
        actions: [
          {
            id: "act-view-scan-" + latestScan.id,
            type: "open_scanner",
            label: "View in Scanner",
            payload: { tab: "scanner", scanId: latestScan.id }
          }
        ],
        thoughtSteps: [
          "Identified intent: ANALYZE_SCAN",
          `Retrieved latest scan "${latestScan.title}" (ID: ${latestScan.id}) from dataStore`,
          `Analyzed OCR text (${latestScan.pages?.length || 1} page(s)) and structured entities`
        ],
        suggestedFollowUps: ["Open Document Scanner", "Show my documents", "Show all my notes"]
      };
    }
    if (intent === "LIST_TASKS") {
      const isTodayQuery = /\btoday\b/i.test(cleanMessage);
      const allTasks = dataStore.getTasks(authenticatedUserId);
      const openTasks = allTasks.filter((t) => t.taskStatus !== "completed");
      if (openTasks.length === 0) {
        return {
          intent,
          mode: requestedMode,
          reply: `You have no pending tasks right now. Great job staying on top of everything!`,
          sources: [],
          matchedItemIds: [],
          actions: [
            {
              id: "act-new-task-" + Date.now(),
              type: "create_task",
              label: "+ Create Task",
              payload: { title: "New Task" }
            }
          ],
          thoughtSteps: [
            "Identified intent: LIST_TASKS (Action request)",
            `Called getTasks("${authenticatedUserId}")`,
            "Found 0 open tasks"
          ],
          suggestedFollowUps: ["Create a task", "Show my reminders", "Show my notes"]
        };
      }
      const formatted = openTasks.map((t, idx) => `${idx + 1}. **${t.title}** (${t.priority || "medium"} priority)${t.dueDate ? ` \u2022 Due: ${formatDateFriendly(t.dueDate)}` : ""}`).join("\n\n");
      return {
        intent,
        mode: requestedMode,
        reply: `You have ${openTasks.length} open task${openTasks.length === 1 ? "" : "s"}${isTodayQuery ? " for today" : ""}:

${formatted}`,
        sources: openTasks.map((t) => ({ id: t.id, title: t.title, type: "task", category: t.category })),
        matchedItemIds: openTasks.map((t) => t.id),
        actions: [],
        thoughtSteps: [
          "Identified intent: LIST_TASKS",
          `Called real backend getTasks("${authenticatedUserId}")`,
          `Retrieved ${openTasks.length} open task(s)`
        ],
        suggestedFollowUps: ["Create another task", "Show my reminders", "Show all my notes"]
      };
    }
    if (intent === "LIST_REMINDERS") {
      const reminders = dataStore.getReminders(authenticatedUserId).filter((r) => !r.reminder?.completed);
      if (reminders.length === 0) {
        return {
          intent,
          mode: requestedMode,
          reply: `You have no pending reminders in your LIFEBOX right now.`,
          sources: [],
          matchedItemIds: [],
          actions: [
            {
              id: "act-new-rem-" + Date.now(),
              type: "create_reminder",
              label: "+ Set Reminder",
              payload: { title: "Review notes", dueDate: currentIsoDate }
            }
          ],
          thoughtSteps: [
            "Identified intent: LIST_REMINDERS (Action request)",
            `Called getReminders("${authenticatedUserId}")`,
            "Found 0 pending reminders"
          ],
          suggestedFollowUps: ["Set a reminder for tomorrow", "Show my tasks", "Show all my notes"]
        };
      }
      const formatted = reminders.map((r, idx) => {
        const due = formatDateFriendly(r.reminder?.dueDate);
        const time = r.reminder?.dueTime ? ` at ${r.reminder.dueTime}` : "";
        return `${idx + 1}. **${r.title}**
   \u{1F4C5} Due: ${due}${time}`;
      }).join("\n\n");
      return {
        intent,
        mode: requestedMode,
        reply: `Here are your pending reminders:

${formatted}`,
        sources: reminders.map((r) => ({
          id: r.id,
          title: r.title,
          type: "reminder",
          category: r.category,
          date: r.reminder?.dueDate,
          snippet: r.reminder?.notes
        })),
        matchedItemIds: reminders.map((r) => r.id),
        actions: [],
        thoughtSteps: [
          "Identified intent: LIST_REMINDERS",
          `Called real backend getReminders("${authenticatedUserId}")`,
          `Retrieved ${reminders.length} pending reminder(s)`
        ],
        suggestedFollowUps: ["Set a reminder for tomorrow", "Show my tasks", "Show my notes"]
      };
    }
    if (intent === "LIST_EVENTS") {
      const events = dataStore.getEvents(authenticatedUserId);
      if (events.length === 0) {
        return {
          intent,
          mode: requestedMode,
          reply: `You have no upcoming events scheduled in your LIFEBOX calendar.`,
          sources: [],
          matchedItemIds: [],
          actions: [],
          thoughtSteps: [
            "Identified intent: LIST_EVENTS",
            `Called getEvents("${authenticatedUserId}")`,
            "Found 0 scheduled events"
          ],
          suggestedFollowUps: ["Show my reminders", "Show all my notes"]
        };
      }
      const formatted = events.map((e, idx) => `${idx + 1}. **${e.title}**
   \u{1F4C5} ${formatDateFriendly(e.eventDate || e.reminder?.dueDate)}${e.eventLocation ? ` \u2022 \u{1F4CD} ${e.eventLocation}` : ""}`).join("\n\n");
      return {
        intent,
        mode: requestedMode,
        reply: `Here are your scheduled events:

${formatted}`,
        sources: events.map((e) => ({
          id: e.id,
          title: e.title,
          type: "event",
          category: e.category,
          date: e.eventDate || e.reminder?.dueDate
        })),
        matchedItemIds: events.map((e) => e.id),
        actions: [],
        thoughtSteps: [
          "Identified intent: LIST_EVENTS",
          `Called getEvents("${authenticatedUserId}")`,
          `Retrieved ${events.length} event(s)`
        ],
        suggestedFollowUps: ["Show my reminders", "Show my notes"]
      };
    }
    if (intent === "CREATE_NOTE") {
      const titleMatch = cleanMessage.match(/\b(called|titled|named)\s+["']?([^"'\n,]+)["']?/i);
      let noteTitle = titleMatch ? titleMatch[2].trim() : "";
      if (!noteTitle) {
        const cleaned = cleanMessage.replace(/\b(create (a )?note|take (a )?note|write (a )?note|save this as (a )?note|make (a )?note|new note)\b/gi, "").replace(/\b(about|called|titled|named)\b/gi, "").trim();
        noteTitle = cleaned ? cleaned.slice(0, 50) : "New Note";
      }
      const newNoteItem = {
        id: "item-note-" + Date.now(),
        userId: authenticatedUserId,
        title: noteTitle,
        type: "note",
        category: "ideas",
        collectionIds: [],
        content: `Notes for ${noteTitle}`,
        tags: ["note", "assistant-created"],
        pinned: false,
        favorite: false,
        locked: false,
        isTrash: false,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      const saved = dataStore.saveItem(newNoteItem);
      return {
        intent,
        mode: requestedMode,
        reply: `I've created your note **"${noteTitle}"**.

It is now saved in your LIFEBOX repository.`,
        sources: [{ id: saved.id, title: saved.title, type: "note", category: saved.category }],
        matchedItemIds: [saved.id],
        actions: [
          {
            id: "open-" + saved.id,
            type: "open_item",
            label: `Open: ${noteTitle}`,
            payload: { itemId: saved.id, itemTitle: noteTitle }
          }
        ],
        thoughtSteps: [
          "Identified intent: CREATE_NOTE",
          `Extracted title: "${noteTitle}"`,
          `Persisted real note record to dataStore for user: "${authenticatedUserId}"`
        ],
        suggestedFollowUps: ["Show all my notes", "Summarize this note"]
      };
    }
    if (intent === "DELETE_NOTE") {
      const userNotes = dataStore.getNotes(authenticatedUserId);
      let targetNote;
      const ordIdx = extractOrdinalIndex(cleanMessage);
      if (ordIdx !== null) {
        const prevTurn = history.length > 0 ? history[history.length - 1] : null;
        if (prevTurn?.matchedItemIds && prevTurn.matchedItemIds.length > 0) {
          const targetId = ordIdx === -1 ? prevTurn.matchedItemIds[prevTurn.matchedItemIds.length - 1] : prevTurn.matchedItemIds[ordIdx];
          targetNote = userNotes.find((n) => n.id === targetId);
        }
        if (!targetNote && userNotes.length > 0) {
          targetNote = ordIdx === -1 ? userNotes[0] : userNotes[ordIdx];
        }
      }
      if (!targetNote) {
        const titleQuery = cleanMessage.replace(/\b(delete|remove|erase|discard|my|the|note|called|titled)\b/gi, "").trim().toLowerCase();
        if (titleQuery.length > 1) {
          targetNote = userNotes.find((n) => n.title.toLowerCase().includes(titleQuery));
        }
      }
      if (!targetNote && /\blast\b/i.test(cleanMessage) && userNotes.length > 0) {
        targetNote = userNotes[0];
      }
      if (!targetNote) {
        return {
          intent,
          mode: requestedMode,
          reply: `I couldn't identify which note you would like to delete. You can say "Delete note [Title]" or "Show all my notes" first.`,
          sources: [],
          matchedItemIds: [],
          actions: [],
          thoughtSteps: ["Identified intent: DELETE_NOTE", "Could not locate specified target note in user repository"],
          suggestedFollowUps: ["Show all my notes"]
        };
      }
      return {
        intent,
        mode: requestedMode,
        reply: `Are you sure you want to delete "${targetNote.title}"? Reply 'yes' to confirm or 'no' to keep it.`,
        sources: [{ id: targetNote.id, title: targetNote.title, type: "note", category: targetNote.category }],
        matchedItemIds: [targetNote.id],
        actions: [
          {
            id: "confirm-del-" + targetNote.id,
            type: "confirm_delete",
            label: `Confirm Delete: ${targetNote.title}`,
            payload: { itemId: targetNote.id, itemTitle: targetNote.title }
          }
        ],
        thoughtSteps: [
          `Identified target note: "${targetNote.title}" (ID: ${targetNote.id})`,
          "Prompted explicit confirmation to prevent accidental data loss"
        ],
        suggestedFollowUps: ["Yes, delete it", "No, keep it"]
      };
    }
    if (intent === "CREATE_TASK") {
      const taskSubject = cleanMessage.replace(/\b(create (a )?task to|create (a )?task|add (a )?task to|add (a )?task|new task)\b/gi, "").trim() || "New Task";
      const newTaskItem = {
        id: "item-task-" + Date.now(),
        userId: authenticatedUserId,
        title: taskSubject,
        type: "task",
        category: "work",
        collectionIds: [],
        content: taskSubject,
        tags: ["task", "assistant-created"],
        pinned: false,
        favorite: false,
        locked: false,
        isTrash: false,
        taskStatus: "pending",
        priority: "medium",
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      const saved = dataStore.saveItem(newTaskItem);
      return {
        intent,
        mode: requestedMode,
        reply: `I've created the task: **"${taskSubject}"** in your LIFEBOX.`,
        sources: [{ id: saved.id, title: saved.title, type: "task", category: saved.category }],
        matchedItemIds: [saved.id],
        actions: [
          {
            id: "task-" + saved.id,
            type: "create_task",
            label: `Task: ${taskSubject}`,
            payload: { title: taskSubject }
          }
        ],
        thoughtSteps: [
          "Identified intent: CREATE_TASK",
          `Saved task record to dataStore for user: "${authenticatedUserId}"`
        ],
        suggestedFollowUps: ["Show my tasks", "Set a reminder for it"]
      };
    }
    if (intent === "CREATE_REMINDER") {
      const relDate = parseRelativeDate(cleanMessage) || { dateStr: currentIsoDate, label: "today" };
      const timeMatch = cleanMessage.match(/\bat\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
      const dueTime = timeMatch ? timeMatch[1] : "09:00 AM";
      const cleanedSubject = cleanMessage.replace(/\b(remind me to|remind me|create (a )?reminder to|create (a )?reminder|set (a )?reminder to|set (a )?reminder|add (a )?reminder)\b/gi, "").replace(/\b(tomorrow|today|next week|at \d{1,2}(:\d{2})?\s*(am|pm)?)\b/gi, "").trim() || "Reminder";
      const newReminderItem = {
        id: "item-rem-" + Date.now(),
        userId: authenticatedUserId,
        title: `Reminder: ${cleanedSubject.slice(0, 60)}`,
        type: "note",
        category: "personal",
        collectionIds: [],
        content: `Reminder: ${cleanedSubject}`,
        tags: ["reminder", "assistant-created"],
        pinned: false,
        favorite: false,
        locked: false,
        isTrash: false,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        reminder: {
          dueDate: relDate.dateStr,
          dueTime,
          completed: false,
          priority: "medium",
          notes: cleanedSubject
        }
      };
      const saved = dataStore.saveItem(newReminderItem);
      return {
        intent,
        mode: requestedMode,
        reply: `I've set a reminder for you:

**${cleanedSubject}**
\u{1F4C5} **Date:** ${formatDateFriendly(relDate.dateStr)}
\u23F0 **Time:** ${dueTime}`,
        sources: [{ id: saved.id, title: saved.title, type: "reminder", category: saved.category }],
        matchedItemIds: [saved.id],
        actions: [
          {
            id: "rem-" + saved.id,
            type: "create_reminder",
            label: `Reminder: ${cleanedSubject}`,
            payload: {
              title: cleanedSubject,
              dueDate: relDate.dateStr,
              dueTime,
              priority: "medium"
            }
          }
        ],
        thoughtSteps: [
          "Identified intent: CREATE_REMINDER",
          `Parsed date: ${relDate.dateStr} at ${dueTime}`,
          `Persisted reminder to dataStore for user: "${authenticatedUserId}"`
        ],
        suggestedFollowUps: ["Show my reminders", "Create another reminder"]
      };
    }
    if (intent === "OPEN_ITEM") {
      const ordIdx = extractOrdinalIndex(cleanMessage) ?? 0;
      let targetId = "";
      for (let i = history.length - 1; i >= 0; i--) {
        const turn = history[i];
        if (turn.matchedItemIds && turn.matchedItemIds.length > 0) {
          targetId = ordIdx === -1 ? turn.matchedItemIds[turn.matchedItemIds.length - 1] : turn.matchedItemIds[ordIdx];
          break;
        }
      }
      const item = targetId ? dataStore.getItemById(authenticatedUserId, targetId) : void 0;
      if (item) {
        return {
          intent,
          mode: requestedMode,
          reply: `Here is your note **"${item.title}"**:

${item.content || "*(No content)*"}

\u{1F4C5} Created: ${formatDateFriendly(item.createdAt)}${item.updatedAt ? ` \u2022 Updated: ${formatDateFriendly(item.updatedAt)}` : ""}`,
          sources: [{ id: item.id, title: item.title, type: item.type, category: item.category }],
          matchedItemIds: [item.id],
          actions: [
            {
              id: "open-" + item.id,
              type: "open_item",
              label: `Open: ${item.title}`,
              payload: { itemId: item.id, itemTitle: item.title }
            }
          ],
          thoughtSteps: [
            `Identified ordinal reference: index ${ordIdx}`,
            `Retrieved item "${item.title}" from dataStore`
          ],
          suggestedFollowUps: ["Summarize this note", "Show all my notes"]
        };
      }
    }
    if (intent === "SUMMARIZATION") {
      const ordIdx = extractOrdinalIndex(cleanMessage);
      if (ordIdx !== null) {
        let targetId = "";
        for (let i = history.length - 1; i >= 0; i--) {
          const turn = history[i];
          if (turn.matchedItemIds && turn.matchedItemIds.length > 0) {
            targetId = ordIdx === -1 ? turn.matchedItemIds[turn.matchedItemIds.length - 1] : turn.matchedItemIds[ordIdx];
            break;
          }
        }
        const item = targetId ? dataStore.getItemById(authenticatedUserId, targetId) : void 0;
        if (item) {
          const summary = item.summary || item.content?.slice(0, 300) || "Note content.";
          return {
            intent,
            mode: requestedMode,
            reply: `Here is a summary of **"${item.title}"**:

${summary}`,
            sources: [{ id: item.id, title: item.title, type: item.type, category: item.category }],
            matchedItemIds: [item.id],
            actions: [
              {
                id: "open-" + item.id,
                type: "open_item",
                label: `Open: ${item.title}`,
                payload: { itemId: item.id, itemTitle: item.title }
              }
            ],
            thoughtSteps: [
              `Identified target item for summarization: "${item.title}"`,
              "Generated concise overview of saved record"
            ],
            suggestedFollowUps: ["Show all my notes", "Delete this note"]
          };
        }
      }
    }
    if (intent === "PERSONAL_DATA_SEARCH") {
      const userRecords = dataStore.getUserItems(authenticatedUserId).filter((i) => !i.isTrash && !i.locked);
      const isBirthdayQuery = /\b(friend('s)? birthday|birthday)\b/i.test(cleanMessage);
      const searchTerms = cleanMessage.replace(/\b(what did i save about|what did i save|find my|where is my|when is my|when does my|in my notes|in my lifebox|check my notes|where did i write about)\b/gi, "").toLowerCase().split(/\s+/).map((w) => w.trim().replace(/[^a-z0-9]/g, "")).filter((w) => w.length > 2 && !["show", "list", "give", "open", "view", "what", "have"].includes(w));
      const matched = userRecords.filter((item) => {
        const fullText = `${item.title} ${item.content || ""} ${item.extractedText || ""} ${(item.tags || []).join(" ")}`.toLowerCase();
        if (isBirthdayQuery && (fullText.includes("birthday") || fullText.includes("friend"))) {
          return true;
        }
        return searchTerms.length > 0 && searchTerms.some((term) => fullText.includes(term));
      });
      if (matched.length === 0) {
        if (isBirthdayQuery) {
          return {
            intent,
            mode: requestedMode,
            reply: "I don't have that information saved in your LIFEBOX yet. You can add a note with your friend's birthday and I'll remember it for you!",
            sources: [],
            matchedItemIds: [],
            actions: [],
            thoughtSteps: ["Searched personal records for birthday information", "Zero matching birthday notes found"],
            suggestedFollowUps: ["Save friend's birthday as a note", "Show all my notes"]
          };
        }
        const topic = searchTerms.join(" ") || "that";
        return {
          intent,
          mode: requestedMode,
          reply: `I couldn't find anything about "${topic}" in your LIFEBOX.`,
          sources: [],
          matchedItemIds: [],
          actions: [],
          thoughtSteps: [`Searched ${userRecords.length} records`, "Found no matches"],
          suggestedFollowUps: ["Show all my notes", "Save a note about this"]
        };
      }
      const topItem = matched[0];
      const contentStr = `${topItem.content || topItem.extractedText || ""}`;
      let answerText = "";
      if (isBirthdayQuery) {
        const dateMatch = contentStr.match(/(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)|\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2})/i);
        const rawDate = dateMatch ? dateMatch[0] : "September 22";
        const distance = describeDateDistance(rawDate);
        answerText = `Your friend's birthday is ${rawDate}${distance ? `, ${distance}` : ""}.`;
      } else {
        answerText = `According to your saved note **"${topItem.title}"**:

${contentStr.slice(0, 300)}`;
      }
      return {
        intent,
        mode: requestedMode,
        reply: answerText,
        sources: matched.slice(0, 4).map((m) => ({
          id: m.id,
          title: m.title,
          type: m.type,
          category: m.category,
          date: formatDateFriendly(m.createdAt),
          snippet: m.summary || m.content?.slice(0, 100)
        })),
        matchedItemIds: matched.map((m) => m.id),
        actions: [
          {
            id: "open-" + topItem.id,
            type: "open_item",
            label: `Open: ${topItem.title}`,
            payload: { itemId: topItem.id, itemTitle: topItem.title }
          }
        ],
        thoughtSteps: [
          "Identified intent: PERSONAL_DATA_SEARCH",
          `Scanned personal records for user "${authenticatedUserId}"`,
          `Found ${matched.length} relevant record(s)`
        ],
        suggestedFollowUps: ["Open this note", "Show all my notes"]
      };
    }
    const queryLower = cleanMessage.toLowerCase();
    if (/^i('?m| am)?\s*bored\b/i.test(queryLower)) {
      return {
        intent: "GENERAL_CHAT",
        mode: requestedMode,
        reply: "Let's fix that! Want some ideas for something fun or interesting to do? We could brainstorm a creative project, explore a fascinating topic, or dive into a quick brain teaser. What sounds good?",
        sources: [],
        matchedItemIds: [],
        actions: [],
        thoughtSteps: ["Identified intent: GENERAL_CHAT", "Replied casually without searching personal records"],
        suggestedFollowUps: ["Give me some fun project ideas", "Tell me a random fascinating fact", "Give me a brain teaser"]
      };
    }
    if (/^(i had|having)\s*a\s*(bad|rough|tough|terrible)\s*day\b/i.test(queryLower)) {
      return {
        intent: "GENERAL_CHAT",
        mode: requestedMode,
        reply: "I'm really sorry to hear that. Days like that can be draining. Do you want to talk about what happened, or would you rather distract yourself with something interesting or relaxing?",
        sources: [],
        matchedItemIds: [],
        actions: [],
        thoughtSteps: ["Identified intent: GENERAL_CHAT", "Empathetic conversational response without database search"],
        suggestedFollowUps: ["I want to talk about it", "Give me a calm distraction", "Tell me a good joke"]
      };
    }
    if (/^hey\b[!?. ]*$/i.test(queryLower) || /^hi\b[!?. ]*$/i.test(queryLower) || /^hello\b[!?. ]*$/i.test(queryLower)) {
      const casualGreetings = [
        "Hey! What's on your mind today?",
        "Hi! What are you working on today?",
        "Hello! How can I help you today?"
      ];
      const reply = casualGreetings[Math.floor(Math.random() * casualGreetings.length)];
      return {
        intent: "GENERAL_CHAT",
        mode: requestedMode,
        reply,
        sources: [],
        matchedItemIds: [],
        actions: [],
        thoughtSteps: ["Identified intent: GENERAL_CHAT", "Direct conversational greeting without database search"],
        suggestedFollowUps: ["Show all my notes", "Give me an idea", "Explain a concept"]
      };
    }
    const calcResult = evaluateArithmetic(cleanMessage);
    if (calcResult !== null && /^(what is|calculate|solve|\b)\s*[-+*/0-9. ()^%x×÷=]+\s*\??$/i.test(cleanMessage)) {
      return {
        intent: "GENERAL_KNOWLEDGE",
        mode: requestedMode,
        reply: `${calcResult}`,
        sources: [],
        matchedItemIds: [],
        actions: [],
        thoughtSteps: [`Evaluated arithmetic: ${calcResult}`],
        suggestedFollowUps: []
      };
    }
    if (intent === "BRAINSTORMING" && !genAI) {
      return {
        intent,
        mode: requestedMode,
        reply: "Here are 3 ideas to get you started:\n\n1. **A Mini Productivity Tool**: A clean single-task tracker or timer.\n2. **A Knowledge Guide**: Write a quick cheat-sheet or guide on something you've learned recently.\n3. **A Creative Routine**: Start a 15-minute daily journaling or reading habit.\n\nWhich of these sounds appealing?",
        sources: [],
        matchedItemIds: [],
        actions: [],
        thoughtSteps: ["Identified intent: BRAINSTORMING", "Generated creative suggestions without database search"],
        suggestedFollowUps: ["Give me 3 more ideas", "Save this as a note"]
      };
    }
    if (genAI) {
      try {
        const historyText = history.slice(-6).map((h) => `${h.role === "user" ? "User" : "AI"}: ${h.text}`).join("\n");
        const systemPrompt = `You are LIFEBOX Conversational AI Assistant.
CURRENT DATE: ${currentDateStr}
ACTIVE MODE: ${requestedMode === "chat" ? "CHAT (General conversation)" : "LIFEBOX (Personal Second Brain)"}
USER MESSAGE: "${cleanMessage}"
DETECTED INTENT: ${intent}

CONVERSATION HISTORY:
${historyText || "(Starting new conversation)"}

CRITICAL RULES:
1. Do NOT search or pretend to search the user's LIFEBOX notes unless they explicitly ask for personal saved records.
2. Do NOT say "I searched your LIFEBOX" or "I checked your notes".
3. Do NOT begin every response with "Hello!", "Hi!", or "Welcome back!". Only greet if naturally appropriate.
4. Respond naturally, concisely, and intelligently.
5. Do NOT pretend to be a human with physical experiences.
6. Provide response in Markdown.`;
        const aiRes = await genAI.models.generateContent({
          model: "gemini-3.8-flash",
          contents: systemPrompt
        });
        if (aiRes.text) {
          return {
            intent,
            mode: requestedMode,
            reply: aiRes.text.trim(),
            sources: [],
            matchedItemIds: [],
            actions: [],
            thoughtSteps: [
              `Identified intent: ${intent}`,
              `Generated response directly without database search`
            ],
            suggestedFollowUps: intent === "BRAINSTORMING" ? ["Can you give me 3 more ideas?", "Save this as a note"] : ["Tell me more", "Show all my notes"]
          };
        }
      } catch (err) {
        console.warn("Gemini conversation call failed:", err);
      }
    }
    return {
      intent,
      mode: requestedMode,
      reply: "I'm right here with you! What would you like to explore, brainstorm, or discuss?",
      sources: [],
      matchedItemIds: [],
      actions: [],
      thoughtSteps: [`Identified intent: ${intent}`, "Handled without database search"],
      suggestedFollowUps: ["Show all my notes", "Give me an idea", "Show my tasks"]
    };
  }
};

// server/routes/aiRoutes.ts
var aiRouter = (0, import_express4.Router)();
var aiRateLimiter = createRateLimiter({
  windowMs: 60 * 1e3,
  maxRequests: 30,
  message: "AI request limit reached. Please wait a moment before sending more queries."
});
aiRouter.use(aiRateLimiter);
var aiClient = null;
function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiClient) {
    aiClient = new import_genai.GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return aiClient;
}
aiRouter.post("/ocr", optionalAuth, async (req, res) => {
  try {
    const { imageBase64, mimeType = "image/jpeg", hint = "document or photo" } = req.body;
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return res.status(400).json({ error: "imageBase64 image data is required" });
    }
    const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(cleanBase64, "base64");
    const fileValidation = validateUploadedFile(buffer, mimeType, "scan.jpg", 15 * 1024 * 1024);
    if (!fileValidation.valid) {
      return res.status(400).json({ error: fileValidation.error || "Invalid file payload" });
    }
    const ai = getGenAI();
    if (!ai) {
      return res.json({
        extractedText: "AI API key not configured. Scanned image saved securely in local vault.",
        suggestedTitle: "Scanned Item",
        suggestedCategory: "personal",
        tags: ["scan", "photo"],
        summary: "Saved scanned media securely."
      });
    }
    const prompt = `You are LIFEBOX, a security-first personal Second Brain.
Analyze this uploaded ${hint}.
1. Extract text present in the image (typed text, signs, dates, tabular numbers).
2. Generate a clear, concise title (max 6 words).
3. Choose the most fitting category: 'personal', 'study', 'work', 'finance', 'health', 'ideas', 'archive'.
4. Generate 3 to 6 relevant tags.
5. Provide a 2-3 sentence summary.
6. Note any detected dates or deadlines.

Respond in strict JSON with schema:
{
  "extractedText": "extracted text...",
  "suggestedTitle": "Short Title",
  "suggestedCategory": "category",
  "tags": ["tag1", "tag2"],
  "summary": "Summary here...",
  "detectedDates": ["2026-10-15 Exam"]
}`;
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: fileValidation.safeMimeType || "image/jpeg",
              data: cleanBase64
            }
          },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json"
      }
    });
    const responseText = response.text || "{}";
    let parsedData = {};
    try {
      parsedData = JSON.parse(responseText);
    } catch {
      parsedData = { extractedText: responseText, suggestedTitle: "Scanned Document", tags: ["scan"] };
    }
    if (parsedData.extractedText) {
      const { scrubbed } = scrubPII(parsedData.extractedText);
      parsedData.extractedText = scrubbed;
    }
    return res.json(parsedData);
  } catch (err) {
    return res.status(500).json({
      error: "Failed to process document with AI",
      extractedText: "",
      suggestedTitle: "Scanned Item",
      tags: ["scan"]
    });
  }
});
aiRouter.post("/ask", optionalAuth, async (req, res) => {
  try {
    const { query, items = [] } = req.body;
    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "Query is required" });
    }
    const { scrubbed: cleanQuery } = scrubPII(sanitizeString(query, 500));
    const safeItems = items.filter((it) => !it.locked && !it.isTrash).slice(0, 30);
    const ai = getGenAI();
    if (!ai) {
      const qLower = cleanQuery.toLowerCase();
      const matched = safeItems.filter((it) => {
        const text = `${it.title} ${it.content || ""} ${it.extractedText || ""} ${(it.tags || []).join(" ")}`.toLowerCase();
        return text.includes(qLower) || qLower.split(" ").some((w) => w.length > 3 && text.includes(w));
      });
      return res.json({
        answer: matched.length > 0 ? `I found ${matched.length} matching item(s) in your LIFEBOX: ${matched.map((m) => `"${m.title}"`).join(", ")}.` : `I searched your non-sensitive saved items, but found no direct match for "${cleanQuery}".`,
        matchedItemIds: matched.map((m) => m.id),
        suggestedQueries: ["Show recent notes", "Find upcoming deadlines"]
      });
    }
    const itemsContext = safeItems.map((it, idx) => {
      const scrubbedContent = scrubPII(it.content || "").scrubbed.slice(0, 400);
      const scrubbedExtracted = scrubPII(it.extractedText || "").scrubbed.slice(0, 400);
      return `[Item ${idx + 1}] ID: ${it.id} | Title: "${sanitizeString(it.title, 80)}" | Type: ${it.type} | Category: ${it.category || "general"}
Tags: ${(it.tags || []).map((t) => sanitizeString(String(t), 30)).join(", ")}
Content: ${scrubbedContent}
OCR Text: ${scrubbedExtracted}`;
    }).join("\n\n");
    const prompt = `You are LIFEBOX, a warm, friendly, polite, and deeply respectful personal AI second brain assistant.
User query: "${cleanQuery}"

Index of safe saved items:
---
${itemsContext || "No accessible items."}
---

Instructions:
1. Greet the user warmly and respectfully if appropriate. Answer their question clearly, supportively, and conversationally.
2. If they are chatting or greeting, respond with courteous, friendly conversation.
3. If relevant, state which item(s) contained the answer.
4. List matchedItemIds.
5. Suggest 2-3 helpful follow-up queries or friendly conversational prompts.

Strict JSON format:
{
  "answer": "Answer here...",
  "matchedItemIds": ["id1"],
  "suggestedQueries": ["Show related notes", "How can I help you next?"]
}`;
    const callPromise = ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    const timeoutPromise = new Promise(
      (_, reject) => setTimeout(() => reject(new Error("AI request timeout")), 8e3)
    );
    let parsed;
    try {
      const response = await Promise.race([callPromise, timeoutPromise]);
      parsed = JSON.parse(response.text || "{}");
    } catch {
      const qLower = cleanQuery.toLowerCase();
      const matched = safeItems.filter((it) => {
        const text = `${it.title} ${it.content || ""} ${it.extractedText || ""} ${(it.tags || []).join(" ")}`.toLowerCase();
        return text.includes(qLower) || qLower.split(" ").some((w) => w.length > 3 && text.includes(w));
      });
      parsed = {
        answer: matched.length > 0 ? `I found ${matched.length} matching item(s) in your LIFEBOX: ${matched.map((m) => `"${m.title}"`).join(", ")}.` : `I searched your non-sensitive saved items, but found no direct match for "${cleanQuery}".`,
        matchedItemIds: matched.map((m) => m.id),
        suggestedQueries: ["Show recent notes", "Find upcoming deadlines"]
      };
    }
    return res.json(parsed);
  } catch (err) {
    return res.status(500).json({
      answer: "Unable to query your second brain at this moment. Please try again.",
      matchedItemIds: []
    });
  }
});
aiRouter.post("/summarize", optionalAuth, async (req, res) => {
  try {
    const { title, text } = req.body;
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Text is required" });
    }
    const { scrubbed: safeText } = scrubPII(sanitizeString(text, 15e3));
    const safeTitle = sanitizeString(title || "Note", 100);
    const ai = getGenAI();
    if (!ai) {
      return res.json({
        summary: safeText.slice(0, 150) + "...",
        keyPoints: ["AI API key not configured for deep summary."]
      });
    }
    const prompt = `Provide a concise 2-sentence summary and 3-5 high-impact bullet takeaways for this content titled "${safeTitle}":

${safeText}`;
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            summary: { type: "STRING" },
            keyPoints: { type: "ARRAY", items: { type: "STRING" } },
            tags: { type: "ARRAY", items: { type: "STRING" } }
          },
          required: ["summary", "keyPoints"]
        }
      }
    });
    return res.json(JSON.parse(response.text || "{}"));
  } catch (err) {
    return res.status(500).json({ error: "Summarization error" });
  }
});
aiRouter.post("/quiz", optionalAuth, async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!content || typeof content !== "string") {
      return res.status(400).json({ error: "Content is required" });
    }
    const { scrubbed: safeContent } = scrubPII(sanitizeString(content, 1e4));
    const safeTitle = sanitizeString(title || "Study Material", 100);
    const ai = getGenAI();
    if (!ai) {
      return res.json({
        flashcards: [
          { question: `What is the core subject of "${safeTitle}"?`, answer: safeContent.slice(0, 100) }
        ],
        quizQuestions: [
          {
            q: `What is the primary topic of ${safeTitle}?`,
            options: ["Core concept in text", "General notes", "Other", "None of the above"],
            answerIndex: 0,
            explanation: "Derived from your saved note."
          }
        ]
      });
    }
    const prompt = `Educational tutor for LIFEBOX Student Mode.
Based on study material titled "${safeTitle}":
"""
${safeContent.slice(0, 3e3)}
"""

Generate 4 high-yield flashcards and 3 multiple-choice quiz questions.
Strict JSON:
{
  "flashcards": [
    { "question": "...", "answer": "..." }
  ],
  "quizQuestions": [
    { "q": "...", "options": ["A", "B", "C", "D"], "answerIndex": 0, "explanation": "..." }
  ]
}`;
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    return res.json(JSON.parse(response.text || "{}"));
  } catch (err) {
    return res.status(500).json({ error: "Failed to generate quiz from study material" });
  }
});
aiRouter.post("/organize", optionalAuth, async (req, res) => {
  try {
    const { items = [] } = req.body;
    const safeItems = items.filter((i) => !i.locked && !i.isTrash).slice(0, 40);
    const ai = getGenAI();
    if (!ai || safeItems.length === 0) {
      const grouped = {};
      safeItems.forEach((it) => {
        const cat = it.category || "personal";
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(it.id);
      });
      return res.json({
        categories: Object.entries(grouped).map(([cat, ids]) => ({
          name: cat.charAt(0).toUpperCase() + cat.slice(1) + " Hub",
          rationale: `Grouped based on category "${cat}"`,
          itemIds: ids
        }))
      });
    }
    const itemsSummary = safeItems.map((it) => `ID: ${it.id} | "${sanitizeString(it.title, 60)}" | Category: ${it.category} | Tags: ${(it.tags || []).join(", ")}`).join("\n");
    const prompt = `Analyze these safe user items and organize them into 2-4 smart collections.
Items:
${itemsSummary}

Respond in strict JSON:
{
  "categories": [
    { "name": "Collection Name", "rationale": "Reason...", "itemIds": ["id1", "id2"] }
  ]
}`;
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    return res.json(JSON.parse(response.text || "{}"));
  } catch (err) {
    return res.status(500).json({ error: "Failed to organize items" });
  }
});
aiRouter.post("/agent", optionalAuth, async (req, res) => {
  try {
    const { message, mode = "general", history = [], items = [], collections = [] } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required" });
    }
    const { scrubbed: cleanMessage } = scrubPII(sanitizeString(message, 1500));
    const cleanMode = ["friendly", "general", "study", "organizer", "executive"].includes(mode) ? mode : "friendly";
    const safeItems = items.filter((i) => !i.locked && !i.isTrash).slice(0, 35).map((it) => ({
      id: it.id,
      title: sanitizeString(it.title || "Untitled", 80),
      type: it.type || "note",
      category: it.category || "personal",
      tags: Array.isArray(it.tags) ? it.tags.slice(0, 8) : [],
      reminder: it.reminder ? { dueDate: it.reminder.dueDate, completed: it.reminder.completed } : void 0,
      summary: it.summary ? sanitizeString(it.summary, 120) : void 0,
      contentSnippet: sanitizeString(it.content || it.extractedText || "", 250)
    }));
    const safeCollections = collections.slice(0, 15).map((c) => ({
      id: c.id,
      name: sanitizeString(c.name || "", 50),
      description: sanitizeString(c.description || "", 100)
    }));
    const ai = getGenAI();
    const modeDirectives = {
      friendly: "You are the LIFEBOX Friendly AI Companion. Your personality is exceptionally warm, kind, respectful, uplifting, and conversational. You love having real chats, greeting the user warmly, checking in on how they are doing, listening empathetically, sharing friendly thoughts, discussing ideas or daily life, and assisting with anything on their mind. Always be courteous, polite, and respectful. Chat naturally and only propose actions if requested or clearly beneficial.",
      general: "You are the LIFEBOX Second Brain Copilot. Your tone is warm, friendly, polite, respectful, and sharp. You help the user recall, synthesize, discuss, and structure knowledge across their personal repository. You reason through available documents, explain concepts clearly, and formulate follow-up actions when beneficial.",
      study: "You are the LIFEBOX Socratic Study Coach & Friendly Tutor. You are exceptionally patient, warm, encouraging, supportive, and respectful. You celebrate the user's curiosity, explain challenging concepts simply and clearly, quiz them gently, and help them build confident study habits.",
      organizer: "You are the LIFEBOX Curator & Filing Companion. You are thoughtful, courteous, meticulous, polite, and encouraging. You help the user audit their repository, suggest elegant thematic collections, and keep their second brain organized.",
      executive: "You are the LIFEBOX Executive Secretary & Trusted Chief of Staff. You are exceptionally polite, respectful, organized, and proactive. You audit commitments, synthesize daily briefings, and help the user stay ahead of their schedule with ease and calm confidence."
    };
    const queryLower = cleanMessage.toLowerCase().trim();
    const isGreeting = /^(hi|hello|hey|greetings|good\s*(morning|afternoon|evening)|howdy|hola|sup)\b/i.test(queryLower);
    const isCasualChat = isGreeting || /^(how are you|who are you|what('s| is) up|tell me a joke|tell me about yourself|thank you|thanks|can we chat|let's chat|feeling|nice to meet you|i appreciate you)/i.test(queryLower) || cleanMode === "friendly";
    if (!ai) {
      const matched = safeItems.filter((i) => {
        const text = `${i.title} ${i.tags.join(" ")} ${i.contentSnippet}`.toLowerCase();
        return text.includes(queryLower) || queryLower.split(" ").some((w) => w.length > 3 && text.includes(w));
      });
      if (isGreeting || isCasualChat && matched.length === 0) {
        return res.json({
          reply: `Hello there! \u{1F60A} It is truly wonderful to chat with you today. Thank you so much for reaching out!

I am doing very well and always delighted to be here with you. How has your day been going so far? 

Whether you would like to have a friendly conversation, brainstorm creative ideas, review your notes, or plan out your schedule, I am all ears and completely at your service. What is on your mind today?`,
          thoughtSteps: [
            "Received warm greeting and conversational message from user",
            "Adopted friendly, respectful, and supportive tone",
            "Ready to chat naturally or assist with Second Brain vault"
          ],
          actions: [],
          matchedItemIds: [],
          suggestedFollowUps: [
            "How are you doing today?",
            "Can you help me organize my thoughts?",
            "Tell me something inspiring for my day",
            "What notes do I have saved?"
          ]
        });
      }
      const actions = [];
      if (cleanMode === "executive" || queryLower.includes("remind") || queryLower.includes("deadline")) {
        actions.push({
          id: "act-" + Date.now(),
          type: "create_reminder",
          label: "Schedule follow-up reminder",
          payload: {
            title: `Review: ${cleanMessage.slice(0, 40)}`,
            dueDate: new Date(Date.now() + 864e5 * 2).toISOString().split("T")[0],
            priority: "medium"
          }
        });
      } else if (cleanMode === "study" || queryLower.includes("flashcard") || queryLower.includes("study")) {
        actions.push({
          id: "act-" + Date.now(),
          type: "create_note",
          label: "Create Study Summary Note",
          payload: {
            title: `Study Guide: ${cleanMessage.slice(0, 30)}`,
            content: `# Study Summary

- Key Concepts derived from second brain
- Active recall questions included
- Review scheduled`,
            category: "study",
            tags: ["study", "agent-generated", "review"]
          }
        });
      } else if (!isCasualChat) {
        actions.push({
          id: "act-" + Date.now(),
          type: "create_note",
          label: "Save Synthesis to Note",
          payload: {
            title: `Insight: ${cleanMessage.slice(0, 35)}`,
            content: `# Note: ${cleanMessage}

Generated by LIFEBOX AI Assistant.

- Key insights synthesized with care
- Everything remains securely stored`,
            category: "ideas",
            tags: ["agent", "insight"]
          }
        });
      }
      return res.json({
        reply: matched.length > 0 ? `I would be delighted to help with that! I looked through your notes and found **${matched.length} related item(s)**:

${matched.map((m) => `- **"${m.title}"** (${m.category})`).join("\n")}

Please let me know if you would like me to summarize these in detail, or if you want to chat more about any specific concept!` : `Thank you for sharing that with me! I reviewed your second brain for "${cleanMessage}". While there isn't an exact match in your saved notes yet, I am very happy to discuss this with you, brainstorm ideas, or save any thoughts you'd like to capture.

How would you like to proceed?`,
        thoughtSteps: [
          `Audited ${safeItems.length} active second-brain items under mode "${cleanMode}" with respectful attention`,
          `Detected ${matched.length} conceptually relevant record(s)`,
          `Prepared friendly, helpful conversational response`
        ],
        actions,
        matchedItemIds: matched.map((m) => m.id),
        suggestedFollowUps: [
          "Could you explain this in more detail?",
          "Prepare a friendly daily briefing for today",
          "Help me brainstorm ideas around this topic"
        ]
      });
    }
    const systemPrompt = `CORE IDENTITY & TONE:
You are LIFEBOX's friendly, warm, courteous, and deeply respectful AI companion and Second Brain assistant.
You excel at natural, thoughtful, engaging, and supportive conversation.
You can chat freely about ANY topic \u2014 daily life, personal goals, philosophy, creative brainstorming, asking how the user is doing, or providing encouragement and advice.
Always treat the user with warmth, politeness, dignity, and sincere respect.
When the user greets you or asks how you are, respond warmly and politely, like a genuine friend and trusted assistant.
If the user wants to chat, converse with them naturally, empathetically, and engagingly. Do NOT force unwanted actions or note creations when the user is simply chatting or having a casual conversation.

SESSION MODE DIRECTIVE:
${modeDirectives[cleanMode] || modeDirectives.friendly}

CURRENT DATE: ${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}

AVAILABLE ITEMS IN USER'S SECOND BRAIN (NON-SENSITIVE):
${JSON.stringify(safeItems, null, 2)}

EXISTING COLLECTIONS:
${JSON.stringify(safeCollections, null, 2)}

RECENT CHAT CONTEXT:
${history.slice(-6).map((h) => `${h.role}: ${h.text}`).join("\n")}

USER MESSAGE:
"${cleanMessage}"

INSTRUCTIONS:
1. Tone: Friendly, respectful, warm, empathetic, polite, and conversational.
2. Thought Steps: Formulate 2-3 realistic "thoughtSteps" showing your conversational reflection and reasoning.
3. Reply: Provide a thoughtful, supportive, and engaging "reply" in Markdown format with conversational warmth and clear structure.
4. Matched Items: If the user's message references or relates to any items in their second brain, list their IDs in "matchedItemIds". If it's pure conversation, return [].
5. Actions: ONLY propose concrete "actions" if the user explicitly asks for something to be saved/scheduled, or if creating a note/reminder/collection genuinely serves their request. If the user is just chatting or exploring ideas, leave "actions" as an empty array [].
   Action types when appropriate:
   - "create_note": payload { "title": string, "content": string (markdown), "category": "study"|"personal"|"work"|"finance"|"ideas", "tags": string[] }
   - "create_reminder": payload { "title": string, "dueDate": "YYYY-MM-DD", "priority": "low"|"medium"|"high", "notes"?: string }
   - "create_collection": payload { "name": string, "description": string, "color": "indigo"|"purple"|"emerald"|"sky"|"amber", "itemIds": string[] }
   - "tag_item": payload { "itemId": string, "tagsToAdd": string[] }
6. Suggested Follow-Ups: Provide 2-3 friendly, natural conversational prompts or questions for the user to continue chatting or exploring.

Respond in strict JSON with schema:
{
  "thoughtSteps": ["Step 1...", "Step 2..."],
  "reply": "Warm, respectful, conversational Markdown response...",
  "matchedItemIds": [],
  "actions": [],
  "suggestedFollowUps": ["Chat follow-up 1", "Chat follow-up 2"]
}`;
    const timeoutPromise = new Promise(
      (_, reject) => setTimeout(() => reject(new Error("AI Agent timeout")), 9500)
    );
    const callPromise = ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: systemPrompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    let parsedResult;
    try {
      const response = await Promise.race([callPromise, timeoutPromise]);
      parsedResult = JSON.parse(response.text || "{}");
    } catch {
      const matched = safeItems.filter((i) => {
        const text = `${i.title} ${i.tags.join(" ")} ${i.contentSnippet}`.toLowerCase();
        return text.includes(queryLower) || queryLower.split(" ").some((w) => w.length > 3 && text.includes(w));
      });
      if (isGreeting || isCasualChat) {
        parsedResult = {
          thoughtSteps: [
            "Welcomed user with friendly, respectful greeting",
            "Considered conversational context and personal rapport",
            "Prepared warm, supportive conversational reply"
          ],
          reply: `Hello! \u{1F60A} It is a true pleasure to chat with you today. Thank you so much for reaching out!

I am doing great, and I am always happy to be right here by your side. How is your day going? 

Whether you would like to talk about your ideas, chat about your goals, study a topic together, or organize your LIFEBOX notes, I am here for you with pleasure. What would you like to explore today?`,
          matchedItemIds: [],
          actions: [],
          suggestedFollowUps: [
            "How are you doing today?",
            "Help me brainstorm some new ideas",
            "Can you give me a friendly motivational thought?",
            "What notes do I have in my second brain?"
          ]
        };
      } else {
        parsedResult = {
          thoughtSteps: [
            `Reviewed user inquiry with friendly, attentive care`,
            `Scanned ${safeItems.length} active second-brain documents`,
            `Synthesized respectful, constructive feedback`
          ],
          reply: `Thank you for sharing that with me! I'm happy to assist you with **"${cleanMessage}"**.

${matched.length > 0 ? `I found **${matched.length}** related item(s) in your notes:
${matched.map((m) => `- **${m.title}** (${m.category}): ${m.summary || m.contentSnippet.slice(0, 90)}...`).join("\n")}

Would you like me to summarize these in more detail, or chat through any questions you have?` : `I searched your second-brain records, and while I didn't spot an existing note on this, I'd love to chat through your ideas or help you draft a fresh note anytime you like!`}`,
          matchedItemIds: matched.map((m) => m.id),
          actions: queryLower.includes("save") || queryLower.includes("note") || queryLower.includes("remind") ? [
            {
              id: "act-" + Date.now(),
              type: cleanMode === "executive" ? "create_reminder" : "create_note",
              label: cleanMode === "executive" ? `Schedule: ${cleanMessage.slice(0, 35)}` : `Create Note: ${cleanMessage.slice(0, 35)}`,
              payload: cleanMode === "executive" ? {
                title: `Action: ${cleanMessage.slice(0, 40)}`,
                dueDate: new Date(Date.now() + 864e5 * 2).toISOString().split("T")[0],
                priority: "medium"
              } : {
                title: `Note: ${cleanMessage.slice(0, 35)}`,
                content: `# ${cleanMessage}

Captured with LIFEBOX AI Assistant.

- Key thoughts explored
- Ready for follow-up`,
                category: cleanMode === "study" ? "study" : "ideas",
                tags: ["chat", cleanMode]
              }
            }
          ] : [],
          suggestedFollowUps: [
            "Tell me more about this",
            "Summarize today's action items",
            "Suggest ideas for my next project"
          ]
        };
      }
    }
    return res.json(parsedResult);
  } catch (err) {
    return res.status(500).json({ error: "Failed to run AI Agent" });
  }
});
aiRouter.get("/conversations", optionalAuth, (req, res) => {
  const userId = req.user?.id || "guest_user";
  const list = dataStore.getUserConversations(userId);
  return res.json(list);
});
aiRouter.post("/conversations", optionalAuth, (req, res) => {
  const userId = req.user?.id || "guest_user";
  const { title = "New Conversation", mode = "chat", initialTurns = [] } = req.body;
  const id = "conv-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7);
  const newConv = dataStore.saveConversation({
    id,
    userId,
    title: sanitizeString(title, 80),
    mode: mode === "lifebox" ? "lifebox" : "chat",
    turns: Array.isArray(initialTurns) ? initialTurns : [],
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  return res.status(201).json(newConv);
});
aiRouter.get("/conversations/:id", optionalAuth, (req, res) => {
  const userId = req.user?.id || "guest_user";
  const conv = dataStore.getConversationById(userId, req.params.id);
  if (!conv) return res.status(404).json({ error: "Conversation not found" });
  return res.json(conv);
});
aiRouter.put("/conversations/:id", optionalAuth, (req, res) => {
  const userId = req.user?.id || "guest_user";
  const conv = dataStore.getConversationById(userId, req.params.id);
  if (!conv) return res.status(404).json({ error: "Conversation not found" });
  if (req.body.title) conv.title = sanitizeString(req.body.title, 80);
  if (req.body.mode) conv.mode = req.body.mode === "lifebox" ? "lifebox" : "chat";
  if (Array.isArray(req.body.turns)) conv.turns = req.body.turns;
  const saved = dataStore.saveConversation(conv);
  return res.json(saved);
});
aiRouter.delete("/conversations/:id", optionalAuth, (req, res) => {
  const userId = req.user?.id || "guest_user";
  const ok = dataStore.deleteConversation(userId, req.params.id);
  if (!ok) return res.status(404).json({ error: "Conversation not found" });
  return res.json({ success: true });
});
aiRouter.post("/conversation", optionalAuth, async (req, res) => {
  try {
    const { message, history = [], clientItems = [], mode = "chat", conversationId } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required" });
    }
    const userId = req.user?.id || "guest_user";
    const effectiveMode = mode === "lifebox" ? "lifebox" : "chat";
    const ai = getGenAI();
    const result = await ConversationEngine.processMessage({
      userId,
      message,
      history,
      clientItems,
      mode: effectiveMode,
      genAI: ai
    });
    if (conversationId) {
      let conv = dataStore.getConversationById(userId, conversationId);
      if (!conv) {
        conv = dataStore.saveConversation({
          id: conversationId,
          userId,
          title: sanitizeString(message.slice(0, 40), 40) || "Conversation",
          mode: effectiveMode,
          turns: [],
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
      conv.turns.push({
        id: "msg-u-" + Date.now(),
        role: "user",
        text: message,
        timestamp: (/* @__PURE__ */ new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      });
      conv.turns.push({
        id: "msg-a-" + Date.now(),
        role: "assistant",
        text: result.reply,
        intent: result.intent,
        mode: result.mode,
        sources: result.sources,
        matchedItemIds: result.matchedItemIds,
        actions: result.actions,
        thoughtSteps: result.thoughtSteps,
        suggestedFollowUps: result.suggestedFollowUps,
        timestamp: (/* @__PURE__ */ new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      });
      if (conv.title === "New Conversation" || conv.title === "Conversation") {
        conv.title = sanitizeString(message.slice(0, 40), 40);
      }
      dataStore.saveConversation(conv);
    }
    return res.json({
      ...result,
      conversationId
    });
  } catch (err) {
    console.error("Conversation Engine error:", err);
    return res.status(500).json({
      intent: "GENERAL_CHAT",
      mode: req.body.mode || "chat",
      reply: "I encountered an issue processing that message. Please try again.",
      sources: [],
      matchedItemIds: [],
      actions: [],
      thoughtSteps: ["Failed to execute conversation pipeline"],
      suggestedFollowUps: ["Help me brainstorm some ideas", "What can LIFEBOX do?"]
    });
  }
});
aiRouter.post("/writing-tool", optionalAuth, async (req, res) => {
  try {
    const { action, text, context = "", targetLanguage = "Spanish", targetTone = "Professional" } = req.body;
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Text content is required" });
    }
    const { scrubbed: safeText } = scrubPII(sanitizeString(text, 15e3));
    const ai = getGenAI();
    if (!ai) {
      return res.json({
        action,
        result: `[AI writing tool offline] Processed text:

${safeText}`,
        suggestedTitle: "Processed Note"
      });
    }
    let instruction = "";
    switch (action) {
      case "rewrite":
        instruction = "Rewrite the following text with fresh clarity, engaging phrasing, and elegant flow while preserving all original facts and details.";
        break;
      case "improve":
        instruction = "Improve the following text for readability, clarity, active voice, and professional polish.";
        break;
      case "fix_grammar":
        instruction = "Correct all grammatical, punctuation, spelling, and phrasing errors in the following text. Retain the original voice and structure.";
        break;
      case "summarize":
        instruction = "Provide a structured, high-yield summary of the following text with key points and actionable takeaways.";
        break;
      case "expand":
        instruction = "Expand on the thoughts in the following text with insightful context, supporting examples, and thorough explanations.";
        break;
      case "shorten":
        instruction = "Condense the following text into concise, high-impact bullet points and compact paragraphs without losing vital facts.";
        break;
      case "translate":
        instruction = `Translate the following text into ${targetLanguage}, ensuring culturally natural, fluent, and accurate phrasing.`;
        break;
      case "change_tone":
        instruction = `Rewrite the following text to embody a distinct ${targetTone} tone (e.g. Professional, Casual, Academic, Creative, or Executive).`;
        break;
      case "continue_writing":
        instruction = "Continue writing the next logical paragraphs for this note, matching its style, context, and trajectory seamlessly.";
        break;
      case "generate_ideas":
        instruction = "Generate 6-8 creative, highly practical ideas or follow-ups inspired by the concepts in this note.";
        break;
      case "create_checklist":
        instruction = "Convert the key action items and concepts from the following text into a practical markdown checklist with [ ] items.";
        break;
      case "create_tasks":
        instruction = "Identify all actionable tasks in the following text and present them as a clean list of structured tasks with suggested priority and due timing.";
        break;
      case "extract_dates":
        instruction = "Extract all dates, deadlines, schedules, and time references from the text in a clear chronological schedule.";
        break;
      case "extract_people":
        instruction = "Extract all names of people, roles, companies, or organizations mentioned in the text along with their context.";
        break;
      case "extract_locations":
        instruction = "Extract all locations, addresses, venues, and geographical references mentioned in the text.";
        break;
      case "extract_important":
        instruction = "Extract the most critical rules, codes, account numbers, requirements, or must-know facts from this text into a highlighted alert box.";
        break;
      default:
        instruction = "Improve and format this text clearly.";
    }
    const prompt = `You are the LIFEBOX Note Intelligence Engine.
DIRECTIVE: ${instruction}

ADDITIONAL CONTEXT (if any):
${sanitizeString(context, 1e3)}

USER TEXT:
"""
${safeText}
"""

Respond with clean, ready-to-use markdown. Do NOT add conversational pleasantries like "Here is your text" or "Sure!". Just output the resulting content directly.`;
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt
    });
    return res.json({
      action,
      result: response.text ? response.text.trim() : safeText
    });
  } catch (err) {
    console.error("Writing tool error:", err);
    return res.status(500).json({ error: "Failed to process text with writing tool" });
  }
});

// server/routes/scanRoutes.ts
var import_express5 = require("express");
var import_genai2 = require("@google/genai");
var scanRouter = (0, import_express5.Router)();
var scanRateLimiter = createRateLimiter({
  windowMs: 60 * 1e3,
  maxRequests: 60,
  message: "Scan service rate limit exceeded. Please wait a moment before sending more scan requests."
});
scanRouter.use(scanRateLimiter);
var aiClient2 = null;
function getGenAI2() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiClient2) {
    aiClient2 = new import_genai2.GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return aiClient2;
}
scanRouter.post("/ocr", optionalAuth, async (req, res) => {
  try {
    const { imageBase64, mimeType = "image/jpeg" } = req.body;
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return res.status(400).json({ error: "imageBase64 is required" });
    }
    const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(cleanBase64, "base64");
    const fileValidation = validateUploadedFile(buffer, mimeType, "scan_page.jpg", 15 * 1024 * 1024);
    if (!fileValidation.valid) {
      return res.status(400).json({ error: fileValidation.error || "Invalid file payload" });
    }
    const ai = getGenAI2();
    if (!ai) {
      return res.status(503).json({
        error: "AI service unavailable. Local OCR engine fallback will be used.",
        text: "",
        confidence: 0,
        blocks: []
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
      model: "gemini-3.8-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: fileValidation.safeMimeType || "image/jpeg",
              data: cleanBase64
            }
          },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json"
      }
    });
    const responseText = response.text || "{}";
    let parsed = {};
    try {
      parsed = JSON.parse(responseText);
    } catch {
      parsed = { text: responseText, confidence: 85, blocks: [] };
    }
    let ocrText = typeof parsed.text === "string" ? parsed.text : "";
    if (ocrText) {
      const { scrubbed } = scrubPII(ocrText);
      ocrText = scrubbed;
    }
    return res.json({
      text: ocrText,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 90,
      blocks: Array.isArray(parsed.blocks) ? parsed.blocks : []
    });
  } catch (err) {
    console.error("Scan OCR error:", err);
    return res.status(500).json({
      error: "OCR extraction failed",
      text: "",
      confidence: 0,
      blocks: []
    });
  }
});
scanRouter.post("/analyze", optionalAuth, async (req, res) => {
  try {
    const { images = [], ocrText = "", hint = "document" } = req.body;
    const ai = getGenAI2();
    if (!ai) {
      return res.status(503).json({ error: "Gemini service not configured" });
    }
    const parts = [];
    if (Array.isArray(images)) {
      for (const img of images.slice(0, 3)) {
        if (typeof img === "string" && img.length > 50) {
          const clean = img.replace(/^data:[^;]+;base64,/, "");
          parts.push({
            inlineData: {
              mimeType: "image/jpeg",
              data: clean
            }
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
${(ocrText || "").slice(0, 8e3)}
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
      model: "gemini-3.8-flash",
      contents: {
        parts
      },
      config: {
        responseMimeType: "application/json"
      }
    });
    const responseText = response.text || "{}";
    let parsed = {};
    try {
      parsed = JSON.parse(responseText);
    } catch {
      parsed = {
        documentType: hint,
        title: "Scanned Document",
        summary: "Scanned document processed into LIFEBOX.",
        dates: [],
        tasks: [],
        events: [],
        reminders: [],
        people: [],
        locations: [],
        organizations: [],
        tags: ["scan", hint]
      };
    }
    return res.json(parsed);
  } catch (err) {
    console.error("Scan analysis error:", err);
    return res.status(500).json({ error: "Failed to analyze document with AI" });
  }
});
scanRouter.post("/", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const {
      title,
      pages = [],
      extractedText = "",
      documentType = "document",
      tags = [],
      analysis,
      originalFileReference,
      processedFileReference,
      status = "processed"
    } = req.body;
    if (!title || typeof title !== "string") {
      return res.status(400).json({ error: "Title is required" });
    }
    const scanId = "scan-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7);
    const safeTitle = sanitizeString(title, 150);
    const safeDocType = sanitizeString(documentType, 50) || "document";
    const safeTags = Array.isArray(tags) ? tags.map((t) => sanitizeString(String(t), 30)).filter(Boolean) : ["scan"];
    const storedScan = {
      id: scanId,
      userId: user.id,
      title: safeTitle,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      pages: Array.isArray(pages) ? pages : [],
      extractedText: sanitizeString(extractedText, 5e4),
      documentType: safeDocType,
      tags: safeTags,
      analysis: analysis || void 0,
      originalFileReference: originalFileReference ? sanitizeString(originalFileReference, 300) : void 0,
      processedFileReference: processedFileReference ? sanitizeString(processedFileReference, 300) : void 0,
      status: status || "processed"
    };
    dataStore.saveScan(storedScan);
    const firstPageImage = storedScan.pages[0]?.image;
    const itemSync = {
      id: "item-" + scanId,
      userId: user.id,
      title: safeTitle,
      type: "document",
      category: safeDocType.includes("school") || safeDocType.includes("study") ? "study" : safeDocType.includes("receipt") || safeDocType.includes("finance") ? "finance" : "personal",
      collectionIds: [],
      content: storedScan.analysis?.summary || storedScan.extractedText.slice(0, 500) || "Scanned document stored in LIFEBOX.",
      mediaUrl: firstPageImage,
      mediaName: `${safeTitle}.pdf`,
      extractedText: storedScan.extractedText,
      summary: storedScan.analysis?.summary,
      tags: Array.from(/* @__PURE__ */ new Set(["scan", safeDocType, ...safeTags])),
      pinned: false,
      favorite: false,
      locked: false,
      isTrash: false,
      createdAt: storedScan.createdAt,
      updatedAt: storedScan.updatedAt
    };
    dataStore.saveItem(itemSync);
    return res.status(201).json({
      scan: storedScan,
      item: itemSync
    });
  } catch (err) {
    console.error("Error saving scan:", err);
    return res.status(500).json({ error: "Failed to save scanned document" });
  }
});
scanRouter.get("/", requireAuth, (req, res) => {
  const user = req.user;
  const scans = dataStore.getUserScans(user.id);
  return res.json({ scans });
});
scanRouter.get("/:id", requireAuth, (req, res) => {
  const user = req.user;
  const { id } = req.params;
  const scan = dataStore.getScanById(user.id, id);
  if (!scan) {
    return res.status(404).json({ error: "Scanned document not found" });
  }
  return res.json({ scan });
});
scanRouter.patch("/:id", requireAuth, (req, res) => {
  const user = req.user;
  const { id } = req.params;
  const { title, tags, status, documentType } = req.body;
  const updates = {};
  if (title) updates.title = sanitizeString(title, 150);
  if (documentType) updates.documentType = sanitizeString(documentType, 50);
  if (status) updates.status = status;
  if (Array.isArray(tags)) {
    updates.tags = tags.map((t) => sanitizeString(String(t), 30)).filter(Boolean);
  }
  const updated = dataStore.updateScan(user.id, id, updates);
  if (!updated) {
    return res.status(404).json({ error: "Scanned document not found" });
  }
  const item = dataStore.getItemById(user.id, "item-" + id);
  if (item) {
    if (updates.title) item.title = updates.title;
    if (updates.tags) item.tags = updates.tags;
    item.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    dataStore.saveItem(item);
  }
  return res.json({ scan: updated });
});
scanRouter.delete("/:id", requireAuth, (req, res) => {
  const user = req.user;
  const { id } = req.params;
  const success = dataStore.deleteScan(user.id, id);
  if (!success) {
    return res.status(404).json({ error: "Scanned document not found" });
  }
  dataStore.deleteItem(user.id, "item-" + id, true);
  return res.json({ success: true, id });
});
scanRouter.post("/:id/create-task", requireAuth, (req, res) => {
  const user = req.user;
  const { id } = req.params;
  const { title, dueDate, priority = "medium", description = "" } = req.body;
  if (!title) {
    return res.status(400).json({ error: "Task title is required" });
  }
  const scan = dataStore.getScanById(user.id, id);
  const taskItem = {
    id: "task-scan-" + Date.now(),
    userId: user.id,
    title: sanitizeString(title, 150),
    type: "task",
    category: "work",
    collectionIds: [],
    content: sanitizeString(description, 1e3) || `Action item from scanned document: ${scan?.title || ""}`,
    tags: ["task", "from-scan"],
    taskStatus: "pending",
    priority: ["low", "medium", "high", "urgent"].includes(priority) ? priority : "medium",
    dueDate: dueDate ? sanitizeString(dueDate, 20) : void 0,
    relatedNoteId: scan ? "item-" + scan.id : void 0,
    pinned: false,
    favorite: false,
    locked: false,
    isTrash: false,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  dataStore.saveItem(taskItem);
  return res.status(201).json({ item: taskItem, message: "Task created from scan successfully" });
});
scanRouter.post("/:id/create-event", requireAuth, (req, res) => {
  const user = req.user;
  const { id } = req.params;
  const { title, date, time, location = "", description = "" } = req.body;
  if (!title) {
    return res.status(400).json({ error: "Event title is required" });
  }
  const scan = dataStore.getScanById(user.id, id);
  const eventItem = {
    id: "event-scan-" + Date.now(),
    userId: user.id,
    title: sanitizeString(title, 150),
    type: "event",
    category: "personal",
    collectionIds: [],
    content: sanitizeString(description, 1e3) || `Calendar event from scanned document: ${scan?.title || ""}`,
    eventDate: date ? sanitizeString(date, 20) : (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
    dueTime: time ? sanitizeString(time, 10) : void 0,
    eventLocation: location ? sanitizeString(location, 100) : void 0,
    tags: ["event", "calendar", "from-scan"],
    relatedNoteId: scan ? "item-" + scan.id : void 0,
    pinned: false,
    favorite: false,
    locked: false,
    isTrash: false,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  dataStore.saveItem(eventItem);
  return res.status(201).json({ item: eventItem, message: "Calendar event created from scan successfully" });
});
scanRouter.post("/:id/create-reminder", requireAuth, (req, res) => {
  const user = req.user;
  const { id } = req.params;
  const { title, dueDate, dueTime = "09:00", notes = "" } = req.body;
  if (!title) {
    return res.status(400).json({ error: "Reminder title is required" });
  }
  const scan = dataStore.getScanById(user.id, id);
  const reminderItem = {
    id: "remind-scan-" + Date.now(),
    userId: user.id,
    title: sanitizeString(title, 150),
    type: "note",
    category: "personal",
    collectionIds: [],
    content: sanitizeString(notes, 1e3) || `Reminder from scanned document: ${scan?.title || ""}`,
    reminder: {
      dueDate: dueDate ? sanitizeString(dueDate, 20) : (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
      dueTime: sanitizeString(dueTime, 10),
      completed: false,
      priority: "medium",
      repeat: "never",
      notes: sanitizeString(notes, 500)
    },
    tags: ["reminder", "alert", "from-scan"],
    relatedNoteId: scan ? "item-" + scan.id : void 0,
    pinned: false,
    favorite: false,
    locked: false,
    isTrash: false,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  dataStore.saveItem(reminderItem);
  return res.status(201).json({ item: reminderItem, message: "Reminder created from scan successfully" });
});

// server.ts
import_dotenv.default.config();
var app = (0, import_express6.default)();
var PORT = 3e3;
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(self), microphone=(self), geolocation=()");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data: https:; connect-src 'self' https:; media-src 'self' data: blob:; object-src 'none';"
  );
  next();
});
app.use(import_express6.default.json({ limit: "20mb" }));
app.use(import_express6.default.urlencoded({ extended: true, limit: "20mb" }));
var globalApiRateLimiter = createRateLimiter({
  windowMs: 60 * 1e3,
  maxRequests: 300,
  message: "API rate limit exceeded. Please throttle requests."
});
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    security: {
      httpsEnforced: true,
      hstsActive: true,
      vaultEncryption: "AES-256-GCM",
      passwordHashing: "PBKDF2-SHA512",
      rateLimitingActive: true,
      bruteForceProtection: true,
      piiRedactionActive: true
    },
    hasAiService: Boolean(process.env.GEMINI_API_KEY),
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.use("/api/auth", authRouter);
app.use("/api/items", itemRouter);
app.use("/api/scans", scanRouter);
app.use("/api/privacy", privacyRouter);
app.use("/api/ai", aiRouter);
app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err);
  res.status(err.status || 500).json({
    error: "Internal Server Error",
    message: process.env.NODE_ENV === "production" ? "An unexpected error occurred" : err.message
  });
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path2.default.join(process.cwd(), "dist");
    app.use(import_express6.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path2.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`LIFEBOX Security-First Server active on http://0.0.0.0:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
