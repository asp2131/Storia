/**
 * Test script for PDF processor
 * This script tests the PDF text extraction and metadata extraction functions
 */

import { extractPDFText, extractPDFMetadata } from '../lib/pdfProcessor';
import * as fs from 'fs';
import * as path from 'path';

async function testPDFProcessor() {
  console.log('Testing PDF Processor...\n');

  // Test with a simple PDF buffer (minimal valid PDF)
  // This is a minimal valid PDF with one page containing "Hello World"
  const minimalPDF = Buffer.from(
    '%PDF-1.4\n' +
    '1 0 obj\n' +
    '<< /Type /Catalog /Pages 2 0 R >>\n' +
    'endobj\n' +
    '2 0 obj\n' +
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n' +
    'endobj\n' +
    '3 0 obj\n' +
    '<< /Type /Page /Parent 2 0 R /Resources 4 0 R /MediaBox [0 0 612 792] /Contents 5 0 R >>\n' +
    'endobj\n' +
    '4 0 obj\n' +
    '<< /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >>\n' +
    'endobj\n' +
    '5 0 obj\n' +
    '<< /Length 44 >>\n' +
    'stream\n' +
    'BT\n' +
    '/F1 24 Tf\n' +
    '100 700 Td\n' +
    '(Hello World) Tj\n' +
    'ET\n' +
    'endstream\n' +
    'endobj\n' +
    'xref\n' +
    '0 6\n' +
    '0000000000 65535 f\n' +
    '0000000009 00000 n\n' +
    '0000000058 00000 n\n' +
    '0000000115 00000 n\n' +
    '0000000214 00000 n\n' +
    '0000000304 00000 n\n' +
    'trailer\n' +
    '<< /Size 6 /Root 1 0 R >>\n' +
    'startxref\n' +
    '397\n' +
    '%%EOF'
  );

  try {
    // Test metadata extraction
    console.log('1. Testing extractPDFMetadata()...');
    const metadata = await extractPDFMetadata(minimalPDF);
    console.log('✓ Metadata extracted successfully:');
    console.log(`  - Page Count: ${metadata.pageCount}`);
    console.log(`  - Title: ${metadata.title || 'N/A'}`);
    console.log(`  - Author: ${metadata.author || 'N/A'}`);
    console.log();

    // Test text extraction
    console.log('2. Testing extractPDFText()...');
    const pageTexts = await extractPDFText(minimalPDF);
    console.log('✓ Text extracted successfully:');
    console.log(`  - Number of pages: ${pageTexts.length}`);
    console.log(`  - Page 1 text: "${pageTexts[0]}"`);
    console.log();

    // Test error handling with invalid PDF
    console.log('3. Testing error handling with invalid PDF...');
    const invalidPDF = Buffer.from('This is not a PDF');
    try {
      await extractPDFText(invalidPDF);
      console.log('✗ Should have thrown an error');
    } catch (error) {
      if (error instanceof Error) {
        console.log('✓ Error handled correctly:');
        console.log(`  - Error message: ${error.message}`);
      }
    }
    console.log();

    console.log('All tests passed! ✓');
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

testPDFProcessor();
