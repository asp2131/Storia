defmodule StoriaWeb.Controllers.AuthController do
  use StoriaWeb, :controller
  alias Storia.Accounts
  alias Storia.Guardian
  alias Storia.Mailer
  require Logger

  # POST /auth/request_magic_link
  def request_magic_link(conn, %{"email" => email}) do
    email = String.downcase(String.trim(email))

    # Find or register user
    user = case Accounts.get_user_by_email(email) do
      nil ->
        case Accounts.register_user(%{email: email, password: generate_random_password()}) do
          {:ok, user} -> user
          {:error, _} -> nil
        end
      user -> user
    end

    if user do
      # Generate a "magic" token valid for 15 minutes
      {:ok, token, _claims} = Guardian.encode_and_sign(user, %{magic: true}, ttl: {15, :minute})

      # Send Email
      magic_link = url(~p"/auth/magic_link?token=#{token}")
      send_magic_link_email(user.email, magic_link)

      conn
      |> put_flash(:info, "We sent a magic link to #{email}. Check your inbox!")
      |> redirect(to: ~p"/")
    else
      # Don't reveal user existence errors, just generic message
      conn
      |> put_flash(:error, "Could not sign in with that email.")
      |> redirect(to: ~p"/")
    end
  end

  # GET /auth/magic_link?token=...
  def magic_link(conn, %{"token" => token}) do
    case Guardian.decode_and_verify(token, %{"magic" => true}) do
      {:ok, claims} ->
        case Guardian.resource_from_claims(claims) do
          {:ok, user} ->
            conn
            |> put_flash(:info, "Welcome back!")
            |> Storia.Guardian.Plug.sign_in(user)
            |> redirect(to: ~p"/library")

          {:error, _reason} ->
            conn
            |> put_flash(:error, "Invalid token.")
            |> redirect(to: ~p"/")
        end

      {:error, _reason} ->
        conn
        |> put_flash(:error, "Invalid or expired link.")
        |> redirect(to: ~p"/")
    end
  end

  def logout(conn, _params) do
    conn
    |> Storia.Guardian.Plug.sign_out()
    |> put_flash(:info, "Logged out successfully.")
    |> redirect(to: ~p"/")
  end

  defp send_magic_link_email(email, url) do
    email_struct =
      Swoosh.Email.new()
      |> Swoosh.Email.to(email)
      |> Swoosh.Email.from({"Storia", "noreply@storia.app"})
      |> Swoosh.Email.subject("Your Magic Login Link")
      |> Swoosh.Email.html_body("""
        <h1>Log in to Storia</h1>
        <p>Click the link below to sign in:</p>
        <p><a href="#{url}">#{url}</a></p>
        <p>This link expires in 15 minutes.</p>
      """)
      |> Swoosh.Email.text_body("""
        Log in to Storia:
        #{url}

        This link expires in 15 minutes.
      """)

    case Mailer.deliver(email_struct) do
      {:ok, _} -> Logger.info("Magic link sent to #{email}")
      {:error, reason} -> Logger.error("Failed to send magic link: #{inspect(reason)}")
    end
  end

  defp generate_random_password do
    :crypto.strong_rand_bytes(32) |> Base.encode64()
  end
end
