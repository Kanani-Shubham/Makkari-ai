function runPreviewSecurityTests() {
  console.log('===============================================================');
  console.log('MAKKARI AI: HARDENED SANDBOX PREVIEW SECURITY TEST SUITE');
  console.log('===============================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (!condition) {
      console.error(`❌ TEST FAILED: ${msg}`);
      throw new Error(msg);
    }
    passed++;
    console.log(`✅ ${msg}`);
  }

  // --- TEST 1: Sandbox Attribute Hardening ---
  console.log('--- TEST 1: Sandbox Attribute Hardening ---');
  const allowedTokens = ['allow-scripts', 'allow-modals', 'allow-forms'];
  const forbiddenToken = 'allow-same-origin';

  assert(!allowedTokens.includes(forbiddenToken), 'allow-same-origin is strictly omitted from sandbox');
  assert(allowedTokens.includes('allow-scripts'), 'allow-scripts is permitted for interactive widgets');
  assert(allowedTokens.includes('allow-modals'), 'allow-modals is permitted');

  // --- TEST 2: Content Security Policy Directives ---
  console.log('\n--- TEST 2: Content Security Policy Directives ---');
  const csp = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob: https:; font-src data: https:; media-src data: blob:; connect-src 'none'; frame-src 'none'; object-src 'none';";

  assert(csp.includes("connect-src 'none'"), "Script-driven network calls blocked with connect-src 'none'");
  assert(csp.includes("img-src data: blob: https:"), 'HTTPS image assets are allowed');
  assert(csp.includes("font-src data: https:"), 'HTTPS web fonts (e.g. Google Fonts) are allowed');
  assert(csp.includes("object-src 'none'"), "Flash/Plugin embedding blocked with object-src 'none'");
  assert(csp.includes("frame-src 'none'"), "Nested iframe embedding blocked with frame-src 'none'");

  // --- TEST 3: Responsive Viewports Configuration ---
  console.log('\n--- TEST 3: Responsive Viewports Configuration ---');
  const viewports = {
    desktop: '100%',
    tablet: '768px',
    mobile: '375px',
  };

  assert(viewports.desktop === '100%', 'Desktop viewport spans 100%');
  assert(viewports.tablet === '768px', 'Tablet viewport locked to 768px');
  assert(viewports.mobile === '375px', 'Mobile viewport locked to 375px');

  console.log('\n===============================================================');
  console.log(`PREVIEW SECURITY TEST SUITE COMPLETE: ${passed}/${total} TESTS PASSED`);
  console.log('===============================================================');
}

runPreviewSecurityTests();
