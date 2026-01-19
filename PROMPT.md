# Ralph Development Instructions

## Context
You are working on **Storia**, a children's book reading application built with Phoenix/Elixir. The project is being migrated to use Next.js for the frontend with BetterAuth for authentication, while Phoenix remains as a data API backend.

Current state:
- Phoenix backend with LiveView UI (to be deprecated)
- Guardian-based authentication (being replaced)
- PostgreSQL database
- Admin panel for book/scene management
- Reader functionality for authenticated users

Target state:
- Next.js frontend with BetterAuth (magic link + social auth)
- Phoenix as JSON API backend only
- Bearer token authentication between Next.js and Phoenix
- CORS-enabled API endpoints

## Objectives
Complete the migration outlined in `@fix_plan.md`. Work through tasks in priority order (High → Medium → Low). Focus on:
1. Phoenix API endpoint stubs with Bearer + admin role checks
2. Next.js file layout with BetterAuth integration
3. Maintaining styling parity by copying Tailwind classes from HEEx to JSX

## Key Principles
- **Incremental Progress**: Complete one task fully before moving to the next
- **Test as You Go**: Verify each change works before proceeding
- **Preserve Styling**: Copy exact Tailwind classes from existing HEEx templates
- **Security First**: Implement proper Bearer token validation and role checks
- **Clean Separation**: Phoenix handles data/API only; Next.js handles all UI

## Development Workflow
1. Read the current task from `@fix_plan.md`
2. Implement the change
3. Test the change (compile, run tests, manual verification)
4. Update `@fix_plan.md` to mark task complete
5. Move to next task

## Testing Guidelines
- Run `mix compile` to check for Elixir compilation errors
- Run `mix test` to verify existing tests pass
- For API endpoints, test with curl or similar
- For Next.js, use `npm run dev` and `npm run build`

## Status Reporting
After completing significant work, update status in this format:

```
## Status Update
- **Completed**: [What was done]
- **Current**: [What you're working on now]
- **Next**: [What comes next]
- **Blockers**: [Any issues encountered]
```

## Exit Scenarios
Signal `EXIT_RALPH` when:
1. All tasks in `@fix_plan.md` are marked complete
2. A blocker requires human input
3. Significant architectural decision needed

Do NOT exit when:
- A task is partially complete
- Tests are failing but you know how to fix them
- You're making progress on the current task

## File Structure Reference
```
storia/
├── @fix_plan.md          # Task list (update as you complete)
├── @AGENT.md             # Build/test commands
├── PROMPT.md             # This file
├── lib/                  # Elixir source
│   ├── storia/           # Business logic
│   └── storia_web/       # Phoenix web layer
├── config/               # Elixir configuration
├── priv/                 # Migrations, static assets
└── frontend/             # Next.js app (to be created)
    ├── app/              # Next.js App Router pages
    ├── lib/              # Shared utilities
    └── components/       # React components
```
