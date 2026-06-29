'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api, getAvatarColor, getInitials, formatMeetingCode } from '@/lib/api';
import type { Meeting, Participant } from '@/types';
import {
  Mic, MicOff, Video, VideoOff, Monitor, MessageSquare,
  Users, MoreHorizontal, Phone, Shield, Hand, ChevronUp,
  Settings, Smile, Share2, Copy, Check, X, Volume2,
  Layout, Grid, Maximize2, Minimize2, Info, AlertCircle,
  MonitorOff
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useWebRTC } from '@/hooks/useWebRTC';
import type { WebRTCMessage } from '@/hooks/useWebRTC';
import { useSession } from 'next-auth/react';

// ── Media Toast ──────────────────────────────────────────────────────────
function MediaToast({ message, type = 'error', onClose }: {
  message: string;
  type?: 'error' | 'info' | 'success';
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  const colors = {
    error: 'bg-red-500/90 text-white',
    info: 'bg-gray-800/90 text-white',
    success: 'bg-green-500/90 text-white',
  };

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[100]" style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div className={`${colors[type]} px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 backdrop-blur-sm`}>
        {type === 'error' ? <AlertCircle className="w-4 h-4 flex-shrink-0" /> :
         type === 'success' ? <Check className="w-4 h-4 flex-shrink-0" /> :
         <Info className="w-4 h-4 flex-shrink-0" />}
        <span className="text-sm font-medium">{message}</span>
        <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Audio Level Indicator ────────────────────────────────────────────────
function AudioLevelIndicator({ stream }: { stream: MediaStream | null }) {
  const [level, setLevel] = useState(0);
  const animRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const contextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!stream || stream.getAudioTracks().length === 0) {
      setLevel(0);
      return;
    }

    const audioCtx = new AudioContext();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);
    contextRef.current = audioCtx;
    analyserRef.current = analyser;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      setLevel(Math.min(avg / 128, 1));
      animRef.current = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(animRef.current);
      source.disconnect();
      audioCtx.close();
    };
  }, [stream]);

  if (level < 0.01) return null;

  return (
    <div className="flex items-end gap-0.5 h-3">
      {[0, 1, 2, 3, 4].map(i => (
        <div
          key={i}
          className="w-0.5 rounded-full transition-all duration-75"
          style={{
            height: `${Math.max(20, Math.min(100, level * 100 * (1 + i * 0.3)))}%`,
            backgroundColor: level > 0.5 ? '#22c55e' : level > 0.2 ? '#4ade80' : '#86efac',
            opacity: i * 0.2 < level ? 1 : 0.3,
          }}
        />
      ))}
    </div>
  );
}

// ── Participant Tile ──────────────────────────────────────────────────────
function ParticipantTile({
  participant,
  isLarge,
  onMute,
  onRemove,
  isHost,
  videoStream,
  isLocal,
  audioStream,
}: {
  participant: Participant;
  isLarge?: boolean;
  onMute?: (id: string) => void;
  onRemove?: (id: string) => void;
  isHost?: boolean;
  videoStream?: MediaStream | null;
  isLocal?: boolean;
  audioStream?: MediaStream | null;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const color = getAvatarColor(participant.display_name);
  const initials = getInitials(participant.display_name);
  const avatarSize = isLarge ? 'w-24 h-24 text-4xl' : 'w-14 h-14 text-xl';

  // Attach video stream to video element
  useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream;
    } else if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [videoStream]);

  const hasVideo = videoStream && videoStream.getVideoTracks().length > 0 &&
    videoStream.getVideoTracks().some(t => t.enabled && t.readyState === 'live');

  return (
    <div
      className={`participant-tile aspect-video ${isLarge ? 'w-full' : 'w-full'} bg-gray-800 rounded-xl relative select-none group`}
      style={{ minHeight: isLarge ? 400 : 0 }}
    >
      {/* Video feed or avatar */}
      <div className="absolute inset-0 flex items-center justify-center">
        {hasVideo ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isLocal}
            className={`w-full h-full object-cover rounded-xl ${isLocal ? 'video-mirror' : ''}`}
          />
        ) : participant.is_video_on && !isLocal ? (
          <div
            className="w-full h-full rounded-xl flex items-center justify-center"
            style={{
              background: `radial-gradient(ellipse at 50% 30%, ${color}30, #111827 70%)`,
            }}
          >
            <div
              className={`${avatarSize} rounded-full flex items-center justify-center font-bold text-white`}
              style={{ backgroundColor: color }}
            >
              {initials}
            </div>
          </div>
        ) : (
          <div
            className={`${avatarSize} rounded-full flex items-center justify-center font-bold text-white`}
            style={{ backgroundColor: color }}
          >
            {initials}
          </div>
        )}
        {/* Hidden video element for when stream is not yet rendering */}
        {!hasVideo && videoStream && (
          <video ref={videoRef} autoPlay playsInline muted={isLocal} className="hidden" />
        )}
      </div>

      {/* Name tag */}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
        <span className="text-white text-xs font-medium bg-black/50 px-2 py-0.5 rounded-md backdrop-blur-sm max-w-32 truncate">
          {participant.display_name}
          {participant.role === 'host' && ' (Host)'}
          {isLocal && ' (You)'}
        </span>
        {participant.is_muted ? (
          <span className="bg-red-500/80 p-1 rounded-md">
            <MicOff className="w-3 h-3 text-white" />
          </span>
        ) : (
          <span className="bg-green-500/80 p-1 rounded-md flex items-center gap-1">
            <Mic className="w-3 h-3 text-white" />
            {isLocal && audioStream && <AudioLevelIndicator stream={audioStream} />}
          </span>
        )}
      </div>

      {/* Hand raised indicator */}
      {participant.is_hand_raised && (
        <div className="absolute top-2 right-2 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
          ✋ Raised
        </div>
      )}

      {/* Host control menu */}
      {isHost && participant.role !== 'host' && !isLocal && (
        <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="bg-black/40 hover:bg-black/60 rounded-md p-1.5 text-white transition-colors"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
            {showMenu && (
              <div className="absolute left-0 top-full mt-1 w-36 bg-white rounded-lg shadow-xl border border-gray-100 py-1 z-20">
                <button
                  onClick={() => { onMute?.(participant.id); setShowMenu(false); }}
                  className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  {participant.is_muted ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                  {participant.is_muted ? 'Ask to Unmute' : 'Mute'}
                </button>
                <button
                  onClick={() => { onRemove?.(participant.id); setShowMenu(false); }}
                  className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <X className="w-3.5 h-3.5" /> Remove
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Screen Share Tile ─────────────────────────────────────────────────────
function ScreenShareView({ stream, sharerName }: { stream: MediaStream; sharerName: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-black rounded-xl overflow-hidden relative">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-contain"
      />
      <div className="absolute top-3 left-3 bg-green-500/90 text-white text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-2 backdrop-blur-sm">
        <Monitor className="w-3.5 h-3.5" />
        {sharerName} is sharing their screen
      </div>
    </div>
  );
}

// ── Control Button ────────────────────────────────────────────────────────
function ControlBtn({
  icon,
  label,
  onClick,
  active = false,
  danger = false,
  badge,
  disabled = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  badge?: number;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl transition-all relative
        ${disabled ? 'opacity-40 cursor-not-allowed' :
          danger
          ? 'bg-red-500 hover:bg-red-600 text-white'
          : active
            ? 'text-white bg-white/20 hover:bg-white/30'
            : 'text-white/90 hover:bg-white/10 hover:text-white'
        }`}
    >
      <div className="relative">
        {icon}
        {badge && badge > 0 ? (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full text-white text-xs flex items-center justify-center font-bold">
            {badge > 9 ? '9+' : badge}
          </span>
        ) : null}
      </div>
      <span className="text-xs font-medium whitespace-nowrap">{label}</span>
    </button>
  );
}

// ── Participants Panel ────────────────────────────────────────────────────
function ParticipantsPanel({
  participants,
  onClose,
  onMute,
  onRemove,
  onMuteAll,
  isHost,
}: {
  participants: Participant[];
  onClose: () => void;
  onMute: (id: string) => void;
  onRemove: (id: string) => void;
  onMuteAll: () => void;
  isHost: boolean;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h3 className="font-semibold text-white">
          Participants ({participants.length})
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded">
          <X className="w-5 h-5" />
        </button>
      </div>

      {isHost && (
        <div className="px-4 py-3 border-b border-gray-700">
          <button
            onClick={onMuteAll}
            className="w-full text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-lg px-4 py-2 transition-colors"
          >
            Mute All
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {participants.map(p => (
          <div key={p.id} className="flex items-center justify-between group">
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ backgroundColor: getAvatarColor(p.display_name) }}
              >
                {getInitials(p.display_name)}
              </div>
              <div>
                <span className="text-sm text-white font-medium">
                  {p.display_name}
                  {p.role === 'host' && ' (Host)'}
                </span>
                {p.is_hand_raised && <span className="ml-1 text-yellow-400 text-xs">✋</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              {p.is_video_on
                ? <Video className="w-4 h-4 text-green-400" />
                : <VideoOff className="w-4 h-4" />}
              {p.is_muted
                ? <MicOff className="w-4 h-4 text-red-400" />
                : <Mic className="w-4 h-4 text-green-400" />}
              {isHost && p.role !== 'host' && (
                <button
                  onClick={() => onMute(p.id)}
                  className="opacity-0 group-hover:opacity-100 text-xs text-blue-400 hover:text-blue-300 transition-opacity ml-1"
                >
                  {p.is_muted ? 'Unmute' : 'Mute'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Info Panel ────────────────────────────────────────────────────────────
function InfoPanel({ meeting, onClose }: { meeting: Meeting; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/join?code=${meeting.meeting_code}`;

  const copy = () => {
    navigator.clipboard.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h3 className="font-semibold text-white">Meeting Info</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 p-4 space-y-5">
        <div>
          <p className="text-xs text-gray-400 mb-1">Meeting Topic</p>
          <p className="text-white font-medium text-sm">{meeting.title}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1">Meeting ID</p>
          <p className="text-white font-mono text-sm">{formatMeetingCode(meeting.meeting_code)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-2">Invite Link</p>
          <div className="bg-gray-700 rounded-lg p-3 flex items-center justify-between gap-2">
            <span className="text-xs text-gray-300 truncate">{link}</span>
            <button
              onClick={copy}
              className="flex-shrink-0 text-blue-400 hover:text-blue-300"
            >
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
        {meeting.started_at && (
          <div>
            <p className="text-xs text-gray-400 mb-1">Duration</p>
            <p className="text-white text-sm">
              {formatDistanceToNow(new Date(meeting.started_at))}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Chat Panel ────────────────────────────────────────────────────────────
interface ChatMessage { id: string; sender: string; text: string; time: Date; }

function ChatPanel({ onClose, currentUser, messages, onSend }: {
  onClose: () => void;
  currentUser: string;
  messages: ChatMessage[];
  onSend: (text: string) => void;
}) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = () => {
    if (!input.trim()) return;
    onSend(input.trim());
    setInput('');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h3 className="font-semibold text-white">Chat</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(msg => (
          <div key={msg.id} className={`flex flex-col ${msg.sender === currentUser ? 'items-end' : 'items-start'}`}>
            <span className="text-xs text-gray-400 mb-1">{msg.sender} · {format(msg.time, 'h:mm a')}</span>
            <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
              msg.sender === currentUser
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-white'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="p-3 border-t border-gray-700">
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 bg-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
            placeholder="Send a message to everyone…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
          />
          <button
            onClick={send}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition-colors text-sm"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Meeting Room ──────────────────────────────────────────────────────
export default function MeetingRoom() {
  const router = useRouter();
  const params = useParams();
  const meetingId = params.id as string;
  const { data: session } = useSession();

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Local media state
  const [micOn, setMicOn] = useState(false);
  const [videoOn, setVideoOn] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // Media streams
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);

  // Toast notifications for media errors
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'info' | 'success' } | null>(null);
  const showToast = (message: string, type: 'error' | 'info' | 'success' = 'info') => {
    setToast({ message, type });
  };

  // Panels
  const [panel, setPanel] = useState<'participants' | 'chat' | 'info' | null>(null);
  const [unreadChat, setUnreadChat] = useState(0);

  // Chat messages state (lifted from ChatPanel for WebSocket integration)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Remote screen share tracking
  const [remoteScreenSharer, setRemoteScreenSharer] = useState<{ peerId: string; displayName: string } | null>(null);

  // ── Load meeting data ───────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const [m, p] = await Promise.all([
        api.getMeeting(meetingId),
        api.getParticipants(meetingId),
      ]);
      // Start meeting if scheduled
      if (m.status === 'scheduled') {
        const started = await api.startMeeting(meetingId);
        setMeeting(started);
      } else {
        setMeeting(m);
      }
      setParticipants(p.length > 0 ? p : [
        { id: 'local', meeting_id: meetingId, display_name: 'Soumyadip Changder',
          role: 'host', is_muted: true, is_video_on: false, is_hand_raised: false,
          joined_at: new Date().toISOString() }
      ]);
    } catch (e: any) {
      setError(e.message || 'Could not load meeting');
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => { load(); }, [load]);

  const activeParticipants = participants.filter(p => !p.left_at);
  const localParticipant = activeParticipants.find(p => {
    if (session?.user?.id) {
       return p.user_id === session.user.id;
    }
    if (typeof window !== 'undefined') {
       const guestId = sessionStorage.getItem(`zoom_participant_${meetingId}`);
       if (guestId && p.id === guestId) return true;
    }
    return p.id === 'local';
  }) || activeParticipants[0];

  const isHost = meeting?.host_id === session?.user?.id || localParticipant?.role === 'host';

  // ── WebSocket message handler for chat, media state, mute-all, screen share ──
  const handleWebSocketMessage = useCallback((msg: WebRTCMessage) => {
    if (msg.type === 'chat-message' && msg.payload) {
      // Incoming chat message from a remote peer
      const senderParticipant = participants.find(p => p.id === msg.sender);
      setChatMessages(prev => [...prev, {
        id: Date.now().toString() + '_' + msg.sender,
        sender: senderParticipant?.display_name || msg.payload.senderName || 'Unknown',
        text: msg.payload.text,
        time: new Date(msg.payload.time || Date.now()),
      }]);
      // Increment unread count if chat panel is not open
      if (panel !== 'chat') {
        setUnreadChat(prev => prev + 1);
      }
    } else if (msg.type === 'media-state' && msg.payload) {
      // A remote peer updated their mic/camera state
      const peerId = msg.sender;
      setParticipants(prev => prev.map(p =>
        p.id === peerId
          ? {
              ...p,
              ...(msg.payload.is_muted !== undefined ? { is_muted: msg.payload.is_muted } : {}),
              ...(msg.payload.is_video_on !== undefined ? { is_video_on: msg.payload.is_video_on } : {}),
            }
          : p
      ));
    } else if (msg.type === 'force-mute') {
      // Host triggered mute-all — force-mute our local mic
      audioStream?.getAudioTracks().forEach(track => {
        track.enabled = false;
      });
      setMicOn(false);
      setParticipants(prev => prev.map(p =>
        p.id === localParticipant?.id ? { ...p, is_muted: true } : p
      ));
      showToast('You have been muted by the host', 'info');
    } else if (msg.type === 'screen-share-started' && msg.sender) {
      const senderParticipant = participants.find(p => p.id === msg.sender);
      setRemoteScreenSharer({
        peerId: msg.sender,
        displayName: senderParticipant?.display_name || msg.payload?.displayName || 'Someone',
      });
    } else if (msg.type === 'screen-share-stopped') {
      setRemoteScreenSharer(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participants, panel, audioStream, localParticipant?.id]);

  const { remoteStreams, remoteScreenStreams, sendMessage } = useWebRTC(
    meetingId,
    localParticipant?.id || 'local',
    audioStream,
    videoStream,
    screenStream,
    useCallback((type: 'joined' | 'left', peerId: string) => {
      if (type === 'joined' || type === 'left') {
        load();
      }
    }, [load]),
    handleWebSocketMessage
  );

  // ── Timer ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const formatElapsed = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  // ── Media Controls ──────────────────────────────────────────────────────

  // MICROPHONE
  const toggleMic = async () => {
    if (micOn) {
      // Mute: disable audio tracks
      audioStream?.getAudioTracks().forEach(track => {
        track.enabled = false;
      });
      setMicOn(false);
      showToast('Microphone muted', 'info');
    } else {
      // Unmute: enable existing tracks or request new stream
      if (audioStream && audioStream.getAudioTracks().length > 0) {
        audioStream.getAudioTracks().forEach(track => {
          track.enabled = true;
        });
        setMicOn(true);
        showToast('Microphone unmuted', 'success');
      } else {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          setAudioStream(stream);
          setMicOn(true);
          showToast('Microphone enabled', 'success');
        } catch (e: any) {
          console.error('Mic access denied:', e);
          if (e.name === 'NotAllowedError') {
            showToast('Microphone access denied. Please allow microphone in browser settings.', 'error');
          } else if (e.name === 'NotFoundError') {
            showToast('No microphone found. Please connect a microphone.', 'error');
          } else {
            showToast('Could not access microphone.', 'error');
          }
          return;
        }
      }
    }
    // Update local participant state
    const newMuted = micOn; // micOn was the *previous* value
    setParticipants(prev => prev.map(p =>
      (p.id === localParticipant?.id) ? { ...p, is_muted: newMuted } : p
    ));
    // Broadcast media state to all peers
    sendMessage({ type: 'media-state', payload: { is_muted: newMuted } });
    // Persist to backend
    if (localParticipant?.id && localParticipant.id !== 'local') {
      api.updateParticipant(localParticipant.id, { is_muted: newMuted }).catch(() => {});
    }
  };

  // CAMERA
  const toggleVideo = async () => {
    if (videoOn) {
      // Stop camera: stop all video tracks
      videoStream?.getVideoTracks().forEach(track => {
        track.stop();
      });
      setVideoStream(null);
      setVideoOn(false);
      showToast('Camera turned off', 'info');
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user',
          }
        });
        setVideoStream(stream);
        setVideoOn(true);
        showToast('Camera enabled', 'success');
      } catch (e: any) {
        console.error('Camera access denied:', e);
        if (e.name === 'NotAllowedError') {
          showToast('Camera access denied. Please allow camera in browser settings.', 'error');
        } else if (e.name === 'NotFoundError') {
          showToast('No camera found. Please connect a camera.', 'error');
        } else {
          showToast('Could not access camera.', 'error');
        }
        return;
      }
    }
    // Update local participant state
    const newVideoOn = !videoOn; // videoOn was the *previous* value
    setParticipants(prev => prev.map(p =>
      (p.id === localParticipant?.id) ? { ...p, is_video_on: newVideoOn } : p
    ));
    // Broadcast media state to all peers
    sendMessage({ type: 'media-state', payload: { is_video_on: newVideoOn } });
    // Persist to backend
    if (localParticipant?.id && localParticipant.id !== 'local') {
      api.updateParticipant(localParticipant.id, { is_video_on: newVideoOn }).catch(() => {});
    }
  };

  // SCREEN SHARE
  const toggleScreenShare = async () => {
    if (sharing) {
      // Stop sharing
      screenStream?.getTracks().forEach(track => track.stop());
      setScreenStream(null);
      setSharing(false);
      sendMessage({ type: 'screen-share-stopped' });
      showToast('Screen sharing stopped', 'info');
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' } as any,
          audio: true,
        });
        setScreenStream(stream);
        setSharing(true);
        sendMessage({
          type: 'screen-share-started',
          payload: { displayName: localParticipant?.display_name || 'Someone' }
        });
        showToast('Screen sharing started', 'success');

        // Listen for when user stops sharing via browser UI
        stream.getVideoTracks()[0].addEventListener('ended', () => {
          setScreenStream(null);
          setSharing(false);
          sendMessage({ type: 'screen-share-stopped' });
          showToast('Screen sharing stopped', 'info');
        });
      } catch (e: any) {
        console.error('Screen share denied:', e);
        if (e.name === 'NotAllowedError') {
          showToast('Screen sharing was cancelled.', 'info');
        } else {
          showToast('Could not start screen sharing.', 'error');
        }
      }
    }
  };

  // RAISE HAND
  const toggleHand = () => {
    setHandRaised(v => !v);
    setParticipants(prev => prev.map(p =>
      (p.id === localParticipant?.id) ? { ...p, is_hand_raised: !handRaised } : p
    ));
    showToast(handRaised ? 'Hand lowered' : 'Hand raised ✋', 'info');
  };

  const activeAudio = useRef<MediaStream | null>(null);
  const activeVideo = useRef<MediaStream | null>(null);
  const activeScreen = useRef<MediaStream | null>(null);

  useEffect(() => {
    activeAudio.current = audioStream;
    activeVideo.current = videoStream;
    activeScreen.current = screenStream;
  }, [audioStream, videoStream, screenStream]);

  useEffect(() => {
    return () => {
      activeAudio.current?.getTracks().forEach(track => track.stop());
      activeVideo.current?.getTracks().forEach(track => track.stop());
      activeScreen.current?.getTracks().forEach(track => track.stop());
    };
  }, []);

  // ── Participant actions ─────────────────────────────────────────────────
  const handleMuteParticipant = async (participantId: string) => {
    const p = participants.find(x => x.id === participantId);
    if (!p) return;
    try {
      await api.updateParticipant(participantId, { is_muted: !p.is_muted });
      setParticipants(prev => prev.map(x => x.id === participantId ? { ...x, is_muted: !x.is_muted } : x));
    } catch (e) { console.error(e); }
  };

  const handleRemoveParticipant = async (participantId: string) => {
    try {
      await api.removeParticipant(participantId);
      setParticipants(prev => prev.filter(x => x.id !== participantId));
    } catch (e) { console.error(e); }
  };

  const handleMuteAll = async () => {
    try {
      await api.muteAll(meetingId);
      setParticipants(prev => prev.map(p => p.role === 'participant' ? { ...p, is_muted: true } : p));
      // Broadcast force-mute to all peers via WebSocket
      sendMessage({ type: 'mute-all' });
      showToast('All participants muted', 'success');
    } catch (e) { console.error(e); }
  };

  const handleEndLeave = async () => {
    // Stop all local media
    audioStream?.getTracks().forEach(track => track.stop());
    videoStream?.getTracks().forEach(track => track.stop());
    screenStream?.getTracks().forEach(track => track.stop());

    if (isHost) {
      try { await api.endMeeting(meetingId); } catch (e) {}
    } else if (localParticipant?.id && localParticipant.id !== 'local') {
      try { await api.removeParticipant(localParticipant.id); } catch (e) {}
    }
    router.push('/');
  };

  const togglePanel = (name: typeof panel) => {
    setPanel(prev => prev === name ? null : name);
    if (name === 'chat') setUnreadChat(0);
  };

  // ── Loading / Error states ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Joining meeting…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-white text-xl font-bold mb-2">Can&apos;t join meeting</h2>
          <p className="text-gray-400 text-sm mb-6">{error}</p>
          <button onClick={() => router.push('/')} className="zoom-btn-primary">
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const gridCols = activeParticipants.length <= 1 ? 1 :
    activeParticipants.length <= 4 ? 2 : 3;

  return (
    <div className="h-screen bg-gray-900 flex flex-col overflow-hidden select-none">
      {/* Toast notifications */}
      {toast && (
        <MediaToast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-700/50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center">
            <Video className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <p className="text-white text-sm font-semibold truncate max-w-xs">{meeting?.title}</p>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-gray-400 text-xs">{formatElapsed(elapsed)}</span>
              {meeting?.meeting_code && (
                <>
                  <span className="text-gray-600 text-xs">·</span>
                  <span className="text-gray-400 text-xs font-mono">{formatMeetingCode(meeting.meeting_code)}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-gray-400 text-xs">
            <Users className="w-4 h-4" />
            <span>{activeParticipants.length}</span>
          </div>
          {meeting?.waiting_room_enabled && (
            <Shield className="w-4 h-4 text-green-400" aria-label="Waiting room enabled" />
          )}
          <button
            onClick={() => togglePanel('info')}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video grid area */}
        <div className="flex-1 flex flex-col p-4 overflow-hidden gap-3">
          {/* Screen share takes main view */}
          {/* Local screen share */}
          {sharing && screenStream && (
            <ScreenShareView
              stream={screenStream}
              sharerName="You"
            />
          )}
          {/* Remote screen share */}
          {!sharing && remoteScreenSharer && remoteScreenStreams[remoteScreenSharer.peerId] && (
            <ScreenShareView
              stream={remoteScreenStreams[remoteScreenSharer.peerId]}
              sharerName={remoteScreenSharer.displayName}
            />
          )}

          {/* Participant grid (becomes a strip when screen sharing) */}
          <div className={(sharing || remoteScreenSharer) ? 'flex gap-3 flex-shrink-0 h-32' : 'flex-1 flex flex-col'}>
            {activeParticipants.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="w-10 h-10 text-gray-500" />
                  </div>
                  <p className="text-gray-300 font-semibold">Waiting for others to join…</p>
                  <p className="text-gray-500 text-sm mt-1">Share the meeting link to invite participants</p>
                </div>
              </div>
            ) : sharing ? (
              // Horizontal strip when screen sharing
              activeParticipants.map(p => {
                const isLocal = p.id === localParticipant?.id;
                return (
                  <div key={p.id} className="group w-48 flex-shrink-0">
                    <ParticipantTile
                      participant={p}
                      isHost={isHost}
                      isLocal={isLocal}
                      videoStream={isLocal ? videoStream : remoteStreams[p.id]}
                      audioStream={isLocal ? audioStream : remoteStreams[p.id]}
                      onMute={handleMuteParticipant}
                      onRemove={handleRemoveParticipant}
                    />
                  </div>
                );
              })
            ) : activeParticipants.length === 1 ? (
              <div className="flex-1">
                <ParticipantTile
                  participant={activeParticipants[0]}
                  isLarge
                  isHost={isHost}
                  isLocal={activeParticipants[0].id === localParticipant?.id}
                  videoStream={activeParticipants[0].id === localParticipant?.id ? videoStream : remoteStreams[activeParticipants[0].id]}
                  audioStream={activeParticipants[0].id === localParticipant?.id ? audioStream : remoteStreams[activeParticipants[0].id]}
                  onMute={handleMuteParticipant}
                  onRemove={handleRemoveParticipant}
                />
              </div>
            ) : (
              <div
                className="flex-1 grid gap-3 content-center"
                style={{
                  gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
                }}
              >
                {activeParticipants.map(p => {
                  const isLocal = p.id === localParticipant?.id;
                  return (
                    <div key={p.id} className="group">
                      <ParticipantTile
                        participant={p}
                        isHost={isHost}
                        isLocal={isLocal}
                        videoStream={isLocal ? videoStream : remoteStreams[p.id]}
                        audioStream={isLocal ? audioStream : remoteStreams[p.id]}
                        onMute={handleMuteParticipant}
                        onRemove={handleRemoveParticipant}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Side panel */}
        {panel && (
          <div className="w-80 border-l border-gray-700 bg-gray-800 flex flex-col flex-shrink-0">
            {panel === 'participants' && (
              <ParticipantsPanel
                participants={activeParticipants}
                onClose={() => setPanel(null)}
                onMute={handleMuteParticipant}
                onRemove={handleRemoveParticipant}
                onMuteAll={handleMuteAll}
                isHost={isHost}
              />
            )}
            {panel === 'chat' && (
              <ChatPanel
                onClose={() => setPanel(null)}
                currentUser={localParticipant?.display_name || 'You'}
                messages={chatMessages}
                onSend={(text) => {
                  const newMsg: ChatMessage = {
                    id: Date.now().toString(),
                    sender: localParticipant?.display_name || 'You',
                    text,
                    time: new Date(),
                  };
                  setChatMessages(prev => [...prev, newMsg]);
                  sendMessage({
                    type: 'chat-message',
                    payload: {
                      text,
                      senderName: localParticipant?.display_name || 'You',
                      time: new Date().toISOString(),
                    },
                  });
                }}
              />
            )}
            {panel === 'info' && meeting && (
              <InfoPanel meeting={meeting} onClose={() => setPanel(null)} />
            )}
          </div>
        )}
      </div>

      {/* Controls bar */}
      <div className="bg-gray-900 border-t border-gray-700/50 flex-shrink-0">
        <div className="flex items-center justify-between px-6 py-3">
          {/* Left controls */}
          <div className="flex items-center gap-1">
            <ControlBtn
              icon={micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5 text-red-400" />}
              label={micOn ? 'Mute' : 'Unmute'}
              onClick={toggleMic}
              active={micOn}
            />
            <ControlBtn
              icon={videoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5 text-red-400" />}
              label={videoOn ? 'Stop Video' : 'Start Video'}
              onClick={toggleVideo}
              active={videoOn}
            />
          </div>

          {/* Center controls */}
          <div className="flex items-center gap-1">
            <ControlBtn
              icon={<Shield className="w-5 h-5" />}
              label="Security"
              onClick={() => showToast('Security settings are managed by the host', 'info')}
            />
            <ControlBtn
              icon={<Users className="w-5 h-5" />}
              label="Participants"
              onClick={() => togglePanel('participants')}
              active={panel === 'participants'}
              badge={activeParticipants.length}
            />
            <ControlBtn
              icon={<MessageSquare className="w-5 h-5" />}
              label="Chat"
              onClick={() => togglePanel('chat')}
              active={panel === 'chat'}
              badge={unreadChat}
            />
            <ControlBtn
              icon={sharing
                ? <MonitorOff className="w-5 h-5 text-green-400" />
                : <Monitor className="w-5 h-5" />
              }
              label={sharing ? 'Stop Share' : 'Share Screen'}
              onClick={toggleScreenShare}
              active={sharing}
            />
            <ControlBtn
              icon={<Hand className={`w-5 h-5 ${handRaised ? 'text-yellow-400' : ''}`} />}
              label={handRaised ? 'Lower Hand' : 'Raise Hand'}
              onClick={toggleHand}
              active={handRaised}
            />
            <ControlBtn
              icon={<Smile className="w-5 h-5" />}
              label="Reactions"
              onClick={() => showToast('Reactions — coming soon!', 'info')}
            />
            <ControlBtn
              icon={<MoreHorizontal className="w-5 h-5" />}
              label="More"
              onClick={() => showToast('More options — coming soon!', 'info')}
            />
          </div>

          {/* End/Leave */}
          <div>
            <button
              onClick={handleEndLeave}
              className="flex flex-col items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors"
            >
              <Phone className="w-5 h-5 rotate-[135deg]" />
              <span className="text-xs font-medium">{isHost ? 'End' : 'Leave'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
