import {
  HostConfig,
  MessageHandler,
  S3lMessageHeaders,
  TransactionHandler,
  Modality,
  S3lJsonMessage,
  S3lJsonResponse
} from '../solana/types';
import * as web3 from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import crypto from 'crypto';
import { EventEmitter } from 'events';

/**
 * S3lHost handles server-side functionality for the S3L protocol
 */
export class S3lHost extends EventEmitter {
  private cfg: HostConfig;
  private connection: web3.Connection;
  private keypair: web3.Keypair;
  private messageHandler: MessageHandler | null = null;
  private txHandler: TransactionHandler | null = null;
  private server: any = null; // Will be a TCP server or audio stream based on modality
  private clients: Map<string, { publicKey: string }> = new Map();
  private isRunning: boolean = false;

  constructor(config: HostConfig) {
    super();
    
    // Validate required config fields
    if (!config.cluster || !config.phoneNumber || !config.host || !config.privateKey) {
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
   * Initialize the host
   */
  public async init(): Promise<void> {
    try {
      console.log(`Initializing S3L host for ${this.cfg.host}`);
      
      // Verify connection to Solana
      const version = await this.connection.getVersion();
      console.log(`Connected to Solana network version: ${version['solana-core']}`);
      
      // Verify account exists
      const balance = await this.connection.getBalance(this.keypair.publicKey);
      console.log(`Account balance: ${balance / web3.LAMPORTS_PER_SOL} SOL`);
      
      // Initialize server based on modality
      if (this.cfg.modality === Modality.TCP) {
        // TCP initialization would happen here
        console.log('TCP server initialization');
      } else if (this.cfg.modality === Modality.VOICE) {
        // Voice/audio initialization would happen here
        console.log('Voice modality initialization');
      }
      
      this.emit('initialized');
    } catch (error) {
      console.error('Failed to initialize S3L host:', error);
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * Register message and transaction handlers
   */
  public register(handlers: {
    messageHandler?: MessageHandler;
    txHandler?: TransactionHandler;
  }): S3lHost {
    if (handlers.messageHandler) {
      this.messageHandler = handlers.messageHandler;
    }
    
    if (handlers.txHandler) {
      this.txHandler = handlers.txHandler;
    }
    
    return this;
  }
  
  /**
   * Start the server and listen for incoming connections
   */
  public async run(): Promise<void> {
    if (this.isRunning) {
      console.warn('S3L host is already running');
      return;
    }
    
    try {
      if (this.cfg.modality === Modality.TCP) {
        await this.startTcpServer();
      } else if (this.cfg.modality === Modality.VOICE) {
        await this.startVoiceServer();
      }
      
      this.isRunning = true;
      this.emit('running');
      console.log(`S3L host is running for ${this.cfg.host}`);
    } catch (error) {
      console.error('Failed to start S3L host:', error);
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * Stop the server
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }
    
    if (this.server) {
      // Stop server based on modality
      if (this.cfg.modality === Modality.TCP) {
        // TCP server shutdown
        if (this.server.close) {
          this.server.close();
        }
      } else if (this.cfg.modality === Modality.VOICE) {
        // Voice/audio shutdown
      }
    }
    
    this.isRunning = false;
    this.emit('stopped');
    console.log('S3L host stopped');
  }
  
  /**
   * Process an incoming S3L message
   */
  private async processIncomingMessage(data: string, source: string): Promise<void> {
    try {
      // Parse JSON message
      const message = JSON.parse(data) as S3lJsonMessage;
      
      // Verify the message structure
      if (!message.sig || !message.headers || message.body === undefined) {
        console.warn('Invalid S3L JSON message format, ignoring');
        return;
      }
      
      // Verify signature
      const bodyString = typeof message.body === 'string' ? message.body : JSON.stringify(message.body);
      const isValid = this.verifySignature(
        message.headers.publicKey,
        bodyString,
        message.sig
      );
      
      if (!isValid) {
        console.error('Invalid message signature, rejecting');
        return;
      }
      
      // Handle bootstrap message (GM)
      if (typeof message.body === 'string' && message.body.trim() === 'GM') {
        await this.handleBootstrap(message.headers, source);
        return;
      }
      
      // Handle transaction message
      if (typeof message.body === 'object' && message.body.type === 'transaction') {
        await this.handleTransaction(message.headers, message.body.data, source);
        return;
      }
      
      // Handle regular message
      await this.handleMessage(message.headers, message.body, source);
    } catch (error) {
      console.error('Error processing incoming JSON message:', error);
    }
  }
  
  /**
   * Handle bootstrap (GM) message
   */
  private async handleBootstrap(headers: S3lMessageHeaders, source: string): Promise<void> {
    // Record client
    this.clients.set(source, {
      publicKey: headers.publicKey
    });
    
    // Create GM response headers
    const responseHeaders: S3lMessageHeaders = {
      nonce: headers.nonce,
      publicKey: this.keypair.publicKey.toString()
    };
    
    // GM response body
    const body = `GM ${headers.publicKey}`;
    
    // Send response
    await this.sendJsonResponse(responseHeaders, body, source, 'ok');
    
    this.emit('client_connected', source, headers);
  }
  
  /**
   * Handle regular message
   */
  private async handleMessage(headers: S3lMessageHeaders, message: any, source: string): Promise<void> {
    const messageString = typeof message === 'string' ? message : JSON.stringify(message);
    
    // Call message handler if registered
    if (this.messageHandler) {
      try {
        await this.messageHandler(messageString, source);
      } catch (error) {
        console.error('Error in message handler:', error);
      }
    }
    
    // Create response headers
    const responseHeaders: S3lMessageHeaders = {
      nonce: headers.nonce,
      blockHeight: headers.blockHeight,
      publicKey: this.keypair.publicKey.toString()
    };
    
    // Send acknowledgment response
    await this.sendJsonResponse(responseHeaders, 'Message received', source, 'ok');
    
    this.emit('message_received', messageString, source, headers);
  }
  
  /**
   * Handle transaction message
   */
  private async handleTransaction(headers: S3lMessageHeaders, serializedTransaction: string, source: string): Promise<void> {
    let signature: string = '';
    
    try {
      // Deserialize the transaction from base64 string
      const serializedTxBuffer = Buffer.from(serializedTransaction, 'base64');
      const recoveredTx = web3.Transaction.from(serializedTxBuffer);
      
      // Verify the transaction
      // Here you would implement your business rules to check if this transaction is valid
      // For example: check recipient, amount, etc.
      
      console.log('Recovered transaction:', {
        feePayer: recoveredTx.feePayer?.toString(),
        instructions: recoveredTx.instructions.length,
        recentBlockhash: recoveredTx.recentBlockhash
      });
      
      if (this.txHandler) {
        try {
          // Use the provided transaction handler or sign and submit by default
          signature = await this.txHandler(recoveredTx);
        } catch (error) {
          console.error('Error in transaction handler:', error);
          
          // Send error response
          const errorHeaders: S3lMessageHeaders = {
            nonce: headers.nonce,
            blockHeight: headers.blockHeight,
            publicKey: this.keypair.publicKey.toString()
          };
          
          const errorBody = { 
            error: 'Transaction processing failed',
            details: error instanceof Error ? error.message : String(error)
          };
          
          await this.sendJsonResponse(errorHeaders, errorBody, source, 'error');
          return;
        }
      } else {
        // No custom handler, so we'll sign and submit ourselves
        // Add our signature to the transaction
        recoveredTx.partialSign(this.keypair);
        
        try {
          // Submit the fully signed transaction to the Solana network
          signature = await this.connection.sendRawTransaction(
            recoveredTx.serialize()
          );
          
          console.log('Transaction submitted to Solana network, signature:', signature);
          
          // Optionally wait for confirmation
          // const confirmation = await this.connection.confirmTransaction(signature);
          // console.log('Transaction confirmed:', confirmation);
        } catch (error) {
          console.error('Error submitting transaction to Solana:', error);
          throw error;
        }
      }
      
      // Create response headers
      const responseHeaders: S3lMessageHeaders = {
        nonce: headers.nonce,
        blockHeight: headers.blockHeight,
        publicKey: this.keypair.publicKey.toString()
      };
      
      // Create response body with transaction signature
      const responseBody = {
        type: 'transaction_signature',
        signature
      };
      
      // Send transaction response with signature
      await this.sendJsonResponse(responseHeaders, responseBody, source, 'ok');
      
      this.emit('transaction_processed', recoveredTx, signature, source, headers);
    } catch (error) {
      console.error('Error processing transaction:', error);
      
      // Send error response
      const errorHeaders: S3lMessageHeaders = {
        nonce: headers.nonce,
        blockHeight: headers.blockHeight,
        publicKey: this.keypair.publicKey.toString()
      };
      
      const errorBody = {
        error: 'Transaction processing failed',
        details: error instanceof Error ? error.message : String(error)
      };
      
      await this.sendJsonResponse(errorHeaders, errorBody, source, 'error');
    }
  }
  
  /**
   * Send a JSON response
   */
  private async sendJsonResponse(
    headers: S3lMessageHeaders, 
    body: any, 
    destination: string, 
    status: 'ok' | 'error' = 'ok'
  ): Promise<void> {
    try {
      // Create body string for signature
      const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
      
      // Sign the body
      const signature = this.signMessage(bodyString);
      
      // Create JSON response
      const response: S3lJsonResponse = {
        sig: signature,
        status,
        headers,
        body
      };
      
      // Stringify the entire response
      const responseJson = JSON.stringify(response);
      
      // Send based on modality
      if (this.cfg.modality === Modality.TCP) {
        // TCP send implementation
        console.log(`Sending S3L JSON response to ${destination}`);
        console.log(responseJson);
      } else if (this.cfg.modality === Modality.VOICE) {
        // Voice/audio send implementation
        console.log(`Sending S3L JSON voice response`);
      }
    } catch (error) {
      console.error('Error sending JSON response:', error);
      throw error;
    }
  }
  
  /**
   * Sign a message with the host's private key
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
   * Start a TCP server for TCP modality
   */
  private async startTcpServer(): Promise<void> {
    // TCP server implementation would go here
    console.log('TCP server started');
  }
  
  /**
   * Start a voice server for VOICE modality
   */
  private async startVoiceServer(): Promise<void> {
    // Voice server implementation would go here
    console.log('Voice server started');
  }
  
  /**
   * Verify the signature of a message
   */
  private verifySignature(publicKeyStr: string, data: string, signatureStr: string): boolean {
    try {
      const publicKey = new Uint8Array(Buffer.from(publicKeyStr, 'base64'));
      const message = Buffer.from(data);
      const signature = new Uint8Array(Buffer.from(signatureStr, 'base64'));
      
      return nacl.sign.detached.verify(
        message,
        signature,
        publicKey
      );
    } catch (error) {
      console.error('Error verifying signature:', error);
      return false;
    }
  }
} 