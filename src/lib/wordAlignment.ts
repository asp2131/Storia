/**
 * Word alignment utilities for synchronizing source text with Whisper timestamps.
 *
 * Handles:
 * - Normalization (lowercase, punctuation removal)
 * - Fuzzy matching for minor spelling differences
 * - Sequence alignment for word order
 * - Graceful fallbacks for mismatches
 */

export type WordTimestamp = {
  word: string;
  start: number;
  end: number;
};

export type AlignedWord = {
  sourceWord: string;
  whisperWord: string;
  start: number;
  end: number;
  confidence: number;
};

/**
 * Normalize a word for comparison by:
 * - Converting to lowercase
 * - Removing punctuation
 * - Trimming whitespace
 */
function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/[^\w\s]/g, "") // Remove punctuation
    .trim();
}

/**
 * Calculate Levenshtein distance between two strings.
 * Used for fuzzy matching.
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity score between two words (0-1).
 * 1 = exact match, 0 = completely different.
 */
function wordSimilarity(a: string, b: string): number {
  const normalizedA = normalizeWord(a);
  const normalizedB = normalizeWord(b);

  if (normalizedA === normalizedB) return 1;
  if (normalizedA.length === 0 || normalizedB.length === 0) return 0;

  const distance = levenshteinDistance(normalizedA, normalizedB);
  const maxLength = Math.max(normalizedA.length, normalizedB.length);

  return 1 - distance / maxLength;
}

/**
 * Find the best match for a source word within a window of whisper words.
 * Returns the index of the best match and the confidence score.
 */
function findBestMatch(
  sourceWord: string,
  whisperWords: WordTimestamp[],
  searchStart: number,
  searchWindow: number
): { index: number; confidence: number } {
  let bestIndex = -1;
  let bestConfidence = 0;

  const searchEnd = Math.min(searchStart + searchWindow, whisperWords.length);

  for (let i = searchStart; i < searchEnd; i++) {
    const confidence = wordSimilarity(sourceWord, whisperWords[i].word);
    if (confidence > bestConfidence && confidence >= 0.6) {
      // 60% similarity threshold
      bestConfidence = confidence;
      bestIndex = i;
    }
  }

  return { index: bestIndex, confidence: bestConfidence };
}

/**
 * Align source text words with Whisper timestamps.
 * Uses a greedy matching algorithm with a sliding window.
 *
 * @param sourceText - The original text that was narrated
 * @param whisperTimestamps - Word-level timestamps from Whisper
 * @returns Aligned words with timestamps, or null if alignment quality is too low
 */
export function alignWordsWithTimestamps(
  sourceText: string,
  whisperTimestamps: WordTimestamp[]
): AlignedWord[] | null {
  // Split source text into words (preserve original words for display)
  const sourceWords = sourceText.split(/\s+/).filter((w) => w.length > 0);

  if (sourceWords.length === 0 || whisperTimestamps.length === 0) {
    return null;
  }

  const aligned: AlignedWord[] = [];
  let whisperIndex = 0;
  let totalConfidence = 0;

  // Search window - how many whisper words to look ahead for a match
  // This accounts for Whisper occasionally inserting extra words
  const searchWindow = Math.min(5, whisperTimestamps.length);

  for (let i = 0; i < sourceWords.length; i++) {
    const sourceWord = sourceWords[i];
    const normalizedSource = normalizeWord(sourceWord);

    // Skip empty words
    if (normalizedSource.length === 0) continue;

    // Find best match in whisper timestamps
    const { index, confidence } = findBestMatch(
      sourceWord,
      whisperTimestamps,
      whisperIndex,
      searchWindow
    );

    if (index >= 0) {
      const whisperWord = whisperTimestamps[index];
      aligned.push({
        sourceWord: sourceWord,
        whisperWord: whisperWord.word,
        start: whisperWord.start,
        end: whisperWord.end,
        confidence,
      });

      totalConfidence += confidence;
      whisperIndex = index + 1; // Move past the matched word
    } else {
      // No match found - insert a placeholder with estimated timing
      // This handles words that Whisper might have missed
      const prevWord = aligned[aligned.length - 1];
      const nextWhisperWord = whisperTimestamps[whisperIndex];

      let estimatedStart: number;
      let estimatedEnd: number;

      if (prevWord && nextWhisperWord) {
        // Estimate timing based on surrounding words
        const gap = nextWhisperWord.start - prevWord.end;
        estimatedStart = prevWord.end + gap * 0.3;
        estimatedEnd = prevWord.end + gap * 0.7;
      } else if (prevWord) {
        // At the end - estimate based on average word duration
        const avgDuration =
          aligned.reduce((sum, w) => sum + (w.end - w.start), 0) /
          aligned.length || 0.3;
        estimatedStart = prevWord.end + 0.05; // Small pause
        estimatedEnd = prevWord.end + avgDuration;
      } else if (nextWhisperWord) {
        // At the beginning - estimate before first whisper word
        estimatedStart = Math.max(0, nextWhisperWord.start - 0.3);
        estimatedEnd = nextWhisperWord.start - 0.05;
      } else {
        // No reference points - skip this word
        continue;
      }

      aligned.push({
        sourceWord: sourceWord,
        whisperWord: "[missed]",
        start: Math.max(0, estimatedStart),
        end: estimatedEnd,
        confidence: 0,
      });
    }
  }

  // Calculate overall alignment quality
  const alignmentQuality = aligned.length > 0 ? totalConfidence / aligned.length : 0;

  // If alignment quality is too low, return null to indicate failure
  // This prevents poor highlighting when Whisper output is very different from source
  if (alignmentQuality < 0.5) {
    console.warn(
      `[wordAlignment] Poor alignment quality: ${(alignmentQuality * 100).toFixed(1)}%. ` +
        `Source: ${sourceWords.length} words, Whisper: ${whisperTimestamps.length} words.`
    );
    return null;
  }

  return aligned;
}

/**
 * Convert aligned words to the format expected by the reader.
 * Uses source words for display to match the original text exactly.
 */
export function alignedWordsToTimestamps(
  alignedWords: AlignedWord[]
): WordTimestamp[] {
  return alignedWords.map((aw) => ({
    word: aw.sourceWord,
    start: aw.start,
    end: aw.end,
  }));
}

/**
 * Check if two texts are sufficiently similar to allow sync highlighting.
 * Returns a similarity score between 0 and 1.
 */
export function calculateTextSimilarity(
  sourceText: string,
  whisperText: string
): number {
  const sourceWords = sourceText
    .split(/\s+/)
    .map(normalizeWord)
    .filter((w) => w.length > 0);
  const whisperWords = whisperText
    .split(/\s+/)
    .map(normalizeWord)
    .filter((w) => w.length > 0);

  if (sourceWords.length === 0 && whisperWords.length === 0) return 1;
  if (sourceWords.length === 0 || whisperWords.length === 0) return 0;

  // Calculate word overlap using a simple bag-of-words approach
  const sourceSet = new Set(sourceWords);
  const whisperSet = new Set(whisperWords);

  let intersection = 0;
  for (const word of sourceSet) {
    if (whisperSet.has(word)) {
      intersection++;
    }
  }

  const union = sourceSet.size + whisperSet.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Validate if word timestamps are suitable for sync highlighting.
 * Returns validation result with details.
 */
export function validateTimestamps(
  sourceText: string,
  whisperTimestamps: WordTimestamp[]
): {
  valid: boolean;
  reason?: string;
  alignmentQuality?: number;
} {
  if (!whisperTimestamps || whisperTimestamps.length === 0) {
    return { valid: false, reason: "No timestamps available" };
  }

  if (!sourceText || sourceText.trim().length === 0) {
    return { valid: false, reason: "No source text available" };
  }

  const sourceWords = sourceText.split(/\s+/).filter((w) => w.length > 0);

  // Check word count similarity
  const wordCountDiff = Math.abs(sourceWords.length - whisperTimestamps.length);
  const wordCountRatio =
    sourceWords.length > 0 ? wordCountDiff / sourceWords.length : 1;

  if (wordCountRatio > 0.3) {
    // More than 30% word count difference
    return {
      valid: false,
      reason: `Word count mismatch: source has ${sourceWords.length} words, Whisper detected ${whisperTimestamps.length}`,
    };
  }

  // Build whisper text from timestamps
  const whisperText = whisperTimestamps.map((w) => w.word).join(" ");
  const similarity = calculateTextSimilarity(sourceText, whisperText);

  if (similarity < 0.6) {
    return {
      valid: false,
      reason: `Text similarity too low (${(similarity * 100).toFixed(1)}%)`,
      alignmentQuality: similarity,
    };
  }

  return {
    valid: true,
    alignmentQuality: similarity,
  };
}
