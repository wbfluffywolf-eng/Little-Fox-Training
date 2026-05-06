# Little Fox Training Cloud

This is the separate Supabase-backed version of Little Fox Training.

It is intentionally separate from the local/offline app so the current app stays untouched.

## Current Scope

- Email/password sign up and sign in.
- Owner household creation.
- Invite-only friend/member records.
- Per-friend tab permissions:
  - Dashboard
  - Calendar
  - Inventory
  - Trends
  - Expenses
  - Settings
- Read-only restricted friend mode.
- Friend diaper suggestions without edit access.
- Owner can accept/dismiss suggestions.
- Owner inventory management.
- Supabase row-level security policies.

## Setup

1. Open Supabase.
2. Go to the project:
   `https://hqtukabmxvrwyhoieigu.supabase.co`
3. Open **SQL Editor**.
4. Paste and run `supabase-schema.sql`.
5. Open `index.html` in a browser.

## Keys

The frontend uses:

```text
SUPABASE_URL=https://hqtukabmxvrwyhoieigu.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_oJ2jk4rvxT8KWClGqDvmPA_AIXqi3eI
```

Do not put a service role key in this project.

## Invite Flow

The owner creates an invite with a friend email and permission checkboxes.

The friend signs up using that exact email. On login, the app claims the pending invite and activates their restricted view.

## Next Build Steps

- Add full log entry forms.
- Add cloud cloth diaper tracking.
- Add expenses editor.
- Add import from local backup JSON.
- Add notification/email flow for diaper suggestions.
- Add mobile PWA manifest and app icon.
