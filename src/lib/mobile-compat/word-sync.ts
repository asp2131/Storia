export function computeActiveWordIndexMobileCompat(
  timestamps: { word: string; start: number; end: number }[],
  currentTimeSeconds: number,
): number {
  if (!timestamps || timestamps.length === 0) return -1;

  const currentTime = currentTimeSeconds;
  let foundIndex = -1;

  for (let i = 0; i < timestamps.length; i++) {
    const word = timestamps[i];
    const nextWord = i + 1 < timestamps.length ? timestamps[i + 1] : null;

    if (currentTime >= word.start && currentTime <= word.end) {
      foundIndex = i;
      break;
    }

    if (nextWord !== null && currentTime > word.end && currentTime < nextWord.start) {
      foundIndex = i;
      break;
    }

    if (nextWord === null && currentTime >= word.start) {
      foundIndex = i;
      break;
    }

    if (currentTime > word.end) {
      foundIndex = i;
    }
  }

  return foundIndex;
}
