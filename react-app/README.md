# React + Vite

## Deploying to GitHub Pages

The repository's GitHub Actions workflow builds `react-app` and deploys it to
GitHub Pages whenever changes are pushed to `main`. The public site URL is:

`https://Jagadeesh-voosetti.github.io/Bricks/`

The workflow builds with `/Bricks/` as the base path so the app's assets load
from the repository Pages URL.

## Android app

The **Build Bricks-Land Android APK** workflow creates a debug APK and uploads
it as the `Bricks-Land-Android-debug` artifact. Download it from the workflow
run's summary in GitHub Actions. This APK is for testing and direct
installation; publishing to Google Play requires a separately signed release
build.

To use Supabase credentials that are not committed to the repository, add
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under the repository's
Settings > Secrets and variables > Actions. These client-side values are
included in the published app; never use a Supabase service-role key here.

## Brick owners, orders and invoices

The owner directory stores only names. Owners must sign in with their own
accounts, then an administrator must link each account to its owner profile
from the Supabase SQL editor before it can manage stock or orders. To link an
account, find the owner's UUID in Supabase Authentication > Users and run:

```sql
update public.brick_owners
set auth_user_id = '<owner-auth-user-uuid>'
where id = '<owner-profile-id>';
```

Each owner can then add brick types, actual stock and per-brick prices from
their profile. Customers can order listed bricks, pay through Razorpay, and
download a PDF invoice after the server verifies that the payment was captured.
Owners see incoming paid orders and can move them through loading, dispatched
and delivered. Owner accounts are linked by an administrator; users cannot
claim an owner profile themselves.

### Configure and deploy the Supabase backend

Payment credentials are not committed to Git. In repository Settings > Secrets
and variables > Actions, create these **Actions secrets**:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

Use Razorpay test keys while testing and live keys only after enabling live
payments in the Razorpay account. Do not send these secret values in chat.
After adding the secrets, run the **Deploy brick marketplace backend** workflow
from Actions once. It applies the database migration and deploys the verified
payment function.

For payment notifications if a customer closes checkout before returning to
the app, add an `order.paid` webhook in Razorpay pointing to:

`https://zjabvburavcuvtpszuzw.supabase.co/functions/v1/marketplace-payment`

Use the same webhook secret stored as `RAZORPAY_WEBHOOK_SECRET`. Captured
payments are verified server-side before an invoice number is issued. Expired
stock reservations are released, and a captured payment after expiry is
refunded where possible; unresolved provider errors are reported for
administrator follow-up.

### Collecting owner details with Google Forms

An administrator can create a bilingual owner intake form from the script in
`google-apps-script/BrickOwnerIntake.gs`:

1. Open [script.new](https://script.new) using the administrator's Google
   account, paste the script, and run `createBrickOwnerIntakeForm`. Approve
   Google's requested Forms, Sheets, and trigger permissions.
2. The function logs a responder form URL and a private review spreadsheet URL.
   Send only the responder URL to the brick owners.
3. In the Apps Script project's **Project Settings > Script Properties**, add
   `SUPABASE_URL` with the project URL and `SUPABASE_SERVICE_ROLE_KEY` with the
   Supabase service-role key. Never put this key in the form, spreadsheet
   responses, website code, Git, or a message. Keep the Apps Script project and
   linked response spreadsheet restricted to trusted administrators.
4. Review each submission and confirm the selected owner identity and details.
   Change **Admin review status** to `Approved` only after verification. The
   installed trigger then updates the owner's location and creates/updates
   their listing. The private phone response is for administrator follow-up
   only and is never published.
5. The backend deployment workflow must have applied both marketplace
   migrations before approved submissions can publish. A listing is safe to
   retry: each response is upserted using its unique spreadsheet row key.

This form gathers owner/location, brick name and type, available stock,
per-brick price, private contact phone, and notes. Google Form submissions stay
pending and do not change public stock or prices until an administrator
approves them.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
