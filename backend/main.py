import uuid
import random
import string
import os
from datetime import datetime
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session, joinedload

from auth import verify_password, get_password_hash, create_access_token, decode_access_token

from database import engine, get_db
import models
import schemas
from seed import seed

# Create tables and seed on startup
models.Base.metadata.create_all(bind=engine)
seed()

app = FastAPI(title="ZoomClone API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DEFAULT_USER_ID = "user-default-001"
BASE_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")


# ── WebRTC Signaling ─────────────────────────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        # Maps meeting_id to a dict of client_id -> WebSocket
        self.active_connections: dict[str, dict[str, WebSocket]] = {}

    async def connect(self, websocket: WebSocket, meeting_id: str, client_id: str):
        await websocket.accept()
        if meeting_id not in self.active_connections:
            self.active_connections[meeting_id] = {}
        self.active_connections[meeting_id][client_id] = websocket

    def disconnect(self, meeting_id: str, client_id: str):
        if meeting_id in self.active_connections:
            if client_id in self.active_connections[meeting_id]:
                del self.active_connections[meeting_id][client_id]
            if not self.active_connections[meeting_id]:
                del self.active_connections[meeting_id]

    async def broadcast(self, meeting_id: str, message: dict, exclude: str = None):
        if meeting_id in self.active_connections:
            for cid, ws in self.active_connections[meeting_id].items():
                if cid != exclude:
                    try:
                        await ws.send_json(message)
                    except:
                        pass

    async def send_personal_message(self, meeting_id: str, target_client_id: str, message: dict):
         if meeting_id in self.active_connections:
            if target_client_id in self.active_connections[meeting_id]:
                ws = self.active_connections[meeting_id][target_client_id]
                try:
                    await ws.send_json(message)
                except:
                    pass

manager = ConnectionManager()

# ── Helpers ────────────────────────────────────────────────────────────────────

def generate_meeting_code() -> str:
    """Generate unique 11-digit Zoom-style meeting code."""
    return ''.join(random.choices(string.digits, k=11))


def make_invite_link(meeting_code: str) -> str:
    return f"{BASE_URL}/join?code={meeting_code}"


def meeting_to_out(meeting: models.Meeting, db: Session) -> schemas.MeetingOut:
    count = db.query(models.Participant).filter(
        models.Participant.meeting_id == meeting.id,
        models.Participant.left_at == None
    ).count()
    out = schemas.MeetingOut.from_orm(meeting)
    out.participant_count = count
    out.invite_link = make_invite_link(meeting.meeting_code)
    return out


def meeting_to_list_out(meeting: models.Meeting, db: Session) -> schemas.MeetingListOut:
    count = db.query(models.Participant).filter(
        models.Participant.meeting_id == meeting.id,
    ).count()
    out = schemas.MeetingListOut.from_orm(meeting)
    out.participant_count = count
    out.invite_link = make_invite_link(meeting.meeting_code)
    return out


security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)) -> models.User:
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
        
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

def get_optional_current_user(credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer(auto_error=False)), db: Session = Depends(get_db)) -> Optional[models.User]:
    if not credentials:
        return None
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    return db.query(models.User).filter(models.User.id == user_id).first()

# ── Auth ───────────────────────────────────────────────────────────────────────

@app.post("/api/auth/register", response_model=schemas.UserOut)
def register(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email == user_in.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user = models.User(
        id=str(uuid.uuid4()),
        name=user_in.name,
        email=user_in.email,
        password_hash=get_password_hash(user_in.password)
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@app.post("/api/auth/login", response_model=schemas.Token)
def login(user_in: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == user_in.email).first()
    if not user or not user.password_hash or not verify_password(user_in.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    access_token = create_access_token(data={"sub": user.id})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/api/auth/google-sync", response_model=schemas.Token)
def google_sync(user_in: schemas.GoogleSync, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == user_in.email).first()
    if not user:
        # Create user if doesn't exist
        user = models.User(
            id=str(uuid.uuid4()),
            name=user_in.name,
            email=user_in.email,
            avatar_url=user_in.avatar_url
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
    access_token = create_access_token(data={"sub": user.id})
    return {"access_token": access_token, "token_type": "bearer"}

# ── User ───────────────────────────────────────────────────────────────────────

@app.get("/api/me", response_model=schemas.UserOut)
def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user


# ── Meetings ───────────────────────────────────────────────────────────────────

@app.get("/api/meetings", response_model=List[schemas.MeetingListOut])
def list_meetings(
    status: Optional[str] = Query(None),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List meetings for the current user."""
    query = db.query(models.Meeting).options(
        joinedload(models.Meeting.host)
    ).filter(models.Meeting.host_id == user.id)

    if status:
        query = query.filter(models.Meeting.status == status)

    meetings = query.order_by(models.Meeting.created_at.desc()).all()
    return [meeting_to_list_out(m, db) for m in meetings]


@app.get("/api/meetings/upcoming", response_model=List[schemas.MeetingListOut])
def upcoming_meetings(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    now = datetime.utcnow()
    meetings = db.query(models.Meeting).options(
        joinedload(models.Meeting.host)
    ).filter(
        models.Meeting.host_id == user.id,
        models.Meeting.status == models.MeetingStatus.scheduled,
        models.Meeting.scheduled_at >= now
    ).order_by(models.Meeting.scheduled_at.asc()).limit(10).all()
    return [meeting_to_list_out(m, db) for m in meetings]


@app.get("/api/meetings/recent", response_model=List[schemas.MeetingListOut])
def recent_meetings(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    meetings = db.query(models.Meeting).options(
        joinedload(models.Meeting.host)
    ).filter(
        models.Meeting.host_id == user.id,
        models.Meeting.status == models.MeetingStatus.ended
    ).order_by(models.Meeting.ended_at.desc()).limit(10).all()
    return [meeting_to_list_out(m, db) for m in meetings]


@app.post("/api/meetings", response_model=schemas.MeetingOut, status_code=201)
def create_meeting(payload: schemas.MeetingCreate, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Create a new meeting."""

    # Generate a unique meeting code
    while True:
        code = generate_meeting_code()
        if not db.query(models.Meeting).filter(models.Meeting.meeting_code == code).first():
            break

    meeting_id = str(uuid.uuid4())
    meeting = models.Meeting(
        id=meeting_id,
        meeting_code=code,
        title=payload.title or ("Instant Meeting" if payload.is_instant else "My Meeting"),
        description=payload.description,
        host_id=user.id,
        password=payload.password,
        status=models.MeetingStatus.active if payload.is_instant else models.MeetingStatus.scheduled,
        is_instant=payload.is_instant or False,
        scheduled_at=payload.scheduled_at,
        duration_minutes=payload.duration_minutes or 60,
        started_at=datetime.utcnow() if payload.is_instant else None,
        waiting_room_enabled=payload.waiting_room_enabled if payload.waiting_room_enabled is not None else True,
        mute_on_entry=payload.mute_on_entry if payload.mute_on_entry is not None else True,
        created_at=datetime.utcnow(),
    )
    db.add(meeting)
    db.flush()

    # Auto-add host as participant for instant meetings
    if payload.is_instant:
        host_participant = models.Participant(
            id=str(uuid.uuid4()),
            meeting_id=meeting.id,
            user_id=user.id,
            display_name=user.name,
            role=models.ParticipantRole.host,
            is_muted=False,
            is_video_on=True,
            joined_at=datetime.utcnow(),
        )
        db.add(host_participant)

    db.commit()
    db.refresh(meeting)

    return meeting_to_out(meeting, db)


@app.get("/api/meetings/{meeting_id}", response_model=schemas.MeetingOut)
def get_meeting(meeting_id: str, db: Session = Depends(get_db)):
    meeting = db.query(models.Meeting).options(
        joinedload(models.Meeting.host)
    ).filter(models.Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting_to_out(meeting, db)


@app.get("/api/meetings/code/{code}", response_model=schemas.MeetingOut)
def get_meeting_by_code(code: str, db: Session = Depends(get_db)):
    """Look up a meeting by its meeting code (for join flow)."""
    clean = code.replace(" ", "").replace("-", "")
    meeting = db.query(models.Meeting).options(
        joinedload(models.Meeting.host)
    ).filter(models.Meeting.meeting_code == clean).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting_to_out(meeting, db)


@app.post("/api/meetings/{meeting_id}/start", response_model=schemas.MeetingOut)
def start_meeting(meeting_id: str, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Start a scheduled meeting."""
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    if meeting.host_id != user.id:
        raise HTTPException(status_code=403, detail="Only host can start the meeting")
    meeting.status = models.MeetingStatus.active
    meeting.started_at = datetime.utcnow()

    # Add host as participant if not already there
    existing = db.query(models.Participant).filter(
        models.Participant.meeting_id == meeting_id,
        models.Participant.user_id == user.id,
        models.Participant.left_at == None
    ).first()
    if not existing:
        db.add(models.Participant(
            id=str(uuid.uuid4()),
            meeting_id=meeting_id,
            user_id=user.id,
            display_name=user.name,
            role=models.ParticipantRole.host,
            is_muted=False,
            is_video_on=True,
            joined_at=datetime.utcnow(),
        ))
    db.commit()
    db.refresh(meeting)
    return meeting_to_out(meeting, db)


@app.post("/api/meetings/{meeting_id}/end", response_model=schemas.MeetingOut)
def end_meeting(meeting_id: str, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """End a meeting."""
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    if meeting.host_id != user.id:
        raise HTTPException(status_code=403, detail="Only host can end the meeting")
    meeting.status = models.MeetingStatus.ended
    meeting.ended_at = datetime.utcnow()
    # Mark all active participants as left
    db.query(models.Participant).filter(
        models.Participant.meeting_id == meeting_id,
        models.Participant.left_at == None
    ).update({"left_at": datetime.utcnow()})
    db.commit()
    db.refresh(meeting)
    return meeting_to_out(meeting, db)


@app.delete("/api/meetings/{meeting_id}", response_model=schemas.MessageResponse)
def delete_meeting(meeting_id: str, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    if meeting.host_id != user.id:
        raise HTTPException(status_code=403, detail="Only host can delete the meeting")
    db.delete(meeting)
    db.commit()
    return {"message": "Meeting deleted successfully"}


# ── Participants ────────────────────────────────────────────────────────────────

@app.get("/api/meetings/{meeting_id}/participants", response_model=List[schemas.ParticipantOut])
def list_participants(meeting_id: str, db: Session = Depends(get_db)):
    participants = db.query(models.Participant).options(
        joinedload(models.Participant.user)
    ).filter(
        models.Participant.meeting_id == meeting_id,
        models.Participant.left_at == None
    ).all()
    return participants


@app.post("/api/meetings/join", response_model=schemas.JoinResponse)
def join_meeting(payload: schemas.JoinMeetingRequest, user: Optional[models.User] = Depends(get_optional_current_user), db: Session = Depends(get_db)):
    """Join a meeting by code."""
    clean_code = payload.meeting_code.replace(" ", "").replace("-", "")
    meeting = db.query(models.Meeting).options(
        joinedload(models.Meeting.host)
    ).filter(models.Meeting.meeting_code == clean_code).first()

    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found. Check the meeting ID and try again.")

    if meeting.status == models.MeetingStatus.ended:
        raise HTTPException(status_code=410, detail="This meeting has ended.")

    if meeting.password and meeting.password != payload.password:
        raise HTTPException(status_code=401, detail="Incorrect meeting password.")

    is_host = user and meeting.host_id == user.id

    # Start the meeting if it's scheduled and host is joining
    if meeting.status == models.MeetingStatus.scheduled and is_host:
        meeting.status = models.MeetingStatus.active
        meeting.started_at = datetime.utcnow()

    participant = models.Participant(
        id=str(uuid.uuid4()),
        meeting_id=meeting.id,
        user_id=user.id if user else None,
        display_name=payload.display_name,
        role=models.ParticipantRole.host if is_host else models.ParticipantRole.participant,
        is_muted=meeting.mute_on_entry,
        is_video_on=False,
        joined_at=datetime.utcnow(),
    )
    db.add(participant)
    db.commit()
    db.refresh(participant)
    db.refresh(meeting)

    return schemas.JoinResponse(
        participant=schemas.ParticipantOut.from_orm(participant),
        meeting=meeting_to_out(meeting, db)
    )


@app.patch("/api/participants/{participant_id}", response_model=schemas.ParticipantOut)
def update_participant(
    participant_id: str,
    payload: schemas.ParticipantUpdate,
    db: Session = Depends(get_db)
):
    p = db.query(models.Participant).filter(models.Participant.id == participant_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Participant not found")
    if payload.is_muted is not None:
        p.is_muted = payload.is_muted
    if payload.is_video_on is not None:
        p.is_video_on = payload.is_video_on
    if payload.is_hand_raised is not None:
        p.is_hand_raised = payload.is_hand_raised
    db.commit()
    db.refresh(p)
    return p


@app.delete("/api/participants/{participant_id}", response_model=schemas.MessageResponse)
def remove_participant(participant_id: str, db: Session = Depends(get_db)):
    p = db.query(models.Participant).filter(models.Participant.id == participant_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Participant not found")
    p.left_at = datetime.utcnow()
    db.commit()
    return {"message": "Participant removed"}


@app.post("/api/meetings/{meeting_id}/mute-all", response_model=schemas.MessageResponse)
def mute_all(meeting_id: str, db: Session = Depends(get_db)):
    db.query(models.Participant).filter(
        models.Participant.meeting_id == meeting_id,
        models.Participant.left_at == None,
        models.Participant.role == models.ParticipantRole.participant
    ).update({"is_muted": True})
    db.commit()
    return {"message": "All participants muted"}


# ── Health ─────────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "ZoomClone API running", "version": "1.0.0"}


# ── WebSockets ─────────────────────────────────────────────────────────────────
@app.websocket("/ws/meeting/{meeting_id}/{client_id}")
async def websocket_endpoint(websocket: WebSocket, meeting_id: str, client_id: str):
    await manager.connect(websocket, meeting_id, client_id)
    # Notify others that this client joined
    await manager.broadcast(meeting_id, {"type": "user-joined", "clientId": client_id}, exclude=client_id)
    # Tell the new client about all existing peers so it can initiate connections
    existing_peers = [cid for cid in manager.active_connections.get(meeting_id, {}).keys() if cid != client_id]
    if existing_peers:
        await websocket.send_json({"type": "existing-peers", "peerIds": existing_peers})
    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            
            if msg_type in ["offer", "answer", "ice-candidate"]:
                target_id = data.get("target")
                if target_id:
                    # Forward the signaling message to the target
                    await manager.send_personal_message(meeting_id, target_id, {
                        "type": msg_type,
                        "sender": client_id,
                        "payload": data.get("payload")
                    })

            elif msg_type == "chat-message":
                # Broadcast chat message to all other peers
                await manager.broadcast(meeting_id, {
                    "type": "chat-message",
                    "sender": client_id,
                    "payload": data.get("payload")
                }, exclude=client_id)

            elif msg_type == "media-state":
                # Broadcast media state change (mic/camera) to all other peers
                await manager.broadcast(meeting_id, {
                    "type": "media-state",
                    "sender": client_id,
                    "payload": data.get("payload")
                }, exclude=client_id)

            elif msg_type == "mute-all":
                # Host requested mute-all — broadcast force-mute to all other peers
                await manager.broadcast(meeting_id, {
                    "type": "force-mute",
                    "sender": client_id,
                }, exclude=client_id)

            elif msg_type == "screen-share-started":
                # Broadcast screen share start to all other peers
                await manager.broadcast(meeting_id, {
                    "type": "screen-share-started",
                    "sender": client_id,
                    "payload": data.get("payload")
                }, exclude=client_id)

            elif msg_type == "screen-share-stopped":
                # Broadcast screen share stop to all other peers
                await manager.broadcast(meeting_id, {
                    "type": "screen-share-stopped",
                    "sender": client_id,
                }, exclude=client_id)
    except WebSocketDisconnect:
        manager.disconnect(meeting_id, client_id)
        # Notify others that this client left
        await manager.broadcast(meeting_id, {"type": "user-left", "clientId": client_id})
