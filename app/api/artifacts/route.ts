import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuthenticatedUser } from '@/lib/auth/server-auth';
import { createConversationArtifact, listChatArtifacts } from '@/lib/artifacts/artifact-service';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await requireAuthenticatedUser(supabase);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const chatId = searchParams.get('chatId');
    if (!chatId) {
      return NextResponse.json({ error: 'chatId query param required' }, { status: 400 });
    }

    const artifacts = await listChatArtifacts(supabase, user.id, chatId);
    return NextResponse.json({ artifacts });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching artifacts';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await requireAuthenticatedUser(supabase);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { chatId, title, description, files, artifact_type } = body;

    if (!chatId || !title || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: 'chatId, title, and files array are required' }, { status: 400 });
    }

    const artifact = await createConversationArtifact(supabase, user.id, chatId, {
      title,
      description,
      artifact_type,
      files,
    });

    return NextResponse.json({ artifact }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error creating artifact';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
