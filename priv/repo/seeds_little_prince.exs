# Seed script for The Little Prince
# This creates a fully readable book with scenes and soundscapes
#
# Run with: mix run priv/repo/seeds_little_prince.exs

alias Storia.Repo
alias Storia.Content
alias Storia.Content.{Book, Scene}
alias Storia.Soundscapes

import Ecto.Query

IO.puts("\n👑 Seeding The Little Prince...\n")

# Check if book already exists
existing_book = Repo.get_by(Book, title: "The Little Prince")

book =
  if existing_book do
    IO.puts("📖 Found existing book, updating...")

    {:ok, updated_book} =
      Content.update_book(existing_book, %{
        pdf_url: "/books/The_Little_Prince.pdf",
        processing_status: "pending"
      })

    updated_book
  else
    IO.puts("📖 Creating new book...")

    {:ok, book} =
      Content.create_book(%{
        title: "The Little Prince",
        author: "Antoine de Saint-Exupéry",
        pdf_url: "/books/The_Little_Prince.pdf",
        processing_status: "pending",
        total_pages: 0,
        metadata: %{
          "genre" => "Fable, Novella, Speculative Fiction",
          "publication_year" => "1943",
          "description" =>
            "A young prince visits various planets in space, including Earth, and addresses themes of loneliness, friendship, love, and loss."
        }
      })

    book
  end

# Scene data from AI analysis (51 scenes mapped)
scenes_data = [
  %{
    scene_number: 1,
    start_page: 1,
    end_page: 2,
    descriptors: %{
      "activity_level" => "calm",
      "atmosphere" => "contemplative",
      "dominant_elements" => "silence",
      "mood" => "neutral",
      "scene_type" => "description",
      "setting" => "unknown",
      "time_of_day" => "unknown",
      "weather" => "unknown"
    },
    soundscape: %{file: "Rain-soaked_Forest_Silence.mp3", category: "nature", confidence: 0.9}
  },
  %{
    scene_number: 2,
    start_page: 3,
    end_page: 3,
    descriptors: %{
      "activity_level" => "calm",
      "atmosphere" => "whimsical",
      "dominant_elements" => "silence, wonder, voices",
      "mood" => "nostalgic",
      "scene_type" => "introspection",
      "setting" => "home",
      "time_of_day" => "unknown",
      "weather" => "unknown"
    },
    soundscape: %{file: "Rain-soaked_Forest_Silence.mp3", category: "nature", confidence: 1.0}
  },
  %{
    scene_number: 3,
    start_page: 4,
    end_page: 4,
    descriptors: %{
      "activity_level" => "calm",
      "atmosphere" => "contemplative",
      "dominant_elements" => "silence, isolation, wonder",
      "mood" => "nostalgic",
      "scene_type" => "introspection",
      "setting" => "unknown",
      "time_of_day" => "unknown",
      "weather" => "unknown"
    },
    soundscape: %{file: "Rain-soaked_Forest_Silence.mp3", category: "nature", confidence: 0.9}
  },
  %{
    scene_number: 4,
    start_page: 5,
    end_page: 5,
    descriptors: %{
      "activity_level" => "moderate",
      "atmosphere" => "whimsical",
      "dominant_elements" => "isolation, silence, wonder",
      "mood" => "bittersweet",
      "scene_type" => "revelation",
      "setting" => "wilderness",
      "time_of_day" => "dawn",
      "weather" => "clear"
    },
    soundscape: %{file: "Rain-soaked_Forest_Silence.mp3", category: "nature", confidence: 1.0}
  },
  %{
    scene_number: 5,
    start_page: 6,
    end_page: 6,
    descriptors: %{
      "activity_level" => "calm",
      "atmosphere" => "whimsical",
      "dominant_elements" => "silence, wind, wonder",
      "mood" => "mysterious",
      "scene_type" => "dialogue",
      "setting" => "wilderness",
      "time_of_day" => "unknown",
      "weather" => "clear"
    },
    soundscape: %{file: "Howling_Wind.mp3", category: "nature", confidence: 1.0}
  },
  %{
    scene_number: 6,
    start_page: 7,
    end_page: 7,
    descriptors: %{
      "activity_level" => "moderate",
      "atmosphere" => "whimsical",
      "dominant_elements" => "voices, wonder, isolation",
      "mood" => "whimsical",
      "scene_type" => "dialogue",
      "setting" => "unknown",
      "time_of_day" => "unknown",
      "weather" => "unknown"
    },
    soundscape: %{file: "Awe_&_Wonder.mp3", category: "sentiment", confidence: 0.4}
  },
  %{
    scene_number: 7,
    start_page: 8,
    end_page: 8,
    descriptors: %{
      "activity_level" => "calm",
      "atmosphere" => "whimsical",
      "dominant_elements" => "mystery, wonder, silence",
      "mood" => "curious",
      "scene_type" => "dialogue",
      "setting" => "wilderness",
      "time_of_day" => "unknown",
      "weather" => "clear"
    },
    soundscape: %{file: "Rain-soaked_Forest_Silence.mp3", category: "nature", confidence: 1.0}
  },
  %{
    scene_number: 8,
    start_page: 9,
    end_page: 9,
    descriptors: %{
      "activity_level" => "calm",
      "atmosphere" => "whimsical",
      "dominant_elements" => "voices, wonder, isolation",
      "mood" => "bittersweet",
      "scene_type" => "dialogue",
      "setting" => "dreamscape",
      "time_of_day" => "unknown",
      "weather" => "unknown"
    },
    soundscape: %{file: "Awe_&_Wonder.mp3", category: "sentiment", confidence: 0.4}
  },
  %{
    scene_number: 9,
    start_page: 10,
    end_page: 11,
    descriptors: %{
      "activity_level" => "calm",
      "atmosphere" => "contemplative",
      "dominant_elements" => "silence, voices, isolation",
      "mood" => "bittersweet",
      "scene_type" => "introspection",
      "setting" => "unknown",
      "time_of_day" => "unknown",
      "weather" => "unknown"
    },
    soundscape: %{file: "Rain-soaked_Forest_Silence.mp3", category: "nature", confidence: 0.9}
  },
  %{
    scene_number: 10,
    start_page: 12,
    end_page: 12,
    descriptors: %{
      "activity_level" => "still",
      "atmosphere" => "contemplative",
      "dominant_elements" => "silence, isolation, wonder",
      "mood" => "nostalgic",
      "scene_type" => "introspection",
      "setting" => "home",
      "time_of_day" => "unknown",
      "weather" => "unknown"
    },
    soundscape: %{file: "Rain-soaked_Forest_Silence.mp3", category: "nature", confidence: 0.9}
  },
  %{
    scene_number: 11,
    start_page: 13,
    end_page: 13,
    descriptors: %{
      "activity_level" => "calm",
      "atmosphere" => "contemplative",
      "dominant_elements" => "voices, wonder, mystery",
      "mood" => "whimsical",
      "scene_type" => "dialogue",
      "setting" => "unknown",
      "time_of_day" => "unknown",
      "weather" => "unknown"
    },
    soundscape: %{file: "Awe_&_Wonder.mp3", category: "sentiment", confidence: 0.4}
  },
  %{
    scene_number: 12,
    start_page: 14,
    end_page: 14,
    descriptors: %{
      "activity_level" => "calm",
      "atmosphere" => "whimsical",
      "dominant_elements" => "rustling, wind, wonder",
      "mood" => "contemplative",
      "scene_type" => "introspection",
      "setting" => "garden",
      "time_of_day" => "morning",
      "weather" => "clear"
    },
    soundscape: %{file: "Howling_Wind.mp3", category: "nature", confidence: 1.0}
  },
  %{
    scene_number: 13,
    start_page: 15,
    end_page: 15,
    descriptors: %{
      "activity_level" => "calm",
      "atmosphere" => "contemplative",
      "dominant_elements" => "silence, voices, wonder",
      "mood" => "contemplative",
      "scene_type" => "introspection",
      "setting" => "unknown",
      "time_of_day" => "unknown",
      "weather" => "unknown"
    },
    soundscape: %{file: "Rain-soaked_Forest_Silence.mp3", category: "nature", confidence: 0.9}
  },
  %{
    scene_number: 14,
    start_page: 16,
    end_page: 16,
    descriptors: %{
      "activity_level" => "still",
      "atmosphere" => "contemplative",
      "dominant_elements" => "silence, wind, isolation",
      "mood" => "melancholic",
      "scene_type" => "dialogue",
      "setting" => "unknown",
      "time_of_day" => "dusk",
      "weather" => "clear"
    },
    soundscape: %{file: "Howling_Wind.mp3", category: "nature", confidence: 1.0}
  },
  %{
    scene_number: 15,
    start_page: 17,
    end_page: 17,
    descriptors: %{
      "activity_level" => "moderate",
      "atmosphere" => "suspenseful",
      "dominant_elements" => "tension, isolation, silence",
      "mood" => "tense",
      "scene_type" => "dialogue",
      "setting" => "wilderness",
      "time_of_day" => "midday",
      "weather" => "clear"
    },
    soundscape: %{file: "Rain-soaked_Forest_Silence.mp3", category: "nature", confidence: 0.9}
  },
  %{
    scene_number: 16,
    start_page: 18,
    end_page: 18,
    descriptors: %{
      "activity_level" => "intense",
      "atmosphere" => "dramatic",
      "dominant_elements" => "wind, voices, tension",
      "mood" => "angry",
      "scene_type" => "conflict",
      "setting" => "wilderness",
      "time_of_day" => "afternoon",
      "weather" => "windy"
    },
    soundscape: %{file: "Howling_Wind.mp3", category: "nature", confidence: 1.0}
  },
  %{
    scene_number: 17,
    start_page: 19,
    end_page: 19,
    descriptors: %{
      "activity_level" => "still",
      "atmosphere" => "dramatic",
      "dominant_elements" => "silence, isolation, tension",
      "mood" => "sorrowful",
      "scene_type" => "dialogue",
      "setting" => "wilderness",
      "time_of_day" => "night",
      "weather" => "clear"
    },
    soundscape: %{file: "Rain-soaked_Forest_Silence.mp3", category: "nature", confidence: 0.9}
  },
  %{
    scene_number: 18,
    start_page: 20,
    end_page: 20,
    descriptors: %{
      "activity_level" => "calm",
      "atmosphere" => "magical",
      "dominant_elements" => "wonder, silence, birds",
      "mood" => "whimsical",
      "scene_type" => "revelation",
      "setting" => "garden",
      "time_of_day" => "dawn",
      "weather" => "clear"
    },
    soundscape: %{file: "Rain-soaked_Forest_Silence.mp3", category: "nature", confidence: 1.0}
  },
  %{
    scene_number: 19,
    start_page: 21,
    end_page: 21,
    descriptors: %{
      "activity_level" => "calm",
      "atmosphere" => "whimsical",
      "dominant_elements" => "silence, tension, wonder",
      "mood" => "whimsical",
      "scene_type" => "dialogue",
      "setting" => "garden",
      "time_of_day" => "morning",
      "weather" => "clear"
    },
    soundscape: %{file: "Rain-soaked_Forest_Silence.mp3", category: "nature", confidence: 1.0}
  },
  %{
    scene_number: 20,
    start_page: 22,
    end_page: 22,
    descriptors: %{
      "activity_level" => "calm",
      "atmosphere" => "contemplative",
      "dominant_elements" => "silence, wind, birds",
      "mood" => "melancholic",
      "scene_type" => "introspection",
      "setting" => "magical_realm",
      "time_of_day" => "morning",
      "weather" => "clear"
    },
    soundscape: %{file: "Howling_Wind.mp3", category: "nature", confidence: 1.0}
  },
  %{
    scene_number: 21,
    start_page: 23,
    end_page: 23,
    descriptors: %{
      "activity_level" => "calm",
      "atmosphere" => "contemplative",
      "dominant_elements" => "silence, wind, isolation",
      "mood" => "bittersweet",
      "scene_type" => "dialogue",
      "setting" => "garden",
      "time_of_day" => "morning",
      "weather" => "clear"
    },
    soundscape: %{file: "Howling_Wind.mp3", category: "nature", confidence: 1.0}
  },
  %{
    scene_number: 22,
    start_page: 24,
    end_page: 24,
    descriptors: %{
      "activity_level" => "calm",
      "atmosphere" => "contemplative",
      "dominant_elements" => "wind, silence, wonder",
      "mood" => "bittersweet",
      "scene_type" => "journey",
      "setting" => "magical_realm",
      "time_of_day" => "night",
      "weather" => "clear"
    },
    soundscape: %{file: "Howling_Wind.mp3", category: "nature", confidence: 1.0}
  },
  %{
    scene_number: 23,
    start_page: 25,
    end_page: 25,
    descriptors: %{
      "activity_level" => "calm",
      "atmosphere" => "whimsical",
      "dominant_elements" => "voices, tension, wonder",
      "mood" => "whimsical",
      "scene_type" => "dialogue",
      "setting" => "palace",
      "time_of_day" => "unknown",
      "weather" => "unknown"
    },
    soundscape: %{file: "Grand_Castle_Hall.mp3", category: "nature", confidence: 0.4}
  },
  %{
    scene_number: 24,
    start_page: 26,
    end_page: 26,
    descriptors: %{
      "activity_level" => "calm",
      "atmosphere" => "whimsical",
      "dominant_elements" => "wonder, isolation, voices",
      "mood" => "whimsical",
      "scene_type" => "dialogue",
      "setting" => "magical_realm",
      "time_of_day" => "unknown",
      "weather" => "clear"
    },
    soundscape: %{file: "Dark_Magic_Rumble.mp3", category: "magic", confidence: 0.85}
  },
  %{
    scene_number: 25,
    start_page: 27,
    end_page: 27,
    descriptors: %{
      "activity_level" => "calm",
      "atmosphere" => "whimsical",
      "dominant_elements" => "voices, isolation, wonder",
      "mood" => "whimsical",
      "scene_type" => "dialogue",
      "setting" => "palace",
      "time_of_day" => "evening",
      "weather" => "unknown"
    },
    soundscape: %{file: "Grand_Castle_Hall.mp3", category: "nature", confidence: 0.4}
  },
  %{
    scene_number: 26,
    start_page: 28,
    end_page: 29,
    descriptors: %{
      "activity_level" => "calm",
      "atmosphere" => "whimsical",
      "dominant_elements" => "voices, isolation, wonder",
      "mood" => "bittersweet",
      "scene_type" => "dialogue",
      "setting" => "magical_realm",
      "time_of_day" => "unknown",
      "weather" => "clear"
    },
    soundscape: %{file: "Dark_Magic_Rumble.mp3", category: "magic", confidence: 0.85}
  },
  %{
    scene_number: 27,
    start_page: 30,
    end_page: 33,
    descriptors: %{
      "activity_level" => "moderate",
      "atmosphere" => "whimsical",
      "dominant_elements" => "voices, wonder, isolation",
      "mood" => "contemplative",
      "scene_type" => "dialogue",
      "setting" => "unknown",
      "time_of_day" => "unknown",
      "weather" => "unknown"
    },
    soundscape: %{file: "Awe_&_Wonder.mp3", category: "sentiment", confidence: 0.4}
  },
  %{
    scene_number: 28,
    start_page: 34,
    end_page: 34,
    descriptors: %{
      "activity_level" => "calm",
      "atmosphere" => "whimsical",
      "dominant_elements" => "isolation, wonder, silence",
      "mood" => "contemplative",
      "scene_type" => "journey",
      "setting" => "magical_realm",
      "time_of_day" => "night",
      "weather" => "clear"
    },
    soundscape: %{file: "Rain-soaked_Forest_Silence.mp3", category: "nature", confidence: 1.0}
  },
  %{
    scene_number: 29,
    start_page: 35,
    end_page: 35,
    descriptors: %{
      "activity_level" => "moderate",
      "atmosphere" => "whimsical",
      "dominant_elements" => "isolation, wonder, tension",
      "mood" => "bittersweet",
      "scene_type" => "dialogue",
      "setting" => "unknown",
      "time_of_day" => "unknown",
      "weather" => "unknown"
    },
    soundscape: %{file: "Awe_&_Wonder.mp3", category: "sentiment", confidence: 0.4}
  },
  %{
    scene_number: 30,
    start_page: 36,
    end_page: 36,
    descriptors: %{
      "activity_level" => "calm",
      "atmosphere" => "contemplative",
      "dominant_elements" => "footsteps, silence, wonder",
      "mood" => "bittersweet",
      "scene_type" => "dialogue",
      "setting" => "magical_realm",
      "time_of_day" => "dusk",
      "weather" => "clear"
    },
    soundscape: %{file: "Giant's_Footsteps.mp3", category: "magic", confidence: 1.0}
  },
  %{
    scene_number: 31,
    start_page: 37,
    end_page: 37,
    descriptors: %{
      "activity_level" => "calm",
      "atmosphere" => "whimsical",
      "dominant_elements" => "voices, wonder, isolation",
      "mood" => "curious",
      "scene_type" => "dialogue",
      "setting" => "unknown",
      "time_of_day" => "unknown",
      "weather" => "unknown"
    },
    soundscape: %{file: "Awe_&_Wonder.mp3", category: "sentiment", confidence: 0.4}
  },
  %{
    scene_number: 32,
    start_page: 38,
    end_page: 39,
    descriptors: %{
      "activity_level" => "calm",
      "atmosphere" => "contemplative",
      "dominant_elements" => "voices, silence, wonder",
      "mood" => "curious",
      "scene_type" => "dialogue",
      "setting" => "chamber",
      "time_of_day" => "unknown",
      "weather" => "unknown"
    },
    soundscape: %{file: "Rain-soaked_Forest_Silence.mp3", category: "nature", confidence: 0.9}
  },
  %{
    scene_number: 33,
    start_page: 40,
    end_page: 40,
    descriptors: %{
      "activity_level" => "calm",
      "atmosphere" => "contemplative",
      "dominant_elements" => "silence, isolation, wonder",
      "mood" => "bittersweet",
      "scene_type" => "introspection",
      "setting" => "unknown",
      "time_of_day" => "unknown",
      "weather" => "unknown"
    },
    soundscape: %{file: "Rain-soaked_Forest_Silence.mp3", category: "nature", confidence: 0.9}
  },
  %{
    scene_number: 34,
    start_page: 41,
    end_page: 41,
    descriptors: %{
      "activity_level" => "calm",
      "atmosphere" => "whimsical",
      "dominant_elements" => "wonder, isolation, silence",
      "mood" => "contemplative",
      "scene_type" => "introspection",
      "setting" => "dreamscape",
      "time_of_day" => "night",
      "weather" => "unknown"
    },
    soundscape: %{file: "Rain-soaked_Forest_Silence.mp3", category: "nature", confidence: 1.0}
  },
  %{
    scene_number: 35,
    start_page: 42,
    end_page: 43,
    descriptors: %{
      "activity_level" => "still",
      "atmosphere" => "contemplative",
      "dominant_elements" => "silence, isolation, danger",
      "mood" => "contemplative",
      "scene_type" => "dialogue",
      "setting" => "desert",
      "time_of_day" => "evening",
      "weather" => "clear"
    },
    soundscape: %{file: "Rain-soaked_Forest_Silence.mp3", category: "nature", confidence: 0.9}
  },
  %{
    scene_number: 36,
    start_page: 44,
    end_page: 44,
    descriptors: %{
      "activity_level" => "calm",
      "atmosphere" => "contemplative",
      "dominant_elements" => "echoes, wind, isolation",
      "mood" => "melancholic",
      "scene_type" => "introspection",
      "setting" => "mountain",
      "time_of_day" => "unknown",
      "weather" => "clear"
    },
    soundscape: %{file: "Howling_Wind.mp3", category: "nature", confidence: 1.0}
  },
  %{
    scene_number: 37,
    start_page: 45,
    end_page: 45,
    descriptors: %{
      "activity_level" => "still",
      "atmosphere" => "contemplative",
      "dominant_elements" => "silence, rustling, isolation",
      "mood" => "sorrowful",
      "scene_type" => "revelation",
      "setting" => "garden",
      "time_of_day" => "morning",
      "weather" => "clear"
    },
    soundscape: %{file: "Rain-soaked_Forest_Silence.mp3", category: "nature", confidence: 1.0}
  },
  %{
    scene_number: 38,
    start_page: 46,
    end_page: 47,
    descriptors: %{
      "activity_level" => "calm",
      "atmosphere" => "contemplative",
      "dominant_elements" => "wind, silence, wonder",
      "mood" => "bittersweet",
      "scene_type" => "dialogue",
      "setting" => "countryside",
      "time_of_day" => "afternoon",
      "weather" => "clear"
    },
    soundscape: %{file: "Howling_Wind.mp3", category: "nature", confidence: 1.0}
  },
  %{
    scene_number: 39,
    start_page: 48,
    end_page: 48,
    descriptors: %{
      "activity_level" => "calm",
      "atmosphere" => "whimsical",
      "dominant_elements" => "grass, silence, wind",
      "mood" => "contemplative",
      "scene_type" => "dialogue",
      "setting" => "meadow",
      "time_of_day" => "afternoon",
      "weather" => "clear"
    },
    soundscape: %{file: "Howling_Wind.mp3", category: "nature", confidence: 1.0}
  },
  %{
    scene_number: 40,
    start_page: 49,
    end_page: 49,
    descriptors: %{
      "activity_level" => "calm",
      "atmosphere" => "contemplative",
      "dominant_elements" => "voices, wind, silence",
      "mood" => "bittersweet",
      "scene_type" => "dialogue",
      "setting" => "garden",
      "time_of_day" => "afternoon",
      "weather" => "clear"
    },
    soundscape: %{file: "Howling_Wind.mp3", category: "nature", confidence: 1.0}
  },
  %{
    scene_number: 41,
    start_page: 50,
    end_page: 50,
    descriptors: %{
      "activity_level" => "moderate",
      "atmosphere" => "contemplative",
      "dominant_elements" => "voices, footsteps, thunder",
      "mood" => "bittersweet",
      "scene_type" => "dialogue",
      "setting" => "countryside",
      "time_of_day" => "morning",
      "weather" => "clear"
    },
    soundscape: %{file: "Giant's_Footsteps.mp3", category: "magic", confidence: 1.0}
  },
  %{
    scene_number: 42,
    start_page: 51,
    end_page: 51,
    descriptors: %{
      "activity_level" => "moderate",
      "atmosphere" => "philosophical",
      "dominant_elements" => "train_rumbling, mechanical_sounds, voices",
      "mood" => "contemplative",
      "scene_type" => "dialogue",
      "setting" => "railway_station",
      "time_of_day" => "unknown",
      "weather" => "unknown"
    },
    soundscape: %{file: "Crowd_Murmur.mp3", category: "movement", confidence: 0.3}
  },
  %{
    scene_number: 43,
    start_page: 52,
    end_page: 52,
    descriptors: %{
      "activity_level" => "calm",
      "atmosphere" => "contemplative",
      "dominant_elements" => "silence, isolation, tension",
      "mood" => "desperate",
      "scene_type" => "dialogue",
      "setting" => "desert",
      "time_of_day" => "afternoon",
      "weather" => "sunny"
    },
    soundscape: %{file: "Rain-soaked_Forest_Silence.mp3", category: "nature", confidence: 0.9}
  },
  %{
    scene_number: 44,
    start_page: 53,
    end_page: 54,
    descriptors: %{
      "activity_level" => "calm",
      "atmosphere" => "ethereal",
      "dominant_elements" => "moonlight, wind, silence",
      "mood" => "contemplative",
      "scene_type" => "introspection",
      "setting" => "desert",
      "time_of_day" => "night",
      "weather" => "clear"
    },
    soundscape: %{file: "Howling_Wind.mp3", category: "nature", confidence: 1.0}
  },
  %{
    scene_number: 45,
    start_page: 55,
    end_page: 55,
    descriptors: %{
      "activity_level" => "calm",
      "atmosphere" => "magical",
      "dominant_elements" => "water, silence, wonder",
      "mood" => "contemplative",
      "scene_type" => "revelation",
      "setting" => "wilderness",
      "time_of_day" => "morning",
      "weather" => "sunny"
    },
    soundscape: %{file: "Rain-soaked_Forest_Silence.mp3", category: "nature", confidence: 1.0}
  },
  %{
    scene_number: 46,
    start_page: 56,
    end_page: 58,
    descriptors: %{
      "activity_level" => "calm",
      "atmosphere" => "contemplative",
      "dominant_elements" => "danger, silence, tension",
      "mood" => "bittersweet",
      "scene_type" => "dialogue",
      "setting" => "wilderness",
      "time_of_day" => "evening",
      "weather" => "clear"
    },
    soundscape: %{file: "Rain-soaked_Forest_Silence.mp3", category: "nature", confidence: 0.9}
  },
  %{
    scene_number: 47,
    start_page: 59,
    end_page: 59,
    descriptors: %{
      "activity_level" => "still",
      "atmosphere" => "dramatic",
      "dominant_elements" => "silence, tension, isolation",
      "mood" => "sorrowful",
      "scene_type" => "revelation",
      "setting" => "wilderness",
      "time_of_day" => "afternoon",
      "weather" => "clear"
    },
    soundscape: %{file: "Rain-soaked_Forest_Silence.mp3", category: "nature", confidence: 0.9}
  },
  %{
    scene_number: 48,
    start_page: 60,
    end_page: 60,
    descriptors: %{
      "activity_level" => "still",
      "atmosphere" => "ethereal",
      "dominant_elements" => "silence, wonder, isolation",
      "mood" => "bittersweet",
      "scene_type" => "dialogue",
      "setting" => "wilderness",
      "time_of_day" => "night",
      "weather" => "clear"
    },
    soundscape: %{file: "Rain-soaked_Forest_Silence.mp3", category: "nature", confidence: 0.9}
  },
  %{
    scene_number: 49,
    start_page: 61,
    end_page: 61,
    descriptors: %{
      "activity_level" => "calm",
      "atmosphere" => "ethereal",
      "dominant_elements" => "silence, wonder, bells",
      "mood" => "bittersweet",
      "scene_type" => "revelation",
      "setting" => "unknown",
      "time_of_day" => "night",
      "weather" => "clear"
    },
    soundscape: %{file: "Rain-soaked_Forest_Silence.mp3", category: "nature", confidence: 0.9}
  },
  %{
    scene_number: 50,
    start_page: 62,
    end_page: 63,
    descriptors: %{
      "activity_level" => "calm",
      "atmosphere" => "contemplative",
      "dominant_elements" => "silence, bells, isolation",
      "mood" => "sorrowful",
      "scene_type" => "dialogue",
      "setting" => "wilderness",
      "time_of_day" => "night",
      "weather" => "clear"
    },
    soundscape: %{file: "Rain-soaked_Forest_Silence.mp3", category: "nature", confidence: 0.9}
  },
  %{
    scene_number: 51,
    start_page: 64,
    end_page: 64,
    descriptors: %{
      "activity_level" => "still",
      "atmosphere" => "contemplative",
      "dominant_elements" => "silence, bells, mystery",
      "mood" => "bittersweet",
      "scene_type" => "introspection",
      "setting" => "dreamscape",
      "time_of_day" => "night",
      "weather" => "clear"
    },
    soundscape: %{file: "Rain-soaked_Forest_Silence.mp3", category: "nature", confidence: 0.9}
  }
]

# Delete existing scenes and pages for this book to avoid duplicates
IO.puts("🧹 Cleaning up existing scenes and pages...")

from(s in Scene, where: s.book_id == ^book.id)
|> Repo.delete_all()

from(p in Content.Page, where: p.book_id == ^book.id)
|> Repo.delete_all()

# Extract pages from PDF
IO.puts("📄 Extracting pages from PDF...")

root_pdf_path = Path.join(File.cwd!(), "The_Little_Prince.pdf")
public_pdf_dir = Path.join([File.cwd!(), "priv", "static", "books"])
public_pdf_path = Path.join(public_pdf_dir, "The_Little_Prince.pdf")

# Ensure public directory exists
File.mkdir_p!(public_pdf_dir)

# Determine which PDF to use
pdf_path =
  cond do
    File.exists?(root_pdf_path) ->
      unless File.exists?(public_pdf_path) do
        File.cp!(root_pdf_path, public_pdf_path)
        IO.puts("  ✓ Copied PDF to #{public_pdf_path}")
      end

      root_pdf_path

    File.exists?(public_pdf_path) ->
      IO.puts("  ✓ PDF already in public directory")
      public_pdf_path

    true ->
      IO.puts("❌ ERROR: The_Little_Prince.pdf not found in project root or public directory!")
      System.halt(1)
  end

# Extract text using Rust NIF - Extract entire book
case RustReader.extract_pdf(pdf_path) do
  {pages_json, _metadata} ->
    pages_data =
      Enum.map(pages_json, fn json_str ->
        Jason.decode!(json_str)
      end)

    IO.puts("  ✓ Extracted #{length(pages_data)} pages from entire book using Rust")

    pages_to_insert =
      Enum.map(pages_data, fn page ->
        %{
          book_id: book.id,
          page_number: page["page_number"],
          text_content: page["text_content"],
          inserted_at: NaiveDateTime.utc_now() |> NaiveDateTime.truncate(:second),
          updated_at: NaiveDateTime.utc_now() |> NaiveDateTime.truncate(:second)
        }
      end)

    {count, _} = Repo.insert_all(Content.Page, pages_to_insert)
    IO.puts("  ✓ Created #{count} page records")

    Content.update_book(book, %{total_pages: count})

  {:error, reason} ->
    IO.puts("❌ PDF extraction failed: #{inspect(reason)}")
    System.halt(1)
end

# Load curated soundscapes from bucket
IO.puts("🎵 Loading curated soundscapes...")
{:ok, curated_soundscapes} = Soundscapes.list_curated_soundscapes_from_bucket()

IO.puts("📄 Creating #{length(scenes_data)} scenes with soundscapes...")

# Create scenes and assign soundscapes
Repo.transaction(fn ->
  Enum.each(scenes_data, fn scene_data ->
    {:ok, scene} =
      %Scene{}
      |> Scene.changeset(%{
        book_id: book.id,
        scene_number: scene_data.scene_number,
        start_page: scene_data.start_page,
        end_page: scene_data.end_page,
        descriptors: scene_data.descriptors
      })
      |> Repo.insert()

    IO.puts("  ✓ Scene #{scene_data.scene_number} (pages #{scene_data.start_page}-#{scene_data.end_page})")

    from(p in Content.Page,
      where: p.book_id == ^book.id,
      where: p.page_number >= ^scene_data.start_page,
      where: p.page_number <= ^scene_data.end_page
    )
    |> Repo.update_all(set: [scene_id: scene.id])

    if scene_data.soundscape do
      soundscape_info = scene_data.soundscape
      category = soundscape_info.category

      files = Map.get(curated_soundscapes, category, [])
      file_info = Enum.find(files, fn f -> f.name == soundscape_info.file end)

      if file_info do
        case Soundscapes.create_soundscape_from_bucket(scene.id, file_info, category) do
          {:ok, _soundscape} ->
            IO.puts("    🎵 Assigned: #{soundscape_info.file} (confidence: #{soundscape_info.confidence})")

          {:error, reason} ->
            IO.puts("    ⚠️  Failed to assign soundscape: #{inspect(reason)}")
        end
      else
        IO.puts("    ⚠️  Soundscape file not found: #{soundscape_info.file}")
      end
    else
      IO.puts("    ⚠️  No soundscape match")
    end
  end)
end, timeout: :infinity)

# Update book status to published
IO.puts("\n📚 Publishing book...")

{:ok, _book} =
  Content.update_book(book, %{
    processing_status: "published",
    is_published: true
  })

IO.puts("""

✅ The Little Prince is ready!

═══════════════════════════════════════════════════════════
BOOK DETAILS:
  Title:  #{book.title}
  Author: #{book.author}
  Pages:  #{Repo.reload(book).total_pages} (entire book extracted)
  Scenes: #{length(scenes_data)} (fully mapped with soundscapes)
  Status: Published ✓

═══════════════════════════════════════════════════════════

🎉 READY TO READ!

Start the server and enjoy the full experience:

  1. Start server:
     $ mix phx.server

  2. Log in as any user:
     - free@storia.app / FreeUser123!
     - reader@storia.app / Reader123!
     - bibliophile@storia.app / Bibliophile123!

  3. Visit the library:
     http://localhost:4000/library

  4. Click on "The Little Prince"

═══════════════════════════════════════════════════════════
""")

IO.puts("✅ Seed completed!\n")
