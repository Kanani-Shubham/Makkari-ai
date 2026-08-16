import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuthenticatedUser } from '@/lib/auth/server-auth';
import { updateArtifactFileContent } from '@/lib/artifacts/artifact-service';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  try {
    const supabase = await createClient();
    const user = await requireAuthenticatedUser(supabase);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fileId } = await params;
    const body = await req.json();
    const { content } = body;

    if (content === undefined) {
      return NextResponse.json({ error: '"content" string is required' }, { status: 400 });
    }

    const updated = await updateArtifactFileContent(supabase, user.id, fileId, content);
    return NextResponse.json({ file: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error updating artifact file';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
