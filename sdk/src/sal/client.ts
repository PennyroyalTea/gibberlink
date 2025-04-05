import {
  ClientConfig,
  Modality,
  SalMessageHeaders,
  SalRequest,
  SalResponse,
  SalMethod
} from '../types';
import { EventEmitter } from 'events';
import { AudioCodec, AudioEvent } from './codec';
import bs58 from 'bs58';
import { Keypair } from '@solana/web3.js';
import * as nacl from 'tweetnacl';
/**
 * SalClient는 음성 기반 통신을 통해 SalHost와 통신하는 클라이언트입니다.
 */
export class SalClient extends EventEmitter {
  private cfg: ClientConfig;
  private isConnected: boolean = false;
  private currentHost: string | null = null;
  private audioCodec: AudioCodec | null = null;
  private pendingRequests: Map<string, { resolve: (value: any) => void, reject: (reason?: any) => void }> = new Map();
  private keypair: Keypair;

  // 콜백 함수
  private onSuccessCallback: (() => void) | null = null;
  private onFailureCallback: ((error: Error) => void) | null = null;

  constructor(config: ClientConfig) {
    super();
    
    // 필수 설정 확인
    if (!config.cluster || !config.keyPair) {
      throw new Error('필수 설정 매개변수가 누락되었습니다.');
    }
    
    this.cfg = {
      ...config,
      modality: Modality.VOICE // VOICE 모드만 지원
    };
    
    // 키페어 생성
    this.keypair = config.keyPair;
  }
  
  /**
   * 호스트에 연결합니다.
   */
  public connect(host: string, phoneNumber?: string): SalClient {
    this.currentHost = host;
    
    // 오디오 수신 시작
    this.initAudioCodec();
    
    // 연결 프로세스 시작
    this.performConnection(host, phoneNumber);
    
    return this;
  }
  
  /**
   * 성공 콜백을 설정합니다.
   */
  public onSuccess(callback: () => void): SalClient {
    this.onSuccessCallback = callback;
    return this;
  }
  
  /**
   * 실패 콜백을 설정합니다.
   */
  public onFailure(callback: (error: Error) => void): SalClient {
    this.onFailureCallback = callback;
    return this;
  }
  
  /**
   * 연결된 호스트에 메시지를 전송합니다.
   */
  public async send(message: string): Promise<any> {
    if (!this.isConnected) {
      throw new Error('호스트에 연결되지 않았습니다.');
    }
    
    if (!this.currentHost) {
      throw new Error('호스트가 지정되지 않았습니다.');
    }
    
    return this.sendTextMessage(message);
  }
  
  /**
   * 연결을 종료합니다.
   */
  public async close(): Promise<void> {
    if (!this.isConnected) {
      return;
    }
    
    if (this.audioCodec) {
      this.audioCodec.stopListening();
      this.audioCodec.dispose();
      this.audioCodec = null;
    }
    
    this.isConnected = false;
    this.currentHost = null;
    this.emit('disconnected');
    console.log('SAL 클라이언트 연결 종료');
  }
  
  /**
   * 오디오 코덱을 초기화합니다.
   */
  private async initAudioCodec(): Promise<void> {
    // 이미 초기화되어 있으면 리턴
    if (this.audioCodec) {
      return;
    }
    
    // 새 인스턴스 생성
    this.audioCodec = new AudioCodec('CLIENT');
    
    // 메시지 핸들러 등록
    this.audioCodec.onMessage(this.handleAudioMessage.bind(this));
    
    // 오디오 수신 시작
    await this.audioCodec.startListening();
  }
  
  /**
   * 오디오 메시지를 처리합니다.
   */
  private handleAudioMessage(event: AudioEvent): void {
    try {
      if (event.source === 'self') {
        return; // 자신이 보낸 메시지는 무시
      }
      
      // JSON 파싱 시도
      const response = JSON.parse(event.message) as SalResponse;
      
      // 응답 처리
      this.handleResponse(response);
    } catch (error) {
      console.error('오디오 메시지 처리 오류:', error);
    }
  }
  
  /**
   * 호스트와 연결을 수행합니다.
   */
  private async performConnection(host: string, phoneNumber?: string): Promise<void> {
    try {
      console.log(`${host}에 연결 중...`);
      
      // GM 메시지 헤더 생성
      const headers: SalMessageHeaders = {
        host,
        nonce: this.generateNonce(),
        publicKey: this.keypair.publicKey.toString()
      };
      
      if (phoneNumber) {
        headers.phone = phoneNumber;
      }
      
      // GM 메시지 본문
      const body = "HELLO";
      
      // GM 메시지 전송
      const response = await this.sendRequest(SalMethod.GM, headers, body);
      
      // 응답 확인
      if (response.status === 'ok') {
        this.isConnected = true;
        this.emit('connected', host);
        
        if (this.onSuccessCallback) {
          this.onSuccessCallback();
        }
      } else {
        throw new Error(`연결 거부됨: ${JSON.stringify(response.msg.body)}`);
      }
    } catch (error) {
      console.error('연결 실패:', error);
      
      if (this.onFailureCallback) {
        this.onFailureCallback(error instanceof Error ? error : new Error(String(error)));
      }
      
      this.emit('error', error);
    }
  }
  
  /**
   * 텍스트 메시지를 전송합니다.
   */
  private async sendTextMessage(message: string): Promise<any> {
    console.log(`${this.currentHost}에 텍스트 메시지 전송: ${message}`);
    
    const headers: SalMessageHeaders = {
      host: this.currentHost as string,
      nonce: this.generateNonce(),
      publicKey: this.keypair.publicKey.toString()
    };
    
    // 메시지 전송
    return this.sendRequest(SalMethod.MSG, headers, message);
  }
  
  /**
   * 요청을 전송합니다.
   */
  private async sendRequest(
    method: SalMethod,
    headers: SalMessageHeaders,
    body: any
  ): Promise<SalResponse> {
    if (!this.audioCodec) {
      await this.initAudioCodec();
      if (!this.audioCodec) {
        throw new Error('오디오 코덱을 초기화할 수 없습니다.');
      }
    }
    
    // 요청 생성
    const msg = { headers, body };
    const request: SalRequest = {
      method,
      sig: this.sign(JSON.stringify(msg)),
      msg
    };
    
    // 요청을 JSON 문자열로 변환
    const requestJson = JSON.stringify(request);
    
    return new Promise((resolve, reject) => {
      // 타임아웃 설정
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(headers.nonce);
        reject(new Error('응답 타임아웃'));
      }, 10000);
      
      // 요청 등록
      this.pendingRequests.set(headers.nonce, {
        resolve: (response: SalResponse) => {
          clearTimeout(timeoutId);
          resolve(response);
        },
        reject
      });
      
      // 오디오로 전송
      this.audioCodec!.sendMessage(requestJson, true)
        .catch(error => {
          clearTimeout(timeoutId);
          this.pendingRequests.delete(headers.nonce);
          reject(error);
        });
    });
  }
  
  /**
   * 응답을 처리합니다.
   */
  private handleResponse(response: SalResponse): void {
    // 응답의 nonce 추출
    const nonce = response.msg.headers.nonce;
    
    // 보류 중인 요청 확인
    const pendingRequest = this.pendingRequests.get(nonce);
    if (pendingRequest) {
      // 응답 제공
      pendingRequest.resolve(response);
      this.pendingRequests.delete(nonce);
    } else {
      console.warn('알 수 없는 응답 무시:', nonce);
    }
  }
  
  /**
   * 랜덤 nonce를 생성합니다.
   */
  private generateNonce(): string {
    const buffer = new Uint8Array(16);
    window.crypto.getRandomValues(buffer);
    return Array.from(buffer)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  
  /**
   * 메시지에 서명합니다.
   */
  private sign(message: string): string {
    try {
      const messageUint8 = new TextEncoder().encode(message);
      // @solana/web3.js의 sign 함수 사용
      const signature = nacl.sign.detached(messageUint8, this.keypair.secretKey);
      return bs58.encode(signature);
    } catch (error) {
      console.error('서명 생성 오류:', error);
      return 'invalid-signature';
    }
  }
}