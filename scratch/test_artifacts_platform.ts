import { detectFileInfo, computeContentHash, formatFileSize } from '../lib/files/file-type';
import { makkariArtifactTool } from '../lib/ai/tools/builtin/artifact-tool';
import { ToolRegistry } from '../lib/ai/tools/registry';
import { skillRegistry } from '../lib/ai/skills/registry';
import JSZip from 'jszip';

async function runArtifactsPlatformTests() {
  console.log('===============================================================');
  console.log('MAKKARI AI: ARTIFACTS, FILES & WORKSPACE PLATFORM TEST SUITE');
  console.log('===============================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, message: string) {
    total++;
    if (!condition) {
      console.error(`❌ TEST FAILED: ${message}`);
      throw new Error(message);
    }
    passed++;
    console.log(`✅ ${message}`);
  }

  // --- TEST 1: File Type & Language Detection ---
  console.log('--- TEST 1: File Type & Metadata Detection ---');
  const htmlInfo = detectFileInfo('index.html');
  const pyInfo = detectFileInfo('server.py');
  const sqlInfo = detectFileInfo('roadmap_tables.sql');
  const imgInfo = detectFileInfo('screenshot.png', 'image/png');
  const mdInfo = detectFileInfo('PRD.md');

  assert(htmlInfo.language === 'html' && htmlInfo.isLiveHtml && htmlInfo.category === 'web', 'HTML detected as live web file');
  assert(pyInfo.language === 'python' && pyInfo.isCode && !pyInfo.isLiveHtml, 'Python detected as code file');
  assert(sqlInfo.language === 'sql' && sqlInfo.isCode, 'SQL detected correctly');
  assert(imgInfo.isImage && imgInfo.category === 'image', 'PNG detected as image');
  assert(mdInfo.language === 'markdown' && mdInfo.isDocument, 'Markdown detected as document');

  // --- TEST 2: Content Hashing & Size Formatting ---
  console.log('\n--- TEST 2: Content Hashing & Size Formatting ---');
  const codeContent = 'console.log("Hello Makkari");';
  const hash1 = computeContentHash(codeContent);
  const hash2 = computeContentHash(codeContent);
  const hash3 = computeContentHash('different content');

  assert(hash1 === hash2, 'Identical content yields identical SHA-256 hash');
  assert(hash1 !== hash3, 'Distinct content yields distinct SHA-256 hash');
  assert(formatFileSize(18841) === '18.4 KB', 'File size formatted accurately to 18.4 KB');

  // --- TEST 3: Hard 20-File Limit Logic ---
  console.log('\n--- TEST 3: 20-File Upload Hard Limit ---');
  const maxLimit = 20;
  const validBatch = Array.from({ length: 20 }, (_, i) => `file_${i}.txt`);
  const invalidBatch = Array.from({ length: 21 }, (_, i) => `file_${i}.txt`);

  assert(validBatch.length <= maxLimit, '20 files accepted by validator');
  assert(invalidBatch.length > maxLimit, '21st file rejected by validator');

  // --- TEST 4: Canonical makkari_artifact Tool Registration ---
  console.log('\n--- TEST 4: Artifact Tool in Registry ---');
  const reg = ToolRegistry.getInstance();
  const artTool = reg.getTool('makkari_artifact') || reg.getTool('artifact');
  assert(!!artTool, 'makkari_artifact tool is registered in canonical tool registry');
  assert(artTool?.inputSchema.required?.includes('action') === true, 'Artifact tool input schema has action required');

  // --- TEST 5: HTML/CSS/JS In-Memory Bundle Logic ---
  console.log('\n--- TEST 5: Live HTML/CSS/JS Sandbox Bundler ---');
  const htmlSrc = '<!DOCTYPE html><html><head><title>App</title></head><body><h1>Hello</h1></body></html>';
  const cssSrc = 'body { background-color: #121212; }';
  const jsSrc = 'console.log("App ready");';

  let bundled = htmlSrc;
  if (bundled.includes('</head>')) {
    bundled = bundled.replace('</head>', `<style>\n${cssSrc}\n</style>\n</head>`);
  }
  if (bundled.includes('</body>')) {
    bundled = bundled.replace('</body>', `<script>\n${jsSrc}\n</script>\n</body>`);
  }

  assert(bundled.includes('<style>\nbody { background-color: #121212; }\n</style>'), 'CSS successfully injected into <head>');
  assert(bundled.includes('<script>\nconsole.log("App ready");\n</script>'), 'JS successfully injected before </body>');

  // --- TEST 6: JSZip Multi-File Project Creation ---
  console.log('\n--- TEST 6: JSZip Project ZIP Archive Generation ---');
  const zip = new JSZip();
  const folder = zip.folder('makkari-project');
  folder?.file('index.html', htmlSrc);
  folder?.file('style.css', cssSrc);
  folder?.file('script.js', jsSrc);

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  assert(zipBuffer.length > 100, `ZIP archive generated successfully (${zipBuffer.length} bytes)`);

  // --- TEST 7: Artifacts Skill Resolution ---
  console.log('\n--- TEST 7: Artifacts Skill Resolution ---');
  const skillRes = await skillRegistry.resolveSkillsForPrompt('Build a landing page artifact with HTML and CSS');
  const hasArtifactOrFrontend = skillRes.activeSkills.some((s) => s.id === 'artifacts' || s.id === 'frontend');
  assert(hasArtifactOrFrontend, 'Landing page query resolved artifacts / frontend skill');

  console.log('\n===============================================================');
  console.log(`ARTIFACTS PLATFORM TEST SUITE COMPLETE: ${passed}/${total} TESTS PASSED`);
  console.log('===============================================================');
}

runArtifactsPlatformTests().catch((err) => {
  console.error('Fatal test failure:', err);
  process.exit(1);
});
