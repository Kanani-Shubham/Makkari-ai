'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MakkariLogo } from '@/components/brand/makkari-logo';
import { GithubIcon } from '@/components/icons/github';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const supabase = createClient();
      const { error: authErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (authErr) {
        setError(authErr.message);
      } else {
        setSuccessMsg('Account created! Please check your email for verification.');
        setTimeout(() => router.push('/'), 2000);
      }
    } catch {
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'github') => {
    try {
      const supabase = createClient();
      await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
    } catch {
      router.push('/');
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F6F3] dark:bg-[#121212] flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <MakkariLogo variant="full" size="xl" />
        </div>

        <Card className="space-y-4">
          {error && <div className="p-3 text-xs bg-[#C94B4B]/10 text-[#C94B4B] rounded-xl">{error}</div>}
          {successMsg && (
            <div className="p-3 text-xs bg-emerald-100 text-emerald-700 rounded-xl">{successMsg}</div>
          )}

          {/* Social OAuth Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleSocialLogin('google')}
              className="flex items-center justify-center gap-2 py-2 px-3 border border-[#E8E5E0] dark:border-[#2E2E2E] bg-white dark:bg-[#242424] rounded-xl text-xs font-medium text-[#1A1A1A] dark:text-[#E5E5E5] hover:bg-[#F7F6F3] dark:hover:bg-[#181818] transition-colors cursor-pointer"
            >
              <span>Google</span>
            </button>
            <button
              onClick={() => handleSocialLogin('github')}
              className="flex items-center justify-center gap-2 py-2 px-3 border border-[#E8E5E0] dark:border-[#2E2E2E] bg-white dark:bg-[#242424] rounded-xl text-xs font-medium text-[#1A1A1A] dark:text-[#E5E5E5] hover:bg-[#F7F6F3] dark:hover:bg-[#181818] transition-colors cursor-pointer"
            >
              <GithubIcon className="w-4 h-4" />
              <span>GitHub</span>
            </button>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-[#E8E5E0] dark:border-[#2E2E2E] w-full" />
            <span className="relative px-3 bg-white dark:bg-[#1E1E1E] text-[11px] text-[#6B6B6B] dark:text-[#9E9E9E] uppercase font-medium">
              or with email
            </span>
          </div>

          <form onSubmit={handleSignup} className="space-y-3">
            <Input
              label="Full Name"
              placeholder="Your Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />

            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Button variant="primary" className="w-full" type="submit" disabled={loading}>
              {loading ? 'Creating Account...' : 'Sign Up'}
            </Button>
          </form>
        </Card>

        <p className="text-center text-xs text-[#6B6B6B] dark:text-[#9E9E9E]">
          Already have an account?{' '}
          <Link href="/login" className="text-[#D97757] font-semibold hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
