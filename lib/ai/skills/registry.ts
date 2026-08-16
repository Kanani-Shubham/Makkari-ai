import { SkillDefinition, SkillResolutionResult } from './types';
import { loadSystemSkills } from './loader';
import { buildSkillsManifest } from './manifest';

export class SkillRegistry {
  private static instance: SkillRegistry;

  private constructor() {}

  public static getInstance(): SkillRegistry {
    if (!SkillRegistry.instance) {
      SkillRegistry.instance = new SkillRegistry();
    }
    return SkillRegistry.instance;
  }

  /**
   * Retrieves all available skills
   */
  public async getAllSkills(): Promise<SkillDefinition[]> {
    const skillsMap = await loadSystemSkills();
    return Array.from(skillsMap.values());
  }

  /**
   * Retrieves a specific skill by ID
   */
  public async getSkillById(id: string): Promise<SkillDefinition | undefined> {
    const skillsMap = await loadSystemSkills();
    return skillsMap.get(id.toLowerCase());
  }

  /**
   * Resolves relevant skills for a user turn based on intent/trigger matching
   * Enforces: Selects ONLY 1–3 relevant skills and blocks forbidden skills
   */
  public async resolveSkillsForPrompt(
    userPrompt: string,
    forbiddenSkills: string[] = []
  ): Promise<SkillResolutionResult> {
    const allSkills = await this.getAllSkills();
    const promptLower = userPrompt.toLowerCase();
    const forbiddenSet = new Set(forbiddenSkills.map((s) => s.toLowerCase()));

    const matchedSkills: SkillDefinition[] = [];
    const matchedTriggers: string[] = [];

    for (const skill of allSkills) {
      if (!skill.enabled) continue;
      if (forbiddenSet.has(skill.id.toLowerCase()) || forbiddenSet.has(skill.name.toLowerCase())) {
        continue;
      }

      let matched = false;

      // 1. Direct skill name matching
      if (promptLower.includes(skill.id) || promptLower.includes(skill.name.toLowerCase())) {
        matched = true;
      }

      // 2. Trigger keywords matching
      if (!matched && skill.triggers.length > 0) {
        for (const trig of skill.triggers) {
          if (promptLower.includes(trig)) {
            matched = true;
            matchedTriggers.push(trig);
            break;
          }
        }
      }

      if (matched) {
        matchedSkills.push(skill);
      }
    }

    // Cap to top 3 relevant skills to preserve strict context budget
    const activeSkills = matchedSkills.slice(0, 3);
    const manifestText = buildSkillsManifest(allSkills);

    // Build focused instruction block ONLY for matched skills
    let injectedSkillContent = '';
    if (activeSkills.length > 0) {
      const blocks = activeSkills.map(
        (s) => `<active_skill name="${s.name}" version="${s.version}">\n${s.instructions}\n</active_skill>`
      );
      injectedSkillContent = [
        '<activated_skill_instructions>',
        'The following active workflow instructions apply to this request:',
        ...blocks,
        '</activated_skill_instructions>',
      ].join('\n');
    }

    return {
      activeSkills,
      manifestText,
      injectedSkillContent,
      matchedTriggers,
    };
  }
}

export const skillRegistry = SkillRegistry.getInstance();
