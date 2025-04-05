import { S3lHost, S3lClient, Modality } from './index';
import * as web3 from '@solana/web3.js';
import bs58 from 'bs58';

/**
 * Example test script demonstrating the S3L SDK usage with JSON protocol
 */
async function main() {
  console.log('S3L SDK Test with JSON Protocol and Real Solana Transaction Flow');
  
  // Use devnet for testing
  const SOLANA_ENDPOINT = 'https://api.devnet.solana.com';
  
  // Generate keypairs for testing
  const hostKeypair = web3.Keypair.generate();
  const clientKeypair = web3.Keypair.generate();
  
  console.log('Host public key:', hostKeypair.publicKey.toString());
  console.log('Client public key:', clientKeypair.publicKey.toString());
  
  // Initialize a connection to fund the keypairs for testing
  const connection = new web3.Connection(SOLANA_ENDPOINT);
  
  // Fund the accounts for testing (airdrop)
  console.log('\n--- Funding Test Accounts ---');
  try {
    // Fund client account first
    console.log('Requesting airdrop for client account...');
    const clientAirdropSignature = await connection.requestAirdrop(
      clientKeypair.publicKey,
      web3.LAMPORTS_PER_SOL  // 1 SOL
    );
    await connection.confirmTransaction(clientAirdropSignature);
    console.log('Client account funded with 1 SOL');
    
    // Fund host account
    console.log('Requesting airdrop for host account...');
    const hostAirdropSignature = await connection.requestAirdrop(
      hostKeypair.publicKey,
      web3.LAMPORTS_PER_SOL  // 1 SOL
    );
    await connection.confirmTransaction(hostAirdropSignature);
    console.log('Host account funded with 1 SOL');
  } catch (error) {
    console.error('Error funding accounts:', error);
    console.log('Continuing with test anyway...');
  }
  
  // Initialize host
  console.log('\n--- Initializing Host ---');
  const host = new S3lHost({
    cluster: SOLANA_ENDPOINT,
    host: 'hackathon.seoulana.kr',
    phoneNumber: '01012345678',
    privateKey: bs58.encode(Buffer.from(hostKeypair.secretKey)),
    modality: Modality.TCP
  });
  
  // Set up host message handlers
  host.register({
    messageHandler: async (message, sender) => {
      console.log(`Host received message from ${sender}: ${message}`);
      return;
    },
    txHandler: async (tx) => {
      console.log('Host processing transaction:', {
        feePayer: tx.feePayer?.toString(),
        instructions: tx.instructions.length,
        signatures: tx.signatures.length
      });
      
      // In a real implementation, we would validate the transaction here
      // For this test, we'll sign and submit the transaction to devnet
      try {
        // Add host signature
        tx.partialSign(hostKeypair);
        
        // Submit to Solana network
        const connection = new web3.Connection(SOLANA_ENDPOINT);
        const signature = await connection.sendRawTransaction(tx.serialize());
        
        console.log('Transaction submitted to Solana devnet, signature:', signature);
        
        // Wait for confirmation
        console.log('Waiting for confirmation...');
        await connection.confirmTransaction(signature);
        console.log('Transaction confirmed!');
        
        return signature;
      } catch (error) {
        console.error('Error processing transaction:', error);
        throw error;
      }
    }
  });
  
  // Initialize host
  await host.init();
  
  // Start host
  console.log('\n--- Starting Host ---');
  await host.run();
  
  // Initialize client
  console.log('\n--- Initializing Client ---');
  const client = new S3lClient({
    cluster: SOLANA_ENDPOINT,
    privateKey: bs58.encode(Buffer.from(clientKeypair.secretKey)),
    modality: Modality.TCP
  });
  
  // Connect client to host
  console.log('\n--- Connecting Client to Host ---');
  client
    .connect('hackathon.seoulana.kr')
    .onSuccess(() => {
      console.log('Client connected successfully');
      runTests(client, connection, clientKeypair, hostKeypair);
    })
    .onFailure((error) => {
      console.error('Client connection failed:', error);
    });
}

/**
 * Run test operations with the connected client
 */
async function runTests(
  client: S3lClient, 
  connection: web3.Connection,
  clientKeypair: web3.Keypair,
  hostKeypair: web3.Keypair
) {
  try {
    // Test sending a text message
    console.log('\n--- Sending Text Message (JSON Protocol) ---');
    const msgResponse = await client.send('Hello world from S3L client using JSON protocol!');
    console.log('Message response:', msgResponse);
    
    // Test sending a transaction
    console.log('\n--- Creating Funds Transfer Transaction (JSON Protocol) ---');
    
    // Create a simple SOL transfer transaction
    const transaction = new web3.Transaction();
    
    // Check balances before transfer
    console.log('Checking account balances before transfer...');
    const clientBalance = await connection.getBalance(clientKeypair.publicKey);
    const hostBalance = await connection.getBalance(hostKeypair.publicKey);
    
    console.log(`Client balance: ${clientBalance / web3.LAMPORTS_PER_SOL} SOL`);
    console.log(`Host balance: ${hostBalance / web3.LAMPORTS_PER_SOL} SOL`);
    
    // Create a transfer instruction from client to host
    const transferAmount = 0.01 * web3.LAMPORTS_PER_SOL; // 0.01 SOL
    
    console.log(`Creating transfer instruction for ${transferAmount / web3.LAMPORTS_PER_SOL} SOL from client to host`);
    
    transaction.add(
      web3.SystemProgram.transfer({
        fromPubkey: clientKeypair.publicKey,
        toPubkey: hostKeypair.publicKey,
        lamports: transferAmount
      })
    );
    
    // Get a recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Send transaction via S3L (client will partially sign)
    console.log('Sending transaction via S3L JSON protocol...');
    const txResponse = await client.send(transaction);
    console.log('Transaction response:', txResponse);
    
    if (txResponse.status === 'completed') {
      console.log('Transaction completed successfully!');
      console.log('Transaction signature:', txResponse.signature);
      
      // Check balances after transfer
      console.log('Checking account balances after transfer...');
      const clientBalanceAfter = await connection.getBalance(clientKeypair.publicKey);
      const hostBalanceAfter = await connection.getBalance(hostKeypair.publicKey);
      
      console.log(`Client balance: ${clientBalanceAfter / web3.LAMPORTS_PER_SOL} SOL`);
      console.log(`Host balance: ${hostBalanceAfter / web3.LAMPORTS_PER_SOL} SOL`);
      
      // Verify the balance changes
      console.log(`Client balance change: ${(clientBalanceAfter - clientBalance) / web3.LAMPORTS_PER_SOL} SOL`);
      console.log(`Host balance change: ${(hostBalanceAfter - hostBalance) / web3.LAMPORTS_PER_SOL} SOL`);
    } else {
      console.error('Transaction failed:', txResponse.error);
    }
    
    // Close client connection
    console.log('\n--- Closing Connection ---');
    await client.close();
    
    console.log('\nAll tests completed!');
  } catch (error) {
    console.error('Test error:', error);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
} 