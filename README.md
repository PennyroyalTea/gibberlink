# GibberLink

GibberLink is a platform for audio-based message encoding and communication, designed to enable efficient communication between AI agents.

## Project Structure

This project is set up as a monorepo with the following components:

- `packages/gibberlink-sdk`: The core SDK that handles audio-based message encoding using GL MODE
- `hackathon_demo`: A Next.js application that demonstrates the SDK's capabilities

## Key Features

- Audio-based message encoding and decoding
- GL MODE for efficient communication
- Solana blockchain integration (placeholder)
- Real-time audio visualization
- Integration with 11labs Voice AI

## Getting Started

### Installing Dependencies

```bash
# Install SDK dependencies
cd packages/gibberlink-sdk
yarn install

# Build the SDK
yarn build

# Install frontend demo dependencies
cd ../../hackathon_demo
yarn install
```

### Running the Demo

```bash
cd hackathon_demo
yarn dev
```

Then open http://localhost:3003 in your browser.

## SDK Usage

The GibberLink SDK can be imported and used in any JavaScript/TypeScript project:

```typescript
import { GibberLink } from 'gibberlink-sdk';

// Create a new GibberLink instance
const gibberlink = new GibberLink({ autoInit: true });

// Listen for messages
gibberlink.onMessage((message) => {
  console.log(`Received message: ${message.message}`);
});

// Start listening for audio messages
await gibberlink.startListening();

// Send a message
await gibberlink.sendMessage('Hello, world!');
```

## License

MIT
