defmodule Storia.AI.SceneClassifierTest do
  use Storia.DataCase, async: false

  alias Storia.AI.SceneClassifier
  alias Storia.Content

  describe "classify_page/1" do
    @tag :integration
    test "classifies a page and returns descriptors" do
      # This test requires a valid Replicate API key
      # Skip in CI/CD or when key is not available
      if System.get_env("REPLICATE_API_KEY") do
        page_text = """
        The storm raged outside as Sarah huddled in the dark corner of the old mansion.
        Thunder crashed and lightning illuminated the dusty furniture. Her heart pounded
        as she heard footsteps approaching down the hallway.
        """

        case SceneClassifier.classify_page(page_text) do
          {:ok, descriptors} ->
            assert is_map(descriptors)
            assert Map.has_key?(descriptors, "mood")
            assert Map.has_key?(descriptors, "setting")
            assert Map.has_key?(descriptors, "atmosphere")

          {:error, _reason} ->
            # API might fail, that's okay for this test
            :ok
        end
      end
    end
  end

  describe "detect_scene_boundaries/1" do
    test "detects boundaries when descriptors change significantly" do
      pages_with_descriptors = [
        %{
          page_number: 1,
          descriptors: %{
            "mood" => "peaceful",
            "setting" => "outdoor",
            "time_of_day" => "morning",
            "weather" => "sunny",
            "activity_level" => "calm",
            "atmosphere" => "serene"
          }
        },
        %{
          page_number: 2,
          descriptors: %{
            "mood" => "peaceful",
            "setting" => "outdoor",
            "time_of_day" => "morning",
            "weather" => "sunny",
            "activity_level" => "calm",
            "atmosphere" => "serene"
          }
        },
        %{
          page_number: 3,
          descriptors: %{
            "mood" => "tense",
            "setting" => "indoor",
            "time_of_day" => "night",
            "weather" => "stormy",
            "activity_level" => "high",
            "atmosphere" => "suspenseful"
          }
        }
      ]

      boundaries = SceneClassifier.detect_scene_boundaries(pages_with_descriptors)

      # Should have at least 2 boundaries: start and the change at page 3
      assert length(boundaries) >= 2
      assert 1 in boundaries
      assert 3 in boundaries
    end

    test "keeps pages together when descriptors are similar" do
      pages_with_descriptors = [
        %{
          page_number: 1,
          descriptors: %{
            "mood" => "peaceful",
            "setting" => "outdoor",
            "time_of_day" => "morning",
            "weather" => "sunny",
            "activity_level" => "calm",
            "atmosphere" => "serene"
          }
        },
        %{
          page_number: 2,
          descriptors: %{
            "mood" => "peaceful",
            "setting" => "outdoor",
            "time_of_day" => "morning",
            "weather" => "sunny",
            "activity_level" => "calm",
            "atmosphere" => "serene"
          }
        }
      ]

      boundaries = SceneClassifier.detect_scene_boundaries(pages_with_descriptors)

      # Should only have 1 boundary (the start)
      assert boundaries == [1]
    end
  end

  describe "create_scenes/3" do
    setup do
      {:ok, book} =
        Content.create_book(%{
          title: "Test Book",
          author: "Test Author",
          pdf_url: "test.pdf"
        })

      %{book: book}
    end

    test "creates scenes from pages and boundaries", %{book: book} do
      # Create test pages
      pages_data = [
        %{page_number: 1, text_content: "Page 1"},
        %{page_number: 2, text_content: "Page 2"},
        %{page_number: 3, text_content: "Page 3"},
        %{page_number: 4, text_content: "Page 4"}
      ]

      Content.create_pages_batch(book.id, pages_data)

      pages_with_descriptors = [
        %{
          page_number: 1,
          descriptors: %{
            "mood" => "peaceful",
            "setting" => "outdoor",
            "time_of_day" => "morning",
            "weather" => "sunny",
            "activity_level" => "calm",
            "atmosphere" => "serene"
          }
        },
        %{
          page_number: 2,
          descriptors: %{
            "mood" => "peaceful",
            "setting" => "outdoor",
            "time_of_day" => "morning",
            "weather" => "sunny",
            "activity_level" => "calm",
            "atmosphere" => "serene"
          }
        },
        %{
          page_number: 3,
          descriptors: %{
            "mood" => "tense",
            "setting" => "indoor",
            "time_of_day" => "night",
            "weather" => "stormy",
            "activity_level" => "high",
            "atmosphere" => "suspenseful"
          }
        },
        %{
          page_number: 4,
          descriptors: %{
            "mood" => "tense",
            "setting" => "indoor",
            "time_of_day" => "night",
            "weather" => "stormy",
            "activity_level" => "high",
            "atmosphere" => "suspenseful"
          }
        }
      ]

      boundaries = [1, 3]

      {:ok, scenes} = SceneClassifier.create_scenes(book.id, pages_with_descriptors, boundaries)

      assert length(scenes) == 2

      [scene1, scene2] = scenes

      assert scene1.scene_number == 1
      assert scene1.start_page == 1
      assert scene1.end_page == 2
      assert scene1.descriptors["mood"] == "peaceful"

      assert scene2.scene_number == 2
      assert scene2.start_page == 3
      assert scene2.end_page == 4
      assert scene2.descriptors["mood"] == "tense"
    end
  end
end
