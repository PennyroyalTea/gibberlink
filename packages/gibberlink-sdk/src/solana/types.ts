/**
 * Types for secure Solana transactions through GL MODE communication
 */

export interface AgentIdentity {
  id: string;            // Unique agent identifier
  publicKey: string;     // Solana public key
  name?: string;         // Human-readable name
  phoneNumber?: string;  // Assigned virtual phone number
}

export interface TransactionHeader {
  nonce: string;         // Unique value to prevent replay attacks
  timestamp: number;     // Transaction creation time
  blockTime: number;     // Current Solana block time (Proof of History)
  expiresAt: number;     // Transaction expiration time
  sourceAgent: string;   // Agent ID that initiated the transaction
  targetAgent: string;   // Agent ID that should receive the transaction
}

export interface TransactionPayload {
  amount: number;        // Amount to transfer in lamports
  tokenMint?: string;    // Token mint address (if token transfer)
  memo?: string;         // Optional memo/note for the transaction
  reference?: string;    // Reference for the payment
}

export interface TransactionRequest {
  header: TransactionHeader;
  payload: TransactionPayload;
  serializedTransaction: string;  // Base64 encoded serialized transaction
  signature?: string;    // Signature of the transaction (if pre-signed)
}

export interface TransactionResponse {
  status: 'accepted' | 'rejected' | 'pending' | 'completed';
  signature?: string;    // Transaction signature (after submission)
  message?: string;      // Human-readable message
  error?: string;        // Error message if transaction failed
}

export interface DirectoryServiceRequest {
  agentId?: string;      // Look up specific agent by ID
  phoneNumber?: string;  // Look up agent by phone number
  publicKey?: string;    // Look up agent by public key
}

export interface DirectoryServiceResponse {
  success: boolean;
  agent?: AgentIdentity;
  agents?: AgentIdentity[];
  error?: string;
}

export interface GLModeData {
  type: 'transaction_request' | 'transaction_response' | 'directory_query' | 'directory_response' | 'secure_message';
  payload: any;          // Type-specific payload
  checksum: string;      // Data integrity checksum
}

export interface EncryptionParams {
  algorithm: 'AES-GCM';  // Encryption algorithm
  keyLength: number;     // Key length in bits
  iv: string;            // Initialization vector (base64)
}

export interface SecureMessage {
  sender: string;        // Agent ID of sender
  recipient: string;     // Agent ID of recipient
  encryptedContent: string; // Encrypted message content
  encryptionParams: EncryptionParams;
  signature: string;     // Signature of the encrypted content
}

/**
 * Types for secure Solana transactions through S3L (Secure Solana Link) communication
 */

export enum Modality {
  VOICE = 'voice',
  TCP = 'tcp'
}

export interface HostConfig {
  cluster: string;       // Required: Solana cluster
  phoneNumber: string;   // Required: Phone number
  host: string;          // Required: Host address
  privateKey: string;    // Required: Solana private key
  modality?: Modality;   // Optional: Communication modality (default: TCP)
}

export interface ClientConfig {
  cluster: string;       // Required: Solana cluster
  privateKey: string;    // Required: Solana private key
  modality?: Modality;   // Optional: Communication modality (default: TCP)
}

export interface S3lMessageHeaders {
  host?: string;         // Target host
  phone?: string;        // Phone number
  nonce: string;         // Nonce for security
  blockHeight?: number;  // Solana block height
  publicKey: string;     // Sender's public key
}

// JSON 기반 S3L 메시지 인터페이스
export interface S3lJsonMessage {
  sig: string;           // Signature of the body
  headers: S3lMessageHeaders;
  body: any;             // Message body (can be string or object)
}

// JSON 기반 S3L 응답 메시지 인터페이스
export interface S3lJsonResponse {
  sig: string;           // Signature of the body
  status: 'ok' | 'error'; // Response status
  headers: S3lMessageHeaders;
  body: any;             // Response body (can be string or object)
}

export type MessageHandler = (message: string, sender: string) => Promise<void> | void;
export type TransactionHandler = (transaction: any) => Promise<string> | string; 