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
2. Click **New query** (or open the migration file located in this project at `supabase/migrations/20261015000000_init_bloodstock_schema.sql`).
3. Copy the entire contents of `supabase/migrations/20261015000000_init_bloodstock_schema.sql` and paste it into the SQL Editor.
4. Click **Run** (or press `Ctrl+Enter` / `Cmd+Enter`).
5. Confirm that the query succeeds with message `Success. No rows returned` or similar.

This script creates:
- `public.hospitals`: Hospital profile table linked to `auth.users(id)`.
- `public.blood_units`: Perishable blood component inventory table.
- `public.blood_requests`: Emergency and routine transfusion request orders table.
- Row-Level Security (RLS) policies isolating access per hospital.
- Database trigger `tr_check_hospital_status` preventing hospitals from self-promoting their account status.
- 3 initial synthetic demonstration hospitals.

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
