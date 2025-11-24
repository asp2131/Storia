defmodule Storia.Content do
  @moduledoc """
  The Content context handles books, pages, scenes, and reading progress.
  """

  import Ecto.Query, warn: false
  alias Storia.Repo

  alias Storia.Content.{Book, Page, ReadingProgress, Scene}

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
    |> Repo.preload(scenes: [:soundscape])
  end

  @doc """
  Gets a single book with scenes and their soundscapes preloaded.
  Returns nil if not found.
  """
  def get_book_with_scenes_and_soundscapes(id) do
    case Repo.get(Book, id) do
      nil -> nil
      book -> Repo.preload(book, scenes: [:soundscape])
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

  @doc """
  Lists all published books.
  """
  def list_published_books do
    Book
    |> where([b], b.is_published == true)
    |> order_by([b], desc: b.inserted_at)
    |> Repo.all()
  end

  @doc """
  Lists published books with optional filters.
  """
  def list_published_books(filters) do
    query = from b in Book, where: b.is_published == true

    query =
      if genre = filters[:genre] do
        where(query, [b], fragment("? @> ?", b.metadata, ^%{genre: genre}))
      else
        query
      end

    query =
      if author = filters[:author] do
        where(query, [b], ilike(b.author, ^"%#{author}%"))
      else
        query
      end

    query
    |> order_by([b], desc: b.inserted_at)
    |> Repo.all()
  end

  @doc """
  Gets or creates reading progress for a user and book.
  """
  def get_or_create_reading_progress(user_id, book_id) do
    case Repo.get_by(ReadingProgress, user_id: user_id, book_id: book_id) do
      nil ->
        %ReadingProgress{}
        |> ReadingProgress.changeset(%{user_id: user_id, book_id: book_id, current_page: 1})
        |> Repo.insert()

      progress ->
        {:ok, progress}
    end
  end

  @doc """
  Updates reading progress for a user.
  """
  def update_reading_progress(user_id, book_id, page_number) do
    case Repo.get_by(ReadingProgress, user_id: user_id, book_id: book_id) do
      nil ->
        %ReadingProgress{}
        |> ReadingProgress.changeset(%{
          user_id: user_id,
          book_id: book_id,
          current_page: page_number,
          last_read_at: DateTime.utc_now()
        })
        |> Repo.insert()

      progress ->
        progress
        |> ReadingProgress.changeset(%{
          current_page: page_number,
          last_read_at: DateTime.utc_now()
        })
        |> Repo.update()
    end
  end

  @doc """
  Gets reading progress for a user and book.
  Returns nil if no progress exists.
  """
  def get_reading_progress(user_id, book_id) do
    Repo.get_by(ReadingProgress, user_id: user_id, book_id: book_id)
  end

  @doc """
  Gets a page with its scene preloaded.
  """
  def get_page_with_scene(book_id, page_number) do
    Page
    |> where([p], p.book_id == ^book_id and p.page_number == ^page_number)
    |> preload([p], scene: [:soundscape])
    |> Repo.one()
  end

  @doc """
  Gets the scene for a specific page.
  """
  def get_scene_for_page(book_id, page_number) do
    query =
      from s in Scene,
        where: s.book_id == ^book_id,
        where: s.start_page <= ^page_number,
        where: s.end_page >= ^page_number,
        preload: [:soundscape]

    Repo.one(query)
  end

  @doc """
  Gets the next scene that begins after the provided page number.
  Returns nil when there are no more scenes.
  """
  def get_next_scene_after_page(book_id, page_number) do
    Scene
    |> where([s], s.book_id == ^book_id)
    |> where([s], s.start_page > ^page_number)
    |> order_by([s], asc: s.start_page)
    |> preload([:soundscape])
    |> limit(1)
    |> Repo.one()
  end

  @doc """
  Counts the number of books a user has accessed.
  """
  def count_accessed_books(user_id) do
    ReadingProgress
    |> where([rp], rp.user_id == ^user_id)
    |> select([rp], count(rp.id))
    |> Repo.one()
  end

  @doc """
  Counts the number of books a user has accessed in the current month.
  """
  def count_monthly_books(user_id) do
    now = DateTime.utc_now()
    start_of_month = DateTime.new!(Date.new!(now.year, now.month, 1), ~T[00:00:00])

    ReadingProgress
    |> where([rp], rp.user_id == ^user_id)
    |> where([rp], rp.last_read_at >= ^start_of_month)
    |> select([rp], count(rp.id))
    |> Repo.one()
  end
end
