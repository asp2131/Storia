// Use the legacy build for Node.js compatibility
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { TextItem } from 'pdfjs-dist/types/src/display/api';

// Configure the worker source for pdf.js
// In Node.js, we need to use a fake worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/legacy/build/pdf.worker.mjs';

export interface PDFMetadata {
  title?: string;
  author?: string;
  pageCount: number;
}

/**
 * Extracts text content from a PDF buffer, returning an array of strings
 * where each element represents the text content of one page.
 * 
 * @param buffer - The PDF file as a Buffer
 * @returns Promise<string[]> - Array of text content per page
 * @throws Error if PDF extraction fails
 */
export async function extractPDFText(buffer: Buffer): Promise<string[]> {
  try {
    // Convert Buffer to Uint8Array for pdf.js
    const uint8Array = new Uint8Array(buffer);
    
    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({
      data: uint8Array,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    });
    
    const pdfDocument = await loadingTask.promise;
    const pageTexts: string[] = [];
    
    // Extract text from each page
    for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Combine all text items into a single string
      const pageText = textContent.items
        .map((item) => {
          if ('str' in item) {
            return (item as TextItem).str;
          }
          return '';
        })
        .join(' ')
        .trim();
      
      pageTexts.push(pageText);
    }
    
    // Clean up
    await pdfDocument.destroy();
    
    return pageTexts;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to extract PDF text: ${error.message}`);
    }
    throw new Error('Failed to extract PDF text: Unknown error');
  }
}

/**
 * Extracts metadata from a PDF buffer including title, author, and page count.
 * 
 * @param buffer - The PDF file as a Buffer
 * @returns Promise<PDFMetadata> - Object containing PDF metadata
 * @throws Error if metadata extraction fails
 */
export async function extractPDFMetadata(buffer: Buffer): Promise<PDFMetadata> {
  try {
    // Convert Buffer to Uint8Array for pdf.js
    const uint8Array = new Uint8Array(buffer);
    
    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({
      data: uint8Array,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    });
    
    const pdfDocument = await loadingTask.promise;
    
    // Get metadata
    const metadata = await pdfDocument.getMetadata();
    const pageCount = pdfDocument.numPages;
    
    // Extract title and author from metadata
    const title = metadata.info?.Title || undefined;
    const author = metadata.info?.Author || undefined;
    
    // Clean up
    await pdfDocument.destroy();
    
    return {
      title,
      author,
      pageCount,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to extract PDF metadata: ${error.message}`);
    }
    throw new Error('Failed to extract PDF metadata: Unknown error');
  }
}
