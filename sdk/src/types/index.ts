/**
 * Types for secure Solana transactions through S3L (Secure Solana Link) communication
 */

import { Keypair } from "@solana/web3.js";

export enum Modality {
  VOICE = 'voice',
  TCP = 'tcp'
}

export interface HostConfig {
  cluster: string;       // Required: Solana cluster
  phoneNumber: string;   // Required: Phone number
  host: string;          // Required: Host address
  keyPair: Keypair;    // Required: Solana private key
  modality?: Modality;   // Optional: Communication modality (default: VOICE)
}

export interface ClientConfig {
  cluster: string;       // Required: Solana cluster
  keyPair: Keypair;    // Required: Solana private key
  modality?: Modality;   // Optional: Communication modality (default: VOICE)
}

export interface SalMessageHeaders {
  host?: string;         // Target host
  phone?: string;        // Phone number
  nonce: string;         // Nonce for security
  blockHeight?: number;  // Solana block height
  publicKey: string;     // Sender's public key
}

export enum SalMethod {
  GM = 'gm',
  MSG = 'msg',
  TX = 'tx',
}

// JSON 기반 S3L 메시지 인터페이스
export interface SalRequest {
  method: SalMethod;
  sig: string;           // Signature of the body
  msg: {
    headers: SalMessageHeaders;
    body: any;             // Message body (can be string or object)
  }
}

// JSON 기반 S3L 응답 메시지 인터페이스
export interface SalResponse {
  status: 'ok' | 'error'; // Response status
  code: number;           // Response code; now only 200
  sig: string;           // Signature of the body
  msg: {
    headers: SalMessageHeaders;
    body: any;             // Message body (can be string or object)
  }
}

export type MessageHandler = (message: string, sender: string) => Promise<void> | void;
export type TransactionHandler = (transaction: any) => Promise<string> | string;
