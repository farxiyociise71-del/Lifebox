import {
  LifeboxItem,
  Collection,
  AgentMode,
  AgentResponse,
  AiMode,
  StoredConversation,
  ScanAnalysis,
  DetectedEvent,
  DetectedTask,
  DetectedReminder,
  ScannedDocument,
} from '../types';

export interface AskStuffResponse {
  answer: string;
  matchedItemIds: string[];
  suggestedQueries?: string[];
}

export interface OcrResponse {
  extractedText: string;
  suggestedTitle: string;
  suggestedCategory: string;
  tags: string[];
  summary: string;
  detectedDates?: string[];
}

export interface SummarizeResponse {
  summary: string;
  keyPoints: string[];
  tags?: string[];
}

export interface QuizResponse {
  flashcards: Array<{ question: string; answer: string }>;
  quizQuestions: Array<{
    q: string;
    options: string[];
    answerIndex: number;
    explanation?: string;
  }>;
}

export const AiService = {
  async askMyStuff(query: string, items: LifeboxItem[]): Promise<AskStuffResponse> {
    try {
      const res = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, items: items.filter((i) => !i.isTrash) }),
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('Backend AI ask unavailable, using local semantic resolver:', err);
      const q = query.toLowerCase();
      const matched = items.filter((it) => {
        const full = `${it.title} ${it.content} ${it.extractedText || ''} ${it.tags.join(' ')}`.toLowerCase();
        return full.includes(q) || q.split(' ').some((w) => w.length > 3 && full.includes(w));
      });

      return {
        answer:
          matched.length > 0
            ? `I found ${matched.length} item(s) related to "${query}" in your LIFEBOX:\n${matched
                .slice(0, 3)
                .map((m) => `• ${m.title}: ${m.summary || m.content.slice(0, 100)}...`)
                .join('\n')}`
            : `I searched your LIFEBOX but couldn't find an item specifically mentioning "${query}". Try searching by word, tag, or category.`,
        matchedItemIds: matched.map((m) => m.id),
        suggestedQueries: ['Show all notes', 'Check exam timetable', 'Upcoming passport expiry'],
      };
    }
  },

  async performOcr(imageBase64: string, mimeType = 'image/jpeg', hint = 'document'): Promise<OcrResponse> {
    try {
      const res = await fetch('/api/ai/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mimeType, hint }),
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('OCR API fallback:', err);
      return {
        extractedText: 'Scanned document captured into LIFEBOX.',
        suggestedTitle: 'Scanned ' + (hint === 'receipt' ? 'Receipt' : 'Document'),
        suggestedCategory: hint === 'receipt' ? 'finance' : 'personal',
        tags: ['scan', hint],
        summary: 'Image stored safely in LIFEBOX.',
      };
    }
  },

  /**
   * Gemini Document Understanding: Analyzes scanned images and OCR text
   * Extracts structured information: dates, events, tasks, reminders, people, locations.
   * Validates JSON and never invents ungrounded information.
   */
  async analyzeScannedDocument(
    images: string[],
    ocrText?: string,
    hint = 'document'
  ): Promise<ScanAnalysis> {
    try {
      const res = await fetch('/api/scans/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: images.slice(0, 5), // Limit payload for token efficiency
          ocrText,
          hint,
        }),
      });

      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();

      // Validate returned structure
      const analysis: ScanAnalysis = {
        documentType: typeof data.documentType === 'string' && data.documentType ? data.documentType : 'document',
        title: typeof data.title === 'string' && data.title ? data.title : 'Scanned Document',
        summary: typeof data.summary === 'string' && data.summary ? data.summary : 'Document scanned and stored in LIFEBOX.',
        dates: Array.isArray(data.dates)
          ? data.dates.map((d: any) => ({
              date: String(d.date || d),
              context: d.context ? String(d.context) : undefined,
              uncertain: Boolean(d.uncertain),
            }))
          : [],
        tasks: Array.isArray(data.tasks)
          ? data.tasks.map((t: any) => ({
              title: String(t.title || ''),
              dueDate: t.dueDate ? String(t.dueDate) : undefined,
              priority: ['low', 'medium', 'high', 'urgent'].includes(t.priority) ? t.priority : 'medium',
              description: t.description ? String(t.description) : undefined,
              uncertain: Boolean(t.uncertain),
            })).filter((t: any) => t.title.trim())
          : [],
        events: Array.isArray(data.events)
          ? data.events.map((e: any) => ({
              title: String(e.title || ''),
              date: e.date ? String(e.date) : undefined,
              time: e.time ? String(e.time) : undefined,
              location: e.location ? String(e.location) : undefined,
              description: e.description ? String(e.description) : undefined,
              uncertain: Boolean(e.uncertain),
            })).filter((e: any) => e.title.trim())
          : [],
        reminders: Array.isArray(data.reminders)
          ? data.reminders.map((r: any) => ({
              title: String(r.title || ''),
              dueDate: r.dueDate ? String(r.dueDate) : undefined,
              dueTime: r.dueTime ? String(r.dueTime) : undefined,
              notes: r.notes ? String(r.notes) : undefined,
              uncertain: Boolean(r.uncertain),
            })).filter((r: any) => r.title.trim())
          : [],
        people: Array.isArray(data.people) ? data.people.map(String).filter(Boolean) : [],
        locations: Array.isArray(data.locations) ? data.locations.map(String).filter(Boolean) : [],
        organizations: Array.isArray(data.organizations) ? data.organizations.map(String).filter(Boolean) : [],
        tags: Array.isArray(data.tags) ? data.tags.map(String).filter(Boolean) : ['scan', hint],
        entities: Array.isArray(data.entities) ? data.entities : [],
      };

      return analysis;
    } catch (err) {
      console.warn('Backend document analysis fallback to local parser:', err);

      // Safe local extraction from actual OCR text without hallucination
      const text = ocrText || '';
      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
      const firstLine = lines[0] || 'Scanned Document';

      // Simple regex for real dates mentioned in the text
      const dateMatches = text.match(/\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?|\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\b)/gi) || [];

      // Extract tasks if "submit", "pay", "due", "complete" are found in lines
      const tasks: DetectedTask[] = [];
      const reminders: DetectedReminder[] = [];
      const events: DetectedEvent[] = [];

      for (const line of lines) {
        if (/^(submit|pay|complete|bring|send|finish|review|read|study|prepare)\b/i.test(line)) {
          tasks.push({
            title: line,
            priority: 'medium',
            uncertain: true,
          });
        }
        if (/^(pay|deadline|before|by|due)\b/i.test(line)) {
          reminders.push({
            title: line,
            uncertain: true,
          });
        }
        if (/\b(exam|meeting|appointment|conference|seminar|session|class|lecture)\b/i.test(line)) {
          events.push({
            title: line,
            uncertain: true,
          });
        }
      }

      return {
        documentType: hint || 'document',
        title: firstLine.length > 50 ? firstLine.slice(0, 50) + '...' : firstLine,
        summary: lines.slice(0, 3).join(' ') || 'Scanned document saved to LIFEBOX.',
        dates: Array.from(new Set(dateMatches)).map((d) => ({ date: d, uncertain: false })),
        tasks: tasks.slice(0, 3),
        events: events.slice(0, 3),
        reminders: reminders.slice(0, 3),
        people: [],
        locations: [],
        organizations: [],
        tags: ['scan', hint].filter(Boolean),
      };
    }
  },

  async processOCR(imageBase64: string, mimeType = 'image/jpeg', hint = 'document'): Promise<OcrResponse> {
    return this.performOcr(imageBase64, mimeType, hint);
  },

  async summarizeContent(title: string, text: string): Promise<SummarizeResponse> {
    try {
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, text }),
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('Summarize fallback:', err);
      const sentences = text.split('. ').filter(Boolean);
      return {
        summary: sentences.slice(0, 2).join('. ') + (sentences.length > 2 ? '.' : ''),
        keyPoints: sentences.slice(0, 4).map((s) => s.trim().replace(/^#+\s*/, '')),
      };
    }
  },

  async summarizeText(title: string, text: string): Promise<SummarizeResponse> {
    return this.summarizeContent(title, text);
  },

  async generateQuiz(title: string, content: string): Promise<QuizResponse> {
    try {
      const res = await fetch('/api/ai/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('Quiz API fallback:', err);
      return {
        flashcards: [
          { question: `What is the core takeaway of "${title}"?`, answer: content.slice(0, 120) },
          { question: `Key points in ${title}?`, answer: content.slice(120, 250) || content.slice(0, 80) },
        ],
        quizQuestions: [
          {
            q: `What is the primary topic of ${title}?`,
            options: [title, 'Unrelated topic', 'Historical archive', 'General knowledge'],
            answerIndex: 0,
            explanation: 'Directly sourced from your saved study material.',
          },
        ],
      };
    }
  },

  async autoOrganize(items: LifeboxItem[]): Promise<{ categories: Array<{ name: string; rationale: string; itemIds: string[] }> }> {
    try {
      const res = await fetch('/api/ai/organize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: items.filter((i) => !i.isTrash) }),
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('Auto-organize fallback:', err);
      // Group logically by category
      const grouped: { [cat: string]: string[] } = {};
      items.forEach((it) => {
        const cat = it.category || 'personal';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(it.id);
      });
      return {
        categories: Object.entries(grouped).map(([cat, ids]) => ({
          name: cat.charAt(0).toUpperCase() + cat.slice(1) + ' Hub',
          rationale: `Grouped based on category "${cat}" and recurring tags`,
          itemIds: ids,
        })),
      };
    }
  },

  async runAgent(
    message: string,
    mode: AgentMode,
    history: Array<{ role: 'user' | 'agent'; text: string }>,
    items: LifeboxItem[],
    collections: Collection[]
  ): Promise<AgentResponse> {
    try {
      const res = await fetch('/api/ai/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          mode,
          history,
          items: items.filter((i) => !i.locked && !i.isTrash),
          collections,
        }),
      });
      if (!res.ok) throw new Error(`Agent server error: ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('Backend agent fallback executing:', err);
      const q = message.toLowerCase().trim();
      const isGreeting = /^(hi|hello|hey|greetings|good\s*(morning|afternoon|evening)|howdy|hola|sup)\b/i.test(q);
      const isCasualChat =
        isGreeting ||
        /^(how are you|who are you|what('s| is) up|tell me a joke|tell me about yourself|thank you|thanks|can we chat|let's chat|feeling|nice to meet you|i appreciate you)/i.test(q) ||
        mode === 'friendly';

      const matched = items.filter((it) => {
        if (it.locked || it.isTrash) return false;
        const full = `${it.title} ${it.content} ${it.extractedText || ''} ${(it.tags || []).join(' ')}`.toLowerCase();
        return full.includes(q) || q.split(' ').some((w) => w.length > 3 && full.includes(w));
      });

      if (isGreeting || (isCasualChat && matched.length === 0)) {
        return {
          thoughtSteps: [
            'Welcomed user with friendly, respectful greeting',
            'Prepared warm, conversational reflection',
            'Standing by for friendly conversation or second-brain tasks',
          ],
          reply: `Hello there! 😊 It is truly wonderful to chat with you today. Thank you so much for reaching out!\n\nI am doing great and always delighted to be here with you. How has your day been going so far?\n\nWhether you'd like to have a friendly conversation, brainstorm creative ideas, plan out your schedule, or explore your notes, I am completely at your service. What would you like to chat about today?`,
          matchedItemIds: [],
          actions: [],
          suggestedFollowUps: [
            'How are you doing today?',
            'Can you help me brainstorm some creative ideas?',
            'Give me a friendly motivational thought',
            'What notes do I have in my second brain?',
          ],
        };
      }

      return {
        thoughtSteps: [
          `Attentively scanned ${items.length} records in local Second Brain`,
          `Detected ${matched.length} related note(s) matching your request`,
          `Synthesized warm, constructive response under mode: ${mode}`,
        ],
        reply: matched.length > 0
          ? `I would be delighted to help with that! I looked through your second brain and found **${matched.length} related item(s)** for "${message}":\n\n${matched
              .slice(0, 3)
              .map((m) => `- **${m.title}** (${m.category}): ${m.summary || m.content.slice(0, 100)}...`)
              .join('\n')}\n\nPlease let me know if you would like me to summarize these in more detail, or chat through any specific questions!`
          : `Thank you for sharing that with me! I searched through your saved items for **"${message}"**. While I didn't spot a matching note yet, I would love to chat through your ideas or help you draft a fresh note anytime you like!`,
        matchedItemIds: matched.map((m) => m.id),
        actions: q.includes('save') || q.includes('note') || q.includes('remind')
          ? [
              {
                id: 'act-' + Date.now(),
                type: mode === 'executive' ? 'create_reminder' : 'create_note',
                label: mode === 'executive' ? 'Schedule Review Reminder' : 'Save Summary Note',
                payload: mode === 'executive'
                  ? {
                      title: `Review: ${message.slice(0, 35)}`,
                      dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
                      priority: 'medium',
                    }
                  : {
                      title: `Note: ${message.slice(0, 35)}`,
                      content: `# ${message}\n\nGenerated by LIFEBOX AI Assistant.\n\n- Key points reviewed\n- Synthesized for quick retrieval`,
                      category: mode === 'study' ? 'study' : 'ideas',
                      tags: ['agent', mode],
                    },
              },
            ]
          : [],
        suggestedFollowUps: [
          'Could you explain this in more detail?',
          'Prepare a daily briefing for today',
          'Help me brainstorm ideas around this topic',
        ],
      };
    }
  },

  /**
   * Dual-Mode Conversational AI Pipeline
   * Mode A: LIFEBOX (Searches and works with personal repository)
   * Mode B: CHAT (Natural conversation, does not search personal data unless explicitly requested)
   */
  async sendConversationMessage(params: {
    message: string;
    mode: AiMode;
    history?: Array<{ role: 'user' | 'assistant' | 'agent'; text: string }>;
    items?: LifeboxItem[];
    conversationId?: string;
  }): Promise<AgentResponse & { conversationId?: string }> {
    const { message, mode, history = [], items = [], conversationId } = params;
    try {
      const res = await fetch('/api/ai/conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          mode,
          history,
          clientItems: items.filter((i) => !i.locked && !i.isTrash),
          conversationId,
        }),
      });
      if (!res.ok) throw new Error(`Conversation server error: ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('Backend conversation API fallback:', err);
      const q = message.toLowerCase().trim();

      // If in Chat mode and not requesting personal info:
      if (mode === 'chat') {
        if (/^i('?m| am)?\s*bored\b/i.test(q)) {
          return {
            intent: 'GENERAL_CHAT',
            mode: 'chat',
            reply: "Let's fix that 😄! Want some ideas for something fun to do? We could brainstorm creative project ideas, explore a fascinating topic, or dive into a quick brain teaser. What sounds good?",
            sources: [],
            matchedItemIds: [],
            actions: [],
            thoughtSteps: ['Addressed boredom empathetically', 'No personal data search'],
            suggestedFollowUps: ['Give me some fun project ideas', 'Tell me a random fascinating fact', 'Give me a brain teaser'],
          };
        }
        if (/^(i had|having)\s*a\s*(bad|rough|tough|terrible)\s*day\b/i.test(q)) {
          return {
            intent: 'GENERAL_CHAT',
            mode: 'chat',
            reply: "I'm really sorry to hear that. Days like that can be draining. Do you want to talk about what happened, or would you rather distract yourself with something interesting or relaxing?",
            sources: [],
            matchedItemIds: [],
            actions: [],
            thoughtSteps: ['Empathetic conversation', 'No personal data search'],
            suggestedFollowUps: ['I want to talk about it', 'Give me a calm distraction', 'Tell me a good joke'],
          };
        }
        if (/^hey\b[!?. ]*$/i.test(q) || /^hi\b[!?. ]*$/i.test(q)) {
          return {
            intent: 'GENERAL_CHAT',
            mode: 'chat',
            reply: "Hey! What's on your mind today?",
            sources: [],
            matchedItemIds: [],
            actions: [],
            thoughtSteps: ['Natural casual response'],
            suggestedFollowUps: ["I'm bored", 'I want to start a project', 'Can we brainstorm?'],
          };
        }

        return {
          intent: 'GENERAL_CHAT',
          mode: 'chat',
          reply: "I'm right here with you! What would you like to explore, brainstorm, or chat about?",
          sources: [],
          matchedItemIds: [],
          actions: [],
          thoughtSteps: ['General conversational turn'],
          suggestedFollowUps: ['Help me brainstorm project ideas', 'Explain an interesting concept'],
        };
      }

      // LIFEBOX Mode search fallback:
      const matched = items.filter((it) => {
        if (it.locked || it.isTrash) return false;
        const full = `${it.title} ${it.content} ${it.extractedText || ''} ${(it.tags || []).join(' ')}`.toLowerCase();
        return full.includes(q) || q.split(' ').some((w) => w.length > 3 && full.includes(w));
      });

      return {
        intent: 'PERSONAL_DATA_SEARCH',
        mode: 'lifebox',
        reply: matched.length > 0
          ? `I found **${matched.length} item(s)** in your LIFEBOX:\n\n${matched
              .slice(0, 3)
              .map((m) => `- **${m.title}**: ${m.summary || m.content.slice(0, 120)}...`)
              .join('\n')}`
          : `I couldn't find anything matching "${message}" in your LIFEBOX.`,
        sources: matched.slice(0, 3).map((m) => ({ id: m.id, title: m.title, type: m.type, category: m.category })),
        matchedItemIds: matched.map((m) => m.id),
        actions: [],
        thoughtSteps: ['Executed local search across active items'],
        suggestedFollowUps: ['Show all notes', 'Save a new note'],
      };
    }
  },

  /**
   * Conversation Sessions CRUD
   */
  async getConversations(): Promise<StoredConversation[]> {
    try {
      const res = await fetch('/api/ai/conversations');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch {
      // Return from localStorage if offline/guest
      try {
        const local = localStorage.getItem('lifebox_conversations');
        return local ? JSON.parse(local) : [];
      } catch {
        return [];
      }
    }
  },

  async createConversation(title = 'New Conversation', mode: AiMode = 'chat'): Promise<StoredConversation> {
    try {
      const res = await fetch('/api/ai/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, mode }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch {
      const newConv: StoredConversation = {
        id: 'conv-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        title,
        mode,
        turns: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      try {
        const local = localStorage.getItem('lifebox_conversations');
        const list = local ? JSON.parse(local) : [];
        list.unshift(newConv);
        localStorage.setItem('lifebox_conversations', JSON.stringify(list));
      } catch {}
      return newConv;
    }
  },

  async updateConversation(id: string, updates: Partial<StoredConversation>): Promise<StoredConversation | null> {
    try {
      const res = await fetch(`/api/ai/conversations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch {
      try {
        const local = localStorage.getItem('lifebox_conversations');
        if (local) {
          const list: StoredConversation[] = JSON.parse(local);
          const idx = list.findIndex((c) => c.id === id);
          if (idx !== -1) {
            list[idx] = { ...list[idx], ...updates, updatedAt: new Date().toISOString() };
            localStorage.setItem('lifebox_conversations', JSON.stringify(list));
            return list[idx];
          }
        }
      } catch {}
      return null;
    }
  },

  async deleteConversation(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/ai/conversations/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return true;
    } catch {
      try {
        const local = localStorage.getItem('lifebox_conversations');
        if (local) {
          const list: StoredConversation[] = JSON.parse(local);
          const filtered = list.filter((c) => c.id !== id);
          localStorage.setItem('lifebox_conversations', JSON.stringify(filtered));
          return true;
        }
      } catch {}
      return false;
    }
  },
};
