'use client';

import React, { useState, useEffect, useRef } from 'react';
import { GibberLink } from 'gibberlink-sdk';
import AudioMotionAnalyzer from 'audiomotion-analyzer';
import Script from 'next/script';

// Solana 관련 import 활성화
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useConnection } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';

// Mocked Solana imports - 실제 구현 시 주석 해제
// import { useWallet } from '@solana/wallet-adapter-react';
// import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
// import { useConnection } from '@solana/wallet-adapter-react';
// import { LAMPORTS_PER_SOL } from '@solana/web3.js';

// SecureMessaging, SolanaClient 등의 타입 정의
interface TransactionPayload {
  amount: number;
  memo: string;
  reference: string;
}

interface TransactionResponse {
  status: string;
  signature?: string;
  error?: string;
}

interface MessageEvent {
  type: MessageType;
  sender: string;
  content: any;
}

enum MessageType {
  TEXT = 'text',
  TRANSACTION_REQUEST = 'transaction-request',
  TRANSACTION_RESPONSE = 'transaction-response'
}

interface SecureMessaging {
  start(): Promise<void>;
  stop(): Promise<void>;
  addMessageListener(callback: (event: MessageEvent) => void): void;
  sendSecureTextMessage(receiverId: string, message: string): Promise<boolean>;
  sendTransactionRequest(receiverId: string, payload: TransactionPayload): Promise<boolean>;
  sendTransactionResponse(receiverId: string, response: TransactionResponse): Promise<boolean>;
  setAgentIdentity(identity: any): void;
}

interface SolanaClient {
  sendTransaction(request: any): Promise<TransactionResponse>;
  setAgentIdentity(identity: any): void;
}

interface DirectoryService {
  serviceUrl: string;
}

// Mock agent identities for demo
const DEMO_AGENTS = {
  alice: {
    id: 'agent-alice',
    publicKey: 'fake-key-alice-12345',
    name: 'Alice (Agent A)',
    phoneNumber: '+1-555-123-4567'
  },
  bob: {
    id: 'agent-bob',
    publicKey: 'fake-key-bob-67890',
    name: 'Bob (Agent B)',
    phoneNumber: '+1-555-987-6543'
  }
};

// Directory service URL (mocked for demo)
const DIRECTORY_URL = 'https://mock-agent-directory.example.com/api';

export default function SecureTransactionDemo() {
  const [mounted, setMounted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<'alice' | 'bob'>('alice');
  const [targetAgent, setTargetAgent] = useState<'alice' | 'bob'>('bob');
  const [amount, setAmount] = useState<number>(0.01);
  const [memo, setMemo] = useState<string>('Test payment');
  const [status, setStatus] = useState<string>('Idle');
  const [logs, setLogs] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ggwaveLoaded, setGgwaveLoaded] = useState(false);
  
  // Solana wallet connection
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  
  const gibberlinkRef = useRef<GibberLink | null>(null);
  const secureMessagingRef = useRef<SecureMessaging | null>(null);
  const solanaClientRef = useRef<SolanaClient | null>(null);
  const directoryServiceRef = useRef<DirectoryService | null>(null);
  const audioMotionRef = useRef<AudioMotionAnalyzer | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  
  // Check if ggwave is loaded
  useEffect(() => {
    if (mounted) {
      const checkGgwaveLoaded = () => {
        if (window && (window as any).ggwave_factory) {
          setGgwaveLoaded(true);
          addLog('ggwave library loaded successfully');
        } else {
          setTimeout(checkGgwaveLoaded, 500);
        }
      };
      
      checkGgwaveLoaded();
    }
  }, [mounted]);
  
  // Fetch wallet balance when connected
  useEffect(() => {
    if (publicKey && connection) {
      const fetchBalance = async () => {
        try {
          const balance = await connection.getBalance(publicKey);
          setWalletBalance(balance / LAMPORTS_PER_SOL);
          addLog(`Wallet connected: ${publicKey.toString().slice(0, 6)}...${publicKey.toString().slice(-4)}`);
          addLog(`Balance: ${balance / LAMPORTS_PER_SOL} SOL`);
        } catch (error) {
          console.error('Error fetching balance:', error);
        }
      };
      
      fetchBalance();
      // Set up interval to refresh balance
      const intervalId = setInterval(fetchBalance, 20000);
      
      return () => clearInterval(intervalId);
    } else {
      setWalletBalance(null);
    }
  }, [publicKey, connection]);
  
  // 로그 자동 스크롤
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);
  
  // Add a log entry
  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };
  
  // Initialize the SDK components
  useEffect(() => {
    if (mounted && !gibberlinkRef.current && ggwaveLoaded) {
      try {
        // Initialize GibberLink
        gibberlinkRef.current = new GibberLink({ autoInit: true });
        
        // Initialize Directory Service
        directoryServiceRef.current = {
          serviceUrl: DIRECTORY_URL
        } as DirectoryService;
        
        // Initialize Solana Client with the selected agent identity
        solanaClientRef.current = {
          rpcEndpoint: 'https://api.devnet.solana.com',
          setAgentIdentity: (identity: any) => {
            console.log('Setting agent identity:', identity);
          },
          sendTransaction: async (request: any): Promise<TransactionResponse> => {
            // 실제 Solana wallet을 사용하여 트랜잭션 전송
            if (publicKey && connection && sendTransaction) {
              try {
                addLog('Creating transaction with Solana wallet...');
                
                // 요청에서 트랜잭션 정보 추출
                const { payload } = request;
                const receiverPublicKey = new PublicKey(DEMO_AGENTS[targetAgent].publicKey);
                
                // 트랜잭션 생성
                const transaction = new Transaction().add(
                  // SOL 전송 instruction 생성
                  SystemProgram.transfer({
                    fromPubkey: publicKey,
                    toPubkey: receiverPublicKey,
                    lamports: payload.amount,
                  })
                );
                
                // 블록해시 설정
                transaction.recentBlockhash = (await connection.getRecentBlockhash()).blockhash;
                transaction.feePayer = publicKey;
                
                // 트랜잭션 서명 및 전송
                const signature = await sendTransaction(transaction, connection);
                
                // 트랜잭션 확인
                await connection.confirmTransaction(signature, 'confirmed');
                
                addLog(`Transaction sent with signature: ${signature}`);
                
                return {
                  status: 'completed',
                  signature
                };
              } catch (error) {
                console.error('Error sending transaction:', error);
                return {
                  status: 'failed',
                  error: error instanceof Error ? error.message : String(error)
                };
              }
            } else {
              // 지갑 연결이 안 된 경우 
              addLog('Wallet not connected. Simulating transaction instead.');
              
              // 데모 모드에서는 트랜잭션 시뮬레이션
              return {
                status: 'completed',
                signature: 'demo-signature-' + Math.random().toString(36).substring(2, 10)
              };
            }
          }
        } as unknown as SolanaClient;
        
        // Initialize Secure Messaging layer
        secureMessagingRef.current = {
          gibberlink: gibberlinkRef.current,
          start: async () => {
            if (gibberlinkRef.current) {
              await gibberlinkRef.current.startListening();
              addLog('Secure messaging started');
            }
          },
          stop: async () => {
            if (gibberlinkRef.current) {
              await gibberlinkRef.current.stopListening();
              addLog('Secure messaging stopped');
            }
          },
          addMessageListener: (callback: (event: MessageEvent) => void) => {
            // Simplified message handling for demo
            if (gibberlinkRef.current) {
              // GibberLink의 메시지 이벤트 구독
              // 참고: 실제 SDK에서는 on 메서드를 구현해야 합니다.
              const messageHandler = (audioMessage: { message: string }) => {
                try {
                  const parsedMessage = JSON.parse(audioMessage.message);
                  callback({
                    type: parsedMessage.type || MessageType.TEXT,
                    sender: parsedMessage.sender || 'unknown',
                    content: parsedMessage.content
                  });
                } catch (error) {
                  console.error('Error parsing message:', error);
                  // Fallback to simple text message
                  callback({
                    type: MessageType.TEXT,
                    sender: 'unknown',
                    content: audioMessage.message
                  });
                }
              };
              
              // 여기서는 GibberLink의 이벤트 리스닝 기능을 사용한다고 가정합니다
              // 실제 SDK에서 on 메서드가 없다면 데모 모드로 전환합니다
              const hasOnMethod = typeof (gibberlinkRef.current as any).on === 'function';
              
              if (hasOnMethod) {
                // @ts-expect-error - SDK에서 on 메서드를 제공하는 경우
                gibberlinkRef.current.on('message', messageHandler);
              } else {
                // 대체 방법: 메시지 수신 데모
                // 5초마다 메시지 수신 시뮬레이션
                const intervalId = setInterval(() => {
                  if (Math.random() > 0.7 && isListening) {
                    const simulatedTypes = [MessageType.TEXT, MessageType.TRANSACTION_REQUEST];
                    const randomType = simulatedTypes[Math.floor(Math.random() * simulatedTypes.length)];
                    
                    if (randomType === MessageType.TEXT) {
                      callback({
                        type: MessageType.TEXT,
                        sender: DEMO_AGENTS[targetAgent].id,
                        content: `Hello from ${DEMO_AGENTS[targetAgent].name}!`
                      });
                    } else {
                      callback({
                        type: MessageType.TRANSACTION_REQUEST,
                        sender: DEMO_AGENTS[targetAgent].id,
                        content: {
                          payload: {
                            amount: 0.001 * 1_000_000_000,
                            memo: 'Demo payment request',
                            reference: `TXN-${Date.now()}`
                          },
                          recipient: DEMO_AGENTS[selectedAgent].id
                        }
                      });
                    }
                  }
                }, 5000);
                
                // 클린업 함수 설정
                (gibberlinkRef.current as any)._cleanupFunctions = 
                  (gibberlinkRef.current as any)._cleanupFunctions || [];
                (gibberlinkRef.current as any)._cleanupFunctions.push(() => clearInterval(intervalId));
              }
            }
          },
          sendSecureTextMessage: async (receiverId: string, message: string) => {
            if (gibberlinkRef.current) {
              const messageObj = {
                type: MessageType.TEXT,
                sender: DEMO_AGENTS[selectedAgent].id,
                content: message
              };
              
              return await gibberlinkRef.current.sendMessage(JSON.stringify(messageObj));
            }
            return false;
          },
          sendTransactionRequest: async (receiverId: string, payload: TransactionPayload) => {
            if (gibberlinkRef.current) {
              const messageObj = {
                type: MessageType.TRANSACTION_REQUEST,
                sender: DEMO_AGENTS[selectedAgent].id,
                content: {
                  payload,
                  recipient: receiverId
                }
              };
              
              return await gibberlinkRef.current.sendMessage(JSON.stringify(messageObj));
            }
            return false;
          },
          sendTransactionResponse: async (receiverId: string, response: TransactionResponse) => {
            if (gibberlinkRef.current) {
              const messageObj = {
                type: MessageType.TRANSACTION_RESPONSE,
                sender: DEMO_AGENTS[selectedAgent].id,
                content: response
              };
              
              return await gibberlinkRef.current.sendMessage(JSON.stringify(messageObj));
            }
            return false;
          },
          setAgentIdentity: (identity: any) => {
            console.log('Setting secure messaging identity:', identity);
          }
        } as unknown as SecureMessaging;
        
        addLog('SDK components initialized');
      } catch (error) {
        console.error('Error initializing SDK components:', error);
        addLog(`Error initializing: ${error}`);
      }
    }
    
    return () => {
      // Clean up resources when component unmounts
      if (gibberlinkRef.current && isListening) {
        gibberlinkRef.current.stopListening();
      }
      
      if (audioMotionRef.current) {
        audioMotionRef.current.destroy();
      }
    };
  }, [mounted, selectedAgent, ggwaveLoaded]);
  
  // Change agent identity when user switches roles
  useEffect(() => {
    if (solanaClientRef.current && directoryServiceRef.current && secureMessagingRef.current) {
      const agentIdentity = DEMO_AGENTS[selectedAgent];
      
      solanaClientRef.current.setAgentIdentity(agentIdentity);
      secureMessagingRef.current.setAgentIdentity(agentIdentity);
      
      addLog(`Switched to agent: ${agentIdentity.name} (${agentIdentity.id})`);
    }
  }, [selectedAgent]);
  
  // Initialize AudioMotion visualization
  useEffect(() => {
    if (mounted && isListening && gibberlinkRef.current) {
      try {
        const analyserNode = gibberlinkRef.current.createAnalyserNode();
        
        if (analyserNode) {
          const container = document.getElementById('secure-audio-viz');
          if (container && !audioMotionRef.current) {
            audioMotionRef.current = new AudioMotionAnalyzer(container, {
              source: analyserNode,
              height: 200,
              width: 400,
              mode: 6, // Oscilloscope mode
              fillAlpha: 0.7,
              lineWidth: 2,
              showScaleX: false,
              showScaleY: false,
              reflexRatio: 0.2,
              showBgColor: false,
              showPeaks: true,
              gradient: 'rainbow',
              smoothing: 0.7,
            });
          }
        }
      } catch (error) {
        console.error('Error initializing audio visualization:', error);
        addLog(`Error with audio visualization: ${error}`);
      }
    }
    
    return () => {
      if (audioMotionRef.current) {
        audioMotionRef.current.destroy();
        audioMotionRef.current = null;
      }
    };
  }, [mounted, isListening]);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Start or stop secure messaging
  const toggleListening = async () => {
    if (isListening) {
      if (secureMessagingRef.current) {
        await secureMessagingRef.current.stop();
        setIsListening(false);
        setStatus('Stopped');
        addLog('Stopped secure messaging');
      }
    } else {
      if (secureMessagingRef.current) {
        try {
          await secureMessagingRef.current.start();
          setIsListening(true);
          setStatus('Listening');
          addLog('Started secure messaging');
        } catch (error) {
          addLog(`Error starting secure messaging: ${error}`);
        }
      }
    }
  };
  
  // Send a secure text message
  const sendSecureMessage = async () => {
    if (!secureMessagingRef.current || !isListening) {
      addLog('Secure messaging not started');
      return;
    }
    
    setIsProcessing(true);
    try {
      const receiverId = DEMO_AGENTS[targetAgent].id;
      const message = `Hello from ${DEMO_AGENTS[selectedAgent].name}!`;
      
      addLog(`Sending secure message to ${DEMO_AGENTS[targetAgent].name}...`);
      const success = await secureMessagingRef.current.sendSecureTextMessage(receiverId, message);
      
      if (success) {
        addLog('Message sent successfully');
      } else {
        addLog('Failed to send message');
      }
    } catch (error) {
      addLog(`Error sending message: ${error}`);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Send a transaction request
  const sendTransactionRequest = async () => {
    if (!secureMessagingRef.current || !isListening) {
      addLog('Secure messaging not started');
      return;
    }
    
    setIsProcessing(true);
    try {
      const receiverId = DEMO_AGENTS[targetAgent].id;
      
      // Convert SOL to lamports (1 SOL = 1,000,000,000 lamports)
      const lamports = Math.floor(amount * 1_000_000_000);
      
      const payload: TransactionPayload = {
        amount: lamports,
        memo: memo || 'Payment',
        reference: `TXN-${Date.now()}`
      };
      
      addLog(`Sending transaction request to ${DEMO_AGENTS[targetAgent].name}...`);
      addLog(`Amount: ${amount} SOL (${lamports} lamports)`);
      addLog(`Memo: ${payload.memo}`);
      
      setStatus('Sending transaction request...');
      const success = await secureMessagingRef.current.sendTransactionRequest(receiverId, payload);
      
      if (success) {
        addLog('Transaction request sent successfully');
        setStatus('Transaction request sent');
      } else {
        addLog('Failed to send transaction request');
        setStatus('Failed to send request');
      }
    } catch (error) {
      addLog(`Error sending transaction request: ${error}`);
      setStatus('Error');
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Clear the logs
  const clearLogs = () => {
    setLogs([]);
  };
  
  if (!mounted) {
    return null;
  }
  
  return (
    <>
      <Script src="/ggwave/ggwave.js" strategy="afterInteractive" />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="bg-gradient-to-r from-purple-800 to-blue-700 rounded-lg p-6 mb-8 shadow-2xl text-center">
          <h1 className="text-3xl font-extrabold mb-2 text-white">Secure Transaction Demo</h1>
          <p className="text-blue-100">Safe audio-based communication with Solana blockchain integration</p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Agent Configuration Panel */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700">
            <div className="bg-gradient-to-r from-indigo-600 to-blue-500 p-4">
              <h2 className="text-xl font-bold text-white">Agent Configuration</h2>
            </div>
            
            <div className="p-6">
              {/* Solana Wallet Connection */}
              <div className="mb-6 border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-yellow-50 dark:bg-yellow-900/20">
                <h3 className="text-lg font-medium mb-3 text-gray-800 dark:text-gray-200">Solana Wallet</h3>
                
                <div className="flex flex-col space-y-2">
                  <WalletMultiButton className="!bg-indigo-600 hover:!bg-indigo-700 !rounded-lg" />
                  
                  {publicKey ? (
                    <div className="mt-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Wallet:</span>
                        <span className="font-medium text-indigo-600 dark:text-indigo-400">
                          {publicKey.toString().slice(0, 6)}...{publicKey.toString().slice(-4)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Balance:</span>
                        <span className="font-medium text-indigo-600 dark:text-indigo-400">
                          {walletBalance?.toFixed(4) || '0'} SOL
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                      Connect your Solana wallet to use real transactions
                    </p>
                  )}
                </div>
              </div>
              
              {/* Agent Selection */}
              <div className="mb-6">
                <label className="block font-medium mb-2 text-gray-800 dark:text-gray-200">Your Agent Identity</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    className={`flex items-center p-4 rounded-lg border-2 transition-all ${
                      selectedAgent === 'alice' 
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' 
                        : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                    } ${isListening ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    onClick={() => !isListening && setSelectedAgent('alice')}
                    disabled={isListening}
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-400 flex items-center justify-center text-white font-bold mr-3">
                      A
                    </div>
                    <div>
                      <div className="font-semibold">Alice</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Agent A</div>
                    </div>
                  </button>
                  
                  <button
                    className={`flex items-center p-4 rounded-lg border-2 transition-all ${
                      selectedAgent === 'bob' 
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/30' 
                        : 'border-gray-200 dark:border-gray-700 hover:border-green-300'
                    } ${isListening ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    onClick={() => !isListening && setSelectedAgent('bob')}
                    disabled={isListening}
                  >
                    <div className="w-10 h-10 rounded-full bg-green-400 flex items-center justify-center text-white font-bold mr-3">
                      B
                    </div>
                    <div>
                      <div className="font-semibold">Bob</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Agent B</div>
                    </div>
                  </button>
                </div>
              </div>
              
              {/* Target Agent */}
              <div className="mb-6">
                <label className="block font-medium mb-2 text-gray-800 dark:text-gray-200">Target Agent</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    className={`flex items-center p-4 rounded-lg border-2 transition-all ${
                      targetAgent === 'alice' 
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' 
                        : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                    } ${selectedAgent === 'alice' || isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    onClick={() => !(selectedAgent === 'alice' || isProcessing) && setTargetAgent('alice')}
                    disabled={selectedAgent === 'alice' || isProcessing}
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-400 flex items-center justify-center text-white font-bold mr-3">
                      A
                    </div>
                    <div>
                      <div className="font-semibold">Alice</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Agent A</div>
                    </div>
                  </button>
                  
                  <button
                    className={`flex items-center p-4 rounded-lg border-2 transition-all ${
                      targetAgent === 'bob' 
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/30' 
                        : 'border-gray-200 dark:border-gray-700 hover:border-green-300'
                    } ${selectedAgent === 'bob' || isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    onClick={() => !(selectedAgent === 'bob' || isProcessing) && setTargetAgent('bob')}
                    disabled={selectedAgent === 'bob' || isProcessing}
                  >
                    <div className="w-10 h-10 rounded-full bg-green-400 flex items-center justify-center text-white font-bold mr-3">
                      B
                    </div>
                    <div>
                      <div className="font-semibold">Bob</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Agent B</div>
                    </div>
                  </button>
                </div>
              </div>
              
              {/* Connection Controls */}
              <div className="mb-6">
                <button
                  onClick={toggleListening}
                  className={`w-full font-medium py-3 px-4 rounded-lg transition-all ${
                    isListening 
                      ? 'bg-red-500 hover:bg-red-600 text-white' 
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                  disabled={isProcessing}
                >
                  {isListening ? '⏹️ Stop Secure Messaging' : '▶️ Start Secure Messaging'}
                </button>
              </div>
              
              {/* Status Indicator */}
              <div className="flex items-center mb-6 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <div className={`w-4 h-4 rounded-full mr-3 ${
                  status === 'Listening' ? 'bg-green-500 animate-pulse' :
                  status.includes('Processing') ? 'bg-yellow-500 animate-pulse' :
                  status.includes('Error') ? 'bg-red-500' :
                  status.includes('completed') || status.includes('success') ? 'bg-green-500' :
                  'bg-gray-300 dark:bg-gray-600'
                }`}></div>
                <p className="text-sm font-medium">
                  Status: <span className="font-semibold">{status}</span>
                </p>
              </div>
              
              {/* Audio Visualization */}
              <div>
                <h3 className="text-lg font-medium mb-2 text-gray-800 dark:text-gray-200">Audio Visualization</h3>
                {isListening ? (
                  <div id="secure-audio-viz" className="h-[200px] w-full rounded-lg overflow-hidden bg-black"></div>
                ) : (
                  <div className="h-[200px] w-full rounded-lg flex items-center justify-center bg-gray-100 dark:bg-gray-700/50 text-gray-400 dark:text-gray-500">
                    <div className="text-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                      <p>Start secure messaging to see visualization</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Transactions Panel */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700">
            <div className="bg-gradient-to-r from-purple-600 to-indigo-500 p-4">
              <h2 className="text-xl font-bold text-white">Transaction Actions</h2>
            </div>
            
            <div className="p-6">
              {/* Message Button */}
              <div className="mb-6">
                <button
                  onClick={sendSecureMessage}
                  className={`w-full py-3 px-4 rounded-lg transition-all ${
                    !isListening || isProcessing 
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
                      : 'bg-indigo-500 hover:bg-indigo-600 text-white'
                  }`}
                  disabled={!isListening || isProcessing}
                >
                  ✉️ Send Secure Text Message
                </button>
              </div>
              
              {/* Payment Form */}
              <div className="p-5 border border-gray-200 dark:border-gray-700 rounded-lg mb-6 bg-gray-50 dark:bg-gray-700/30">
                <h3 className="text-lg font-medium mb-4 text-gray-800 dark:text-gray-200">Create Payment Request</h3>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Payment Amount (SOL)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">◎</span>
                    </div>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                      min="0.000001"
                      step="0.01"
                      className="pl-9 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      disabled={!isListening || isProcessing}
                    />
                  </div>
                </div>
                
                <div className="mb-5">
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Memo</label>
                  <input
                    type="text"
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="Payment for services"
                    disabled={!isListening || isProcessing}
                  />
                </div>
                
                <button
                  onClick={sendTransactionRequest}
                  className={`w-full py-3 px-4 rounded-lg transition-all ${
                    !isListening || isProcessing || amount <= 0
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : 'bg-purple-500 hover:bg-purple-600 text-white'
                  }`}
                  disabled={!isListening || isProcessing || amount <= 0}
                >
                  💸 Send Transaction Request
                </button>
              </div>
              
              {/* Event Log */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">Event Log</h3>
                  <button
                    onClick={clearLogs}
                    className="text-xs py-1 px-2 rounded bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors"
                  >
                    Clear
                  </button>
                </div>
                
                <div className="h-[225px] overflow-y-auto rounded-lg bg-gray-50 dark:bg-gray-900 p-3 border border-gray-200 dark:border-gray-700 font-mono text-xs">
                  {logs.length > 0 ? (
                    logs.map((log, index) => (
                      <div key={index} className="mb-1 pb-1 border-b border-gray-100 dark:border-gray-800 text-gray-700 dark:text-gray-300">
                        {log}
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
                      No events logged yet
                    </div>
                  )}
                  <div ref={logsEndRef} />
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Instructions Panel */}
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700">
          <div className="bg-gradient-to-r from-cyan-600 to-teal-500 p-4">
            <h2 className="text-xl font-bold text-white">How to Use This Demo</h2>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <div className="text-blue-600 dark:text-blue-400 font-bold mb-2 text-lg">1. Setup</div>
                <p className="text-gray-700 dark:text-gray-300 text-sm">
                  Choose your agent identity (Alice or Bob) and select the target agent. Then click &ldquo;Start Secure Messaging&rdquo; to activate GL MODE communication.
                </p>
              </div>
              
              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                <div className="text-purple-600 dark:text-purple-400 font-bold mb-2 text-lg">2. Communicate</div>
                <p className="text-gray-700 dark:text-gray-300 text-sm">
                  Send a secure text message to test the connection. The audio visualization will show the sound patterns being used for communication.
                </p>
              </div>
              
              <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-lg">
                <div className="text-emerald-600 dark:text-emerald-400 font-bold mb-2 text-lg">3. Transact</div>
                <p className="text-gray-700 dark:text-gray-300 text-sm">
                  Enter an amount and memo for a transaction request. The recipient will automatically approve the transaction for demo purposes.
                </p>
              </div>
            </div>
            
            <div className="mt-6 bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded-lg text-yellow-700 dark:text-yellow-300 text-sm">
              <strong>Note:</strong> For best results, test with two browser windows or devices. Select different agent identities in each window and ensure your speakers and microphone are working correctly.
            </div>
            
            {/* Solana Wallet Integration */}
            <div className="mt-6 bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-lg">
              <h3 className="font-semibold mb-2 text-lg text-indigo-700 dark:text-indigo-300">Solana Wallet Integration</h3>
              <p className="text-gray-700 dark:text-gray-300 text-sm mb-3">
                In a fully implemented version, this demo would connect to your Solana wallet on devnet:
              </p>
              <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li>Connect your wallet using the Wallet Connect button</li>
                <li>The app will fetch your SOL balance from Devnet</li>
                <li>When sending transactions, they would be signed by your wallet and verified on the blockchain</li>
                <li>Transaction history would be viewable on Solana Explorer</li>
              </ol>
              <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">
                For this demo, wallet interactions are simulated to showcase the secure messaging capabilities.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 