defmodule Storia.Repo.Migrations.DropMagicAuthTables do
  use Ecto.Migration

  def change do
    drop_if_exists table(:magic_auth_one_time_passwords)
    drop_if_exists table(:magic_auth_sessions)
  end
end
