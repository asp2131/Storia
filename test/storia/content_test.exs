defmodule Storia.ContentTest do
  use Storia.DataCase

  alias Storia.Content
  alias Storia.Content.Book

  describe "books" do
    @valid_attrs %{
      title: "Test Book",
      author: "Test Author",
      pdf_url: "test.pdf",
      source_type: "public_domain"
    }
    @update_attrs %{
      title: "Updated Book",
      author: "Updated Author",
      processing_status: "analyzing"
    }
    @invalid_attrs %{title: nil, author: nil}

    test "list_books/0 returns all books" do
      {:ok, book} = Content.create_book(@valid_attrs)
      assert Content.list_books() == [book]
    end

    test "get_book!/1 returns the book with given id" do
      {:ok, book} = Content.create_book(@valid_attrs)
      assert Content.get_book!(book.id) == book
    end

    test "create_book/1 with valid data creates a book" do
      assert {:ok, %Book{} = book} = Content.create_book(@valid_attrs)
      assert book.title == "Test Book"
      assert book.author == "Test Author"
      assert book.pdf_url == "test.pdf"
      assert book.source_type == "public_domain"
      assert book.processing_status == "pending"
      assert book.is_published == false
    end

    test "create_book/1 with invalid data returns error changeset" do
      assert {:error, %Ecto.Changeset{}} = Content.create_book(@invalid_attrs)
    end

    test "update_book/2 with valid data updates the book" do
      {:ok, book} = Content.create_book(@valid_attrs)
      assert {:ok, %Book{} = book} = Content.update_book(book, @update_attrs)
      assert book.title == "Updated Book"
      assert book.author == "Updated Author"
      assert book.processing_status == "analyzing"
    end

    test "update_book/2 with invalid data returns error changeset" do
      {:ok, book} = Content.create_book(@valid_attrs)
      assert {:error, %Ecto.Changeset{}} = Content.update_book(book, @invalid_attrs)
      assert book == Content.get_book!(book.id)
    end

    test "delete_book/1 deletes the book" do
      {:ok, book} = Content.create_book(@valid_attrs)
      assert {:ok, %Book{}} = Content.delete_book(book)
      assert_raise Ecto.NoResultsError, fn -> Content.get_book!(book.id) end
    end

    test "change_book/1 returns a book changeset" do
      {:ok, book} = Content.create_book(@valid_attrs)
      assert %Ecto.Changeset{} = Content.change_book(book)
    end

    test "update_book_status/3 updates the processing status" do
      {:ok, book} = Content.create_book(@valid_attrs)
      assert {:ok, updated_book} = Content.update_book_status(book.id, "extracting")
      assert updated_book.processing_status == "extracting"
    end

    test "update_book_status/3 with error updates status and error message" do
      {:ok, book} = Content.create_book(@valid_attrs)
      assert {:ok, updated_book} = Content.update_book_status(book.id, "failed", "Test error")
      assert updated_book.processing_status == "failed"
      assert updated_book.processing_error == "Test error"
    end
  end

  describe "pages" do
    setup do
      {:ok, book} = Content.create_book(%{
        title: "Test Book",
        author: "Test Author",
        pdf_url: "test.pdf"
      })

      %{book: book}
    end

    test "create_pages_batch/2 creates multiple pages", %{book: book} do
      pages_data = [
        %{page_number: 1, text_content: "Page 1 content"},
        %{page_number: 2, text_content: "Page 2 content"},
        %{page_number: 3, text_content: "Page 3 content"}
      ]

      {count, _} = Content.create_pages_batch(book.id, pages_data)
      assert count == 3

      pages = Content.list_pages_for_book(book.id)
      assert length(pages) == 3
      assert Enum.at(pages, 0).page_number == 1
      assert Enum.at(pages, 0).text_content == "Page 1 content"
    end

    test "list_pages_for_book/1 returns pages in order", %{book: book} do
      pages_data = [
        %{page_number: 3, text_content: "Page 3"},
        %{page_number: 1, text_content: "Page 1"},
        %{page_number: 2, text_content: "Page 2"}
      ]

      Content.create_pages_batch(book.id, pages_data)
      pages = Content.list_pages_for_book(book.id)

      assert length(pages) == 3
      assert Enum.at(pages, 0).page_number == 1
      assert Enum.at(pages, 1).page_number == 2
      assert Enum.at(pages, 2).page_number == 3
    end

    test "get_book_with_pages!/1 preloads pages", %{book: book} do
      pages_data = [
        %{page_number: 1, text_content: "Page 1"},
        %{page_number: 2, text_content: "Page 2"}
      ]

      Content.create_pages_batch(book.id, pages_data)
      book_with_pages = Content.get_book_with_pages!(book.id)

      assert length(book_with_pages.pages) == 2
      assert Ecto.assoc_loaded?(book_with_pages.pages)
    end
  end
end
