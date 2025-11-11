defmodule StoriaWeb.UserResetPasswordLiveTest do
  use StoriaWeb.ConnCase

  import Phoenix.LiveViewTest

  alias Storia.Accounts

  describe "Reset password page" do
    test "renders reset password page with valid token", %{conn: conn} do
      user = user_fixture()
      token = Accounts.generate_reset_token(user)

      {:ok, _lv, html} = live(conn, ~p"/users/reset_password/#{token}")

      assert html =~ "Reset Password"
    end

    test "redirects if token is invalid", %{conn: conn} do
      {:error, redirect} = live(conn, ~p"/users/reset_password/invalid-token")

      assert {:redirect, %{to: path, flash: flash}} = redirect
      assert path == ~p"/"
      assert flash["error"] == "Reset password link is invalid or it has expired."
    end
  end

  describe "Reset password" do
    test "resets password with valid token", %{conn: conn} do
      user = user_fixture()
      token = Accounts.generate_reset_token(user)

      {:ok, lv, _html} = live(conn, ~p"/users/reset_password/#{token}")

      {:ok, conn} =
        lv
        |> form("#reset_password_form",
          user: %{
            password: "NewPassword456",
            password_confirmation: "NewPassword456"
          }
        )
        |> render_submit()
        |> follow_redirect(conn, ~p"/users/log_in")

      assert Phoenix.Flash.get(conn.assigns.flash, :info) == "Password reset successfully."

      # Verify old password doesn't work
      assert {:error, :invalid_credentials} = Accounts.authenticate_user(user.email, "Password123")

      # Verify new password works
      assert {:ok, _} = Accounts.authenticate_user(user.email, "NewPassword456")
    end

    test "renders errors for invalid password", %{conn: conn} do
      user = user_fixture()
      token = Accounts.generate_reset_token(user)

      {:ok, lv, _html} = live(conn, ~p"/users/reset_password/#{token}")

      result =
        lv
        |> form("#reset_password_form",
          user: %{
            password: "short",
            password_confirmation: "short"
          }
        )
        |> render_submit()

      assert result =~ "should be at least 8 character"
    end

    test "renders errors for password mismatch", %{conn: conn} do
      user = user_fixture()
      token = Accounts.generate_reset_token(user)

      {:ok, lv, _html} = live(conn, ~p"/users/reset_password/#{token}")

      result =
        lv
        |> form("#reset_password_form",
          user: %{
            password: "NewPassword456",
            password_confirmation: "DifferentPassword789"
          }
        )
        |> render_submit()

      assert result =~ "does not match"
    end
  end

  describe "Forgot password page" do
    test "renders forgot password page", %{conn: conn} do
      {:ok, _lv, html} = live(conn, ~p"/users/reset_password")

      assert html =~ "Forgot your password?"
      assert html =~ "We'll send a password reset link to your inbox"
    end

    test "sends reset password instructions", %{conn: conn} do
      user = user_fixture()

      {:ok, lv, _html} = live(conn, ~p"/users/reset_password")

      {:ok, conn} =
        lv
        |> form("#reset_password_form", user: %{email: user.email})
        |> render_submit()
        |> follow_redirect(conn, ~p"/")

      assert Phoenix.Flash.get(conn.assigns.flash, :info) =~
               "If your email is in our system"
    end

    test "does not reveal if email is not registered", %{conn: conn} do
      {:ok, lv, _html} = live(conn, ~p"/users/reset_password")

      {:ok, conn} =
        lv
        |> form("#reset_password_form", user: %{email: "nonexistent@example.com"})
        |> render_submit()
        |> follow_redirect(conn, ~p"/")

      assert Phoenix.Flash.get(conn.assigns.flash, :info) =~
               "If your email is in our system"
    end
  end

  # Helper functions
  defp user_fixture(attrs \\ %{}) do
    {:ok, user} =
      attrs
      |> Enum.into(valid_user_attributes())
      |> Accounts.register_user()

    user
  end

  defp valid_user_attributes(attrs \\ %{}) do
    Enum.into(attrs, %{
      email: unique_user_email(),
      password: "Password123"
    })
  end

  defp unique_user_email, do: "user#{System.unique_integer([:positive])}@example.com"
end
