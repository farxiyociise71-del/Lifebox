import { LifeboxItem } from '../types';

export type VoiceCommandIntent =
  | 'create_note'
  | 'show_today_tasks'
  | 'search_documents'
  | 'scan_document'
  | 'create_task'
  | 'show_reminders'
  | 'search_notes'
  | 'list_notes'
  | 'navigate'
  | 'unknown';

export interface ParsedVoiceCommand {
  intent: VoiceCommandIntent;
  confidence: number;
  originalPhrase: string;
  matchedKeywords: string[];
  extractedQuery?: string;
  extractedTitle?: string;
  extractedContent?: string;
  targetTab?: string;
}

export interface VoiceCommandExecutionResult {
  intent: VoiceCommandIntent;
  success: boolean;
  feedbackText: string;
  spokenFeedback: string;
  createdItem?: LifeboxItem;
  matchedItems?: LifeboxItem[];
  navigateToTab?: string;
  actionType?: 'item_created' | 'tasks_displayed' | 'documents_found' | 'navigated';
}

/**
 * Parses spoken text captured via Web Speech API into a structured actionable intent.
 */
export function parseVoiceCommand(text: string): ParsedVoiceCommand {
  const clean = text.trim().toLowerCase();
  const rawWords = clean.replace(/[.,?!]/g, '').split(/\s+/);

  // 1. Create note / Take a note
  const createNotePatterns = [
    /^(?:please\s+)?(?:create|make|write|take|add)\s+(?:a\s+)?(?:new\s+)?note(?:\s+(?:called|titled|named|about|for)?\s*(.*))?$/i,
    /^new note(?:\s+(?:called|titled|named|about|for)?\s*(.*))?$/i,
    /^(?:quick\s+)?note(?:\s+to\s+self)?(?:\s*:\s*|\s+)(.*)$/i,
  ];

  for (const pattern of createNotePatterns) {
    const match = clean.match(pattern);
    if (match) {
      const rest = match[1]?.trim() || '';
      let title = 'Voice Note';
      let content = rest;

      if (rest) {
        // If it starts with "called" or "titled"
        const titleMatch = rest.match(/^(?:called|titled|named)\s+["']?([^"']+)["']?(?:\s+(?:with|that|saying)\s+(.*))?$/i);
        if (titleMatch) {
          title = titleMatch[1].trim();
          content = titleMatch[2]?.trim() || title;
        } else {
          // Capitalize first letter of phrase as title
          title = rest.charAt(0).toUpperCase() + rest.slice(1);
          content = rest;
        }
      }

      return {
        intent: 'create_note',
        confidence: 0.95,
        originalPhrase: text,
        matchedKeywords: ['create', 'note'],
        extractedTitle: title,
        extractedContent: content,
      };
    }
  }

  // 2. Show today's tasks
  const todayTasksPatterns = [
    /^(?:please\s+)?(?:show|view|display|check|what\s+are|list|give\s+me)\s+(?:my\s+)?today(?:'?s)?\s+tasks?$/i,
    /^(?:please\s+)?(?:show|view|display|check|list|give\s+me)\s+(?:all\s+)?(?:my\s+)?tasks?\s+(?:for\s+)?today$/i,
    /^today(?:'?s)?\s+tasks?$/i,
    /^what\s+do\s+i\s+(?:have|need)\s+to\s+do\s+today$/i,
    /^(?:show|list)\s+(?:my\s+)?tasks?$/i,
  ];

  for (const pattern of todayTasksPatterns) {
    if (pattern.test(clean)) {
      return {
        intent: 'show_today_tasks',
        confidence: 0.95,
        originalPhrase: text,
        matchedKeywords: ['today', 'tasks'],
      };
    }
  }

  // 3. Search my documents
  const searchDocsPatterns = [
    /^(?:please\s+)?(?:search|find|lookup|show|check)\s+(?:in\s+)?(?:all\s+)?(?:my\s+)?(?:documents|docs|files)(?:\s+(?:for|about|matching)?\s*(.*))?$/i,
    /^(?:search|find)\s+documents?$/i,
  ];

  for (const pattern of searchDocsPatterns) {
    const match = clean.match(pattern);
    if (match) {
      const query = match[1]?.trim() || '';
      return {
        intent: 'search_documents',
        confidence: 0.95,
        originalPhrase: text,
        matchedKeywords: ['search', 'documents'],
        extractedQuery: query,
      };
    }
  }

  // 4. Create task
  const createTaskPatterns = [
    /^(?:please\s+)?(?:create|add|make)\s+(?:a\s+)?(?:new\s+)?task(?:\s+(?:to|for|called)?\s*(.*))?$/i,
    /^todo(?:\s*:\s*|\s+)(.*)$/i,
  ];

  for (const pattern of createTaskPatterns) {
    const match = clean.match(pattern);
    if (match) {
      const title = match[1]?.trim() || 'New Voice Task';
      return {
        intent: 'create_task',
        confidence: 0.9,
        originalPhrase: text,
        matchedKeywords: ['create', 'task'],
        extractedTitle: title.charAt(0).toUpperCase() + title.slice(1),
      };
    }
  }

  // 5. Show reminders
  if (/(?:show|view|check|list)\s+(?:my\s+)?reminders?/i.test(clean)) {
    return {
      intent: 'show_reminders',
      confidence: 0.9,
      originalPhrase: text,
      matchedKeywords: ['show', 'reminders'],
    };
  }

  // 6. Search notes
  const searchNotesMatch = clean.match(/^(?:search|find)\s+(?:my\s+)?notes?(?:\s+(?:for|about)?\s*(.*))?$/i);
  if (searchNotesMatch) {
    return {
      intent: 'search_notes',
      confidence: 0.9,
      originalPhrase: text,
      matchedKeywords: ['search', 'notes'],
      extractedQuery: searchNotesMatch[1]?.trim() || '',
    };
  }

  // 7. Show all my notes
  if (/(?:show|list|view|all)\s+(?:all\s+)?(?:my\s+)?notes/i.test(clean)) {
    return {
      intent: 'list_notes',
      confidence: 0.9,
      originalPhrase: text,
      matchedKeywords: ['list', 'notes'],
    };
  }

  // 8. Navigation
  const navMatch = clean.match(/^(?:go\s+to|open|navigate\s+to)\s+(notes|documents|photos|tasks|voice|calendar|plans|chat|settings|trash|scanner)$/i);
  if (navMatch) {
    return {
      intent: 'navigate',
      confidence: 0.85,
      originalPhrase: text,
      matchedKeywords: ['go to', navMatch[1]],
      targetTab: navMatch[1].toLowerCase(),
    };
  }

  // 9. Scan a document
  const isScanCmd =
    /^(?:please\s+)?(?:scan|capture)\s+(?:a\s+)?(?:new\s+)?(?:document|receipt|file|paper|page)?$/i.test(clean) ||
    /^(?:open|start|launch)\s+(?:the\s+)?(?:document\s+)?(?:scanner|camera)$/i.test(clean) ||
    clean === 'scan document' ||
    clean === 'scanner';

  if (isScanCmd) {
    return {
      intent: 'scan_document',
      confidence: 0.95,
      originalPhrase: text,
      matchedKeywords: ['scan', 'document'],
      targetTab: 'scanner',
    };
  }

  return {
    intent: 'unknown',
    confidence: 0.3,
    originalPhrase: text,
    matchedKeywords: [],
  };
}

/**
 * Executes a parsed voice command against application items and handlers.
 */
export function executeVoiceCommand(
  cmd: ParsedVoiceCommand,
  items: LifeboxItem[],
  callbacks: {
    onSaveItem: (item: LifeboxItem) => void;
    onSelectItem?: (item: LifeboxItem) => void;
    onNavigateTab?: (tab: string) => void;
  }
): VoiceCommandExecutionResult {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  switch (cmd.intent) {
    case 'create_note': {
      const title = cmd.extractedTitle || 'New Spoken Note';
      const content = cmd.extractedContent || 'Created via voice command.';

      const newNote: LifeboxItem = {
        id: 'note-voice-' + Date.now(),
        title,
        type: 'note',
        category: 'ideas',
        collectionIds: [],
        content,
        tags: ['voice-command', 'notes'],
        pinned: false,
        favorite: false,
        locked: false,
        isTrash: false,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      callbacks.onSaveItem(newNote);

      return {
        intent: 'create_note',
        success: true,
        feedbackText: `Created note: "${title}"`,
        spokenFeedback: `Created a new note titled ${title}.`,
        createdItem: newNote,
        actionType: 'item_created',
      };
    }

    case 'show_today_tasks': {
      const activeTasks = items.filter((it) => {
        if (it.isTrash) return false;
        if (it.type !== 'task') return false;

        const due = it.dueDate || it.reminder?.dueDate;
        // Either due today, or active and not completed
        const isToday = due === todayStr;
        const isOverdue = due && due < todayStr;
        const isPending = !it.taskStatus || it.taskStatus === 'pending' || it.taskStatus === 'in_progress';

        return isPending && (isToday || isOverdue || !due);
      });

      const count = activeTasks.length;
      let spoken = '';
      if (count === 0) {
        spoken = 'You have no pending tasks for today. Great job!';
      } else if (count === 1) {
        spoken = `You have 1 task for today: ${activeTasks[0].title}.`;
      } else {
        const top3 = activeTasks.slice(0, 3).map((t) => t.title).join(', ');
        spoken = `You have ${count} tasks today. Here are the first few: ${top3}.`;
      }

      return {
        intent: 'show_today_tasks',
        success: true,
        feedbackText: count === 0 ? 'No pending tasks found for today' : `Found ${count} tasks for today`,
        spokenFeedback: spoken,
        matchedItems: activeTasks,
        actionType: 'tasks_displayed',
      };
    }

    case 'search_documents': {
      const q = (cmd.extractedQuery || '').toLowerCase();
      const docs = items.filter((it) => {
        if (it.isTrash) return false;
        if (it.type !== 'document') return false;
        if (!q) return true; // all documents
        const inTitle = it.title.toLowerCase().includes(q);
        const inContent = (it.content || '').toLowerCase().includes(q);
        const inExtracted = (it.extractedText || '').toLowerCase().includes(q);
        const inTags = (it.tags || []).some((t) => t.toLowerCase().includes(q));
        return inTitle || inContent || inExtracted || inTags;
      });

      const count = docs.length;
      let spoken = '';
      if (count === 0) {
        spoken = q ? `No documents found matching ${q}.` : 'You have no documents stored yet.';
      } else if (count === 1) {
        spoken = `Found 1 document: ${docs[0].title}.`;
      } else {
        spoken = q
          ? `Found ${count} documents matching ${q}.`
          : `You have ${count} documents in your LIFEBOX.`;
      }

      return {
        intent: 'search_documents',
        success: true,
        feedbackText: q ? `Found ${count} documents for "${q}"` : `Found ${count} documents in repository`,
        spokenFeedback: spoken,
        matchedItems: docs,
        actionType: 'documents_found',
      };
    }

    case 'create_task': {
      const title = cmd.extractedTitle || 'Spoken Task';
      const newTask: LifeboxItem = {
        id: 'task-voice-' + Date.now(),
        title,
        type: 'task',
        category: 'personal',
        collectionIds: [],
        content: title,
        taskStatus: 'pending',
        tags: ['voice-command', 'todo'],
        pinned: false,
        favorite: false,
        locked: false,
        isTrash: false,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      callbacks.onSaveItem(newTask);

      return {
        intent: 'create_task',
        success: true,
        feedbackText: `Created task: "${title}"`,
        spokenFeedback: `Created task: ${title}.`,
        createdItem: newTask,
        actionType: 'item_created',
      };
    }

    case 'search_notes':
    case 'list_notes': {
      const q = (cmd.extractedQuery || '').toLowerCase();
      const notes = items.filter((it) => {
        if (it.isTrash || it.type !== 'note') return false;
        if (!q) return true;
        return (
          it.title.toLowerCase().includes(q) ||
          (it.content || '').toLowerCase().includes(q) ||
          (it.tags || []).some((t) => t.toLowerCase().includes(q))
        );
      });

      return {
        intent: cmd.intent,
        success: true,
        feedbackText: q ? `Found ${notes.length} notes for "${q}"` : `Found ${notes.length} notes`,
        spokenFeedback: `Found ${notes.length} notes.`,
        matchedItems: notes,
        actionType: 'documents_found',
      };
    }

    case 'scan_document': {
      if (callbacks.onNavigateTab) {
        callbacks.onNavigateTab('scanner');
        return {
          intent: 'scan_document',
          success: true,
          feedbackText: 'Opening LIFEBOX intelligent document scanner...',
          spokenFeedback: 'Opening the document scanner.',
          navigateToTab: 'scanner',
          actionType: 'navigated',
        };
      }
      break;
    }

    case 'navigate': {
      if (cmd.targetTab && callbacks.onNavigateTab) {
        callbacks.onNavigateTab(cmd.targetTab);
        return {
          intent: 'navigate',
          success: true,
          feedbackText: `Opened ${cmd.targetTab}`,
          spokenFeedback: `Navigating to ${cmd.targetTab}.`,
          navigateToTab: cmd.targetTab,
          actionType: 'navigated',
        };
      }
      break;
    }

    default:
      break;
  }

  return {
    intent: 'unknown',
    success: false,
    feedbackText: `I didn't recognize that command. Try: "create a new note", "show today's tasks", or "search my documents".`,
    spokenFeedback: `I didn't catch that. You can say create a new note, show today's tasks, or search my documents.`,
  };
}
