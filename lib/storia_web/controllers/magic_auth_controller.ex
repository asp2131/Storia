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

  defp auth_redirect(step, mode, email) do
    "/?" <>
      URI.encode_query(%{
        "auth" => step,
        "mode" => mode,
        "email" => email
      })
  end
end
