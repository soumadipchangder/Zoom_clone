from pydantic import BaseModel, field_serializer
from typing import Optional, List
from datetime import datetime
from models import MeetingStatus, ParticipantRole


def _serialize_dt(v: datetime | None) -> str | None:
    """Serialize naive UTC datetimes with 'Z' suffix so JS interprets as UTC."""
    if v is None:
        return None
    return v.isoformat() + "Z"


# ── User ──────────────────────────────────────────────
class UserCreate(BaseModel):
    name: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class GoogleSync(BaseModel):
    email: str
    name: str
    avatar_url: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str

class UserOut(BaseModel):
    id: str
    name: str
    email: str
    avatar_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

    @field_serializer("created_at")
    @classmethod
    def serialize_dates(cls, v: datetime | None):
        return _serialize_dt(v)


# ── Meeting ───────────────────────────────────────────
class MeetingCreate(BaseModel):
    title: Optional[str] = "Instant Meeting"
    description: Optional[str] = None
    password: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    duration_minutes: Optional[int] = 60
    is_instant: Optional[bool] = False
    waiting_room_enabled: Optional[bool] = True
    mute_on_entry: Optional[bool] = True


class MeetingOut(BaseModel):
    id: str
    meeting_code: str
    title: str
    description: Optional[str] = None
    host_id: str
    status: MeetingStatus
    is_instant: bool
    scheduled_at: Optional[datetime] = None
    duration_minutes: int
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    created_at: datetime
    waiting_room_enabled: bool
    mute_on_entry: bool
    allow_participants_unmute: bool
    invite_link: Optional[str] = None
    host: Optional[UserOut] = None
    participant_count: Optional[int] = 0

    class Config:
        from_attributes = True

    @field_serializer("scheduled_at", "started_at", "ended_at", "created_at")
    @classmethod
    def serialize_dates(cls, v: datetime | None):
        return _serialize_dt(v)


class MeetingListOut(BaseModel):
    id: str
    meeting_code: str
    title: str
    status: MeetingStatus
    is_instant: bool
    scheduled_at: Optional[datetime] = None
    duration_minutes: int
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    created_at: datetime
    host: Optional[UserOut] = None
    participant_count: int = 0
    invite_link: Optional[str] = None

    class Config:
        from_attributes = True

    @field_serializer("scheduled_at", "started_at", "ended_at", "created_at")
    @classmethod
    def serialize_dates(cls, v: datetime | None):
        return _serialize_dt(v)


# ── Participant ───────────────────────────────────────
class JoinMeetingRequest(BaseModel):
    display_name: str
    meeting_code: str
    password: Optional[str] = None


class ParticipantOut(BaseModel):
    id: str
    meeting_id: str
    user_id: Optional[str] = None
    display_name: str
    role: ParticipantRole
    is_muted: bool
    is_video_on: bool
    is_hand_raised: bool
    joined_at: datetime
    left_at: Optional[datetime] = None
    user: Optional[UserOut] = None

    class Config:
        from_attributes = True

    @field_serializer("joined_at", "left_at")
    @classmethod
    def serialize_dates(cls, v: datetime | None):
        return _serialize_dt(v)


class ParticipantUpdate(BaseModel):
    is_muted: Optional[bool] = None
    is_video_on: Optional[bool] = None
    is_hand_raised: Optional[bool] = None


# ── Generic ───────────────────────────────────────────
class MessageResponse(BaseModel):
    message: str


class JoinResponse(BaseModel):
    participant: ParticipantOut
    meeting: MeetingOut
