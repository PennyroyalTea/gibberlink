import { GibberLink } from './gibberlink';
import { SolanaClient } from '../solana/solanaClient';
import { 
  AgentIdentity, 
  TransactionRequest, 
  TransactionResponse, 
  TransactionPayload,
  SecureMessage,
  EncryptionParams
} from '../solana/types';
import DirectoryService from '../solana/directoryService';
import crypto from 'crypto';

export interface SecureMessagingOptions {
  gibberlink: GibberLink;
  solanaClient?: SolanaClient;
  directoryService?: DirectoryService;
  agentIdentity?: AgentIdentity;
}

export enum MessageType {
  TEXT = 'text',
  TRANSACTION_REQUEST = 'transaction_request',
  TRANSACTION_RESPONSE = 'transaction_response',
  DIRECTORY_QUERY = 'directory_query',
  DIRECTORY_RESPONSE = 'directory_response'
}

export interface SecureMessageEvent {
  type: MessageType;
  sender: string;
  content: any;
  timestamp: number;
}

/**
 * SecureMessaging provides encrypted communication over GL MODE
 * and handles Solana transaction requests between AI agents
 */
export class SecureMessaging {
  private gibberlink: GibberLink;
  private solanaClient: SolanaClient | null = null;
  private directoryService: DirectoryService | null = null;
  private identity: AgentIdentity | null = null;
  private messageListeners: Array<(event: SecureMessageEvent) => void> = [];
  
  constructor(options: SecureMessagingOptions) {
    this.gibberlink = options.gibberlink;
    
    if (options.solanaClient) {
      this.solanaClient = options.solanaClient;
    }
    
    if (options.directoryService) {
      this.directoryService = options.directoryService;
    }
    
    if (options.agentIdentity) {
      this.identity = options.agentIdentity;
      
      // Set identity in Solana client if provided
      if (this.solanaClient) {
        this.solanaClient.setAgentIdentity(options.agentIdentity);
      }
    }
    
    // Set up message listener for GL MODE messages
    this.gibberlink.onMessage(this.handleIncomingMessage.bind(this));
  }
  
  /**
   * Set the agent identity
   */
  public setAgentIdentity(identity: AgentIdentity): void {
    this.identity = identity;
    
    if (this.solanaClient) {
      this.solanaClient.setAgentIdentity(identity);
    }
  }
  
  /**
   * Get the current agent identity
   */
  public getAgentIdentity(): AgentIdentity | null {
    return this.identity;
  }
  
  /**
   * Set the Solana client
   */
  public setSolanaClient(client: SolanaClient): void {
    this.solanaClient = client;
    
    if (this.identity) {
      this.solanaClient.setAgentIdentity(this.identity);
    }
  }
  
  /**
   * Set the directory service
   */
  public setDirectoryService(service: DirectoryService): void {
    this.directoryService = service;
    
    if (this.solanaClient) {
      this.solanaClient.setDirectoryService(service);
    }
  }
  
  /**
   * Start secure messaging
   */
  public async start(): Promise<void> {
    if (!this.identity) {
      throw new Error('Cannot start secure messaging without an agent identity');
    }
    
    // Initialize GL MODE
    await this.gibberlink.startListening();
    
    if (this.solanaClient) {
      await this.solanaClient.initialize();
    }
  }
  
  /**
   * Stop secure messaging
   */
  public async stop(): Promise<void> {
    await this.gibberlink.stopListening();
  }
  
  /**
   * Send a secure text message to another agent
   */
  public async sendSecureTextMessage(recipientId: string, text: string): Promise<boolean> {
    if (!this.identity) {
      throw new Error('Cannot send secure message without an agent identity');
    }
    
    // Look up recipient in directory service
    if (this.directoryService) {
      const recipientLookup = await this.directoryService.lookupAgent({
        agentId: recipientId
      });
      
      if (!recipientLookup.success || !recipientLookup.agent) {
        console.error(`Recipient not found: ${recipientId}`);
        return false;
      }
    }
    
    // Encrypt the message
    const { encryptedContent, encryptionParams } = this.encryptMessage(text);
    
    // Create secure message
    const secureMessage: SecureMessage = {
      sender: this.identity.id,
      recipient: recipientId,
      encryptedContent,
      encryptionParams,
      signature: this.signMessage(encryptedContent)
    };
    
    // Convert to JSON
    const messageJson = JSON.stringify({
      type: MessageType.TEXT,
      payload: secureMessage,
      timestamp: Date.now()
    });
    
    // Send via GL MODE
    return this.gibberlink.sendMessage(messageJson);
  }
  
  /**
   * Send a Solana transaction request
   */
  public async sendTransactionRequest(
    recipientId: string, 
    payload: TransactionPayload
  ): Promise<boolean> {
    if (!this.solanaClient) {
      throw new Error('Cannot send transaction request without a Solana client');
    }
    
    if (!this.identity) {
      throw new Error('Cannot send transaction request without an agent identity');
    }
    
    // Create transaction request
    const request = await this.solanaClient.createTransactionRequest(recipientId, payload);
    if (!request) {
      return false;
    }
    
    // Sign the transaction request
    const signedRequest = this.solanaClient.signTransactionRequest(request);
    
    // Encode as GL MODE data
    const glModeData = this.solanaClient.encodeGLModeData(signedRequest);
    
    // Wrap in a message envelope
    const messageJson = JSON.stringify({
      type: MessageType.TRANSACTION_REQUEST,
      payload: glModeData,
      timestamp: Date.now()
    });
    
    // Send via GL MODE
    return this.gibberlink.sendMessage(messageJson);
  }
  
  /**
   * Send a response to a transaction request
   */
  public async sendTransactionResponse(
    recipientId: string,
    response: TransactionResponse
  ): Promise<boolean> {
    if (!this.solanaClient) {
      throw new Error('Cannot send transaction response without a Solana client');
    }
    
    if (!this.identity) {
      throw new Error('Cannot send transaction response without an agent identity');
    }
    
    // Encode as GL MODE data
    const glModeData = this.solanaClient.encodeGLModeData(response);
    
    // Wrap in a message envelope
    const messageJson = JSON.stringify({
      type: MessageType.TRANSACTION_RESPONSE,
      payload: glModeData,
      timestamp: Date.now()
    });
    
    // Send via GL MODE
    return this.gibberlink.sendMessage(messageJson);
  }
  
  /**
   * Add a message listener
   */
  public addMessageListener(listener: (event: SecureMessageEvent) => void): () => void {
    this.messageListeners.push(listener);
    
    // Return function to remove the listener
    return () => {
      const index = this.messageListeners.indexOf(listener);
      if (index !== -1) {
        this.messageListeners.splice(index, 1);
      }
    };
  }
  
  /**
   * Handle incoming GL MODE messages
   */
  private handleIncomingMessage(message: { message: string, source: string }): void {
    if (message.source === 'self') {
      // Ignore messages from self
      return;
    }
    
    try {
      // Parse the message JSON
      const parsed = JSON.parse(message.message);
      
      if (!parsed.type || !parsed.payload) {
        console.warn('Received invalid message format');
        return;
      }
      
      // Process based on message type
      switch (parsed.type) {
        case MessageType.TEXT:
          this.handleSecureTextMessage(parsed);
          break;
          
        case MessageType.TRANSACTION_REQUEST:
          this.handleTransactionRequest(parsed);
          break;
          
        case MessageType.TRANSACTION_RESPONSE:
          this.handleTransactionResponse(parsed);
          break;
          
        case MessageType.DIRECTORY_QUERY:
        case MessageType.DIRECTORY_RESPONSE:
          // Handle directory queries/responses
          this.notifyListeners({
            type: parsed.type,
            sender: parsed.payload.sender,
            content: parsed.payload,
            timestamp: parsed.timestamp
          });
          break;
          
        default:
          console.warn(`Unknown message type: ${parsed.type}`);
          break;
      }
    } catch (error) {
      console.error('Error processing incoming message:', error);
    }
  }
  
  /**
   * Handle secure text messages
   */
  private handleSecureTextMessage(message: any): void {
    const secureMessage: SecureMessage = message.payload;
    
    if (!this.identity) {
      console.warn('Cannot process secure message without an agent identity');
      return;
    }
    
    // Verify the message is intended for this agent
    if (secureMessage.recipient !== this.identity.id) {
      console.warn('Received message intended for another agent');
      return;
    }
    
    // Verify the signature
    if (!this.verifyMessageSignature(secureMessage)) {
      console.error('Invalid message signature');
      return;
    }
    
    // Decrypt the message
    const decryptedContent = this.decryptMessage(
      secureMessage.encryptedContent,
      secureMessage.encryptionParams
    );
    
    // Notify listeners
    this.notifyListeners({
      type: MessageType.TEXT,
      sender: secureMessage.sender,
      content: decryptedContent,
      timestamp: message.timestamp
    });
  }
  
  /**
   * Handle transaction requests
   */
  private handleTransactionRequest(message: any): void {
    if (!this.solanaClient) {
      console.warn('Cannot process transaction request without a Solana client');
      return;
    }
    
    // Decode GL MODE data
    const request = this.solanaClient.decodeGLModeData(message.payload) as TransactionRequest;
    if (!request) {
      console.error('Invalid transaction request data');
      return;
    }
    
    // Notify listeners
    this.notifyListeners({
      type: MessageType.TRANSACTION_REQUEST,
      sender: request.header.sourceAgent,
      content: request,
      timestamp: message.timestamp
    });
  }
  
  /**
   * Handle transaction responses
   */
  private handleTransactionResponse(message: any): void {
    if (!this.solanaClient) {
      console.warn('Cannot process transaction response without a Solana client');
      return;
    }
    
    // Decode GL MODE data
    const response = this.solanaClient.decodeGLModeData(message.payload) as TransactionResponse;
    if (!response) {
      console.error('Invalid transaction response data');
      return;
    }
    
    // Notify listeners
    this.notifyListeners({
      type: MessageType.TRANSACTION_RESPONSE,
      sender: message.payload.sender || 'unknown',
      content: response,
      timestamp: message.timestamp
    });
  }
  
  /**
   * Encrypt a message
   */
  private encryptMessage(content: string): { encryptedContent: string, encryptionParams: EncryptionParams } {
    // In a real implementation, this would use asymmetric encryption with the recipient's public key
    // For simplicity, we'll use symmetric encryption with a random key
    
    // Generate a random key and IV
    const key = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);
    
    // Encrypt the content
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(content, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    // In a real implementation, the key would be encrypted with the recipient's public key
    // For now, we'll include it in plain text (which would be insecure in production)
    return {
      encryptedContent: encrypted,
      encryptionParams: {
        algorithm: 'AES-GCM',
        keyLength: 256,
        iv: iv.toString('base64')
      }
    };
  }
  
  /**
   * Decrypt a message
   */
  private decryptMessage(encryptedContent: string, params: EncryptionParams): string {
    // In a real implementation, this would use the agent's private key to decrypt the symmetric key
    // For simplicity, we'll use a fixed key (which would be insecure in production)
    
    try {
      // Generate the same key (in production, this would be decrypted)
      const key = crypto.randomBytes(32);
      const iv = Buffer.from(params.iv, 'base64');
      
      // Decrypt the content
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      let decrypted = decipher.update(encryptedContent, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Failed to decrypt message:', error);
      return '[Decryption failed]';
    }
  }
  
  /**
   * Sign a message
   */
  private signMessage(content: string): string {
    // In a real implementation, this would sign with the agent's private key
    return crypto
      .createHmac('sha256', 'mock-private-key')
      .update(content)
      .digest('hex');
  }
  
  /**
   * Verify a message signature
   */
  private verifyMessageSignature(message: SecureMessage): boolean {
    // In a real implementation, this would verify with the sender's public key
    const expectedSignature = crypto
      .createHmac('sha256', 'mock-private-key')
      .update(message.encryptedContent)
      .digest('hex');
      
    return message.signature === expectedSignature;
  }
  
  /**
   * Notify all message listeners
   */
  private notifyListeners(event: SecureMessageEvent): void {
    this.messageListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in message listener:', error);
      }
    });
  }
} 