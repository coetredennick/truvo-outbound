# Truvo Outbound

AI-powered outbound calling platform. Import CSVs, queue leads, fire Vapi calls automatically.

## Architecture

```
CSV Upload → Supabase DB → Queue Processor → Vapi API → Phone Calls
```

## Quick Start

### 1. Setup Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor
3. Run the contents of `supabase-schema.sql`
4. Get your keys from Settings → API

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
```

### 3. Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Start Queue Processor

In a separate terminal:

```bash
npm run queue
```

This runs continuously and fires calls for active campaigns.

## Usage

### Create a Campaign

1. Click "+ New Campaign"
2. Name it
3. Campaign starts paused by default

### Import Contacts

1. Select a campaign
2. Upload a CSV file
3. Map fields (phone is required)
4. Click Import

### Start Calling

1. Toggle campaign to "Active"
2. Queue processor will start firing calls within calling window (9am-5pm by default)
3. Watch contacts move from "pending" → "completed"

## CSV Format

Your CSV should have columns like:

| phone | first_name | last_name | company | location | industry |
|-------|------------|-----------|---------|----------|----------|
| 5551234567 | John | Smith | Acme Realty | Houston, TX | Real Estate |

The importer will auto-detect common column names.

## Configuration

### Campaign Settings (in Supabase)

| Field | Default | Description |
|-------|---------|-------------|
| `calls_per_minute` | 5 | Max concurrent calls per minute |
| `call_window_start` | 09:00 | Start of calling hours |
| `call_window_end` | 17:00 | End of calling hours |
| `timezone` | America/Chicago | Timezone for call window |
| `max_attempts` | 3 | Max call attempts per contact |
| `retry_delay_minutes` | 30 | Wait time between retries |

### Vapi Variables

The queue processor sends these to Vapi:

```javascript
{
  leadName: contact.first_name,
  companyName: contact.company,
  location: contact.location,
  industry: contact.industry
}
```

Make sure your Vapi assistant prompt uses `{{leadName}}`, `{{companyName}}`, etc.

## Deployment

### Vercel (Frontend)

```bash
vercel
```

Set environment variables in Vercel dashboard.

### Queue Processor

Run on Railway, Render, or any server that stays alive:

```bash
npm run queue
```

Or use a cron job to run periodically.

## Next Steps

- [ ] Add Vapi webhook handler to update outcomes
- [ ] Add call recordings playback
- [ ] Add real-time status updates
- [ ] Add client portal (multi-tenant)
- [ ] Add scheduling tool integration
