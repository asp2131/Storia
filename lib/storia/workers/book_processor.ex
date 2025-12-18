defmodule Storia.Workers.BookProcessor do
  @moduledoc """
  Oban worker for processing complete books using the streamlined workflow.

  This worker consolidates the entire book processing pipeline into one job:
  1. Extract pages from PDF/text
  2. Classify pages with AI
  3. Detect scene boundaries
  4. Create scenes
  5. Map scenes to curated soundscapes
  6. Publish the book

  Based on the workflow from seeds_alice.exs and content_analysis_and_mapping_test.exs
  """

  use Oban.Worker,
    queue: :pdf_processing,
    max_attempts: 3

  require Logger

  alias Storia.{Content, Repo, Soundscapes, Storage, HybridPdfExtractor}
  alias Storia.AI.SceneClassifier
  alias Storia.Content.Book

  @doc """
  Perform the complete book processing job.

  ## Job args
  - `book_id`: The ID of the book to process
  - `pdf_path`: Optional local path to PDF (for testing)
  """
  @impl Oban.Worker
  def perform(%Oban.Job{args: %{"book_id" => book_id} = args}) do
    Logger.info("Starting complete book processing for book_id: #{book_id}")

    with {:ok, book} <- fetch_book(book_id),
         {:ok, pdf_path} <- get_pdf_path(book, args),
         :ok <- Content.update_book_status(book_id, "extracting"),
         {:ok, pages_data} <- extract_pages(pdf_path),
         {:ok, _pages} <- save_pages(book_id, pages_data),
         :ok <- update_book_metadata(book, length(pages_data)),
         :ok <- Content.update_book_status(book_id, "analyzing"),
         {:ok, pages_with_descriptors} <- classify_all_pages(pages_data),
         {:ok, boundaries} <- detect_scene_boundaries(pages_with_descriptors),
         {:ok, scenes} <- create_scenes(book_id, pages_with_descriptors, boundaries),
         :ok <- Content.update_book_status(book_id, "mapping"),
         {:ok, _mappings} <- map_scenes_to_soundscapes(scenes),
         :ok <- Content.update_book_status(book_id, "published"),
         :ok <- Content.update_book(book, %{is_published: true}) do
      Logger.info("Successfully processed complete book: #{book_id}, created #{length(scenes)} scenes")
      :ok
    else
      {:error, reason} = error ->
        Logger.error("Failed to process book #{book_id}, reason: #{inspect(reason)}")
        Content.update_book_status(book_id, "failed", format_error(reason))
        error
    end
  end

  # Private functions

  defp fetch_book(book_id) do
    case Repo.get(Book, book_id) do
      nil -> {:error, :book_not_found}
      book -> {:ok, book}
    end
  end

  defp get_pdf_path(_book, %{"pdf_path" => pdf_path}) when is_binary(pdf_path) do
    if File.exists?(pdf_path) do
      {:ok, pdf_path}
    else
      {:error, :pdf_file_not_found}
    end
  end

  defp get_pdf_path(%Book{pdf_url: pdf_url}, _args) when is_binary(pdf_url) do
    cond do
      # Check if it's a local file path
      File.exists?(pdf_url) ->
        {:ok, pdf_url}

      # Check if it's a Supabase URL (download)
      String.starts_with?(pdf_url, "https://") ->
        download_from_supabase(pdf_url)

      # Invalid path
      true ->
        {:error, :pdf_url_invalid}
    end
  end

  defp get_pdf_path(_book, _args) do
    {:error, :no_pdf_path}
  end

  # Extract pages using the hybrid extractor (PDF or fallback to text if available)
  defp extract_pages(pdf_path) do
    Logger.info("Extracting pages from: #{pdf_path}")

    case HybridPdfExtractor.extract_all_pages(pdf_path) do
      {:ok, pages_data} ->
        Logger.info("Successfully extracted #{length(pages_data)} pages")
        {:ok, pages_data}

      {:error, reason} ->
        Logger.error("Failed to extract pages: #{inspect(reason)}")
        {:error, {:extraction_failed, reason}}
    end
  end

  # Save pages to database
  defp save_pages(book_id, pages_data) do
    pages_to_insert =
      Enum.map(pages_data, fn page_data ->
        %{
          book_id: book_id,
          page_number: page_data["page_number"],
          text_content: page_data["text_content"],
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

  # Update book with page count
  defp update_book_metadata(book, total_pages) do
    case Content.update_book(book, %{total_pages: total_pages}) do
      {:ok, _book} -> :ok
      {:error, changeset} -> {:error, {:metadata_update_failed, changeset}}
    end
  end

  # Classify all pages with AI (from test file workflow)
  defp classify_all_pages(pages_data) do
    Logger.info("Classifying #{length(pages_data)} pages...")

    # Filter out pages with minimal text (image-based pages)
    pages_to_classify = Enum.filter(pages_data, fn page ->
      String.length(page["text_content"] || "") >= 50
    end)

    Logger.info("Classifying #{length(pages_to_classify)}/#{length(pages_data)} pages (skipping #{length(pages_data) - length(pages_to_classify)} image-based pages)")

    pages_with_descriptors =
      pages_to_classify
      |> Enum.with_index(1)
      |> Enum.map(fn {page, index} ->
        # Keep DB connection alive every 10 pages during long AI operations
        if rem(index, 10) == 0 do
          Repo.query!("SELECT 1")
        end

        Logger.info("[#{index}/#{length(pages_to_classify)}] Classifying page #{page["page_number"]}... (#{String.length(page["text_content"])} chars)")

        case SceneClassifier.classify_page(page["text_content"]) do
          {:ok, descriptors} ->
            Logger.info("  ✓ Page #{page["page_number"]}: mood=#{descriptors["mood"]}, setting=#{descriptors["setting"]}")
            %{page_number: page["page_number"], descriptors: descriptors}

          {:error, reason} ->
            Logger.warning("  ✗ Page #{page["page_number"]} failed: #{inspect(reason)}")
            # Use default descriptors on failure
            %{
              page_number: page["page_number"],
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

  # Detect scene boundaries
  defp detect_scene_boundaries(pages_with_descriptors) do
    Logger.info("Detecting scene boundaries...")

    boundaries = SceneClassifier.detect_scene_boundaries(pages_with_descriptors)
    Logger.info("Detected #{length(boundaries)} scene boundaries")

    {:ok, boundaries}
  end

  # Create scenes
  defp create_scenes(book_id, pages_with_descriptors, boundaries) do
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

  # Map scenes to curated soundscapes (from seeds/test workflow)
  defp map_scenes_to_soundscapes(scenes) do
    Logger.info("Loading curated soundscapes...")

    with {:ok, curated_soundscapes} <- Soundscapes.list_curated_soundscapes_from_bucket() do
      if map_size(curated_soundscapes) == 0 do
        Logger.warning("No curated soundscapes found in bucket")
      end

      Logger.info("Mapping soundscapes for #{length(scenes)} scenes...")

      mapping_results =
        scenes
        |> Enum.with_index(1)
        |> Enum.map(fn {scene, index} ->
          # Keep DB connection alive every 10 scenes
          if rem(index, 10) == 0 do
            Repo.query!("SELECT 1")
          end

          Logger.info("\nScene #{scene.scene_number} (pages #{scene.start_page}-#{scene.end_page}):")
          Logger.info("  Descriptors: #{inspect(scene.descriptors)}")

          case find_best_soundscape_match(scene.descriptors, curated_soundscapes) do
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

  # Download PDF from Supabase
  defp download_from_supabase(pdf_url) do
    Logger.info("Downloading PDF from Supabase: #{pdf_url}")

    # Extract the key from the URL
    key = Storage.extract_key_from_url(pdf_url)

    if key do
      # Create temp file path
      temp_path = Path.join(System.tmp_dir!(), "#{Ecto.UUID.generate()}.pdf")

      # Generate signed URL for download
      case Storage.generate_signed_url(key) do
        {:ok, signed_url} ->
          # Download using HTTPoison
          case HTTPoison.get(signed_url) do
            {:ok, %HTTPoison.Response{status_code: 200, body: body}} ->
              File.write!(temp_path, body)
              {:ok, temp_path}

            {:ok, %HTTPoison.Response{status_code: status}} ->
              {:error, {:download_failed, "HTTP #{status}"}}

            {:error, %HTTPoison.Error{reason: reason}} ->
              {:error, {:download_failed, reason}}
          end

        {:error, reason} ->
          {:error, {:signed_url_failed, reason}}
      end
    else
      {:error, :invalid_supabase_url}
    end
  end

  # Soundscape matching logic (from test/seeds files)
  defp find_best_soundscape_match(descriptors, curated_soundscapes) do
    if map_size(curated_soundscapes) == 0 do
      {:error, :no_soundscapes_available}
    else
      # Calculate match scores for each soundscape
      scores =
        curated_soundscapes
        |> Enum.flat_map(fn {category, files} ->
          Enum.map(files, fn file ->
            score = calculate_match_score(descriptors, file, category)
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

  # Matching algorithm (from test/seeds files)
  defp calculate_match_score(descriptors, file_info, category) do
    # Enhanced matching algorithm that leverages rich descriptors and synonyms

    file_name = String.downcase(file_info.name || "")
    category_lower = String.downcase(category)

    # Extract keywords from filename
    keywords =
      file_name
      |> String.replace(~r/\.(mp3|wav|ogg|m4a)$/, "")
      |> String.replace(~r/[._-]/, " ")
      |> String.split()
      |> Enum.map(&String.downcase/1)
      |> Enum.reject(&(&1 in ["sound", "audio", "ambience", "ambient"]))

    # Get synonyms for key descriptors
    setting_synonyms = get_synonyms(descriptors["setting"])
    mood_synonyms = get_synonyms(descriptors["mood"])
    atmosphere_synonyms = get_synonyms(descriptors["atmosphere"])

    # Combine all semantic terms to search for
    search_terms =
      keywords ++
      (keywords |> Enum.flat_map(&get_synonyms/1))

    score = 0.0

    # 1. Setting Match (Highest Priority)
    # Check if file keywords or their synonyms match the scene setting
    setting_matches =
      Enum.any?(search_terms, fn term ->
        term == String.downcase(descriptors["setting"] || "") or
        term in setting_synonyms
      end)

    score = if setting_matches, do: score + 0.4, else: score

    # 2. Dominant Elements Match
    element_score =
      if descriptors["dominant_elements"] do
        elements =
          descriptors["dominant_elements"]
          |> String.downcase()
          |> String.split(",")
          |> Enum.map(&String.trim/1)
          |> Enum.flat_map(fn e -> [e | get_synonyms(e)] end)

        matches = Enum.count(elements, fn element ->
          Enum.any?(search_terms, &String.contains?(&1, element))
        end)

        matches * 0.15
      else
        0.0
      end
    score = score + element_score

    # 3. Mood/Atmosphere Match
    mood_matches =
      Enum.any?(search_terms, fn term ->
        term == String.downcase(descriptors["mood"] || "") or
        term in mood_synonyms or
        term == String.downcase(descriptors["atmosphere"] || "") or
        term in atmosphere_synonyms
      end)

    score = if mood_matches, do: score + 0.25, else: score

    # 4. Category Match
    score =
      if matches_category(category_lower, descriptors["setting"]) or
         matches_category(category_lower, descriptors["scene_type"]) do
        score + 0.2
      else
        score
      end

    min(score, 1.0)
  end

  # Synonyms and matching helpers (from test/seeds files)
  defp get_synonyms(nil), do: []
  defp get_synonyms(term) do
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

  defp matches_category(category, value) when is_binary(value) do
    value_lower = String.downcase(value)
    String.contains?(category, value_lower) or String.contains?(value_lower, category)
  end

  defp matches_category(_category, _value), do: false

  # Error formatting
  defp format_error(:book_not_found), do: "Book not found"
  defp format_error(:pdf_file_not_found), do: "PDF file not found"
  defp format_error(:pdf_url_invalid), do: "PDF URL is invalid"
  defp format_error(:no_pdf_path), do: "No PDF path provided"
  defp format_error({:extraction_failed, reason}), do: "Page extraction failed: #{inspect(reason)}"
  defp format_error(:no_pages_inserted), do: "No pages were inserted"
  defp format_error({:metadata_update_failed, changeset}), do: "Metadata update failed: #{inspect(changeset.errors)}"
  defp format_error({:scene_creation_failed, reason}), do: "Scene creation failed: #{inspect(reason)}"
  defp format_error(:invalid_supabase_url), do: "Invalid Supabase URL"
  defp format_error({:download_failed, reason}), do: "Download failed: #{inspect(reason)}"
  defp format_error({:signed_url_failed, reason}), do: "Signed URL generation failed: #{inspect(reason)}"
  defp format_error(reason), do: inspect(reason)
end
