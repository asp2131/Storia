# Storia - Build and Execution Instructions

## Project Setup

### Phoenix (Backend)
```bash
# Install dependencies
mix deps.get

# Setup database
mix ecto.setup

# Or if database exists, just migrate
mix ecto.migrate
```

### Next.js (Frontend) - Once Created
```bash
cd frontend
npm install
```

## Running Tests

### Phoenix Tests
```bash
# Run all tests
mix test

# Run specific test file
mix test test/storia_web/controllers/page_controller_test.exs

# Run with coverage
mix test --cover
```

### Next.js Tests - Once Created
```bash
cd frontend
npm test
npm run test:coverage
```

## Build Commands

### Phoenix
```bash
# Compile the project
mix compile

# Check for warnings as errors
mix compile --warnings-as-errors

# Build assets
mix assets.build

# Production build
MIX_ENV=prod mix release
```

### Next.js - Once Created
```bash
cd frontend
npm run build
npm run lint
```

## Development Server

### Phoenix
```bash
# Start Phoenix server
mix phx.server

# Or with IEx
iex -S mix phx.server
```

### Next.js - Once Created
```bash
cd frontend
npm run dev
```

## Database Commands
```bash
# Create database
mix ecto.create

# Run migrations
mix ecto.migrate

# Rollback last migration
mix ecto.rollback

# Reset database
mix ecto.reset

# Generate migration
mix ecto.gen.migration migration_name
```

## Key Learnings

### Phoenix/Elixir
- Use `use StoriaWeb, :verified_routes` for route helpers
- Import `Phoenix.Controller` in plugs for `json/2` and `put_status/2`
- Guardian is being phased out in favor of BetterAuth tokens

### Database
- PostgreSQL is the database
- Oban is used for background jobs
- Ecto is the ORM

### Styling
- Tailwind CSS is used throughout
- Custom fonts configured in `assets/css/app.css`
- Hero icons from `tailwindlabs/heroicons`

## Feature Development Quality Standards

All new features MUST meet the following requirements before being considered complete:

### Testing Requirements
- All new code must have corresponding tests
- Existing tests must continue to pass
- `mix compile --warnings-as-errors` must pass

### Git Workflow
- Use conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`
- Keep commits focused and atomic
- Do not commit broken code

### Documentation
- Update `@fix_plan.md` as tasks are completed
- Add inline comments for non-obvious logic
- Update this file if new build/test patterns emerge

### Feature Completion Checklist
- [ ] Code compiles without warnings
- [ ] All tests pass
- [ ] New functionality is tested
- [ ] `@fix_plan.md` updated
- [ ] No security vulnerabilities introduced

## Environment Variables

Required in `.env`:
```
DATABASE_URL=postgres://user:pass@localhost/storia_dev
SECRET_KEY_BASE=...
GUARDIAN_SECRET_KEY=...
BETTERAUTH_JWT_PUBLIC_KEY=... (once BetterAuth is integrated)
```

## Common Issues

### Compilation Errors
- Check for missing imports: `import Plug.Conn`, `import Phoenix.Controller`
- Verify module names match file paths

### Database Connection
- Ensure PostgreSQL is running
- Check `config/dev.exs` for database credentials

### CORS Issues (API development)
- CORS plug needs to be configured for Next.js origin
- Check `config/config.exs` for CORS settings once added
