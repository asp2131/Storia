// Database types
export interface User {
  id: string;
  email: string;
  name?: string;
  subscriptionTier: "free" | "reader" | "bibliophile";
  createdAt: Date;
}

export interface Book {
  id: string;
  userId: string;
  title: string;
  author?: string;
  pdfUrl: string;
  totalPages: number;
  status: "processing" | "ready" | "failed";
  createdAt: Date;
}

export interface Page {
  id: string;
  bookId: string;
  pageNumber: number;
  textContent: string;
  sceneId?: string;
}

export interface Scene {
  id: string;
  bookId: string;
  startPage: number;
  endPage: number;
  pageSpreadIndex: number;
  setting: string;
  mood: string;
  descriptors: SceneAnalysis;
}

export interface Soundscape {
  id: string;
  sceneId: string;
  audioUrl: string;
  duration: number;
  generationPrompt: string;
  replicatePredictionId?: string;
}

export interface ReadingProgress {
  id: string;
  userId: string;
  bookId: string;
  currentPage: number;
  updatedAt: Date;
}

// Content analysis types
export interface SceneAnalysis {
  setting: string;
  mood: string;
  weather?: string;
  timeOfDay?: string;
  intensity: "low" | "medium" | "high";
  actions: string[];
  audioPrompt: string;
}

// API response types
export interface SoundscapeResult {
  audioUrl: string;
  duration: number;
  predictionId: string;
  prompt: string;
}

export interface PDFMetadata {
  title?: string;
  author?: string;
  pageCount: number;
}
