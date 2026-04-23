type UmamiValue = string | number | boolean | null | undefined;

interface UmamiTracker {
  track(event: string, data?: Record<string, UmamiValue>): void;
}

interface Window {
  umami?: UmamiTracker;
}
