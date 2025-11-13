defmodule StoriaWeb.Plugs.RequireAdmin do
  @moduledoc """
  Plug to ensure the current user has admin role.
  
  Redirects non-admin users to the home page with an error message.
  """

  import Plug.Conn
  import Phoenix.Controller

  def init(opts), do: opts

  def call(conn, _opts) do
    case conn.assigns[:current_user] do
      %{role: :admin} ->
        conn

      %{role: _} ->
        conn
        |> put_flash(:error, "You must be an administrator to access this page.")
        |> redirect(to: "/")
        |> halt()

      nil ->
        conn
        |> put_flash(:error, "You must be logged in to access this page.")
        |> redirect(to: "/users/log_in")
        |> halt()
    end
  end
end
