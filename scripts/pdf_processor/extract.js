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
 * @param {number} [maxPages=null] - Maximum number of pages to extract
 * @returns {Promise<Object>} - Extracted pages data
 */
async function extractPdfText(pdfPath, maxPages = null, startPage = 1) {
  try {
    // Read the PDF file
    const dataBuffer = fs.readFileSync(pdfPath);
    const pages = [];

    // Define garbage filters for known UI/footer elements
    const garbageStrings = [
      "Navigate", "Control", "Internet", "Digital Interface", 
      "BookVirtual", "Fit Page", "Full Screen", "Close Book",
      "U.S. Patent Pending", "All Rights Reserved"
    ];

    // Parse the PDF
    const data = await pdfParse(dataBuffer, {
      // Custom page render to extract text per page
      pagerender: async (pageData) => {
        // Check start page
        if (pageData.pageNumber < startPage) {
            return '';
        }

        // Check limit if provided
        if (maxPages && pageData.pageNumber > maxPages) {
          return '';
        }

        const textContent = await pageData.getTextContent();
        
        // Filter items
        const items = textContent.items.filter(item => {
          const str = item.str.trim();
          if (!str) return false;

          // Filter garbage strings
          if (garbageStrings.some(garbage => str.includes(garbage))) return false;

          // Filter by Y-coordinate (margins) to remove headers and footers
          const y = item.transform[5];
          if (y < 50 || y > 460) return false;

          return true;
        });

        // Smart Sort: Detect Columns
        // Create a horizontal histogram of text presence
        const histogram = new Array(100).fill(0); // 10px bins for 1000px width
        
        items.forEach(item => {
            const x = item.transform[4];
            const width = item.width || (item.str.length * 5); 
            const startBin = Math.max(0, Math.floor(x / 10));
            const endBin = Math.min(99, Math.floor((x + width) / 10));
            
            for (let i = startBin; i <= endBin; i++) {
                histogram[i]++;
            }
        });

        const totalHistogramMass = histogram.reduce((a, b) => a + b, 0);

        // Identify potential gaps
        // A gap is a sequence of bins with low density (<= 2)
        let gaps = [];
        let currentGap = null;

        for (let i = 0; i < 100; i++) {
            if (histogram[i] <= 2) {
                if (!currentGap) {
                    currentGap = { start: i, length: 0 };
                }
                currentGap.length++;
            } else {
                if (currentGap) {
                    gaps.push(currentGap);
                    currentGap = null;
                }
            }
        }
        if (currentGap) gaps.push(currentGap);

        // Find the best split gap
        // Must have significant mass on both sides
        let bestSplitX = -1;
        let maxGapLen = 0;

        gaps.forEach(gap => {
            // Calculate mass on left and right
            let leftMass = 0;
            let rightMass = 0;
            
            // Sum histogram bins before gap
            for (let j = 0; j < gap.start; j++) leftMass += histogram[j];
            
            // Sum histogram bins after gap
            for (let j = gap.start + gap.length; j < 100; j++) rightMass += histogram[j];

            // Valid split if both sides have > 10% of total mass
            if (leftMass > totalHistogramMass * 0.1 && rightMass > totalHistogramMass * 0.1) {
                if (gap.length > maxGapLen) {
                    maxGapLen = gap.length;
                    // Split point is center of gap
                    bestSplitX = (gap.start + gap.length / 2) * 10;
                }
            }
        });

        let sortedItems;
        // If we found a valid split gap
        if (bestSplitX !== -1) {
            const left = items.filter(item => item.transform[4] < bestSplitX);
            const right = items.filter(item => item.transform[4] >= bestSplitX);
            
            // Sort each column by Y desc
            const colSort = (a, b) => b.transform[5] - a.transform[5];
            left.sort(colSort);
            right.sort(colSort);
            
            sortedItems = [...left, ...right];
        } else {
            // Standard Sort: Y desc, then X asc
            sortedItems = items.sort((a, b) => {
                const yA = a.transform[5];
                const yB = b.transform[5];
                if (Math.abs(yA - yB) < 10) { // Tolerance for line alignment
                    return a.transform[4] - b.transform[4];
                }
                return yB - yA;
            });
        }

        // Combine text
        let pageText = '';
        let lastY = null;
        let lastX = null;
        
        sortedItems.forEach((item) => {
            const y = item.transform[5];
            const x = item.transform[4];
            
            // Add new line if vertical gap is significant (and not just column switch)
            // Note: For column switch, lastY might jump.
            // If we just switched columns, y might go UP (back to top).
            // So y > lastY implies column switch or unordered?
            // With our sort, y should generally decrease, except at column boundary.
            
            if (lastY !== null) {
                if (y > lastY + 50) { 
                    // Probably column switch (jumped back up)
                    pageText += '\n'; 
                } else if (lastY - y > 10) {
                    // Normal new line
                    pageText += '\n';
                }
            }
            
            pageText += item.str + ' ';
            lastY = y;
            lastX = x;
        });
        
        // Clean up excessive whitespace
        const cleanedText = pageText.replace(/\s+/g, ' ').trim();

        if (cleanedText) {
          pages.push({
              page_number: pageData.pageNumber,
              text_content: cleanedText
          });
        }

        return cleanedText;
      }
    });

    // Sort pages by page number to ensure correct order
    pages.sort((a, b) => a.page_number - b.page_number);

    return {
      success: true,
      total_pages: data.numpages,
      pages: pages,
      metadata: {
        title: data.info?.Title || null,
        author: data.info?.Author || null,
        creator: data.info?.Creator || null,
        producer: data.info?.Producer || null,
        creation_date: data.info?.CreationDate || null
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
  const maxPages = process.argv[3] ? parseInt(process.argv[3]) : null;
  const startPage = process.argv[4] ? parseInt(process.argv[4]) : 1;
  
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
  const result = await extractPdfText(pdfPath, maxPages, startPage);
  
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
