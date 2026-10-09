# ClassFix AI — Two Portal Setup

This is a responsive two-portal classroom issue reporter:
- **Student / Staff portal:** submit an issue, choose building/room/category/urgency, and attach a photo from the device.
- **Admin portal:** view all reports, filter/search, change status, review active/completed issues, and export CSV reports (all issues or completed issues only).
- **Cloud mode:** Supabase allows reports submitted from a student's phone or computer to appear in the admin portal on another device.
- **Authentication:** admin login is restricted to `admin123@gmail.com`; students/staff can use Google OAuth or email/password accounts.
- **No demo admin:** the demo-login bypass has been removed. Cloud authentication must be configured for the real admin portal.

## 1. Run it in VS Code
1. Extract the ZIP.
2. Open the `ClassFix_AI_Two_Portal` folder in VS Code.
3. Install the **Live Server** extension (Ritwick Dey), then right-click `index.html` → **Open with Live Server**.
4. Open the local URL shown by Live Server. Click **Admin Dashboard** → **Sign in with the configured admin account** to preview the admin view. Try submitting a report in the Student / Staff portal and then return to Admin Dashboard.
5. Demo data lives in that browser only. Use cloud setup below for real shared reporting.

## 2. Configure shared cloud storage with Supabase
Supabase has a free tier suitable for a student prototype. You create and own the project/account.

1. Create a project at https://supabase.com/.
2. In **Project Settings → API**, copy the **Project URL** and **anon/public key**.
3. In **Authentication → Users**, create an admin user with an email and password. Use that same email in `config.js` as `adminEmail`.
4. In Supabase Authentication → Users, create the admin user with email `admin123@gmail.com`. Set its password to `1234` only if this is strictly a classroom demo; it is weak and should be changed before any public launch. The website checks the email allowlist, but the database policies must also enforce admin-only updates.
5. Open the Supabase SQL Editor and run the SQL below.
6. In `config.js`, fill in `supabaseUrl` and `supabaseAnonKey`. `adminEmail` is already set to `admin123@gmail.com`. The anon/public key is intended for browser use; **never use the service_role key in this website**.
7. In Supabase Authentication → Providers, enable Google and configure the Google OAuth Client ID/Secret from Google Cloud Console. Add your local Live Server URL and deployed Netlify URL to Supabase Site URL / Redirect URLs.
8. Refresh the site. Students/staff can create an account with email/password or use Google. The admin must sign in with `admin123@gmail.com`. Reports are shared across devices when the SQL/storage policies are configured.

### SQL schema and security policies
```sql
create table if not exists public.issues (
  id text primary key,
  title text not null,
  description text not null,
  category text not null,
  building text not null,
  room text not null,
  priority text not null check (priority in ('Critical','High','Medium','Low')),
  status text not null default 'Submitted' check (status in ('Submitted','In Progress','Completed')),
  reporter text,
  contact text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  photo_url text
);

alter table public.issues enable row level security;

-- Public can submit a new issue, but cannot read or alter issues.
create policy "public can submit issues"
on public.issues for insert
to anon, authenticated
with check (status = 'Submitted');

-- Only the configured admin email can view all issues.
create policy "admin can view issues"
on public.issues for select
to authenticated
using ((auth.jwt() ->> 'email') = 'admin@college.edu');

-- Only the configured admin email can update issues.
create policy "admin can update issues"
on public.issues for update
to authenticated
using ((auth.jwt() ->> 'email') = 'admin@college.edu')
with check ((auth.jwt() ->> 'email') = 'admin@college.edu');

-- Set up a public bucket for issue photos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('issue-photos', 'issue-photos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true;

-- Anyone can upload issue evidence photos. Public bucket allows photo viewing.
create policy "public can upload issue photos"
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'issue-photos');

-- Note: public bucket means anyone with a photo URL can view that image.
```

**Important:** If you change the admin email, change it in BOTH the SQL policies and `config.js`. The admin's password is managed by Supabase Auth, not saved in this project. The student-facing app intentionally does not display other users' reports. For a production campus system, add spam protection, rate limiting, and an authenticated server-side workflow before collecting sensitive details.

## 3. Deploy on Netlify
1. Test the site in Live Server first.
2. Open https://app.netlify.com/ and sign in.
3. Choose **Add new site → Deploy manually** (wording may vary).
4. Drag the project folder contents (`index.html`, `styles.css`, `app.js`, `config.js`, and any other project files) into the deploy area.
5. Open the generated Netlify URL and test a student submission and admin login from two separate browser/device sessions.
6. If using Supabase, configure `config.js` before deploying and redeploy after any config changes.

## What the dashboard can do
- Summary cards for all issues, active issues, high/critical priority, and completed issues.
- Search by issue ID, title/description, room, category, reporter, or building.
- Filter by status and priority.
- Update issue status: Submitted → In Progress → Completed.
- Export all issues to CSV, or export completed issues only for resolution reporting.

## Current prototype limits
- Priority is rule-based from selected urgency and simple keywords; it is not a trained AI model.
- Export is CSV, which can be opened in Excel.
- In demo mode, data is local to one browser. Cross-device visibility requires Supabase configuration.
- Admin sign-in and shared data become active only after completing cloud setup.
