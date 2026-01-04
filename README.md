# Truvo Outbound

AI-powered outbound calling platform. Import CSVs, select contacts, fire Vapi calls manually.

## Architecture

```
CSV Upload → Supabase DB → Manual Selection → Vapi API → Phone Calls → Webhook → Status Update
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
NEXT_PUBLIC_DEFAULT_ASSISTANT_ID=your-vapi-assistant-id
NEXT_PUBLIC_DEFAULT_PHONE_NUMBER_ID=your-vapi-phone-number-id
```

### 3. Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Configure Vapi Webhook

Set your webhook URL in Vapi Dashboard → Settings:
```
https://your-domain.com/api/webhooks/vapi
```

## Usage

### Create a Campaign

1. Click "+ New Campaign"
2. Name it

### Import Contacts

1. Select a campaign
2. Upload a CSV file
3. Map fields (phone is required)
4. Click Import

### Make Calls

1. Select contacts using checkboxes
2. Click "Call Selected"
3. Webhook updates status: `ready` → `calling` → `answered`/`no_answer`/`voicemail`

### Status Flow

| Status | Meaning |
|--------|---------|
| `ready` | Available to call |
| `calling` | Call in progress |
| `answered` | Human picked up |
| `no_answer` | No answer |
| `voicemail` | Hit voicemail |
| `exhausted` | Max 2 attempts reached |

## CSV Format

Your CSV should have columns like:

| phone | first_name | last_name | company | location | industry |
|-------|------------|-----------|---------|----------|----------|
| 5551234567 | John | Smith | Acme Realty | Houston, TX | Real Estate |

The importer will auto-detect common column names.

## Vapi Variables

These variables are sent to your Vapi assistant:

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

### Vercel

```bash
npm i -g vercel
vercel
```

Set environment variables in Vercel dashboard, then configure your Vapi webhook URL.
