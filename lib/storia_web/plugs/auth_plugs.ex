defmodule StoriaWeb.Plugs.AuthPlugs do
  import Plug.Conn
  import Phoenix.Controller
  use StoriaWeb, :verified_routes

  def require_authenticated(conn, _opts) do
    if Guardian.Plug.current_resource(conn) do
      conn
    else
      conn
      |> put_flash(:error, "You must be logged in.")
      |> redirect(to: ~p"/")
      |> halt()
    end
  end

  def redirect_if_authenticated(conn, _opts) do
    if Guardian.Plug.current_resource(conn) do
      conn
      |> redirect(to: ~p"/library")
      |> halt()
    else
      conn
    end
  end

  def put_current_user(conn, _opts) do
    current_user = Guardian.Plug.current_resource(conn)
    assign(conn, :current_user, current_user)
  end
end
