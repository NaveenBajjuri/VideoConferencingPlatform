# Zoom Clone

A full stack video conferencing web application (React + Node/Express + Socket.IO + MongoDB).

This version includes the security, scalability, feature, and engineering-practice
enhancements from the project documentation, applied on top of the original app
without changing its core WebRTC calling behaviour.

## What's new in this version

**Security**
- JWT access + refresh token authentication (replacing the old opaque token), with
  an Express auth middleware protecting private routes
- Secrets moved out of source into `.env` files (see `.env.example` in each folder)
- `helmet`, `express-rate-limit` on auth routes, `express-validator` on all inputs
- CORS locked down to a configurable origin instead of allow-all

**Scalability**
- Chat history persisted to MongoDB (survives server restarts)
- Optional Redis adapter for Socket.IO so the backend can scale horizontally
  (`USE_REDIS=true` in `backend/.env`)
- Optional TURN server support for both frontend and backend (see `.env.example`s)
  and a `coturn` service in `docker-compose.yml`

**Features**
- Host controls: mute all, remove a participant, lock/unlock the meeting, waiting room
- Reactions and raise-hand
- Meeting scheduling with optional email invites (`backend/.env` SMTP settings)
- Local recording (MediaRecorder, downloads a `.webm` file)
- AI background blur (MediaPipe Selfie Segmentation)
- Paginated + searchable meeting history

**Engineering practices**
- Backend: Jest + Supertest test suite (`cd backend && npm test`)
- Frontend: React Testing Library tests (`cd frontend && npm test`)
- Dockerfiles for both apps + a root `docker-compose.yml` (mongo, redis, coturn,
  backend, frontend)
- GitHub Actions CI workflow (`.github/workflows/ci.yml`) running both test suites
  and the production build on every push/PR
- Winston structured logging on the backend
- Fixed pre-existing bugs: a broken `/home` route, a hardcoded prod/dev URL switch,
  and a Jest config issue that previously made `npm test` fail to run entirely on
  the frontend

**Media architecture**
- Calls are now relayed through a **mediasoup SFU** (Selective Forwarding Unit)
  instead of peer-to-peer mesh: each participant opens one send + one receive
  WebRTC connection to the backend, which fans media out to everyone else. This
  replaces the old design where every participant opened a direct
  `RTCPeerConnection` to every other participant (which stops scaling past ~4-5
  people). See `backend/src/sfu/` and `frontend/src/utils/sfuClient.js`.

**Not included** (deliberately out of scope - see note below)
- Full TypeScript rewrite

## Running locally

### 1. Backend
```bash
cd backend
cp .env.example .env   # then fill in MONGO_URI, JWT secrets, etc.
npm install
npm run dev             # http://localhost:8000
```

### 2. Frontend
```bash
cd frontend
cp .env.example .env    # REACT_APP_SERVER_URL=http://localhost:8000
npm install
npm start                # http://localhost:3000
```

### 3. Or with Docker Compose
```bash
cp backend/.env.example backend/.env   # fill in real values first
docker compose up --build
```

## Testing
```bash
cd backend && npm test
cd frontend && npm test
```

## Note on scope

The mediasoup SFU migration has been implemented (see "Media architecture" above)
and is covered by an integration test suite that exercises a real mediasoup
worker/router/transport over real Socket.IO connections
(`backend/tests/sfu.test.js`). The frontend build compiles cleanly against the
new client, but **actual two-browser call behavior has not been verified live**
(no real browser/camera/microphone is available in the environment this was
built in) - test it with two real browser tabs before relying on it in
production, particularly: camera/mic toggling, screen share, background blur
while on a call, and calls with 3+ participants.

One item from the project documentation - rewriting the entire codebase in
TypeScript - was **not** attempted. It's a substantial, multi-week effort across
every file in both frontend and backend, and doing it as an unverified automated
pass risked introducing subtle type/behavior mismatches throughout, which
conflicts with "don't damage existing functionality." Everything else from the
documentation has been implemented and is covered by passing tests and a clean
production build.

## Testing the mediasoup ports locally

If you're running the backend directly (not via Docker) and testing calls
between two machines/networks (not just two tabs on `localhost`), set
`MEDIASOUP_ANNOUNCED_IP` in `backend/.env` to a real, reachable IP for your
backend server - `127.0.0.1` (the default) only works when everyone connecting
is on the same machine as the backend.
