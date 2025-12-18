# Full Book Analysis Strategy

## Overview
This document outlines the strategy for analyzing entire books while intelligently managing soundscape generation.

## Approach

### 1. **Full PDF Extraction**
- Extract **all pages** from the PDF using Rust-based `RustReader.extract_pdf/1`
- Split by form feeds (`\f`) to separate pages
- Filter out empty/tiny pages (< 50 characters)
- Store all pages in the database

### 2. **Complete Scene Classification**
- Run AI classification on **all pages** in the book
- Detect scene boundaries across the entire narrative
- Create scene records for the full book structure
- This gives us a complete understanding of the book's narrative flow

### 3. **Selective Soundscape Mapping**
- **Only map soundscapes for Chapter 1** (pages 8-22 for Alice in Wonderland)
- Filter scenes by page range before soundscape matching
- This approach:
  - Keeps API costs manageable
  - Provides a complete "preview" experience for Chapter 1
  - Allows future expansion to other chapters on-demand

## Benefits

### Cost Efficiency
- AI classification is relatively cheap (text analysis)
- Soundscape generation/matching is more expensive
- By limiting soundscapes to Chapter 1, we control costs while providing value

### User Experience
- Users can read the entire book with scene detection
- Chapter 1 has the full immersive audio experience
- Future chapters can be "unlocked" with soundscapes as needed

### Scalability
- Easy to extend soundscape mapping to additional chapters
- Can implement chapter-by-chapter unlocking for premium users
- Database already has full scene structure for future enhancements

## Implementation Details

### Test Configuration
```elixir
@chapter_1_start_page 8
@chapter_1_end_page 22

# Filter scenes for soundscape mapping
chapter_1_scenes = Enum.filter(scenes, fn scene ->
  scene.start_page >= @chapter_1_start_page and 
  scene.end_page <= @chapter_1_end_page
end)
```

### Page Extraction
```elixir
defp extract_all_pages(pdf_path) do
  case RustReader.extract_pdf(pdf_path) do
    {full_text, _metadata} ->
      pages_text = String.split(full_text, ~r/\f/, trim: true)
      
      all_pages =
        pages_text
        |> Enum.with_index(1)
        |> Enum.map(fn {text, page_num} ->
          %{page_number: page_num, text_content: String.trim(text)}
        end)
        |> Enum.reject(fn page -> String.length(page.text_content) < 50 end)
      
      {:ok, all_pages}
  end
end
```

## Future Enhancements

1. **Chapter Detection**: Automatically detect chapter boundaries
2. **Progressive Unlocking**: Allow users to unlock soundscapes chapter-by-chapter
3. **Batch Processing**: Process multiple chapters in parallel
4. **Caching**: Cache AI classifications to avoid re-processing
5. **User Preferences**: Let users choose which chapters to enhance with audio

## Performance Considerations

- **Full book analysis**: ~5-10 minutes for a 100-page book
- **Chapter 1 soundscapes**: ~2-3 minutes
- **Total**: Much faster than analyzing + mapping entire book
- **Database**: Efficient storage with indexed page numbers and scene ranges
