"""Seed the database with sample data."""
import uuid
from datetime import datetime, timedelta
from database import SessionLocal, engine
from models import Base, User, Meeting, Participant, MeetingStatus, ParticipantRole
import random
import string


def generate_meeting_code():
    """Generate an 11-digit meeting code like Zoom (e.g., 812 3456 7890)."""
    digits = ''.join(random.choices(string.digits, k=11))
    return digits


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Check if already seeded
    if db.query(User).count() > 0:
        print("Database already seeded.")
        db.close()
        return

    # ── Default user (logged-in user) ─────────────────
    default_user = User(
        id="user-default-001",
        name="Soumyadip Changder",
        email="soumyadip@zoomclone.dev",
        avatar_url=None,
        created_at=datetime.utcnow()
    )

    guest1 = User(
        id="user-guest-001",
        name="Priya Sharma",
        email="priya@example.com",
        created_at=datetime.utcnow() - timedelta(days=10)
    )
    guest2 = User(
        id="user-guest-002",
        name="Arjun Mehta",
        email="arjun@example.com",
        created_at=datetime.utcnow() - timedelta(days=5)
    )
    guest3 = User(
        id="user-guest-003",
        name="Neha Kapoor",
        email="neha@example.com",
        created_at=datetime.utcnow() - timedelta(days=2)
    )

    db.add_all([default_user, guest1, guest2, guest3])
    db.flush()

    # ── Past meetings ──────────────────────────────────
    past1 = Meeting(
        id=str(uuid.uuid4()),
        meeting_code=generate_meeting_code(),
        title="Weekly Team Standup",
        description="Weekly sync with the engineering team",
        host_id=default_user.id,
        status=MeetingStatus.ended,
        is_instant=False,
        scheduled_at=datetime.utcnow() - timedelta(days=7, hours=2),
        duration_minutes=30,
        started_at=datetime.utcnow() - timedelta(days=7, hours=2),
        ended_at=datetime.utcnow() - timedelta(days=7, hours=1, minutes=32),
        created_at=datetime.utcnow() - timedelta(days=8),
        mute_on_entry=True,
        waiting_room_enabled=False,
    )
    past2 = Meeting(
        id=str(uuid.uuid4()),
        meeting_code=generate_meeting_code(),
        title="Project Kickoff – AI Dashboard",
        description="Initial planning session for the new AI analytics dashboard",
        host_id=default_user.id,
        status=MeetingStatus.ended,
        is_instant=False,
        scheduled_at=datetime.utcnow() - timedelta(days=3, hours=3),
        duration_minutes=60,
        started_at=datetime.utcnow() - timedelta(days=3, hours=3),
        ended_at=datetime.utcnow() - timedelta(days=3, hours=2),
        created_at=datetime.utcnow() - timedelta(days=4),
        mute_on_entry=False,
        waiting_room_enabled=True,
    )
    past3 = Meeting(
        id=str(uuid.uuid4()),
        meeting_code=generate_meeting_code(),
        title="Quick Sync",
        description=None,
        host_id=default_user.id,
        status=MeetingStatus.ended,
        is_instant=True,
        scheduled_at=None,
        duration_minutes=30,
        started_at=datetime.utcnow() - timedelta(days=1, hours=5),
        ended_at=datetime.utcnow() - timedelta(days=1, hours=4, minutes=45),
        created_at=datetime.utcnow() - timedelta(days=1, hours=5),
    )

    # ── Upcoming meetings ──────────────────────────────
    upcoming1 = Meeting(
        id=str(uuid.uuid4()),
        meeting_code=generate_meeting_code(),
        title="Product Review – Q3 Features",
        description="Review completed features and plan Q3 roadmap items",
        host_id=default_user.id,
        status=MeetingStatus.scheduled,
        is_instant=False,
        scheduled_at=datetime.utcnow() + timedelta(hours=3),
        duration_minutes=45,
        created_at=datetime.utcnow() - timedelta(hours=2),
        waiting_room_enabled=True,
        mute_on_entry=True,
    )
    upcoming2 = Meeting(
        id=str(uuid.uuid4()),
        meeting_code=generate_meeting_code(),
        title="1:1 with Manager",
        description="Monthly 1:1 check-in",
        host_id=default_user.id,
        status=MeetingStatus.scheduled,
        is_instant=False,
        scheduled_at=datetime.utcnow() + timedelta(days=1, hours=10),
        duration_minutes=30,
        created_at=datetime.utcnow() - timedelta(days=1),
        waiting_room_enabled=False,
        mute_on_entry=False,
    )
    upcoming3 = Meeting(
        id=str(uuid.uuid4()),
        meeting_code=generate_meeting_code(),
        title="All-Hands Meeting",
        description="Company-wide quarterly all-hands with leadership updates",
        host_id=default_user.id,
        status=MeetingStatus.scheduled,
        is_instant=False,
        scheduled_at=datetime.utcnow() + timedelta(days=3, hours=14),
        duration_minutes=90,
        created_at=datetime.utcnow() - timedelta(days=2),
        waiting_room_enabled=True,
        mute_on_entry=True,
    )

    db.add_all([past1, past2, past3, upcoming1, upcoming2, upcoming3])
    db.flush()

    # ── Participants for past meetings ─────────────────
    participants = [
        Participant(id=str(uuid.uuid4()), meeting_id=past1.id, user_id=default_user.id,
                    display_name=default_user.name, role=ParticipantRole.host,
                    is_muted=False, is_video_on=True, joined_at=past1.started_at, left_at=past1.ended_at),
        Participant(id=str(uuid.uuid4()), meeting_id=past1.id, user_id=guest1.id,
                    display_name=guest1.name, role=ParticipantRole.participant,
                    is_muted=True, is_video_on=True, joined_at=past1.started_at, left_at=past1.ended_at),
        Participant(id=str(uuid.uuid4()), meeting_id=past1.id, user_id=guest2.id,
                    display_name=guest2.name, role=ParticipantRole.participant,
                    is_muted=True, is_video_on=False, joined_at=past1.started_at, left_at=past1.ended_at),

        Participant(id=str(uuid.uuid4()), meeting_id=past2.id, user_id=default_user.id,
                    display_name=default_user.name, role=ParticipantRole.host,
                    is_muted=False, is_video_on=True, joined_at=past2.started_at, left_at=past2.ended_at),
        Participant(id=str(uuid.uuid4()), meeting_id=past2.id, user_id=guest3.id,
                    display_name=guest3.name, role=ParticipantRole.participant,
                    is_muted=True, is_video_on=True, joined_at=past2.started_at, left_at=past2.ended_at),

        Participant(id=str(uuid.uuid4()), meeting_id=past3.id, user_id=default_user.id,
                    display_name=default_user.name, role=ParticipantRole.host,
                    is_muted=False, is_video_on=False, joined_at=past3.started_at, left_at=past3.ended_at),
        Participant(id=str(uuid.uuid4()), meeting_id=past3.id, user_id=guest1.id,
                    display_name=guest1.name, role=ParticipantRole.participant,
                    is_muted=True, is_video_on=True, joined_at=past3.started_at, left_at=past3.ended_at),
    ]

    db.add_all(participants)
    db.commit()
    print("✅ Database seeded successfully!")
    db.close()


if __name__ == "__main__":
    seed()
