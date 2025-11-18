# Database Architecture

This document describes Storia's database configuration and connection architecture using Supabase PostgreSQL.

## Overview

Storia uses **Supabase PostgreSQL** as its primary database, with a dual-connection strategy optimized for different workloads:

- **Transaction Mode** (port 6543) - For general application queries
- **Session Mode** (port 5432) - For migrations and long-running transactions

## Connection Modes

### Transaction Mode Pooler

**Port**: 6543
**Environment Variable**: `DATABASE_URL`

**Characteristics:**
- Connection pooling optimized for serverless/short-lived connections
- Automatically recycles connections between requests
- **Does not support prepared statements** (must set `prepare: :unnamed`)
- Ideal for application queries in Phoenix controllers and LiveViews
- Lower latency for short queries
- Better resource utilization for auto-scaling workloads

**Use Cases:**
- All general application queries
- Phoenix web requests
- LiveView updates
- Background job queries (Oban)

**Configuration:**
```elixir
# config/dev.exs and config/runtime.exs
config :storia, Storia.Repo,
  url: database_url,
  prepare: :unnamed,  # Required for transaction mode!
  # ... other options
```

### Session Mode Pooler

**Port**: 5432
**Environment Variable**: `DIRECT_URL`

**Characteristics:**
- Direct persistent connection to the database
- Supports prepared statements
- Supports complex transactions
- Required for database migrations
- Suitable for long-running operations
- Higher latency but more features

**Use Cases:**
- Running database migrations (`mix ecto.migrate`)
- Complex multi-statement transactions
- Database maintenance operations
- Schema changes

**When to Use:**
Currently, Phoenix/Ecto migrations automatically use `DATABASE_URL`. If you need to run migrations with a different connection (e.g., using `DIRECT_URL`), you would need to temporarily set:

```bash
export DATABASE_URL=$DIRECT_URL
mix ecto.migrate
```

However, with `prepare: :unnamed` configured, migrations work fine with transaction mode.

## Connection String Format

### Transaction Mode
```
DATABASE_URL=postgresql://postgres.[PROJECT_ID]:[PASSWORD]@aws-1-ca-central-1.pooler.supabase.com:6543/postgres
```

### Session Mode
```
DIRECT_URL=postgresql://postgres.[PROJECT_ID]:[PASSWORD]@aws-1-ca-central-1.pooler.supabase.com:5432/postgres
```

**Components:**
- `postgres.[PROJECT_ID]` - Username includes your project ID
- `[PASSWORD]` - Your database password
- `aws-1-ca-central-1.pooler.supabase.com` - Hostname (varies by region)
- `:6543` - Transaction mode port
- `:5432` - Session mode port
- `/postgres` - Database name

**Important Notes:**
- The hostname may vary based on your Supabase project region
- Check your Supabase dashboard for the exact connection strings
- Always use the latest connection string from the dashboard if you reset your password

## Environment Variable Loading

Storia uses **dotenvy** to automatically load environment variables from `.env` files in development and test environments.

### Configuration

```elixir
# config/config.exs
if config_env() in [:dev, :test] do
  if Code.ensure_loaded?(Dotenvy) do
    Dotenvy.source!([".env", System.get_env()])
  end
end
```

### Benefits

- ✅ **Automatic loading** - No need to manually `export` variables
- ✅ **Developer-friendly** - Just run `mix phx.server` or `mix ecto.migrate`
- ✅ **Environment isolation** - Only loads in dev/test, not production
- ✅ **Simple syntax** - Plain `KEY=value` pairs in `.env` file

### Example `.env`

```bash
# Database
DATABASE_URL=postgresql://postgres.abc123:password@aws-1-ca-central-1.pooler.supabase.com:6543/postgres
DIRECT_URL=postgresql://postgres.abc123:password@aws-1-ca-central-1.pooler.supabase.com:5432/postgres

# Supabase
SUPABASE_URL=https://abc123.supabase.co
SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
SUPABASE_STORAGE_BUCKET=storia-storage
```

## Database Schema

Storia's database schema is managed via Ecto migrations located in `priv/repo/migrations/`.

### Core Tables

#### `users`
- User accounts and authentication
- Columns: `email`, `hashed_password`, `role`, `subscription_tier`, etc.
- Roles: `:user`, `:admin`
- Subscription tiers: `:free`, `:reader`, `:bibliophile`

#### `books`
- Book metadata and processing status
- Columns: `title`, `author`, `pdf_url`, `processing_status`, `metadata`, etc.
- Processing statuses: `:pending`, `:processing`, `:completed`, `:failed`, `:published`

#### `pages`
- Individual pages extracted from PDFs
- Columns: `book_id`, `page_number`, `text_content`, `scene_id`
- Foreign key to `books` with cascade delete

#### `scenes`
- Scene definitions for soundscape generation
- Columns: `book_id`, `scene_number`, `start_page_id`, `end_page_id`, `classification`, `mood_tags`
- Foreign key to `books` with cascade delete

#### `soundscapes`
- Generated or curated ambient audio for scenes
- Columns: `scene_id`, `audio_url`, `source_type`, `generation_prompt`
- Source types: `:generated`, `:curated`
- Foreign key to `scenes` with cascade delete

#### `reading_progress`
- Track user's reading position in books
- Columns: `user_id`, `book_id`, `page_id`, `last_read_at`
- Unique constraint on `(user_id, book_id)`

#### `oban_jobs` and `oban_peers`
- Background job processing tables
- Managed by Oban library

### Indexes

#### Search and Performance Indexes
```sql
-- Full-text search on books
CREATE INDEX books_search_idx ON books USING GIN (
  to_tsvector('english', coalesce(title, '') || ' ' || coalesce(author, ''))
);

-- Metadata JSONB search
CREATE INDEX books_metadata_gin_idx ON books USING GIN (metadata);

-- Reading progress lookup
CREATE INDEX reading_progress_user_id_index ON reading_progress (user_id);
CREATE INDEX reading_progress_book_id_index ON reading_progress (book_id);
```

## Connection Pooling

### Development Configuration

```elixir
# config/dev.exs
config :storia, Storia.Repo,
  url: database_url,
  prepare: :unnamed,
  stacktrace: true,
  show_sensitive_data_on_connection_error: true,
  pool_size: 10
```

### Production Configuration

```elixir
# config/runtime.exs
config :storia, Storia.Repo,
  ssl: true,
  url: database_url,
  prepare: :unnamed,
  pool_size: String.to_integer(System.get_env("POOL_SIZE") || "10"),
  socket_options: maybe_ipv6
```

**Pool Size Recommendations:**
- **Development**: 10 connections
- **Production (single instance)**: 10-20 connections
- **Production (scaled)**: Adjust based on concurrent users and Supabase limits

## Troubleshooting

### Connection Issues

#### "Tenant or user not found"
**Cause**: Incorrect hostname or password in connection string.

**Solution**:
1. Go to Supabase Dashboard → Database → Connection string
2. Copy the latest connection string
3. Ensure you're using the correct region hostname (`aws-0` vs `aws-1`)
4. Verify your database password is current

#### "Prepared statement not supported"
**Cause**: Missing `prepare: :unnamed` configuration.

**Solution**:
```elixir
# Add to config/dev.exs and config/runtime.exs
config :storia, Storia.Repo,
  prepare: :unnamed,  # This line is required!
  # ... other options
```

#### "Connection timeout" or "Connection refused"
**Cause**: Firewall, network issues, or Supabase project is paused.

**Solution**:
1. Check Supabase project is active in dashboard
2. Verify your IP is not blocked (Supabase has no IP restrictions by default)
3. Test connection with `psql`:
   ```bash
   psql "postgresql://postgres.PROJECT_ID:PASSWORD@HOST:6543/postgres"
   ```

#### Environment variables not loading
**Cause**: Missing `.env` file or dotenvy not installed.

**Solution**:
1. Ensure `.env` file exists in project root
2. Run `mix deps.get` to install dotenvy
3. Verify `.env` syntax (no quotes needed for simple values)
4. Check `config/config.exs` has dotenvy configuration

### Performance Issues

#### Slow queries
**Solution**:
1. Check indexes are created: `mix ecto.migrations`
2. Use `EXPLAIN ANALYZE` in psql to analyze query performance
3. Add indexes for frequently queried columns
4. Consider denormalization for read-heavy tables

#### Connection pool exhausted
**Solution**:
1. Increase `pool_size` in configuration
2. Check for long-running transactions
3. Ensure connections are properly released
4. Monitor Supabase dashboard for connection usage

## Monitoring

### Database Metrics

**Supabase Dashboard:**
- Navigate to Database → Reports
- Monitor connection count, query performance, and storage usage

**IEx Commands:**
```elixir
# Check connection pool status
:sys.get_state(Storia.Repo)

# Count database records
Storia.Repo.aggregate(Storia.Content.Book, :count)

# View active Oban jobs
Storia.Repo.all(Oban.Job)
```

### Logging

**Enable query logging:**
```elixir
# config/dev.exs
config :logger, :console,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]

config :storia, Storia.Repo,
  log: :info  # Logs all queries
```

## Best Practices

1. **Use transaction mode for app queries** - Leverage connection pooling
2. **Keep transactions short** - Avoid long-running transactions
3. **Use indexes** - Especially for foreign keys and search columns
4. **Monitor connection usage** - Stay within Supabase limits
5. **Use cascade deletes** - Maintain referential integrity
6. **Test with realistic data** - Performance degrades with large datasets
7. **Regular backups** - Supabase provides daily backups, but consider additional backups for critical data

## Migration Guide

See [`docs/supabase_migration_guide.md`](./supabase_migration_guide.md) for detailed instructions on:
- Setting up Supabase
- Getting connection strings
- Running migrations
- Troubleshooting connection issues

## Related Documentation

- [Supabase PostgreSQL Documentation](https://supabase.com/docs/guides/database/overview)
- [Connection Pooling Guide](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Ecto SQL Documentation](https://hexdocs.pm/ecto_sql/Ecto.Adapters.SQL.html)
- [Phoenix Database Guide](https://hexdocs.pm/phoenix/ecto.html)
