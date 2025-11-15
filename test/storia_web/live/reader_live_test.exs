defmodule StoriaWeb.ReaderLiveTest do
  use StoriaWeb.ConnCase
  import Phoenix.LiveViewTest

  alias Storia.{Content, Accounts}

  describe "ReaderLive" do
    setup do
      # Create test user
      {:ok, user} =
        Accounts.register_user(%{
          email: "test@example.com",
          password: "Password123!",
          subscription_tier: :free
        })

      # Create test book with pages
      {:ok, book} =
        Content.create_book(%{
          title: "Test Book",
          author: "Test Author",
          is_published: true,
          total_pages: 10
        })

      # Create pages
      for page_num <- 1..10 do
        Content.create_page(%{
          book_id: book.id,
          page_number: page_num,
          text_content: "Content for page #{page_num}"
        })
      end

      # Create scenes
      {:ok, scene1} =
        Content.create_scene(%{
          book_id: book.id,
          start_page: 1,
          end_page: 5,
          descriptors: %{mood: "calm"}
        })

      {:ok, scene2} =
        Content.create_scene(%{
          book_id: book.id,
          start_page: 6,
          end_page: 10,
          descriptors: %{mood: "tense"}
        })

      %{user: user, book: book, scene1: scene1, scene2: scene2}
    end

    test "displays book content", %{conn: conn, user: user, book: book} do
      conn = log_in_user(conn, user)
      {:ok, _view, html} = live(conn, ~p"/read/#{book.id}")

      assert html =~ book.title
      assert html =~ book.author
      assert html =~ "Content for page 1"
    end

    test "navigates to next page", %{conn: conn, user: user, book: book} do
      conn = log_in_user(conn, user)
      {:ok, view, html} = live(conn, ~p"/read/#{book.id}")

      # Should start on page 1
      assert html =~ "Content for page 1"

      # Click next
      html =
        view
        |> element("button", "Next")
        |> render_click()

      # Should now be on page 2
      assert html =~ "Content for page 2"
    end

    test "navigates to previous page", %{conn: conn, user: user, book: book} do
      conn = log_in_user(conn, user)

      # Start on page 2
      Content.update_reading_progress(user.id, book.id, 2)

      {:ok, view, html} = live(conn, ~p"/read/#{book.id}")

      # Should start on page 2
      assert html =~ "Content for page 2"

      # Click previous
      html =
        view
        |> element("button", "Previous")
        |> render_click()

      # Should now be on page 1
      assert html =~ "Content for page 1"
    end

    test "disables previous button on first page", %{conn: conn, user: user, book: book} do
      conn = log_in_user(conn, user)
      {:ok, _view, html} = live(conn, ~p"/read/#{book.id}")

      # Previous button should be disabled on first page
      assert html =~ "disabled"
    end

    test "disables next button on last page", %{conn: conn, user: user, book: book} do
      conn = log_in_user(conn, user)

      # Start on last page
      Content.update_reading_progress(user.id, book.id, 10)

      {:ok, _view, html} = live(conn, ~p"/read/#{book.id}")

      # Next button should be disabled on last page
      assert html =~ "disabled"
    end

    test "updates volume", %{conn: conn, user: user, book: book} do
      conn = log_in_user(conn, user)
      {:ok, view, _html} = live(conn, ~p"/read/#{book.id}")

      # Update volume
      view
      |> element("input[name='volume']")
      |> render_change(%{volume: "0.5"})

      # Volume should be updated in assigns
      assert view.assigns.volume == 0.5
    end

    test "toggles audio", %{conn: conn, user: user, book: book} do
      conn = log_in_user(conn, user)
      {:ok, view, _html} = live(conn, ~p"/read/#{book.id}")

      # Initially audio is enabled
      assert view.assigns.audio_enabled == true

      # Toggle audio off
      view
      |> element("[phx-click='toggle_audio']")
      |> render_click()

      # Audio should be disabled
      assert view.assigns.audio_enabled == false
    end

    test "prevents access for non-authenticated users", %{conn: conn, book: book} do
      # Try to access without logging in
      {:error, {:redirect, %{to: path}}} = live(conn, ~p"/read/#{book.id}")

      # Should redirect to login page
      assert path == ~p"/users/log_in"
    end

    test "saves reading progress", %{conn: conn, user: user, book: book} do
      conn = log_in_user(conn, user)
      {:ok, view, _html} = live(conn, ~p"/read/#{book.id}")

      # Navigate to page 5
      view
      |> element("input[name='page']")
      |> render_change(%{page: "5"})

      # Give async task time to complete
      Process.sleep(100)

      # Check that progress was saved
      progress = Content.get_reading_progress(user.id, book.id)
      assert progress.current_page == 5
    end
  end
end
