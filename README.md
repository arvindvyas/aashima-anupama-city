# Society Hub

A free app for villa and apartment societies. Residents pay maintenance by UPI, read notices, raise complaints and book amenities. The committee confirms payments, raises bills, posts notices and keeps open accounts that every resident can see.

- **Website:** GitHub Pages (free)
- **Database and login:** Supabase free plan (Mumbai server)
- **Payments:** direct UPI to the society account, with no gateway and no fees
- **Backups:** nightly Google Sheet + daily encrypted copy in a private GitHub repo

## Files

| File | What it is |
|---|---|
| `index.html`, `css/`, `js/` | The app |
| `js/config.js` | Your Supabase URL and key go here |
| `supabase/schema.sql` | Database tables and security rules. Run once in Supabase. |
| `backup/google-sheet-backup.gs` | Nightly backup into a Google Sheet |
| `backup/github-backup-workflow.yml` | Daily full backup into a private GitHub repo |
| `prototype.html` | The first clickable demo with sample data |

## Setup (about 30 minutes, once)

### 1. Supabase
1. Sign up at https://supabase.com (free, no card needed).
2. **New project.** Name it `society-hub` and choose region **South Asia (Mumbai)**. Save the database password somewhere safe.
3. Open **SQL Editor → New query**, paste all of `supabase/schema.sql` and click **Run**.
4. Go to **Authentication → Sign In / Providers** and check that **Email** is on.
5. Go to **Authentication → Emails → Magic Link** and add this line to the template so people also get a 6-digit code:
   `Your login code is {{ .Token }}`
6. Go to **Authentication → URL Configuration** and set **Site URL** to your GitHub Pages address (step 2 below), for example `https://yourname.github.io/society-hub/`. Add `http://localhost:8000` to Redirect URLs for testing.
7. **Email limit:** Supabase's built-in email sends only a few emails an hour. Before inviting 400 villas, connect a free email sender. **Brevo** sends 300 a day for free: create a Brevo account, open SMTP & API, and copy the details into Supabase **Authentication → Emails → SMTP Settings**.
8. Go to **Project Settings → API** and copy the **Project URL** and the **anon public** key into `js/config.js`.

> The anon key is meant to be public. The security rules in the database decide what each person can see.

### 2. GitHub Pages
1. Create a **public** repo, for example `society-hub`, and push these files.
2. Repo **Settings → Pages → Deploy from a branch → main / (root)**.
3. After a minute the app is live at `https://<your-github-name>.github.io/society-hub/`.

### 3. Who can do what at sign-up
- **App owner** (emails in the `platform_admins` table) creates societies. Add yourself once in the SQL Editor:
  `insert into platform_admins values ('you@gmail.com');`
- **Society admins** add villas and then add each resident by **email** (one at a time, or paste from Excel).
- **Residents** just open the link and sign in with that email. They see their society straight away. There are no invite codes or join requests.
- **Strangers** cannot sign in. The Auth hook below refuses any email that no society has added, so nobody can spam login emails.

Turn on the hook once: Supabase → **Authentication → Auth Hooks → Add hook → Before User Created → Postgres → `public.hook_before_user_created`**.

### First use (committee)
1. The app owner signs in and creates the society, giving the admin's email.
2. The admin signs in, opens **Settings**, sets the UPI ID, maintenance amount and due day, and adds villas (for example `V-` from 1 to 400).
3. In **Members**, the admin adds residents by email and gives a few people the **Admin** role and a title (Treasurer, Secretary and so on).
4. Tap **Share app link** and post it in the society WhatsApp group.
5. Each month go to **Maintenance → Raise bills**. Residents pay by UPI and enter the UTR, and the treasurer confirms each payment.

### 4. Backups (do both)
- **Google Sheet:** follow the steps at the top of `backup/google-sheet-backup.gs`.
- **Private GitHub repo:** create a private repo, for example `society-hub-backups`, and follow the steps at the top of `backup/github-backup-workflow.yml`. This daily job also stops the free Supabase project from pausing.

## Try it on your computer
```
cd villa-society
python3 -m http.server 8000
```
Then open http://localhost:8000

## Free plan limits for 400 villas
- Database 500 MB. This society uses about 20 MB a year.
- 50,000 users a month. You have about 800.
- Built-in email is limited, so use Brevo (step 1.7).

## Who can do what (enforced by the database)
| | Resident | Admin |
|---|---|---|
| See own bills and pay | ✅ | ✅ (all villas) |
| Mark a bill paid | ❌ (can only submit a UTR) | ✅ |
| See other villas' bills | ❌ | ✅ |
| Notices | read | post, pin, delete |
| Complaints | raise and see own | see all, update status |
| Bookings | book for own villa, see all | cancel any |
| Accounts and expenses | read | add and delete |
| Phone numbers | committee only | all |
| Add residents, villas, settings | ❌ | ✅ |
| Create a new society | ❌ | ❌ (app owner only) |
