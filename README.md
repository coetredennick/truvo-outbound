# Truvo Outbound

Simple outbound calling. Import contacts, select, call, track results.

## Architecture

```
CSV Upload → Contacts DB → Select → Vapi Call → Webhook → Status Update
```

## Quick Start

### 1. Setup Supabase

1. Create project at [supabase.com](https://supabase.com)
2. Run `supabase-schema.sql` in SQL Editor
3. Get keys from Settings → API

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
VAPI_API_KEY=your-vapi-api-key
NEXT_PUBLIC_DEFAULT_ASSISTANT_ID=your-vapi-assistant-id
NEXT_PUBLIC_DEFAULT_PHONE_NUMBER_ID=your-vapi-phone-number-id
```

### 3. Run

```bash
npm install
npm run dev
```

### 4. Configure Vapi Webhook

Set webhook URL in Vapi Dashboard:
```
https://your-domain.com/api/webhooks/vapi
```

## Usage

1. **Import** - Upload CSV with contacts (phone required)
2. **Select** - Check contacts to call
3. **Call** - Click "Call Selected"
4. **Track** - Webhook updates status automatically

## Status Flow

| Status | Meaning |
|--------|---------|
| ready | Available to call |
| calling | Call in progress |
| answered | Human picked up |
| no_answer | No answer/voicemail/busy |
| exhausted | Max 2 attempts reached |

## Logged Data

- answered / no_answer
- call_count
- duration (seconds)
