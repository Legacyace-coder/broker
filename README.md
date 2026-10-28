# Northstar Capital — full-stack starter

A multi-page fintech/investment portal scaffold with a responsive vanilla HTML/CSS/JS frontend, Supabase Auth/PostgreSQL, and a FastAPI backend.

## Included
- Public pages: home, about, responsibility, digital assets, real estate, agriculture, plans, FAQ, contact, login, registration, password recovery, terms.
- Member pages: dashboard, deposits, deposit history, investments, withdrawals, transactions, partner program, profile.
- Admin pages: overview, users, deposits, withdrawals, investments/plans, transactions, partner program, audit log, settings.
- FastAPI endpoints for profile/dashboard, deposit requests, withdrawal requests, transactions and admin review.
- PostgreSQL schema with RLS, role checks, audit trail and server-side balance operations.
- Image placeholders and responsive styling. Add your own images later.

## Important scope
This is a functional starter, not a deployed financial service. Payment rails, KYC/AML, regulatory authorisation, email delivery, production monitoring, security review and real transaction reconciliation must be completed before accepting customer funds. The UI deliberately avoids guaranteed-return claims. A deposit request is not a payment confirmation; withdrawals require admin review. Do not represent demo data as real customer balances.

## 1. Create and configure Supabase
1. Create a Supabase project.
2. Open SQL Editor and run the SQL migrations in `supabase/migrations` in filename order. For an existing installation of the initial schema, run any newer migrations before using the updated API.
3. In Authentication settings, enable email/password sign-up and configure your production Site URL and redirect URLs.
4. In Supabase Auth settings, enable CAPTCHA protection and select Cloudflare Turnstile. Add the Turnstile secret key there; do not put it in this project.
5. Create a Turnstile site for your local and production hostnames, then put its public site key in `CAPTCHA_SITE_KEY` in `frontend/assets/js/config.js`. Registration stays disabled until this key is configured.
6. Copy your project URL and publishable/anon key into `frontend/assets/js/config.js`.
7. Copy the project URL, anon key and service-role key into `backend/.env` using `backend/.env.example` as a guide. The service-role key is server-only; never put it in frontend files or commit it.
8. Create your own user through the registration page. Promote that user to admin from the SQL editor only after verifying the exact account:

```sql
update public.profiles
set role = 'admin'
where id = 'YOUR_AUTH_USER_UUID';
```

Do not expose an admin-registration form.

## 2. Run the backend
From the `backend` directory:

```bash
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Windows: copy .env.example .env
uvicorn app.main:app --reload
```

API docs: `http://127.0.0.1:8000/docs`. Configure `CORS_ORIGINS` in `.env` to match the local frontend origin.

## 3. Run the frontend
Serve the `frontend` folder through a local static server (don't open the HTML directly as `file://`). For example:

```bash
cd frontend
python -m http.server 5500
```

Open `http://127.0.0.1:5500`. Update `API_BASE_URL` in `assets/js/config.js` if the API is hosted elsewhere.

## 4. Supabase security notes
- Frontend config contains only the public/publishable key.
- Backend validates access tokens against Supabase Auth and performs privileged writes with a server-only service key.
- RLS restricts user-owned rows; profile role changes are not user-editable.
- Withdrawal requests reserve funds atomically; rejection returns reserved funds. Deposit requests only credit a balance after admin approval. No real payment provider is wired in.
- The starter wallet currently supports USDT only. Other crypto assets are rejected until per-asset wallet balances are implemented. Admins can manage USDT wallet/network and bank transfer instructions in the admin Settings page; only signed-in members can read enabled instructions. Crypto and bank deposits require manual reconciliation. For bank transfers, the admin enters the verified USDT credit amount; no exchange rate is assumed.
- Card payments are disabled until a third-party processor is selected and integrated. Never store card numbers, processor secrets, or private keys in the app.
- Existing non-USDT requests and balances from before the single-USDT restriction must be manually reconciled; migrations block unsafe approvals/refunds rather than guessing currency conversions. Approved withdrawals remain reserved until rejected/refunded or transferred and marked complete with a transfer reference.
- Admin endpoints check the role from the database. For a production system, add session revocation/short-lived sessions, MFA for admins, rate limits, idempotency keys, alerting and independent security review.
- Admins can set a user's current available USDT balance. Each change is recorded as an adjustment transaction and an audit log entry with the previous/new balance, signed difference, admin, and reason. Withdrawal review is forward-only: pending requests can be approved or rejected (rejection refunds the reserved amount), and approved requests can be marked completed with a transfer reference; completed/rejected withdrawals cannot be reopened through the admin UI.

## 5. Before launch
Replace the Northstar Capital placeholder identity/copy with your verified company details; add approved imagery, privacy policy and terms; connect a real transactional email provider; complete payment provider integrations and reconciliation; add jurisdiction-specific licensing and compliance controls; test backups, incident response and account recovery; and deploy frontend/API with HTTPS and secret management.
