import { AudioEncoder, AudioEncoderOptions, AudioMessage } from './audioEncoder';

export interface GibberLinkOptions extends AudioEncoderOptions {
  autoInit?: boolean;
}

export interface MessageHandler {
  (message: AudioMessage): void;
}

export class GibberLink {
  private audioEncoder: AudioEncoder;
  private messageListeners: Set<MessageHandler> = new Set();
  
  constructor(options: GibberLinkOptions = {}) {
    this.audioEncoder = new AudioEncoder(options);
    
    // Forward messages from the audio encoder
    this.audioEncoder.on('message', (message) => {
      this.notifyListeners(message);
    });
    
    // Auto-initialize if requested
    if (options.autoInit) {
      this.init();
    }
  }
  
  /**
   * Initialize the GibberLink SDK
   */
  public async init(): Promise<boolean> {
    return this.audioEncoder.initAudio();
  }
  
  /**
   * Start listening for GL MODE messages
   */
  public async startListening(): Promise<void> {
    await this.audioEncoder.startRecording();
  }
  
  /**
   * Stop listening for GL MODE messages
   */
  public async stopListening(): Promise<void> {
    await this.audioEncoder.stopRecording();
  }
  
  /**
   * Send a message using GL MODE
   * @param message The message to send
   * @param useFastestProtocol Whether to use the fastest protocol for transmission
   */
  public async sendMessage(message: string, useFastestProtocol: boolean = false): Promise<boolean> {
    return this.audioEncoder.sendMessage(message, useFastestProtocol);
  }
  
  /**
   * Add a message listener
   * @param handler The handler function to call when a message is received
   */
  public onMessage(handler: MessageHandler): () => void {
    this.messageListeners.add(handler);
    
    // Return a function to remove the listener
    return () => {
      this.messageListeners.delete(handler);
    };
  }
  
  /**
   * Get the AudioContext
   */
  public getAudioContext(): AudioContext | null {
    return this.audioEncoder.getAudioContext();
  }
  
  /**
   * Get the AnalyserNode for visualization
   */
  public getAnalyserNode(): AnalyserNode | null {
    return this.audioEncoder.getAnalyserNode();
  }
  
  /**
   * Create an AnalyserNode for visualization
   */
  public createAnalyserNode(): AnalyserNode | null {
    return this.audioEncoder.createAnalyserNode();
  }
  
  /**
   * Check if currently recording/listening
   */
  public isListening(): boolean {
    return this.audioEncoder.isCurrentlyRecording();
  }
  
  // Private method to notify all listeners
  private notifyListeners(message: AudioMessage): void {
    this.messageListeners.forEach(listener => {
      try {
        listener(message);
      } catch (error) {
        console.error('Error in message listener:', error);
      }
    });
  }
} 