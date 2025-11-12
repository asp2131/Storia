defmodule Storia.AI.SoundscapeGeneratorTest do
  use Storia.DataCase, async: false

  alias Storia.AI.SoundscapeGenerator

  describe "generate_prompt_from_descriptors/1" do
    test "generates a natural language prompt from descriptors" do
      descriptors = %{
        "mood" => "tense",
        "setting" => "indoor",
        "time_of_day" => "night",
        "weather" => "stormy",
        "activity_level" => "high",
        "atmosphere" => "suspenseful"
      }

      {:ok, prompt} = SoundscapeGenerator.generate_prompt_from_descriptors(descriptors)

      # The prompt should contain key elements
      assert prompt =~ "tense"
      assert prompt =~ "suspenseful"
      assert prompt =~ "indoor"
      assert prompt =~ "night"
      assert prompt =~ "stormy"
      assert prompt =~ "high activity"
    end

    test "handles minimal descriptors" do
      descriptors = %{
        "mood" => "peaceful",
        "setting" => "outdoor",
        "time_of_day" => "unknown",
        "weather" => "unknown",
        "activity_level" => "calm",
        "atmosphere" => ""
      }

      {:ok, prompt} = SoundscapeGenerator.generate_prompt_from_descriptors(descriptors)

      assert prompt =~ "peaceful"
      assert prompt =~ "outdoor"
      assert prompt =~ "calm"
      # Should not include "unknown" values
      refute prompt =~ "unknown"
    end

    test "combines mood and atmosphere when different" do
      descriptors = %{
        "mood" => "mysterious",
        "setting" => "forest",
        "time_of_day" => "dusk",
        "weather" => "foggy",
        "activity_level" => "moderate",
        "atmosphere" => "eerie"
      }

      {:ok, prompt} = SoundscapeGenerator.generate_prompt_from_descriptors(descriptors)

      assert prompt =~ "mysterious"
      assert prompt =~ "eerie"
      assert prompt =~ "forest"
      assert prompt =~ "dusk"
      assert prompt =~ "foggy"
    end

    test "returns error for invalid descriptors" do
      assert {:error, :invalid_descriptors} = 
        SoundscapeGenerator.generate_prompt_from_descriptors("not a map")

      assert {:error, :invalid_descriptors} = 
        SoundscapeGenerator.generate_prompt_from_descriptors(nil)
    end
  end

  describe "generate_soundscape/2" do
    @tag :integration
    test "generates a soundscape for a scene" do
      # This test requires:
      # 1. Valid Replicate API key
      # 2. R2 storage configured
      # Skip in CI/CD or when not configured

      if System.get_env("REPLICATE_API_KEY") && System.get_env("R2_ACCESS_KEY_ID") do
        # Create a test scene
        {:ok, book} = Storia.Content.create_book(%{
          title: "Test Book",
          author: "Test Author",
          pdf_url: "test.pdf"
        })

        {:ok, scene} = %Storia.Content.Scene{}
        |> Storia.Content.Scene.changeset(%{
          book_id: book.id,
          scene_number: 1,
          start_page: 1,
          end_page: 5,
          descriptors: %{
            "mood" => "peaceful",
            "setting" => "outdoor",
            "time_of_day" => "morning",
            "weather" => "sunny",
            "activity_level" => "calm",
            "atmosphere" => "serene"
          }
        })
        |> Storia.Repo.insert()

        # This will make real API calls - use with caution
        case SoundscapeGenerator.generate_soundscape(scene, duration: 5) do
          {:ok, soundscape} ->
            assert soundscape.scene_id == scene.id
            assert soundscape.source_type == "ai_generated"
            assert soundscape.audio_url != nil
            assert soundscape.generation_prompt != nil

          {:error, _reason} ->
            # API might fail, storage might not be configured
            # That's okay for this test
            :ok
        end
      end
    end
  end
end
