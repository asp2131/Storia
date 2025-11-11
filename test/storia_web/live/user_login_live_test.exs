defmodule StoriaWeb.UserLoginLiveTest do
  use StoriaWeb.ConnCase

  import Phoenix.LiveViewTest

  describe "Log in page" do
    test "renders log in page", %{conn: conn} do
      {:ok, _lv, html} = live(conn, ~p"/users/log_in")

      assert html =~ "Sign in to account"
      assert html =~ "Register"
      assert html =~ "Forgot your password?"
    end

    test "redirects if already logged in", %{conn: conn} do
      user = user_fixture()
      conn = log_in_user(conn, user)

      {:error, redirect} = live(conn, ~p"/users/log_in")

      assert {:redirect, %{to: path}} = redirect
      assert path == ~p"/"
    end
  end

  describe "user login" do
    test "redirects if user login with valid credentials", %{conn: conn} do
      password = "Password123"
      user = user_fixture(%{password: password})

      {:ok, lv, _html} = live(conn, ~p"/users/log_in")

      form =
        form(lv, "#login_form", user: %{email: user.email, password: password, remember_me: true})

      conn = submit_form(form, conn)

      assert redirected_to(conn) == ~p"/"
    end

    test "redirects to login page with a flash error if there are no valid credentials", %{
      conn: conn
    } do
      {:ok, lv, _html} = live(conn, ~p"/users/log_in")

      form =
        form(lv, "#login_form",
          user: %{email: "test@example.com", password: "invalid", remember_me: true}
        )

      conn = submit_form(form, conn)

      assert Phoenix.Flash.get(conn.assigns.flash, :error) == "Invalid email or password"

      assert redirected_to(conn) =~ ~p"/users/log_in"
    end
  end

  describe "login navigation" do
    test "redirects to registration page when clicking register link", %{conn: conn} do
      {:ok, lv, _html} = live(conn, ~p"/users/log_in")

      {:ok, _register_live, register_html} =
        lv
        |> element(~s|main a[href="#{~p"/users/register"}"]|)
        |> render_click()
        |> follow_redirect(conn, ~p"/users/register")

      assert register_html =~ "Register for an account"
    end

    test "redirects to forgot password page when clicking forgot password link", %{conn: conn} do
      {:ok, lv, _html} = live(conn, ~p"/users/log_in")

      {:ok, _forgot_password_live, forgot_password_html} =
        lv
        |> element(~s|main a[href="#{~p"/users/reset_password"}"]|)
        |> render_click()
        |> follow_redirect(conn, ~p"/users/reset_password")

      assert forgot_password_html =~ "Forgot your password?"
    end
  end

  # Helper functions
  defp user_fixture(attrs \\ %{}) do
    {:ok, user} =
      attrs
      |> Enum.into(valid_user_attributes())
      |> Storia.Accounts.register_user()

    user
  end

  defp valid_user_attributes(attrs \\ %{}) do
    Enum.into(attrs, %{
      email: unique_user_email(),
      password: "Password123"
    })
  end

  defp unique_user_email, do: "user#{System.unique_integer([:positive])}@example.com"

  defp log_in_user(conn, user) do
    token = Storia.Accounts.generate_user_session_token(user)

    conn
    |> Phoenix.ConnTest.init_test_session(%{})
    |> Plug.Conn.put_session(:user_token, token)
  end
end
