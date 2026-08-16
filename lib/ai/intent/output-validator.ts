import { OutputContract } from './contract-builder';
import { CreateArtifactInput } from '@/lib/artifacts/types';

export interface ValidationResult {
  isValid: boolean;
  violations: string[];
  repairedArtifact?: CreateArtifactInput;
  canAutoRepair: boolean;
}

/**
 * Validates generated artifact against the explicit OutputContract.
 * Deterministic Auto-Repair: Bounded to MAX 1 Attempt.
 */
export function validateOutputAgainstContract(
  artifactInput: CreateArtifactInput,
  contract: OutputContract
): ValidationResult {
  const violations: string[] = [];

  // 1. Single-file constraint validation
  if (contract.fileMode === 'single-file' && artifactInput.files && artifactInput.files.length > 1) {
    violations.push(`Expected 1 single file but received ${artifactInput.files.length} files.`);
  }

  // 2. Framework violation check
  if (contract.explicitFramework === 'none') {
    const allContent = (artifactInput.files || [])
      .map((f) => f.content)
      .join('\n');

    if (/import\s+React|from\s+['"]react['"]|from\s+['"]next/i.test(allContent)) {
      violations.push('User explicitly requested vanilla HTML/JS with no React/Next.js framework.');
    }
  }

  // 3. Attempt deterministic auto-repair for multi-file HTML -> single-file HTML
  let repairedArtifact: CreateArtifactInput | undefined = undefined;
  let canAutoRepair = false;

  if (
    contract.fileMode === 'single-file' &&
    artifactInput.files &&
    artifactInput.files.length > 1
  ) {
    const htmlFile = artifactInput.files.find((f) => f.filename.endsWith('.html') || f.language === 'html');
    const cssFiles = artifactInput.files.filter((f) => f.filename.endsWith('.css') || f.language === 'css');
    const jsFiles = artifactInput.files.filter((f) => f.filename.endsWith('.js') || f.language === 'javascript');

    if (htmlFile) {
      let combinedHtml = htmlFile.content;

      // Inline CSS
      if (cssFiles.length > 0) {
        const combinedCss = cssFiles.map((c) => c.content).join('\n\n');
        if (combinedHtml.includes('</head>')) {
          combinedHtml = combinedHtml.replace('</head>', `  <style>\n${combinedCss}\n  </style>\n</head>`);
        } else {
          combinedHtml = `<style>\n${combinedCss}\n</style>\n` + combinedHtml;
        }
      }

      // Inline JS
      if (jsFiles.length > 0) {
        const combinedJs = jsFiles.map((j) => j.content).join('\n\n');
        if (combinedHtml.includes('</body>')) {
          combinedHtml = combinedHtml.replace('</body>', `  <script>\n${combinedJs}\n  </script>\n</body>`);
        } else {
          combinedHtml = combinedHtml + `\n<script>\n${combinedJs}\n</script>`;
        }
      }

      repairedArtifact = {
        title: artifactInput.title || 'Interactive Web Page',
        artifact_type: 'web',
        files: [
          {
            filename: contract.primaryFilename || 'index.html',
            language: 'html',
            content: combinedHtml,
            is_entry_file: true,
          },
        ],
      };
      canAutoRepair = true;
    }
  }

  return {
    isValid: violations.length === 0,
    violations,
    repairedArtifact,
    canAutoRepair,
  };
}
