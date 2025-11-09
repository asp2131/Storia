/**
 * Retry a function with exponential backoff
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retry attempts
 * @param delayMs - Initial delay in milliseconds
 * @param backoffMultiplier - Multiplier for exponential backoff
 * @returns Result of the function
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000,
  backoffMultiplier: number = 2
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on the last attempt
      if (attempt === maxRetries - 1) {
        break;
      }

      // Calculate delay with exponential backoff
      const delay = delayMs * Math.pow(backoffMultiplier, attempt);

      console.log(
        `⚠️  Attempt ${attempt + 1}/${maxRetries} failed. Retrying in ${delay}ms...`
      );
      console.log(`   Error: ${lastError.message}`);

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

/**
 * Retry a function with a custom retry condition
 * @param fn - Function to retry
 * @param shouldRetry - Function that determines if retry should happen
 * @param maxRetries - Maximum number of retry attempts
 * @param delayMs - Initial delay in milliseconds
 * @returns Result of the function
 */
export async function withConditionalRetry<T>(
  fn: () => Promise<T>,
  shouldRetry: (error: Error) => boolean,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      if (!shouldRetry(lastError) || attempt === maxRetries - 1) {
        throw lastError;
      }

      const delay = delayMs * Math.pow(2, attempt);
      console.log(
        `⚠️  Attempt ${attempt + 1}/${maxRetries} failed. Retrying in ${delay}ms...`
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

/**
 * Check if an error is retryable (network errors, timeouts, etc.)
 * @param error - Error to check
 * @returns true if error is retryable
 */
export function isRetryableError(error: Error): boolean {
  const retryableMessages = [
    "ECONNRESET",
    "ETIMEDOUT",
    "ENOTFOUND",
    "ECONNREFUSED",
    "network",
    "timeout",
    "rate limit",
    "too many requests",
  ];

  const errorMessage = error.message.toLowerCase();
  return retryableMessages.some((msg) => errorMessage.includes(msg));
}
