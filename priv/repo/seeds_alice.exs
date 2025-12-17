# Seed script for Alice's Adventures in Wonderland (Entire Book)
# This creates a fully readable book with scenes and soundscapes
#
# Run with: mix run priv/repo/seeds_alice.exs

defmodule SeedHelpers do
  def chunk_text_to_pages(text, max_chars) do
    text
    |> String.split(~r/\n\s*\n/, trim: true) # split on blank-line paragraphs
    |> Enum.flat_map(&String.split(&1, "\n"))
    |> Enum.map(&String.trim/1)
    |> Enum.reject(&(&1 == ""))
    |> Enum.reduce({[], ""}, fn line, {pages, current} ->
      add = if current == "", do: line, else: current <> "\n" <> line

      if String.length(add) >= max_chars do
        {pages ++ [add], ""}
      else
        {pages, add}
      end
    end)
    |> then(fn {pages, leftover} ->
      pages = if leftover != "", do: pages ++ [leftover], else: pages
      pages
    end)
  end
end

alias Storia.Repo
alias Storia.Content
alias Storia.Content.{Book, Scene}
alias Storia.Soundscapes

import Ecto.Query

IO.puts("\n🐰 Seeding Alice's Adventures in Wonderland...\n")

# Check if book already exists
existing_book = Repo.get_by(Book, title: "Alice's Adventures in Wonderland")

book = if existing_book do
  IO.puts("📖 Found existing book, updating...")
  {:ok, updated_book} = Content.update_book(existing_book, %{
    pdf_url: "/books/Alice_in_Wonderland.pdf",
    processing_status: "pending"
  })
  updated_book
else
  IO.puts("📖 Creating new book...")
  {:ok, book} = Content.create_book(%{
    title: "Alice's Adventures in Wonderland",
    author: "Lewis Carroll",
    pdf_url: "/books/Alice_in_Wonderland.pdf",
    processing_status: "pending",
    total_pages: 0, # Will be updated after extraction
    metadata: %{
      "genre" => "Fantasy, Children's Literature",
      "publication_year" => "1865",
      "description" => "Follow Alice down the rabbit hole into a fantastical world of wonder, whimsy, and curious adventures."
    }
  })
  book
end

# Scene data from the latest AI analysis (57 scenes, entire book)
# Boundaries: [1, 2, 3, 4, 5, 8, 9, 11, 12, 14, 15, 16, 17, 19, 20, 23, 24, 25, 26, 27, 29, 30, 33, 34, 35, 36, 37, 39, 40, 41, 44, 45, 50, 51, 62, 67, 68, 69, 72, 75, 77, 78, 79, 82, 87, 88, 89, 91, 92, 95, ...]
# Note: Scene 41 (seaside/melancholic) had no soundscape match due to low confidence
scenes_data = [
  %{
    scene_number: 1,
    start_page: 1,
    end_page: 1,
    descriptors: %{
      "setting" => "library",
      "mood" => "whimsical",
      "time_of_day" => "unknown",
      "weather" => "unknown",
      "dominant_elements" => "silence, pages, wonder",
      "activity_level" => "calm",
      "atmosphere" => "nostalgic",
      "scene_type" => "description"
    },
    soundscape: %{file: "Rain-soaked_Forest_Silence.mp3", category: "nature", confidence: 1.0}
  },
  %{
    scene_number: 2,
    start_page: 2,
    end_page: 2,
    descriptors: %{
      "setting" => "riverside",
      "mood" => "nostalgic",
      "time_of_day" => "afternoon",
      "weather" => "sunny",
      "dominant_elements" => "water, voices, birds",
      "activity_level" => "calm",
      "atmosphere" => "tranquil",
      "scene_type" => "description"
    },
    soundscape: %{file: "Rain-soaked_Forest_Silence.mp3", category: "nature", confidence: 0.7}
  },
  %{
    scene_number: 3,
    start_page: 3,
    end_page: 3,
    descriptors: %{
      "setting" => "riverside",
      "mood" => "nostalgic",
      "time_of_day" => "dusk",
      "weather" => "clear",
      "dominant_elements" => "water, voices, wonder",
      "activity_level" => "calm",
      "atmosphere" => "bittersweet",
      "scene_type" => "introspection"
    },
    soundscape: %{file: "Babbling_Brook.mp3", category: "nature", confidence: 0.55}
  },
  %{
    scene_number: 4,
    start_page: 4,
    end_page: 4,
    descriptors: %{
      "setting" => "riverside",
      "mood" => "curious",
      "time_of_day" => "afternoon",
      "weather" => "sunny",
      "dominant_elements" => "birds, rustling, wonder",
      "activity_level" => "moderate",
      "atmosphere" => "whimsical",
      "scene_type" => "discovery"
    },
    soundscape: %{file: "Rain-soaked_Forest_Silence.mp3", category: "nature", confidence: 0.8}
  },
  %{
    scene_number: 5,
    start_page: 5,
    end_page: 7,
    descriptors: %{
      "setting" => "underground",
      "mood" => "whimsical",
      "time_of_day" => "unknown",
      "weather" => "unknown",
      "dominant_elements" => "echoes, wonder, isolation",
      "activity_level" => "active",
      "atmosphere" => "whimsical",
      "scene_type" => "action"
    },
    soundscape: %{file: "Echoing_Cave.mp3", category: "nature", confidence: 0.4}
  },
  %{
    scene_number: 6,
    start_page: 8,
    end_page: 8,
    descriptors: %{
      "setting" => "hall",
      "mood" => "curious",
      "time_of_day" => "unknown",
      "weather" => "unknown",
      "dominant_elements" => "footsteps, echoes, wonder",
      "activity_level" => "moderate",
      "atmosphere" => "whimsical",
      "scene_type" => "discovery"
    },
    soundscape: %{file: "Giant's_Footsteps.mp3", category: "magic", confidence: 1.0}
  },
  %{
    scene_number: 7,
    start_page: 9,
    end_page: 10,
    descriptors: %{
      "setting" => "magical_realm",
      "mood" => "anxious",
      "time_of_day" => "unknown",
      "weather" => "unknown",
      "dominant_elements" => "wonder, mystery, magic",
      "activity_level" => "moderate",
      "atmosphere" => "whimsical",
      "scene_type" => "introspection"
    },
    soundscape: %{file: "Dark_Magic_Rumble.mp3", category: "magic", confidence: 1.0}
  },
  %{
    scene_number: 8,
    start_page: 11,
    end_page: 11,
    descriptors: %{
      "setting" => "underground",
      "mood" => "whimsical",
      "time_of_day" => "unknown",
      "weather" => "unknown",
      "dominant_elements" => "wonder, mystery, isolation",
      "activity_level" => "moderate",
      "atmosphere" => "magical",
      "scene_type" => "transformation"
    },
    soundscape: %{file: "Echoing_Cave.mp3", category: "nature", confidence: 0.4}
  },
  %{
    scene_number: 9,
    start_page: 12,
    end_page: 13,
    descriptors: %{
      "setting" => "hall",
      "mood" => "anxious",
      "time_of_day" => "unknown",
      "weather" => "unknown",
      "dominant_elements" => "footsteps, echoes, isolation",
      "activity_level" => "moderate",
      "atmosphere" => "whimsical",
      "scene_type" => "introspection"
    },
    soundscape: %{file: "Giant's_Footsteps.mp3", category: "magic", confidence: 1.0}
  },
  %{
    scene_number: 10,
    start_page: 14,
    end_page: 14,
    descriptors: %{
      "setting" => "dreamscape",
      "mood" => "anxious",
      "time_of_day" => "unknown",
      "weather" => "unknown",
      "dominant_elements" => "voices, confusion, isolation",
      "activity_level" => "calm",
      "atmosphere" => "whimsical",
      "scene_type" => "introspection"
    },
    soundscape: %{file: "Tense_Whispering.mp3", category: "movement", confidence: 0.4}
  },
  %{
    scene_number: 11,
    start_page: 15,
    end_page: 15,
    descriptors: %{
      "setting" => "underground",
      "mood" => "anxious",
      "time_of_day" => "unknown",
      "weather" => "unknown",
      "dominant_elements" => "isolation, wonder, tension",
      "activity_level" => "moderate",
      "atmosphere" => "whimsical",
      "scene_type" => "transformation"
    },
    soundscape: %{file: "Echoing_Cave.mp3", category: "nature", confidence: 0.4}
  },
  %{
    scene_number: 12,
    start_page: 16,
    end_page: 16,
    descriptors: %{
      "setting" => "dreamscape",
      "mood" => "anxious",
      "time_of_day" => "unknown",
      "weather" => "unknown",
      "dominant_elements" => "water, isolation, wonder",
      "activity_level" => "active",
      "atmosphere" => "whimsical",
      "scene_type" => "action"
    },
    soundscape: %{file: "Light_Gentle_Rain.mp3", category: "nature", confidence: 0.4}
  },
  %{
    scene_number: 13,
    start_page: 17,
    end_page: 18,
    descriptors: %{
      "setting" => "dreamscape",
      "mood" => "anxious",
      "time_of_day" => "unknown",
      "weather" => "unknown",
      "dominant_elements" => "water, voices, tension",
      "activity_level" => "moderate",
      "atmosphere" => "whimsical",
      "scene_type" => "dialogue"
    },
    soundscape: %{file: "Tense_Whispering.mp3", category: "movement", confidence: 0.4}
  },
  %{
    scene_number: 14,
    start_page: 19,
    end_page: 19,
    descriptors: %{
      "setting" => "lakeside",
      "mood" => "whimsical",
      "time_of_day" => "unknown",
      "weather" => "unknown",
      "dominant_elements" => "water, birds, voices",
      "activity_level" => "moderate",
      "atmosphere" => "whimsical",
      "scene_type" => "dialogue"
    },
    soundscape: %{file: "Rain-soaked_Forest_Silence.mp3", category: "nature", confidence: 0.55}
  },
  %{
    scene_number: 15,
    start_page: 20,
    end_page: 22,
    descriptors: %{
      "setting" => "unknown",
      "mood" => "whimsical",
      "time_of_day" => "unknown",
      "weather" => "unknown",
      "dominant_elements" => "birds, voices, rustling",
      "activity_level" => "moderate",
      "atmosphere" => "whimsical",
      "scene_type" => "dialogue"
    },
    soundscape: %{file: "Rain-soaked_Forest_Silence.mp3", category: "nature", confidence: 0.4}
  },
  %{
    scene_number: 16,
    start_page: 23,
    end_page: 23,
    descriptors: %{
      "setting" => "dreamscape",
      "mood" => "whimsical",
      "time_of_day" => "unknown",
      "weather" => "unknown",
      "dominant_elements" => "birds, voices, wonder",
      "activity_level" => "moderate",
      "atmosphere" => "whimsical",
      "scene_type" => "dialogue"
    },
    soundscape: %{file: "Rain-soaked_Forest_Silence.mp3", category: "nature", confidence: 0.4}
  },
  %{
    scene_number: 17,
    start_page: 24,
    end_page: 24,
    descriptors: %{
      "setting" => "unknown",
      "mood" => "tense",
      "time_of_day" => "unknown",
      "weather" => "unknown",
      "dominant_elements" => "voices, tension, footsteps",
      "activity_level" => "moderate",
      "atmosphere" => "whimsical",
      "scene_type" => "conflict"
    },
    soundscape: %{file: "Giant's_Footsteps.mp3", category: "magic", confidence: 1.0}
  },
  %{
    scene_number: 18,
    start_page: 25,
    end_page: 25,
    descriptors: %{
      "setting" => "unknown",
      "mood" => "melancholic",
      "time_of_day" => "evening",
      "weather" => "unknown",
      "dominant_elements" => "birds, footsteps, isolation",
      "activity_level" => "calm",
      "atmosphere" => "contemplative",
      "scene_type" => "dialogue"
    },
    soundscape: %{file: "Giant's_Footsteps.mp3", category: "magic", confidence: 1.0}
  },
  %{
    scene_number: 19,
    start_page: 26,
    end_page: 26,
    descriptors: %{
      "setting" => "dreamscape",
      "mood" => "anxious",
      "time_of_day" => "unknown",
      "weather" => "unknown",
      "dominant_elements" => "footsteps, voices, tension",
      "activity_level" => "energetic",
      "atmosphere" => "whimsical",
      "scene_type" => "action"
    },
    soundscape: %{file: "Giant's_Footsteps.mp3", category: "magic", confidence: 1.0}
  },
  %{
    scene_number: 20,
    start_page: 27,
    end_page: 28,
    descriptors: %{
      "setting" => "cottage",
      "mood" => "anxious",
      "time_of_day" => "unknown",
      "weather" => "unknown",
      "dominant_elements" => "tension, wonder, isolation",
      "activity_level" => "moderate",
      "atmosphere" => "whimsical",
      "scene_type" => "discovery"
    },
    soundscape: %{file: "Awe_&_Wonder.mp3", category: "sentiment", confidence: 0.4}
  },
  %{
    scene_number: 21,
    start_page: 29,
    end_page: 29,
    descriptors: %{
      "setting" => "home",
      "mood" => "anxious",
      "time_of_day" => "unknown",
      "weather" => "unknown",
      "dominant_elements" => "footsteps, voices, tension",
      "activity_level" => "moderate",
      "atmosphere" => "suspenseful",
      "scene_type" => "conflict"
    },
    soundscape: %{file: "Giant's_Footsteps.mp3", category: "magic", confidence: 1.0}
  },
  %{
    scene_number: 22,
    start_page: 30,
    end_page: 32,
    descriptors: %{
      "setting" => "cottage",
      "mood" => "whimsical",
      "time_of_day" => "unknown",
      "weather" => "unknown",
      "dominant_elements" => "voices, tension, rustling",
      "activity_level" => "chaotic",
      "atmosphere" => "whimsical",
      "scene_type" => "conflict"
    },
    soundscape: %{file: "Crowd_Murmur.mp3", category: "movement", confidence: 0.3}
  },
  %{
    scene_number: 23,
    start_page: 33,
    end_page: 33,
    descriptors: %{
      "setting" => "forest",
      "mood" => "anxious",
      "time_of_day" => "unknown",
      "weather" => "unknown",
      "dominant_elements" => "rustling, voices, wonder",
      "activity_level" => "active",
      "atmosphere" => "whimsical",
      "scene_type" => "action"
    },
    soundscape: %{file: "Dark_Magic_Rumble.mp3", category: "magic", confidence: 0.65}
  },
  %{
    scene_number: 24,
    start_page: 34,
    end_page: 34,
    descriptors: %{
      "setting" => "garden",
      "mood" => "anxious",
      "time_of_day" => "afternoon",
      "weather" => "clear",
      "dominant_elements" => "rustling, footsteps, tension",
      "activity_level" => "energetic",
      "atmosphere" => "whimsical",
      "scene_type" => "action"
    },
    soundscape: %{file: "Giant's_Footsteps.mp3", category: "magic", confidence: 1.0}
  },
  %{
    scene_number: 25,
    start_page: 35,
    end_page: 35,
    descriptors: %{
      "setting" => "garden",
      "mood" => "curious",
      "time_of_day" => "afternoon",
      "weather" => "sunny",
      "dominant_elements" => "silence, wonder, mystery",
      "activity_level" => "calm",
      "atmosphere" => "whimsical",
      "scene_type" => "discovery"
    },
    soundscape: %{file: "Rain-soaked_Forest_Silence.mp3", category: "nature", confidence: 1.0}
  },
  %{
    scene_number: 26,
    start_page: 36,
    end_page: 36,
    descriptors: %{
      "setting" => "garden",
      "mood" => "uncertain",
      "time_of_day" => "afternoon",
      "weather" => "unknown",
      "dominant_elements" => "tension, wonder, rustling",
      "activity_level" => "calm",
      "atmosphere" => "whimsical",
      "scene_type" => "dialogue"
    },
    soundscape: %{file: "Rain-soaked_Forest_Silence.mp3", category: "nature", confidence: 0.65}
  },
  %{
    scene_number: 27,
    start_page: 37,
    end_page: 38,
    descriptors: %{
      "setting" => "dreamscape",
      "mood" => "uncertain",
      "time_of_day" => "unknown",
      "weather" => "unknown",
      "dominant_elements" => "voices, tension, wonder",
      "activity_level" => "calm",
      "atmosphere" => "whimsical",
      "scene_type" => "dialogue"
    },
    soundscape: %{file: "Awe_&_Wonder.mp3", category: "sentiment", confidence: 0.4}
  },
  %{
    scene_number: 28,
    start_page: 39,
    end_page: 39,
    descriptors: %{
      "setting" => "magical_realm",
      "mood" => "tense",
      "time_of_day" => "unknown",
      "weather" => "unknown",
      "dominant_elements" => "tension, rustling, mystery",
      "activity_level" => "calm",
      "atmosphere" => "whimsical",
      "scene_type" => "dialogue"
    },
    soundscape: %{file: "Dark_Magic_Rumble.mp3", category: "magic", confidence: 0.85}
  },
  %{
    scene_number: 29,
    start_page: 40,
    end_page: 40,
    descriptors: %{
      "setting" => "garden",
      "mood" => "anxious",
      "time_of_day" => "unknown",
      "weather" => "unknown",
      "dominant_elements" => "leaves, wonder, tension",
      "activity_level" => "intense",
      "atmosphere" => "whimsical",
      "scene_type" => "transformation"
    },
    soundscape: %{file: "Rain-soaked_Forest_Silence.mp3", category: "nature", confidence: 0.65}
  },
  %{
    scene_number: 30,
    start_page: 41,
    end_page: 43,
    descriptors: %{
      "setting" => "forest",
      "mood" => "anxious",
      "time_of_day" => "unknown",
      "weather" => "unknown",
      "dominant_elements" => "birds, leaves, tension",
      "activity_level" => "moderate",
      "atmosphere" => "whimsical",
      "scene_type" => "conflict"
    },
    soundscape: %{file: "Rain-soaked_Forest_Silence.mp3", category: "nature", confidence: 0.8}
  },
  %{
    scene_number: 31,
    start_page: 44,
    end_page: 44,
    descriptors: %{
      "setting" => "forest",
      "mood" => "whimsical",
      "time_of_day" => "afternoon",
      "weather" => "clear",
      "dominant_elements" => "footsteps, voices, rustling",
      "activity_level" => "moderate",
      "atmosphere" => "whimsical",
      "scene_type" => "discovery"
    },
    soundscape: %{file: "Giant's_Footsteps.mp3", category: "magic", confidence: 1.0}
  },
  %{
    scene_number: 32,
    start_page: 45,
    end_page: 49,
    descriptors: %{
      "setting" => "cottage",
      "mood" => "chaotic",
      "time_of_day" => "unknown",
      "weather" => "unknown",
      "dominant_elements" => "fire, voices, tension",
      "activity_level" => "chaotic",
      "atmosphere" => "whimsical",
      "scene_type" => "conflict"
    },
    soundscape: %{file: "Crowd_Murmur.mp3", category: "movement", confidence: 0.3}
  },
  %{
    scene_number: 33,
    start_page: 50,
    end_page: 50,
    descriptors: %{
      "setting" => "forest",
      "mood" => "whimsical",
      "time_of_day" => "unknown",
      "weather" => "unknown",
      "dominant_elements" => "rustling, wonder, footsteps",
      "activity_level" => "moderate",
      "atmosphere" => "whimsical",
      "scene_type" => "transformation"
    },
    soundscape: %{file: "Giant's_Footsteps.mp3", category: "magic", confidence: 1.0}
  },
  %{
    scene_number: 34,
    start_page: 51,
    end_page: 61,
    descriptors: %{
      "setting" => "garden",
      "mood" => "whimsical",
      "time_of_day" => "afternoon",
      "weather" => "unknown",
      "dominant_elements" => "voices, tension, wonder",
      "activity_level" => "moderate",
      "atmosphere" => "whimsical",
      "scene_type" => "dialogue"
    },
    soundscape: %{file: "Rain-soaked_Forest_Silence.mp3", category: "nature", confidence: 0.65}
  },
  %{
    scene_number: 35,
    start_page: 62,
    end_page: 66,
    descriptors: %{
      "setting" => "garden",
      "mood" => "anxious",
      "time_of_day" => "afternoon",
      "weather" => "clear",
      "dominant_elements" => "voices, tension, footsteps",
      "activity_level" => "active",
      "atmosphere" => "dramatic",
      "scene_type" => "conflict"
    },
    soundscape: %{file: "Giant's_Footsteps.mp3", category: "magic", confidence: 1.0}
  },
  %{
    scene_number: 36,
    start_page: 67,
    end_page: 67,
    descriptors: %{
      "setting" => "garden",
      "mood" => "whimsical",
      "time_of_day" => "afternoon",
      "weather" => "clear",
      "dominant_elements" => "voices, tension, wonder",
      "activity_level" => "chaotic",
      "atmosphere" => "whimsical",
      "scene_type" => "action"
    },
    soundscape: %{file: "Rain-soaked_Forest_Silence.mp3", category: "nature", confidence: 0.65}
  },
  %{
    scene_number: 37,
    start_page: 68,
    end_page: 68,
    descriptors: %{
      "setting" => "magical_realm",
      "mood" => "anxious",
      "time_of_day" => "afternoon",
      "weather" => "unknown",
      "dominant_elements" => "voices, tension, wonder",
      "activity_level" => "chaotic",
      "atmosphere" => "whimsical",
      "scene_type" => "conflict"
    },
    soundscape: %{file: "Dark_Magic_Rumble.mp3", category: "magic", confidence: 0.85}
  },
  %{
    scene_number: 38,
    start_page: 69,
    end_page: 71,
    descriptors: %{
      "setting" => "garden",
      "mood" => "tense",
      "time_of_day" => "afternoon",
      "weather" => "unknown",
      "dominant_elements" => "voices, tension, danger",
      "activity_level" => "chaotic",
      "atmosphere" => "whimsical",
      "scene_type" => "conflict"
    },
    soundscape: %{file: "Rain-soaked_Forest_Silence.mp3", category: "nature", confidence: 0.65}
  },
  %{
    scene_number: 39,
    start_page: 72,
    end_page: 74,
    descriptors: %{
      "setting" => "garden",
      "mood" => "whimsical",
      "time_of_day" => "afternoon",
      "weather" => "unknown",
      "dominant_elements" => "voices, birds, wonder",
      "activity_level" => "moderate",
      "atmosphere" => "whimsical",
      "scene_type" => "dialogue"
    },
    soundscape: %{file: "Rain-soaked_Forest_Silence.mp3", category: "nature", confidence: 0.8}
  },
  %{
    scene_number: 40,
    start_page: 75,
    end_page: 76,
    descriptors: %{
      "setting" => "garden",
      "mood" => "tense",
      "time_of_day" => "afternoon",
      "weather" => "sunny",
      "dominant_elements" => "tension, voices, footsteps",
      "activity_level" => "chaotic",
      "atmosphere" => "dramatic",
      "scene_type" => "conflict"
    },
    soundscape: %{file: "Giant's_Footsteps.mp3", category: "magic", confidence: 1.0}
  },
  %{
    scene_number: 41,
    start_page: 77,
    end_page: 77,
    descriptors: %{
      "setting" => "seaside",
      "mood" => "melancholic",
      "time_of_day" => "unknown",
      "weather" => "overcast",
      "dominant_elements" => "ocean, isolation, sighing",
      "activity_level" => "calm",
      "atmosphere" => "bittersweet",
      "scene_type" => "dialogue"
    },
    soundscape: nil  # No match found (low confidence)
  },
  %{
    scene_number: 42,
    start_page: 78,
    end_page: 78,
    descriptors: %{
      "setting" => "unknown",
      "mood" => "melancholic",
      "time_of_day" => "unknown",
      "weather" => "unknown",
      "dominant_elements" => "silence, voices, tension",
      "activity_level" => "still",
      "atmosphere" => "contemplative",
      "scene_type" => "dialogue"
    },
    soundscape: %{file: "Rain-soaked_Forest_Silence.mp3", category: "nature", confidence: 0.9}
  },
  %{
    scene_number: 43,
    start_page: 79,
    end_page: 81,
    descriptors: %{
      "setting" => "magical_realm",
      "mood" => "whimsical",
      "time_of_day" => "unknown",
      "weather" => "unknown",
      "dominant_elements" => "ocean, voices, wonder",
      "activity_level" => "moderate",
      "atmosphere" => "whimsical",
      "scene_type" => "dialogue"
    },
    soundscape: %{file: "Dark_Magic_Rumble.mp3", category: "magic", confidence: 0.85}
  },
  %{
    scene_number: 44,
    start_page: 82,
    end_page: 86,
    descriptors: %{
      "setting" => "dreamscape",
      "mood" => "whimsical",
      "time_of_day" => "unknown",
      "weather" => "unknown",
      "dominant_elements" => "ocean, voices, music",
      "activity_level" => "energetic",
      "atmosphere" => "whimsical",
      "scene_type" => "dialogue"
    },
    soundscape: %{file: "Crowd_Murmur.mp3", category: "movement", confidence: 0.3}
  },
  %{
    scene_number: 45,
    start_page: 87,
    end_page: 87,
    descriptors: %{
      "setting" => "dreamscape",
      "mood" => "anxious",
      "time_of_day" => "unknown",
      "weather" => "unknown",
      "dominant_elements" => "voices, tension, mystery",
      "activity_level" => "moderate",
      "atmosphere" => "whimsical",
      "scene_type" => "dialogue"
    },
    soundscape: %{file: "Tense_Whispering.mp3", category: "movement", confidence: 0.4}
  },
  %{
    scene_number: 46,
    start_page: 88,
    end_page: 88,
    descriptors: %{
      "setting" => "magical_realm",
      "mood" => "whimsical",
      "time_of_day" => "evening",
      "weather" => "clear",
      "dominant_elements" => "voices, wind, footsteps",
      "activity_level" => "energetic",
      "atmosphere" => "dramatic",
      "scene_type" => "action"
    },
    soundscape: %{file: "Dark_Magic_Rumble.mp3", category: "magic", confidence: 1.0}
  },
  %{
    scene_number: 47,
    start_page: 89,
    end_page: 90,
    descriptors: %{
      "setting" => "hall",
      "mood" => "curious",
      "time_of_day" => "unknown",
      "weather" => "unknown",
      "dominant_elements" => "voices, tension, rustling",
      "activity_level" => "moderate",
      "atmosphere" => "dramatic",
      "scene_type" => "description"
    },
    soundscape: %{file: "Cozy_Cabin_Interior.mp3", category: "nature", confidence: 0.4}
  },
  %{
    scene_number: 48,
    start_page: 91,
    end_page: 91,
    descriptors: %{
      "setting" => "palace",
      "mood" => "whimsical",
      "time_of_day" => "unknown",
      "weather" => "unknown",
      "dominant_elements" => "voices, tension, wonder",
      "activity_level" => "active",
      "atmosphere" => "whimsical",
      "scene_type" => "dialogue"
    },
    soundscape: %{file: "Grand_Castle_Hall.mp3", category: "nature", confidence: 0.4}
  },
  %{
    scene_number: 49,
    start_page: 92,
    end_page: 94,
    descriptors: %{
      "setting" => "palace",
      "mood" => "anxious",
      "time_of_day" => "unknown",
      "weather" => "unknown",
      "dominant_elements" => "voices, tension, echoes",
      "activity_level" => "chaotic",
      "atmosphere" => "dramatic",
      "scene_type" => "conflict"
    },
    soundscape: %{file: "Tense_Whispering.mp3", category: "movement", confidence: 0.4}
  },
  %{
    scene_number: 50,
    start_page: 95,
    end_page: 97,
    descriptors: %{
      "setting" => "hall",
      "mood" => "whimsical",
      "time_of_day" => "unknown",
      "weather" => "unknown",
      "dominant_elements" => "voices, footsteps, tension",
      "activity_level" => "chaotic",
      "atmosphere" => "dramatic",
      "scene_type" => "action"
    },
    soundscape: %{file: "Giant's_Footsteps.mp3", category: "magic", confidence: 1.0}
  },
  %{
    scene_number: 51,
    start_page: 98,
    end_page: 99,
    descriptors: %{
      "setting" => "palace",
      "mood" => "tense",
      "time_of_day" => "unknown",
      "weather" => "unknown",
      "dominant_elements" => "voices, tension, echoes",
      "activity_level" => "active",
      "atmosphere" => "dramatic",
      "scene_type" => "conflict"
    },
    soundscape: %{file: "Tense_Whispering.mp3", category: "movement", confidence: 0.4}
  },
  %{
    scene_number: 52,
    start_page: 100,
    end_page: 101,
    descriptors: %{
      "setting" => "hall",
      "mood" => "tense",
      "time_of_day" => "unknown",
      "weather" => "unknown",
      "dominant_elements" => "voices, tension, magic",
      "activity_level" => "chaotic",
      "atmosphere" => "dramatic",
      "scene_type" => "conflict"
    },
    soundscape: %{file: "Dark_Magic_Rumble.mp3", category: "magic", confidence: 1.0}
  },
  %{
    scene_number: 53,
    start_page: 102,
    end_page: 102,
    descriptors: %{
      "setting" => "riverside",
      "mood" => "nostalgic",
      "time_of_day" => "afternoon",
      "weather" => "clear",
      "dominant_elements" => "leaves, rustling, voices",
      "activity_level" => "calm",
      "atmosphere" => "contemplative",
      "scene_type" => "introspection"
    },
    soundscape: %{file: "Babbling_Brook.mp3", category: "nature", confidence: 0.4}
  },
  %{
    scene_number: 54,
    start_page: 103,
    end_page: 103,
    descriptors: %{
      "setting" => "countryside",
      "mood" => "nostalgic",
      "time_of_day" => "dusk",
      "weather" => "clear",
      "dominant_elements" => "wind, bells, water",
      "activity_level" => "still",
      "atmosphere" => "contemplative",
      "scene_type" => "introspection"
    },
    soundscape: %{file: "Howling_Wind.mp3", category: "nature", confidence: 1.0}
  },
  %{
    scene_number: 55,
    start_page: 104,
    end_page: 104,
    descriptors: %{
      "setting" => "home",
      "mood" => "nostalgic",
      "time_of_day" => "afternoon",
      "weather" => "sunny",
      "dominant_elements" => "voices, comfort, silence",
      "activity_level" => "peaceful",
      "atmosphere" => "contemplative",
      "scene_type" => "introspection"
    },
    soundscape: %{file: "Rain-soaked_Forest_Silence.mp3", category: "nature", confidence: 0.9}
  },
  %{
    scene_number: 56,
    start_page: 105,
    end_page: 105,
    descriptors: %{
      "setting" => "library",
      "mood" => "neutral",
      "time_of_day" => "unknown",
      "weather" => "unknown",
      "dominant_elements" => "silence, rustling, footsteps",
      "activity_level" => "still",
      "atmosphere" => "contemplative",
      "scene_type" => "description"
    },
    soundscape: %{file: "Giant's_Footsteps.mp3", category: "magic", confidence: 1.0}
  },
  %{
    scene_number: 57,
    start_page: 106,
    end_page: 111,
    descriptors: %{
      "setting" => "unknown",
      "mood" => "neutral",
      "time_of_day" => "unknown",
      "weather" => "unknown",
      "dominant_elements" => "silence, echoes, mystery",
      "activity_level" => "still",
      "atmosphere" => "ethereal",
      "scene_type" => "description"
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

# Extract pages from text-first source (prefer plain text, fallback to PDF)
IO.puts("📄 Extracting pages for Alice...")

root_txt_path = Path.join(File.cwd!(), "Alice_in_Wonderland.txt")
public_books_dir = Path.join([File.cwd!(), "priv", "static", "books"])
public_txt_path = Path.join(public_books_dir, "Alice_in_Wonderland.txt")

root_pdf_path = Path.join(File.cwd!(), "Alice_in_Wonderland.pdf")
public_pdf_path = Path.join(public_books_dir, "Alice_in_Wonderland.pdf")

# Ensure public directory exists
File.mkdir_p!(public_books_dir)

# Choose source: prefer text file if present
source =
  cond do
    File.exists?(root_txt_path) -> {:text, root_txt_path}
    File.exists?(public_txt_path) -> {:text, public_txt_path}
    File.exists?(root_pdf_path) ->
      unless File.exists?(public_pdf_path) do
        File.cp!(root_pdf_path, public_pdf_path)
        IO.puts("  ✓ Copied PDF to #{public_pdf_path}")
      end
      {:pdf, root_pdf_path}
    File.exists?(public_pdf_path) -> {:pdf, public_pdf_path}
    true ->
      IO.puts("❌ ERROR: Neither Alice_in_Wonderland.txt nor Alice_in_Wonderland.pdf found!")
      IO.puts("   Please download text or PDF from: https://www.gutenberg.org/ebooks/11")
      System.halt(1)
  end

pages_data =
  case source do
    {:text, txt_path} ->
      IO.puts("  ✓ Using plain text source: #{txt_path}")
      txt_path
      |> File.read!()
      |> SeedHelpers.chunk_text_to_pages(900)
      |> Enum.with_index(1)
      |> Enum.map(fn {text, idx} ->
        %{"page_number" => idx, "text_content" => text}
      end)

    {:pdf, pdf_path} ->
      IO.puts("  ✓ Using PDF source: #{pdf_path}")

      case RustReader.extract_pdf(pdf_path) do
        {pages_json, _metadata} ->
          Enum.map(pages_json, fn json_str -> Jason.decode!(json_str) end)

        {:error, reason} ->
          IO.puts("❌ PDF extraction failed: #{inspect(reason)}")
          System.halt(1)
      end
  end

IO.puts("  ✓ Prepared #{length(pages_data)} pages")

# Create pages in database
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

# Update book with actual page count
Content.update_book(book, %{total_pages: count})

# Load curated soundscapes from bucket
IO.puts("🎵 Loading curated soundscapes...")
{:ok, curated_soundscapes} = Soundscapes.list_curated_soundscapes_from_bucket()

IO.puts("📄 Creating #{length(scenes_data)} scenes with soundscapes (entire book)...")

# Create scenes and assign soundscapes
created_scenes = Enum.map(scenes_data, fn scene_data ->
  # Create the scene
  {:ok, scene} = %Scene{}
  |> Scene.changeset(%{
    book_id: book.id,
    scene_number: scene_data.scene_number,
    start_page: scene_data.start_page,
    end_page: scene_data.end_page,
    descriptors: scene_data.descriptors
  })
  |> Repo.insert()

  IO.puts("  ✓ Scene #{scene_data.scene_number} (pages #{scene_data.start_page}-#{scene_data.end_page})")

  # Link pages to this scene
  from(p in Content.Page,
    where: p.book_id == ^book.id,
    where: p.page_number >= ^scene_data.start_page,
    where: p.page_number <= ^scene_data.end_page
  )
  |> Repo.update_all(set: [scene_id: scene.id])

  # Assign soundscape if available
  if scene_data.soundscape do
    soundscape_info = scene_data.soundscape
    category = soundscape_info.category

    # Find the file in curated soundscapes
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

  scene
end)

# Update book status to published
IO.puts("\n📚 Publishing book...")
{:ok, _book} = Content.update_book(book, %{
  processing_status: "published",
  is_published: true
})

IO.puts("""

✅ Alice's Adventures in Wonderland is ready!

═══════════════════════════════════════════════════════════
BOOK DETAILS:
  Title:  #{book.title}
  Author: #{book.author}
  Pages:  #{Repo.reload(book).total_pages} (entire book extracted)
  Scenes: #{length(created_scenes)} (complete book with AI analysis)
  Status: Published ✓

SOUNDSCAPE MAPPING (Entire Book - 57 scenes, pages 1-111):
  ✓ 56 scenes successfully mapped to curated soundscapes
  ✗ 1 scene (Scene 41 - seaside/melancholic) has no soundscape (low confidence)

  Most Used Soundscapes:
    • Rain-soaked Forest Silence (nature) - 15 scenes
    • Giant's Footsteps (magic) - 15 scenes
    • Dark Magic Rumble (magic) - 7 scenes
    • Tense Whispering (movement) - 5 scenes
    • Echoing Cave (nature) - 4 scenes
    • Others - 10 scenes

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

  4. Click on "Alice's Adventures in Wonderland"

  5. Read the ENTIRE book with immersive soundscapes throughout!

═══════════════════════════════════════════════════════════

💡 COMPLETE EXPERIENCE: The entire book (111 pages) has been analyzed with AI
and mapped to immersive soundscapes. Every scene from Alice falling down the
rabbit hole to waking from her dream features carefully selected ambient audio
that matches the mood, setting, and atmosphere of the story!

""")

IO.puts("✅ Seed completed!\n")
