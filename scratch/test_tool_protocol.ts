import { StatefulToolProtocolParser } from '../lib/ai/stream/tool-protocol-parser';

function runToolProtocolTests() {
  console.log('===============================================================');
  console.log('MAKKARI AI: STATEFUL TOOL PROTOCOL PARSER TEST SUITE');
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

  // --- TEST 1: Full Dots XML Protocol Interception Across Fragmented Chunks ---
  console.log('--- TEST 1: Dots XML Protocol Interception Across Fragmented Chunks ---');
  const parser = new StatefulToolProtocolParser();

  const fullPayload = `<dots_function_call>
<invoke name="makkari_artifact">
<parameter name="action">create</parameter>
<parameter name="file_name">index.html</parameter>
<parameter name="content">
<!DOCTYPE html>
<html>
<head><title>Test Page</title></head>
<body><h1>Hello World</h1></body>
</html>
</parameter>
</invoke>
</dots_function_call>`;

  // Break payload into tiny 8-character chunks
  const chunks: string[] = [];
  for (let i = 0; i < fullPayload.length; i += 8) {
    chunks.push(fullPayload.slice(i, i + 8));
  }

  let accumulatedText = '';
  const completedCalls = [];

  for (const chunk of chunks) {
    const res = parser.processChunk(chunk);
    accumulatedText += res.textDelta;
    completedCalls.push(...res.completedToolCalls);
  }

  const flushed = parser.flush();
  accumulatedText += flushed.textDelta;
  completedCalls.push(...flushed.completedToolCalls);

  assert(accumulatedText.trim() === '', 'Zero protocol text leaked into textDelta');
  assert(!accumulatedText.includes('<dots_function_call>'), '<dots_function_call> completely suppressed');
  assert(!accumulatedText.includes('<invoke'), '<invoke> completely suppressed');
  assert(!accumulatedText.includes('<!DOCTYPE'), '<!DOCTYPE> suppressed from text stream');

  assert(completedCalls.length === 1, 'Exactly one completed tool call parsed');
  assert(completedCalls[0].name === 'makkari_artifact', 'Tool name correctly identified as makkari_artifact');
  assert(completedCalls[0].parameters.action === 'create', 'Parameter "action" parsed as "create"');
  assert(completedCalls[0].parameters.filename === 'index.html', 'Parameter "filename" normalized to index.html');
  assert(completedCalls[0].parameters.content.includes('<h1>Hello World</h1>'), 'Complete HTML content extracted');

  // --- TEST 2: User XML Preservation ---
  console.log('\n--- TEST 2: User XML Preservation (Normal Text) ---');
  const normalParser = new StatefulToolProtocolParser();
  const userText = 'Here is an explanation of XML: <example id="1">value</example>';
  const normalRes = normalParser.processChunk(userText);
  const normalFlushed = normalParser.flush();

  const totalNormalText = normalRes.textDelta + normalFlushed.textDelta;
  assert(totalNormalText === userText, 'Normal non-tool XML passed through without modification');
  assert(normalRes.completedToolCalls.length === 0, 'No tool calls triggered by normal XML');

  console.log('\n===============================================================');
  console.log(`TOOL PROTOCOL TEST SUITE COMPLETE: ${passed}/${total} TESTS PASSED`);
  console.log('===============================================================');
}

runToolProtocolTests();
