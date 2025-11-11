# This file is responsible for configuring your application
# and its dependencies with the aid of the Config module.
#
# This configuration file is loaded before any dependency and
# is restricted to this project.

# General application configuration
import Config

config :storia,
  ecto_repos: [Storia.Repo],
  generators: [timestamp_type: :utc_datetime]

# Configures the endpoint
config :storia, StoriaWeb.Endpoint,
  url: [host: "localhost"],
  adapter: Bandit.PhoenixAdapter,
  render_errors: [
    formats: [html: StoriaWeb.ErrorHTML, json: StoriaWeb.ErrorJSON],
    layout: false
  ],
  pubsub_server: Storia.PubSub,
  live_view: [signing_salt: "400CKdlR"]

# Configures the mailer
#
# By default it uses the "Local" adapter which stores the emails
# locally. You can see the emails in your browser, at "/dev/mailbox".
#
# For production it's recommended to configure a different adapter
# at the `config/runtime.exs`.
config :storia, Storia.Mailer, adapter: Swoosh.Adapters.Local

# Configure esbuild (the version is required)
config :esbuild,
  version: "0.17.11",
  storia: [
    args:
      ~w(js/app.js --bundle --target=es2017 --outdir=../priv/static/assets --external:/fonts/* --external:/images/*),
    cd: Path.expand("../assets", __DIR__),
    env: %{"NODE_PATH" => Path.expand("../deps", __DIR__)}
  ]

# Configure tailwind (the version is required)
config :tailwind,
  version: "3.4.3",
  storia: [
    args: ~w(
      --config=tailwind.config.js
      --input=css/app.css
      --output=../priv/static/assets/app.css
    ),
    cd: Path.expand("../assets", __DIR__)
  ]

# Configures Elixir's Logger
config :logger, :console,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]

# Use Jason for JSON parsing in Phoenix
config :phoenix, :json_library, Jason

# Configure Oban
config :storia, Oban,
  repo: Storia.Repo,
  plugins: [Oban.Plugins.Pruner],
  queues: [
    pdf_processing: 2,
    ai_analysis: 5,
    default: 10
  ]

# Configure ExAws
config :ex_aws,
  json_codec: Jason,
  access_key_id: [{:system, "R2_ACCESS_KEY_ID"}],
  secret_access_key: [{:system, "R2_SECRET_ACCESS_KEY"}],
  region: "auto"

# Import environment specific config. This must remain at the bottom
# of this file so it overrides the configuration defined above.
import_config "#{config_env()}.exs"
