#!/usr/bin/env node

/**
 * PDF Text Extraction Script for Storia
 * 
 * This script extracts text content from PDF files and outputs structured JSON
 * containing page-by-page text content.
 * 
 * Usage: node extract.js <pdf_file_path>
 * Output: JSON array of pages with text content
 */

const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

/**
 * Extract text from a PDF file
 * @param {string} pdfPath - Path to the PDF file
 * @returns {Promise<Object>} - Extracted pages data
 */
async function extractPdfText(pdfPath) {
  try {
    // Read the PDF file
    const dataBuffer = fs.readFileSync(pdfPath);
    
    // Parse the PDF
    const data = await pdfParse(dataBuffer, {
      // Custom page render to extract text per page
      pagerender: async (pageData) => {
        const textContent = await pageData.getTextContent();
        let pageText = '';
        
        // Combine text items with proper spacing
        textContent.items.forEach((item) => {
          pageText += item.str + ' ';
        });
        
        return pageText.trim();
      }
    });

    // Extract pages with their text content
    const pages = [];
    const pageTexts = data.text.split('\n\n'); // Simple page splitting
    
    // For more accurate page extraction, we'll need to track pages during parsing
    // Since pdf-parse doesn't provide direct page-by-page access in the simple API,
    // we'll use a different approach
    
    // Re-parse with page tracking
    const pdfData = await pdfParse(dataBuffer);
    const numPages = pdfData.numpages;
    
    // Split text by pages (this is a simplified approach)
    // In production, you might want to use pdf.js directly for better control
    const avgCharsPerPage = pdfData.text.length / numPages;
    let currentPos = 0;
    
    for (let i = 1; i <= numPages; i++) {
      const startPos = currentPos;
      const endPos = Math.min(currentPos + avgCharsPerPage, pdfData.text.length);
      
      // Find the nearest sentence boundary
      let pageText = pdfData.text.substring(startPos, endPos);
      
      // Try to break at sentence boundaries
      if (i < numPages) {
        const lastPeriod = pageText.lastIndexOf('. ');
        if (lastPeriod > pageText.length * 0.7) {
          pageText = pageText.substring(0, lastPeriod + 1);
          currentPos = startPos + lastPeriod + 2;
        } else {
          currentPos = endPos;
        }
      } else {
        pageText = pdfData.text.substring(startPos);
        currentPos = pdfData.text.length;
      }
      
      pages.push({
        page_number: i,
        text_content: pageText.trim()
      });
    }
    
    return {
      success: true,
      total_pages: numPages,
      pages: pages,
      metadata: {
        title: pdfData.info?.Title || null,
        author: pdfData.info?.Author || null,
        creator: pdfData.info?.Creator || null,
        producer: pdfData.info?.Producer || null,
        creation_date: pdfData.info?.CreationDate || null
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      error_type: error.name,
      stack: error.stack
    };
  }
}

/**
 * Main execution function
 */
async function main() {
  // Check command line arguments
  if (process.argv.length < 3) {
    console.error(JSON.stringify({
      success: false,
      error: 'Missing PDF file path argument',
      usage: 'node extract.js <pdf_file_path>'
    }));
    process.exit(1);
  }
  
  const pdfPath = process.argv[2];
  
  // Check if file exists
  if (!fs.existsSync(pdfPath)) {
    console.error(JSON.stringify({
      success: false,
      error: `PDF file not found: ${pdfPath}`
    }));
    process.exit(1);
  }
  
  // Check if it's a file
  const stats = fs.statSync(pdfPath);
  if (!stats.isFile()) {
    console.error(JSON.stringify({
      success: false,
      error: `Path is not a file: ${pdfPath}`
    }));
    process.exit(1);
  }
  
  // Extract text from PDF
  const result = await extractPdfText(pdfPath);
  
  // Output JSON result
  console.log(JSON.stringify(result, null, 2));
  
  // Exit with appropriate code
  process.exit(result.success ? 0 : 1);
}

// Run the script
main().catch((error) => {
  console.error(JSON.stringify({
    success: false,
    error: error.message,
    error_type: error.name,
    stack: error.stack
  }));
  process.exit(1);
});
