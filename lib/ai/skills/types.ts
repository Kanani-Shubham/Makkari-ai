export type SkillCategory =
  | 'general'
  | 'engineering'
  | 'design_ui'
  | 'research'
  | 'writing'
  | 'analysis'
  | 'integrations'
  | 'custom';

export interface SkillFrontmatter {
  name: string;
  description: string;
  version: string;
  category?: SkillCategory;
  tools?: string[];
  triggers?: string[];
}

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  category: SkillCategory;
  tools: string[];
  triggers: string[];
  instructions: string;
  source: 'system' | 'workspace' | 'user';
  enabled: boolean;
  filePath?: string;
}

export interface SkillManifestEntry {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  tools: string[];
}

export interface SkillResolutionResult {
  activeSkills: SkillDefinition[];
  manifestText: string;
  injectedSkillContent?: string;
  matchedTriggers: string[];
}
