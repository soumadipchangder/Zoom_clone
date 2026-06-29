import type { Meeting, User, Participant, JoinMeetingRequest, JoinResponse, CreateMeetingPayload } from '@/types';
import { getSession } from 'next-auth/react';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let token: string | undefined;
  if (typeof window !== 'undefined') {
      const session = await getSession();
      token = session?.accessToken;
  }
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options?.headers as any) };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(err.detail || 'Request failed');
  }
  return res.json();
}

export const api = {
  // User
  getMe: () => request<User>('/api/me'),

  // Meetings
  getMeetings: (status?: string) =>
    request<Meeting[]>(`/api/meetings${status ? `?status=${status}` : ''}`),
  getUpcoming: () => request<Meeting[]>('/api/meetings/upcoming'),
  getRecent: () => request<Meeting[]>('/api/meetings/recent'),
  getMeeting: (id: string) => request<Meeting>(`/api/meetings/${id}`),
  getMeetingByCode: (code: string) =>
    request<Meeting>(`/api/meetings/code/${encodeURIComponent(code)}`),
  createMeeting: (payload: CreateMeetingPayload) =>
    request<Meeting>('/api/meetings', { method: 'POST', body: JSON.stringify(payload) }),
  startMeeting: (id: string) =>
    request<Meeting>(`/api/meetings/${id}/start`, { method: 'POST' }),
  endMeeting: (id: string) =>
    request<Meeting>(`/api/meetings/${id}/end`, { method: 'POST' }),
  deleteMeeting: (id: string) =>
    request<{ message: string }>(`/api/meetings/${id}`, { method: 'DELETE' }),
  muteAll: (id: string) =>
    request<{ message: string }>(`/api/meetings/${id}/mute-all`, { method: 'POST' }),

  // Participants
  getParticipants: (meetingId: string) =>
    request<Participant[]>(`/api/meetings/${meetingId}/participants`),
  joinMeeting: (payload: JoinMeetingRequest) =>
    request<JoinResponse>('/api/meetings/join', { method: 'POST', body: JSON.stringify(payload) }),
  updateParticipant: (id: string, updates: Partial<Participant>) =>
    request<Participant>(`/api/participants/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),
  removeParticipant: (id: string) =>
    request<{ message: string }>(`/api/participants/${id}`, { method: 'DELETE' }),
};

// Format meeting code with spaces: 81234567890 -> 812 3456 7890
export function formatMeetingCode(code: string): string {
  const digits = code.replace(/\D/g, '');
  if (digits.length === 11) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`;
  }
  return code;
}

export function getAvatarColor(name: string): string {
  const colors = [
    '#0B5CFF', '#00A843', '#D73535', '#FF5400',
    '#7B2FBE', '#0097A7', '#E91E8C', '#795548',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}
