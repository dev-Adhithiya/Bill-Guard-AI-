# BillGuard AI 🛡️

> Silent financial watchdog that alerts you only when it matters.

## Vertical

**FinTech / Personal Finance Automation**

## Problem Statement

People subscribe to services, auto-pay bills, and forget about charges they no longer need. Price hikes go unnoticed, duplicate charges slip through, free trials auto-convert to paid subscriptions, and unused services keep draining money month after month.

**BillGuard AI** solves this by silently monitoring your Gmail for financial emails, using AI to extract structured data, detecting anomalies, and alerting you **only** when real action is needed — saving you money without demanding daily attention.

## How It Works

```
┌─────────────┐    ┌──────────────┐    ┌──────────────┐
│  Gmail API   │───▶│  AI Parser   │───▶│  Anomaly     │
│  (Scan)      │    │  (Gemini)    │    │  Engine      │
└─────────────┘    └──────────────┘    └──────┬───────┘
                                              │
                                              ▼
┌─────────────┐    ┌──────────────┐    ┌──────────────┐
│  Google      │◀──│  Bill        │◀──│  4 Detection  │
│  Sheets      │   │  Ledger      │    │  Checks      │
└─────────────┘    └──────────────┘    └──────┬───────┘
                                              │
                                              ▼
┌─────────────┐    ┌──────────────┐    ┌──────────────┐
│  Gmail API   │◀──│  Alert       │    │  Monthly PDF │
│  (Send)      │   │  Engine      │    │  → Drive     │
└─────────────┘    └──────────────┘    └──────────────┘
```

**Flow:**
1. **Scan** — Every 6 hours, fetch financial emails from Gmail
2. **Parse** — Gemini AI extracts merchant, amount, type, dates
3. **Store** — Structured data saved to Google Sheets (user-owned)
4. **Detect** — 4 anomaly checks: price hikes, duplicates, trial expiry, forgotten subs
5. **Alert** — Send email alerts only when action is needed
6. **Report** — Monthly PDF digest uploaded to Drive

## Google Services Used

| Service | Purpose |
|---------|---------|
| **Gmail API** (read) | Scan inbox for financial/billing emails |
| **Gmail API** (send) | Send alert and digest notification emails |
| **Gemini AI** | Extract structured bill data from emails |
| **Google Sheets** | Store bill ledger, processed IDs, alerts |
| **Google Drive** | Store monthly PDF digest reports |
| **Google Calendar** | Detect subscription usage (forgotten sub check) |
| **Google OAuth 2.0** | Secure authentication with minimal scopes |

## Setup & Installation

### Prerequisites
- Node.js 18+
- A Google Cloud project with OAuth 2.0 credentials
- Enabled APIs: Gmail, Sheets, Drive, Calendar, Generative Language (Gemini)

### Steps

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd billguard-ai
   ```

2. **Set up Google Cloud**
   - Create a project at [console.cloud.google.com](https://console.cloud.google.com)
   - Enable: Gmail API, Sheets API, Drive API, Calendar API
   - Create OAuth 2.0 credentials (Web application)
   - Add `http://localhost:5000/auth/callback` as authorized redirect URI
   - Get a Gemini API key from [aistudio.google.com](https://aistudio.google.com)

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Fill in your credentials in .env
   ```

4. **Install dependencies**
   ```bash
   cd server && npm install
   cd ../client && npm install
   ```

5. **Start the app**
   ```bash
   # Terminal 1 — Backend
   cd server && npm run dev

   # Terminal 2 — Frontend
   cd client && npm run dev
   ```

6. **Open** `http://localhost:5173` and sign in with Google

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GOOGLE_CLIENT_ID` | OAuth 2.0 client ID | ✅ |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 client secret | ✅ |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL | ✅ |
| `GEMINI_API_KEY` | Google Gemini API key | ✅ |
| `PORT` | Backend port (default: 5000) | ❌ |
| `CLIENT_URL` | Frontend URL (default: localhost:5173) | ❌ |
| `SESSION_SECRET` | Session encryption secret | ✅ |
| `ENCRYPTION_KEY` | 32-char AES-256 key for token storage | ✅ |
| `PRICE_HIKE_THRESHOLD` | % increase to trigger alert (default: 20) | ❌ |
| `DUPLICATE_WINDOW_HOURS` | Window for duplicate detection (default: 72) | ❌ |
| `UNUSED_SUB_DAYS` | Days before flagging unused sub (default: 60) | ❌ |
| `TRIAL_WARNING_HOURS` | Hours before trial expiry alert (default: 72) | ❌ |

## Running the App

```bash
# Development (both services)
cd server && npm run dev    # → http://localhost:5000
cd client && npm run dev    # → http://localhost:5173

# Production build
cd client && npm run build  # Output in client/dist/
cd server && npm start
```

## Architecture Overview

```
billguard-ai/
├── client/                     # React 18 + Vite frontend
│   ├── src/components/         # Dashboard, AlertFeed, BillLedger, etc.
│   ├── src/pages/              # Home, Login, Settings
│   └── src/index.css           # Full design system
├── server/                     # Express.js backend
│   ├── services/               # Gmail, Gemini, Sheets, Drive, Calendar
│   ├── routes/                 # Auth, Scan, Alerts, Digest
│   ├── middleware/             # Auth verification, rate limiting
│   ├── scheduler.js            # node-cron background jobs
│   └── tokenStore.js           # AES-256 encrypted token storage
└── .env.example                # Environment template
```

**Key Design Decisions:**
- **No database** — Bills stored in user's Google Sheets (transparent, portable)
- **No raw email storage** — Only extracted structured data is kept
- **Token encryption** — AES-256-CBC with file-based persistence
- **Minimal API calls** — Dedup by message ID, cache processed IDs

## Assumptions Made

1. Users have a Google Workspace or personal Gmail account
2. Financial emails contain identifiable keywords (invoice, receipt, etc.)
3. Gemini AI can extract structured data with ≥70% confidence
4. Users consent to read-only Gmail access and Sheets/Drive write access
5. Single-user deployment (no multi-tenant auth)
6. Token storage in encrypted file is acceptable for hackathon scope

## Future Improvements

- 🔐 Multi-user support with database-backed token storage
- 📱 Mobile app with push notifications
- 📊 Interactive charts and spending analytics
- 🏦 Bank API integration for transaction-level monitoring
- 🧠 ML-based spending pattern prediction
- 🌍 Multi-currency conversion and tracking
- 📋 Bill negotiation suggestions via AI
- 🔗 Webhook integrations (Slack, Discord, Telegram)
# BillGuard-AI-
