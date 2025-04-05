import {
  ClientConfig,
  Modality,
  S3lMessageHeaders,
  S3lJsonMessage,
  S3lJsonResponse
} from '../solana/types';
import * as web3 from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { EventEmitter } from 'events';
import crypto from 'crypto';

/**
 * S3lClient handles client-side functionality for the S3L protocol
 */
export class S3lClient extends EventEmitter {
  private cfg: ClientConfig;
  private connection: web3.Connection;
  private keypair: web3.Keypair;
  private isConnected: boolean = false;
  private currentHost: string | null = null;
  private client: any = null; // Will be a TCP client or audio handler based on modality

  // Success and failure callbacks for connection
  private onSuccessCallback: (() => void) | null = null;
  private onFailureCallback: ((error: Error) => void) | null = null;

  constructor(config: ClientConfig) {
    super();
    
    // Validate required config fields
    if (!config.cluster || !config.privateKey) {
      throw new Error('Missing required configuration parameters');
    }
    
    this.cfg = {
      ...config,
      modality: config.modality || Modality.TCP // Default to TCP if not specified
    };
    
    // Initialize Solana connection
    this.connection = new web3.Connection(this.cfg.cluster);
    
    // Create keypair from private key
    const privateKeyBytes = bs58.decode(this.cfg.privateKey);
    this.keypair = web3.Keypair.fromSecretKey(privateKeyBytes);
  }
  
  /**
   * Connect to a host
   */
  public connect(host: string, phoneNumber?: string): S3lClient {
    this.currentHost = host;
    
    // Initialize client based on modality
    if (this.cfg.modality === Modality.TCP) {
      this.initTcpClient(host);
    } else if (this.cfg.modality === Modality.VOICE) {
      this.initVoiceClient();
    }
    
    // Start connection process
    this.performConnection(host, phoneNumber);
    
    return this;
  }
  
  /**
   * Set success callback
   */
  public onSuccess(callback: () => void): S3lClient {
    this.onSuccessCallback = callback;
    return this;
  }
  
  /**
   * Set failure callback
   */
  public onFailure(callback: (error: Error) => void): S3lClient {
    this.onFailureCallback = callback;
    return this;
  }
  
  /**
   * Send a message to the connected host
   */
  public async send(message: string | web3.Transaction): Promise<any> {
    if (!this.isConnected) {
      throw new Error('Not connected to a host');
    }
    
    if (!this.currentHost) {
      throw new Error('No host specified');
    }
    
    // Get current block height
    const blockHeight = await this.getBlockHeight();
    
    // Check if it's a text message or transaction
    if (typeof message === 'string') {
      return this.sendTextMessage(message, blockHeight);
    } else {
      return this.sendTransaction(message, blockHeight);
    }
  }
  
  /**
   * Close the connection
   */
  public async close(): Promise<void> {
    if (!this.isConnected) {
      return;
    }
    
    if (this.client) {
      // Close client based on modality
      if (this.cfg.modality === Modality.TCP) {
        // TCP client close
        if (this.client.close) {
          this.client.close();
        }
      } else if (this.cfg.modality === Modality.VOICE) {
        // Voice/audio client close
      }
    }
    
    this.isConnected = false;
    this.currentHost = null;
    this.emit('disconnected');
    console.log('S3L client disconnected');
  }
  
  /**
   * Initialize a TCP client
   */
  private initTcpClient(host: string): void {
    // TCP client implementation would go here
    console.log(`Initializing TCP client for ${host}`);
    // Example: this.client = new TCPClient(host);
  }
  
  /**
   * Initialize a voice client
   */
  private initVoiceClient(): void {
    // Voice client implementation would go here
    console.log('Initializing voice client');
    // Example: this.client = new VoiceClient();
  }
  
  /**
   * Perform connection handshake
   */
  private async performConnection(host: string, phoneNumber?: string): Promise<void> {
    try {
      console.log(`Connecting to ${host}...`);
      
      // Create bootstrap message headers
      const headers: S3lMessageHeaders = {
        host,
        nonce: this.generateNonce(),
        publicKey: this.keypair.publicKey.toString()
      };
      
      if (phoneNumber) {
        headers.phone = phoneNumber;
      }
      
      // Create bootstrap message body
      const body = "GM";
      
      // Send GM message to initiate connection
      await this.sendJsonMessage(headers, body);
      
      // In a real implementation, we would wait for response
      // For now, assume connection is successful
      setTimeout(() => {
        this.isConnected = true;
        this.emit('connected', host);
        
        if (this.onSuccessCallback) {
          this.onSuccessCallback();
        }
      }, 1000);
    } catch (error) {
      console.error('Connection failed:', error);
      
      if (this.onFailureCallback) {
        this.onFailureCallback(error instanceof Error ? error : new Error(String(error)));
      }
      
      this.emit('error', error);
    }
  }
  
  /**
   * Send a text message
   */
  private async sendTextMessage(message: string, blockHeight: number): Promise<any> {
    if (!this.currentHost) {
      throw new Error('No host specified');
    }
    
    // Create message headers
    const headers: S3lMessageHeaders = {
      host: this.currentHost,
      nonce: this.generateNonce(),
      blockHeight,
      publicKey: this.keypair.publicKey.toString()
    };
    
    // Send message
    return new Promise((resolve, reject) => {
      this.sendJsonMessage(headers, message)
        .then(() => {
          // Resolve with a mock response for now
          // In a real implementation, we would wait for and return the actual response
          setTimeout(() => {
            resolve({ status: 'delivered', timestamp: Date.now() });
          }, 500);
        })
        .catch(reject);
    });
  }
  
  /**
   * Send a transaction
   */
  private async sendTransaction(transaction: web3.Transaction, blockHeight: number): Promise<any> {
    if (!this.currentHost) {
      throw new Error('No host specified');
    }
    
    // Set fee payer (sender)
    transaction.feePayer = this.keypair.publicKey;
    
    // Get recent blockhash if not already set
    if (!transaction.recentBlockhash) {
      try {
        const { blockhash } = await this.connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
      } catch (error) {
        console.error('Failed to get recent blockhash:', error);
        throw new Error('Failed to prepare transaction: could not get recent blockhash');
      }
    }
    
    // Partially sign the transaction with our key
    transaction.partialSign(this.keypair);
    
    // Serialize the partially signed transaction
    const serializedTx = transaction.serialize({ requireAllSignatures: false }).toString('base64');
    
    // Create transaction headers
    const headers: S3lMessageHeaders = {
      host: this.currentHost,
      nonce: this.generateNonce(),
      blockHeight,
      publicKey: this.keypair.publicKey.toString()
    };
    
    // Create transaction body as an object
    const body = {
      type: 'transaction',
      data: serializedTx
    };
    
    // Send transaction
    return new Promise((resolve, reject) => {
      this.sendJsonMessage(headers, body)
        .then(() => {
          // In a real implementation, we would wait for and process the response
          // For now, we'll simulate a response with a mock signature
          setTimeout(() => {
            // For demo, we generate a mock signature
            // In real implementation, this would be the actual transaction signature from the chain
            const mockSignature = bs58.encode(Buffer.from(crypto.randomBytes(64)));
            resolve({
              status: 'completed',
              signature: mockSignature
            });
          }, 1000);
        })
        .catch(reject);
    });
  }
  
  /**
   * Send a JSON formatted S3L message
   */
  private async sendJsonMessage(
    headers: S3lMessageHeaders,
    body: any
  ): Promise<void> {
    // Create the signature by signing the stringified body
    const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
    const signature = this.signMessage(bodyString);
    
    // Create JSON message
    const message: S3lJsonMessage = {
      sig: signature,
      headers,
      body
    };
    
    // Stringify the entire message
    const messageJson = JSON.stringify(message);
    
    // Send based on modality
    if (this.cfg.modality === Modality.TCP) {
      // TCP send implementation
      console.log(`Sending S3L JSON message to ${headers.host}`);
      console.log(messageJson); // For demo/debug purposes
    } else if (this.cfg.modality === Modality.VOICE) {
      // Voice/audio send implementation
      console.log(`Sending S3L voice JSON message`);
    }
  }
  
  /**
   * Sign a message with the client's private key
   */
  private signMessage(message: string): string {
    const messageBuffer = Buffer.from(message);
    const signature = nacl.sign.detached(
      messageBuffer,
      this.keypair.secretKey
    );
    return Buffer.from(signature).toString('base64');
  }
  
  /**
   * Generate a random nonce
   */
  private generateNonce(): string {
    return crypto.randomBytes(16).toString('hex');
  }
  
  /**
   * Get the current block height from Solana
   */
  private async getBlockHeight(): Promise<number> {
    try {
      return await this.connection.getSlot();
    } catch (error) {
      console.error('Error getting block height:', error);
      return 0;
    }
  }
} 