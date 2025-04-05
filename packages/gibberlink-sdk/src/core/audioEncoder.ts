import EventEmitter from 'eventemitter3';
import type { GGWaveModule, GGWaveInstance } from 'ggwave';

// Helper function to convert array types
function convertTypedArray(src: any, type: any): any {
  const buffer = new ArrayBuffer(src.byteLength);
  new src.constructor(buffer).set(src);
  return new type(buffer);
}

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

export class AudioEncoder extends EventEmitter<AudioEncoderEvents> {
  private context: AudioContext | null = null;
  private ggwave: GGWaveModule | null = null;
  private instance: GGWaveInstance | null = null;
  private mediaStreamInstance: MediaStream | null = null;
  private mediaStream: MediaStreamAudioSourceNode | null = null;
  private recorder: ScriptProcessorNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private isRecording = false;
  private userId: string;

  constructor(options: AudioEncoderOptions = {}) {
    super();
    
    this.userId = options.userId || Math.random().toString(36).substring(2, 4).toUpperCase();
    
    // Bind methods
    this.initAudio = this.initAudio.bind(this);
    this.startRecording = this.startRecording.bind(this);
    this.stopRecording = this.stopRecording.bind(this);
    this.sendMessage = this.sendMessage.bind(this);
    this.createAnalyserNode = this.createAnalyserNode.bind(this);
  }

  public async initAudio(newContext?: AudioContext): Promise<boolean> {
    try {
      if (newContext) {
        this.context = newContext;
      } else if (!this.context) {
        this.context = new AudioContext({ sampleRate: 48000 });
      }

      // ggwave가 아직 로드되지 않았을 때 로드 대기
      if (!this.ggwave && typeof window !== 'undefined') {
        console.log('Waiting for ggwave to load...');
        if (!(window as any).ggwave_factory) {
          // ggwave 스크립트 로드 확인
          const ggwaveScript = document.querySelector('script[src*="ggwave.js"]');
          if (!ggwaveScript) {
            console.error('GibberLink SDK: ggwave.js script not found in document');
            throw new Error('ggwave.js script not found. Please include it in your HTML.');
          }
          
          // ggwave 로드 대기 (최대 5초)
          let retries = 0;
          while (!(window as any).ggwave_factory && retries < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            retries++;
          }
          
          if (!(window as any).ggwave_factory) {
            console.error('GibberLink SDK: ggwave_factory not available after waiting');
            throw new Error('Failed to load ggwave_factory');
          }
        }
        
        // ggwave 인스턴스 초기화
        this.ggwave = await (window as any).ggwave_factory();
        
        if (this.ggwave) {
          const parameters = this.ggwave.getDefaultParameters();
          
          if (this.context) {
            parameters.sampleRateInp = this.context.sampleRate;
            parameters.sampleRateOut = this.context.sampleRate;
          }
          
          parameters.soundMarkerThreshold = 4;
          
          this.instance = this.ggwave.init(parameters);
          console.log('GibberLink SDK: ggwave initialized', { instance: this.instance, ggwave: this.ggwave });
        } else {
          console.error('GibberLink SDK: Failed to initialize ggwave');
          throw new Error('Failed to initialize ggwave');
        }
      }

      return !!(this.context && this.ggwave && this.instance);
    } catch (error) {
      console.error('GibberLink SDK: Failed to initialize audio:', error);
      return false;
    }
  }

  public async startRecording(): Promise<void> {
    if (this.isRecording) return;

    await this.initAudio();

    const constraints = {
      audio: {
        echoCancellation: false,
        autoGainControl: false,
        noiseSuppression: false,
      },
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.mediaStreamInstance = stream;
      
      if (!this.context) {
        throw new Error('Audio context not initialized');
      }
      
      if (this.context.state === 'suspended') {
        await this.context.resume();
      }
      
      this.mediaStream = this.context.createMediaStreamSource(stream);
      const bufferSize = 1024;
      const numberOfInputChannels = 1;
      const numberOfOutputChannels = 1;

      this.recorder = this.context.createScriptProcessor(
        bufferSize,
        numberOfInputChannels,
        numberOfOutputChannels
      );

      if (!this.recorder) return;

      this.recorder.onaudioprocess = (e: AudioProcessingEvent) => {
        if (!this.ggwave || !this.instance) {
          console.error('Audio processing failed: ggwave or instance not initialized');
          return;
        }
        
        const sourceBuf = e.inputBuffer.getChannelData(0);
        const res = this.ggwave.decode(
          this.instance,
          convertTypedArray(new Float32Array(sourceBuf), Int8Array)
        );

        if (res && res.length > 0) {
          const text = new TextDecoder("utf-8").decode(res);
          
          // Parse ID from text and ignore messages from self
          if (text.startsWith(`${this.userId}$`)) {
            console.log("GibberLink SDK: Ignoring message from self", text);
            return;
          }
          
          // Remove any ID prefix if present
          const cleanMessage = text.includes('$') ? text.split('$').slice(1).join('$') : text;
          
          this.emit('message', {
            message: cleanMessage,
            source: 'external'
          });
        }
      };

      if (this.mediaStream && this.recorder) {
        this.mediaStream.connect(this.recorder);
        this.recorder.connect(this.context.destination);
      }

      this.isRecording = true;
      this.emit('recordingStateChanged', true);
    } catch (err) {
      console.error('GibberLink SDK: Recording error', err);
      this.emit('recordingError', err instanceof Error ? err : new Error(String(err)));
    }
  }

  public async stopRecording(): Promise<void> {
    if (!this.isRecording) return;

    if (this.recorder && this.context) {
      this.recorder.disconnect(this.context.destination);
      if (this.mediaStream) this.mediaStream.disconnect(this.recorder);
      this.recorder = null;
    }

    // Stop all tracks in the media stream
    if (this.mediaStreamInstance) {
      this.mediaStreamInstance.getTracks().forEach(track => track.stop());
      this.mediaStreamInstance = null;
    }
    
    this.mediaStream = null;
    this.isRecording = false;

    this.emit('recordingStateChanged', false);
  }

  public createAnalyserNode(): AnalyserNode | null {
    if (!this.context) return null;
    
    if (!this.analyserNode) {
      this.analyserNode = this.context.createAnalyser();
      this.analyserNode.fftSize = 2048;
    }
    
    return this.analyserNode;
  }

  public getAnalyserNode(): AnalyserNode | null {
    return this.analyserNode;
  }

  public getAudioContext(): AudioContext | null {
    return this.context;
  }

  public isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  public async sendMessage(message: string, fastest: boolean = false): Promise<boolean> {
    try {
      if (!await this.initAudio() || !this.context || !this.ggwave || !this.instance) {
        console.error('GibberLink SDK: Failed to send audio message: audio context or ggwave not initialized');
        return false;
      }
      
      const encodedMessage = `${this.userId}$${message}`;

      const protocol = fastest 
        ? this.ggwave.ProtocolId.GGWAVE_PROTOCOL_AUDIBLE_FASTEST 
        : this.ggwave.ProtocolId.GGWAVE_PROTOCOL_AUDIBLE_FAST;
      
      const waveform = this.ggwave.encode(
        this.instance,
        encodedMessage,
        protocol,
        10
      );

      const buf = convertTypedArray(waveform, Float32Array);
      const buffer = this.context.createBuffer(1, buf.length, this.context.sampleRate);
      buffer.getChannelData(0).set(buf);
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      
      // If global analyser node exists, connect through it
      if (this.analyserNode) {
        source.connect(this.analyserNode);
        this.analyserNode.connect(this.context.destination);
      } else {
        source.connect(this.context.destination);
      }
      
      source.start(0);

      // Emit message event for the sent message
      this.emit('message', {
        message,
        source: 'self'
      });

      return true;
    } catch (error) {
      console.error('GibberLink SDK: Failed to send audio message:', error);
      return false;
    }
  }
} 