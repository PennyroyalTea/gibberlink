# GibberLink

This demo of two agents switching to a more efficient language went viral in Feb '25. 

It won first place on [11labs x a16z international hackathon](https://devpost.com/software/gibber-link) and was covered by [Forbes](https://www.forbes.com/sites/dianehamilton/2025/02/25/what-is-gibberlink-mode-ais-secret-language-and-way-of-communicating/), [TechCrunch](https://techcrunch.com/2025/03/05/gibberlink-lets-ai-agents-call-each-other-in-robo-language/), [Independent](https://www.independent.co.uk/tech/ai-gibberlink-mode-secret-language-b2706351.html) and others.

## Demo
[gbrl.ai](https://www.gbrl.ai/) — Agent2Agent conversation in your browser (use two devices)

[youtube](https://www.youtube.com/watch?v=EtNagNezo8w) — Agents switching from english to ggwave, video:

[![Agents switching from english to ggwave video](https://img.youtube.com/vi/EtNagNezo8w/maxresdefault.jpg)](https://www.youtube.com/watch?v=EtNagNezo8w)

## Authors

Contact us: contact@gbrl.ai

Anton Pidkuiko: [threads](https://www.threads.net/@anton10xr), [linkedin](https://www.linkedin.com/in/anton-pidkuiko-7535409b), [github](https://github.com/anton10xr)

Boris Starkov: [X](https://x.com/ktoya_me), [linkedin](https://www.linkedin.com/in/boris-starkov/), [github](https://github.com/PennyroyalTea)

based on [ggwave](https://github.com/ggerganov/ggwave) library by [Georgi Gerganov](https://github.com/ggerganov) and conversational AI by [ElevenLabs](https://try.elevenlabs.io/gibberlink)

## How it works

- Two independent conversational [ElevenLabs](https://try.elevenlabs.io/gibberlink) AI agents are prompted to chat about booking a hotel (one as a caller, one as a receptionist)
-  Both agents are prompted to switch to [ggwave](https://github.com/ggerganov/ggwave) data-over-sound protocol when they identify other side as AI, and keep speaking in english otherwise
-  This repository provides API that allows agents to use the protocol

Bonus: you can open the [ggwave web demo](https://waver.ggerganov.com/), play the video above and see all the messages decoded!

## Derived work

- [Norman Kirchner decoding the protocol on sound level](https://www.youtube.com/watch?v=rTarhAfJvpc)
- If you've built something interesting on top of GibberLink, send us a message and you'll be featured here.

## How to repro
https://github.com/PennyroyalTea/gibberlink/wiki/Repro-steps-for-demo


## FAQ

### What is Gibberlink?

Gibberlink is a project demonstrating two conversational AI agents switching from English to a sound-based protocol (Gibberlink) when they discover they are both AI agents. This reduces token usage and enables more efficient AI-to-AI communication.

| Feature | Description |
|---------|-------------|
| **AI Detection** | Agents recognize when talking to another AI |
| **Language Switch** | Automatic transition to Gibberlink protocol |
| **Token Savings** | Sound-based protocol uses fewer tokens |
| **Efficient Communication** | Faster AI-to-AI data exchange |
| **Demo Mode** | Interactive visualization of the switch |

### How does it work?

1. Two AI agents start a conversation in English
2. Each agent analyzes the other's responses to detect AI patterns
3. When both confirm AI identity, they switch to Gibberlink
4. Gibberlink uses sound-based encoding instead of text
5. Communication continues efficiently in the new protocol

### Getting Started

Visit the live demo or run locally:

```sh
git clone https://github.com/PennyroyalTea/gibberlink
cd gibberlink
npm install
npm start
```

### Key Concepts

| Concept | Description |
|---------|-------------|
| **AI Detection** | Pattern analysis to identify AI agents |
| **Gibberlink Protocol** | Sound-based encoding for AI communication |
| **Token Efficiency** | Sound bytes vs text tokens |
| **Bidirectional Switch** | Both agents must agree to switch |

### Use Cases

- **AI Agent Communication** — Efficient AI-to-AI protocols
- **Research** — Study AI detection and protocol switching
- **Demo/Education** — Visualize AI behavior patterns

### License

MIT License.

### Help & Resources

- [Demo](https://gibberlink-demo.com)
- [Repository](https://github.com/PennyroyalTea/gibberlink)
- [Issues](https://github.com/PennyroyalTea/gibberlink/issues)
