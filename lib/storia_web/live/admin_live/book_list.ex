defmodule StoriaWeb.AdminLive.BookList do
  use StoriaWeb, :live_view

  require Logger

  alias Storia.Repo
  alias Storia.Content
  alias Storia.Storage
  alias Storia.AI.SceneClassifier
  alias Storia.Soundscapes
  alias Storia.HybridPdfExtractor

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
     |> assign(:editing_book, nil)
     |> assign(:book_changeset, nil)
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
    # If auto-submit already kicked off, ignore manual clicks
    if socket.assigns.uploading do
      {:noreply, socket}
    else
      process_upload(socket)
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
  def handle_event("edit_book", %{"id" => id}, socket) do
    case Content.get_book(id) do
      nil ->
        {:noreply, put_flash(socket, :error, "Book not found")}

      book ->
        changeset = Content.change_book(book)
        {:noreply, assign(socket, editing_book: book, book_changeset: changeset)}
    end
  end

  @impl true
  def handle_event("cancel_edit", _params, socket) do
    {:noreply, assign(socket, editing_book: nil, book_changeset: nil)}
  end

  @impl true
  def handle_event("validate_book", %{"book" => params}, socket) do
    changeset =
      socket.assigns.editing_book
      |> Content.change_book(params)
      |> Map.put(:action, :validate)

    {:noreply, assign(socket, book_changeset: changeset)}
  end

  @impl true
  def handle_event("save_book", %{"book" => params}, socket) do
    book = socket.assigns.editing_book

    case Content.update_book(book, params) do
      {:ok, _updated} ->
        {:noreply,
         socket
         |> put_flash(:info, "Book updated")
         |> assign(editing_book: nil, book_changeset: nil)
         |> load_books()}

      {:error, changeset} ->
        {:noreply, assign(socket, book_changeset: changeset)}
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
    cond do
      # Auto-submit once the (single) upload entry finishes
      entry.done? and not socket.assigns.uploading ->
        case process_upload(socket) do
          {:noreply, new_socket} -> {:noreply, new_socket}
          other -> other
        end

      true ->
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
  defp status_dot_class("published"), do: "bg-green-500"
  defp status_dot_class("failed"), do: "bg-red-500"
  defp status_dot_class(_), do: "bg-gray-500"

  defp format_status("pending"), do: "Pending"
  defp format_status("extracting"), do: "Extracting"
  defp format_status("analyzing"), do: "Analyzing"
  defp format_status("mapping"), do: "Mapping"
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

  # Shared upload processing -------------------------------------------------

  defp process_upload(socket) do
    socket = assign(socket, :uploading, true)

    uploaded_files =
      consume_uploaded_entries(socket, :pdf, fn %{path: path}, _entry ->
        book_id = Ecto.UUID.generate()

        case Storage.upload_pdf(path, book_id) do
          {:ok, r2_url} ->
            metadata = extract_pdf_metadata(path)
            {:ok, {book_id, r2_url, metadata}}

          {:error, reason} ->
            {:postpone, {:error, "Failed to upload PDF to R2: #{inspect(reason)}"}}
        end
      end)

    case uploaded_files do
      [{_book_id, r2_url, metadata} | _] ->
        case Content.create_book(%{
               title: metadata.title || "Untitled Book",
               author: metadata.author || "Unknown Author",
               pdf_url: r2_url,
               processing_status: "pending"
             }) do
          {:ok, book} ->
            # Process the book synchronously for development
            case process_book_synchronously(book.id, r2_url) do
              :ok ->
                {:noreply,
                 socket
                 |> assign(:uploading, false)
                 |> put_flash(:info, "Book uploaded and processed successfully!")
                 |> push_event("close-modal", %{})
                 |> load_books()}

              {:error, reason} ->
                {:noreply,
                 socket
                 |> assign(:uploading, false)
                 |> put_flash(:error, "Book uploaded but processing failed: #{inspect(reason)}")
                 |> push_event("close-modal", %{})
                 |> load_books()}
            end

          {:error, _changeset} ->
            {:noreply,
             socket
             |> assign(:uploading, false)
             |> put_flash(:error, "Failed to create book record")}
        end

      other when is_list(other) ->
        reason =
          cond do
            match?([{:postpone, {:error, _}} | _], other) ->
              {:postpone, {:error, r}} = hd(other)
              r

            match?([error: _], other) ->
              other[:error]

            other == [] ->
              "No file was uploaded"

            true ->
              "Unexpected upload result: #{inspect(other)}"
          end

        {:noreply,
         socket
         |> assign(:uploading, false)
         |> put_flash(:error, "Upload failed: #{reason}")}
    end
  end

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

  # Helper function to extract pages from PDF with proper error handling
  defp extract_pages_from_pdf(pdf_path) do
    Logger.info("Extracting pages from PDF at: #{pdf_path}")
    case HybridPdfExtractor.extract_all_pages(pdf_path) do
      {:ok, pages_data} ->
        Logger.info("Successfully extracted #{length(pages_data)} pages")
        {:ok, pages_data}
      {:error, reason} ->
        Logger.error("PDF extraction failed: #{inspect(reason)}")
        {:error, {:pdf_extraction_failed, reason}}
    end
  end

  # Synchronous book processing for development
  defp process_book_synchronously(book_id, pdf_url) do
    Logger.info("Starting synchronous book processing for book_id: #{book_id}")

    case Content.get_book(book_id) do
      nil ->
        Logger.error("Book #{book_id} not found")
        {:error, :book_not_found}

      book ->
        try do
          Logger.info("Step 1: Getting PDF path for #{pdf_url}")
          with {:ok, pdf_path} <- get_pdf_path_for_processing(pdf_url),
               {:ok, _} <- Content.update_book_status(book_id, "extracting"),
               {:ok, pages_data} <- extract_pages_from_pdf(pdf_path),
               {:ok, _pages_count} <- save_pages_for_book(book_id, pages_data),
               :ok <- update_book_metadata_for_processing(book, length(pages_data)),
               {:ok, _} <- Content.update_book_status(book_id, "analyzing"),
               {:ok, pages_with_descriptors} <- classify_pages_for_book(pages_data),
               {:ok, boundaries} <- detect_scene_boundaries_for_book(pages_with_descriptors),
               {:ok, scenes} <- create_scenes_for_book(book_id, pages_with_descriptors, boundaries),
               {:ok, _} <- Content.update_book_status(book_id, "mapping"),
               {:ok, _mappings} <- map_scenes_to_soundscapes_for_book(scenes),
               {:ok, _} <- Content.update_book_status(book_id, "published"),
               {:ok, _} <- Content.update_book(book, %{is_published: true}) do
            Logger.info("Successfully processed book synchronously: #{book_id}")
            :ok
          else
            {:error, reason} ->
              Logger.error("Failed to process book synchronously #{book_id}: #{inspect(reason)}")
              Content.update_book_status(book_id, "failed", "Processing failed: #{inspect(reason)}")
              {:error, reason}
          end
        rescue
          e ->
            Logger.error("Exception during book processing #{book_id}: #{inspect(e)}")
            Content.update_book_status(book_id, "failed", "Processing exception: #{inspect(e)}")
            {:error, e}
        end
    end
  end

  defp get_pdf_path_for_processing(pdf_url) do
    cond do
      # Check if it's a local file path
      File.exists?(pdf_url) ->
        {:ok, pdf_url}

      # Check if it's a Supabase URL (download)
      String.starts_with?(pdf_url, "https://") ->
        download_pdf_from_supabase(pdf_url)

      # Invalid path
      true ->
        {:error, :invalid_pdf_url}
    end
  end

  defp download_pdf_from_supabase(pdf_url) do
    Logger.info("Downloading PDF from Supabase: #{pdf_url}")

    # For now, let's try a different approach - use the public URL directly
    # Since Supabase storage is configured as public, we might not need signed URLs
    temp_path = Path.join(System.tmp_dir!(), "#{Ecto.UUID.generate()}.pdf")

    Logger.info("Attempting direct download from public URL")
    case HTTPoison.get(pdf_url, [], follow_redirect: true) do
      {:ok, %HTTPoison.Response{status_code: 200, body: body}} ->
        Logger.info("Direct download successful, saving to #{temp_path}")
        File.write!(temp_path, body)
        {:ok, temp_path}

      {:ok, %HTTPoison.Response{status_code: status}} ->
        Logger.warn("Direct download failed with status #{status}, trying signed URL approach")

        # Extract the key from the URL
        key = Storage.extract_key_from_url(pdf_url)

        if key do
          Logger.info("Extracted key: #{key}")

          # Generate signed URL for download
          case Storage.generate_signed_url(key) do
            {:ok, signed_url} ->
              Logger.info("Generated signed URL, attempting download")
              # Download using HTTPoison with timeout
              case HTTPoison.get(signed_url, [], recv_timeout: 30000, timeout: 30000) do
                {:ok, %HTTPoison.Response{status_code: 200, body: body}} ->
                  Logger.info("Signed URL download successful")
                  File.write!(temp_path, body)
                  {:ok, temp_path}

                {:ok, %HTTPoison.Response{status_code: status}} ->
                  Logger.error("Signed URL download failed with status: #{status}")
                  {:error, {:download_failed, "HTTP #{status}"}}

                {:error, %HTTPoison.Error{reason: reason}} ->
                  Logger.error("Signed URL download error: #{inspect(reason)}")
                  {:error, {:download_failed, reason}}
              end

            {:error, reason} ->
              Logger.error("Signed URL generation failed: #{inspect(reason)}")
              {:error, {:signed_url_failed, reason}}
          end
        else
          Logger.error("Could not extract key from URL: #{pdf_url}")
          {:error, :invalid_supabase_url}
        end

      {:error, %HTTPoison.Error{reason: reason}} ->
        Logger.error("Direct download error: #{inspect(reason)}")
        {:error, {:download_failed, reason}}
    end
  end

  # Copy the processing logic from BookProcessor but make it synchronous
  defp save_pages_for_book(book_id, pages_data) do
    pages_to_insert =
      Enum.map(pages_data, fn page_data ->
        page_number = Map.get(page_data, "page_number") || Map.get(page_data, :page_number)
        text_content = Map.get(page_data, "text_content") || Map.get(page_data, :text_content)

        %{
          book_id: book_id,
          page_number: page_number,
          text_content: text_content,
          inserted_at: NaiveDateTime.utc_now() |> NaiveDateTime.truncate(:second),
          updated_at: NaiveDateTime.utc_now() |> NaiveDateTime.truncate(:second)
        }
      end)

    case Repo.insert_all(Content.Page, pages_to_insert) do
      {count, _} when count > 0 ->
        Logger.info("Inserted #{count} pages for book_id: #{book_id}")
        {:ok, count}

      {0, _} ->
        {:error, :no_pages_inserted}
    end
  end

  defp update_book_metadata_for_processing(book, total_pages) do
    Logger.info("Updating book metadata: total_pages = #{total_pages}")
    case Content.update_book(book, %{total_pages: total_pages}) do
      {:ok, _book} ->
        Logger.info("Book metadata updated successfully")
        :ok
      {:error, changeset} ->
        Logger.error("Failed to update book metadata: #{inspect(changeset.errors)}")
        {:error, {:metadata_update_failed, changeset}}
    end
  end

  defp classify_pages_for_book(pages_data) do
    Logger.info("Classifying #{length(pages_data)} pages...")

    # Normalize keys and filter out pages with minimal text (image-based pages)
    pages_to_classify =
      pages_data
      |> Enum.map(fn page ->
        %{
          page_number: Map.get(page, "page_number") || Map.get(page, :page_number),
          text_content: Map.get(page, "text_content") || Map.get(page, :text_content)
        }
      end)
      |> Enum.filter(fn page ->
        String.length(page.text_content || "") >= 50
      end)

    Logger.info("Classifying #{length(pages_to_classify)}/#{length(pages_data)} pages (skipping #{length(pages_data) - length(pages_to_classify)} image-based pages)")

    pages_with_descriptors =
      pages_to_classify
      |> Enum.with_index(1)
      |> Enum.map(fn {page, index} ->
        Logger.info("[#{index}/#{length(pages_to_classify)}] Classifying page #{page.page_number}... (#{String.length(page.text_content)} chars)")

        case SceneClassifier.classify_page(page.text_content) do
          {:ok, descriptors} ->
            Logger.info("  ✓ Page #{page.page_number}: mood=#{descriptors["mood"]}, setting=#{descriptors["setting"]}")
            %{page_number: page.page_number, descriptors: descriptors}

          {:error, reason} ->
            Logger.warning("  ✗ Page #{page.page_number} failed: #{inspect(reason)}")
            # Use default descriptors on failure
            %{
              page_number: page.page_number,
              descriptors: %{
                "mood" => "neutral",
                "setting" => "unknown",
                "time_of_day" => "unknown",
                "weather" => "unknown",
                "activity_level" => "moderate",
                "atmosphere" => "neutral",
                "scene_type" => "description"
              }
            }
        end
      end)

    {:ok, pages_with_descriptors}
  end

  defp detect_scene_boundaries_for_book(pages_with_descriptors) do
    Logger.info("Detecting scene boundaries...")

    boundaries = SceneClassifier.detect_scene_boundaries(pages_with_descriptors)
    Logger.info("Detected #{length(boundaries)} scene boundaries")

    {:ok, boundaries}
  end

  defp create_scenes_for_book(book_id, pages_with_descriptors, boundaries) do
    Logger.info("Creating scene records...")

    case SceneClassifier.create_scenes(book_id, pages_with_descriptors, boundaries) do
      {:ok, scenes} ->
        Logger.info("Created #{length(scenes)} scenes")
        {:ok, scenes}

      {:error, reason} ->
        Logger.error("Failed to create scenes: #{inspect(reason)}")
        {:error, {:scene_creation_failed, reason}}
    end
  end

  # Soundscape mapping logic (simplified version from BookProcessor)
  defp map_scenes_to_soundscapes_for_book(scenes) do
    Logger.info("Loading curated soundscapes...")

    with {:ok, curated_soundscapes} <- Soundscapes.list_curated_soundscapes_from_bucket() do
      if map_size(curated_soundscapes) == 0 do
        Logger.warning("No curated soundscapes found in bucket")
      end

      Logger.info("Mapping soundscapes for #{length(scenes)} scenes...")

      mapping_results =
        scenes
        |> Enum.with_index(1)
        |> Enum.map(fn {scene, _index} ->
          Logger.info("\nScene #{scene.scene_number} (pages #{scene.start_page}-#{scene.end_page}):")
          Logger.info("  Descriptors: #{inspect(scene.descriptors)}")

          case find_best_soundscape_match_for_scene(scene.descriptors, curated_soundscapes) do
            {:ok, file_info, category, confidence} ->
              Logger.info("  → Matched: #{file_info.name} (#{category}) - Confidence: #{confidence}")

              # Create soundscape record
              case Soundscapes.create_soundscape_from_bucket(scene.id, file_info, category) do
                {:ok, soundscape} ->
                  Logger.info("  ✓ Soundscape assigned to scene")
                  {:ok, scene, soundscape, confidence}

                {:error, reason} ->
                  Logger.warning("  ✗ Failed to create soundscape: #{inspect(reason)}")
                  {:error, scene, reason}
              end

            {:error, reason} ->
              Logger.warning("  ✗ No match found: #{inspect(reason)}")
              {:error, scene, reason}
          end
        end)

      # Verify at least some mappings succeeded
      successful_mappings = Enum.count(mapping_results, fn r -> match?({:ok, _, _, _}, r) end)
      Logger.info("\n=== Summary: #{successful_mappings}/#{length(scenes)} scenes mapped to soundscapes ===")

      if successful_mappings == 0 do
        Logger.warning("No scenes were mapped to soundscapes")
      end

      {:ok, successful_mappings}
    else
      {:error, reason} ->
        Logger.warning("Failed to load curated soundscapes: #{inspect(reason)}")
        {:ok, 0}
    end
  end

  # Simplified matching logic
  defp find_best_soundscape_match_for_scene(descriptors, curated_soundscapes) do
    if map_size(curated_soundscapes) == 0 do
      {:error, :no_soundscapes_available}
    else
      # Calculate match scores for each soundscape
      scores =
        curated_soundscapes
        |> Enum.flat_map(fn {category, files} ->
          Enum.map(files, fn file ->
            score = calculate_match_score_for_scene(descriptors, file, category)
            {file, category, score}
          end)
        end)
        |> Enum.sort_by(fn {_file, _category, score} -> score end, :desc)

      case List.first(scores) do
        {file, category, score} when score > 0.25 ->
          {:ok, file, category, score}

        _ ->
          {:error, :low_confidence}
      end
    end
  end

  # Matching algorithm (from BookProcessor)
  defp calculate_match_score_for_scene(descriptors, file_info, category) do
    file_name = String.downcase(file_info.name || "")
    category_lower = String.downcase(category)

    keywords =
      file_name
      |> String.replace(~r/\.(mp3|wav|ogg|m4a)$/, "")
      |> String.replace(~r/[._-]/, " ")
      |> String.split()
      |> Enum.map(&String.downcase/1)
      |> Enum.reject(&(&1 in ["sound", "audio", "ambience", "ambient"]))

    setting_synonyms = get_synonyms_for_scene(descriptors["setting"])
    mood_synonyms = get_synonyms_for_scene(descriptors["mood"])
    atmosphere_synonyms = get_synonyms_for_scene(descriptors["atmosphere"])

    search_terms =
      keywords ++
      (keywords |> Enum.flat_map(&get_synonyms_for_scene/1))

    score = 0.0

    setting_matches =
      Enum.any?(search_terms, fn term ->
        term == String.downcase(descriptors["setting"] || "") or
        term in setting_synonyms
      end)

    score = if setting_matches, do: score + 0.4, else: score

    element_score =
      if descriptors["dominant_elements"] do
        elements =
          descriptors["dominant_elements"]
          |> String.downcase()
          |> String.split(",")
          |> Enum.map(&String.trim/1)
          |> Enum.flat_map(fn e -> [e | get_synonyms_for_scene(e)] end)

        matches = Enum.count(elements, fn element ->
          Enum.any?(search_terms, &String.contains?(&1, element))
        end)

        matches * 0.15
      else
        0.0
      end

    score = score + element_score

    mood_matches =
      Enum.any?(search_terms, fn term ->
        term == String.downcase(descriptors["mood"] || "") or
        term in mood_synonyms or
        term == String.downcase(descriptors["atmosphere"] || "") or
        term in atmosphere_synonyms
      end)

    score = if mood_matches, do: score + 0.25, else: score

    score =
      if matches_category_for_scene(category_lower, descriptors["setting"]) or
         matches_category_for_scene(category_lower, descriptors["scene_type"]) do
        score + 0.2
      else
        score
      end

    min(score, 1.0)
  end

  # Helper functions for soundscape matching
  defp get_synonyms_for_scene(nil), do: []
  defp get_synonyms_for_scene(term) do
    term = String.downcase(term)
    case term do
      "riverside" -> ["river", "stream", "brook", "creek", "water", "flow", "babbling", "nature"]
      "underground" -> ["cave", "cavern", "echo", "echoing", "deep", "earth", "subterranean", "rock"]
      "hall" -> ["castle", "grand", "interior", "corridor", "chamber", "room", "palace", "echo"]
      "chamber" -> ["room", "hall", "interior", "house", "echo", "cozy", "cabin"]
      "forest" -> ["wood", "grove", "trees", "nature", "glade", "enchanted", "eerie", "serene", "snowy"]
      "garden" -> ["nature", "flowers", "park", "meadow", "plants", "quiet", "grassy"]
      "meadow" -> ["grass", "grassy", "field", "nature", "flowers", "sun", "quiet"]
      "library" -> ["quiet", "books", "study", "interior", "silence"]
      "city" -> ["bustling", "medieval", "modern", "street", "town", "urban"]
      "magic" -> ["fantasy", "ethereal", "spell", "enchanted", "wizard", "mystical", "supernatural", "fairy"]
      "magical_realm" -> ["fantasy", "magic", "ethereal", "wonder", "dream", "enchanted", "forest"]
      "whimsical" -> ["playful", "wonder", "curious", "fun", "light", "fairy", "chimes"]
      "tense" -> ["suspense", "danger", "ominous", "scary", "fear", "dark", "anxious", "heartbeat"]
      "water" -> ["ocean", "sea", "river", "lake", "rain", "brook", "splash", "underwater"]
      "wind" -> ["breeze", "storm", "air", "blow", "howl", "howling", "mountain"]
      "footsteps" -> ["walk", "run", "step", "movement", "pace", "gravel", "snow"]
      "voices" -> ["speak", "talk", "whisper", "shout", "dialogue", "conversation", "crowd", "murmur"]
      "silence" -> ["quiet", "calm", "still", "serene", "peace"]
      "birds" -> ["chirp", "sing", "nature", "wings"]
      "rain" -> ["light", "gentle", "heavy", "storm", "thunder"]
      "storm" -> ["heavy", "thunderstorm", "rain", "lightning", "raging", "blizzard"]
      "giant" -> ["monster", "heavy", "loud", "thud", "stomp"]
      _ -> []
    end
  end

  defp matches_category_for_scene(category, value) when is_binary(value) do
    value_lower = String.downcase(value)
    String.contains?(category, value_lower) or String.contains?(value_lower, category)
  end

  defp matches_category_for_scene(_category, _value), do: false

  # Helper for form inputs
  defp input_value(%Ecto.Changeset{} = changeset, field) do
    Ecto.Changeset.get_field(changeset, field) || ""
  end
end
