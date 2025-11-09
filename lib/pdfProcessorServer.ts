import PDFParser from "pdf2json";

export interface PDFMetadata {
  title?: string;
  author?: string;
  pageCount: number;
}

/**
 * Parse PDF using pdf2json
 */
function parsePDF(buffer: Buffer): Promise<any> {
  return new Promise((resolve, reject) => {
    const pdfParser = new (PDFParser as any)(null, 1);
    
    pdfParser.on("pdfParser_dataError", (errData: any) => {
      reject(new Error(errData.parserError));
    });
    
    pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
      resolve(pdfData);
    });
    
    pdfParser.parseBuffer(buffer);
  });
}

/**
 * Extract text from all pages of a PDF (server-side)
 * @param buffer - PDF file as Buffer
 * @returns Array of text content, one per page
 */
export async function extractPDFText(buffer: Buffer): Promise<string[]> {
  try {
    const pdfData = await parsePDF(buffer);
    const pages: string[] = [];
    
    // Extract text from each page
    for (const page of pdfData.Pages) {
      let pageText = "";
      
      if (page.Texts) {
        for (const text of page.Texts) {
          if (text.R) {
            for (const run of text.R) {
              if (run.T) {
                // Decode URI component (pdf2json encodes text)
                pageText += decodeURIComponent(run.T) + " ";
              }
            }
          }
        }
      }
      
      pages.push(pageText.trim() || `[Page ${pages.length + 1}]`);
    }
    
    return pages;
  } catch (error) {
    console.error("Error extracting PDF text:", error);
    throw new Error(`Failed to extract PDF text: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Extract metadata from a PDF (server-side)
 * @param buffer - PDF file as Buffer
 * @returns Metadata including page count, title, author
 */
export async function extractPDFMetadata(buffer: Buffer): Promise<PDFMetadata> {
  try {
    const pdfData = await parsePDF(buffer);
    
    return {
      pageCount: pdfData.Pages?.length || 0,
      title: pdfData.Meta?.Title || undefined,
      author: pdfData.Meta?.Author || undefined,
    };
  } catch (error) {
    console.error("Error extracting PDF metadata:", error);
    throw new Error(`Failed to extract PDF metadata: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
