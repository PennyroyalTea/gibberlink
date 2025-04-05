# GibberLink SDK

The GibberLink SDK provides tools for secure message encoding and transmission. It includes audio encoding capabilities and now features the S3L (Secure Solana Link) protocol.

## Features

- Audio message encoding and transmission using GL MODE
- Secure messaging with S3L protocol
- Solana blockchain integration for authentication and payments
- Support for different communication modalities (TCP, audio)
- Transaction processing and signature verification

## S3L Protocol

S3L (Secure Solana Link) is a secure messaging protocol that leverages Solana blockchain for authentication and payment capabilities. The protocol provides secure messaging with cryptographic signatures, ensuring message authenticity and enabling Solana transaction processing.

### Key Features of S3L

- Secure messaging with cryptographic signatures
- Authentication through Solana keypairs
- Transaction processing over secure channels
- Multiple communication modalities (TCP, Voice)
- Connection bootstrapping and handshake
- Message and transaction handling

## Installation

```bash
npm install gibberlink-sdk
# or
yarn add gibberlink-sdk
```

## Usage

### S3L Host (Server) Setup

```typescript
import { S3lHost, HostConfig, Modality } from 'gibberlink-sdk';

// Configure the host
const hostConfig: HostConfig = {
  cluster: "https://api.mainnet-beta.solana.com",
  host: "example.com",
  phoneNumber: "1234567890",
  privateKey: "your-solana-private-key",
  modality: Modality.TCP
};

// Create and initialize host
const server = new S3lHost(hostConfig);

// Register message handlers
server.register({
  // Message handler
  messageHandler: async (message, sender) => {
    console.log(`Received message from ${sender}: ${message}`);
    // Process message
  },

  // Transaction handler
  txHandler: async (transaction) => {
    console.log('Processing transaction:', transaction);
    // Sign and process transaction
    return "transaction-signature";
  }
});

// Initialize and start
await server.init();
await server.run();
```

### S3L Client Setup

```typescript
import { S3lClient, ClientConfig, Modality } from 'gibberlink-sdk';
import { Transaction } from '@solana/web3.js';

// Configure the client
const clientConfig: ClientConfig = {
  cluster: "https://api.mainnet-beta.solana.com",
  privateKey: "your-solana-private-key",
  modality: Modality.TCP
};

// Create client
const client = new S3lClient(clientConfig);

// Connect to host
client
  .connect("example.com")
  .onSuccess(() => {
    console.log("Connected successfully");
    // Perform operations after successful connection
  })
  .onFailure((error) => {
    console.error("Connection failed:", error);
  });

// Send a message
const response = await client.send("Hello world!");
console.log("Message response:", response);

// Send a transaction
const transaction = new Transaction();
// ... configure transaction with instructions

const txResult = await client.send(transaction);
console.log("Transaction result:", txResult);

// Close connection when done
await client.close();
```

## Running Tests

```bash
# Run the S3L test
yarn test:s3l

# Run all tests
yarn test
```

## Documentation

For more detailed documentation, see the following:

- [S3L Protocol Documentation](src/s3l/README.md)
- [API Reference](docs/api.md)

## License

MIT 