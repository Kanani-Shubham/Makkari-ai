import fs from 'fs';
import path from 'path';
import { SkillDefinition, SkillCategory } from './types';

interface SkillCacheEntry {
  skills: Map<string, SkillDefinition>;
  timestamp: number;
}

let skillCache: SkillCacheEntry | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Parses frontmatter and markdown body from skill.md content
 */
export function parseSkillMarkdown(content: string, fallbackId: string): SkillDefinition {
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);

  if (!frontmatterMatch) {
    return {
      id: fallbackId,
      name: fallbackId,
      description: 'Skill workflow instructions',
      version: '1.0.0',
      category: 'general',
      tools: [],
      triggers: [],
      instructions: content.trim(),
      source: 'system',
      enabled: true,
    };
  }

  const rawYaml = frontmatterMatch[1];
  const markdownBody = frontmatterMatch[2].trim();

  let name = fallbackId;
  let description = '';
  let version = '1.0.0';
  let category: SkillCategory = 'general';
  const tools: string[] = [];
  const triggers: string[] = [];

  // Parse YAML lines safely without external dependency
  const lines = rawYaml.split(/\r?\n/);
  let currentList: 'tools' | 'triggers' | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (trimmed.startsWith('tools:')) {
      currentList = 'tools';
      continue;
    } else if (trimmed.startsWith('triggers:')) {
      currentList = 'triggers';
      continue;
    } else if (trimmed.startsWith('- ') && currentList) {
      const item = trimmed.slice(2).trim();
      if (currentList === 'tools') tools.push(item);
      if (currentList === 'triggers') triggers.push(item.toLowerCase());
      continue;
    } else {
      currentList = null;
    }

    const colonIdx = line.indexOf(':');
    if (colonIdx > -1) {
      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 1).trim().replace(/^['"]|['"]$/g, '');
      if (key === 'name') name = val;
      if (key === 'description') description = val;
      if (key === 'version') version = val;
      if (key === 'category') category = val as SkillCategory;
    }
  }

  return {
    id: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    description,
    version,
    category,
    tools,
    triggers,
    instructions: markdownBody,
    source: 'system',
    enabled: true,
  };
}

/**
 * Loads and caches all system skills from skills/ directory in <10ms
 */
export async function loadSystemSkills(forceReload = false): Promise<Map<string, SkillDefinition>> {
  const now = Date.now();
  if (!forceReload && skillCache && now - skillCache.timestamp < CACHE_TTL_MS) {
    return skillCache.skills;
  }

  const skillsMap = new Map<string, SkillDefinition>();
  const skillsDir = path.join(process.cwd(), 'skills');

  try {
    if (fs.existsSync(skillsDir)) {
      const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillFilePath = path.join(skillsDir, entry.name, 'skill.md');
          if (fs.existsSync(skillFilePath)) {
            try {
              const fileContent = fs.readFileSync(skillFilePath, 'utf-8');
              const skillDef = parseSkillMarkdown(fileContent, entry.name);
              skillDef.filePath = skillFilePath;
              skillsMap.set(skillDef.id, skillDef);
            } catch (err) {
              console.warn(`[SKILL_LOADER] Error reading skill ${entry.name}:`, err);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('[SKILL_LOADER] Error scanning skills directory:', err);
  }

  skillCache = {
    skills: skillsMap,
    timestamp: now,
  };

  return skillsMap;
}
