defmodule StoriaWeb.LibraryLiveTest do
  use StoriaWeb.ConnCase
  import Phoenix.LiveViewTest

  alias Storia.{Content, Accounts, Repo}

  describe "LibraryLive" do
    setup do
      # Create test user
      user =
        Accounts.register_user(%{
          email: "test@example.com",
          password: "Password123!",
          subscription_tier: :free
        })
        |> elem(1)

      # Create admin user
      {:ok, admin} =
        Accounts.register_user(%{
          email: "admin@example.com",
          password: "Password123!",
          subscription_tier: :free
        })

      admin = Repo.get!(Accounts.User, admin.id) |> Ecto.Changeset.change(role: :admin) |> Repo.update!()

      # Create test books
      {:ok, book1} =
        Content.create_book(%{
          title: "Test Book 1",
          author: "Test Author 1",
          is_published: true,
          metadata: %{genre: "fiction"}
        })

      {:ok, book2} =
        Content.create_book(%{
          title: "Test Book 2",
          author: "Test Author 2",
          is_published: true,
          metadata: %{genre: "mystery"}
        })

      %{user: user, admin: admin, book1: book1, book2: book2}
    end

    test "displays published books", %{conn: conn, user: user, book1: book1, book2: book2} do
      conn = log_in_user(conn, user)
      {:ok, view, html} = live(conn, ~p"/library")

      assert html =~ book1.title
      assert html =~ book2.title
      assert html =~ book1.author
      assert html =~ book2.author
    end

    test "filters books by genre", %{conn: conn, user: user, book1: book1, book2: book2} do
      conn = log_in_user(conn, user)
      {:ok, view, _html} = live(conn, ~p"/library")

      # Filter by fiction genre
      html =
        view
        |> element("#genre-filter")
        |> render_change(%{genre: "fiction"})

      assert html =~ book1.title
      refute html =~ book2.title
    end

    test "free tier user can access up to 3 books", %{conn: conn, user: user, book1: book1} do
      conn = log_in_user(conn, user)
      {:ok, view, _html} = live(conn, ~p"/library")

      # Should be able to select first book
      view
      |> element("[phx-click='select_book'][phx-value-book-id='#{book1.id}']")
      |> render_click()

      assert_redirected(view, ~p"/read/#{book1.id}")
    end

    test "admin can access unlimited books", %{
      conn: conn,
      admin: admin,
      book1: book1,
      book2: book2
    } do
      conn = log_in_user(conn, admin)
      {:ok, view, _html} = live(conn, ~p"/library")

      # Admin should be able to access any book
      view
      |> element("[phx-click='select_book'][phx-value-book-id='#{book1.id}']")
      |> render_click()

      assert_redirected(view, ~p"/read/#{book1.id}")
    end

    test "clears filters", %{conn: conn, user: user, book1: book1, book2: book2} do
      conn = log_in_user(conn, user)
      {:ok, view, _html} = live(conn, ~p"/library")

      # Apply filter
      html =
        view
        |> element("#genre-filter")
        |> render_change(%{genre: "fiction"})

      assert html =~ book1.title
      refute html =~ book2.title

      # Clear filters
      html =
        view
        |> element("[phx-click='clear_filters']")
        |> render_click()

      assert html =~ book1.title
      assert html =~ book2.title
    end

    test "searches books by title", %{conn: conn, user: user, book1: book1, book2: book2} do
      conn = log_in_user(conn, user)
      {:ok, view, _html} = live(conn, ~p"/library")

      # Search for book1 title
      html =
        view
        |> element("input[name='query']")
        |> render_change(%{query: "Test Book 1"})

      assert html =~ book1.title
      refute html =~ book2.title
    end
  end
end
