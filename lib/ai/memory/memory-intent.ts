import { MemoryType } from './types';
import { sanitizeMemoryContent } from './memory-service';

export type MemoryIntentCategory = 'REMEMBER' | 'FORGET' | 'SEARCH' | 'NONE';

export interface MemoryIntentResult {
  category: MemoryIntentCategory;
  rawText: string;
  extractedFact?: string;
  inferredType?: MemoryType;
  query?: string;
  confidence: number;
}

/**
 * Patterns that indicate explicit intent to SAVE or PERSIST a memory.
 */
const REMEMBER_PATTERNS = [
  /^(?:please\s+)?(?:remember\s+(?:that\s+)?|store\s+(?:this\s+)?in\s+(?:your\s+)?memory\s+(?:that\s+)?|save\s+(?:this\s+)?to\s+(?:my\s+)?memory\s+(?:that\s+)?|keep\s+(?:this\s+)?in\s+mind\s+(?:that\s+)?|don't\s+forget\s+(?:that\s+)?|add\s+(?:this\s+)?to\s+(?:my\s+)?memories\s+(?:that\s+)?|note\s+(?:this\s+)?for\s+(?:the\s+)?future\s*(?:[:,-]|\s+that\s+)?)\s*(.+)$/i,
  /^(?:from\s+now\s+on\s*,\s*(?:always\s+)?|always\s+remember\s+(?:that\s+)?|make\s+sure\s+you\s+remember\s+(?:that\s+)?)\s*(.+)$/i,
  /^(?:i\s+want\s+you\s+to\s+remember\s+(?:that\s+)?|i\s+want\s+to\s+save\s+a\s+memory\s*[:,-]?\s*)\s*(.+)$/i,
  /(?:^|\.\s+)(?:please\s+)?remember\s+this\s*[:,-]\s*(.+)$/i,
];

/**
 * Patterns that indicate explicit intent to REMOVE or FORGET a memory.
 */
const FORGET_PATTERNS = [
  /^(?:please\s+)?(?:forget\s+(?:that\s+)?|don't\s+remember\s+(?:that\s+)?|remove\s+(?:that\s+|this\s+)?from\s+(?:your\s+|my\s+)?memory\s+(?:about\s+)?|delete\s+(?:that\s+|this\s+)?(?:memory\s+about\s+|from\s+memory\s+)?|erase\s+(?:that\s+|this\s+)?from\s+memory\s+(?:about\s+)?)\s*(.+)$/i,
];

/**
 * Patterns that indicate explicit intent to QUERY or SEARCH memories.
 */
const SEARCH_PATTERNS = [
  /^(?:what\s+do\s+you\s+remember\s+about\s+(?:me|my\s+projects|my\s+preferences|my\s+stack)\??)$/i,
  /^(?:show\s+(?:me\s+)?(?:my\s+)?(?:saved\s+)?memories|list\s+(?:my\s+)?memories|what\s+memories\s+do\s+you\s+have\s+about\s+me\??)$/i,
];

/**
 * Questions or rhetorical statements containing "remember" that MUST NOT trigger memory creation.
 */
const RHETORICAL_PATTERNS = [
  /^do\s+you\s+remember\s+/i,
  /^can\s+you\s+remember\s+/i,
  /^did\s+you\s+remember\s+/i,
  /^would\s+you\s+remember\s+/i,
  /^remember\s*,\s*(?:tomorrow|today|yesterday|next\s+week)/i,
  /^remember\s+when\s+/i,
  /^remember\s+how\s+/i,
  /\bhow\s+to\s+remember\b/i,
];

/**
 * Classifies the type of fact from text content.
 */
export function inferMemoryType(content: string): MemoryType {
  const lower = content.toLowerCase();

  if (
    lower.includes('my name is') ||
    lower.includes('i am from') ||
    lower.includes('i live in') ||
    lower.includes('my role is') ||
    lower.includes('i work as') ||
    lower.includes('i am a ') ||
    lower.includes('pursuing') ||
    lower.includes('btech') ||
    lower.includes('student at')
  ) {
    return 'profile';
  }

  if (
    lower.includes('project') ||
    lower.includes('building') ||
    lower.includes('developing') ||
    lower.includes('working on') ||
    lower.includes('app called') ||
    lower.includes('repository')
  ) {
    return 'project';
  }

  if (
    lower.includes('goal') ||
    lower.includes('aim to') ||
    lower.includes('target') ||
    lower.includes('preparing for') ||
    lower.includes('plan to')
  ) {
    return 'goal';
  }

  if (
    lower.includes('stack') ||
    lower.includes('typescript') ||
    lower.includes('javascript') ||
    lower.includes('python') ||
    lower.includes('next.js') ||
    lower.includes('react') ||
    lower.includes('tailwind') ||
    lower.includes('postgresql') ||
    lower.includes('supabase') ||
    lower.includes('gin index') ||
    lower.includes('framework') ||
    lower.includes('database') ||
    lower.includes('orm') ||
    lower.includes('docker') ||
    lower.includes('prisma')
  ) {
    return 'technical_preference';
  }

  if (
    lower.includes('prefer') ||
    lower.includes('like to') ||
    lower.includes('always use') ||
    lower.includes('dislike') ||
    lower.includes('concise') ||
    lower.includes('dark mode') ||
    lower.includes('light mode')
  ) {
    return 'preference';
  }

  if (
    lower.includes('workflow') ||
    lower.includes('git workflow') ||
    lower.includes('ci/cd') ||
    lower.includes('deployment') ||
    lower.includes('pr review')
  ) {
    return 'workflow';
  }

  return 'other';
}

/**
 * Analyzes a user message for explicit memory directives.
 */
export function detectMemoryIntent(userMessage: string): MemoryIntentResult {
  const trimmed = userMessage.trim();

  if (!trimmed || trimmed.length < 5) {
    return { category: 'NONE', rawText: trimmed, confidence: 0 };
  }

  // 1. Filter out rhetorical/conversational questions (e.g. "Do you remember what React is?")
  for (const nonPattern of RHETORICAL_PATTERNS) {
    if (nonPattern.test(trimmed)) {
      return { category: 'NONE', rawText: trimmed, confidence: 0 };
    }
  }

  // 2. Check for SEARCH intent
  for (const searchPattern of SEARCH_PATTERNS) {
    if (searchPattern.test(trimmed)) {
      return {
        category: 'SEARCH',
        rawText: trimmed,
        query: trimmed.replace(/^(?:what\s+do\s+you\s+remember\s+about\s+|show\s+(?:me\s+)?(?:my\s+)?memories\s*|list\s+memories\s*)/i, '').replace(/[?.]/g, '').trim(),
        confidence: 0.95,
      };
    }
  }

  // 3. Check for FORGET intent
  for (const forgetPattern of FORGET_PATTERNS) {
    const match = trimmed.match(forgetPattern);
    if (match && match[1]) {
      const target = match[1].replace(/[.!?]+$/, '').trim();
      return {
        category: 'FORGET',
        rawText: trimmed,
        query: target,
        confidence: 0.95,
      };
    }
  }

  // 4. Check for REMEMBER intent
  for (const rememberPattern of REMEMBER_PATTERNS) {
    const match = trimmed.match(rememberPattern);
    if (match && match[1]) {
      let fact = match[1].replace(/[.!?]+$/, '').trim();

      // Normalize pronouns: "I am" -> "User is", "my preferred" -> "User's preferred", etc.
      if (/^i\s+am\s+/i.test(fact)) {
        fact = fact.replace(/^i\s+am\s+/i, 'User is ');
      } else if (/^i\s+prefer\s+/i.test(fact)) {
        fact = fact.replace(/^i\s+prefer\s+/i, 'User prefers ');
      } else if (/^i\s+always\s+use\s+/i.test(fact)) {
        fact = fact.replace(/^i\s+always\s+use\s+/i, 'User always uses ');
      } else if (/^i\s+use\s+/i.test(fact)) {
        fact = fact.replace(/^i\s+use\s+/i, 'User uses ');
      } else if (/^my\s+/i.test(fact)) {
        fact = fact.replace(/^my\s+/i, "User's ");
      } else if (/^i\s+learn\s+/i.test(fact)) {
        fact = fact.replace(/^i\s+learn\s+/i, 'User is learning ');
      } else if (!/^user\b/i.test(fact)) {
        fact = `User preference: ${fact}`;
      }

      const sanitizedFact = sanitizeMemoryContent(fact);
      if (!sanitizedFact || sanitizedFact.length < 3) {
        return { category: 'NONE', rawText: trimmed, confidence: 0 };
      }

      const inferredType = inferMemoryType(sanitizedFact);

      return {
        category: 'REMEMBER',
        rawText: trimmed,
        extractedFact: sanitizedFact,
        inferredType,
        confidence: 0.98,
      };
    }
  }

  return { category: 'NONE', rawText: trimmed, confidence: 0 };
}
