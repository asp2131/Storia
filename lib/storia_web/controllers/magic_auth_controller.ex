defmodule StoriaWeb.MagicAuthController do
  use StoriaWeb, :controller

  def request_code(conn, %{"email" => email} = params) do
    mode = Map.get(params, "mode", "login")

    case MagicAuth.create_one_time_password(%{"email" => email}) do
      {:ok, _code, one_time_password} ->
        conn
        |> put_flash(:info, "We sent a login code to #{one_time_password.email}.")
        |> redirect(to: auth_redirect("verify", mode, one_time_password.email))

      {:error, :rate_limited, countdown} ->
        message =
          MagicAuth.Config.callback_module().translate_error(:too_many_one_time_password_requests,
            countdown: div(countdown, 1000)
          )

        conn
        |> put_flash(:error, message)
        |> redirect(to: auth_redirect(mode, mode, email))

      {:error, _changeset} ->
        conn
        |> put_flash(:error, "Please enter a valid email address.")
        |> redirect(to: auth_redirect(mode, mode, email))
    end
  end

  def verify(conn, %{"email" => email, "code" => code}) do
    sanitized_code = code |> String.replace(~r/\s+/, "") |> String.trim()
    MagicAuth.log_in(conn, email, sanitized_code)
  end

  def logout(conn, _params) do
    # Custom logout logic to redirect to landing page instead of login page
    # This duplicates the logic from MagicAuth.log_out/1 but changes the redirect

    # 1. Clean up database session
    session_token = get_session(conn, :session_token)
    if session_token do
      # MagicAuth.Repo is an alias for our Repo in config
      import Ecto.Query
      Storia.Repo.delete_all(from s in MagicAuth.Session, where: s.token == ^session_token)
    end

    # 2. Broadcast disconnect to LiveViews
    if live_socket_id = get_session(conn, :live_socket_id) do
      StoriaWeb.Endpoint.broadcast(live_socket_id, "disconnect", %{})
    end

    # 3. Clean up Conn session and cookie
    conn
    |> configure_session(renew: true)
    |> clear_session()
    |> delete_resp_cookie(MagicAuth.Config.remember_me_cookie())
    |> put_flash(:info, "Logged out successfully.")
    |> redirect(to: ~p"/")
  end

  defp auth_redirect(step, mode, email) do
    "/?" <>
      URI.encode_query(%{
        "auth" => step,
        "mode" => mode,
        "email" => email
      })
  end
end
