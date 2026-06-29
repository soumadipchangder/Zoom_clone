'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api, formatMeetingCode, getAvatarColor, getInitials } from '@/lib/api';
import type { Meeting, User } from '@/types';
import { useSession, signOut } from "next-auth/react";
import {
  Video, Users, Calendar, Clock, Plus, LogIn, ChevronRight,
  Copy, Trash2, Play, Settings, Bell, Grid, Search, MoreHorizontal,
  Check, Shield, Mic, Monitor, MessageSquare, Star, X, Info
} from 'lucide-react';
import { format, isToday, isTomorrow, formatDistanceToNow } from 'date-fns';

// ── Toast ──────────────────────────────────────────────────────────────────
function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed top-20 right-6 z-[100]" style={{ animation: 'slideIn 0.3s ease-out' }}>
      <div className="bg-gray-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 min-w-[260px]">
        <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />
        <span className="text-sm">{message}</span>
        <button onClick={onClose} className="ml-auto text-gray-400 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Navbar ─────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { label: 'Home', href: '/' },
  { label: 'Meetings', href: '/' },
  { label: 'Webinars', href: null },
  { label: 'Recordings', href: null },
  { label: 'Settings', href: null },
];

function Navbar({ user, activeTab, onToast }: { user: User | null; activeTab: string; onToast: (msg: string) => void }) {
  const router = useRouter();

  const handleNavClick = (item: typeof NAV_ITEMS[0]) => {
    if (item.href) {
      router.push(item.href);
    } else {
      onToast(`${item.label} — coming soon!`);
    }
  };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push('/')}>
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Video className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900 tracking-tight">zoom</span>
          </div>
          <div className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map(item => (
              <button
                key={item.label}
                onClick={() => handleNavClick(item)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  item.label === activeTab
                    ? 'text-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <Search className="w-5 h-5" />
          </button>
          <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-500 rounded-full" />
          </button>
          <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <Grid className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
            {user ? (
              <div className="relative group flex items-center gap-2 cursor-pointer">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ backgroundColor: getAvatarColor(user.name) }}
                >
                  {getInitials(user.name)}
                </div>
                <span className="text-sm font-medium text-gray-700 hidden sm:block">{user.name}</span>
                <ChevronRight className="w-4 h-4 text-gray-400" />

                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 opacity-0 group-hover:opacity-100 transition-opacity invisible group-hover:visible z-50">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
                  <button
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            ) : (
              <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

// ── Quick Action Card ──────────────────────────────────────────────────────
interface ActionCardProps {
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  color: string;
  bgColor: string;
  onClick: () => void;
}
function ActionCard({ icon, label, sublabel, color, bgColor, onClick }: ActionCardProps) {
  return (
    <button
      onClick={onClick}
      className="zoom-card flex flex-col items-start p-5 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 w-full text-left group"
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${bgColor} group-hover:scale-110 transition-transform`}>
        <div className={color}>{icon}</div>
      </div>
      <span className="font-semibold text-gray-900 text-sm">{label}</span>
      <span className="text-xs text-gray-500 mt-1">{sublabel}</span>
    </button>
  );
}

// ── Meeting Row ────────────────────────────────────────────────────────────
function MeetingRow({ meeting, onCopy, onDelete, onStart, isRecent }: {
  meeting: Meeting;
  onCopy: (code: string) => void;
  onDelete: (id: string) => void;
  onStart: (meeting: Meeting) => void;
  isRecent?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();

  const handleCopy = () => {
    onCopy(meeting.meeting_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const dateLabel = () => {
    const d = meeting.scheduled_at || meeting.started_at;
    if (!d) return isRecent ? 'Instant meeting' : '';
    const date = new Date(d);
    if (isToday(date)) return `Today, ${format(date, 'h:mm a')}`;
    if (isTomorrow(date)) return `Tomorrow, ${format(date, 'h:mm a')}`;
    return format(date, 'MMM d, h:mm a');
  };

  const statusBadge = () => {
    if (meeting.status === 'active') return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        Live
      </span>
    );
    if (meeting.status === 'ended') return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Ended</span>
    );
    return null;
  };

  return (
    <div className="flex items-center justify-between py-3.5 px-1 border-b border-gray-50 last:border-0 group hover:bg-gray-50 rounded-lg -mx-1 px-2 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${getAvatarColor(meeting.title)}20` }}
        >
          <Video className="w-4 h-4" style={{ color: getAvatarColor(meeting.title) }} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-gray-900 text-sm truncate">{meeting.title}</p>
            {statusBadge()}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-gray-500">{formatMeetingCode(meeting.meeting_code)}</span>
            {dateLabel() && (
              <>
                <span className="text-gray-300 text-xs">·</span>
                <span className="text-xs text-gray-500">{dateLabel()}</span>
              </>
            )}
            {meeting.duration_minutes && !isRecent && (
              <>
                <span className="text-gray-300 text-xs">·</span>
                <span className="text-xs text-gray-500">{meeting.duration_minutes} min</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {!isRecent && meeting.status !== 'ended' && (
          <button
            onClick={() => onStart(meeting)}
            className="text-xs font-medium text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
          >
            {meeting.status === 'active' ? 'Join' : 'Start'}
          </button>
        )}
        <button
          onClick={handleCopy}
          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          title="Copy invite link"
        >
          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
        </button>
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-10">
              <button
                onClick={() => { router.push(`/meeting/${meeting.id}`); setMenuOpen(false); }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <Video className="w-3.5 h-3.5" /> View Details
              </button>
              <button
                onClick={() => { handleCopy(); setMenuOpen(false); }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <Copy className="w-3.5 h-3.5" /> Copy Link
              </button>
              <div className="my-1 border-t border-gray-100" />
              <button
                onClick={() => { onDelete(meeting.id); setMenuOpen(false); }}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── New Meeting Modal ──────────────────────────────────────────────────────
function NewMeetingModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (meeting: Meeting) => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const start = async (withVideo: boolean) => {
    setLoading(true);
    try {
      const meeting = await api.createMeeting({ is_instant: true, title: 'Instant Meeting' });
      onCreate(meeting);
      router.push(`/meeting/${meeting.id}`);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Start a new meeting</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <button
            disabled={loading}
            onClick={() => start(true)}
            className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-blue-100 bg-blue-50 hover:border-blue-300 hover:bg-blue-100 transition-all text-left"
          >
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <Video className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-semibold text-gray-900 text-sm">Start with Video</div>
              <div className="text-xs text-gray-500 mt-0.5">Camera on by default</div>
            </div>
          </button>

          <button
            disabled={loading}
            onClick={() => start(false)}
            className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all text-left"
          >
            <div className="w-10 h-10 bg-gray-700 rounded-xl flex items-center justify-center flex-shrink-0">
              <Mic className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-semibold text-gray-900 text-sm">Start without Video</div>
              <div className="text-xs text-gray-500 mt-0.5">Audio-only mode</div>
            </div>
          </button>
        </div>

        {loading && (
          <div className="mt-4 text-center text-sm text-gray-500">Starting meeting…</div>
        )}
      </div>
    </div>
  );
}

// ── Join Modal ─────────────────────────────────────────────────────────────
function JoinModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [name, setName] = useState('Soumyadip Changder');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    if (!code.trim()) { setError('Please enter a meeting ID'); return; }
    if (!name.trim()) { setError('Please enter your name'); return; }
    setError(''); setLoading(true);
    try {
      const res = await api.joinMeeting({ meeting_code: code.trim(), display_name: name.trim() });
      sessionStorage.setItem(`zoom_participant_${res.meeting.id}`, res.participant.id);
      router.push(`/meeting/${res.meeting.id}`);
    } catch (e: any) {
      setError(e.message || 'Could not join meeting');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Join a Meeting</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="zoom-label">Meeting ID</label>
            <input
              type="text"
              className="zoom-input"
              placeholder="Enter Meeting ID"
              value={code}
              onChange={e => setCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
            />
          </div>
          <div>
            <label className="zoom-label">Your Name</label>
            <input
              type="text"
              className="zoom-input"
              placeholder="Enter your name"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="zoom-btn-secondary flex-1">Cancel</button>
          <button onClick={handleJoin} disabled={loading} className="zoom-btn-primary flex-1">
            {loading ? 'Joining…' : 'Join'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────
export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [upcoming, setUpcoming] = useState<Meeting[]>([]);
  const [recent, setRecent] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'new' | 'join' | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const loadData = useCallback(async () => {
    if (status !== 'authenticated') return;
    try {
      const [u, up, rec] = await Promise.all([
        api.getMe(),
        api.getUpcoming(),
        api.getRecent(),
      ]);
      setUser(u);
      setUpcoming(up);
      setRecent(rec);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { loadData(); }, [loadData]);

  if (status === 'loading') {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          </div>
        </div>
      );
  }

  const handleCopyLink = (code: string) => {
    const link = `${window.location.origin}/join?code=${code}`;
    navigator.clipboard.writeText(link).catch(() => {});
    setCopiedId(code);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteMeeting(id);
      setUpcoming(prev => prev.filter(m => m.id !== id));
      setRecent(prev => prev.filter(m => m.id !== id));
    } catch (e) { console.error(e); }
  };

  const handleStart = (meeting: Meeting) => {
    router.push(`/meeting/${meeting.id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.name.split(' ')[0] || '';

  return (
    <>
      <Navbar user={user} activeTab="Home" onToast={(msg) => setToastMsg(msg)} />
      {toastMsg && <Toast message={toastMsg} onClose={() => setToastMsg(null)} />}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Hero greeting */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{greeting}{firstName ? `, ${firstName}` : ''}!</h1>
          <p className="text-gray-500 text-sm mt-1">
            {format(now, 'EEEE, MMMM d')} · {format(now, 'h:mm a')}
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <ActionCard
            icon={<Video className="w-6 h-6" />}
            label="New Meeting"
            sublabel="Start an instant meeting"
            color="text-orange-500"
            bgColor="bg-orange-100"
            onClick={() => setModal('new')}
          />
          <ActionCard
            icon={<LogIn className="w-6 h-6" />}
            label="Join"
            sublabel="Join using a meeting ID"
            color="text-blue-600"
            bgColor="bg-blue-100"
            onClick={() => setModal('join')}
          />
          <ActionCard
            icon={<Calendar className="w-6 h-6" />}
            label="Schedule"
            sublabel="Plan a future meeting"
            color="text-blue-600"
            bgColor="bg-blue-100"
            onClick={() => router.push('/schedule')}
          />
          <ActionCard
            icon={<Monitor className="w-6 h-6" />}
            label="Share Screen"
            sublabel="Start a screen share"
            color="text-green-600"
            bgColor="bg-green-100"
            onClick={() => setModal('new')}
          />
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upcoming Meetings */}
          <div className="lg:col-span-2">
            <div className="zoom-card overflow-hidden">
              <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-50">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  Upcoming Meetings
                  {upcoming.length > 0 && (
                    <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                      {upcoming.length}
                    </span>
                  )}
                </h2>
                <button
                  onClick={() => router.push('/schedule')}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Schedule
                </button>
              </div>

              <div className="px-5 py-2">
                {upcoming.length === 0 ? (
                  <div className="py-10 text-center">
                    <Calendar className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm font-medium">No upcoming meetings</p>
                    <p className="text-gray-400 text-xs mt-1">Schedule one or start an instant meeting</p>
                    <button
                      onClick={() => router.push('/schedule')}
                      className="mt-4 text-sm text-blue-600 hover:underline"
                    >
                      Schedule a meeting →
                    </button>
                  </div>
                ) : (
                  upcoming.map(m => (
                    <MeetingRow
                      key={m.id}
                      meeting={m}
                      onCopy={handleCopyLink}
                      onDelete={handleDelete}
                      onStart={handleStart}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Recent Meetings */}
            <div className="zoom-card overflow-hidden mt-6">
              <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-50">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  Recent Meetings
                </h2>
              </div>
              <div className="px-5 py-2">
                {recent.length === 0 ? (
                  <div className="py-10 text-center">
                    <Clock className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">No recent meetings</p>
                  </div>
                ) : (
                  recent.map(m => (
                    <MeetingRow
                      key={m.id}
                      meeting={m}
                      onCopy={handleCopyLink}
                      onDelete={handleDelete}
                      onStart={handleStart}
                      isRecent
                    />
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Profile card */}
            <div className="zoom-card p-5">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: user ? getAvatarColor(user.name) : '#ccc' }}
                >
                  {user ? getInitials(user.name) : '?'}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{user?.name}</p>
                  <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between py-2 border-t border-gray-50">
                  <span className="text-gray-500">Meetings hosted</span>
                  <span className="font-semibold text-gray-900">{upcoming.length + recent.length}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-t border-gray-50">
                  <span className="text-gray-500">Plan</span>
                  <span className="text-blue-600 font-medium text-xs bg-blue-50 px-2 py-0.5 rounded-full">Pro</span>
                </div>
              </div>
            </div>

            {/* Tips */}
            <div className="zoom-card p-5">
              <h3 className="font-semibold text-gray-900 text-sm mb-4 flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-400" />
                Quick Tips
              </h3>
              <div className="space-y-3">
                {[
                  { icon: <Shield className="w-4 h-4 text-green-500" />, text: 'Enable waiting rooms for extra security' },
                  { icon: <Mic className="w-4 h-4 text-blue-500" />, text: 'Mute on entry reduces background noise' },
                  { icon: <Users className="w-4 h-4 text-purple-500" />, text: 'Share your invite link before the meeting' },
                ].map((tip, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="mt-0.5 flex-shrink-0">{tip.icon}</div>
                    <p className="text-xs text-gray-600 leading-relaxed">{tip.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Next upcoming highlight */}
            {upcoming[0] && (
              <div className="zoom-card p-5 bg-gradient-to-br from-blue-600 to-blue-700 text-white">
                <p className="text-xs font-medium text-blue-200 mb-1">Next meeting</p>
                <p className="font-semibold text-sm mb-1 truncate">{upcoming[0].title}</p>
                <p className="text-xs text-blue-200 mb-4">
                  {upcoming[0].scheduled_at
                    ? formatDistanceToNow(new Date(upcoming[0].scheduled_at), { addSuffix: true })
                    : 'Now'}
                </p>
                <button
                  onClick={() => handleStart(upcoming[0])}
                  className="w-full bg-white text-blue-600 font-medium text-sm py-2 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  Start Meeting
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modals */}
      {modal === 'new' && (
        <NewMeetingModal
          onClose={() => setModal(null)}
          onCreate={() => loadData()}
        />
      )}
      {modal === 'join' && (
        <JoinModal onClose={() => setModal(null)} />
      )}
    </>
  );
}
