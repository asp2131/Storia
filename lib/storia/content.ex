defmodule Storia.Content do
  @moduledoc """
  The Content context handles books, pages, scenes, and reading progress.
  """

  import Ecto.Query, warn: false
  alias Storia.Repo

  alias Storia.Content.{Book, Page}

  @doc """
  Returns the list of books.

  ## Examples

      iex> list_books()
      [%Book{}, ...]

  """
  def list_books do
    Book
    |> order_by([b], desc: b.updated_at)
    |> Repo.all()
  end

  @doc """
  Searches books by title or author.

  ## Examples

      iex> search_books("midnight")
      [%Book{title: "The Midnight Library"}, ...]

  """
  def search_books(query) when is_binary(query) do
    search_term = "%#{query}%"

    Book
    |> where([b], ilike(b.title, ^search_term) or ilike(b.author, ^search_term))
    |> order_by([b], desc: b.updated_at)
    |> Repo.all()
  end

  @doc """
  Gets a single book.

  Raises `Ecto.NoResultsError` if the Book does not exist.

  ## Examples

      iex> get_book!(123)
      %Book{}

      iex> get_book!(456)
      ** (Ecto.NoResultsError)

  """
  def get_book!(id), do: Repo.get!(Book, id)

  @doc """
  Gets a single book. Returns nil if not found.

  ## Examples

      iex> get_book(123)
      %Book{}

      iex> get_book(456)
      nil

  """
  def get_book(id), do: Repo.get(Book, id)

  @doc """
  Gets a single book with preloaded associations.
  """
  def get_book_with_pages!(id) do
    Book
    |> Repo.get!(id)
    |> Repo.preload([:pages, :scenes])
  end

  @doc """
  Gets a single book with scenes and their soundscapes preloaded.
  """
  def get_book_with_scenes_and_soundscapes!(id) do
    Book
    |> Repo.get!(id)
    |> Repo.preload(scenes: [soundscapes: :scene])
  end

  @doc """
  Gets a single book with scenes and their soundscapes preloaded.
  Returns nil if not found.
  """
  def get_book_with_scenes_and_soundscapes(id) do
    case Repo.get(Book, id) do
      nil -> nil
      book -> Repo.preload(book, scenes: [soundscapes: :scene])
    end
  end

  @doc """
  Creates a book.

  ## Examples

      iex> create_book(%{field: value})
      {:ok, %Book{}}

      iex> create_book(%{field: bad_value})
      {:error, %Ecto.Changeset{}}

  """
  def create_book(attrs \\ %{}) do
    %Book{}
    |> Book.changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Updates a book.

  ## Examples

      iex> update_book(book, %{field: new_value})
      {:ok, %Book{}}

      iex> update_book(book, %{field: bad_value})
      {:error, %Ecto.Changeset{}}

  """
  def update_book(%Book{} = book, attrs) do
    book
    |> Book.changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Deletes a book.

  ## Examples

      iex> delete_book(book)
      {:ok, %Book{}}

      iex> delete_book(book)
      {:error, %Ecto.Changeset{}}

  """
  def delete_book(%Book{} = book) do
    Repo.delete(book)
  end

  @doc """
  Returns an `%Ecto.Changeset{}` for tracking book changes.

  ## Examples

      iex> change_book(book)
      %Ecto.Changeset{data: %Book{}}

  """
  def change_book(%Book{} = book, attrs \\ %{}) do
    Book.changeset(book, attrs)
  end

  @doc """
  Creates pages in batch for a book.
  """
  def create_pages_batch(book_id, pages_data) do
    timestamp = NaiveDateTime.utc_now() |> NaiveDateTime.truncate(:second)

    pages =
      Enum.map(pages_data, fn page_data ->
        %{
          book_id: book_id,
          page_number: page_data.page_number,
          text_content: page_data.text_content,
          inserted_at: timestamp,
          updated_at: timestamp
        }
      end)

    Repo.insert_all(Page, pages)
  end

  @doc """
  Gets all pages for a book.
  """
  def list_pages_for_book(book_id) do
    Page
    |> where([p], p.book_id == ^book_id)
    |> order_by([p], asc: p.page_number)
    |> Repo.all()
  end

  @doc """
  Updates book processing status.
  """
  def update_book_status(book_id, status, error \\ nil) do
    book = get_book!(book_id)
    attrs = %{processing_status: status}
    attrs = if error, do: Map.put(attrs, :processing_error, error), else: attrs

    update_book(book, attrs)
  end
end
