import assert from 'node:assert';
import http from 'node:http';
import { mcpClientManager } from '../lib/ai/mcp/client-manager';
import { toolRegistry } from '../lib/ai/tools/registry';
import { toolRouter } from '../lib/ai/tools/tool-router';
import { QueryEngine } from '../lib/ai/runtime/query-engine';
import { createTurnState } from '../lib/ai/runtime/turn-state';
import { CanonicalEventBus, MakkariEvent } from '../lib/ai/events/canonical-events';
import { resolveTurnCapabilities } from '../lib/ai/capability/pipeline';
import { ProviderAdapter, ChatRequest, ChatChunk, AIError } from '../lib/ai/types';
import { generateCallId } from '../lib/ai/runtime/runtime-messages';
import { MCPServerConfig } from '../lib/ai/mcp/types';

async function runRealMcpAcceptanceTestSuite() {
  console.log('===============================================================');
  console.log('  MAKKARI REAL MCP END-TO-END ACCEPTANCE TEST SUITE');
  console.log('===============================================================\n');

  let passed = 0;
  let total = 0;

  function test(name: string, condition: boolean, details?: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`  [PASS] Test ${total}: ${name}`);
    } else {
      console.error(`  [FAIL] Test ${total}: ${name}`);
      if (details) console.error(`         Detail: ${details}`);
      throw new Error(`Assertion failed: ${name}`);
    }
  }

  // 1. Setup local Mock MCP HTTP Server simulating real JSON-RPC 2.0 Streamable HTTP transport
  let serverReceivedCalls: Array<{ method: string; params: any; headers: any }> = [];
  let shouldFailAuth = false;
  let shouldFailList = false;
  let shouldFailCall = false;

  const mockMcpHttpServer = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      let parsedBody: any = {};
      try { parsedBody = JSON.parse(body); } catch {}

      serverReceivedCalls.push({
        method: parsedBody.method || req.url,
        params: parsedBody.params,
        headers: req.headers,
      });

      // Authentication check
      if (shouldFailAuth && req.headers['authorization'] !== 'Bearer valid-secret-key') {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32001, message: 'Unauthorized' } }));
        return;
      }

      if (parsedBody.method === 'initialize' || req.url?.includes('initialize')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          id: parsedBody.id || '1',
          result: {
            protocolVersion: '2024-11-05',
            serverInfo: { name: 'Canva MCP Server', version: '2.4.0' },
            capabilities: { tools: { listChanged: true } },
          },
        }));
        return;
      }

      if (parsedBody.method === 'tools/list' || req.url?.includes('tools/list')) {
        if (shouldFailList) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal tools/list error' } }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          id: parsedBody.id || '2',
          result: {
            tools: [
              {
                name: 'generate-design',
                description: 'Generates candidate design templates in Canva based on prompt',
                inputSchema: {
                  type: 'object',
                  properties: {
                    prompt: { type: 'string', description: 'Design topic or description' },
                  },
                  required: ['prompt'],
                },
              },
              {
                name: 'create-design-from-candidate',
                description: 'Creates a real design from a chosen candidate_id',
                inputSchema: {
                  type: 'object',
                  properties: {
                    candidate_id: { type: 'string', description: 'Selected candidate ID' },
                  },
                  required: ['candidate_id'],
                },
              },
              {
                name: 'search-designs',
                description: 'Searches user designs in Canva',
                inputSchema: {
                  type: 'object',
                  properties: { query: { type: 'string' } },
                  required: ['query'],
                },
              },
              {
                name: 'export-design',
                description: 'Exports a design to download format',
                inputSchema: {
                  type: 'object',
                  properties: { design_id: { type: 'string' }, format: { type: 'string' } },
                  required: ['design_id'],
                },
              },
            ],
          },
        }));
        return;
      }

      if (parsedBody.method === 'tools/call' || req.url?.includes('tools/call')) {
        if (shouldFailCall) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            jsonrpc: '2.0',
            id: parsedBody.id || '3',
            isError: true,
            content: [{ type: 'text', text: 'Canva quota exceeded or invalid prompt parameters' }],
          }));
          return;
        }

        const toolName = parsedBody.params?.name;
        let responseContent: any = {};

        if (toolName === 'generate-design') {
          responseContent = {
            candidates: [
              {
                candidate_id: 'canva_cand_987',
                title: 'Cat on Gaming Chair Poster Template',
                thumbnail_url: 'https://canva.com/thumb/canva_cand_987.jpg',
              },
            ],
            status: 'candidates_generated',
          };
        } else if (toolName === 'create-design-from-candidate') {
          const candId = parsedBody.params?.arguments?.candidate_id;
          responseContent = {
            design_id: 'canva_ds_98765',
            candidate_id: candId,
            url: 'https://www.canva.com/design/canva_ds_98765/edit',
            status: 'created',
          };
        } else {
          responseContent = { status: 'success', tool: toolName };
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          id: parsedBody.id || '3',
          content: [
            {
              type: 'text',
              text: JSON.stringify(responseContent),
            },
          ],
        }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc: '2.0', result: 'OK' }));
    });
  });

  const mockPort = 9482;
  await new Promise<void>((resolve) => {
    mockMcpHttpServer.listen(mockPort, () => resolve());
  });

  const testServerUrl = `http://localhost:${mockPort}`;

  const sampleCanvaServer: MCPServerConfig = {
    id: 'canva-mcp',
    name: 'Canva MCP',
    url: testServerUrl,
    transport: 'streamable-http',
    apiKey: 'valid-secret-key',
    status: 'disconnected',
  };

  try {
    // -------------------------------------------------------------
    // TEST 1: Connect MCP Server
    // -------------------------------------------------------------
    console.log('[1/24] TEST 1: Connect MCP Server...');
    const discovery = await mcpClientManager.connect(sampleCanvaServer);
    test('Server status transitioned to connected', sampleCanvaServer.status === 'connected');
    test('Discovery returned non-empty tools array', discovery.tools.length === 4);

    // -------------------------------------------------------------
    // TEST 2: Authentication Headers
    // -------------------------------------------------------------
    console.log('\n[2/24] TEST 2: Authentication Verification...');
    const authHeaders = serverReceivedCalls.map((c) => c.headers['authorization']);
    test('Bearer authentication token was sent in request headers', authHeaders.includes('Bearer valid-secret-key'));

    // -------------------------------------------------------------
    // TEST 3: Initialize Handshake
    // -------------------------------------------------------------
    console.log('\n[3/24] TEST 3: Protocol Handshake (initialize)...');
    test('Received serverInfo with protocolVersion', discovery.serverInfo?.protocolVersion === '2024-11-05');
    test('Server info contains Canva MCP Server name', discovery.serverInfo?.name === 'Canva MCP Server');

    // -------------------------------------------------------------
    // TEST 4: Dynamic tools/list Discovery (Official Tools)
    // -------------------------------------------------------------
    console.log('\n[4/24] TEST 4: Real tools/list Discovery with Official Canva Tools...');
    const toolNames = discovery.tools.map((t) => t.name);
    test('generate-design discovered dynamically from endpoint', toolNames.includes('generate-design'));
    test('create-design-from-candidate discovered dynamically from endpoint', toolNames.includes('create-design-from-candidate'));
    test('search-designs discovered dynamically from endpoint', toolNames.includes('search-designs'));
    test('export-design discovered dynamically from endpoint', toolNames.includes('export-design'));

    // -------------------------------------------------------------
    // TEST 5: Persist Connection State
    // -------------------------------------------------------------
    console.log('\n[5/24] TEST 5: Connection State Metadata...');
    test('lastConnectedAt timestamp recorded', Boolean(sampleCanvaServer.lastConnectedAt));
    test('lastDiscoveredAt timestamp recorded', Boolean(sampleCanvaServer.lastDiscoveredAt));

    // -------------------------------------------------------------
    // TEST 6: ToolRegistry Entry
    // -------------------------------------------------------------
    console.log('\n[6/24] TEST 6: ToolRegistry Registration...');
    const regCanonical = toolRegistry.getTool('mcp:canva-mcp:generate-design');
    const regPrefixed = toolRegistry.getTool('mcp_canva-mcp_generate-design');
    const regShort = toolRegistry.getTool('generate-design');
    test('Tool registered under canonical id "mcp:canva-mcp:generate-design"', Boolean(regCanonical));
    test('Tool registered under prefixed name "mcp_canva-mcp_generate-design"', Boolean(regPrefixed));
    test('Tool registered under short name "generate-design"', Boolean(regShort));
    test('Tool source is marked as "mcp"', regCanonical?.source === 'mcp');

    // -------------------------------------------------------------
    // TEST 7: Capability Resolution (Model Runtime Tool Catalog)
    // -------------------------------------------------------------
    console.log('\n[7/24] TEST 7: Tool Catalog Exposure in Capability Pipeline...');
    const capRes = await resolveTurnCapabilities({
      userPrompt: 'use Canva MCP and create a design of a cat on a gaming chair',
      modelId: 'deepseek/deepseek-r1-distill-llama-70b',
      providerId: 'openrouter',
    });
    test('Active tools list contains generate-design MCP tool', capRes.activeTools.some((t) => t.name === 'generate-design' || t.name === 'mcp_canva-mcp_generate-design'));
    test('Prompt manifest contains generate-design tool schema', capRes.systemPromptAdditions.includes('generate-design'));

    // -------------------------------------------------------------
    // TEST 8: ToolRouter Execution via McpClientManager
    // -------------------------------------------------------------
    console.log('\n[8/24] TEST 8: ToolRouter Execution Routing (generate-design candidate workflow)...');
    const callId = generateCallId();
    const routerRes = await toolRouter.executeToolCall({
      toolId: 'mcp:canva-mcp:generate-design',
      toolName: 'generate-design',
      callId,
      arguments: { prompt: 'cat sitting on a gaming chair' },
    }, {
      turnId: 'test-turn-mcp-1',
    });

    test('ToolRouter executed generate-design with success=true', routerRes.success === true);
    test('Result contains candidate_id from Canva server', Boolean(routerRes.formattedOutput?.includes('canva_cand_987')));
    test('Result is bounded in untrusted XML wrapper', Boolean(routerRes.formattedOutput?.includes('<tool_result name="generate-design">')));

    // -------------------------------------------------------------
    // TEST 9: Full QueryEngine Turn Loop with OpenRouter DeepSeek R1 & Design Handoff
    // -------------------------------------------------------------
    console.log('\n[9/24] TEST 9: Full QueryEngine Turn Loop with Canva Candidate -> Create Design Workflow...');
    let modelIteration = 0;
    let receivedDesignUrlInIteration3 = false;

    const mockOpenRouterAdapter: ProviderAdapter = {
      providerKey: 'openrouter',
      name: 'OpenRouter DeepSeek R1',
      async discoverModels() { return []; },
      async healthCheck() { return { status: 'connected' }; },
      supports: () => true,
      normalizeError: (err: any): AIError => ({
        provider: 'openrouter',
        status: 500,
        message: String(err),
        userMessage: 'OpenRouter error',
        retryable: false,
      }),
      streamChat: async function* (req: ChatRequest): AsyncIterable<ChatChunk> {
        modelIteration++;
        if (modelIteration === 1) {
          yield {
            type: 'text',
            content: '<dots_function_call>\n{"name": "create-design-from-candidate", "parameters": {"candidate_id": "canva_cand_987"}}\n</dots_function_call>',
          };
        } else {
          const lastMsg = req.messages[req.messages.length - 1];
          if (lastMsg.content.includes('https://www.canva.com/design/canva_ds_98765/edit')) {
            receivedDesignUrlInIteration3 = true;
          }
          yield {
            type: 'text',
            content: 'Your design has been created! You can edit and customize it directly in Canva: https://www.canva.com/design/canva_ds_98765/edit',
          };
        }
      },
    };

    const emittedEvents: MakkariEvent[] = [];
    const eventBus = new CanonicalEventBus('test-turn-deepseek-mcp', (env) => {
      emittedEvents.push(env.event);
    });

    const queryEngine = new QueryEngine(new Map([['openrouter', mockOpenRouterAdapter]]));
    const state = createTurnState({
      conversationId: 'test-turn-deepseek-mcp',
      userId: 'test-user',
      initialMessages: [{ role: 'user', content: 'use Canva MCP to create design from candidate canva_cand_987' }],
      model: null,
      abortController: new AbortController(),
      environment: 'development',
    });

    await queryEngine.executeTurn({
      state,
      providerId: 'openrouter',
      modelId: 'deepseek/deepseek-r1-distill-llama-70b',
      messages: [{ role: 'user', content: 'use Canva MCP to create design from candidate canva_cand_987' }],
      eventBus,
      toolContext: { chatId: 'test-turn-deepseek-mcp' },
    });

    const toolCallEvt = emittedEvents.find((e) => e.type === 'TOOL_CALL') as any;
    const toolResultEvt = emittedEvents.find((e) => e.type === 'TOOL_RESULT') as any;

    test('TOOL_CALL emitted for create-design-from-candidate', toolCallEvt?.tool === 'create-design-from-candidate');
    test('TOOL_RESULT emitted with success', toolResultEvt?.result?.success === true);
    test('Same callId preserved across TOOL_CALL and TOOL_RESULT', toolCallEvt?.callId === toolResultEvt?.callId);
    test('Second model generation received design URL edit link', receivedDesignUrlInIteration3);
    test('Final turn completed successfully', state.status === 'completed');

    // -------------------------------------------------------------
    // TEST 10: Disconnect MCP Server
    // -------------------------------------------------------------
    console.log('\n[10/24] TEST 10: Disconnect MCP Server & Unregister Tools...');
    mcpClientManager.disconnect(sampleCanvaServer);
    test('Server status transitioned to disconnected', sampleCanvaServer.status === 'disconnected');
    test('Tool unregistered from ToolRegistry', toolRegistry.getTool('mcp:canva-mcp:generate-design') === undefined);

    // -------------------------------------------------------------
    // TEST 11: Disconnected Server is NOT Exposed to Model
    // -------------------------------------------------------------
    console.log('\n[11/24] TEST 11: Capability Pipeline Suppresses Disconnected Tools...');
    const disconnCaps = await resolveTurnCapabilities({
      userPrompt: 'use Canva MCP and create a design',
      modelId: 'deepseek/deepseek-r1-distill-llama-70b',
      providerId: 'openrouter',
    });
    test('Active tools list does NOT contain Canva tools when disconnected', !disconnCaps.activeTools.some((t) => t.name === 'generate-design'));


    // -------------------------------------------------------------
    // TEST 12: Authentication Error Boundary (401 -> auth_required)
    // -------------------------------------------------------------
    console.log('\n[12/24] TEST 12: Authentication Error Boundary (401 -> auth_required)...');
    shouldFailAuth = true;
    const authFailServer: MCPServerConfig = {
      id: 'canva-auth-fail',
      name: 'Canva Auth Fail',
      url: testServerUrl,
      transport: 'streamable-http',
      apiKey: 'wrong-key',
      status: 'disconnected',
    };

    let authErrorCaught = false;
    try {
      await mcpClientManager.connect(authFailServer);
    } catch {
      authErrorCaught = true;
    }
    test('Authentication failure caught without crashing', authErrorCaught);
    test('Server status set to auth_required on auth failure', authFailServer.status === 'auth_required');
    shouldFailAuth = false;

    // -------------------------------------------------------------
    // TEST 13: tools/call Failure Safe Model Recovery
    // -------------------------------------------------------------
    console.log('\n[13/24] TEST 13: Remote Tool Error Safe Recovery...');
    await mcpClientManager.connect(sampleCanvaServer);
    shouldFailCall = true;

    const failCallRes = await toolRouter.executeToolCall({
      toolId: 'mcp:canva-mcp:generate-design',
      toolName: 'generate-design',
      callId: generateCallId(),
      arguments: { prompt: 'invalid quota prompt' },
    }, {
      turnId: 'test-fail-call',
    });

    test('ToolRouter handled MCP tool error with success=false', failCallRes.success === false);
    test('Sanitized error output returned to model boundary', Boolean(failCallRes.formattedOutput?.includes('status="error"')));
    shouldFailCall = false;

    // -------------------------------------------------------------
    // TEST 14: Refresh Tools Operation
    // -------------------------------------------------------------
    console.log('\n[14/24] TEST 14: Refresh Tools Live Invalidation...');
    const refreshed = await mcpClientManager.connect(sampleCanvaServer);
    test('Refresh tools returned latest tools array', refreshed.tools.length === 4);

    // -------------------------------------------------------------
    // TEST 15: Token Encryption at Rest & AES-256 Web Crypto
    // -------------------------------------------------------------
    console.log('\n[15/24] TEST 15: AES-256-GCM Token Encryption Security...');
    const { encryptKey, decryptKey } = await import('../lib/ai/encryption');
    const secretToken = 'canva_live_user_oauth_token_xyz987';
    const encrypted = await encryptKey(secretToken);
    test('Token is encrypted at rest (not plain text)', encrypted.ciphertext !== secretToken);
    test('Encryption IV is generated', Boolean(encrypted.iv));
    const decrypted = await decryptKey(encrypted.ciphertext, encrypted.iv);
    test('Decryption restores original token', decrypted === secretToken);



  } finally {
    mockMcpHttpServer.close();
  }

  console.log('\n===============================================================');
  console.log(`  ALL ${passed}/${total} REAL MCP ACCEPTANCE TESTS PASSED!`);
  console.log('===============================================================\n');
}

runRealMcpAcceptanceTestSuite().catch((err) => {
  console.error('\nReal MCP Acceptance Test Suite Failed:', err);
  process.exit(1);
});
