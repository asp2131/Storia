defmodule Storia.AI.ContentAnalysisAndMappingTest do
  use Storia.DataCase, async: false

  alias Storia.{Content, Repo}
  alias Storia.AI.SceneClassifier
  alias Storia.Soundscapes

  @pdf_path Path.join(File.cwd!(), "Alice_in_Wonderland.pdf")
  @chapter_1_start_page 8
  @chapter_1_end_page 22

  describe "content analysis and soundscape mapping for Alice in Wonderland" do
    @tag :integration
    @tag timeout: :infinity
    test "analyzes entire book but only maps soundscapes for chapter 1" do
      pdf_available? = File.exists?(@pdf_path)
      api_key_present? = System.get_env("REPLICATE_API_KEY")

      unless pdf_available? and api_key_present? do
        unless pdf_available? do
          flunk(
            "Missing PDF at #{@pdf_path}. Download Alice_in_Wonderland.pdf and place it in the project root."
          )
        end

        unless api_key_present? do
          flunk("Missing REPLICATE_API_KEY in the environment. Ensure .env is loaded when running tests.")
        end
      else
        # Step 1: Create a book record
        {:ok, book} =
          Content.create_book(%{
            title: "Alice's Adventures in Wonderland",
            author: "Lewis Carroll",
            pdf_url: @pdf_path,
            processing_status: "pending"
          })

        # Step 2: Extract entire PDF
        {:ok, pages_data} = extract_all_pages(@pdf_path)

        IO.puts("\n=== Extracted #{length(pages_data)} pages from entire book ===")

        # Step 3: Store pages in database
        Content.create_pages_batch(book.id, pages_data)
        Content.update_book(book, %{total_pages: length(pages_data)})

        # Step 4: Classify pages with AI
        pages = Content.list_pages_for_book(book.id)
        assert length(pages) > 0

        IO.puts("\n=== Classifying #{length(pages)} pages ===")

        pages_with_descriptors =
          pages
          |> Enum.map(fn page ->
            IO.puts("Classifying page #{page.page_number}...")

            case SceneClassifier.classify_page(page.text_content) do
              {:ok, descriptors} ->
                IO.puts("  ✓ Page #{page.page_number}: #{inspect(descriptors)}")
                %{page_number: page.page_number, descriptors: descriptors}

              {:error, reason} ->
                IO.puts("  ✗ Page #{page.page_number} failed: #{inspect(reason)}")
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
                    "scene_type" => "description",
                    "dominant_elements" => "silence"
                  }
                }
            end
          end)

        # Step 5: Detect scene boundaries
        boundaries = SceneClassifier.detect_scene_boundaries(pages_with_descriptors)
        IO.puts("\n=== Detected scene boundaries: #{inspect(boundaries)} ===")

        # Step 6: Create scenes
        {:ok, scenes} = SceneClassifier.create_scenes(book.id, pages_with_descriptors, boundaries)
        IO.puts("\n=== Created #{length(scenes)} scenes ===")

        # Verify scenes were created
        assert length(scenes) > 0

        # Step 7: Map scenes to curated soundscapes (Chapter 1 only)
        {:ok, curated_soundscapes} = Soundscapes.list_curated_soundscapes_from_bucket()

        unless map_size(curated_soundscapes) > 0 do
          IO.puts("Warning: No curated soundscapes found in bucket")
        end

        # Filter scenes to only Chapter 1 (pages 8-22)
        chapter_1_scenes = Enum.filter(scenes, fn scene ->
          scene.start_page >= @chapter_1_start_page and scene.end_page <= @chapter_1_end_page
        end)

        IO.puts("\n=== Mapping soundscapes for Chapter 1 only (#{length(chapter_1_scenes)}/#{length(scenes)} scenes) ===")

        mapping_results =
          chapter_1_scenes
          |> Enum.map(fn scene ->
            IO.puts("\nScene #{scene.scene_number} (pages #{scene.start_page}-#{scene.end_page}):")
            IO.puts("  Descriptors: #{inspect(scene.descriptors)}")

            case find_best_soundscape_match(scene.descriptors, curated_soundscapes) do
              {:ok, file_info, category, confidence} ->
                IO.puts("  → Matched: #{file_info.name} (#{category}) - Confidence: #{confidence}")

                # Create soundscape record
                case Soundscapes.create_soundscape_from_bucket(scene.id, file_info, category) do
                  {:ok, soundscape} ->
                    IO.puts("  ✓ Soundscape assigned to scene")
                    {:ok, scene, soundscape, confidence}

                  {:error, reason} ->
                    IO.puts("  ✗ Failed to create soundscape: #{inspect(reason)}")
                    {:error, scene, reason}
                end

              {:error, reason} ->
                IO.puts("  ✗ No match found: #{inspect(reason)}")
                {:error, scene, reason}
            end
          end)

        # Verify at least some mappings succeeded
        successful_mappings = Enum.count(mapping_results, fn r -> match?({:ok, _, _, _}, r) end)
        IO.puts("\n=== Summary: #{successful_mappings}/#{length(chapter_1_scenes)} Chapter 1 scenes mapped ===")
        IO.puts("=== Total scenes in book: #{length(scenes)} ===")

        assert successful_mappings > 0, "At least one Chapter 1 scene should be mapped to a soundscape"

        # Verify soundscapes are linked to scenes
        scenes_with_soundscapes =
          scenes
          |> Enum.map(fn scene ->
            Repo.preload(scene, :soundscape)
          end)

        mapped_scenes = Enum.filter(scenes_with_soundscapes, fn s -> s.soundscape != nil end)
        assert length(mapped_scenes) == successful_mappings
      end
    end
  end

  # Helper functions

  defp extract_all_pages(pdf_path) do
    case RustReader.extract_pdf(pdf_path) do
      {pages_json, _metadata} when is_list(pages_json) ->
        # Rust now does the chunking and returns JSON strings
        all_pages =
          pages_json
          |> Enum.map(fn json_str ->
            page_data = Jason.decode!(json_str)
            %{
              page_number: page_data["page_number"],
              text_content: page_data["text_content"]
            }
          end)

        {:ok, all_pages}

      {:error, reason} ->
        {:error, "PDF extraction failed: #{inspect(reason)}"}
    end
  end

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

  defp get_synonyms(nil), do: []
  defp get_synonyms(term) do
    term = String.downcase(term)
    case term do
      "riverside" -> ["river", "stream", "brook", "creek", "water", "flow", "meadow"]
      "underground" -> ["cave", "cavern", "echo", "deep", "earth", "subterranean"]
      "hall" -> ["castle", "interior", "corridor", "chamber", "room", "palace"]
      "chamber" -> ["room", "hall", "interior", "house"]
      "forest" -> ["wood", "grove", "trees", "nature", "glade"]
      "garden" -> ["nature", "flowers", "park", "meadow"]
      "magic" -> ["fantasy", "ethereal", "spell", "enchanted", "wizard", "mystical"]
      "whimsical" -> ["playful", "magic", "wonder", "curious", "fun"]
      "tense" -> ["suspense", "danger", "ominous", "scary", "fear"]
      "water" -> ["ocean", "sea", "river", "lake", "rain", "brook"]
      "wind" -> ["breeze", "storm", "air", "blow"]
      "footsteps" -> ["walk", "run", "step", "movement"]
      "silence" -> ["quiet", "calm", "still", "serene"]
      _ -> []
    end
  end

  defp matches_category(category, value) when is_binary(value) do
    value_lower = String.downcase(value)
    String.contains?(category, value_lower) or String.contains?(value_lower, category)
  end

  defp matches_category(_category, _value), do: false

end
