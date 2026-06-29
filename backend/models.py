from sqlalchemy import Column, String, DateTime, Integer, Boolean, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
from database import Base
import enum
from datetime import datetime


class MeetingStatus(str, enum.Enum):
    scheduled = "scheduled"
    active = "active"
    ended = "ended"


class ParticipantRole(str, enum.Enum):
    host = "host"
    participant = "participant"


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    hosted_meetings = relationship("Meeting", back_populates="host", foreign_keys="Meeting.host_id")
    participations = relationship("Participant", back_populates="user")


class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(String, primary_key=True)          # UUID
    meeting_code = Column(String, unique=True, nullable=False)  # 11-digit code like Zoom
    title = Column(String, nullable=False, default="My Meeting")
    description = Column(Text, nullable=True)
    host_id = Column(String, ForeignKey("users.id"), nullable=False)
    password = Column(String, nullable=True)
    status = Column(Enum(MeetingStatus), default=MeetingStatus.scheduled)
    is_instant = Column(Boolean, default=False)

    scheduled_at = Column(DateTime, nullable=True)
    duration_minutes = Column(Integer, default=60)
    started_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Settings
    waiting_room_enabled = Column(Boolean, default=True)
    mute_on_entry = Column(Boolean, default=True)
    allow_participants_unmute = Column(Boolean, default=True)

    host = relationship("User", back_populates="hosted_meetings", foreign_keys=[host_id])
    participants = relationship("Participant", back_populates="meeting", cascade="all, delete-orphan")


class Participant(Base):
    __tablename__ = "participants"

    id = Column(String, primary_key=True)
    meeting_id = Column(String, ForeignKey("meetings.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)   # null = guest
    display_name = Column(String, nullable=False)
    role = Column(Enum(ParticipantRole), default=ParticipantRole.participant)
    is_muted = Column(Boolean, default=True)
    is_video_on = Column(Boolean, default=False)
    is_hand_raised = Column(Boolean, default=False)
    joined_at = Column(DateTime, default=datetime.utcnow)
    left_at = Column(DateTime, nullable=True)

    meeting = relationship("Meeting", back_populates="participants")
    user = relationship("User", back_populates="participations")
