import { SkillDefinition } from './types';

/**
 * Builds a fast, compact capability manifest (<10ms) for model prompt injection
 * Avoids dumping massive skill instructions into every turn
 */
export function buildSkillsManifest(skills: SkillDefinition[]): string {
  const enabledSkills = skills.filter((s) => s.enabled);
  if (enabledSkills.length === 0) return '';

  const lines = enabledSkills.map(
    (s) => `- **${s.id}**: ${s.description} (Tools: ${s.tools.length > 0 ? s.tools.join(', ') : 'none'})`
  );

  return [
    '<available_skills>',
    'The following domain skills and workflows are available. Makkari dynamically activates relevant workflow instructions when requested.',
    ...lines,
    '</available_skills>',
  ].join('\n');
}
