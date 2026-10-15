# Supabase PostgreSQL & Authentication Setup Guide for BloodStock

This guide provides step-by-step instructions for connecting your **BloodStock** application to **Supabase** for PostgreSQL database persistence and Auth.

---

## 1. Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign in or create an account.
2. Click **New Project**.
3. Enter project details:
   - **Name**: `BloodStock-HealthTech`
   - **Database Password**: Choose a strong password and save it securely.
   - **Region**: Choose a region close to your target users (e.g., Singapore or Mumbai for India).
4. Wait approximately 1–2 minutes for Supabase to provision your PostgreSQL database.

---

## 2. Run the SQL Migration

1. In your Supabase Dashboard, open the left sidebar and click on **SQL Editor**.
2. Run the migration scripts located in `supabase/migrations/` in sequential order:
   - `20261015000000_init_bloodstock_schema.sql` (Core tables, enums, triggers)
   - `20261015030000_jaipur_dashboard_schema.sql` (Multi-hospital RBAC, transfer audit log, atomic reservations)
   - `20261015040000_inventory_quarantine_and_rls.sql` (Quarantine status, inventory verification RPC)
   - `20261015050000_fix_blood_requests_rls_and_rpc.sql` (Comprehensive RLS policies for blood requests & atomic create_blood_request RPC)
3. For each script, paste into the SQL Editor and click **Run** (`Ctrl+Enter` / `Cmd+Enter`).
4. Confirm success message.

These scripts create:
- `public.hospitals`: Hospital profile table linked to `auth.users(id)`.
- `public.hospital_user_access`: Multi-hospital membership and role-based access.
- `public.blood_units`: Perishable blood component inventory table with quarantine support.
- `public.blood_requests`: Emergency and routine transfusion request orders table.
- `public.blood_transfer_audit_log`: Auditable chain of custody.
- Row-Level Security (RLS) policies isolating access per hospital and across authorized network members.
- Stored procedures: `atomic_reserve_units`, `release_request_reservations`, `create_blood_request`.
- Initial synthetic demonstration hospitals.

---

## 3. Create an Authenticated Hospital User

1. In your Supabase Dashboard, go to **Authentication** > **Users**.
2. Click **Add user** > **Create user**.
3. Fill in the credentials:
   - **Email**: `metro.admin@bloodstock.demo`
   - **Password**: `DemoPass2026!`
   - Check **Auto Confirm User?** so email confirmation is not required.
4. Click **Create user**.
5. Copy the newly created user's **User UID** (a UUID like `e8a93cb4-7711-4872-8822-192a014a4801`).

---

## 4. Link the User ID to the Hospital Profile

In the Supabase **SQL Editor**, run this command to link the user UUID to the seeded hospital profile:

```sql
UPDATE public.hospitals
SET auth_user_id = 'YOUR_COPIED_USER_UID_HERE'
WHERE email = 'metro.admin@bloodstock.demo';
```

Verify that the link was created:

```sql
SELECT id, name, email, auth_user_id, account_status
FROM public.hospitals
WHERE email = 'metro.admin@bloodstock.demo';
```

---

## 5. Configure Environment Variables

1. In Supabase Dashboard, navigate to **Project Settings** > **API**.
2. Copy:
   - **Project URL** (e.g., `https://xyzcompany.supabase.co`)
   - **Project API Anon Key** (`anon` `public` key)
3. In your BloodStock project root, create a `.env` file (or update your environment configuration):

```env
VITE_SUPABASE_URL="https://your-project-id.supabase.co"
VITE_SUPABASE_ANON_KEY="your-actual-anon-key-here"
```

> **IMPORTANT SECURITY NOTE**: Never commit your `.env` file with real keys to public repositories. Never use the `service_role` key in frontend code.

---

## 6. Run the Application

If you haven't already installed dependencies, run:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Visit the app in your browser, click **Login**, and sign in with:
- **Email**: `metro.admin@bloodstock.demo`
- **Password**: `DemoPass2026!`

---

## 7. Demo / Offline Testing (Without Supabase Keys)

If you haven't set up a Supabase project yet, BloodStock automatically detects that placeholder credentials are in `.env.example` and runs in **Demo Mode with Seeded Accounts**:

- **Active Hospital**: `metro.admin@bloodstock.demo` / `DemoPass2026!` (Redirects to verified hospital dashboard)
- **Pending Hospital**: `children.admin@bloodstock.demo` / `DemoPass2026!` (Tests pending approval status screen)
- **Suspended Hospital**: `suspended.admin@bloodstock.demo` / `DemoPass2026!` (Tests suspended account security screen)
