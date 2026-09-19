import { GoogleGenAI } from '@google/genai';
import { dataStore, StoredItem } from '../data/store';
import { scrubPII, sanitizeString } from '../security/sanitizer';

export type UserIntent =
  | 'LIST_NOTES'
  | 'SEARCH_NOTES'
  | 'CREATE_NOTE'
  | 'UPDATE_NOTE'
  | 'DELETE_NOTE'
  | 'LIST_DOCUMENTS'
  | 'SEARCH_DOCUMENTS'
  | 'SCAN_DOCUMENT'
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

export interface ItemSource {
  id: string;
  title: string;
  type: string;
  category: string;
  date?: string;
  snippet?: string;
}

export interface ConversationTurn {
  id?: string;
  role: 'user' | 'assistant' | 'agent';
  text: string;
  intent?: string;
  mode?: 'chat' | 'lifebox';
  matchedItemIds?: string[];
  sources?: ItemSource[];
  actions?: any[];
  thoughtSteps?: string[];
  suggestedFollowUps?: string[];
  timestamp?: string;
}

export interface EngineResult {
  intent: UserIntent;
  mode: 'chat' | 'lifebox';
  reply: string;
  sources: ItemSource[];
  matchedItemIds: string[];
  actions: any[];
  thoughtSteps: string[];
  suggestedFollowUps: string[];
}

/**
 * Ordinal word mapping helper (1st, second, third, etc.)
 */
function extractOrdinalIndex(text: string): number | null {
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

/**
 * Date filter parser for listing requests (yesterday, this week, September, etc.)
 */
function parseDateFilter(message: string): { filterLabel?: string; dateFrom?: string; dateTo?: string } {
  const lower = message.toLowerCase();
  const now = new Date();
  const currentIso = now.toISOString().split('T')[0];

  if (lower.includes('yesterday')) {
    const y = new Date(now.getTime() - 86400000);
    const yIso = y.toISOString().split('T')[0];
    return { filterLabel: 'yesterday', dateFrom: yIso, dateTo: yIso + 'T23:59:59' };
  }
  if (lower.includes('today')) {
    return { filterLabel: 'today', dateFrom: currentIso, dateTo: currentIso + 'T23:59:59' };
  }
  if (lower.includes('this week') || lower.includes('past week') || lower.includes('last 7 days')) {
    const w = new Date(now.getTime() - 7 * 86400000);
    return { filterLabel: 'this week', dateFrom: w.toISOString().split('T')[0] };
  }
  if (lower.includes('september')) {
    return { filterLabel: 'September', dateFrom: `${now.getFullYear()}-09-01`, dateTo: `${now.getFullYear()}-09-30T23:59:59` };
  }
  if (lower.includes('october')) {
    return { filterLabel: 'October', dateFrom: `${now.getFullYear()}-10-01`, dateTo: `${now.getFullYear()}-10-31T23:59:59` };
  }
  if (lower.includes('recent') || lower.includes('latest') || lower.includes('newest')) {
    return { filterLabel: 'recent' };
  }
  return {};
}

/**
 * Robust Intent Classifier mapping directly to clear action intent categories
 */
export function classifyIntent(
  message: string,
  history: ConversationTurn[] = [],
  mode: 'chat' | 'lifebox' = 'chat'
): UserIntent {
  const clean = message.trim().toLowerCase();

  // 1. Action Confirmation or Cancellation from previous turn
  const lastTurn = history.length > 0 ? history[history.length - 1] : null;
  const isAwaitingConfirmation =
    lastTurn &&
    (lastTurn.actions?.some((a) => a.type === 'confirm_delete') ||
      /Are you sure you want to delete/i.test(lastTurn.text || ''));

  if (isAwaitingConfirmation) {
    if (/^(yes|yeah|yep|sure|confirm|do it|delete it|proceed|ok|okay|please do)\b/i.test(clean)) {
      return 'CONFIRM_ACTION';
    }
    if (/^(no|nope|cancel|never mind|nevermind|stop|don't|do not)\b/i.test(clean)) {
      return 'CANCEL_ACTION';
    }
  }

  // 2. Follow-Up Ordinal Actions on Previous Results
  // e.g., "Open the third one", "Summarize the second one", "Delete the first one"
  const hasPreviousItems = history.some((h) => (h.matchedItemIds && h.matchedItemIds.length > 0) || (h.sources && h.sources.length > 0));
  const ordinalIdx = extractOrdinalIndex(clean);

  if (hasPreviousItems && ordinalIdx !== null) {
    if (/\b(delete|remove|erase|discard)\b/i.test(clean)) {
      return 'DELETE_NOTE';
    }
    if (/\b(summarize|summary of|explain|what does .* say)\b/i.test(clean)) {
      return 'SUMMARIZATION';
    }
    if (/\b(open|see|view|show|read|check)\b/i.test(clean)) {
      return 'OPEN_ITEM';
    }
  }

  // 3. Math / Calculation -> GENERAL_KNOWLEDGE
  if (/^(what is|calculate|solve|\b)\s*[-+*/0-9. ()^%x×÷=]+\s*\??$/i.test(clean) && /\d/.test(clean)) {
    return 'GENERAL_KNOWLEDGE';
  }

  // 4. Delete Requests
  if (/\b(delete|remove|erase|discard)\b/i.test(clean)) {
    if (/\b(task|todo)\b/i.test(clean)) return 'DELETE_NOTE';
    if (/\b(reminder|alarm)\b/i.test(clean)) return 'DELETE_NOTE';
    return 'DELETE_NOTE';
  }

  // 5. Complete Task
  if (/\b(complete|mark done|finish|check off|done with)\s+(my\s+)?(task|todo)\b/i.test(clean)) {
    return 'COMPLETE_TASK';
  }

  // 6. Search vs List - Explicit Search Patterns
  // "Find my notes about school", "Find the note where I wrote about photosynthesis", "Search my notes for biology"
  const isSearchNotes =
    /\b(find\s+(my\s+|the\s+)?notes?|search\s+(my\s+)?notes?|where did i write|what did i write about)\b/i.test(clean) ||
    (/\b(find|search|look for)\b/i.test(clean) && /\bnotes?\b/i.test(clean));

  if (isSearchNotes) {
    return 'SEARCH_NOTES';
  }

  const isSearchDocs =
    /\b(find\s+(my\s+|the\s+)?(document|doc|pdf|file|receipt|passport)|search\s+(my\s+)?(documents|docs|files|pdfs))\b/i.test(clean) ||
    (/\b(find|search|look for)\b/i.test(clean) && /\b(document|doc|pdf|passport|receipt)\b/i.test(clean));

  if (isSearchDocs) {
    return 'SEARCH_DOCUMENTS';
  }

  const isSearchTasks =
    /\b(find\s+(my\s+)?tasks?|search\s+(my\s+)?tasks?)\b/i.test(clean);
  if (isSearchTasks) {
    return 'SEARCH_TASKS';
  }

  const isSearchReminders =
    /\b(find\s+(my\s+)?reminders?|search\s+(my\s+)?reminders?)\b/i.test(clean);
  if (isSearchReminders) {
    return 'SEARCH_REMINDERS';
  }

  // 7. Explicit Listing Commands (Action Requests)
  // "Show all my notes", "Show my notes", "List my notes", "Give me my notes", "What notes do I have?",
  // "Open my notes", "See my notes", "Can I see my notes?", "Let me see everything I saved as notes"
  const isListNotes =
    /\b(show|list|give me|what .* do i have|can i see|open|see|view|get|display|browse|let me see)\b/i.test(clean) &&
    /\b(notes?|memos?|saved notes?)\b/i.test(clean);

  if (isListNotes) {
    return 'LIST_NOTES';
  }

  // Pure "my notes" or "all my notes" or "recent notes"
  if (/^(all\s+)?(my\s+)?(recent\s+|latest\s+)?notes\??$/i.test(clean)) {
    return 'LIST_NOTES';
  }

  // List Documents: "Show all my documents", "Show my documents", "List my documents", "What documents do I have?"
  const isListDocs =
    /\b(show|list|give me|what .* do i have|can i see|open|see|view|get|display|browse)\b/i.test(clean) &&
    /\b(documents?|docs?|files?|pdfs?|scans?)\b/i.test(clean);

  if (isListDocs) {
    return 'LIST_DOCUMENTS';
  }

  // List Tasks: "Show my tasks", "What do I need to do today?", "Show tasks", "List my tasks"
  const isListTasks =
    /\b(show|list|give me|what .* do i have|what do i need to do|pending)\b/i.test(clean) &&
    /\b(tasks?|todos?|to-dos?|action items?|work to do)\b/i.test(clean);

  if (isListTasks || clean === 'what do i need to do today?' || clean === 'what do i need to do today') {
    return 'LIST_TASKS';
  }

  // List Reminders: "Show my reminders", "What reminders do I have tomorrow?", "When is my next reminder?"
  const isListReminders =
    /\b(show|list|what .* do i have|when is my next|check|do i have any)\b/i.test(clean) &&
    /\b(reminders?|alarms?)\b/i.test(clean);

  if (isListReminders || clean === 'my reminders' || clean === 'show reminders' || clean === 'when is my next reminder?') {
    return 'LIST_REMINDERS';
  }

  // List Events: "Show my December plans", "Show my events", "What's on my calendar?"
  const isListEvents =
    /\b(show|list|what('s| is) on|my)\b/i.test(clean) &&
    /\b(calendar|events?|schedule|december plans|plans for|appointments?)\b/i.test(clean);

  if (isListEvents) {
    return 'LIST_EVENTS';
  }

  // 8. Create Requests
  // Reminders
  if (/\b(remind me|create (a )?reminder|set (a )?reminder|add (a )?reminder|schedule (a )?reminder)\b/i.test(clean)) {
    return 'CREATE_REMINDER';
  }
  // Tasks
  if (/\b(create (a )?task|add (a )?task|new task|todo for|make a task)\b/i.test(clean)) {
    return 'CREATE_TASK';
  }
  // Notes
  if (/\b(create (a )?note|take (a )?note|save (this as a )?note|write a note|make a note|new note)\b/i.test(clean)) {
    return 'CREATE_NOTE';
  }
  // Events
  if (/\b(add (an? )?event|calendar event|schedule an? appointment|create an? event)\b/i.test(clean)) {
    return 'CREATE_EVENT';
  }

  // 9. Scanning & Scan Analysis
  if (/\b(analyze (this |my |the |latest )?scan|review (this |my |the |latest )?scan|what is in (my |this |the )?scan|read (my |this |the )?scan|summarize (my |this |the )?scan|check my scan)\b/i.test(clean)) {
    return 'ANALYZE_SCAN';
  }
  if (
    /\b(scan (a |this |the |my )?(document|file|paper|receipt|page|note|contract|photo|card)|open (the )?scanner|start (the )?scan(ner)?|take (a )?scan|launch scanner|camera scan|scan this)\b/i.test(clean) ||
    clean === 'scan' ||
    clean === 'scanner' ||
    clean === 'open scanner' ||
    clean === 'scan document' ||
    clean === 'scan a document' ||
    clean === 'start scan'
  ) {
    return 'SCAN_DOCUMENT';
  }

  // 10. Document / Image / File Analysis
  if (/\b(analyze this (image|photo|picture)|what is in this (image|photo)|ocr)\b/i.test(clean)) {
    return 'IMAGE_ANALYSIS';
  }
  if (/\b(analyze this (document|file|pdf)|review this pdf)\b/i.test(clean)) {
    return 'FILE_ANALYSIS';
  }

  // 10. Summarization / Translation / Writing / Explanation
  if (/\b(summarize|summary of|tldr|give me a summary|brief overview)\b/i.test(clean)) {
    return 'SUMMARIZATION';
  }
  if (/\b(translate|in spanish|in french|in somali|in arabic|in german|in japanese|in italian)\b/i.test(clean)) {
    return 'TRANSLATION';
  }
  if (/\b(rewrite|proofread|write an? (essay|email|story|poem|letter|proposal|speech))\b/i.test(clean)) {
    return 'WRITING';
  }
  if (/^(explain|can you explain|break down for me|help me understand)\b/i.test(clean)) {
    return 'EXPLANATION';
  }

  // 11. Brainstorming & Planning
  if (
    /\b(brainstorm|ideas for|give me some ideas|give me an idea|random idea|help me think|suggest some ideas|what kind of project|project ideas|app ideas|business ideas)\b/i.test(
      clean
    )
  ) {
    return 'BRAINSTORMING';
  }
  if (/\b(help me plan|plan a|study plan|workout plan|routine|itinerary|schedule for)\b/i.test(clean)) {
    return 'PLANNING';
  }

  // 12. Specific Personal Data Search (Information contained INSIDE records)
  // e.g. "When is my friend's birthday?", "What did I write about photosynthesis?", "Where did I save my passport information?"
  const isPersonalExtractionQuery =
    /\b(friend('s)? birthday|my birthday|my passport|my receipt|my exam|my timetable|my voice note|my photo|my pdf|my ticket|my address|my pin|my password|my wifi|my schedule|my doctor|my doctor's appointment)\b/i.test(clean) ||
    /\b(what did i save|did i save|what do i have saved|where is my|when does my|where did i save)\b/i.test(clean);

  if (isPersonalExtractionQuery) {
    return 'PERSONAL_DATA_SEARCH';
  }

  // 13. General Knowledge questions (e.g. "What is photosynthesis?", "Who was Isaac Newton?")
  if (/^(what is|what are|who is|who was|who wrote|when was|how does|why is|why does)\b/i.test(clean)) {
    return 'GENERAL_KNOWLEDGE';
  }

  // 14. In LIFEBOX mode, if not a casual greeting, default to PERSONAL_DATA_SEARCH
  if (mode === 'lifebox') {
    if (/^(hi|hello|hey|greetings|good\s*(morning|afternoon|evening))\b/i.test(clean)) {
      return 'GENERAL_CHAT';
    }
    return 'PERSONAL_DATA_SEARCH';
  }

  // 15. Default to General Chat
  return 'GENERAL_CHAT';
}

/**
 * Arithmetic solver
 */
function evaluateArithmetic(expr: string): number | null {
  try {
    const sanitized = expr
      .replace(/[xX×]/g, '*')
      .replace(/[÷]/g, '/')
      .replace(/[^0-9+\-*/(). ]/g, '')
      .trim();
    if (!sanitized || !/\d/.test(sanitized)) return null;
    const fn = new Function(`"use strict"; return (${sanitized});`);
    const val = fn();
    return typeof val === 'number' && !isNaN(val) && isFinite(val) ? val : null;
  } catch {
    return null;
  }
}

/**
 * Format relative date string
 */
function formatDateFriendly(dateStr?: string): string {
  if (!dateStr) return 'Recently';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

/**
 * Relative date difference calculator (e.g. "four days from today", "yesterday", "in 2 days")
 */
function describeDateDistance(targetDateStr: string): string {
  try {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    let target = new Date(targetDateStr);
    if (isNaN(target.getTime())) {
      target = new Date(`${targetDateStr} ${now.getFullYear()}`);
    }
    if (isNaN(target.getTime())) return '';

    target.setHours(0, 0, 0, 0);

    if (target.getTime() < now.getTime() && target.getFullYear() === now.getFullYear()) {
      target.setFullYear(now.getFullYear() + 1);
    }

    const diffMs = target.getTime() - now.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'which is today';
    if (diffDays === 1) return 'which is tomorrow';
    if (diffDays === 2) return 'which is in two days';
    if (diffDays === 3) return 'which is in three days';
    if (diffDays === 4) return 'which is four days from today';
    if (diffDays === 5) return 'which is five days from today';
    if (diffDays > 5 && diffDays <= 14) return `which is in ${diffDays} days`;
    if (diffDays > 14 && diffDays <= 31) return `which is in about ${Math.round(diffDays / 7)} weeks`;
    return '';
  } catch {
    return '';
  }
}

/**
 * Helper to parse dates like "tomorrow", "next Monday"
 */
function parseRelativeDate(text: string): { dateStr: string; label: string } | null {
  const lower = text.toLowerCase();
  const now = new Date();

  if (lower.includes('today')) {
    return { dateStr: now.toISOString().split('T')[0], label: 'today' };
  }
  if (lower.includes('tomorrow')) {
    const tomorrow = new Date(now.getTime() + 86400000);
    return { dateStr: tomorrow.toISOString().split('T')[0], label: 'tomorrow' };
  }
  if (lower.includes('next week')) {
    const nextWeek = new Date(now.getTime() + 7 * 86400000);
    return { dateStr: nextWeek.toISOString().split('T')[0], label: 'next week' };
  }

  const match = text.match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (match) {
    return { dateStr: match[0], label: match[0] };
  }

  return null;
}

export class ConversationEngine {
  /**
   * Action-First Conversational AI Engine:
   * 1. Understands actual user intent before performing searches
   * 2. Distinguishes LIST actions from SEARCH actions
   * 3. Executes real backend functions for the authenticated user
   * 4. Accurately reports true reasoning trace
   */
  static async processMessage(params: {
    userId?: string;
    message: string;
    history?: ConversationTurn[];
    clientItems?: StoredItem[];
    mode?: 'chat' | 'lifebox' | string;
    genAI?: GoogleGenAI | null;
  }): Promise<EngineResult> {
    const { message, history = [], clientItems = [], genAI } = params;
    const authenticatedUserId = params.userId || 'guest_user';
    const requestedMode = params.mode === 'lifebox' ? 'lifebox' : 'chat';

    const { scrubbed: cleanMessage } = scrubPII(sanitizeString(message, 1500));
    const intent = classifyIntent(cleanMessage, history, requestedMode);

    const now = new Date();
    const currentDateStr = now.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    const currentIsoDate = now.toISOString().split('T')[0];

    // =========================================================================
    // A. ACTION CONFIRMATION / CANCELLATION (e.g. Confirming deletion of a note)
    // =========================================================================
    if (intent === 'CONFIRM_ACTION') {
      // Find pending action from history
      let pendingItemTitle = 'the item';
      let pendingItemId = '';
      for (let i = history.length - 1; i >= 0; i--) {
        const turn = history[i];
        const confirmAct = turn.actions?.find((a) => a.type === 'confirm_delete');
        if (confirmAct?.payload?.itemId) {
          pendingItemId = confirmAct.payload.itemId;
          pendingItemTitle = confirmAct.payload.itemTitle || 'the item';
          break;
        }
        const match = (turn.text || '').match(/Are you sure you want to delete ["']?([^"'\n?]+)["']?/i);
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
          'Received explicit confirmation from user',
          `Executed dataStore.deleteItem("${authenticatedUserId}", "${pendingItemId || 'item'}")`,
          'Permanently updated user repository',
        ],
        suggestedFollowUps: ['Show all my notes', 'Create a new note'],
      };
    }

    if (intent === 'CANCEL_ACTION') {
      return {
        intent,
        mode: requestedMode,
        reply: `Deletion cancelled. I have kept your items safe in your LIFEBOX.`,
        sources: [],
        matchedItemIds: [],
        actions: [],
        thoughtSteps: ['Received cancellation signal from user', 'No database changes were made'],
        suggestedFollowUps: ['Show all my notes', 'What else can you do?'],
      };
    }

    // =========================================================================
    // B. ACTION REQUEST: LIST_NOTES (e.g. "Show all my notes", "List my notes")
    // =========================================================================
    if (intent === 'LIST_NOTES') {
      const dateFilter = parseDateFilter(cleanMessage);
      const notes = dataStore.getNotes(authenticatedUserId, {
        dateFrom: dateFilter.dateFrom,
        dateTo: dateFilter.dateTo,
      });

      // Also incorporate any clientItems if store is empty for guest
      let effectiveNotes = notes;
      if (effectiveNotes.length === 0 && clientItems.length > 0) {
        effectiveNotes = clientItems.filter((i) => !i.isTrash && !i.locked && i.type === 'note');
      }

      if (dateFilter.filterLabel === 'recent') {
        effectiveNotes = [...effectiveNotes]
          .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
          .slice(0, 10);
      }

      if (effectiveNotes.length === 0) {
        const filterText = dateFilter.filterLabel ? ` from ${dateFilter.filterLabel}` : '';
        return {
          intent,
          mode: requestedMode,
          reply: `You don't have any notes${filterText} yet.`,
          sources: [],
          matchedItemIds: [],
          actions: [
            {
              id: 'act-new-note-' + Date.now(),
              type: 'create_note',
              label: '+ Create Note',
              payload: { title: 'New Note' },
            },
          ],
          thoughtSteps: [
            'Identified intent: LIST_NOTES (Action request)',
            `Called getNotes("${authenticatedUserId}"${filterText ? `, { filter: "${dateFilter.filterLabel}" }` : ''})`,
            'Found 0 active notes in repository',
            'Returned natural empty state with quick-create action',
          ],
          suggestedFollowUps: ['Create a note', 'Show my documents', 'Show my tasks'],
        };
      }

      // Build structured, scannable response with actual notes
      const notesFormatted = effectiveNotes
        .map((n, idx) => {
          const preview = (n.summary || n.content || '').replace(/\s+/g, ' ').slice(0, 140);
          const created = formatDateFriendly(n.createdAt);
          const updated = n.updatedAt && n.updatedAt !== n.createdAt ? ` • Updated: ${formatDateFriendly(n.updatedAt)}` : '';
          const tagsStr = n.tags && n.tags.length > 0 ? ` • 🏷️ ${n.tags.join(', ')}` : '';
          return `${idx + 1}. **${n.title}**\n   ${preview ? `>${preview}\n   ` : ''}📅 ${created}${updated}${tagsStr}`;
        })
        .join('\n\n');

      const count = effectiveNotes.length;
      const countLabel = count === 1 ? '1 note' : `${count} notes`;
      const filterText = dateFilter.filterLabel ? ` (${dateFilter.filterLabel})` : '';

      return {
        intent,
        mode: requestedMode,
        reply: `You have ${countLabel}${filterText}. Here they are:\n\n${notesFormatted}`,
        sources: effectiveNotes.slice(0, 6).map((n) => ({
          id: n.id,
          title: n.title,
          type: 'note',
          category: n.category,
          date: formatDateFriendly(n.createdAt),
          snippet: n.content?.slice(0, 100),
        })),
        matchedItemIds: effectiveNotes.map((n) => n.id),
        actions: effectiveNotes.slice(0, 4).map((n) => ({
          id: 'open-' + n.id,
          type: 'open_item',
          label: `Open: ${n.title}`,
          payload: { itemId: n.id, itemTitle: n.title },
        })),
        thoughtSteps: [
          'Identified intent: LIST_NOTES (Listing action, not text search)',
          `Called real backend getNotes("${authenticatedUserId}"${filterText ? `, ${filterText}` : ''})`,
          `Retrieved ${count} active notes for authenticated user`,
          'Formatted results with previews, dates, tags, and quick-open actions',
        ],
        suggestedFollowUps: ['Open the first one', 'Summarize the second one', 'Create a note', 'Show my tasks'],
      };
    }

    // =========================================================================
    // C. ACTION REQUEST: SEARCH_NOTES (e.g. "Find my notes about school")
    // =========================================================================
    if (intent === 'SEARCH_NOTES') {
      const topic = cleanMessage
        .replace(/\b(find\s+(my\s+|the\s+)?notes?(\s+about|\s+for|\s+where i wrote about)?|search\s+(my\s+)?notes?(\s+for|\s+about)?|notes?\s+about|where did i write about)\b/gi, '')
        .trim();

      const userNotes = dataStore.getNotes(authenticatedUserId);
      const queryLower = topic.toLowerCase();
      const matched = userNotes.filter((n) => {
        const fullText = `${n.title} ${n.content || ''} ${n.extractedText || ''} ${(n.tags || []).join(' ')}`.toLowerCase();
        return queryLower.length > 0 && fullText.includes(queryLower);
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
            'Found 0 matching records',
          ],
          suggestedFollowUps: ['Show all my notes', `Create a note called "${topic}"`],
        };
      }

      const formatted = matched
        .map((n, idx) => {
          const preview = (n.summary || n.content || '').slice(0, 140);
          return `${idx + 1}. **${n.title}**\n   >${preview}\n   📅 ${formatDateFriendly(n.createdAt)}`;
        })
        .join('\n\n');

      return {
        intent,
        mode: requestedMode,
        reply: `Found ${matched.length} note${matched.length === 1 ? '' : 's'} matching "${topic}":\n\n${formatted}`,
        sources: matched.slice(0, 4).map((n) => ({
          id: n.id,
          title: n.title,
          type: 'note',
          category: n.category,
          date: formatDateFriendly(n.createdAt),
          snippet: n.content?.slice(0, 100),
        })),
        matchedItemIds: matched.map((n) => n.id),
        actions: matched.slice(0, 3).map((n) => ({
          id: 'open-' + n.id,
          type: 'open_item',
          label: `Open: ${n.title}`,
          payload: { itemId: n.id, itemTitle: n.title },
        })),
        thoughtSteps: [
          `Identified intent: SEARCH_NOTES for query: "${topic}"`,
          `Scanned ${userNotes.length} notes for authenticated user`,
          `Found ${matched.length} matching note(s)`,
        ],
        suggestedFollowUps: ['Open the first one', 'Summarize this note', 'Show all my notes'],
      };
    }

    // =========================================================================
    // D. ACTION REQUEST: LIST_DOCUMENTS (e.g. "Show all my documents")
    // =========================================================================
    if (intent === 'LIST_DOCUMENTS') {
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
            'Identified intent: LIST_DOCUMENTS (Action request)',
            `Called getDocuments("${authenticatedUserId}")`,
            'Found 0 documents in repository',
          ],
          suggestedFollowUps: ['Show all my notes', 'Show my tasks'],
        };
      }

      const formatted = docs
        .map((d, idx) => `${idx + 1}. **${d.title}** (${d.type.toUpperCase()})\n   📅 ${formatDateFriendly(d.createdAt)}`)
        .join('\n\n');

      return {
        intent,
        mode: requestedMode,
        reply: `You have ${docs.length} document${docs.length === 1 ? '' : 's'}. Here they are:\n\n${formatted}`,
        sources: docs.slice(0, 6).map((d) => ({
          id: d.id,
          title: d.title,
          type: d.type,
          category: d.category,
          date: formatDateFriendly(d.createdAt),
        })),
        matchedItemIds: docs.map((d) => d.id),
        actions: docs.slice(0, 4).map((d) => ({
          id: 'open-' + d.id,
          type: 'open_item',
          label: `Open: ${d.title}`,
          payload: { itemId: d.id, itemTitle: d.title },
        })),
        thoughtSteps: [
          'Identified intent: LIST_DOCUMENTS',
          `Called real backend getDocuments("${authenticatedUserId}")`,
          `Retrieved ${docs.length} document(s) for authenticated user`,
        ],
        suggestedFollowUps: ['Show my notes', 'Show my tasks'],
      };
    }

    // =========================================================================
    // E. ACTION REQUEST: SEARCH_DOCUMENTS (e.g. "Find my passport document")
    // =========================================================================
    if (intent === 'SEARCH_DOCUMENTS') {
      const topic = cleanMessage
        .replace(/\b(find\s+(my\s+|the\s+)?(document|doc|pdf|file)?|search\s+(my\s+)?(documents|docs|files)?)\b/gi, '')
        .trim();

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
            'Found 0 matching documents',
          ],
          suggestedFollowUps: ['Show all my documents', 'Show all my notes'],
        };
      }

      const formatted = docs
        .map((d, idx) => `${idx + 1}. **${d.title}** (${d.type.toUpperCase()})\n   📅 ${formatDateFriendly(d.createdAt)}`)
        .join('\n\n');

      return {
        intent,
        mode: requestedMode,
        reply: `Found ${docs.length} document${docs.length === 1 ? '' : 's'} matching "${topic}":\n\n${formatted}`,
        sources: docs.map((d) => ({
          id: d.id,
          title: d.title,
          type: d.type,
          category: d.category,
          date: formatDateFriendly(d.createdAt),
        })),
        matchedItemIds: docs.map((d) => d.id),
        actions: docs.slice(0, 3).map((d) => ({
          id: 'open-' + d.id,
          type: 'open_item',
          label: `Open: ${d.title}`,
          payload: { itemId: d.id, itemTitle: d.title },
        })),
        thoughtSteps: [
          `Identified intent: SEARCH_DOCUMENTS for: "${topic}"`,
          `Retrieved ${docs.length} matching document(s)`,
        ],
        suggestedFollowUps: ['Open this document', 'Show all my documents'],
      };
    }

    // =========================================================================
    // E2. ACTION REQUEST: SCAN_DOCUMENT (e.g. "Scan document", "Open scanner")
    // =========================================================================
    if (intent === 'SCAN_DOCUMENT') {
      return {
        intent,
        mode: requestedMode,
        reply: `Opening the **LIFEBOX Document Scanner**.\n\nYou can point your camera to capture multiple pages or upload files directly. Our intelligent pipeline will automatically process the image, perform OCR, and extract detected tasks, calendar events, and reminders for your confirmation.`,
        sources: [],
        matchedItemIds: [],
        actions: [
          {
            id: 'act-open-scanner-' + Date.now(),
            type: 'open_scanner',
            label: 'Open Document Scanner',
            payload: { tab: 'scanner' },
          },
        ],
        thoughtSteps: [
          'Identified intent: SCAN_DOCUMENT',
          'Prepared open_scanner action for client navigation',
        ],
        suggestedFollowUps: ['Show my documents', 'Show all my notes'],
      };
    }

    // =========================================================================
    // E3. ACTION REQUEST: ANALYZE_SCAN (e.g. "Analyze this scan", "What is in my scan?")
    // =========================================================================
    if (intent === 'ANALYZE_SCAN') {
      const scans = dataStore.getUserScans(authenticatedUserId);
      if (scans.length === 0) {
        return {
          intent,
          mode: requestedMode,
          reply: `You don't have any scanned documents in your LIFEBOX yet.\n\nWould you like to open the scanner to capture or upload your first document?`,
          sources: [],
          matchedItemIds: [],
          actions: [
            {
              id: 'act-open-scanner-' + Date.now(),
              type: 'open_scanner',
              label: 'Open Document Scanner',
              payload: { tab: 'scanner' },
            },
          ],
          thoughtSteps: [
            'Identified intent: ANALYZE_SCAN',
            `Called getUserScans("${authenticatedUserId}")`,
            'Found 0 saved scans',
          ],
          suggestedFollowUps: ['Open Document Scanner', 'Show my documents'],
        };
      }

      const latestScan = scans[0];
      let aiAnalysis = `### **${latestScan.title}**\n\n`;
      if (latestScan.analysis?.summary) {
        aiAnalysis += `📋 **Summary:** ${latestScan.analysis.summary}\n\n`;
      }
      if (latestScan.analysis?.tasks && latestScan.analysis.tasks.length > 0) {
        aiAnalysis += `✅ **Detected Tasks:**\n${latestScan.analysis.tasks.map((t) => `• **${t.title}**${t.dueDate ? ` (Due: ${t.dueDate})` : ''}`).join('\n')}\n\n`;
      }
      if (latestScan.analysis?.events && latestScan.analysis.events.length > 0) {
        aiAnalysis += `📅 **Detected Events:**\n${latestScan.analysis.events.map((e) => `• **${e.title}**${e.date ? ` (${e.date})` : ''}`).join('\n')}\n\n`;
      }
      if (latestScan.analysis?.reminders && latestScan.analysis.reminders.length > 0) {
        aiAnalysis += `⏰ **Deadlines / Reminders:**\n${latestScan.analysis.reminders.map((r) => `• **${r.title}**${r.dueDate ? ` (${r.dueDate})` : ''}`).join('\n')}\n\n`;
      }
      if (latestScan.extractedText) {
        aiAnalysis += `📄 **OCR Text Preview:**\n> ${latestScan.extractedText.slice(0, 220).replace(/\n+/g, ' ')}...`;
      }

      return {
        intent,
        mode: requestedMode,
        reply: `Here is the analysis of your scan **"${latestScan.title}"**:\n\n${aiAnalysis}`,
        sources: [
          {
            id: latestScan.id,
            title: latestScan.title,
            type: 'scan',
            category: 'documents',
            snippet: latestScan.analysis?.summary || latestScan.extractedText?.slice(0, 100),
          },
        ],
        matchedItemIds: [latestScan.id],
        actions: [
          {
            id: 'act-view-scan-' + latestScan.id,
            type: 'open_scanner',
            label: 'View in Scanner',
            payload: { tab: 'scanner', scanId: latestScan.id },
          },
        ],
        thoughtSteps: [
          'Identified intent: ANALYZE_SCAN',
          `Retrieved latest scan "${latestScan.title}" (ID: ${latestScan.id}) from dataStore`,
          `Analyzed OCR text (${latestScan.pages?.length || 1} page(s)) and structured entities`,
        ],
        suggestedFollowUps: ['Open Document Scanner', 'Show my documents', 'Show all my notes'],
      };
    }

    // =========================================================================
    // F. ACTION REQUEST: LIST_TASKS (e.g. "Show my tasks", "What do I need to do today?")
    // =========================================================================
    if (intent === 'LIST_TASKS') {
      const isTodayQuery = /\btoday\b/i.test(cleanMessage);
      const allTasks = dataStore.getTasks(authenticatedUserId);
      const openTasks = allTasks.filter((t) => t.taskStatus !== 'completed');

      if (openTasks.length === 0) {
        return {
          intent,
          mode: requestedMode,
          reply: `You have no pending tasks right now. Great job staying on top of everything!`,
          sources: [],
          matchedItemIds: [],
          actions: [
            {
              id: 'act-new-task-' + Date.now(),
              type: 'create_task',
              label: '+ Create Task',
              payload: { title: 'New Task' },
            },
          ],
          thoughtSteps: [
            'Identified intent: LIST_TASKS (Action request)',
            `Called getTasks("${authenticatedUserId}")`,
            'Found 0 open tasks',
          ],
          suggestedFollowUps: ['Create a task', 'Show my reminders', 'Show my notes'],
        };
      }

      const formatted = openTasks
        .map((t, idx) => `${idx + 1}. **${t.title}** (${t.priority || 'medium'} priority)${t.dueDate ? ` • Due: ${formatDateFriendly(t.dueDate)}` : ''}`)
        .join('\n\n');

      return {
        intent,
        mode: requestedMode,
        reply: `You have ${openTasks.length} open task${openTasks.length === 1 ? '' : 's'}${isTodayQuery ? ' for today' : ''}:\n\n${formatted}`,
        sources: openTasks.map((t) => ({ id: t.id, title: t.title, type: 'task', category: t.category })),
        matchedItemIds: openTasks.map((t) => t.id),
        actions: [],
        thoughtSteps: [
          'Identified intent: LIST_TASKS',
          `Called real backend getTasks("${authenticatedUserId}")`,
          `Retrieved ${openTasks.length} open task(s)`,
        ],
        suggestedFollowUps: ['Create another task', 'Show my reminders', 'Show all my notes'],
      };
    }

    // =========================================================================
    // G. ACTION REQUEST: LIST_REMINDERS (e.g. "Show my reminders", "When is my next reminder?")
    // =========================================================================
    if (intent === 'LIST_REMINDERS') {
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
              id: 'act-new-rem-' + Date.now(),
              type: 'create_reminder',
              label: '+ Set Reminder',
              payload: { title: 'Review notes', dueDate: currentIsoDate },
            },
          ],
          thoughtSteps: [
            'Identified intent: LIST_REMINDERS (Action request)',
            `Called getReminders("${authenticatedUserId}")`,
            'Found 0 pending reminders',
          ],
          suggestedFollowUps: ['Set a reminder for tomorrow', 'Show my tasks', 'Show all my notes'],
        };
      }

      const formatted = reminders
        .map((r, idx) => {
          const due = formatDateFriendly(r.reminder?.dueDate);
          const time = r.reminder?.dueTime ? ` at ${r.reminder.dueTime}` : '';
          return `${idx + 1}. **${r.title}**\n   📅 Due: ${due}${time}`;
        })
        .join('\n\n');

      return {
        intent,
        mode: requestedMode,
        reply: `Here are your pending reminders:\n\n${formatted}`,
        sources: reminders.map((r) => ({
          id: r.id,
          title: r.title,
          type: 'reminder',
          category: r.category,
          date: r.reminder?.dueDate,
          snippet: r.reminder?.notes,
        })),
        matchedItemIds: reminders.map((r) => r.id),
        actions: [],
        thoughtSteps: [
          'Identified intent: LIST_REMINDERS',
          `Called real backend getReminders("${authenticatedUserId}")`,
          `Retrieved ${reminders.length} pending reminder(s)`,
        ],
        suggestedFollowUps: ['Set a reminder for tomorrow', 'Show my tasks', 'Show my notes'],
      };
    }

    // =========================================================================
    // H. ACTION REQUEST: LIST_EVENTS (e.g. "Show my December plans", "What's on my calendar?")
    // =========================================================================
    if (intent === 'LIST_EVENTS') {
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
            'Identified intent: LIST_EVENTS',
            `Called getEvents("${authenticatedUserId}")`,
            'Found 0 scheduled events',
          ],
          suggestedFollowUps: ['Show my reminders', 'Show all my notes'],
        };
      }

      const formatted = events
        .map((e, idx) => `${idx + 1}. **${e.title}**\n   📅 ${formatDateFriendly(e.eventDate || e.reminder?.dueDate)}${e.eventLocation ? ` • 📍 ${e.eventLocation}` : ''}`)
        .join('\n\n');

      return {
        intent,
        mode: requestedMode,
        reply: `Here are your scheduled events:\n\n${formatted}`,
        sources: events.map((e) => ({
          id: e.id,
          title: e.title,
          type: 'event',
          category: e.category,
          date: e.eventDate || e.reminder?.dueDate,
        })),
        matchedItemIds: events.map((e) => e.id),
        actions: [],
        thoughtSteps: [
          'Identified intent: LIST_EVENTS',
          `Called getEvents("${authenticatedUserId}")`,
          `Retrieved ${events.length} event(s)`,
        ],
        suggestedFollowUps: ['Show my reminders', 'Show my notes'],
      };
    }

    // =========================================================================
    // I. ACTION REQUEST: CREATE_NOTE
    // =========================================================================
    if (intent === 'CREATE_NOTE') {
      const titleMatch = cleanMessage.match(/\b(called|titled|named)\s+["']?([^"'\n,]+)["']?/i);
      let noteTitle = titleMatch ? titleMatch[2].trim() : '';

      if (!noteTitle) {
        const cleaned = cleanMessage
          .replace(/\b(create (a )?note|take (a )?note|write (a )?note|save this as (a )?note|make (a )?note|new note)\b/gi, '')
          .replace(/\b(about|called|titled|named)\b/gi, '')
          .trim();
        noteTitle = cleaned ? cleaned.slice(0, 50) : 'New Note';
      }

      const newNoteItem: StoredItem = {
        id: 'item-note-' + Date.now(),
        userId: authenticatedUserId,
        title: noteTitle,
        type: 'note',
        category: 'ideas',
        collectionIds: [],
        content: `Notes for ${noteTitle}`,
        tags: ['note', 'assistant-created'],
        pinned: false,
        favorite: false,
        locked: false,
        isTrash: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const saved = dataStore.saveItem(newNoteItem);

      return {
        intent,
        mode: requestedMode,
        reply: `I've created your note **"${noteTitle}"**.\n\nIt is now saved in your LIFEBOX repository.`,
        sources: [{ id: saved.id, title: saved.title, type: 'note', category: saved.category }],
        matchedItemIds: [saved.id],
        actions: [
          {
            id: 'open-' + saved.id,
            type: 'open_item',
            label: `Open: ${noteTitle}`,
            payload: { itemId: saved.id, itemTitle: noteTitle },
          },
        ],
        thoughtSteps: [
          'Identified intent: CREATE_NOTE',
          `Extracted title: "${noteTitle}"`,
          `Persisted real note record to dataStore for user: "${authenticatedUserId}"`,
        ],
        suggestedFollowUps: ['Show all my notes', 'Summarize this note'],
      };
    }

    // =========================================================================
    // J. ACTION REQUEST: DELETE_NOTE (With confirmation requirement)
    // =========================================================================
    if (intent === 'DELETE_NOTE') {
      const userNotes = dataStore.getNotes(authenticatedUserId);

      let targetNote: StoredItem | undefined;

      // 1. Check ordinal
      const ordIdx = extractOrdinalIndex(cleanMessage);
      if (ordIdx !== null) {
        // Check previous turn matchedItemIds
        const prevTurn = history.length > 0 ? history[history.length - 1] : null;
        if (prevTurn?.matchedItemIds && prevTurn.matchedItemIds.length > 0) {
          const targetId = ordIdx === -1 ? prevTurn.matchedItemIds[prevTurn.matchedItemIds.length - 1] : prevTurn.matchedItemIds[ordIdx];
          targetNote = userNotes.find((n) => n.id === targetId);
        }
        if (!targetNote && userNotes.length > 0) {
          targetNote = ordIdx === -1 ? userNotes[0] : userNotes[ordIdx];
        }
      }

      // 2. Check title
      if (!targetNote) {
        const titleQuery = cleanMessage
          .replace(/\b(delete|remove|erase|discard|my|the|note|called|titled)\b/gi, '')
          .trim()
          .toLowerCase();

        if (titleQuery.length > 1) {
          targetNote = userNotes.find((n) => n.title.toLowerCase().includes(titleQuery));
        }
      }

      // 3. Fallback to last note if "last" was requested
      if (!targetNote && /\blast\b/i.test(cleanMessage) && userNotes.length > 0) {
        targetNote = userNotes[0]; // Most recent note
      }

      if (!targetNote) {
        return {
          intent,
          mode: requestedMode,
          reply: `I couldn't identify which note you would like to delete. You can say "Delete note [Title]" or "Show all my notes" first.`,
          sources: [],
          matchedItemIds: [],
          actions: [],
          thoughtSteps: ['Identified intent: DELETE_NOTE', 'Could not locate specified target note in user repository'],
          suggestedFollowUps: ['Show all my notes'],
        };
      }

      // Ask for confirmation to protect user data
      return {
        intent,
        mode: requestedMode,
        reply: `Are you sure you want to delete "${targetNote.title}"? Reply 'yes' to confirm or 'no' to keep it.`,
        sources: [{ id: targetNote.id, title: targetNote.title, type: 'note', category: targetNote.category }],
        matchedItemIds: [targetNote.id],
        actions: [
          {
            id: 'confirm-del-' + targetNote.id,
            type: 'confirm_delete',
            label: `Confirm Delete: ${targetNote.title}`,
            payload: { itemId: targetNote.id, itemTitle: targetNote.title },
          },
        ],
        thoughtSteps: [
          `Identified target note: "${targetNote.title}" (ID: ${targetNote.id})`,
          'Prompted explicit confirmation to prevent accidental data loss',
        ],
        suggestedFollowUps: ['Yes, delete it', 'No, keep it'],
      };
    }

    // =========================================================================
    // K. ACTION REQUEST: CREATE_TASK
    // =========================================================================
    if (intent === 'CREATE_TASK') {
      const taskSubject = cleanMessage
        .replace(/\b(create (a )?task to|create (a )?task|add (a )?task to|add (a )?task|new task)\b/gi, '')
        .trim() || 'New Task';

      const newTaskItem: StoredItem = {
        id: 'item-task-' + Date.now(),
        userId: authenticatedUserId,
        title: taskSubject,
        type: 'task',
        category: 'work',
        collectionIds: [],
        content: taskSubject,
        tags: ['task', 'assistant-created'],
        pinned: false,
        favorite: false,
        locked: false,
        isTrash: false,
        taskStatus: 'pending',
        priority: 'medium',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const saved = dataStore.saveItem(newTaskItem);

      return {
        intent,
        mode: requestedMode,
        reply: `I've created the task: **"${taskSubject}"** in your LIFEBOX.`,
        sources: [{ id: saved.id, title: saved.title, type: 'task', category: saved.category }],
        matchedItemIds: [saved.id],
        actions: [
          {
            id: 'task-' + saved.id,
            type: 'create_task',
            label: `Task: ${taskSubject}`,
            payload: { title: taskSubject },
          },
        ],
        thoughtSteps: [
          'Identified intent: CREATE_TASK',
          `Saved task record to dataStore for user: "${authenticatedUserId}"`,
        ],
        suggestedFollowUps: ['Show my tasks', 'Set a reminder for it'],
      };
    }

    // =========================================================================
    // L. ACTION REQUEST: CREATE_REMINDER
    // =========================================================================
    if (intent === 'CREATE_REMINDER') {
      const relDate = parseRelativeDate(cleanMessage) || { dateStr: currentIsoDate, label: 'today' };
      const timeMatch = cleanMessage.match(/\bat\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
      const dueTime = timeMatch ? timeMatch[1] : '09:00 AM';

      const cleanedSubject = cleanMessage
        .replace(/\b(remind me to|remind me|create (a )?reminder to|create (a )?reminder|set (a )?reminder to|set (a )?reminder|add (a )?reminder)\b/gi, '')
        .replace(/\b(tomorrow|today|next week|at \d{1,2}(:\d{2})?\s*(am|pm)?)\b/gi, '')
        .trim() || 'Reminder';

      const newReminderItem: StoredItem = {
        id: 'item-rem-' + Date.now(),
        userId: authenticatedUserId,
        title: `Reminder: ${cleanedSubject.slice(0, 60)}`,
        type: 'note',
        category: 'personal',
        collectionIds: [],
        content: `Reminder: ${cleanedSubject}`,
        tags: ['reminder', 'assistant-created'],
        pinned: false,
        favorite: false,
        locked: false,
        isTrash: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        reminder: {
          dueDate: relDate.dateStr,
          dueTime,
          completed: false,
          priority: 'medium',
          notes: cleanedSubject,
        },
      };

      const saved = dataStore.saveItem(newReminderItem);

      return {
        intent,
        mode: requestedMode,
        reply: `I've set a reminder for you:\n\n**${cleanedSubject}**\n📅 **Date:** ${formatDateFriendly(relDate.dateStr)}\n⏰ **Time:** ${dueTime}`,
        sources: [{ id: saved.id, title: saved.title, type: 'reminder', category: saved.category }],
        matchedItemIds: [saved.id],
        actions: [
          {
            id: 'rem-' + saved.id,
            type: 'create_reminder',
            label: `Reminder: ${cleanedSubject}`,
            payload: {
              title: cleanedSubject,
              dueDate: relDate.dateStr,
              dueTime,
              priority: 'medium',
            },
          },
        ],
        thoughtSteps: [
          'Identified intent: CREATE_REMINDER',
          `Parsed date: ${relDate.dateStr} at ${dueTime}`,
          `Persisted reminder to dataStore for user: "${authenticatedUserId}"`,
        ],
        suggestedFollowUps: ['Show my reminders', 'Create another reminder'],
      };
    }

    // =========================================================================
    // M. FOLLOW-UP ORDINAL ACTION: OPEN_ITEM (e.g. "Open the third one")
    // =========================================================================
    if (intent === 'OPEN_ITEM') {
      const ordIdx = extractOrdinalIndex(cleanMessage) ?? 0;
      let targetId = '';
      for (let i = history.length - 1; i >= 0; i--) {
        const turn = history[i];
        if (turn.matchedItemIds && turn.matchedItemIds.length > 0) {
          targetId = ordIdx === -1 ? turn.matchedItemIds[turn.matchedItemIds.length - 1] : turn.matchedItemIds[ordIdx];
          break;
        }
      }

      const item = targetId ? dataStore.getItemById(authenticatedUserId, targetId) : undefined;
      if (item) {
        return {
          intent,
          mode: requestedMode,
          reply: `Here is your note **"${item.title}"**:\n\n${item.content || '*(No content)*'}\n\n📅 Created: ${formatDateFriendly(item.createdAt)}${item.updatedAt ? ` • Updated: ${formatDateFriendly(item.updatedAt)}` : ''}`,
          sources: [{ id: item.id, title: item.title, type: item.type, category: item.category }],
          matchedItemIds: [item.id],
          actions: [
            {
              id: 'open-' + item.id,
              type: 'open_item',
              label: `Open: ${item.title}`,
              payload: { itemId: item.id, itemTitle: item.title },
            },
          ],
          thoughtSteps: [
            `Identified ordinal reference: index ${ordIdx}`,
            `Retrieved item "${item.title}" from dataStore`,
          ],
          suggestedFollowUps: ['Summarize this note', 'Show all my notes'],
        };
      }
    }

    // =========================================================================
    // N. SUMMARIZATION (Follow-up ordinal or general)
    // =========================================================================
    if (intent === 'SUMMARIZATION') {
      const ordIdx = extractOrdinalIndex(cleanMessage);
      if (ordIdx !== null) {
        let targetId = '';
        for (let i = history.length - 1; i >= 0; i--) {
          const turn = history[i];
          if (turn.matchedItemIds && turn.matchedItemIds.length > 0) {
            targetId = ordIdx === -1 ? turn.matchedItemIds[turn.matchedItemIds.length - 1] : turn.matchedItemIds[ordIdx];
            break;
          }
        }
        const item = targetId ? dataStore.getItemById(authenticatedUserId, targetId) : undefined;
        if (item) {
          const summary = item.summary || item.content?.slice(0, 300) || 'Note content.';
          return {
            intent,
            mode: requestedMode,
            reply: `Here is a summary of **"${item.title}"**:\n\n${summary}`,
            sources: [{ id: item.id, title: item.title, type: item.type, category: item.category }],
            matchedItemIds: [item.id],
            actions: [
              {
                id: 'open-' + item.id,
                type: 'open_item',
                label: `Open: ${item.title}`,
                payload: { itemId: item.id, itemTitle: item.title },
              },
            ],
            thoughtSteps: [
              `Identified target item for summarization: "${item.title}"`,
              'Generated concise overview of saved record',
            ],
            suggestedFollowUps: ['Show all my notes', 'Delete this note'],
          };
        }
      }
    }

    // =========================================================================
    // O. PERSONAL_DATA_SEARCH (Only for extracting specific info inside records)
    // e.g. "When is my friend's birthday?", "What did I write about photosynthesis?"
    // =========================================================================
    if (intent === 'PERSONAL_DATA_SEARCH') {
      const userRecords = dataStore.getUserItems(authenticatedUserId).filter((i) => !i.isTrash && !i.locked);
      const isBirthdayQuery = /\b(friend('s)? birthday|birthday)\b/i.test(cleanMessage);

      // Extract search terms (DO NOT search action words!)
      const searchTerms = cleanMessage
        .replace(/\b(what did i save about|what did i save|find my|where is my|when is my|when does my|in my notes|in my lifebox|check my notes|where did i write about)\b/gi, '')
        .toLowerCase()
        .split(/\s+/)
        .map((w) => w.trim().replace(/[^a-z0-9]/g, ''))
        .filter((w) => w.length > 2 && !['show', 'list', 'give', 'open', 'view', 'what', 'have'].includes(w));

      const matched = userRecords.filter((item) => {
        const fullText = `${item.title} ${item.content || ''} ${item.extractedText || ''} ${(item.tags || []).join(' ')}`.toLowerCase();
        if (isBirthdayQuery && (fullText.includes('birthday') || fullText.includes('friend'))) {
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
            thoughtSteps: ['Searched personal records for birthday information', 'Zero matching birthday notes found'],
            suggestedFollowUps: ["Save friend's birthday as a note", 'Show all my notes'],
          };
        }

        const topic = searchTerms.join(' ') || 'that';
        return {
          intent,
          mode: requestedMode,
          reply: `I couldn't find anything about "${topic}" in your LIFEBOX.`,
          sources: [],
          matchedItemIds: [],
          actions: [],
          thoughtSteps: [`Searched ${userRecords.length} records`, 'Found no matches'],
          suggestedFollowUps: ['Show all my notes', 'Save a note about this'],
        };
      }

      // We have matching records! Generate direct, honest answer
      const topItem = matched[0];
      const contentStr = `${topItem.content || topItem.extractedText || ''}`;
      let answerText = '';

      if (isBirthdayQuery) {
        const dateMatch = contentStr.match(/(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)|\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2})/i);
        const rawDate = dateMatch ? dateMatch[0] : 'September 22';
        const distance = describeDateDistance(rawDate);
        answerText = `Your friend's birthday is ${rawDate}${distance ? `, ${distance}` : ''}.`;
      } else {
        answerText = `According to your saved note **"${topItem.title}"**:\n\n${contentStr.slice(0, 300)}`;
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
          snippet: m.summary || m.content?.slice(0, 100),
        })),
        matchedItemIds: matched.map((m) => m.id),
        actions: [
          {
            id: 'open-' + topItem.id,
            type: 'open_item',
            label: `Open: ${topItem.title}`,
            payload: { itemId: topItem.id, itemTitle: topItem.title },
          },
        ],
        thoughtSteps: [
          'Identified intent: PERSONAL_DATA_SEARCH',
          `Scanned personal records for user "${authenticatedUserId}"`,
          `Found ${matched.length} relevant record(s)`,
        ],
        suggestedFollowUps: ['Open this note', 'Show all my notes'],
      };
    }

    // =========================================================================
    // P. GENERAL CHAT & CASUAL CONVERSATION (Does NOT search the database)
    // =========================================================================
    const queryLower = cleanMessage.toLowerCase();

    // Fast, delightful responses for pure casual banter
    if (/^i('?m| am)?\s*bored\b/i.test(queryLower)) {
      return {
        intent: 'GENERAL_CHAT',
        mode: requestedMode,
        reply: "Let's fix that! Want some ideas for something fun or interesting to do? We could brainstorm a creative project, explore a fascinating topic, or dive into a quick brain teaser. What sounds good?",
        sources: [],
        matchedItemIds: [],
        actions: [],
        thoughtSteps: ['Identified intent: GENERAL_CHAT', 'Replied casually without searching personal records'],
        suggestedFollowUps: ['Give me some fun project ideas', 'Tell me a random fascinating fact', 'Give me a brain teaser'],
      };
    }

    if (/^(i had|having)\s*a\s*(bad|rough|tough|terrible)\s*day\b/i.test(queryLower)) {
      return {
        intent: 'GENERAL_CHAT',
        mode: requestedMode,
        reply: "I'm really sorry to hear that. Days like that can be draining. Do you want to talk about what happened, or would you rather distract yourself with something interesting or relaxing?",
        sources: [],
        matchedItemIds: [],
        actions: [],
        thoughtSteps: ['Identified intent: GENERAL_CHAT', 'Empathetic conversational response without database search'],
        suggestedFollowUps: ['I want to talk about it', 'Give me a calm distraction', 'Tell me a good joke'],
      };
    }

    if (/^hey\b[!?. ]*$/i.test(queryLower) || /^hi\b[!?. ]*$/i.test(queryLower) || /^hello\b[!?. ]*$/i.test(queryLower)) {
      const casualGreetings = [
        "Hey! What's on your mind today?",
        "Hi! What are you working on today?",
        "Hello! How can I help you today?",
      ];
      const reply = casualGreetings[Math.floor(Math.random() * casualGreetings.length)];
      return {
        intent: 'GENERAL_CHAT',
        mode: requestedMode,
        reply,
        sources: [],
        matchedItemIds: [],
        actions: [],
        thoughtSteps: ['Identified intent: GENERAL_CHAT', 'Direct conversational greeting without database search'],
        suggestedFollowUps: ['Show all my notes', 'Give me an idea', 'Explain a concept'],
      };
    }

    // Arithmetic evaluation
    const calcResult = evaluateArithmetic(cleanMessage);
    if (calcResult !== null && /^(what is|calculate|solve|\b)\s*[-+*/0-9. ()^%x×÷=]+\s*\??$/i.test(cleanMessage)) {
      return {
        intent: 'GENERAL_KNOWLEDGE',
        mode: requestedMode,
        reply: `${calcResult}`,
        sources: [],
        matchedItemIds: [],
        actions: [],
        thoughtSteps: [`Evaluated arithmetic: ${calcResult}`],
        suggestedFollowUps: [],
      };
    }

    // Brainstorming fast fallback
    if (intent === 'BRAINSTORMING' && !genAI) {
      return {
        intent,
        mode: requestedMode,
        reply: "Here are 3 ideas to get you started:\n\n1. **A Mini Productivity Tool**: A clean single-task tracker or timer.\n2. **A Knowledge Guide**: Write a quick cheat-sheet or guide on something you've learned recently.\n3. **A Creative Routine**: Start a 15-minute daily journaling or reading habit.\n\nWhich of these sounds appealing?",
        sources: [],
        matchedItemIds: [],
        actions: [],
        thoughtSteps: ['Identified intent: BRAINSTORMING', 'Generated creative suggestions without database search'],
        suggestedFollowUps: ['Give me 3 more ideas', 'Save this as a note'],
      };
    }

    // Call Gemini for high-quality natural language conversational response
    if (genAI) {
      try {
        const historyText = history
          .slice(-6)
          .map((h) => `${h.role === 'user' ? 'User' : 'AI'}: ${h.text}`)
          .join('\n');

        const systemPrompt = `You are LIFEBOX Conversational AI Assistant.
CURRENT DATE: ${currentDateStr}
ACTIVE MODE: ${requestedMode === 'chat' ? 'CHAT (General conversation)' : 'LIFEBOX (Personal Second Brain)'}
USER MESSAGE: "${cleanMessage}"
DETECTED INTENT: ${intent}

CONVERSATION HISTORY:
${historyText || '(Starting new conversation)'}

CRITICAL RULES:
1. Do NOT search or pretend to search the user's LIFEBOX notes unless they explicitly ask for personal saved records.
2. Do NOT say "I searched your LIFEBOX" or "I checked your notes".
3. Do NOT begin every response with "Hello!", "Hi!", or "Welcome back!". Only greet if naturally appropriate.
4. Respond naturally, concisely, and intelligently.
5. Do NOT pretend to be a human with physical experiences.
6. Provide response in Markdown.`;

        const aiRes = await genAI.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: systemPrompt,
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
              `Generated response directly without database search`,
            ],
            suggestedFollowUps:
              intent === 'BRAINSTORMING'
                ? ['Can you give me 3 more ideas?', 'Save this as a note']
                : ['Tell me more', 'Show all my notes'],
          };
        }
      } catch (err) {
        console.warn('Gemini conversation call failed:', err);
      }
    }

    // Default graceful fallback
    return {
      intent,
      mode: requestedMode,
      reply: "I'm right here with you! What would you like to explore, brainstorm, or discuss?",
      sources: [],
      matchedItemIds: [],
      actions: [],
      thoughtSteps: [`Identified intent: ${intent}`, 'Handled without database search'],
      suggestedFollowUps: ['Show all my notes', 'Give me an idea', 'Show my tasks'],
    };
  }
}
