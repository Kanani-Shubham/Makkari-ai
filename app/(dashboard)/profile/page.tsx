'use client';

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store/use-auth-store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';
import { Camera, Check, LogOut, Loader2, Trash2, AlertCircle } from 'lucide-react';

export default function ProfilePage() {
  const { user, updateProfile, logout } = useAuthStore();

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setUsername(user.username || '');
      setAvatarUrl(user.avatar_url || '');
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({
      full_name: fullName,
      username: username,
      avatar_url: avatarUrl,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError('');

    try {
      console.log('[PROFILE_UI] Uploading avatar image file:', file.name, file.size, file.type);
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/profile/avatar', {
        method: 'POST',
        body: formData,
      });

      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        if (data.success && data.avatarUrl) {
          console.log('[PROFILE_UI] Avatar uploaded successfully to Supabase Storage:', data.avatarUrl);
          setAvatarUrl(data.avatarUrl);
          updateProfile({ avatar_url: data.avatarUrl });
          setSavedSuccess(true);
          setTimeout(() => setSavedSuccess(false), 3000);
          return;
        }
        setUploadError(data.error || 'Failed to upload avatar to Supabase Storage.');
      } else {
        setUploadError('Failed to upload avatar. Server returned unexpected response.');
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Error uploading avatar.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      console.log('[PROFILE_UI] Removing avatar...');
      const res = await fetch('/api/profile/avatar', { method: 'DELETE' });
      if (res.ok) {
        setAvatarUrl('');
        updateProfile({ avatar_url: '' });
      }
    } catch (err) {
      console.error('[PROFILE_UI] Error removing avatar:', err);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-serif font-bold text-[#1A1A1A]">User Profile</h1>
        <p className="text-xs text-[#6B6B6B] mt-1">Manage your account details, avatar, and preferred identity.</p>
      </div>

      <Card className="space-y-6">
        {/* Avatar Upload Header */}
        <div className="flex items-center gap-6 pb-6 border-b border-[#E8E5E0]">
          <div className="relative group">
            <Avatar src={avatarUrl} name={fullName} size="xl" />
            <label className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
              {isUploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Camera className="w-5 h-5" />
              )}
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handleAvatarUpload}
                disabled={isUploading}
                className="hidden"
              />
            </label>
          </div>

          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-[#1A1A1A]">{fullName}</h2>
            <p className="text-xs text-[#6B6B6B]">@{username} • Free Plan</p>
            <div className="flex items-center gap-3 pt-1">
              <label className="text-xs text-[#D97757] font-semibold hover:underline cursor-pointer">
                {isUploading ? 'Uploading to Supabase Storage...' : 'Upload Image'}
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handleAvatarUpload}
                  disabled={isUploading}
                  className="hidden"
                />
              </label>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="text-xs text-[#C94B4B] hover:underline flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Remove</span>
                </button>
              )}
            </div>
            <span className="text-[10px] text-[#9E9E9E] block">Max file size 5MB (JPG, PNG, WebP)</span>
          </div>
        </div>

        {uploadError && (
          <div className="p-3 bg-[#C94B4B]/10 text-[#C94B4B] text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}

        {/* Profile Edit Form */}
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your full name"
          />

          <Input
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="your_username"
          />

          <Input
            label="Email Address"
            value={user?.email || 'No email associated'}
            disabled
            className="bg-[#F7F6F3] text-[#6B6B6B]"
          />

          <div className="flex items-center justify-between pt-4">
            <Button variant="danger" size="sm" type="button" onClick={logout}>
              <LogOut className="w-3.5 h-3.5" />
              <span>Log out</span>
            </Button>

            <Button variant="primary" type="submit">
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>Saved!</span>
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
