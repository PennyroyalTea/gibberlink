/**
 * 오디오 인코딩/디코딩을 위한 모듈
 * ggwave 라이브러리를 사용하여 메시지를 오디오로 변환하고, 오디오를 메시지로 변환하는 기능을 제공합니다.
 */
import { EventEmitter } from 'events';
import type { GGWaveModule, GGWaveInstance } from 'ggwave';

// 오디오 이벤트 타입
export interface AudioEvent {
  message: string;
  source: 'self' | 'external';
}

// 오디오 이벤트 리스너 타입
export type AudioEventListener = (event: AudioEvent) => void;

// Helper function to convert array types
function convertTypedArray(src: any, type: any): any {
  const buffer = new ArrayBuffer(src.byteLength);
  new src.constructor(buffer).set(src);
  return new type(buffer);
}

export class AudioCodec extends EventEmitter {
  private context: AudioContext | null = null;
  private ggwave: GGWaveModule | null = null;
  private instance: GGWaveInstance | null = null;
  private mediaStreamInstance: MediaStream | null = null;
  private mediaStream: MediaStreamAudioSourceNode | null = null;
  private recorder: ScriptProcessorNode | null = null;
  private isRecording = false;
  private userId: string;

  constructor(userId?: string) {
    super();
    this.userId = userId || Math.random().toString(36).substring(2, 4).toUpperCase();
  }

  /**
   * 오디오 시스템을 초기화합니다.
   */
  public async init(): Promise<boolean> {
    try {
      if (!this.context) {
        this.context = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 48000 });
      }

      // ggwave 로딩
      if (!this.ggwave && typeof window !== 'undefined') {
        console.log('[CODEC] ggwave 로딩 중...');
        
        if (!(window as any).ggwave_factory) {
          // 실제 구현에서는 스크립트 로딩 로직이 필요합니다
          // 여기서는 ggwave가 이미 로드되어 있다고 가정합니다
          console.error('[CODEC] ggwave_factory를 찾을 수 없습니다.');
          return false;
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
          console.log('[CODEC] ggwave 초기화 완료', { instance: this.instance });
        } else {
          console.error('[CODEC] ggwave 초기화 실패');
          return false;
        }
      }

      return !!(this.context && this.ggwave && this.instance);
    } catch (error) {
      console.error('[CODEC] 오디오 초기화 실패:', error);
      return false;
    }
  }

  /**
   * 마이크를 사용하여 오디오 수신을 시작합니다.
   */
  public async startListening(): Promise<boolean> {
    if (this.isRecording) return true;
    
    if (!await this.init()) {
      console.error('[CODEC] 오디오 초기화 실패로 수신을 시작할 수 없습니다.');
      return false;
    }
    
    try {
      if (!this.context) {
        console.error('[CODEC] AudioContext가 없습니다.');
        return false;
      }
      
      // 마이크 액세스 요청
      this.mediaStreamInstance = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });
      
      this.mediaStream = this.context.createMediaStreamSource(this.mediaStreamInstance);
      
      // 오디오 프로세서 생성
      this.recorder = this.context.createScriptProcessor(8192, 1, 1);
      
      // 오디오 데이터 처리
      this.recorder.onaudioprocess = (e: AudioProcessingEvent) => {
        if (!this.ggwave || !this.instance) {
          console.error('[CODEC] ggwave 또는 인스턴스가 초기화되지 않았습니다.');
          return;
        }
        
        const sourceBuf = e.inputBuffer.getChannelData(0);
        const res = this.ggwave.decode(
          this.instance,
          convertTypedArray(new Float32Array(sourceBuf), Int8Array)
        );

        if (res && res.length > 0) {
          const text = new TextDecoder("utf-8").decode(res);
          
          // 송신자 ID가 있는 경우 자신의 메시지 무시
          if (text.startsWith(`${this.userId}$`)) {
            console.log("[CODEC] 자신의 메시지 무시:", text);
            return;
          }
          
          // ID 접두사 제거
          const cleanMessage = text.includes('$') ? text.split('$').slice(1).join('$') : text;
          
          this.emit('message', {
            message: cleanMessage,
            source: 'external'
          });
        }
      };

      // 오디오 그래프 연결
      if (this.mediaStream && this.recorder) {
        this.mediaStream.connect(this.recorder);
        this.recorder.connect(this.context.destination);
      }

      this.isRecording = true;
      return true;
    } catch (err) {
      console.error('[CODEC] 오디오 수신 시작 실패:', err);
      return false;
    }
  }

  /**
   * 오디오 수신을 중지합니다.
   */
  public stopListening(): void {
    if (!this.isRecording) return;
    
    if (this.recorder) {
      this.recorder.disconnect();
      this.recorder = null;
    }
    
    if (this.mediaStream) {
      this.mediaStream.disconnect();
      this.mediaStream = null;
    }
    
    if (this.mediaStreamInstance) {
      this.mediaStreamInstance.getTracks().forEach(track => track.stop());
      this.mediaStreamInstance = null;
    }
    
    this.isRecording = false;
  }

  /**
   * 메시지를 오디오로 인코딩하여 재생합니다.
   */
  public async sendMessage(message: string, fastest: boolean = false): Promise<boolean> {
    try {
      if (!await this.init() || !this.context || !this.ggwave || !this.instance) {
        console.error('[CODEC] 오디오 메시지 전송 실패: 초기화되지 않음');
        return false;
      }
      
      // ID 접두사 추가
      const encodedMessage = `${this.userId}$${message}`;

      // 프로토콜 선택 (빠른 전송 또는 일반 전송)
      const protocol = fastest 
        ? this.ggwave.ProtocolId.GGWAVE_PROTOCOL_AUDIBLE_FASTEST 
        : this.ggwave.ProtocolId.GGWAVE_PROTOCOL_AUDIBLE_FAST;
      
      // 메시지를 오디오 파형으로 인코딩
      const waveform = this.ggwave.encode(
        this.instance,
        encodedMessage,
        protocol,
        10 // 볼륨
      );

      // 오디오 버퍼 생성 및 재생
      const buf = convertTypedArray(waveform, Float32Array);
      const buffer = this.context.createBuffer(1, buf.length, this.context.sampleRate);
      buffer.getChannelData(0).set(buf);
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.connect(this.context.destination);
      source.start(0);

      // 이벤트 발생
      this.emit('message', {
        message,
        source: 'self'
      });

      return true;
    } catch (error) {
      console.error('[CODEC] 오디오 메시지 전송 실패:', error);
      return false;
    }
  }
  
  /**
   * 메시지 이벤트 리스너를 등록합니다.
   */
  public onMessage(listener: AudioEventListener): () => void {
    this.on('message', listener);
    return () => this.off('message', listener);
  }
  
  /**
   * 리소스를 정리합니다.
   */
  public dispose(): void {
    this.stopListening();
    
    if (this.context && this.context.state !== 'closed') {
      this.context.close();
    }
    
    this.context = null;
    this.ggwave = null;
    this.instance = null;
    this.removeAllListeners();
  }
}