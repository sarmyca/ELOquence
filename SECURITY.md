# Security checklist

Status of the security work delivered in the audit + remediation pass, and
the items that REQUIRE OPERATOR ACTION before deploying to anything other
than a personal dev box.

---

## What's already fixed in code

- **Race condition on `submit_guess` (CRITICAL)** — `SELECT ... FOR UPDATE`
  on the Game row in both the authed path (`backend/app/services/game.py`)
  and the guest path (`backend/app/routers/daily.py`). Concurrent guesses
  on the same game now serialize; the previous exploit (pumping 5–20
  concurrent guesses to extract pattern info without consuming budget) is
  closed.
- **Guest-game IDOR (HIGH)** — the authed `submit_guess` no longer accepts
  `Game.user_id IS NULL`. Guest dailies are handled exclusively by the
  unauthenticated `/api/daily/guest/{id}/guess` endpoint.
- **AI coach leaks `target_word` mid-game (HIGH)** — `/api/ai/coach-chat`
  now returns 409 for `in_progress` games, mirroring the existing gate on
  `/explain-move` and `/game-summary`. A single chat message can no longer
  reveal today's answer.
- **Google OAuth account takeover via unverified email (HIGH)** — both
  `/auth/google` (id_token flow) and `/auth/google/callback` (auth-code
  flow) now require `idinfo["email_verified"] is True` before linking or
  creating a user. The callback also verifies the `id_token` returned by
  Google rather than trusting `userinfo` fetched with the `access_token`.
- **Account enumeration on `/auth/register` (HIGH)** — collisions on email
  vs. username now return the same generic 409 message.
- **No rate limit on `/auth/login` (HIGH)** — in-memory throttle: 10
  attempts per 5 min per email, plus 30 per 5 min per IP. Successful login
  clears both buckets. See `backend/app/services/rate_limit.py`.
- **Unauthenticated daily-solution harvest (MEDIUM)** — `/api/daily/guest`
  is throttled to 5 fresh guest games per hour per IP, blocking mass
  extraction of the answer via lose-to-reveal.
- **CORS too permissive (HIGH)** — `allow_methods` and `allow_headers`
  pinned to the actual set the SPA uses, instead of `"*"`.
- **No security headers (HIGH)** — added `X-Content-Type-Options`,
  `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, and
  `Strict-Transport-Security` on every response.
- **No global exception handler (HIGH)** — added a handler that logs the
  full traceback server-side and returns `{"detail": "Internal server
  error."}` to the client. No more stack-trace leaks on unhandled errors.
- **python-jose CVE GHSA-6c5p-j8vq-pqhj (CRITICAL)** — bumped pin from
  `==3.3.0` to `>=3.4.0,<4.0`. Not exploitable in our HS256 config because
  we don't accept ECDSA keys, but no reason to ship a vulnerable lib.
- **Axios 15 advisories (HIGH)** — bumped from `^1.6.7` to `^1.16.1`.
- **Next.js 25 advisories (CRITICAL)** — bumped from `14.1.0` to
  `^14.2.35` (auth bypass, SSRF, cache poisoning, XSS, etc. all fixed).
  Post-bump `npm audit` shows 5 remaining (1 moderate, 4 high) — all
  Next.js advisories that require jumping to 15.x/16.x to clear. The
  remaining issues need specific app configurations to be exploitable
  (self-hosted Image Optimizer with attacker-controlled `remotePatterns`,
  i18n routing, CSP nonces, `beforeInteractive` scripts) — most do not
  apply to this app's actual usage, but a Next.js 15 upgrade is the only
  clean fix. Out of scope for this pass; flagged in item #10 below.
- **JWT secret** — generated a fresh `JWT_SECRET` for local dev in `.env`.

---

## What YOU still need to do before production

### 1. Rotate the Google OAuth client credentials

`docker-compose.yml` ships these as fallback defaults — they're in git
history, so they are now public:

```yaml
GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID:-43178926835-...apps.googleusercontent.com}
GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET:-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}
```

If the client_id maps to a real Google Cloud project:
- In Google Cloud Console → APIs & Services → Credentials, **delete the
  current OAuth client** and create a new one.
- Set the new `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` in your prod
  env (NOT in `docker-compose.yml`). Remove the fallback defaults from
  the compose file entirely so a missing env var fails loudly instead of
  silently using the leaked values.

### 2. Rotate the VAPID push keys

`docker-compose.override.yml` ships a plaintext `VAPID_PRIVATE_KEY`. Anyone
who has cloned the repo can sign push messages as your server.

- Generate a fresh pair: `python -m app.cli.generate_vapid` from the
  backend container.
- Set the new keys in your prod env. Delete the override block.

### 3. Pick a strong, secret `JWT_SECRET` for prod

The `.env` you have now contains a freshly-generated secret for local
dev. For production, generate a new one (`python -c "import secrets;
print(secrets.token_urlsafe(32))"`) and set it via the deployment
environment, NOT a committed `.env`. Tokens signed with the dev secret
must not be valid in prod.

### 4. Reduce `JWT_EXPIRATION_HOURS`

Default is 168 (7 days). A stolen token is valid for a full week with no
revocation path. For prod, drop to ~24 hours and consider adding a
refresh-token flow if UX requires longer sessions. Eventually: add a
`jti` claim and a server-side denylist so password-change / "log out
everywhere" can actually invalidate.

### 5. Switch JWT storage out of `localStorage`

Currently the token lives in `localStorage`, which means any XSS on the
SPA exfiltrates it. The proper fix is an `httpOnly; Secure; SameSite=Lax`
cookie set by the backend on login. This is a bigger refactor (frontend
no longer manually attaches the Bearer header; CSRF token needed) — out
of scope for this pass, but flagged as the single highest-leverage
defence-in-depth upgrade for prod.

### 6. Wire a real rate limiter

The in-memory limiter in `backend/app/services/rate_limit.py` only works
on a single backend process. For multi-worker / multi-replica deploys,
replace with `slowapi` + Redis (or your CDN / API-gateway throttle).

### 7. Reverse-proxy hardening

Run the FastAPI app behind nginx / Caddy / Cloudflare for:
- TLS termination (so `Strict-Transport-Security` actually means
  something).
- A real `Content-Security-Policy` tuned to the deployed SPA.
- Request body-size limits.
- Per-route timeouts.

### 8. Step-up auth for destructive actions

`DELETE /api/users/me` and `DELETE /api/users/me/games` currently require
only a valid Bearer token. A stolen token wipes the victim's account in
one request. Require a freshly-entered password (or recent re-login) for
both endpoints.

### 9. Next.js 15+ upgrade

5 transitive advisories remain after the 14.1.0 → 14.2.35 bump (1
moderate, 4 high) and require Next.js 15 or 16 to clear. Plan a separate
upgrade pass — test the App Router routes, the API proxy in
`frontend/app/api/auth/callback/google/route.ts`, and the React 19
upgrade that comes with Next 15.

### 10. Other deferred items

- **Push subscribe re-bind** (`backend/app/routers/push.py`) silently
  re-owns the subscription row when an existing endpoint is re-submitted
  with a different user_id. Switch to 409-on-collision unless the
  caller can prove possession of the prior keys.
- **`/daily/replay` deterministic seed** uses `target_date.toordinal()`
  as the RNG seed. Anyone with the source can pre-compute every
  historical replay word and inflate streaks/achievements. Either hash
  the seed with a server-side secret, or persist replay words to
  `DailyWord` on first encounter and refuse to lazily generate.
- **Challenge code entropy** is ~47 bits (`secrets.token_urlsafe(8)[:8]`).
  Drop the `[:8]` slice — `token_urlsafe(8)` already returns 11 chars at
  ~66 bits.
- **`set_daily_word` admin endpoint** does not clamp `difficulty`. Add
  `100 <= difficulty <= 3500`.
- **Admin self-recovery / break-glass** — there is no in-app path to grant
  the first admin role; if all admins are demoted or deleted there is no
  recovery. Document an out-of-band SQL update procedure, or implement a
  break-glass token flow.

---

## How to re-test the fixes

The remediation pass was verified against a running stack at
`http://localhost:8000`. To re-run the same tests:

```powershell
docker compose up -d
docker compose exec backend pip install -r requirements.txt  # picks up python-jose bump
docker compose restart backend
docker compose exec frontend npm install                     # picks up axios + next bumps
docker compose restart frontend
```

The repeated-find-and-fix loop on this audit lives in the project
conversation log; rerun the `penetration-tester` agent against the live
stack to confirm the previously-verified critical exploits no longer
reproduce.
