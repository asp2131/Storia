defmodule StoriaWeb.Auth.Pipeline do
  use Guardian.Plug.Pipeline,
    otp_app: :storia,
    module: Storia.Guardian,
    error_handler: StoriaWeb.Auth.ErrorHandler

  plug Guardian.Plug.VerifySession, claims: %{"typ" => "access"}
  plug Guardian.Plug.VerifyHeader, claims: %{"typ" => "access"}
  plug Guardian.Plug.LoadResource, allow_blank: true
end

defmodule StoriaWeb.Auth.ErrorHandler do
  import Plug.Conn
  use StoriaWeb, :controller

  @behaviour Guardian.Plug.ErrorHandler

  @impl Guardian.Plug.ErrorHandler
  def auth_error(conn, {type, _reason}, _opts) do
    conn
    |> put_flash(:error, "You must be logged in to access that page.")
    |> redirect(to: ~p"/")
  end
end
