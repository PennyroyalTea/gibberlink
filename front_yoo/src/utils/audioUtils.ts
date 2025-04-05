import { EventEmitter } from 'events';

// Utility for handling audio messages
let context: AudioContext | null = null;
let ggwave: any = null;
let instance: any = null;
let inputContext: AudioContext | null = null;
let inputStream: MediaStream | null = null;
let analyserNode: AnalyserNode | null = null;

// Global state for recording
let mediaStreamInstance: MediaStream | null = null;
let mediaStream: MediaStreamAudioSourceNode | null = null;
let recorder: ScriptProcessorNode | null = null;
let isRecording = false;

// Event emitter for audio messages
export const audioMessageEmitter = new EventEmitter();

// Helper function to convert array types
function convertTypedArray(src: any, type: any) {
  const buffer = new ArrayBuffer(src.byteLength);
  new src.constructor(buffer).set(src);
  return new type(buffer);
}

export function getggwave() {
  return ggwave;
}

export function getinstance() {
  return instance;
}

export function getcontext() {
  return context;
}

export function createAnalyserNode(audioContext: AudioContext) {
  if (!audioContext) return null;
  analyserNode = audioContext.createAnalyser();
  analyserNode.fftSize = 2048;
  return analyserNode;
}

export function getAnalyserNode() {
  return analyserNode;
}

// Initialize audio context and ggwave instance
export async function initAudio(audioContext: AudioContext): Promise<boolean> {
  try {
    context = audioContext;

    if (!ggwave && window && (window as any).ggwave_factory) {
      ggwave = await (window as any).ggwave_factory();
      const parameters = ggwave.getDefaultParameters();
      parameters.sampleRateInp = context.sampleRate;
      parameters.sampleRateOut = context.sampleRate;
      parameters.soundMarkerThreshold = 4;

      instance = ggwave.init(parameters);
    }

    return !!(context && ggwave);
  } catch (error) {
    console.error('Failed to initialize audio:', error);
    return false;
  }
}

// Start recording audio
export async function startRecording(audioContext: AudioContext): Promise<void> {
  if (isRecording) return;

  try {
    context = audioContext;

    if (!ggwave && window && (window as any).ggwave_factory) {
      ggwave = await (window as any).ggwave_factory();
      const parameters = ggwave.getDefaultParameters();
      parameters.sampleRateInp = context.sampleRate;
      parameters.sampleRateOut = context.sampleRate;
      parameters.soundMarkerThreshold = 4;

      instance = ggwave.init(parameters);
    }

    mediaStreamInstance = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaStream = context.createMediaStreamSource(mediaStreamInstance);
    recorder = context.createScriptProcessor(4096, 1, 1);

    recorder.onaudioprocess = async (e: AudioProcessingEvent) => {
      const instance = getinstance();
      if (!getggwave()) {
        console.error('Audio processing failed: ggwave or instance not initialized');
        return;
      }
      const sourceBuf = e.inputBuffer.getChannelData(0);
      const res = getggwave().decode(
        instance,
        convertTypedArray(new Float32Array(sourceBuf), Int8Array)
      );

      if (res && res.length > 0) {
        let text = new TextDecoder("utf-8").decode(res);
        console.log('Decoded message:', text);
        audioMessageEmitter.emit('recordingMessage', text);
      }
    };

    if (mediaStream && recorder) {
      mediaStream.connect(recorder);
    }

    isRecording = true;
    audioMessageEmitter.emit('recordingStateChanged', true);
  } catch (err) {
    console.error(err);
    audioMessageEmitter.emit('recordingError', err);
  }
}

// Stop recording
export function stopRecording(): void {
  if (!isRecording) return;

  if (mediaStream) {
    mediaStream.disconnect();
  }
  if (recorder) {
    recorder.disconnect();
  }
  if (mediaStreamInstance) {
    mediaStreamInstance.getTracks().forEach(track => track.stop());
  }

  isRecording = false;
  audioMessageEmitter.emit('recordingStateChanged', false);
}

// Send an audio message
export async function sendAudioMessage(message: string, audioContext: AudioContext, fastest: boolean = false): Promise<boolean> {
  try {
    if (!await initAudio(audioContext) || !context || !ggwave) {
      console.error('Failed to send audio message: audio context or ggwave not initialized');
      return false;
    }

    const waveform = ggwave.encode(
      instance,
      message,
      fastest ? ggwave.ProtocolId.GGWAVE_PROTOCOL_AUDIBLE_FASTEST : ggwave.ProtocolId.GGWAVE_PROTOCOL_AUDIBLE_FAST,
      10
    );

    const buf = convertTypedArray(waveform, Float32Array);
    const buffer = context.createBuffer(1, buf.length, context.sampleRate);
    buffer.getChannelData(0).set(buf);
    const source = context.createBufferSource();
    source.buffer = buffer;
    
    if (analyserNode) {
      source.connect(analyserNode);
      analyserNode.connect(context.destination);
    } else {
      source.connect(context.destination);
    }
    
    source.start(0);
    audioMessageEmitter.emit('audioMessage', message);

    return true;
  } catch (error) {
    console.error('Failed to send audio message:', error);
    return false;
  }
} 