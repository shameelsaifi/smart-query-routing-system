# SmartQuery frontend

React and Vite frontend for the Smart Query Routing and Email Automation System.
This refactor organizes the existing prototype. Dashboard URLs and visual markup
are preserved; missing backend features remain separate work.

## Folder guide

All paths below are relative to `src/`.

| Path | Responsibility |
| --- | --- |
| `App.jsx` | Browser router and application entry component |
| `main.jsx` | React mounting and global CSS import |
| `routes/AppRoutes.jsx` | Authentication gates and role/desk-specific routes |
| `routes/dashboardPaths.js` | Default dashboard URL for each implemented role/desk |
| `pages/auth/` | Google login screen |
| `pages/student/` | Student query submission and history screen |
| `pages/accounts/` | Fee & Billing, Scholarship, and Refunds dashboards |
| `pages/hod/` | HOD dashboard, filters, pagination, and review actions |
| `components/common/` | Shared access-denied and loading components |
| `hooks/useAuth.js` | Supabase session, profile provisioning, login, and logout |
| `hooks/useAssignedTickets.js` | Shared Accounts ticket loading and start/resolve actions |
| `services/apiClient.js` | JSON requests, bearer headers, and response errors |
| `services/authService.js` | Backend profile provisioning request |
| `services/ticketService.js` | Student, Accounts, and HOD ticket requests |
| `lib/supabase.js` | Supabase client initialization |
| `config/env.js` | Frontend environment configuration |
| `utils/` | Profile storage and text helpers |
| `styles/globals.css` | Existing global styles |

Pages render the interface and use hooks/services for data. Services know API
paths but do not render UI. Shared components should not depend on role-specific
pages. Add future implemented Instructor/Admin screens under their own `pages/`
folders, then register them in `AppRoutes.jsx` and `dashboardPaths.js`.

Backend authorization remains required: frontend route checks are navigation
controls, not permission enforcement for the database.

## Local setup

Run commands inside `frontend/`. Verification used Node.js 24.19.0.

1. Copy `.env.example` to `.env` and enter your existing Supabase project URL and
   publishable key. Keep `VITE_API_BASE_URL` pointed at the backend API prefix,
   for example `http://localhost:8000/api/v1`.
2. Run `npm ci`.
3. Start the backend separately, then run `npm run dev`.

Only browser-safe values belong in `VITE_` variables. Database credentials,
Supabase service-role keys, Gmail credentials, and Gemini keys belong on the backend.

## Applying the downloaded frontend on Windows

The ZIP contains a complete `frontend/` source folder, without `.env`,
`node_modules`, or `dist`.

1. Stop the frontend development server and back up your existing `frontend/`
   folder, including any uncommitted local changes.
2. Replace the old source folder with the ZIP's `frontend/` folder. Avoid merging
   the two source trees: the former `src/pages/*.jsx` locations were moved.
3. Copy your existing local environment files, such as `.env` or `.env.local`,
   from the backup into the new `frontend/` folder.
4. Run `npm ci`, then `npm run dev` inside the new folder.

The backend and Supabase migrations do not need replacement for this refactor.
Source baseline: `main` commit `071bedadd48fa56c4de35a2b1d06b86e8d975b78`.

## Verification

- `npm run build`: production compilation and import resolution.
- `npm run lint`: ESLint and React hook checks.

After configuring real services, check Google login/logout, token refresh, student
submission, each Accounts dashboard, start/resolve actions, HOD filters and
approve/reject actions. Live OAuth and service behavior require your configuration.

## Remaining prototype gaps

- `GET /tickets` for student history is still missing in the backend.
- The attachment selector still sends only the existing boolean; file upload is
  not implemented by this refactor.
- HOD authorization, manual-review visibility, escalation, and email sending
  require the backend work identified in the project review.
- The existing Tailwind CDN setup is preserved; a local CSS build can be handled
  in a separate styling task.

Accounts pages now share the actual `/tickets/assigned-to-me` endpoint. The old
Fee & Billing fallbacks to nonexistent endpoints were removed. Unused Vite demo
assets and the unimported `App.css` were removed. Global CSS remains unchanged.
