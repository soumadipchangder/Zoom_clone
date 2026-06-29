'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Calendar, Clock, Users, Shield, Mic, Video, ChevronLeft, X } from 'lucide-react';
import { format, addHours, startOfHour } from 'date-fns';

function Navbar() {
  const router = useRouter();
  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-4 h-16 flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <Video className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-lg font-bold text-gray-900 tracking-tight">zoom</span>
        </div>
        <span className="text-gray-300">|</span>
        <h1 className="font-semibold text-gray-800">Schedule a Meeting</h1>
      </div>
    </nav>
  );
}

export default function SchedulePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Get next round hour as default
  const defaultTime = addHours(startOfHour(new Date()), 1);
  const defaultDateStr = format(defaultTime, "yyyy-MM-dd'T'HH:mm");

  const [form, setForm] = useState({
    title: '',
    description: '',
    date: defaultDateStr,
    duration: 60,
    password: '',
    waitingRoom: true,
    muteOnEntry: true,
    allowUnmute: true,
    video_host: true,
    video_participant: true,
  });

  const update = (key: string, value: any) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    if (!form.title.trim()) { setError('Meeting topic is required'); return; }
    if (!form.date) { setError('Date and time are required'); return; }

    setError('');
    setLoading(true);
    try {
      const meeting = await api.createMeeting({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        scheduled_at: new Date(form.date).toISOString(),
        duration_minutes: form.duration,
        password: form.password.trim() || undefined,
        waiting_room_enabled: form.waitingRoom,
        mute_on_entry: form.muteOnEntry,
        is_instant: false,
      });
      setSuccess(true);
      setTimeout(() => router.push('/'), 1500);
    } catch (e: any) {
      setError(e.message || 'Failed to schedule meeting');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Meeting Scheduled!</h2>
          <p className="text-gray-500 text-sm">Redirecting to dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <div className="zoom-card p-6">
              <h2 className="font-semibold text-gray-900 mb-5 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                Meeting Details
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="zoom-label">Topic <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    className="zoom-input"
                    placeholder="My Meeting"
                    value={form.title}
                    onChange={e => update('title', e.target.value)}
                  />
                </div>
                <div>
                  <label className="zoom-label">Description <span className="text-gray-400 font-normal">(optional)</span></label>
                  <textarea
                    className="zoom-input resize-none h-20"
                    placeholder="What's this meeting about?"
                    value={form.description}
                    onChange={e => update('description', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Date & Time */}
            <div className="zoom-card p-6">
              <h2 className="font-semibold text-gray-900 mb-5 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                When
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="zoom-label">Date & Time</label>
                  <input
                    type="datetime-local"
                    className="zoom-input"
                    value={form.date}
                    min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                    onChange={e => update('date', e.target.value)}
                  />
                </div>
                <div>
                  <label className="zoom-label">Duration</label>
                  <select
                    className="zoom-input"
                    value={form.duration}
                    onChange={e => update('duration', Number(e.target.value))}
                  >
                    {[15, 30, 45, 60, 90, 120, 180, 240].map(d => (
                      <option key={d} value={d}>
                        {d < 60 ? `${d} minutes` : `${d / 60} hour${d > 60 ? 's' : ''}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Security */}
            <div className="zoom-card p-6">
              <h2 className="font-semibold text-gray-900 mb-5 flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-600" />
                Security
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="zoom-label">Passcode <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input
                    type="text"
                    className="zoom-input max-w-xs"
                    placeholder="Leave blank for no passcode"
                    value={form.password}
                    onChange={e => update('password', e.target.value)}
                    maxLength={10}
                  />
                </div>

                <div className="space-y-3">
                  {[
                    { key: 'waitingRoom', label: 'Waiting Room', desc: 'Control when participants join' },
                  ].map(opt => (
                    <label key={opt.key} className="flex items-start gap-3 cursor-pointer">
                      <div className="relative mt-0.5">
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={(form as any)[opt.key]}
                          onChange={e => update(opt.key, e.target.checked)}
                        />
                        <div className={`w-10 h-5 rounded-full transition-colors ${(form as any)[opt.key] ? 'bg-blue-600' : 'bg-gray-200'}`}>
                          <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${(form as any)[opt.key] ? 'translate-x-5' : ''}`} />
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{opt.label}</div>
                        <div className="text-xs text-gray-500">{opt.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Video & Audio */}
            <div className="zoom-card p-6">
              <h2 className="font-semibold text-gray-900 mb-5 flex items-center gap-2">
                <Mic className="w-4 h-4 text-blue-600" />
                Audio & Video
              </h2>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Video</p>
                  <div className="grid grid-cols-2 gap-3">
                    {['Host', 'Participants'].map(who => (
                      <div key={who}>
                        <p className="text-xs text-gray-500 mb-1.5">{who}</p>
                        <div className="flex gap-3">
                          {['On', 'Off'].map(opt => (
                            <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                name={`video_${who}`}
                                className="w-4 h-4 accent-blue-600"
                                defaultChecked={opt === 'On'}
                              />
                              <span className="text-sm text-gray-700">{opt}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="pt-2 border-t border-gray-50">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <div className="relative mt-0.5">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={form.muteOnEntry}
                        onChange={e => update('muteOnEntry', e.target.checked)}
                      />
                      <div className={`w-10 h-5 rounded-full transition-colors ${form.muteOnEntry ? 'bg-blue-600' : 'bg-gray-200'}`}>
                        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.muteOnEntry ? 'translate-x-5' : ''}`} />
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">Mute participants on entry</div>
                      <div className="text-xs text-gray-500">Participants can unmute themselves</div>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => router.back()} className="zoom-btn-secondary px-8">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="zoom-btn-primary px-8 flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving…
                  </>
                ) : 'Save'}
              </button>
            </div>
          </div>

          {/* Preview sidebar */}
          <div className="space-y-4">
            <div className="zoom-card p-5 sticky top-24">
              <h3 className="font-semibold text-gray-900 text-sm mb-4">Meeting Preview</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Topic</p>
                  <p className="text-gray-900 font-medium">{form.title || 'My Meeting'}</p>
                </div>
                {form.date && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">When</p>
                    <p className="text-gray-700">
                      {format(new Date(form.date), 'EEEE, MMMM d, yyyy')}
                    </p>
                    <p className="text-gray-700">
                      {format(new Date(form.date), 'h:mm a')} ·{' '}
                      {form.duration < 60
                        ? `${form.duration} min`
                        : `${form.duration / 60}h`}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Security</p>
                  <div className="space-y-1">
                    {form.password && <p className="text-gray-700">🔒 Passcode enabled</p>}
                    {form.waitingRoom && <p className="text-gray-700">🚪 Waiting room on</p>}
                    {!form.password && !form.waitingRoom && <p className="text-gray-400">No security set</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
