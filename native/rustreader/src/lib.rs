use extractous::Extractor;
use regex::Regex;
use rustler::NifResult;
use serde::Serialize;

#[derive(Serialize)]
struct Page {
    page_number: usize,
    text_content: String,
}

#[rustler::nif(schedule = "DirtyCpu")]
fn extract_pdf(path: String) -> NifResult<(Vec<String>, String)> {
    let extractor = Extractor::new();

    match extractor.extract_file_to_string(&path) {
        Ok((content, metadata)) => {
            // Split content into pre-chapter and chapter
            // Try to find "CHAPTER I" or "Down the Rabbit-Hole"
            // Note: We use a simple split logic here
            
            let re = Regex::new(r"CHAPTER I|Down the Rabbit-Hole").unwrap();
            let parts: Vec<&str> = re.splitn(&content, 2).collect();
            
            let (pre_chapter, chapter_content) = if parts.len() == 2 {
                (parts[0], format!("CHAPTER I{}", parts[1]))
            } else {
                ("", content.clone())
            };

            let chunk_size = 1500;
            let mut pages = Vec::new();

            // Process pre-chapter content (starts at page 1)
            if !pre_chapter.is_empty() {
                let pre_chars: Vec<char> = pre_chapter.chars().collect();
                let pre_chunks = pre_chars.chunks(chunk_size);
                
                for (i, chunk) in pre_chunks.enumerate() {
                    let text: String = chunk.iter().collect();
                    let page_json = serde_json::json!({
                        "page_number": i + 1,
                        "text_content": text.trim()
                    });
                    pages.push(page_json.to_string());
                }
            }

            // Process chapter content (starts at page 8)
            if !chapter_content.is_empty() {
                // If pre-chapter was handled, chapter content usually starts later
                // But per user requirement, Chapter 1 starts at page 8 visually.
                // We hardcode the offset to ensure Chapter 1 is page 8.
                let start_page = 8;
                
                let chap_chars: Vec<char> = chapter_content.chars().collect();
                let chap_chunks = chap_chars.chunks(chunk_size);
                
                for (i, chunk) in chap_chunks.enumerate() {
                    let text: String = chunk.iter().collect();
                    let page_json = serde_json::json!({
                        "page_number": start_page + i,
                        "text_content": text.trim()
                    });
                    pages.push(page_json.to_string());
                }
            }
            
            // Filter out empty pages
            let filtered_pages: Vec<String> = pages
                .into_iter()
                .filter(|p| {
                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(p) {
                        if let Some(text) = json["text_content"].as_str() {
                            return text.len() >= 50;
                        }
                    }
                    false
                })
                .collect();

            Ok((filtered_pages, format!("{:?}", metadata)))
        },
        Err(e) => Err(rustler::Error::Term(Box::new(format!("Extraction failed: {}", e))))
    }
}

rustler::init!("Elixir.RustReader");
