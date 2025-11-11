defmodule Storia.Repo do
  use Ecto.Repo,
    otp_app: :storia,
    adapter: Ecto.Adapters.Postgres
end
