export type MeetingStatus = 'scheduled' | 'active' | 'ended';
export type ParticipantRole = 'host' | 'participant';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  created_at: string;
}

export interface Meeting {
  id: string;
  meeting_code: string;
  title: string;
  description?: string;
  host_id: string;
  status: MeetingStatus;
  is_instant: boolean;
  scheduled_at?: string;
  duration_minutes: number;
  started_at?: string;
  ended_at?: string;
  created_at: string;
  waiting_room_enabled: boolean;
  mute_on_entry: boolean;
  allow_participants_unmute: boolean;
  invite_link?: string;
  host?: User;
  participant_count: number;
}

export interface Participant {
  id: string;
  meeting_id: string;
  user_id?: string;
  display_name: string;
  role: ParticipantRole;
  is_muted: boolean;
  is_video_on: boolean;
  is_hand_raised: boolean;
  joined_at: string;
  left_at?: string;
  user?: User;
}

export interface JoinMeetingRequest {
  meeting_code: string;
  display_name: string;
  password?: string;
}

export interface JoinResponse {
  participant: Participant;
  meeting: Meeting;
}

export interface CreateMeetingPayload {
  title?: string;
  description?: string;
  password?: string;
  scheduled_at?: string;
  duration_minutes?: number;
  is_instant?: boolean;
  waiting_room_enabled?: boolean;
  mute_on_entry?: boolean;
}
