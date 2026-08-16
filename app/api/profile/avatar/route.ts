import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      console.error('[AVATAR_UPLOAD] Error: No file provided in form data.');
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // 1. MIME Validation
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.type)) {
      console.error('[AVATAR_UPLOAD] Validation failed: Invalid file type', file.type);
      return NextResponse.json({ error: 'Only JPEG, PNG, and WebP images are allowed.' }, { status: 400 });
    }

    // 2. File Size Validation (5MB max)
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE) {
      console.error('[AVATAR_UPLOAD] Validation failed: File size exceeds 5MB limit', file.size);
      return NextResponse.json({ error: 'File size exceeds 5MB limit.' }, { status: 400 });
    }

    // 3. Authenticate User
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[AVATAR_UPLOAD] Authentication error:', authError?.message || 'No active user session');
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    console.log('[AVATAR_UPLOAD] Authenticated User ID:', user.id);

    // 4. Prepare File Path & Upload to Storage 'avatars' Bucket
    const fileExt = file.name.split('.').pop() || 'png';
    const filePath = `${user.id}/avatar-${Date.now()}.${fileExt}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log('[AVATAR_UPLOAD] Uploading to bucket "avatars" path:', filePath);

    const { data: storageData, error: storageError } = await supabase.storage
      .from('avatars')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (storageError) {
      console.error('[AVATAR_UPLOAD] Supabase Storage upload error:', storageError);
      return NextResponse.json({ error: storageError.message }, { status: 500 });
    }

    console.log('[AVATAR_UPLOAD] Storage upload success:', storageData);

    // 5. Get Public URL
    const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
    const publicUrl = publicUrlData.publicUrl;

    console.log('[AVATAR_UPLOAD] Retrieved Public URL:', publicUrl);

    // 6. Update Profile Table avatar_url in Supabase Database
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .update({
        avatar_url: publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select();

    if (profileError) {
      console.error('[AVATAR_UPLOAD] Supabase Database profiles update error:', profileError);
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    console.log('[AVATAR_UPLOAD] Successfully updated profiles table in DB:', profileData);

    return NextResponse.json({
      success: true,
      avatarUrl: publicUrl,
      bucketPath: filePath,
      user: user.id,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown upload error';
    console.error('[AVATAR_UPLOAD] Exception:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    console.log('[AVATAR_DELETE] Clearing avatar for user:', user.id);

    // Update profiles table avatar_url to NULL
    const { error: dbError } = await supabase
      .from('profiles')
      .update({ avatar_url: null, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (dbError) {
      console.error('[AVATAR_DELETE] Database profile update error:', dbError);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown delete error';
    console.error('[AVATAR_DELETE] Exception:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
