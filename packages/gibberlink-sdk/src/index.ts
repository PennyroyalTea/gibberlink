// Export the core modules
export { GibberLink, GibberLinkOptions, MessageHandler } from './core/gibberlink';
export { AudioEncoder, AudioEncoderOptions, AudioMessage, AudioEncoderEvents } from './core/audioEncoder';
export { 
  SecureMessaging, 
  SecureMessagingOptions, 
  MessageType,
  SecureMessageEvent 
} from './core/secureMessaging';

// Export Solana-related modules
export { SolanaClient, SolanaClientOptions } from './solana/solanaClient';
export { default as DirectoryService } from './solana/directoryService';
export type { DirectoryServiceConfig } from './solana/directoryService';

// Export S3L modules
export {
  S3lHost,
  S3lClient,
  Modality,
  HostConfig,
  ClientConfig,
  MessageHandler as S3lMessageHandler,
  TransactionHandler as S3lTransactionHandler
} from './s3l';

// Export type definitions
export {
  AgentIdentity,
  TransactionHeader,
  TransactionPayload,
  TransactionRequest,
  TransactionResponse,
  DirectoryServiceRequest,
  DirectoryServiceResponse,
  GLModeData,
  EncryptionParams,
  SecureMessage
} from './solana/types'; 