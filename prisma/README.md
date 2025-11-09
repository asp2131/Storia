# Prisma Database Setup

## Initial Setup

The database has been initialized with the following tables:
- `users` - User accounts with authentication
- `books` - Uploaded PDF books
- `pages` - Individual pages extracted from books
- `scenes` - Narrative scenes detected across page spreads
- `soundscapes` - AI-generated audio for each scene
- `reading_progress` - User reading position tracking

## Database Commands

### Generate Prisma Client
```bash
npm run db:generate
# or
npx prisma generate
```

### Create and Apply Migrations
```bash
npm run db:migrate
# or
npx prisma migrate dev --name migration_name
```

### Open Prisma Studio (Database GUI)
```bash
npm run db:studio
# or
npx prisma studio
```

### Reset Database (WARNING: Deletes all data)
```bash
npx prisma migrate reset
```

## Schema Overview

### Relationships
- User → Books (one-to-many)
- User → ReadingProgress (one-to-many)
- Book → Pages (one-to-many)
- Book → Scenes (one-to-many)
- Scene → Soundscapes (one-to-many)
- Scene → Pages (one-to-many)

### Indexes
- `books.user_id` - Fast user book lookups
- `pages.book_id` - Fast page queries
- `scenes.book_id` - Fast scene queries
- `scenes.book_id, page_spread_index` - Fast scene lookup by page spread
- `reading_progress.user_id, book_id` - Fast progress queries

## Connection String Format

```
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
```

Example for local development:
```
DATABASE_URL="postgresql://akinpound@localhost:5432/immersive_reading?schema=public"
```

## Testing Connection

Visit `/api/health` endpoint to test database connectivity:
```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "ok",
  "database": "connected",
  "counts": {
    "users": 0,
    "books": 0
  }
}
```
