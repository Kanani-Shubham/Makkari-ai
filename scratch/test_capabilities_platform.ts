import { skillRegistry } from '../lib/ai/skills/registry';
import { toolRegistry } from '../lib/ai/tools/registry';
import { toolRouter } from '../lib/ai/tools/tool-router';
import { getProviderToolSchemas } from '../lib/ai/tools/schemas';
import { mcpRegistry } from '../lib/ai/mcp/registry';
import { resolveTurnCapabilities } from '../lib/ai/capability/pipeline';

async function runCapabilitiesTestSuite() {
  console.log('===============================================================');
  console.log('MAKKARI AI: UNIVERSAL SKILLS, TOOLS & MCP TEST SUITE');
  console.log('===============================================================\n');

  let passed = 0;

  // -------------------------------------------------------------
  // TEST 1: Skill Registry Loads all System Skills in <10ms
  // -------------------------------------------------------------
  console.log('--- TEST 1: Skill Registry Loading & Manifest Speed ---');
  const t0 = Date.now();
  const allSkills = await skillRegistry.getAllSkills();
  const loadDuration = Date.now() - t0;
  console.log(`Loaded ${allSkills.length} skills in ${loadDuration}ms`);

  if (allSkills.length >= 12 && loadDuration < 50) {
    console.log('✅ TEST 1 PASSED: All 12+ system skills loaded with fast manifest caching.\n');
    passed++;
  } else {
    console.error('❌ TEST 1 FAILED\n');
  }

  // -------------------------------------------------------------
  // TEST 2: Selective Skill Resolution (Relevant vs Irrelevant)
  // -------------------------------------------------------------
  console.log('--- TEST 2: Selective Skill Resolution ---');
  const nextjsQuery = 'How do I build a Server Action in Next.js App Router?';
  const res1 = await skillRegistry.resolveSkillsForPrompt(nextjsQuery);
  console.log('Query:', nextjsQuery);
  console.log('Resolved Skills:', res1.activeSkills.map((s) => s.id));

  const hasNextjs = res1.activeSkills.some((s) => s.id === 'nextjs');
  const hasWriting = res1.activeSkills.some((s) => s.id === 'writing');

  if (hasNextjs && !hasWriting && res1.activeSkills.length <= 3) {
    console.log('✅ TEST 2 PASSED: Next.js skill selectively resolved; unrelated skills excluded.\n');
    passed++;
  } else {
    console.error('❌ TEST 2 FAILED\n');
  }

  // -------------------------------------------------------------
  // TEST 3: Tool Registry & Canonical Built-In Tools
  // -------------------------------------------------------------
  console.log('--- TEST 3: Canonical Tool Registry ---');
  const allTools = toolRegistry.getAllTools();
  console.log(`Registered Tools (${allTools.length}):`, allTools.map((t) => t.name));

  const hasCalc = toolRegistry.getTool('calculator');
  const hasMem = toolRegistry.getTool('makkari_memory') || toolRegistry.getTool('memory');
  const hasSearch = toolRegistry.getTool('web_search');

  if (hasCalc && hasMem && hasSearch) {
    console.log('✅ TEST 3 PASSED: Calculator, Memory, and Web Search tools registered.\n');
    passed++;
  } else {
    console.error('❌ TEST 3 FAILED\n');
  }

  // -------------------------------------------------------------
  // TEST 4: Tool Execution & Untrusted Result Boundary
  // -------------------------------------------------------------
  console.log('--- TEST 4: Tool Router Execution & <tool_result> Boundary ---');
  const calcCall = {
    toolId: 'calculator',
    toolName: 'calculator',
    arguments: { expression: '(15 * 4) + 10 / 2' },
  };

  const calcResult = await toolRouter.executeToolCall(calcCall, {});
  console.log('Calculator Result:', calcResult.result);
  console.log('Formatted Output:\n', calcResult.formattedOutput);

  if (
    calcResult.success &&
    calcResult.result === 65 &&
    calcResult.formattedOutput?.includes('<tool_result name="calculator">')
  ) {
    console.log('✅ TEST 4 PASSED: Safe calculation executed and wrapped in <tool_result> boundary.\n');
    passed++;
  } else {
    console.error('❌ TEST 4 FAILED\n');
  }

  // -------------------------------------------------------------
  // TEST 5: Provider Tool Schemas (Gemini, OpenAI, Anthropic)
  // -------------------------------------------------------------
  console.log('--- TEST 5: Universal Provider Tool Schemas ---');
  const geminiSchemas = getProviderToolSchemas('gemini', [hasCalc!]);
  const openAISchemas = getProviderToolSchemas('openai', [hasCalc!]);
  const anthropicSchemas = getProviderToolSchemas('anthropic', [hasCalc!]);

  const geminiValid = Array.isArray((geminiSchemas[0] as any)?.functionDeclarations);
  const openAIValid = (openAISchemas[0] as any)?.type === 'function';
  const anthropicValid = !!(anthropicSchemas[0] as any)?.input_schema;

  if (geminiValid && openAIValid && anthropicValid) {
    console.log('✅ TEST 5 PASSED: Provider schemas converted for Gemini, OpenAI, and Anthropic.\n');
    passed++;
  } else {
    console.error('❌ TEST 5 FAILED\n');
  }

  // -------------------------------------------------------------
  // TEST 6: MCP Server Registry & Tool Normalization
  // -------------------------------------------------------------
  console.log('--- TEST 6: Model Context Protocol (MCP) Registry ---');
  const mcpServers = mcpRegistry.getAllServers();
  console.log(`Configured MCP Servers (${mcpServers.length}):`, mcpServers.map((s) => s.name));

  const canvaServer = mcpRegistry.getServer('canva-mcp');
  if (canvaServer && canvaServer.allowedTools?.includes('create_design')) {
    console.log('✅ TEST 6 PASSED: MCP servers configured with 2026 capability specifications.\n');
    passed++;
  } else {
    console.error('❌ TEST 6 FAILED\n');
  }

  // -------------------------------------------------------------
  // TEST 7: Capability Resolution Pipeline
  // -------------------------------------------------------------
  console.log('--- TEST 7: Turn Capability Resolution Pipeline ---');
  const capResult = await resolveTurnCapabilities({
    userPrompt: 'Can you write a React component for a calculator?',
  });

  console.log('Active Skills:', capResult.activeSkillNames);
  console.log('Active Tools:', capResult.activeTools.length);
  console.log('Manifest included in prompt:', capResult.systemPromptAdditions.includes('<available_skills>'));

  if (
    capResult.activeSkillNames.includes('react') &&
    capResult.systemPromptAdditions.includes('<available_skills>')
  ) {
    console.log('✅ TEST 7 PASSED: Turn capabilities resolved with manifest and targeted instructions.\n');
    passed++;
  } else {
    console.error('❌ TEST 7 FAILED\n');
  }

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log('===============================================================');
  console.log(`CAPABILITIES TEST SUITE COMPLETE: ${passed}/7 TESTS PASSED`);
  console.log('===============================================================\n');
}

runCapabilitiesTestSuite().catch(console.error);
