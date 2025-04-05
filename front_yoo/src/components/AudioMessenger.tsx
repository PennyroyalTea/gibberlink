'use client';

import { useState, useEffect, useRef } from 'react';
import { sendAudioMessage, audioMessageEmitter, startRecording, stopRecording, createAnalyserNode, getAnalyserNode, initAudio } from '@/utils/audioUtils';
// @ts-ignore
import AudioMotionAnalyzer from 'audiomotion-analyzer';

export default function AudioMessenger() {
  const [isRecording, setIsRecording] = useState(false);
  const [message, setMessage] = useState('');
  const [receivedMessages, setReceivedMessages] = useState<string[]>([]);
  const audioMotionRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const handleRecordingMessage = (text: string) => {
      console.log('Received message in component:', text);
      setReceivedMessages(prev => {
        console.log('Previous messages:', prev);
        const newMessages = [...prev, text];
        console.log('New messages:', newMessages);
        return newMessages;
      });
    };

    // 이벤트 리스너 등록
    audioMessageEmitter.on('recordingMessage', handleRecordingMessage);

    // 컴포넌트 언마운트 시 이벤트 리스너 제거
    return () => {
      audioMessageEmitter.off('recordingMessage', handleRecordingMessage);
    };
  }, []);

  // 오디오 시각화 초기화
  useEffect(() => {
    const initAudioVisualization = async () => {
      try {
        // 오디오 컨텍스트 초기화
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext();
        }
        await initAudio(audioContextRef.current);
        
        // 분석기 노드 생성
        createAnalyserNode(audioContextRef.current);
        const analyserNode = getAnalyserNode();
        if (!analyserNode) {
          console.error('Failed to create analyser node');
          return;
        }

        const container = document.getElementById('audioviz');
        if (!container) {
          console.error('Failed to find visualization container');
          return;
        }

        // AudioMotionAnalyzer 초기화
        audioMotionRef.current = new AudioMotionAnalyzer(container, {
          source: analyserNode,
          height: 3000,
          width: 2400,
          mode: 6, // Oscilloscope 모드
          fillAlpha: 0.7,
          lineWidth: 2,
          showScaleX: false,
          showScaleY: false,
          reflexRatio: 0.2,
          showBgColor: false,
          showPeaks: true,
          gradient: 'prism',
          smoothing: 0.7,
        });

        console.log('Audio visualization initialized');
      } catch (error) {
        console.error('Error initializing audio visualization:', error);
      }
    };

    initAudioVisualization();

    return () => {
      if (audioMotionRef.current) {
        try {
          audioMotionRef.current.destroy();
        } catch (error) {
          console.error('Error destroying AudioMotionAnalyzer:', error);
        }
        audioMotionRef.current = null;
      }
    };
  }, []);

  const handleSendMessage = async () => {
    if (message.trim()) {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      await sendAudioMessage(message, audioContextRef.current);
      setMessage('');
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      stopRecording();
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
    } else {
      try {
        // 마이크 권한 요청 및 스트림 획득
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        
        // 기존 AudioContext가 없으면 새로 생성
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext();
        }
        
        const source = audioContextRef.current.createMediaStreamSource(stream);
        
        // 분석기 노드에만 연결하고 destination에는 연결하지 않음
        const analyserNode = getAnalyserNode();
        if (analyserNode) {
          source.connect(analyserNode);
        }
        
        await startRecording(audioContextRef.current);
      } catch (error) {
        console.error('Error starting recording:', error);
        return;
      }
    }
    setIsRecording(!isRecording);
  };

  return (
    <div className="flex h-screen">
      {/* 왼쪽 - 오디오 시각화 */}
      <div className="w-1/3 flex items-center justify-center">
        <div id="audioviz" className="w-[2400px] h-[800px] flex items-center justify-center"></div>
      </div>

      {/* 오른쪽 - 메시지 및 녹음 컨트롤 */}
      <div className="w-2/3 flex items-center justify-center">
        <div className="w-full max-w-md p-4">
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="메시지를 입력하세요"
              className="flex-1 p-2 bg-gray-800 text-white border border-gray-700 rounded focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleSendMessage}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              전송
            </button>
          </div>

          <button
            onClick={toggleRecording}
            className={`w-full py-2 rounded ${
              isRecording ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
            } text-white transition-colors`}
          >
            {isRecording ? '녹음 중지' : '녹음 시작'}
          </button>

          <div className="mt-4">
            <h3 className="text-lg font-semibold mb-2 text-white">수신된 메시지:</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto bg-gray-900 p-4 rounded">
              {receivedMessages.length === 0 ? (
                <div className="text-gray-400 text-center">수신된 메시지가 없습니다.</div>
              ) : (
                receivedMessages.map((msg, index) => {
                  console.log('Rendering message:', msg); // 디버깅을 위한 로그
                  return (
                    <div key={index} className="p-2 bg-gray-800 text-white rounded border border-gray-700">
                      {msg}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 