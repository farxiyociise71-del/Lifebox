export type ItemType =
  | 'note'
  | 'photo'
  | 'screenshot'
  | 'document'
  | 'pdf'
  | 'scan'
  | 'link'
  | 'voice'
  | 'contact'
  | 'location'
  | 'task'
  | 'event'
  | 'webpage';

export type ItemCategory =
  | 'personal'
  | 'study'
  | 'work'
  | 'finance'
  | 'health'
  | 'ideas'
  | 'archive';

export interface CropInfo {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScanPage {
  id: string;
  image: string; // Base64 data URL
  originalImage?: string; // Kept intact
  pageNumber: number;
  extractedText?: string;
  rotation: number; // 0, 90, 180, 270
  cropInfo?: CropInfo;
  brightness?: number; // -50 to +50
  contrast?: number; // -50 to +50
  filter?: 'original' | 'grayscale' | 'bw_document' | 'high_contrast';
}

export interface OCRBlock {
  text: string;
  confidence?: number;
  bbox?: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
}

export interface OCRResult {
  text: string;
  confidence: number;
  blocks?: OCRBlock[];
}

export type EntityType =
  | 'DATE'
  | 'TIME'
  | 'PERSON'
  | 'LOCATION'
  | 'ORGANIZATION'
  | 'PHONE'
  | 'EMAIL'
  | 'AMOUNT'
  | 'TASK'
  | 'EVENT'
  | 'DEADLINE';

export interface ExtractedEntity {
  type: EntityType;
  value: string;
  confidence?: number;
}

export interface DetectedEvent {
  title: string;
  date?: string;
  time?: string;
  location?: string;
  description?: string;
  uncertain?: boolean;
}

export interface DetectedTask {
  title: string;
  dueDate?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  description?: string;
  uncertain?: boolean;
}

export interface DetectedReminder {
  title: string;
  dueDate?: string;
  dueTime?: string;
  notes?: string;
  uncertain?: boolean;
}

export interface ScanAnalysis {
  documentType: string;
  title: string;
  summary: string;
  dates: Array<{ date: string; context?: string; uncertain?: boolean }>;
  tasks: DetectedTask[];
  events: DetectedEvent[];
  reminders: DetectedReminder[];
  people: string[];
  locations: string[];
  organizations?: string[];
  tags: string[];
  entities?: ExtractedEntity[];
}

export interface ScannedDocument {
  id: string;
  userId?: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  pages: ScanPage[];
  extractedText: string;
  documentType: string;
  tags: string[];
  analysis?: ScanAnalysis;
  originalFileReference?: string;
  processedFileReference?: string;
  status?: 'processed' | 'draft' | 'archived';
}

export interface Flashcard {
  id: string;
  question: string;
  answer: string;
  known?: boolean;
}

export interface QuizQuestion {
  q: string;
  options: string[];
  answerIndex: number;
  explanation?: string;
  userSelected?: number;
}

export interface ReminderInfo {
  dueDate: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  repeat?: 'never' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  completed: boolean;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  notes?: string;
}

export type Reminder = ReminderInfo;

export interface LifeboxItem {
  id: string;
  title: string;
  type: ItemType;
  category: ItemCategory;
  collectionIds: string[];
  content: string; // Markdown or raw text or notes
  mediaUrl?: string; // base64 or URL
  mediaName?: string;
  extractedText?: string; // OCR text
  summary?: string; // AI generated summary
  keyPoints?: string[];
  tags: string[];
  pinned: boolean;
  favorite: boolean;
  locked: boolean; // Needs PIN
  isTrash: boolean;
  reminder?: ReminderInfo;
  studentMeta?: {
    subject?: string;
    flashcards?: Flashcard[];
    quizQuestions?: QuizQuestion[];
  };
  contactInfo?: {
    name?: string;
    phone?: string;
    email?: string;
    company?: string;
  };
  locationInfo?: {
    address?: string;
    coords?: string;
  };
  linkInfo?: {
    url: string;
    domain?: string;
  };
  taskStatus?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string;
  dueTime?: string;
  relatedEventId?: string;
  relatedNoteId?: string;
  eventDate?: string;
  eventEndDate?: string;
  eventLocation?: string;
  scanId?: string;
  scannedDocument?: ScannedDocument;
  planDetails?: {
    purpose?: string;
    tasks?: string[];
    reminders?: string[];
    notes?: string;
  };
  createdAt: string;
  updatedAt: string;
  lastOpenedAt?: string;
}

export interface Collection {
  id: string;
  name: string;
  description: string;
  icon?: string;
  color: string;
  itemCount?: number;
  createdAt?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'reminder' | 'security' | 'task';
  timestamp: string;
  read: boolean;
  targetTab?: ViewTab;
  targetItemId?: string;
  itemId?: string;
  actionUrl?: string;
}

export interface UserProfile {
  id?: string;
  username: string;
  email: string;
  avatarUrl?: string;
  language?: string;
  timezone?: string;
  pinCode?: string; // 4 digits, empty if not set
  isPinRequiredForLocked?: boolean;
  isPinProtected?: boolean;
  aiSummariesEnabled?: boolean;
  autoOcrEnabled?: boolean;
  autoTagEnabled?: boolean;
  notificationPreferences?: {
    email: boolean;
    push: boolean;
    reminders: boolean;
    dailyBriefing: boolean;
  };
  minimizeAiData?: boolean;
  theme?: 'light' | 'dark' | 'system';
  createdAt?: string;
}

export interface UserSession {
  id: string;
  ip: string;
  browser: string;
  os: string;
  createdAt: string;
  lastActiveAt: string;
  isCurrent: boolean;
}

export interface SecurityAuditEvent {
  id: string;
  userId: string;
  eventType: string;
  ip: string;
  userAgent: string;
  timestamp: string;
  details: string;
}

export type ViewTab =
  | 'today'
  | 'ask'
  | 'notes'
  | 'documents'
  | 'photos'
  | 'voice'
  | 'tasks'
  | 'plans'
  | 'calendar'
  | 'collections'
  | 'search'
  | 'security'
  | 'profile'
  | 'settings'
  | 'agent'
  | 'items'
  | 'scanner'
  | 'reminders'
  | 'student'
  | 'graph'
  | 'trash';

export type AgentMode = 'friendly' | 'general' | 'study' | 'organizer' | 'executive';

export type AiMode = 'chat' | 'lifebox';

export type CoreIntent =
  | 'LIST_NOTES'
  | 'SEARCH_NOTES'
  | 'CREATE_NOTE'
  | 'UPDATE_NOTE'
  | 'DELETE_NOTE'
  | 'LIST_DOCUMENTS'
  | 'SEARCH_DOCUMENTS'
  | 'LIST_SCANS'
  | 'SEARCH_SCANS'
  | 'GET_SCAN'
  | 'ANALYZE_SCAN'
  | 'LIST_TASKS'
  | 'SEARCH_TASKS'
  | 'CREATE_TASK'
  | 'COMPLETE_TASK'
  | 'LIST_EVENTS'
  | 'SEARCH_EVENTS'
  | 'CREATE_EVENT'
  | 'LIST_REMINDERS'
  | 'SEARCH_REMINDERS'
  | 'CREATE_REMINDER'
  | 'PERSONAL_DATA_SEARCH'
  | 'CONFIRM_ACTION'
  | 'CANCEL_ACTION'
  | 'OPEN_ITEM'
  | 'IMAGE_ANALYSIS'
  | 'FILE_ANALYSIS'
  | 'WRITING'
  | 'TRANSLATION'
  | 'SUMMARIZATION'
  | 'PLANNING'
  | 'BRAINSTORMING'
  | 'EXPLANATION'
  | 'GENERAL_KNOWLEDGE'
  | 'GENERAL_CHAT';

export interface AgentAction {
  id: string;
  type:
    | 'create_note'
    | 'create_reminder'
    | 'create_task'
    | 'create_event'
    | 'create_collection'
    | 'open_item'
    | 'analyze_scan'
    | 'confirm_delete'
    | 'tag_item';
  label: string;
  executed?: boolean;
  payload: {
    title?: string;
    content?: string;
    category?: ItemCategory;
    tags?: string[];
    dueDate?: string;
    dueTime?: string;
    priority?: 'low' | 'medium' | 'high';
    notes?: string;
    name?: string;
    description?: string;
    color?: string;
    itemIds?: string[];
    itemId?: string;
    itemTitle?: string;
    tagsToAdd?: string[];
  };
}

export interface AgentMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  mode?: AgentMode;
  aiMode?: AiMode;
  intent?: string;
  sources?: Array<{
    id: string;
    title: string;
    type: string;
    category: string;
    date?: string;
    snippet?: string;
  }>;
  thoughtSteps?: string[];
  actions?: AgentAction[];
  matchedItemIds?: string[];
  suggestedFollowUps?: string[];
  timestamp: string;
}

export interface StoredConversation {
  id: string;
  userId?: string;
  title: string;
  mode: AiMode;
  turns: AgentMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface AgentResponse {
  reply: string;
  intent?: string;
  mode?: AiMode;
  sources?: any[];
  thoughtSteps?: string[];
  actions?: AgentAction[];
  matchedItemIds?: string[];
  suggestedFollowUps?: string[];
}
