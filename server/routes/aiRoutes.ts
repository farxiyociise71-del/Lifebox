import { Router, Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { optionalAuth, requireAuth } from '../security/authMiddleware';
import { scrubPII, sanitizeString, validateUploadedFile } from '../security/sanitizer';
import { createRateLimiter } from '../security/rateLimit';
import { dataStore } from '../data/store';
import { ConversationEngine } from '../ai/conversationEngine';

export const aiRouter = Router();

// Strict rate limiter on AI generation endpoints to prevent abuse
const aiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 30,
  message: 'AI request limit reached. Please wait a moment before sending more queries.',
});

aiRouter.use(aiRateLimiter);

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
 * Multimodal OCR & Image Scanner with File Validation and PII Scrubbing
 */
aiRouter.post('/ocr', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', hint = 'document or photo' } = req.body;
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'imageBase64 image data is required' });
    }

    const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    // Security validation of file payload
    const fileValidation = validateUploadedFile(buffer, mimeType, 'scan.jpg', 15 * 1024 * 1024);
    if (!fileValidation.valid) {
      return res.status(400).json({ error: fileValidation.error || 'Invalid file payload' });
    }

    const ai = getGenAI();
    if (!ai) {
      return res.json({
        extractedText: 'AI API key not configured. Scanned image saved securely in local vault.',
        suggestedTitle: 'Scanned Item',
        suggestedCategory: 'personal',
        tags: ['scan', 'photo'],
        summary: 'Saved scanned media securely.',
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
    let parsedData: any = {};
    try {
      parsedData = JSON.parse(responseText);
    } catch {
      parsedData = { extractedText: responseText, suggestedTitle: 'Scanned Document', tags: ['scan'] };
    }

    // Apply PII scrubbing to the AI output to prevent accidental exposure of raw credit cards/SSNs
    if (parsedData.extractedText) {
      const { scrubbed } = scrubPII(parsedData.extractedText);
      parsedData.extractedText = scrubbed;
    }

    return res.json(parsedData);
  } catch (err: any) {
    return res.status(500).json({
      error: 'Failed to process document with AI',
      extractedText: '',
      suggestedTitle: 'Scanned Item',
      tags: ['scan'],
    });
  }
});

/**
 * "Ask My Stuff" semantic Q&A with Data Minimization & PII Scrubbing
 * Excludes locked/vault items from external AI prompts!
 */
aiRouter.post('/ask', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { query, items = [] } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Scrub personal identifiers from the query
    const { scrubbed: cleanQuery } = scrubPII(sanitizeString(query, 500));

    // Data minimization: filter out locked/vault/trash items to protect sensitive user credentials
    const safeItems = (items as any[])
      .filter((it) => !it.locked && !it.isTrash)
      .slice(0, 30);

    const ai = getGenAI();
    if (!ai) {
      const qLower = cleanQuery.toLowerCase();
      const matched = safeItems.filter((it: any) => {
        const text = `${it.title} ${it.content || ''} ${it.extractedText || ''} ${(it.tags || []).join(' ')}`.toLowerCase();
        return text.includes(qLower) || qLower.split(' ').some((w) => w.length > 3 && text.includes(w));
      });

      return res.json({
        answer: matched.length > 0
          ? `I found ${matched.length} matching item(s) in your LIFEBOX: ${matched.map((m: any) => `"${m.title}"`).join(', ')}.`
          : `I searched your non-sensitive saved items, but found no direct match for "${cleanQuery}".`,
        matchedItemIds: matched.map((m: any) => m.id),
        suggestedQueries: ['Show recent notes', 'Find upcoming deadlines'],
      });
    }

    // Build context with scrubbed PII
    const itemsContext = safeItems
      .map((it, idx) => {
        const scrubbedContent = scrubPII(it.content || '').scrubbed.slice(0, 400);
        const scrubbedExtracted = scrubPII(it.extractedText || '').scrubbed.slice(0, 400);
        return `[Item ${idx + 1}] ID: ${it.id} | Title: "${sanitizeString(it.title, 80)}" | Type: ${it.type} | Category: ${it.category || 'general'}
Tags: ${(it.tags || []).map((t: any) => sanitizeString(String(t), 30)).join(', ')}
Content: ${scrubbedContent}
OCR Text: ${scrubbedExtracted}`;
      })
      .join('\n\n');

    const prompt = `You are LIFEBOX, a warm, friendly, polite, and deeply respectful personal AI second brain assistant.
User query: "${cleanQuery}"

Index of safe saved items:
---
${itemsContext || 'No accessible items.'}
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
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('AI request timeout')), 8000)
    );

    let parsed: any;
    try {
      const response: any = await Promise.race([callPromise, timeoutPromise]);
      parsed = JSON.parse(response.text || '{}');
    } catch {
      const qLower = cleanQuery.toLowerCase();
      const matched = safeItems.filter((it: any) => {
        const text = `${it.title} ${it.content || ''} ${it.extractedText || ''} ${(it.tags || []).join(' ')}`.toLowerCase();
        return text.includes(qLower) || qLower.split(' ').some((w) => w.length > 3 && text.includes(w));
      });
      parsed = {
        answer: matched.length > 0
          ? `I found ${matched.length} matching item(s) in your LIFEBOX: ${matched.map((m: any) => `"${m.title}"`).join(', ')}.`
          : `I searched your non-sensitive saved items, but found no direct match for "${cleanQuery}".`,
        matchedItemIds: matched.map((m: any) => m.id),
        suggestedQueries: ['Show recent notes', 'Find upcoming deadlines'],
      };
    }

    return res.json(parsed);
  } catch (err: any) {
    return res.status(500).json({
      answer: 'Unable to query your second brain at this moment. Please try again.',
      matchedItemIds: [],
    });
  }
});

/**
 * Summarization with PII Scrubbing
 */
aiRouter.post('/summarize', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { title, text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required' });
    }

    const { scrubbed: safeText } = scrubPII(sanitizeString(text, 15000));
    const safeTitle = sanitizeString(title || 'Note', 100);

    const ai = getGenAI();
    if (!ai) {
      return res.json({
        summary: safeText.slice(0, 150) + '...',
        keyPoints: ['AI API key not configured for deep summary.'],
      });
    }

    const prompt = `Provide a concise 2-sentence summary and 3-5 high-impact bullet takeaways for this content titled "${safeTitle}":\n\n${safeText}`;
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT' as any,
          properties: {
            summary: { type: 'STRING' as any },
            keyPoints: { type: 'ARRAY' as any, items: { type: 'STRING' as any } },
            tags: { type: 'ARRAY' as any, items: { type: 'STRING' as any } },
          },
          required: ['summary', 'keyPoints'],
        },
      },
    });

    return res.json(JSON.parse(response.text || '{}'));
  } catch (err: any) {
    return res.status(500).json({ error: 'Summarization error' });
  }
});

/**
 * Student Mode Quiz & Flashcard Generator with PII Sanitization
 */
aiRouter.post('/quiz', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { title, content } = req.body;
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Content is required' });
    }

    const { scrubbed: safeContent } = scrubPII(sanitizeString(content, 10000));
    const safeTitle = sanitizeString(title || 'Study Material', 100);

    const ai = getGenAI();
    if (!ai) {
      return res.json({
        flashcards: [
          { question: `What is the core subject of "${safeTitle}"?`, answer: safeContent.slice(0, 100) },
        ],
        quizQuestions: [
          {
            q: `What is the primary topic of ${safeTitle}?`,
            options: ['Core concept in text', 'General notes', 'Other', 'None of the above'],
            answerIndex: 0,
            explanation: 'Derived from your saved note.',
          },
        ],
      });
    }

    const prompt = `Educational tutor for LIFEBOX Student Mode.
Based on study material titled "${safeTitle}":
"""
${safeContent.slice(0, 3000)}
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
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    return res.json(JSON.parse(response.text || '{}'));
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to generate quiz from study material' });
  }
});

/**
 * Smart Auto-Organize with PII Filtering
 */
aiRouter.post('/organize', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { items = [] } = req.body;
    const safeItems = (items as any[])
      .filter((i) => !i.locked && !i.isTrash)
      .slice(0, 40);

    const ai = getGenAI();
    if (!ai || safeItems.length === 0) {
      const grouped: { [cat: string]: string[] } = {};
      safeItems.forEach((it: any) => {
        const cat = it.category || 'personal';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(it.id);
      });
      return res.json({
        categories: Object.entries(grouped).map(([cat, ids]) => ({
          name: cat.charAt(0).toUpperCase() + cat.slice(1) + ' Hub',
          rationale: `Grouped based on category "${cat}"`,
          itemIds: ids,
        })),
      });
    }

    const itemsSummary = safeItems
      .map((it: any) => `ID: ${it.id} | "${sanitizeString(it.title, 60)}" | Category: ${it.category} | Tags: ${(it.tags || []).join(', ')}`)
      .join('\n');

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
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    return res.json(JSON.parse(response.text || '{}'));
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to organize items' });
  }
});

/**
 * Autonomous AI Agent with Tool & Action Planning
 * Supports: General, Study Coach, Organizer, and Executive Secretary modes.
 * Enforces PII scrubbing and strict vault exclusion.
 */
aiRouter.post('/agent', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { message, mode = 'general', history = [], items = [], collections = [] } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    const { scrubbed: cleanMessage } = scrubPII(sanitizeString(message, 1500));
    const cleanMode = ['friendly', 'general', 'study', 'organizer', 'executive'].includes(mode) ? mode : 'friendly';

    // Strictly filter out locked/vault and trash items for user privacy
    const safeItems = (items as any[])
      .filter((i) => !i.locked && !i.isTrash)
      .slice(0, 35)
      .map((it: any) => ({
        id: it.id,
        title: sanitizeString(it.title || 'Untitled', 80),
        type: it.type || 'note',
        category: it.category || 'personal',
        tags: Array.isArray(it.tags) ? it.tags.slice(0, 8) : [],
        reminder: it.reminder ? { dueDate: it.reminder.dueDate, completed: it.reminder.completed } : undefined,
        summary: it.summary ? sanitizeString(it.summary, 120) : undefined,
        contentSnippet: sanitizeString(it.content || it.extractedText || '', 250),
      }));

    const safeCollections = (collections as any[]).slice(0, 15).map((c: any) => ({
      id: c.id,
      name: sanitizeString(c.name || '', 50),
      description: sanitizeString(c.description || '', 100),
    }));

    const ai = getGenAI();

    // Mode-specific mission directives (all keeping a warm, respectful, conversational persona)
    const modeDirectives: Record<string, string> = {
      friendly: 'You are the LIFEBOX Friendly AI Companion. Your personality is exceptionally warm, kind, respectful, uplifting, and conversational. You love having real chats, greeting the user warmly, checking in on how they are doing, listening empathetically, sharing friendly thoughts, discussing ideas or daily life, and assisting with anything on their mind. Always be courteous, polite, and respectful. Chat naturally and only propose actions if requested or clearly beneficial.',
      general: 'You are the LIFEBOX Second Brain Copilot. Your tone is warm, friendly, polite, respectful, and sharp. You help the user recall, synthesize, discuss, and structure knowledge across their personal repository. You reason through available documents, explain concepts clearly, and formulate follow-up actions when beneficial.',
      study: 'You are the LIFEBOX Socratic Study Coach & Friendly Tutor. You are exceptionally patient, warm, encouraging, supportive, and respectful. You celebrate the user\'s curiosity, explain challenging concepts simply and clearly, quiz them gently, and help them build confident study habits.',
      organizer: 'You are the LIFEBOX Curator & Filing Companion. You are thoughtful, courteous, meticulous, polite, and encouraging. You help the user audit their repository, suggest elegant thematic collections, and keep their second brain organized.',
      executive: 'You are the LIFEBOX Executive Secretary & Trusted Chief of Staff. You are exceptionally polite, respectful, organized, and proactive. You audit commitments, synthesize daily briefings, and help the user stay ahead of their schedule with ease and calm confidence.',
    };

    const queryLower = cleanMessage.toLowerCase().trim();
    const isGreeting = /^(hi|hello|hey|greetings|good\s*(morning|afternoon|evening)|howdy|hola|sup)\b/i.test(queryLower);
    const isCasualChat =
      isGreeting ||
      /^(how are you|who are you|what('s| is) up|tell me a joke|tell me about yourself|thank you|thanks|can we chat|let's chat|feeling|nice to meet you|i appreciate you)/i.test(queryLower) ||
      cleanMode === 'friendly';

    if (!ai) {
      // Intelligent, friendly fallback when offline / no API key
      const matched = safeItems.filter((i) => {
        const text = `${i.title} ${i.tags.join(' ')} ${i.contentSnippet}`.toLowerCase();
        return text.includes(queryLower) || queryLower.split(' ').some((w) => w.length > 3 && text.includes(w));
      });

      if (isGreeting || (isCasualChat && matched.length === 0)) {
        return res.json({
          reply: `Hello there! 😊 It is truly wonderful to chat with you today. Thank you so much for reaching out!\n\nI am doing very well and always delighted to be here with you. How has your day been going so far? \n\nWhether you would like to have a friendly conversation, brainstorm creative ideas, review your notes, or plan out your schedule, I am all ears and completely at your service. What is on your mind today?`,
          thoughtSteps: [
            'Received warm greeting and conversational message from user',
            'Adopted friendly, respectful, and supportive tone',
            'Ready to chat naturally or assist with Second Brain vault',
          ],
          actions: [],
          matchedItemIds: [],
          suggestedFollowUps: [
            'How are you doing today?',
            'Can you help me organize my thoughts?',
            'Tell me something inspiring for my day',
            'What notes do I have saved?',
          ],
        });
      }

      const actions: any[] = [];
      if (cleanMode === 'executive' || queryLower.includes('remind') || queryLower.includes('deadline')) {
        actions.push({
          id: 'act-' + Date.now(),
          type: 'create_reminder',
          label: 'Schedule follow-up reminder',
          payload: {
            title: `Review: ${cleanMessage.slice(0, 40)}`,
            dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
            priority: 'medium',
          },
        });
      } else if (cleanMode === 'study' || queryLower.includes('flashcard') || queryLower.includes('study')) {
        actions.push({
          id: 'act-' + Date.now(),
          type: 'create_note',
          label: 'Create Study Summary Note',
          payload: {
            title: `Study Guide: ${cleanMessage.slice(0, 30)}`,
            content: `# Study Summary\n\n- Key Concepts derived from second brain\n- Active recall questions included\n- Review scheduled`,
            category: 'study',
            tags: ['study', 'agent-generated', 'review'],
          },
        });
      } else if (!isCasualChat) {
        actions.push({
          id: 'act-' + Date.now(),
          type: 'create_note',
          label: 'Save Synthesis to Note',
          payload: {
            title: `Insight: ${cleanMessage.slice(0, 35)}`,
            content: `# Note: ${cleanMessage}\n\nGenerated by LIFEBOX AI Assistant.\n\n- Key insights synthesized with care\n- Everything remains securely stored`,
            category: 'ideas',
            tags: ['agent', 'insight'],
          },
        });
      }

      return res.json({
        reply: matched.length > 0
          ? `I would be delighted to help with that! I looked through your notes and found **${matched.length} related item(s)**:\n\n${matched.map((m) => `- **"${m.title}"** (${m.category})`).join('\n')}\n\nPlease let me know if you would like me to summarize these in detail, or if you want to chat more about any specific concept!`
          : `Thank you for sharing that with me! I reviewed your second brain for "${cleanMessage}". While there isn't an exact match in your saved notes yet, I am very happy to discuss this with you, brainstorm ideas, or save any thoughts you'd like to capture.\n\nHow would you like to proceed?`,
        thoughtSteps: [
          `Audited ${safeItems.length} active second-brain items under mode "${cleanMode}" with respectful attention`,
          `Detected ${matched.length} conceptually relevant record(s)`,
          `Prepared friendly, helpful conversational response`,
        ],
        actions,
        matchedItemIds: matched.map((m) => m.id),
        suggestedFollowUps: [
          'Could you explain this in more detail?',
          'Prepare a friendly daily briefing for today',
          'Help me brainstorm ideas around this topic',
        ],
      });
    }

    const systemPrompt = `CORE IDENTITY & TONE:
You are LIFEBOX's friendly, warm, courteous, and deeply respectful AI companion and Second Brain assistant.
You excel at natural, thoughtful, engaging, and supportive conversation.
You can chat freely about ANY topic — daily life, personal goals, philosophy, creative brainstorming, asking how the user is doing, or providing encouragement and advice.
Always treat the user with warmth, politeness, dignity, and sincere respect.
When the user greets you or asks how you are, respond warmly and politely, like a genuine friend and trusted assistant.
If the user wants to chat, converse with them naturally, empathetically, and engagingly. Do NOT force unwanted actions or note creations when the user is simply chatting or having a casual conversation.

SESSION MODE DIRECTIVE:
${modeDirectives[cleanMode] || modeDirectives.friendly}

CURRENT DATE: ${new Date().toISOString().split('T')[0]}

AVAILABLE ITEMS IN USER'S SECOND BRAIN (NON-SENSITIVE):
${JSON.stringify(safeItems, null, 2)}

EXISTING COLLECTIONS:
${JSON.stringify(safeCollections, null, 2)}

RECENT CHAT CONTEXT:
${history.slice(-6).map((h: any) => `${h.role}: ${h.text}`).join('\n')}

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

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('AI Agent timeout')), 9500)
    );

    const callPromise = ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: systemPrompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    let parsedResult: any;
    try {
      const response: any = await Promise.race([callPromise, timeoutPromise]);
      parsedResult = JSON.parse(response.text || '{}');
    } catch {
      // Resilient fallback with warm, friendly conversational generation
      const matched = safeItems.filter((i) => {
        const text = `${i.title} ${i.tags.join(' ')} ${i.contentSnippet}`.toLowerCase();
        return text.includes(queryLower) || queryLower.split(' ').some((w) => w.length > 3 && text.includes(w));
      });

      if (isGreeting || isCasualChat) {
        parsedResult = {
          thoughtSteps: [
            'Welcomed user with friendly, respectful greeting',
            'Considered conversational context and personal rapport',
            'Prepared warm, supportive conversational reply',
          ],
          reply: `Hello! 😊 It is a true pleasure to chat with you today. Thank you so much for reaching out!\n\nI am doing great, and I am always happy to be right here by your side. How is your day going? \n\nWhether you would like to talk about your ideas, chat about your goals, study a topic together, or organize your LIFEBOX notes, I am here for you with pleasure. What would you like to explore today?`,
          matchedItemIds: [],
          actions: [],
          suggestedFollowUps: [
            'How are you doing today?',
            'Help me brainstorm some new ideas',
            'Can you give me a friendly motivational thought?',
            'What notes do I have in my second brain?',
          ],
        };
      } else {
        parsedResult = {
          thoughtSteps: [
            `Reviewed user inquiry with friendly, attentive care`,
            `Scanned ${safeItems.length} active second-brain documents`,
            `Synthesized respectful, constructive feedback`,
          ],
          reply: `Thank you for sharing that with me! I'm happy to assist you with **"${cleanMessage}"**.\n\n${
            matched.length > 0
              ? `I found **${matched.length}** related item(s) in your notes:\n${matched.map((m) => `- **${m.title}** (${m.category}): ${m.summary || m.contentSnippet.slice(0, 90)}...`).join('\n')}\n\nWould you like me to summarize these in more detail, or chat through any questions you have?`
              : `I searched your second-brain records, and while I didn't spot an existing note on this, I'd love to chat through your ideas or help you draft a fresh note anytime you like!`
          }`,
          matchedItemIds: matched.map((m) => m.id),
          actions: queryLower.includes('save') || queryLower.includes('note') || queryLower.includes('remind')
            ? [
                {
                  id: 'act-' + Date.now(),
                  type: cleanMode === 'executive' ? 'create_reminder' : 'create_note',
                  label: cleanMode === 'executive' ? `Schedule: ${cleanMessage.slice(0, 35)}` : `Create Note: ${cleanMessage.slice(0, 35)}`,
                  payload: cleanMode === 'executive'
                    ? {
                        title: `Action: ${cleanMessage.slice(0, 40)}`,
                        dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
                        priority: 'medium',
                      }
                    : {
                        title: `Note: ${cleanMessage.slice(0, 35)}`,
                        content: `# ${cleanMessage}\n\nCaptured with LIFEBOX AI Assistant.\n\n- Key thoughts explored\n- Ready for follow-up`,
                        category: cleanMode === 'study' ? 'study' : 'ideas',
                        tags: ['chat', cleanMode],
                      },
                },
              ]
            : [],
          suggestedFollowUps: [
            'Tell me more about this',
            'Summarize today\'s action items',
            'Suggest ideas for my next project',
          ],
        };
      }
    }

    return res.json(parsedResult);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to run AI Agent' });
  }
});

/**
 * Conversational AI Sessions & History Endpoints
 * Supports: create, list, retrieve, rename, delete, and search conversations
 */
aiRouter.get('/conversations', optionalAuth, (req: Request, res: Response) => {
  const userId = req.user?.id || 'guest_user';
  const list = dataStore.getUserConversations(userId);
  return res.json(list);
});

aiRouter.post('/conversations', optionalAuth, (req: Request, res: Response) => {
  const userId = req.user?.id || 'guest_user';
  const { title = 'New Conversation', mode = 'chat', initialTurns = [] } = req.body;
  const id = 'conv-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
  const newConv = dataStore.saveConversation({
    id,
    userId,
    title: sanitizeString(title, 80),
    mode: mode === 'lifebox' ? 'lifebox' : 'chat',
    turns: Array.isArray(initialTurns) ? initialTurns : [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return res.status(201).json(newConv);
});

aiRouter.get('/conversations/:id', optionalAuth, (req: Request, res: Response) => {
  const userId = req.user?.id || 'guest_user';
  const conv = dataStore.getConversationById(userId, req.params.id);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });
  return res.json(conv);
});

aiRouter.put('/conversations/:id', optionalAuth, (req: Request, res: Response) => {
  const userId = req.user?.id || 'guest_user';
  const conv = dataStore.getConversationById(userId, req.params.id);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });
  if (req.body.title) conv.title = sanitizeString(req.body.title, 80);
  if (req.body.mode) conv.mode = req.body.mode === 'lifebox' ? 'lifebox' : 'chat';
  if (Array.isArray(req.body.turns)) conv.turns = req.body.turns;
  const saved = dataStore.saveConversation(conv);
  return res.json(saved);
});

aiRouter.delete('/conversations/:id', optionalAuth, (req: Request, res: Response) => {
  const userId = req.user?.id || 'guest_user';
  const ok = dataStore.deleteConversation(userId, req.params.id);
  if (!ok) return res.status(404).json({ error: 'Conversation not found' });
  return res.json({ success: true });
});

/**
 * Conversational AI Engine Endpoint
 * Enforces two separate modes (CHAT vs LIFEBOX), intent classification (no repetitive greetings),
 * multi-action support, real user records lookup, and security PII scrub.
 */
aiRouter.post('/conversation', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { message, history = [], clientItems = [], mode = 'chat', conversationId } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }
    const userId = req.user?.id || 'guest_user';
    const effectiveMode = mode === 'lifebox' ? 'lifebox' : 'chat';

    const ai = getGenAI();
    const result = await ConversationEngine.processMessage({
      userId,
      message,
      history,
      clientItems,
      mode: effectiveMode,
      genAI: ai,
    });

    // If conversationId is supplied, update the stored session
    if (conversationId) {
      let conv = dataStore.getConversationById(userId, conversationId);
      if (!conv) {
        conv = dataStore.saveConversation({
          id: conversationId,
          userId,
          title: sanitizeString(message.slice(0, 40), 40) || 'Conversation',
          mode: effectiveMode,
          turns: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      conv.turns.push({
        id: 'msg-u-' + Date.now(),
        role: 'user',
        text: message,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
      conv.turns.push({
        id: 'msg-a-' + Date.now(),
        role: 'assistant',
        text: result.reply,
        intent: result.intent,
        mode: result.mode,
        sources: result.sources,
        matchedItemIds: result.matchedItemIds,
        actions: result.actions,
        thoughtSteps: result.thoughtSteps,
        suggestedFollowUps: result.suggestedFollowUps,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
      if (conv.title === 'New Conversation' || conv.title === 'Conversation') {
        conv.title = sanitizeString(message.slice(0, 40), 40);
      }
      dataStore.saveConversation(conv);
    }

    return res.json({
      ...result,
      conversationId,
    });
  } catch (err: any) {
    console.error('Conversation Engine error:', err);
    return res.status(500).json({
      intent: 'GENERAL_CHAT',
      mode: req.body.mode || 'chat',
      reply: 'I encountered an issue processing that message. Please try again.',
      sources: [],
      matchedItemIds: [],
      actions: [],
      thoughtSteps: ['Failed to execute conversation pipeline'],
      suggestedFollowUps: ['Help me brainstorm some ideas', 'What can LIFEBOX do?'],
    });
  }
});

/**
 * Dedicated AI Writing Tools Endpoint for Note Editor
 * Supports: rewrite, improve, fix_grammar, summarize, expand, shorten, translate,
 * change_tone, continue_writing, generate_ideas, create_checklist, create_tasks,
 * extract_dates, extract_people, extract_locations, extract_important
 */
aiRouter.post('/writing-tool', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { action, text, context = '', targetLanguage = 'Spanish', targetTone = 'Professional' } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text content is required' });
    }

    const { scrubbed: safeText } = scrubPII(sanitizeString(text, 15000));
    const ai = getGenAI();

    if (!ai) {
      // Fallback simple transform
      return res.json({
        action,
        result: `[AI writing tool offline] Processed text:\n\n${safeText}`,
        suggestedTitle: 'Processed Note',
      });
    }

    let instruction = '';
    switch (action) {
      case 'rewrite':
        instruction = 'Rewrite the following text with fresh clarity, engaging phrasing, and elegant flow while preserving all original facts and details.';
        break;
      case 'improve':
        instruction = 'Improve the following text for readability, clarity, active voice, and professional polish.';
        break;
      case 'fix_grammar':
        instruction = 'Correct all grammatical, punctuation, spelling, and phrasing errors in the following text. Retain the original voice and structure.';
        break;
      case 'summarize':
        instruction = 'Provide a structured, high-yield summary of the following text with key points and actionable takeaways.';
        break;
      case 'expand':
        instruction = 'Expand on the thoughts in the following text with insightful context, supporting examples, and thorough explanations.';
        break;
      case 'shorten':
        instruction = 'Condense the following text into concise, high-impact bullet points and compact paragraphs without losing vital facts.';
        break;
      case 'translate':
        instruction = `Translate the following text into ${targetLanguage}, ensuring culturally natural, fluent, and accurate phrasing.`;
        break;
      case 'change_tone':
        instruction = `Rewrite the following text to embody a distinct ${targetTone} tone (e.g. Professional, Casual, Academic, Creative, or Executive).`;
        break;
      case 'continue_writing':
        instruction = 'Continue writing the next logical paragraphs for this note, matching its style, context, and trajectory seamlessly.';
        break;
      case 'generate_ideas':
        instruction = 'Generate 6-8 creative, highly practical ideas or follow-ups inspired by the concepts in this note.';
        break;
      case 'create_checklist':
        instruction = 'Convert the key action items and concepts from the following text into a practical markdown checklist with [ ] items.';
        break;
      case 'create_tasks':
        instruction = 'Identify all actionable tasks in the following text and present them as a clean list of structured tasks with suggested priority and due timing.';
        break;
      case 'extract_dates':
        instruction = 'Extract all dates, deadlines, schedules, and time references from the text in a clear chronological schedule.';
        break;
      case 'extract_people':
        instruction = 'Extract all names of people, roles, companies, or organizations mentioned in the text along with their context.';
        break;
      case 'extract_locations':
        instruction = 'Extract all locations, addresses, venues, and geographical references mentioned in the text.';
        break;
      case 'extract_important':
        instruction = 'Extract the most critical rules, codes, account numbers, requirements, or must-know facts from this text into a highlighted alert box.';
        break;
      default:
        instruction = 'Improve and format this text clearly.';
    }

    const prompt = `You are the LIFEBOX Note Intelligence Engine.
DIRECTIVE: ${instruction}

ADDITIONAL CONTEXT (if any):
${sanitizeString(context, 1000)}

USER TEXT:
"""
${safeText}
"""

Respond with clean, ready-to-use markdown. Do NOT add conversational pleasantries like "Here is your text" or "Sure!". Just output the resulting content directly.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    return res.json({
      action,
      result: response.text ? response.text.trim() : safeText,
    });
  } catch (err: any) {
    console.error('Writing tool error:', err);
    return res.status(500).json({ error: 'Failed to process text with writing tool' });
  }
});

