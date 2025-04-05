# S3L (Secure Solana Link) SDK

S3L은 Solana 블록체인을 활용하여 인증 및 결제 기능을 제공하는 안전한 메시징 프로토콜입니다.
이 프로토콜은 암호화 서명을 통한 안전한 메시징을 제공하여 메시지 신뢰성을 보장하고 Solana 트랜잭션 처리를 가능하게 합니다.

## 주요 기능

- 암호화 서명을 통한 안전한 메시징
- Solana 키페어를 통한 인증
- 안전한 채널을 통한 트랜잭션 처리
- 다양한 통신 모달리티 지원 (TCP, Voice)
- 연결 부트스트래핑 및 핸드셰이크
- 메시지 및 트랜잭션 처리

## 프로토콜 명세 (JSON 기반)

S3L 메시지는 다음과 같은 JSON 형식을 따릅니다:

### 클라이언트 메시지

```json
{
  "sig": "서명_문자열",
  "headers": {
    "host": "example.com",
    "phone": "1234567890",
    "nonce": "abc123",
    "blockHeight": 12345,
    "publicKey": "base64로_인코딩된_공개키"
  },
  "body": "메시지_내용 또는 객체"
}
```

### 서버 응답

```json
{
  "sig": "서명_문자열",
  "status": "ok", // 또는 "error"
  "headers": {
    "nonce": "abc123",
    "blockHeight": 12345,
    "publicKey": "base64로_인코딩된_공개키"
  },
  "body": "응답_내용 또는 객체"
}
```

### 메시지 타입

1. **연결 부트스트래핑 (GM)**:
   - 클라이언트: `{ "body": "GM" }`
   - 서버 응답: `{ "body": "GM {클라이언트_공개키}" }`

2. **일반 텍스트 메시지**:
   - 클라이언트: `{ "body": "메시지 내용" }`
   - 서버 응답: `{ "body": "Message received" }`

3. **트랜잭션 메시지**:
   - 클라이언트: `{ "body": { "type": "transaction", "data": "직렬화된_트랜잭션" } }`
   - 서버 응답: `{ "body": { "type": "transaction_signature", "signature": "트랜잭션_서명" } }`

## 실제 Solana 트랜잭션 처리 구현

S3L SDK는 실제 Solana 트랜잭션 흐름을 다음과 같이 구현합니다:

1. **클라이언트 (부분 서명)**:
   - 클라이언트는 Solana 트랜잭션을 생성합니다
   - 자신의 키페어로 트랜잭션에 부분 서명합니다
   - 부분 서명된 트랜잭션을 직렬화하여 JSON 객체로 감싸 전송합니다
   - 트랜잭션 데이터는 "body" 필드 내의 "data" 속성에 저장됩니다

2. **호스트 (최종 서명 및 제출)**:
   - 호스트는 부분 서명된 트랜잭션을 역직렬화합니다
   - 트랜잭션의 유효성을 검증합니다
   - 자신의 키페어로 트랜잭션에 추가 서명합니다
   - 완전히 서명된 트랜잭션을 Solana 네트워크에 제출합니다
   - 트랜잭션 서명을 JSON 응답으로 전송합니다

이 구현을 통해 양쪽 당사자 모두 트랜잭션을 검증하고 승인할 수 있으며, 실제 블록체인 상에서 트랜잭션이 실행됩니다.

## 사용법

### 호스트 설정

```typescript
import { S3lHost, HostConfig, Modality } from 'gibberlink-sdk';

// 호스트 구성
const hostConfig: HostConfig = {
  cluster: "https://api.mainnet-beta.solana.com",
  host: "example.com",
  phoneNumber: "1234567890",
  privateKey: "your-solana-private-key",
  modality: Modality.TCP
};

// 호스트 생성 및 초기화
const server = new S3lHost(hostConfig);

// 메시지 핸들러 등록
server.register({
  // 메시지 핸들러
  messageHandler: async (message, sender) => {
    console.log(`Received message from ${sender}: ${message}`);
    // 메시지 처리
  },

  // 트랜잭션 핸들러
  txHandler: async (transaction) => {
    console.log('Processing transaction:', transaction);
    
    // 트랜잭션 검증
    // 호스트 키페어로 서명
    transaction.partialSign(hostKeypair);
    
    // Solana 네트워크에 제출
    const signature = await connection.sendRawTransaction(transaction.serialize());
    
    // 트랜잭션 서명 반환
    return signature;
  }
});

// 초기화 및 시작
await server.init();
await server.run();
```

### 클라이언트 설정

```typescript
import { S3lClient, ClientConfig, Modality } from 'gibberlink-sdk';
import { Transaction, SystemProgram } from '@solana/web3.js';

// 클라이언트 구성
const clientConfig: ClientConfig = {
  cluster: "https://api.mainnet-beta.solana.com",
  privateKey: "your-solana-private-key",
  modality: Modality.TCP
};

// 클라이언트 생성
const client = new S3lClient(clientConfig);

// 호스트에 연결
client
  .connect("example.com")
  .onSuccess(async () => {
    console.log("Connected successfully");
    
    // 트랜잭션 생성 및 전송 예제
    // SOL 전송 트랜잭션 생성
    const transaction = new Transaction();
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: senderPublicKey,
        toPubkey: recipientPublicKey,
        lamports: 100000 // 0.0001 SOL
      })
    );
    
    // 트랜잭션 전송 (자동으로 부분 서명됨)
    const result = await client.send(transaction);
    console.log("Transaction result:", result);
  })
  .onFailure((error) => {
    console.error("Connection failed:", error);
  });

// 메시지 전송
const response = await client.send("Hello world!");
console.log("Message response:", response);

// 완료 후 연결 종료
await client.close();
```

## 테스트 실행

SDK에는 실제 트랜잭션 처리를 테스트하는 스크립트가 포함되어 있습니다:

```bash
# S3L 테스트 실행
yarn test:s3l
```

이 테스트는 다음을 수행합니다:
1. 클라이언트와 호스트 키페어 생성
2. Solana devnet에서 테스트 계정에 SOL 에어드롭
3. 호스트 서버 시작
4. 클라이언트 연결 (JSON 프로토콜)
5. 텍스트 메시지 전송 (JSON 형식)
6. SOL 전송 트랜잭션 생성 및 처리 (JSON 형식)
7. 트랜잭션 결과 및 잔액 변경 확인

## 라이센스

MIT 