'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Zap } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const supabase = createClient();
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });
      setMessage('If an account exists, a password reset link has been sent to your email.');
    } catch {
      setMessage('Password reset request submitted.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F6F3] flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#D97757] text-white shadow-sm mb-2">
            <Zap className="w-6 h-6 fill-white" />
          </div>
          <h1 className="text-2xl font-serif font-bold text-[#1A1A1A]">Reset your password</h1>
          <p className="text-xs text-[#6B6B6B]">Enter your email to receive a password reset link.</p>
        </div>

        <Card className="space-y-4">
          {message && <div className="p-3 text-xs bg-emerald-100 text-emerald-800 rounded-xl">{message}</div>}

          <form onSubmit={handleReset} className="space-y-3">
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Button variant="primary" className="w-full" type="submit" disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </Button>
          </form>
        </Card>

        <p className="text-center text-xs text-[#6B6B6B]">
          Remember your password?{' '}
          <Link href="/login" className="text-[#D97757] font-semibold hover:underline">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
