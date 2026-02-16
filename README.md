# DocVerCtl

Production-ready MVP for managing project documentation stored only in private GitHub repositories.

## Stack
- Next.js App Router + TypeScript
- Tailwind CSS + shadcn/ui + lucide-react
- NextAuth (GitHub OAuth)
- MongoDB + Mongoose
- Octokit (GitHub REST API)
- Monaco editor/diff
- Vitest (unit/smoke tests)

## Features
- GitHub-only authentication.
- Server-side allowlist enforcement.
- Projects dashboard.
- Admin project creation modes:
  - `connect` existing private repo (fully implemented)
  - `create` private repo (feature-flagged by `ENABLE_GITHUB_REPO_CREATE`)
- File explorer with nested folders/files.
- Global custom right-click behavior (browser context menu disabled app-wide).
- File operations: create file/folder, rename/move, delete.
- `.md` / `.txt` in-app editing and GitHub commit save.
- Diff viewer for unsaved changes (Monaco diff).
- `.pdf` in-app viewer via server proxy route.
- `.docx` download fallback.
- Audit logs for project/file actions.
- Basic API rate limiting middleware.
- Optional email notifications on commits/changes (Nodemailer + SMTP).
- Missing-repository handling with user confirmation before local cleanup.

## Setup
1. Install dependencies:
```bash
npm install
```
2. Copy env template:
```bash
cp .env.example .env.local
```
3. Fill required values in `.env.local`.
4. Start dev server:
```bash
npm run dev
```
5. Open [http://localhost:3000](http://localhost:3000).

## Environment Variables
Use `.env.example`:
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `MONGODB_URI`
- `APP_BASE_URL`
- `ENABLE_GITHUB_REPO_CREATE`
- `GITHUB_REPO_CREATE_OWNER`
- `GITHUB_DEFAULT_BRANCH`
- `ALLOWED_GITHUB_LOGINS`
- `AUDIT_LOG_RETENTION_DAYS`
- `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_MAX_REQUESTS`
- `GITHUB_TOKEN_SCOPE_HINT`
- `MAIL_NOTIFY_ENABLED`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `MAIL_FROM`

## Email Notifications
When enabled, the app sends email notifications to project collaborators for commit-producing changes.

Events:
- file create/edit commit
- file delete commit
- rename/move actions

Each email includes:
- project name and repository
- who changed it
- commit message
- commit hash (when available)
- changed path
- timestamp

Enable with env:
```env
MAIL_NOTIFY_ENABLED=true
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-user
SMTP_PASS=your-pass
MAIL_FROM=DocVerCtl <no-reply@example.com>
```

Set recipients per project in the create project form:
- `Collaborator emails for commit notifications (comma separated)`

## GitHub OAuth App Setup
1. GitHub -> Settings -> Developer settings -> OAuth Apps -> New OAuth App.
2. Set Homepage URL:
- Local: `http://localhost:3000`
- Prod: your deployed URL.
3. Set Authorization callback URL:
- Local: `http://localhost:3000/api/auth/callback/github`
- Prod: `https://doc.searchngo.app/api/auth/callback/github`
4. Copy Client ID/Secret to env.

## Allowlist Setup
### Option A: DB allowlist (recommended)
Bootstrap first admin:
```bash
npm run seed:admin -- --id <github_user_id> --login <github_login> --admin true
```

Then sign in with that account and manage allowlist in `/admin/allowlist`.

### Option B: CSV fallback
Set `ALLOWED_GITHUB_LOGINS=login1,login2`.

## Project Creation Modes
- Mode B (`connect`) is complete and default.
- Mode A (`create`) requires:
  - `ENABLE_GITHUB_REPO_CREATE=true`
  - token scopes/org permissions allowing repository creation.

## API Routes
- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:id/tree?path=`
- `GET /api/projects/:id/file?path=`
- `POST /api/projects/:id/file`
- `DELETE /api/projects/:id/file?path=`
- `POST /api/projects/:id/rename`
- `GET /api/user/me`
- `GET /api/github/repo-check`
- `GET /api/admin/allowlist`
- `POST /api/admin/allowlist`

All routes enforce auth + allowlist on server.

## Testing
Run:
```bash
npm test
```

Included tests:
- allowlist gate logic (`tests/allowlist.test.ts`)
- zod validation (`tests/schemas.test.ts`)
- GitHub wrapper with mocked Octokit (`tests/github-client.test.ts`)

## Deployment (Vercel recommended)
1. Push repository to GitHub.
2. Import into Vercel.
3. Add all env vars from `.env.example`.
4. Update `NEXTAUTH_URL` to production URL.
5. Update GitHub OAuth callback URL to production callback.
6. Redeploy.

## Security Notes
- Auth/session: NextAuth JWT strategy with `NEXTAUTH_SECRET`.
- Allowlist enforcement: server-side in NextAuth sign-in callback and all protected APIs.
- Token handling: GitHub access token is used server-side only for API calls.
- CSRF: NextAuth built-in CSRF protections for auth endpoints.
- Rate limiting: in-memory middleware over `/api/*` (MVP baseline).
- Audit trail: MongoDB `AuditLog` captures project/file write actions.
- Private file access: binary/PDF retrieval proxied by server route to avoid token exposure.
- Note: DevTools cannot be meaningfully blocked; security is enforced server-side.

## Seed/Admin Bootstrap
- First admin should be inserted with `npm run seed:admin` command above.
- After first login, admin can add more users and admin roles from `/admin/allowlist`.
