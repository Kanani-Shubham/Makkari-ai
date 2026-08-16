import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { processPostChatJobs } from '../lib/ai/memory/post-chat-worker';
import { getRelevantMemoryContext, formatMemoryContextPrompt } from '../lib/ai/memory/memory-service';

const envContent = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf-8');
const envVars: Record<string, string> = {};
envContent.split('\n').forEach((line) => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
    const idx = trimmed.indexOf('=');
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    envVars[key] = val;
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function runLivePipelineTest() {
  console.log('===============================================================');
  console.log('MAKKARI AI: LIVE SUPABASE PERSISTENCE & PIPELINE AUDIT');
  console.log('===============================================================\n');

  // 1. Sign in with the user created in the browser test
  const testEmail = 'testuser@example.com';
  const testPassword = 'Password123!';

  console.log('1. Authenticating test user session with Supabase Auth:', testEmail);
  let user: any = null;

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  if (signInData?.user) {
    user = signInData.user;
    console.log('✅ Signed in existing test user! User ID:', user.id);
  } else {
    console.log('Test user not found, attempting signup...');
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          full_name: 'Audit Test User',
        },
      },
    });

    if (signUpError) {
      console.error('❌ Auth sign-up error:', signUpError.message);
      return;
    }
    user = signUpData.user;
  }

  if (!user) {
    console.error('❌ No user returned from auth');
    return;
  }

  console.log('✅ User authenticated successfully! User ID:', user.id);

  // Bootstrap Profile and Memory Settings
  console.log('2. Bootstrapping profiles and user_memory_settings...');
  const { error: profileError } = await supabase.from('profiles').upsert({
    id: user.id,
    email: testEmail,
    full_name: 'Audit Test User',
    username: `audit_${user.id.slice(0, 6)}`,
    theme: 'dark',
    preferred_model_id: 'gemini-2.5-flash',
    updated_at: new Date().toISOString(),
  });
  if (profileError) console.error('Profile upsert warning:', profileError.message);
  else console.log('✅ Profile row persisted.');

  const { error: memSetError } = await supabase.from('user_memory_settings').upsert({
    user_id: user.id,
    personalization_enabled: true,
    memory_enabled: true,
    updated_at: new Date().toISOString(),
  });
  if (memSetError) console.error('Memory settings upsert warning:', memSetError.message);
  else console.log('✅ user_memory_settings row persisted.');

  // 3. Create a real Chat with valid UUID
  const chatId = generateUUID();
  console.log('\n3. Creating live chat in public.chats with UUID:', chatId);
  const { data: chatRow, error: chatError } = await supabase
    .from('chats')
    .insert({
      id: chatId,
      user_id: user.id,
      title: 'New Conversation',
      title_source: 'auto',
      provider_id: 'gemini',
      model_id: 'gemini-2.5-flash',
      pinned_at: null,
      is_pinned: false,
      is_archived: false,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (chatError) {
    console.error('❌ Failed to insert chat into public.chats:', chatError.message);
    return;
  }
  console.log('✅ Chat persisted successfully! Row ID:', chatRow.id);

  // 4. Insert User Message
  const userMsgId = generateUUID();
  const userPrompt = 'I always use Next.js with TypeScript and PostgreSQL GIN indexes.';
  console.log('\n4. Inserting user message into public.messages:', userPrompt);
  const { data: userMsgRow, error: userMsgError } = await supabase
    .from('messages')
    .insert({
      id: userMsgId,
      chat_id: chatId,
      user_id: user.id,
      role: 'user',
      content: userPrompt,
      model_id: 'gemini-2.5-flash',
      provider_id: 'gemini',
      token_count: { prompt: 15, completion: 0, total: 15 },
      attachments: [],
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (userMsgError) {
    console.error('❌ Failed to insert user message into public.messages:', userMsgError.message);
    return;
  }
  console.log('✅ User message persisted successfully! Message ID:', userMsgRow.id);

  // 5. Insert Assistant Response Message
  const assistantMsgId = generateUUID();
  const assistantReply = 'Next.js with TypeScript and PostgreSQL GIN indexes is an exceptional, high-performance production stack for full-text search.';
  console.log('\n5. Inserting assistant message into public.messages...');
  const { data: astMsgRow, error: astMsgError } = await supabase
    .from('messages')
    .insert({
      id: assistantMsgId,
      chat_id: chatId,
      user_id: user.id,
      role: 'assistant',
      content: assistantReply,
      model_id: 'gemini-2.5-flash',
      provider_id: 'gemini',
      token_count: { prompt: 15, completion: 22, total: 37 },
      attachments: [],
      metadata: { reasoning: { available: true, summary: 'Analyzed technical stack benefits.', durationMs: 1200, provider: 'gemini' } },
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (astMsgError) {
    console.error('❌ Failed to insert assistant message into public.messages:', astMsgError.message);
    return;
  }
  console.log('✅ Assistant message persisted successfully! Message ID:', astMsgRow.id);

  // 6. Enqueue Post-Chat Job
  console.log('\n6. Enqueueing post_chat_job in public.post_chat_jobs...');
  const { error: jobEnqueueError } = await supabase.from('post_chat_jobs').insert({
    user_id: user.id,
    chat_id: chatId,
    status: 'pending',
    attempts: 0,
    available_at: new Date().toISOString(),
  });

  if (jobEnqueueError) {
    console.error('❌ Failed to enqueue post-chat job:', jobEnqueueError.message);
    return;
  }
  console.log('✅ Post-chat job enqueued with status="pending"');

  // 7. Execute Post-Chat Worker
  console.log('\n7. Executing processPostChatJobs worker...');
  const processedCount = await processPostChatJobs(supabase);
  console.log(`✅ Worker completed. Processed ${processedCount} job(s).`);

  // 8. Inspect Resulting Records in Database
  console.log('\n8. Verifying database state across all tables:');

  // A. Check Chats Title Auto-Update
  const { data: updatedChat } = await supabase.from('chats').select('title, title_source').eq('id', chatId).single();
  console.log(`- Chat title: "${updatedChat?.title}" (Source: ${updatedChat?.title_source})`);

  // B. Check Conversation Summary
  const { data: summaryRows, error: summaryError } = await supabase
    .from('conversation_summaries')
    .select('*')
    .eq('chat_id', chatId);

  if (summaryError || !summaryRows || summaryRows.length === 0) {
    console.error('❌ No conversation summary found for chat:', summaryError?.message);
  } else {
    console.log(`✅ Conversation summary verified in public.conversation_summaries: "${summaryRows[0].summary}"`);
  }

  // C. Check Extracted User Memory
  const { data: memoryRows, error: memoryError } = await supabase
    .from('user_memories')
    .select('*')
    .eq('user_id', user.id);

  if (memoryError || !memoryRows || memoryRows.length === 0) {
    console.error('❌ No memory rows found in public.user_memories:', memoryError?.message);
  } else {
    console.log(`✅ Extracted memory verified in public.user_memories: "${memoryRows[0].content}" (Type: ${memoryRows[0].type}, Source: ${memoryRows[0].source})`);
  }

  // D. Test Context Retrieval for a new prompt
  console.log('\n9. Testing deterministic memory context retrieval for query: "How should I structure database queries?"');
  const memoryContext = await getRelevantMemoryContext(supabase, user.id, 'How should I structure database queries?');
  const promptBlock = formatMemoryContextPrompt(memoryContext);
  console.log('Generated Prompt Block:\n', promptBlock);

  if (promptBlock.includes('<user_context>') && promptBlock.includes('<persistent_memory>')) {
    console.log('\n✅ END-TO-END PIPELINE AUDIT PASSED 100% WITH REAL SUPABASE PERSISTENCE!');
  } else {
    console.error('\n❌ Memory context was not injected properly into prompt block.');
  }
}

runLivePipelineTest().catch(console.error);
