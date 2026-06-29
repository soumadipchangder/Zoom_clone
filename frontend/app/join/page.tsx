'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Video, X } from 'lucide-react';

function JoinForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState(params.get('code') || '');
  const [name, setName] = useState('Soumyadip Changder');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(false);

  const handleJoin = async () => {
    if (!code.trim()) { setError('Please enter a Meeting ID'); return; }
    if (!name.trim()) { setError('Please enter your name'); return; }
    setError(''); setLoading(true);
    try {
      const res = await api.joinMeeting({
        meeting_code: code.trim(),
        display_name: name.trim(),
        password: password || undefined,
      });
      sessionStorage.setItem(`zoom_participant_${res.meeting.id}`, res.participant.id);
      router.push(`/meeting/${res.meeting.id}`);
    } catch (e: any) {
      if (e.message?.includes('password') || e.message?.includes('Incorrect')) {
        setNeedsPassword(true);
        setError(e.message);
      } else {
        setError(e.message || 'Could not join meeting');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
            <Video className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-bold text-gray-900 tracking-tight">zoom</span>
        </div>

        <div className="zoom-card p-7">
          <h1 className="text-xl font-bold text-gray-900 text-center mb-1">Join a Meeting</h1>
          <p className="text-sm text-gray-500 text-center mb-6">Enter a meeting ID provided by the host</p>

          <div className="space-y-4">
            <div>
              <label className="zoom-label">Meeting ID</label>
              <input
                type="text"
                className="zoom-input text-center text-lg tracking-widest font-mono"
                placeholder="000 0000 0000"
                value={code}
                onChange={e => setCode(e.target.value.replace(/[^\d\s-]/g, ''))}
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
              />
            </div>
            <div>
              <label className="zoom-label">Your Name</label>
              <input
                type="text"
                className="zoom-input"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
              />
            </div>
            {needsPassword && (
              <div>
                <label className="zoom-label">Meeting Passcode</label>
                <input
                  type="password"
                  className="zoom-input"
                  placeholder="Enter meeting passcode"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleJoin()}
                  autoFocus
                />
              </div>
            )}
            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg text-center">{error}</p>
            )}
          </div>

          <button
            onClick={handleJoin}
            disabled={loading}
            className="zoom-btn-primary w-full mt-6 py-3 text-base"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Joining…
              </span>
            ) : 'Join'}
          </button>

          <button
            onClick={() => router.push('/')}
            className="w-full mt-3 text-sm text-gray-500 hover:text-gray-700 py-2"
          >
            Cancel
          </button>
        </div>

        <p className="text-xs text-gray-400 text-center mt-6">
          By joining a meeting, you agree to our Terms of Service
        </p>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>}>
      <JoinForm />
    </Suspense>
  );
}
