# Storia Migration Plan

## Phase 1: Phoenix API Preparation

### High Priority
- [ ] Create `lib/storia_web/plugs/bearer_auth.ex` - Bearer token validation plug
- [ ] Create `lib/storia_web/plugs/require_admin.ex` - Admin role check plug
- [ ] Create `lib/storia/token.ex` - Token verification stub (for BetterAuth JWT)
- [ ] Add API routes in `lib/storia_web/router.ex` with Bearer auth pipelines
- [ ] Enable CORS for Next.js origin in Phoenix config

### Medium Priority
- [ ] Create `BookApiController` for public book endpoints
- [ ] Create `ReadApiController` for authenticated read endpoints
- [ ] Create `AdminBookApiController` for admin book management
- [ ] Create `AdminSceneApiController` for admin scene management

## Phase 2: Next.js Frontend Setup

### High Priority
- [ ] Initialize Next.js app in `frontend/` directory
- [ ] Configure Tailwind CSS with Storia theme/colors
- [ ] Set up BetterAuth client configuration
- [ ] Create `lib/api.ts` fetch helper with Bearer token

### Medium Priority
- [ ] Create landing page (`app/page.tsx`) - copy styles from `home.html.heex`
- [ ] Create auth pages (`app/auth/check-email`, `app/auth/callback`)
- [ ] Create library page (`app/library/page.tsx`)
- [ ] Create reader page (`app/read/[id]/page.tsx`)

### Low Priority
- [ ] Create admin pages (`app/admin/books`, `app/admin/soundscapes`)
- [ ] Port remaining UI components with exact Tailwind classes

## Overall Approach
- **Frontend**: Next.js + BetterAuth for all auth (public + admin) and UI
- **Backend**: Phoenix stays as data/API service only (no frontend, no Guardian UI)
- CORS enabled for Next.js origin, Bearer token required for protected endpoints
