defmodule StoriaWeb.UserRegistrationController do
  use StoriaWeb, :controller

  alias Storia.Accounts
  alias StoriaWeb.UserAuth

  def create(conn, %{"user" => user_params}) do
    case Accounts.register_user(user_params) do
      {:ok, user} ->
        {:ok, _} =
          Accounts.deliver_user_confirmation_instructions(
            user,
            &url(~p"/users/confirm/#{&1}")
          )

        conn
        |> put_flash(:info, "Account created successfully!")
        |> UserAuth.log_in_user(user, user_params)

      {:error, _changeset} ->
        conn
        |> put_flash(:error, "Unable to create account. Check your email and password.")
        |> redirect(to: ~p"/")
    end
  end
end
