defmodule StoriaWeb.AdminLive.BookList do
  use StoriaWeb, :live_view

  alias Storia.Content
  alias Storia.Storage
  alias Storia.Workers.PDFProcessor

  @impl true
  def mount(_params, _session, socket) do
    if connected?(socket) do
      try do
        Phoenix.PubSub.subscribe(Storia.PubSub, "book_processing")
      rescue
        e ->
          require Logger
          Logger.error("Failed to subscribe to PubSub: #{inspect(e)}")
      end
    end

    {:ok,
     socket
     |> assign(:page_title, "Book Management")
     |> assign(:active_tab, :books)
     |> assign(:search_query, "")
     |> assign(:uploading, false)
     |> load_books()
     |> allow_upload(:pdf,
       accept: ~w(.pdf),
       max_entries: 1,
       max_file_size: 50_000_000,
       # Use external for large file uploads to avoid timeout
       auto_upload: true,
       progress: &handle_progress/3
     )}
  end

  @impl true
  def handle_params(_params, _url, socket) do
    {:noreply, socket}
  end

  @impl true
  def handle_event("search", %{"search" => %{"query" => query}}, socket) do
    {:noreply,
     socket
     |> assign(:search_query, query)
     |> load_books()}
  end

  @impl true
  def handle_event("validate_upload", _params, socket) do
    {:noreply, socket}
  end

  @impl true
  def handle_event("cancel_upload", %{"ref" => ref}, socket) do
    {:noreply, cancel_upload(socket, :pdf, ref)}
  end

  @impl true
  def handle_event("upload_book", _params, socket) do
    # Set uploading state
    socket = assign(socket, :uploading, true)

    uploaded_files =
      consume_uploaded_entries(socket, :pdf, fn %{path: path}, entry ->
        # Generate unique book ID
        book_id = Ecto.UUID.generate()

        # Upload to R2 storage
        case Storage.upload_pdf(path, book_id) do
          {:ok, r2_url} ->
            # Extract metadata from PDF (title, author)
            metadata = extract_pdf_metadata(path)

            {:ok, {book_id, r2_url, metadata}}

          {:error, reason} ->
            {:postpone, {:error, "Failed to upload PDF to R2: #{inspect(reason)}"}}
        end
      end)

    case uploaded_files do
      [{book_id, r2_url, metadata} | _] ->
        # Create book record with R2 URL
        case Content.create_book(%{
          title: metadata.title || "Untitled Book",
          author: metadata.author || "Unknown Author",
          pdf_url: r2_url,
          processing_status: "pending"
        }) do
          {:ok, book} ->
            # Enqueue PDF processing job with R2 URL
            %{book_id: book.id, pdf_url: r2_url}
            |> PDFProcessor.new()
            |> Oban.insert()

            {:noreply,
             socket
             |> assign(:uploading, false)
             |> put_flash(:info, "Book uploaded successfully. Processing started.")
             |> push_event("close-modal", %{})
             |> load_books()}

          {:error, _changeset} ->
            {:noreply,
             socket
             |> assign(:uploading, false)
             |> put_flash(:error, "Failed to create book record")}
        end

      [] ->
        {:noreply,
         socket
         |> assign(:uploading, false)
         |> put_flash(:error, "No file was uploaded")}
    end
  end

  @impl true
  def handle_event("noop", _params, socket) do
    {:noreply, socket}
  end

  @impl true
  def handle_event("delete_book", %{"id" => id}, socket) do
    case Content.get_book(id) do
      nil ->
        {:noreply, put_flash(socket, :error, "Book not found")}

      book ->
        case Content.delete_book(book) do
          {:ok, _book} ->
            # TODO: Also delete associated PDF from R2 storage
            {:noreply,
             socket
             |> put_flash(:info, "Book deleted successfully")
             |> load_books()}

          {:error, _changeset} ->
            {:noreply, put_flash(socket, :error, "Failed to delete book. It may have associated content.")}
        end
    end
  end

  @impl true
  def handle_info({:book_updated, book_id}, socket) do
    # Reload books when a book is updated via PubSub
    if Enum.any?(socket.assigns.books, &(&1.id == book_id)) do
      {:noreply, load_books(socket)}
    else
      {:noreply, socket}
    end
  end

  # Handle upload progress
  defp handle_progress(:pdf, entry, socket) do
    if entry.done? do
      # Upload is complete
      {:noreply, socket}
    else
      # Progress update - LiveView automatically updates the entry.progress
      {:noreply, socket}
    end
  end

  defp load_books(socket) do
    query = socket.assigns.search_query

    books =
      if query != "" do
        Content.search_books(query)
      else
        Content.list_books()
      end

    assign(socket, :books, books)
  end

  defp status_badge_class("pending"), do: "bg-gray-100 text-gray-800 dark:bg-gray-500/20 dark:text-gray-400"
  defp status_badge_class("extracting"), do: "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-400"
  defp status_badge_class("analyzing"), do: "bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-400"
  defp status_badge_class("mapping"), do: "bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-400"
  defp status_badge_class("ready_for_review"), do: "bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-400"
  defp status_badge_class("published"), do: "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-400"
  defp status_badge_class("failed"), do: "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-400"
  defp status_badge_class(_), do: "bg-gray-100 text-gray-800 dark:bg-gray-500/20 dark:text-gray-400"

  defp status_dot_class("pending"), do: "bg-gray-500"
  defp status_dot_class("extracting"), do: "bg-blue-500"
  defp status_dot_class("analyzing"), do: "bg-purple-500"
  defp status_dot_class("mapping"), do: "bg-indigo-500"
  defp status_dot_class("ready_for_review"), do: "bg-yellow-500"
  defp status_dot_class("published"), do: "bg-green-500"
  defp status_dot_class("failed"), do: "bg-red-500"
  defp status_dot_class(_), do: "bg-gray-500"

  defp format_status("pending"), do: "Pending"
  defp format_status("extracting"), do: "Extracting"
  defp format_status("analyzing"), do: "Analyzing"
  defp format_status("mapping"), do: "Mapping"
  defp format_status("ready_for_review"), do: "Needs Review"
  defp format_status("published"), do: "Published"
  defp format_status("failed"), do: "Error"
  defp format_status(status), do: String.capitalize(status)

  defp format_date(nil), do: "N/A"

  defp format_date(datetime) do
    Calendar.strftime(datetime, "%Y-%m-%d")
  end

  defp error_to_string(:too_large), do: "File is too large (max 50MB)"
  defp error_to_string(:not_accepted), do: "Only PDF files are accepted"
  defp error_to_string(:too_many_files), do: "Only one file can be uploaded at a time"
  defp error_to_string(error), do: "Upload error: #{inspect(error)}"

  defp extract_pdf_metadata(pdf_path) do
    # Basic metadata extraction using pdfinfo or similar
    # For now, we'll return empty metadata and let users edit later
    # In production, you could use a library like pdf_info or call pdfinfo command

    # Try to extract from filename as fallback
    filename = Path.basename(pdf_path, ".pdf")

    %{
      title: format_filename_as_title(filename),
      author: nil
    }
  end

  defp format_filename_as_title(filename) do
    filename
    |> String.replace(["-", "_"], " ")
    |> String.split(" ")
    |> Enum.map(&String.capitalize/1)
    |> Enum.join(" ")
  end
end
