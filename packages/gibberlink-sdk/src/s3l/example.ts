import { S3lHost, S3lClient, HostConfig, ClientConfig, Modality } from './index';
import * as web3 from '@solana/web3.js';
import * as token from '@solana/spl-token';
import bs58 from 'bs58';
import nacl from 'tweetnacl';

/**
 * Example script demonstrating real-world usage of the S3L SDK
 * 
 * This example shows:
 * 1. Setting up a secure host server
 * 2. Setting up a client that connects to the host
 * 3. Sending secure messages
 * 4. Creating and signing Solana transactions
 */

// Server application example
async function runServer() {
  console.log('Starting S3L Host Server');
  
  // Load environment variables (in a real app, you would use dotenv or similar)
  const HOST_PRIVATE_KEY = process.env.HOST_PRIVATE_KEY || '';
  const HOST_DOMAIN = process.env.HOST_DOMAIN || 'server.example.com';
  const HOST_PHONE = process.env.HOST_PHONE || '1234567890';
  
  if (!HOST_PRIVATE_KEY) {
    console.error('Missing HOST_PRIVATE_KEY environment variable');
    process.exit(1);
  }
  
  // Configure host
  const hostConfig: HostConfig = {
    cluster: 'https://api.mainnet-beta.solana.com',
    host: HOST_DOMAIN,
    phoneNumber: HOST_PHONE,
    privateKey: HOST_PRIVATE_KEY,
    modality: Modality.TCP
  };
  
  // Create host instance
  const host = new S3lHost(hostConfig);
  
  // Set up message handlers
  host.register({
    // Handle text messages
    messageHandler: async (message, sender) => {
      console.log(`Message from ${sender}: ${message}`);
      
      // You can perform any business logic here based on the message
      // Example: Store messages in a database, trigger notifications, etc.
      
      return;
    },
    
    // Handle transaction signing requests
    txHandler: async (txPayload) => {
      console.log('Transaction request received:', txPayload);
      
      // Parse transaction payload
      try {
        // In a real implementation, you would verify the transaction first
        // Example: Check if it meets your business rules, has proper permissions, etc.
        
        // For this example, we'll assume it's a valid transaction and sign it
        const keypair = web3.Keypair.fromSecretKey(
          bs58.decode(HOST_PRIVATE_KEY)
        );
        
        // Sign the transaction (this is simplified)
        const signature = bs58.encode(
          nacl.sign.detached(
            bs58.decode(txPayload.serializedTransaction),
            keypair.secretKey
          )
        );
        
        console.log('Transaction signed:', signature);
        return signature;
      } catch (error) {
        console.error('Error signing transaction:', error);
        throw new Error('Transaction signing failed');
      }
    }
  });
  
  try {
    // Initialize and start the host
    await host.init();
    await host.run();
    
    console.log(`S3L Host server running on ${HOST_DOMAIN}`);
    
    // Keep the server running
    process.on('SIGINT', async () => {
      console.log('Shutting down S3L Host server...');
      await host.stop();
      process.exit(0);
    });
  } catch (error) {
    console.error('Error starting S3L Host server:', error);
    process.exit(1);
  }
}

// Client application example
async function runClient() {
  console.log('Starting S3L Client');
  
  // Load environment variables (in a real app, you would use dotenv or similar)
  const CLIENT_PRIVATE_KEY = process.env.CLIENT_PRIVATE_KEY || '';
  const TARGET_HOST = process.env.TARGET_HOST || 'server.example.com';
  
  if (!CLIENT_PRIVATE_KEY) {
    console.error('Missing CLIENT_PRIVATE_KEY environment variable');
    process.exit(1);
  }
  
  // Configure client
  const clientConfig: ClientConfig = {
    cluster: 'https://api.mainnet-beta.solana.com',
    privateKey: CLIENT_PRIVATE_KEY,
    modality: Modality.TCP
  };
  
  // Create client instance
  const client = new S3lClient(clientConfig);
  
  try {
    // Connect to host
    console.log(`Connecting to ${TARGET_HOST}...`);
    
    client
      .connect(TARGET_HOST)
      .onSuccess(async () => {
        console.log(`Connected successfully to ${TARGET_HOST}`);
        
        // Example 1: Send a text message
        await sendTextMessage(client);
        
        // Example 2: Send a token transfer transaction
        await sendTokenTransfer(client);
        
        // Close the connection when done
        await client.close();
        console.log('Connection closed');
      })
      .onFailure((error) => {
        console.error('Connection failed:', error);
        process.exit(1);
      });
  } catch (error) {
    console.error('Error running S3L client:', error);
    process.exit(1);
  }
}

// Example: Send a text message
async function sendTextMessage(client: S3lClient) {
  try {
    console.log('Sending secure message...');
    
    const message = 'Hello from S3L client! This message is cryptographically signed using Solana keypair.';
    const response = await client.send(message);
    
    console.log('Message sent successfully:', response);
  } catch (error) {
    console.error('Error sending message:', error);
  }
}

// Example: Create and send a token transfer transaction
async function sendTokenTransfer(client: S3lClient) {
  try {
    console.log('Creating token transfer transaction...');
    
    // Set up Solana connection
    const connection = new web3.Connection('https://api.mainnet-beta.solana.com');
    
    // Get the sender's keypair
    const senderKeypair = web3.Keypair.fromSecretKey(
      bs58.decode(process.env.CLIENT_PRIVATE_KEY || '')
    );
    
    // Recipient address
    const recipientAddress = new web3.PublicKey(
      process.env.RECIPIENT_ADDRESS || 'DxP1tcFehyXsEUXVzzY9QwZG6BELGMQrWkdQwzxYVUk8'
    );
    
    // For this example, we'll use USDC token
    const usdcMint = new web3.PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    
    // Create transaction
    const transaction = new web3.Transaction();
    
    // Get sender's token account
    const senderTokenAccount = await token.getAssociatedTokenAddress(
      usdcMint,
      senderKeypair.publicKey
    );
    
    // Get recipient's token account (create if doesn't exist)
    const recipientTokenAccount = await token.getAssociatedTokenAddress(
      usdcMint,
      recipientAddress
    );
    
    // Check if recipient's token account exists
    const recipientAccountInfo = await connection.getAccountInfo(recipientTokenAccount);
    
    // If recipient token account doesn't exist, create it
    if (!recipientAccountInfo) {
      console.log("Creating recipient's token account...");
      transaction.add(
        token.createAssociatedTokenAccountInstruction(
          senderKeypair.publicKey,
          recipientTokenAccount,
          recipientAddress,
          usdcMint
        )
      );
    }
    
    // Amount to send (0.1 USDC = 100000 because USDC has 6 decimals)
    const amount = 100000;
    
    // Add token transfer instruction
    transaction.add(
      token.createTransferInstruction(
        senderTokenAccount,
        recipientTokenAccount,
        senderKeypair.publicKey,
        amount
      )
    );
    
    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Set fee payer
    transaction.feePayer = senderKeypair.publicKey;
    
    console.log('Sending transaction via S3L for remote signing...');
    
    // Send transaction via S3L and get signature
    const result = await client.send(transaction);
    
    console.log('Transaction processed:', result);
    console.log('Signature:', result.signature);
    
    if (result.status === 'completed') {
      console.log('Token transfer successful!');
    } else {
      console.error('Token transfer failed:', result.error);
    }
  } catch (error) {
    console.error('Error creating or sending transaction:', error);
  }
}

// Run the appropriate example based on arguments
if (process.argv[2] === 'server') {
  runServer().catch(console.error);
} else if (process.argv[2] === 'client') {
  runClient().catch(console.error);
} else {
  console.log('Please specify either "server" or "client"');
  console.log('Example: node example.js server');
  console.log('Example: node example.js client');
} 