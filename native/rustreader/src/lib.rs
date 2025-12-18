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
        Ok((raw_content, metadata)) => {
            // Clean content of common PDF screen controls and artifacts
            let content = clean_pdf_controls(&raw_content);

            let chunk_size = 1500;
            let mut pages = Vec::new();

            // Process entire content starting from page 1
            let chars: Vec<char> = content.chars().collect();
            let chunks = chars.chunks(chunk_size);
            
            for (i, chunk) in chunks.enumerate() {
                let text: String = chunk.iter().collect();
                let page_json = serde_json::json!({
                    "page_number": i + 1,
                    "text_content": text.trim()
                });
                pages.push(page_json.to_string());
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

fn clean_pdf_controls(text: &str) -> String {
    // Remove standard PDF screen controls and UI artifacts
    // These appear in interactive digital editions (like BookVirtual)
    let patterns = [
        r"Fit Page Full Scre[e]?", // Matches Scre or Scree
        r"Navigate Contr",
        r"[n/]*Off Close Book",
        r"[ol]+ Internet",
        r"en O",
        r"n O",
        r"Digital Interface by.*",
        r"U\.S\. Patent Pending.*",
        r"© 2000 All Rights Reserved\.",
        r"BookVirtual™",
        r"www\.bookvirtual\.com",
        r"DOWN THE\s*\d+",       // Handle "DOWN THE4" or "DOWN THE 4"
        r"RABBIT-HOLE\. \d+",
        r"B \d+"
    ];

    let mut cleaned = text.to_string();
    for pattern in patterns.iter() {
        if let Ok(re) = Regex::new(pattern) {
            // Replace with a space to prevent merging words if the artifact 
            // was inserted in the middle of a sentence (e.g. "listen to [ARTIFACT] her")
            cleaned = re.replace_all(&cleaned, " ").to_string();
        }
    }
    
    // Collapse multiple spaces
    let space_re = Regex::new(r" +").unwrap();
    cleaned = space_re.replace_all(&cleaned, " ").to_string();

    // Collapse multiple newlines
    let newline_re = Regex::new(r"\n{3,}").unwrap();
    cleaned = newline_re.replace_all(&cleaned, "\n\n").to_string();

    cleaned
}

rustler::init!("Elixir.RustReader");
