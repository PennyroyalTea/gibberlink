declare module 'gibberlink-sdk' {
  export interface AudioEncoderOptions {
    sampleRate?: number;
    soundMarkerThreshold?: number;
    userId?: string;
  }

  export interface AudioMessage {
    message: string;
    source: string;
  }

  export type AudioEncoderEvents = {
    message: (message: AudioMessage) => void;
    recordingStateChanged: (isRecording: boolean) => void;
    recordingError: (error: Error) => void;
  };

  export class AudioEncoder {
    constructor(options?: AudioEncoderOptions);
    public initAudio(newContext?: AudioContext): Promise<boolean>;
    public startRecording(): Promise<void>;
    public stopRecording(): Promise<void>;
    public createAnalyserNode(): AnalyserNode | null;
    public getAnalyserNode(): AnalyserNode | null;
    public getAudioContext(): AudioContext | null;
    public isCurrentlyRecording(): boolean;
    public sendMessage(message: string, fastest?: boolean): Promise<boolean>;
    public on(event: string, listener: Function): this;
    public off(event: string, listener: Function): this;
    public emit(event: string, ...args: any[]): boolean;
  }

  export interface GibberLinkOptions extends AudioEncoderOptions {
    autoInit?: boolean;
  }

  export interface MessageHandler {
    (message: AudioMessage): void;
  }

  export class GibberLink {
    constructor(options?: GibberLinkOptions);
    public init(): Promise<boolean>;
    public startListening(): Promise<void>;
    public stopListening(): Promise<void>;
    public sendMessage(message: string, useFastestProtocol?: boolean): Promise<boolean>;
    public onMessage(handler: MessageHandler): () => void;
    public getAudioContext(): AudioContext | null;
    public getAnalyserNode(): AnalyserNode | null;
    public createAnalyserNode(): AnalyserNode | null;
    public isListening(): boolean;
  }

  export interface SolanaClientOptions {
    rpcEndpoint?: string;
  }

  export class SolanaClient {
    constructor(options?: SolanaClientOptions);
    public initialize(): Promise<void>;
    public getConnection(): any;
    public sendTransaction(transaction: any): Promise<string>;
    public getTransactionStatus(signature: string): Promise<string>;
  }
} 