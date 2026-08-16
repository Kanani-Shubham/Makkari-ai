export interface OutputContract {
  isExplicitFileRequest: boolean;
  fileMode: 'single-file' | 'multi-file' | 'code-snippet' | 'none';
  primaryFilename?: string;
  requestedLanguages: string[];
  explicitFramework: 'none' | 'react' | 'nextjs' | 'vue' | 'svelte' | null;
  explicitStyling: 'vanilla-css' | 'tailwind' | null;
  requiresTypeScript: boolean;
  requiresPreview: boolean;
  requiresDownload: boolean;
  forbiddenFrameworks: string[];
  forbiddenSkills: string[];
}

/**
 * Deterministic, synchronous, no-LLM intent resolution (<1ms)
 * Extracts explicit format, framework, language, and file constraints from user prompt
 */
export function buildOutputContract(userPrompt: string): OutputContract {
  const promptLower = userPrompt.toLowerCase();

  // 1. Detect single-file vs multi-file intent
  const isSingleFile =
    /single\s*(html\s*)?file/i.test(promptLower) ||
    /one\s*(single\s*)?(html\s*)?file/i.test(promptLower) ||
    /in\s*one\s*file/i.test(promptLower) ||
    /single\s*page\s*in\s*one\s*file/i.test(promptLower);

  const isMultiFile =
    /separate\s*files?/i.test(promptLower) ||
    /multiple\s*files?/i.test(promptLower) ||
    /files?\s*structure/i.test(promptLower) ||
    /project\s*structure/i.test(promptLower);

  // 2. Detect requested languages
  const requestedLanguages: string[] = [];
  if (/\bhtml\b/i.test(promptLower) || /index\.html/i.test(promptLower)) requestedLanguages.push('html');
  if (/\bcss\b/i.test(promptLower) || /styles?\.css/i.test(promptLower)) requestedLanguages.push('css');
  if (/\b(javascript|js|vanilla\s*js)\b/i.test(promptLower)) requestedLanguages.push('javascript');
  if (/\b(typescript|ts)\b/i.test(promptLower)) requestedLanguages.push('typescript');
  if (/\b(python|py)\b/i.test(promptLower)) requestedLanguages.push('python');
  if (/\bsql\b/i.test(promptLower)) requestedLanguages.push('sql');

  // 3. Detect framework intent
  let explicitFramework: 'none' | 'react' | 'nextjs' | 'vue' | 'svelte' | null = null;
  const hasNoFrameworkExplicit =
    /no\s*react/i.test(promptLower) ||
    /no\s*next/i.test(promptLower) ||
    /vanilla\s*(html|css|js|javascript)/i.test(promptLower) ||
    /using\s*html\s*css\s*js/i.test(promptLower) ||
    /pure\s*html/i.test(promptLower) ||
    /plain\s*html/i.test(promptLower);

  if (hasNoFrameworkExplicit) {
    explicitFramework = 'none';
  } else if (/next\.?js|app\s*router/i.test(promptLower)) {
    explicitFramework = 'nextjs';
  } else if (/\breact\b/i.test(promptLower)) {
    explicitFramework = 'react';
  } else if (/\bvue\b/i.test(promptLower)) {
    explicitFramework = 'vue';
  } else if (/\bsvelte\b/i.test(promptLower)) {
    explicitFramework = 'svelte';
  }

  // 4. Detect styling intent
  let explicitStyling: 'vanilla-css' | 'tailwind' | null = null;
  if (/tailwind/i.test(promptLower)) {
    explicitStyling = 'tailwind';
  } else if (/vanilla\s*css|pure\s*css|css\s*inside\s*style/i.test(promptLower) || hasNoFrameworkExplicit) {
    explicitStyling = 'vanilla-css';
  }

  // 5. TypeScript constraint
  const requiresTypeScript =
    /\b(typescript|ts|tsx)\b/i.test(promptLower) && explicitFramework !== 'none';

  // 6. Preview & download requirement
  const requiresPreview =
    /preview|show\s*preview|live\s*preview|demo|interactive/i.test(promptLower) ||
    requestedLanguages.includes('html') ||
    isSingleFile;

  const requiresDownload =
    /download|export|zip/i.test(promptLower) || isMultiFile || isSingleFile;

  // 7. Determine fileMode and primaryFilename
  let fileMode: 'single-file' | 'multi-file' | 'code-snippet' | 'none' = 'none';
  let primaryFilename: string | undefined = undefined;

  const isExplicitFileRequest =
    isSingleFile ||
    isMultiFile ||
    requestedLanguages.length > 0 ||
    /create\s*(a\s*)?(page|website|app|component|file|login|table|dashboard|landing)/i.test(promptLower);

  if (isSingleFile || (requestedLanguages.includes('html') && explicitFramework === 'none' && !isMultiFile)) {
    fileMode = 'single-file';
    primaryFilename = 'index.html';
  } else if (isMultiFile || explicitFramework === 'nextjs') {
    fileMode = 'multi-file';
  } else if (isExplicitFileRequest) {
    fileMode = 'single-file';
    if (requestedLanguages.includes('html')) primaryFilename = 'index.html';
    else if (requestedLanguages.includes('python')) primaryFilename = 'script.py';
    else if (requestedLanguages.includes('sql')) primaryFilename = 'query.sql';
  }

  // 8. Forbidden frameworks and conflicting skills
  const forbiddenFrameworks: string[] = [];
  const forbiddenSkills: string[] = [];

  if (explicitFramework === 'none' || fileMode === 'single-file') {
    forbiddenFrameworks.push('nextjs', 'react', 'vue', 'svelte');
    forbiddenSkills.push('nextjs', 'react');
    if (!requiresTypeScript) {
      forbiddenSkills.push('typescript');
    }
  }

  return {
    isExplicitFileRequest,
    fileMode,
    primaryFilename,
    requestedLanguages,
    explicitFramework,
    explicitStyling,
    requiresTypeScript,
    requiresPreview,
    requiresDownload,
    forbiddenFrameworks,
    forbiddenSkills,
  };
}

/**
 * Builds high-priority <output_contract> directive block for the AI system prompt
 */
export function formatOutputContractPrompt(contract: OutputContract): string {
  if (!contract.isExplicitFileRequest && contract.fileMode === 'none') {
    return '';
  }

  const lines: string[] = [];
  lines.push('<output_contract>');
  lines.push('CRITICAL USER SPECIFICATION & CONSTRAINTS:');

  if (contract.fileMode === 'single-file') {
    const filename = contract.primaryFilename || 'index.html';
    lines.push(`- OUTPUT FORMAT: You must produce EXACTLY ONE SINGLE FILE: "${filename}".`);
    if (filename.endsWith('.html')) {
      lines.push('- ARCHITECTURE: Embed all CSS inside <style> tags and all JavaScript inside <script> tags within this single HTML file.');
      lines.push('- RESTRICTION: DO NOT split into multiple files (e.g. do not create separate styles.css or script.js).');
    }
  } else if (contract.fileMode === 'multi-file') {
    lines.push('- OUTPUT FORMAT: Produce a clean multi-file project structure.');
  }

  if (contract.explicitFramework === 'none') {
    lines.push('- FRAMEWORK RESTRICTION: DO NOT use Next.js, React, TypeScript, Tailwind, Vue, or Svelte. Use pure vanilla HTML, CSS, and JavaScript.');
  } else if (contract.explicitFramework) {
    lines.push(`- FRAMEWORK: Use ${contract.explicitFramework.toUpperCase()}.`);
  }

  if (contract.forbiddenSkills.length > 0) {
    lines.push(`- EXCLUDED PARADIGMS: Ignore guidelines from excluded skills: ${contract.forbiddenSkills.join(', ')}.`);
  }

  lines.push('- ACTION: Call the `makkari_artifact` tool to emit this artifact.');
  lines.push('</output_contract>');

  return lines.join('\n');
}
