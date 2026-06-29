# ══════════════════════════════════════════════════════════════════════════
#  Zoom Clone — Monolith Docker Image
#  Runs on Hugging Face Spaces (port 7860)
#  Architecture: nginx (7860) → FastAPI (8000) + Next.js (3000)
# ══════════════════════════════════════════════════════════════════════════

# ─── Stage 1: Build Next.js frontend ──────────────────────────────────────
FROM node:20-slim AS frontend-builder

# These build args are set as "Space Variables" in HF Spaces settings
ARG NEXT_PUBLIC_API_URL
ARG NEXTAUTH_URL
ARG NEXTAUTH_SECRET

WORKDIR /build/frontend

# Install deps first (layer cached unless package.json changes)
COPY frontend/package*.json ./
RUN npm install

# Copy source and build
COPY frontend/ ./
RUN npm run build


# ─── Stage 2: Final runtime image ─────────────────────────────────────────
FROM python:3.11-slim

# Install Node.js (for Next.js standalone server), nginx, and supervisord
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl gnupg nginx supervisor \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# ── Python backend ──────────────────────────────────────────────────────
WORKDIR /app/backend
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./

# ── Next.js standalone bundle ───────────────────────────────────────────
WORKDIR /app/frontend

# standalone server.js + static assets
COPY --from=frontend-builder /build/frontend/.next/standalone/ ./
COPY --from=frontend-builder /build/frontend/.next/static/ ./.next/static/
COPY --from=frontend-builder /build/frontend/public/ ./public/

# ── nginx config ────────────────────────────────────────────────────────
COPY nginx.conf /etc/nginx/sites-available/default
RUN rm -f /etc/nginx/sites-enabled/default \
    && ln -s /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default

# ── supervisord config ──────────────────────────────────────────────────
COPY supervisord.conf /etc/supervisor/conf.d/app.conf

# HF Spaces uses port 7860
ENV PORT=7860
ENV NEXT_PORT=3000
ENV BACKEND_PORT=8000

# SQLite stored in /data (enable Persistent Storage in HF Space settings)
ENV DATABASE_URL=sqlite:////data/zoomclone.db

EXPOSE 7860

# supervisord starts nginx + uvicorn + Next.js
CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/conf.d/app.conf"]
