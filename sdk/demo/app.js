// DOM 요소
const hostInput = document.getElementById('host');
const modalitySelect = document.getElementById('modality');
const connectButton = document.getElementById('connect');
const disconnectButton = document.getElementById('disconnect');
const messageInput = document.getElementById('message');
const sendButton = document.getElementById('send');
const logElement = document.getElementById('log');

// 클라이언트 인스턴스
let client = null;

// 로그 출력 함수
function log(message, isError = false) {
    const entry = document.createElement('div');
    entry.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
    
    if (isError) {
        entry.style.color = 'red';
    }
    
    logElement.appendChild(entry);
    logElement.scrollTop = logElement.scrollHeight;
}

// 키페어 생성 함수
function generateKeyPair() {
    // 솔라나 웹 SDK의 Keypair.generate() 사용
    return solanaWeb3.Keypair.generate();
}

// UI 상태 업데이트 함수
function updateUIState(isConnected) {
    connectButton.disabled = isConnected;
    disconnectButton.disabled = !isConnected;
    messageInput.disabled = !isConnected;
    sendButton.disabled = !isConnected;
    modalitySelect.disabled = isConnected;
}

// 연결 버튼 클릭 이벤트
connectButton.addEventListener('click', async () => {
    const host = hostInput.value.trim();
    if (!host) {
        log('호스트 주소를 입력해주세요.', true);
        return;
    }
    
    try {
        // 클라이언트 설정
        const keyPair = generateKeyPair();
        const modality = modalitySelect.value === 'VOICE' 
            ? salSDK.Modality.VOICE 
            : salSDK.Modality.TCP;
        
        const clientConfig = {
            cluster: 'https://api.devnet.solana.com',
            keyPair: keyPair,
            modality: modality
        };
        
        log(`클라이언트 설정: 모달리티=${modalitySelect.value}, 키페어=${keyPair.publicKey.toString().substring(0, 8)}...`);
        
        // 클라이언트 생성
        client = new salSDK.SalClient(clientConfig);
        
        // 이벤트 핸들러 등록
        client
            .onSuccess(() => {
                log(`${host}에 성공적으로 연결되었습니다.`);
                updateUIState(true);
            })
            .onFailure((error) => {
                log(`연결 실패: ${error.message}`, true);
                client = null;
                updateUIState(false);
            });
        
        // 연결 시도
        log(`${host}에 연결 시도 중...`);
        client.connect(host);
    } catch (error) {
        log(`오류 발생: ${error.message}`, true);
    }
});

// 연결 해제 버튼 클릭 이벤트
disconnectButton.addEventListener('click', async () => {
    if (!client) {
        return;
    }
    
    try {
        await client.close();
        log('연결이 종료되었습니다.');
        client = null;
        updateUIState(false);
    } catch (error) {
        log(`연결 종료 오류: ${error.message}`, true);
    }
});

// 메시지 전송 버튼 클릭 이벤트
sendButton.addEventListener('click', async () => {
    if (!client) {
        return;
    }
    
    const message = messageInput.value.trim();
    if (!message) {
        log('전송할 메시지를 입력해주세요.', true);
        return;
    }
    
    try {
        log(`메시지 전송 중: "${message}"`);
        await client.send(message);
        log(`메시지가 성공적으로 전송되었습니다.`);
        messageInput.value = '';
    } catch (error) {
        log(`메시지 전송 오류: ${error.message}`, true);
    }
});

// 페이지 로드 시 초기화
window.addEventListener('load', () => {
    log('Gibberlink SDK 데모가 준비되었습니다.');
    
    // 솔라나 Web3.js SDK와 SalSDK가 로드되었는지 확인
    if (!window.solanaWeb3) {
        log('Solana Web3.js SDK를 로드할 수 없습니다.', true);
        return;
    }
    
    if (!window.salSDK) {
        log('SAL SDK를 로드할 수 없습니다. sal-sdk.js 파일이 올바르게 빌드되었는지 확인하세요.', true);
        return;
    }
    
    log('SDK가 성공적으로 로드되었습니다.');
}); 