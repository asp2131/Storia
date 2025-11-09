/**
 * Web Audio API wrapper for soundscape playback
 * Handles audio buffer loading, looping playback, volume control, and crossfading
 */

export class AudioPlayer {
  private audioContext: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private currentGainNode: GainNode | null = null;
  private currentBuffer: AudioBuffer | null = null;
  private volume: number = 0.7; // Default volume (0-1)
  private isPlaying: boolean = false;
  private startTime: number = 0;

  /**
   * Initialize the AudioContext and GainNode
   * Must be called after user interaction due to browser autoplay policies
   */
  async initialize(): Promise<void> {
    if (this.audioContext) {
      return; // Already initialized
    }

    try {
      this.audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();

      // Resume context if suspended (required by some browsers)
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }

      console.log("✅ AudioContext initialized");
    } catch (error) {
      console.error("❌ Failed to initialize AudioContext:", error);
      throw new Error("Failed to initialize audio player");
    }
  }

  /**
   * Load and decode an audio file from a URL
   * @param url - URL of the audio file to load
   * @returns Decoded AudioBuffer
   */
  async loadAudio(url: string): Promise<AudioBuffer> {
    if (!this.audioContext) {
      await this.initialize();
    }

    try {
      console.log(`📥 Loading audio from: ${url}`);

      // Fetch the audio file
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio: ${response.statusText}`);
      }

      // Get the audio data as an ArrayBuffer
      const arrayBuffer = await response.arrayBuffer();

      // Decode the audio data
      const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);

      console.log(
        `✅ Audio loaded successfully (duration: ${audioBuffer.duration}s)`
      );
      return audioBuffer;
    } catch (error) {
      console.error("❌ Failed to load audio:", error);
      throw new Error(
        `Failed to load audio: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Play an audio buffer with looping
   * @param buffer - AudioBuffer to play
   * @param loop - Whether to loop the audio (default: true)
   */
  play(buffer: AudioBuffer, loop: boolean = true): void {
    if (!this.audioContext) {
      throw new Error("AudioContext not initialized");
    }

    // Resume context if suspended
    if (this.audioContext.state === "suspended") {
      this.audioContext.resume();
    }

    // Stop current playback if any
    this.stop();

    // Create source node
    this.currentSource = this.audioContext.createBufferSource();
    this.currentSource.buffer = buffer;
    this.currentSource.loop = loop;

    // Create gain node for volume control
    this.currentGainNode = this.audioContext.createGain();
    this.currentGainNode.gain.value = this.volume;

    // Connect: source -> gain -> destination
    this.currentSource.connect(this.currentGainNode);
    this.currentGainNode.connect(this.audioContext.destination);

    // Start playback
    this.currentSource.start(0);
    this.currentBuffer = buffer;
    this.isPlaying = true;
    this.startTime = this.audioContext.currentTime;

    console.log("▶️ Audio playback started");
  }

  /**
   * Stop current audio playback
   */
  stop(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch (error) {
        // Ignore errors if already stopped
      }
      this.currentSource = null;
    }

    if (this.currentGainNode) {
      this.currentGainNode.disconnect();
      this.currentGainNode = null;
    }

    this.isPlaying = false;
    this.currentBuffer = null;
    console.log("⏹️ Audio playback stopped");
  }

  /**
   * Pause current audio playback
   */
  pause(): void {
    if (this.isPlaying && this.audioContext) {
      this.stop();
      console.log("⏸️ Audio playback paused");
    }
  }

  /**
   * Resume paused audio playback
   */
  resume(): void {
    if (!this.isPlaying && this.currentBuffer) {
      this.play(this.currentBuffer);
    }
  }

  /**
   * Set the volume level
   * @param volume - Volume level (0-1)
   */
  setVolume(volume: number): void {
    // Clamp volume between 0 and 1
    this.volume = Math.max(0, Math.min(1, volume));

    // Update current gain node if playing
    if (this.currentGainNode) {
      this.currentGainNode.gain.value = this.volume;
    }

    console.log(`🔊 Volume set to: ${Math.round(this.volume * 100)}%`);
  }

  /**
   * Get the current volume level
   * @returns Current volume (0-1)
   */
  getVolume(): number {
    return this.volume;
  }

  /**
   * Check if audio is currently playing
   * @returns true if playing, false otherwise
   */
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Get the current AudioContext state
   * @returns AudioContext state or null if not initialized
   */
  getState(): AudioContextState | null {
    return this.audioContext?.state || null;
  }

  /**
   * Resume the AudioContext if suspended
   * Required by some browsers after user interaction
   */
  async resumeContext(): Promise<void> {
    if (this.audioContext && this.audioContext.state === "suspended") {
      await this.audioContext.resume();
      console.log("▶️ AudioContext resumed");
    }
  }

  /**
   * Clean up resources
   * Should be called when the component unmounts
   */
  dispose(): void {
    this.stop();

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
      console.log("🗑️ AudioPlayer disposed");
    }
  }

  /**
   * Check if the given buffer is the same as the currently playing buffer
   * @param buffer - AudioBuffer to compare
   * @returns true if the buffer is the same as the current buffer
   */
  isSameBuffer(buffer: AudioBuffer): boolean {
    return this.currentBuffer === buffer;
  }

  /**
   * Crossfade from current audio to a new audio buffer
   * @param newBuffer - AudioBuffer to crossfade to
   * @param duration - Crossfade duration in seconds (default: 3)
   */
  crossfadeTo(newBuffer: AudioBuffer, duration: number = 3): void {
    if (!this.audioContext) {
      throw new Error("AudioContext not initialized");
    }

    // Resume context if suspended
    if (this.audioContext.state === "suspended") {
      this.audioContext.resume();
    }

    const now = this.audioContext.currentTime;

    // If nothing is playing, just start the new audio
    if (!this.isPlaying || !this.currentSource || !this.currentGainNode) {
      this.play(newBuffer);
      return;
    }

    // If the same buffer is already playing, no need to crossfade
    if (this.isSameBuffer(newBuffer)) {
      console.log("🔁 Same audio already playing, skipping crossfade");
      return;
    }

    // Store reference to old gain node for fade out
    const oldGainNode = this.currentGainNode;
    const oldSource = this.currentSource;

    // Create new source and gain for the new audio
    const newSource = this.audioContext.createBufferSource();
    newSource.buffer = newBuffer;
    newSource.loop = true;

    const newGainNode = this.audioContext.createGain();
    newGainNode.gain.value = 0; // Start at 0 for fade in

    // Connect new audio: source -> gain -> destination
    newSource.connect(newGainNode);
    newGainNode.connect(this.audioContext.destination);

    // Start new audio
    newSource.start(0);

    // Crossfade: fade out old, fade in new
    oldGainNode.gain.linearRampToValueAtTime(0, now + duration);
    newGainNode.gain.linearRampToValueAtTime(this.volume, now + duration);

    // Update current references
    this.currentSource = newSource;
    this.currentGainNode = newGainNode;
    this.currentBuffer = newBuffer;
    this.startTime = now;

    // Clean up old source after fade completes
    setTimeout(() => {
      try {
        oldSource.stop();
        oldSource.disconnect();
        oldGainNode.disconnect();
      } catch (error) {
        // Ignore errors if already stopped
      }
    }, duration * 1000 + 100); // Add small buffer

    console.log(`🔀 Crossfading to new audio (${duration}s)`);
  }

  /**
   * Preload an audio file without playing it
   * Useful for preloading upcoming soundscapes
   * @param url - URL of the audio file to preload
   * @returns Promise that resolves to the loaded AudioBuffer
   */
  async preload(url: string): Promise<AudioBuffer> {
    return this.loadAudio(url);
  }
}

// Export a singleton instance for convenience
let audioPlayerInstance: AudioPlayer | null = null;

/**
 * Get the singleton AudioPlayer instance
 * @returns AudioPlayer instance
 */
export function getAudioPlayer(): AudioPlayer {
  if (!audioPlayerInstance) {
    audioPlayerInstance = new AudioPlayer();
  }
  return audioPlayerInstance;
}

/**
 * Create a new AudioPlayer instance
 * Use this if you need multiple independent audio players
 * @returns New AudioPlayer instance
 */
export function createAudioPlayer(): AudioPlayer {
  return new AudioPlayer();
}
