---
title: Zoom Clone
emoji: 🎥
colorFrom: blue
colorTo: indigo
sdk: docker
pinned: false
---

# ZoomClone — Video Conferencing Platform

A full-stack Zoom clone built with Next.js (frontend) and FastAPI + SQLite (backend), replicating Zoom's design, UX, and core meeting workflows.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS |
| Backend | Python 3.12, FastAPI, SQLAlchemy ORM |
| Database | SQLite (via SQLAlchemy) |
| Icons | Lucide React |
| Date handling | date-fns |

---

## 🗂 Project Structure

```
zoomclone/
├── backend/
│   ├── main.py          # FastAPI app, all API routes
│   ├── models.py        # SQLAlchemy database models
│   ├── schemas.py       # Pydantic request/response schemas
│   ├── database.py      # DB engine, session, Base
│   ├── seed.py          # Seed data (auto-runs on startup)
│   └── requirements.txt
├── frontend/
│   ├── app/
│   │   ├── page.tsx            # Dashboard (home)
│   │   ├── schedule/page.tsx   # Schedule a meeting
│   │   ├── join/page.tsx       # Join by meeting ID
│   │   └── meeting/[id]/page.tsx  # Meeting room
│   ├── lib/api.ts       # API client + helpers
│   ├── types/index.ts   # TypeScript types
│   └── .env.local       # API URL config
└── README.md
```

---

## 🗄 Database Schema

### `users`
| Column | Type | Description |
|---|---|---|
| id | String PK | UUID |
| name | String | Full name |
| email | String UNIQUE | Email address |
| avatar_url | String? | Profile picture URL |
| created_at | DateTime | Account creation time |

### `meetings`
| Column | Type | Description |
|---|---|---|
| id | String PK | UUID |
| meeting_code | String UNIQUE | 11-digit Zoom-style code |
| title | String | Meeting topic |
| description | Text? | Optional description |
| host_id | FK → users.id | Who created the meeting |
| password | String? | Optional passcode |
| status | Enum | scheduled / active / ended |
| is_instant | Boolean | Instant vs scheduled |
| scheduled_at | DateTime? | Planned start time |
| duration_minutes | Integer | Expected duration |
| started_at | DateTime? | Actual start |
| ended_at | DateTime? | Actual end |
| waiting_room_enabled | Boolean | Waiting room toggle |
| mute_on_entry | Boolean | Auto-mute participants |
| allow_participants_unmute | Boolean | Self-unmute permission |

### `participants`
| Column | Type | Description |
|---|---|---|
| id | String PK | UUID |
| meeting_id | FK → meetings.id | Which meeting |
| user_id | FK → users.id? | Null for guests |
| display_name | String | Name shown in meeting |
| role | Enum | host / participant |
| is_muted | Boolean | Current mute state |
| is_video_on | Boolean | Camera state |
| is_hand_raised | Boolean | Hand raise state |
| joined_at | DateTime | When joined |
| left_at | DateTime? | When left (null = active) |

---

## ✅ Features Implemented

### Core (Must Have)
- **Landing Dashboard** — Zoom-styled home with navbar, quick action buttons, upcoming & recent meetings sections
- **Instant Meeting** — One-click meeting creation with unique meeting code + invite link
- **Join Meeting** — Join by meeting ID or invite link (`/join?code=...`), with name entry + password support
- **Schedule Meetings** — Full scheduling form (topic, description, date/time, duration, passcode, waiting room, mute settings) with live preview sidebar
- **Upcoming Meetings** — Dashboard section showing future scheduled meetings
- **Recent Meetings** — Dashboard section showing completed meetings

### Bonus
- **Host Controls** — Mute/unmute individual participants, Mute All, Remove participant
- **Meeting Room** — Full Zoom-like dark room UI with:
  - Participant tiles with avatar colors
  - Mic/video state badges
  - Live timer
  - Participants panel with participant list
  - Chat panel with send messages
  - Meeting Info panel with invite link copy
  - Raise Hand toggle
  - Screen share toggle
  - Reactions button
- **Responsive design** — Works on mobile, tablet, and desktop
- **Copy invite link** — One-click copy from dashboard and meeting room

---

## 🚀 Setup & Run

### Prerequisites
- Python 3.10+
- Node.js 18+
- npm or yarn

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
python main.py
```

Or with uvicorn directly:
```bash
uvicorn main:app --reload --port 8000
```

The backend starts on `http://localhost:8000`. The SQLite database (`zoomclone.db`) is created automatically and seeded with sample data on first run.

**API docs:** `http://localhost:8000/docs`

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

The app starts on `http://localhost:3000`.

### 3. Environment

The frontend reads the API URL from `.env.local` (already configured for local development):

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

For deployment, update this to your backend URL.

---

## 🌐 Deployment

### Backend (Render / Railway)
1. Push the `backend/` folder to a repo
2. Set start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
3. Set `PYTHON_VERSION=3.12`

### Frontend (Vercel)
1. Push the `frontend/` folder to a repo
2. Set env variable: `NEXT_PUBLIC_API_URL=https://your-backend.onrender.com`
3. Deploy to Vercel

---

## 🔑 Assumptions

1. **No login required** — A default user (`Soumyadip Changder`) is pre-seeded and assumed to be always logged in (`user-default-001`).
2. **No real WebRTC** — The meeting room simulates video with avatar tiles (actual camera/mic integration requires WebRTC + signaling server, out of scope for this assignment). Mic/video toggle buttons control UI state only.
3. **Chat is local state** — Chat messages in the meeting room are not persisted (would need WebSocket server).
4. **Meeting codes** are 11 random digits, formatted as `XXX XXXX XXXX` (matching Zoom's format).
5. **SQLite** is used for simplicity; production would use PostgreSQL.

---

## 🧑‍💻 API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/me` | Get current user |
| GET | `/api/meetings` | List all meetings |
| GET | `/api/meetings/upcoming` | Upcoming scheduled meetings |
| GET | `/api/meetings/recent` | Recent ended meetings |
| POST | `/api/meetings` | Create a meeting |
| GET | `/api/meetings/{id}` | Get meeting by ID |
| GET | `/api/meetings/code/{code}` | Get meeting by code |
| POST | `/api/meetings/{id}/start` | Start a meeting |
| POST | `/api/meetings/{id}/end` | End a meeting |
| DELETE | `/api/meetings/{id}` | Delete a meeting |
| POST | `/api/meetings/join` | Join a meeting |
| POST | `/api/meetings/{id}/mute-all` | Mute all participants |
| GET | `/api/meetings/{id}/participants` | List active participants |
| PATCH | `/api/participants/{id}` | Update participant state |
| DELETE | `/api/participants/{id}` | Remove participant |
