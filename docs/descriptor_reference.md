# Scene Descriptor Reference Guide

Quick reference for the enhanced scene descriptors used in Storia's AI classification system.

## Core Descriptors (Original 6)

### mood
**Emotional tone of the scene**

- **Positive**: joyful, playful, whimsical, serene, hopeful, content, excited, curious
- **Negative**: tense, anxious, melancholic, fearful, ominous, sorrowful, angry, desperate
- **Neutral/Complex**: mysterious, contemplative, nostalgic, bittersweet, uncertain, neutral

### setting
**Physical location type**

- **Nature**: forest, meadow, garden, riverside, lakeside, mountain, countryside, wilderness
- **Indoor**: home, palace, cottage, library, chamber, hall, underground, cave
- **Urban**: city, town, street, marketplace, village
- **Special**: magical_realm, dreamscape, unknown

### time_of_day
**Temporal context**

dawn, morning, midday, afternoon, dusk, evening, night, midnight, unknown

### weather
**Atmospheric conditions**

sunny, clear, cloudy, overcast, rainy, drizzling, stormy, windy, snowy, foggy, misty, unknown

### activity_level
**Pace and energy**

still, calm, peaceful, moderate, active, energetic, intense, chaotic

### atmosphere
**Overall ambiance**

peaceful, tranquil, suspenseful, eerie, magical, romantic, adventurous, dramatic, contemplative, whimsical, dark, light, ethereal

## New Descriptors (Added for Better Matching)

### scene_type
**Nature of the action/content**

dialogue, action, description, introspection, discovery, conflict, journey, rest, transformation, revelation

### dominant_elements
**Key environmental/sensory elements (up to 3, comma-separated)**

- **Natural**: birds, wind, water, rain, thunder, fire, leaves, crickets, ocean, stream
- **Ambient**: silence, echoes, footsteps, voices, music, bells, clock, rustling
- **Mood**: tension, wonder, mystery, magic, danger, comfort, isolation

## Example Scenes

### Alice in Wonderland - Garden Scene
```json
{
  "mood": "curious",
  "setting": "garden",
  "time_of_day": "afternoon",
  "weather": "sunny",
  "activity_level": "moderate",
  "atmosphere": "whimsical",
  "scene_type": "discovery",
  "dominant_elements": "birds, wind, wonder"
}
```
**Matches**: Nature soundscapes with birds, garden ambience

### Thriller - Chase Scene
```json
{
  "mood": "fearful",
  "setting": "city",
  "time_of_day": "night",
  "weather": "rainy",
  "activity_level": "intense",
  "atmosphere": "suspenseful",
  "scene_type": "conflict",
  "dominant_elements": "footsteps, rain, tension"
}
```
**Matches**: Urban rain, tense music, action soundscapes

### Fantasy - Magic Scene
```json
{
  "mood": "mysterious",
  "setting": "magical_realm",
  "time_of_day": "unknown",
  "weather": "unknown",
  "activity_level": "moderate",
  "atmosphere": "magical",
  "scene_type": "transformation",
  "dominant_elements": "magic, wonder, bells"
}
```
**Matches**: Magical/fantasy soundscapes, ethereal music

### Peaceful Nature Scene
```json
{
  "mood": "serene",
  "setting": "forest",
  "time_of_day": "morning",
  "weather": "clear",
  "activity_level": "calm",
  "atmosphere": "peaceful",
  "scene_type": "description",
  "dominant_elements": "birds, wind, leaves"
}
```
**Matches**: Forest ambience, bird songs, gentle wind

### Dark Mystery Scene
```json
{
  "mood": "ominous",
  "setting": "underground",
  "time_of_day": "unknown",
  "weather": "unknown",
  "activity_level": "still",
  "atmosphere": "eerie",
  "scene_type": "introspection",
  "dominant_elements": "silence, echoes, mystery"
}
```
**Matches**: Dark ambient, cave sounds, suspenseful tones

## Soundscape Matching Logic

### High-Weight Matches (0.25-0.35)
- **setting** matches category (0.35)
- **atmosphere** matches category (0.30)
- **mood** matches category (0.25)
- **Magical/whimsical** atmosphere (0.25)

### Medium-Weight Matches (0.15-0.20)
- **dominant_elements** match (0.15 per element)
- **Weather** conditions match (0.15)
- **Activity level** + category alignment (0.20)
- **Calm scenes** + nature sounds (0.20)

### Low-Weight Matches (0.08)
- Partial keyword matches (0.08 per match)

### Confidence Threshold
- **Minimum**: 0.25 (25% confidence)
- **Good**: 0.50+ (50% confidence)
- **Excellent**: 0.75+ (75% confidence)

## Tips for Best Results

1. **Be specific**: Choose the most precise option (e.g., "garden" not "outdoor")
2. **Use dominant_elements**: This field greatly improves matching
3. **Match atmosphere to mood**: Ensure they complement each other
4. **Consider soundscape availability**: Common elements (birds, wind, water) match better
5. **Activity level matters**: Calm scenes need different sounds than intense ones

## Default Fallback
When classification fails, these defaults are used:
```json
{
  "mood": "neutral",
  "setting": "unknown",
  "time_of_day": "unknown",
  "weather": "unknown",
  "activity_level": "moderate",
  "atmosphere": "neutral",
  "scene_type": "description",
  "dominant_elements": "silence"
}
```
