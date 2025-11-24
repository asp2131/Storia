defmodule Storia.AI.ContentAnalysisAndMappingTest do
  use Storia.DataCase, async: false

  alias Storia.{Content, Repo}
  alias Storia.AI.SceneClassifier
  alias Storia.Soundscapes

  @pdf_path Path.join(File.cwd!(), "Alice_in_Wonderland.pdf")
  @first_chapter_pages 10

  describe "content analysis and soundscape mapping for Alice in Wonderland first chapter" do
    @tag :integration
    @tag timeout: 300_000
    test "analyzes first chapter and creates soundscape mappings" do
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

        # Step 2: Extract pages from PDF (first chapter)
        {:ok, pages_data} = extract_first_chapter_pages(@pdf_path, @first_chapter_pages)

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
                    "atmosphere" => "neutral"
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

        # Step 7: Map scenes to curated soundscapes
        {:ok, curated_soundscapes} = Soundscapes.list_curated_soundscapes_from_bucket()

        unless map_size(curated_soundscapes) > 0 do
          IO.puts("Warning: No curated soundscapes found in bucket")
        end

        IO.puts("\n=== Mapping scenes to curated soundscapes ===")

        mapping_results =
          scenes
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
        IO.puts("\n=== Summary: #{successful_mappings}/#{length(scenes)} scenes mapped ===")

        assert successful_mappings > 0, "At least one scene should be mapped to a soundscape"

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

  defp extract_first_chapter_pages(pdf_path, max_pages) do
    script_path =
      ["scripts", "pdf_processor", "extract.js"]
      |> Path.join()
      |> Path.expand(File.cwd!())

    case System.cmd("node", [script_path, pdf_path, to_string(max_pages)], stderr_to_stdout: true) do
      {output, 0} ->
        case Jason.decode(output) do
          {:ok, %{"success" => true, "pages" => all_pages}} ->
            # Take only the first N pages
            first_chapter_pages =
              all_pages
              |> Enum.take(max_pages)
              |> Enum.map(fn page ->
                %{
                  page_number: page["page_number"],
                  text_content: page["text_content"] || ""
                }
              end)

            {:ok, first_chapter_pages}

          {:ok, result} ->
            {:error, "Extraction failed: #{inspect(result)}"}

          {:error, reason} ->
            {:error, "Failed to parse JSON: #{inspect(reason)}"}
        end

      {output, exit_code} ->
        {:error, "PDF extraction failed with exit code #{exit_code}: #{output}"}
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
        {file, category, score} when score > 0.3 ->
          {:ok, file, category, score}

        _ ->
          {:error, :low_confidence}
      end
    end
  end

  defp calculate_match_score(descriptors, file_info, category) do
    # Simple matching algorithm based on:
    # - Category name matching scene attributes
    # - Filename keywords matching descriptors
    # - Mood and setting alignment

    file_name = String.downcase(file_info.name || "")
    category_lower = String.downcase(category)

    # Extract keywords from filename
    keywords =
      file_name
      |> String.replace(~r/[._-]/, " ")
      |> String.split()
      |> Enum.map(&String.downcase/1)

    score = 0.0

    # Match category to scene attributes
    score =
      score +
      cond do
        matches_category(category_lower, descriptors["setting"]) -> 0.3
        matches_category(category_lower, descriptors["mood"]) -> 0.25
        matches_category(category_lower, descriptors["atmosphere"]) -> 0.2
        true -> 0.0
      end

    # Match keywords to descriptors
    score =
      score +
      Enum.reduce(descriptors, 0.0, fn {_key, value}, acc ->
        value_lower = String.downcase(to_string(value))
        keyword_matches = Enum.count(keywords, &String.contains?(value_lower, &1))

        acc + keyword_matches * 0.1
      end)

    # Weather/time matching
    score =
      if descriptors["weather"] != "unknown" and
           String.contains?(file_name, String.downcase(descriptors["weather"])) do
        score + 0.15
      else
        score
      end

    # Activity level matching (for movement/action categories)
    score =
      if descriptors["activity_level"] in ["high", "intense"] and
           category_lower in ["movement", "action", "adventure"] do
        score + 0.2
      else
        score
      end

    min(score, 1.0)
  end

  defp matches_category(category, value) when is_binary(value) do
    value_lower = String.downcase(value)
    String.contains?(category, value_lower) or String.contains?(value_lower, category)
  end

  defp matches_category(_category, _value), do: false

end
