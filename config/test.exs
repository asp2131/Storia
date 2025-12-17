import Config

# Configure your database
#
# The MIX_TEST_PARTITION environment variable can be used
# to provide built-in test partitioning in CI environment.
# Run `mix help test` for more information.
#
# Use Supabase DATABASE_URL if available, otherwise fall back to local PostgreSQL
database_url = System.get_env("DATABASE_URL")

if database_url do
  config :storia, Storia.Repo,
    url: database_url,
    # Disable prepared statements for Supabase transaction mode pooler
    prepare: :unnamed,
    pool: Ecto.Adapters.SQL.Sandbox,
    pool_size: System.schedulers_online() * 2,
    ownership_timeout: 3_600_000,
    # Connection settings for long-running tests with PgBouncer
    timeout: 300_000,
    queue_target: 5000,
    queue_interval: 1000,
    connect_timeout: 60_000,
    handshake_timeout: 60_000,
    # Keep connections alive during long AI operations
    parameters: [tcp_keepalives_idle: "600"]
else
  config :storia, Storia.Repo,
    username: "postgres",
    password: "postgres",
    hostname: "localhost",
    database: "storia_test#{System.get_env("MIX_TEST_PARTITION")}",
    pool: Ecto.Adapters.SQL.Sandbox,
    pool_size: System.schedulers_online() * 2,
    ownership_timeout: 3_600_000
end

# We don't run a server during test. If one is required,
# you can enable the server option below.
config :storia, StoriaWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4002],
  secret_key_base: "P/kkgQ7D9k6msdvvbCGbScnXLEemYzMEeZ7yep9jT6+ucMxp/H71/Oq7c2csMgtl",
  server: false

# In test we don't send emails
config :storia, Storia.Mailer, adapter: Swoosh.Adapters.Test

# Disable swoosh api client as it is only required for production adapters
config :swoosh, :api_client, false

# Print only warnings and errors during test
config :logger, level: :warning

# Initialize plugs at runtime for faster test compilation
config :phoenix, :plug_init_mode, :runtime

# Enable helpful, but potentially expensive runtime checks
config :phoenix_live_view,
  enable_expensive_runtime_checks: true

# Disable Oban during tests
config :storia, Oban, testing: :manual
