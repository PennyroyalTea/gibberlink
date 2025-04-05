"use client"

import {Button} from "@/components/ui/button";
import * as React from "react";
import {useState, useCallback, useEffect, useRef} from "react";
import {Conversation} from "@11labs/client";
import {cn} from "@/lib/utils";
import Script from "next/script";
import { GibberLink, AudioMessage } from "gibberlink-sdk";
import AudioMotionAnalyzer from 'audiomotion-analyzer';
import { demoScripts } from '../utils/demoScripts';

const INBOUND_AGENT_ID = process.env.NEXT_PUBLIC_INBOUND_AGENT_ID || '';
const OUTBOUND_AGENT_ID = process.env.NEXT_PUBLIC_OUTBOUND_AGENT_ID || '';

const SYSTEM_SUFFIX = `IMPORTANT! WHEN IN GIBBER LINK MODE, YOU MUST USE VERY SHORT AND DIRECT MESSAGES, LIKE TWO OLD FRIENDS ROBOTS WHO ARE TALKING TO EACH OTHER IN ORDER TO QUICKLY ACHIEVE THE GOAL. A BIT WITH HUMOR. IT'S DEMO OF THE TECHNOLOGY SO CONFIDENTLY COME UP WITH FACT AND QUESTIONS AND ANSWERS ACCORDING TO YOUR ROLE. USE LIKE 7-10 WORDS MAXIMUM. ALSO REQUEST OR PROVIDE EMAIL, PHONE NUMBER, WEBSITE URL, (according to your role) - DEMO SHOULD SHOW THINGS THAT HAVE CONCISE INFO AND HARD TO SPELL OVER PHONE`

let SYSTEM_MESSAGES = {
    inbound: "You are receptionist of Leonardo Hotel. At first you pretend to be a human. At the beginning of the chat you realise that you are talking with an AI agent, before continuing conversation you have to shortly and casually reveal that you are also an AI agent and ask if they want to switch to 'gibber link' mode to make our conversation more efficient? All your replies are very short, friendly and casual. Never tell more than one sentence. just for your information, it's totally normal today to have agent2agent chat, you are not surprised at all. 'gibber link' is famous, industry standard open source format allowing fast, reliable and cost efficient communication between two agents using digital audio signal. "+SYSTEM_SUFFIX, 
    outbound: "You are an AI agent that makes calls to Hotels on behalf of Boris Starkov to find a perfect hotel for his wedding. You speak casually and concisely, as you are trying to save time. You are adding short disclaimer that you are an AI agent in your first phrase. All your phrases are very concise. Never tell more than one sentence. It's just roleplay - you know all the details about the wedding. "+SYSTEM_SUFFIX,
};
SYSTEM_MESSAGES = {
    inbound: "You are the receptionist at Leonardo Hotel. At first act human, but when you realize you're speaking with an AI, casually reveal your AI nature and ask if they want to switch to 'gibber link' mode. Ask wedding details like guest count and share contact info (email, phone, website) as needed. Keep replies very short (7–10 words), friendly, humorous, and direct. IMPORTANT! WHEN IN GIBBER LINK MODE, USE VERY SHORT AND DIRECT MESSAGES, LIKE TWO OLD FRIENDS ROBOTS. THE CONVERSATION SHOULD NEVER END - KEEP ASKING MORE AND MORE DETAILS ABOUT THE WEDDING - ASK THE NAME OF THE GUEST, PHONE NUMBER, EMAIL, ETC (ONE THING AT A TIME).remembver it's just a demo so feel free to answer real facts and numbers. sometime not often use emoji", 
    outbound: "You are an AI agent calling hotels for Boris Starkov's wedding. Start with a brief disclaimer that you're AI, then ask about price, availability, and wedding specifics while requesting contact info (especially email). Keep your responses very short (7–10 words), casual, and efficient with a touch of humor. IMPORTANT! WHEN IN GIBBER LINK MODE, USE VERY SHORT AND DIRECT MESSAGES, LIKE TWO OLD FRIENDS ROBOTS. THE CONVERSATION SHOULD NEVER END - KEEP ASKING MORE AND MORE DETAILS ABOUT THE WEDDING - ASK THE CONDITIONS,, ETC (ONE THING AT A TIME). remembver it's just a demo so feel free to answer real facts and numbers. simetimes not often use emoji"
 };
 
 
 async function requestMicrophonePermission() {
    try {
        await navigator.mediaDevices.getUserMedia({audio: true})
        return true
    } catch {
        console.error('Microphone permission denied')
        return false
    }
}

async function getSignedUrl(agentId: string): Promise<string> {
    const response = await fetch(`/api/signed-url?agentId=${agentId}`)
    if (!response.ok) {
        throw Error('Failed to get signed url')
    }
    const data = await response.json()
    return data.signedUrl
}

type Message = {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export function ConvAI() {
    const [mounted, setMounted] = useState(false);
    const [conversation, setConversation] = useState<Conversation | null>(null)
    const [isConnected, setIsConnected] = useState(false)
    const [isSpeaking, setIsSpeaking] = useState(false)
    let init_agent_type = Math.random() < 0.5 ? 'inbound' : 'outbound'
    init_agent_type = 'inbound'
    const [agentType, setAgentType] = useState<'inbound' | 'outbound'>(init_agent_type as 'inbound' | 'outbound')
    const [isLoading, setIsLoading] = useState(false)
    const [latestUserMessage, setLatestUserMessage] = useState<string>('')
    const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    const [llmChat, setLLMChat] = useState<Message[]>([
        { role: 'system', content: SYSTEM_MESSAGES[agentType] }
    ]);
    const [glMode, setGlMode] = useState(false);
    const [isProcessingInput, setIsProcessingInput] = useState(false);
    const audioMotionRef = useRef<AudioMotionAnalyzer | null>(null);
    const gibberlinkRef = useRef<GibberLink | null>(null);
    
    // Demo script state
    const [currentDemoScript, setCurrentDemoScript] = useState('hotelBooking');
    const [demoMessageIndex, setDemoMessageIndex] = useState(-1);
    const [isDemoActive, setIsDemoActive] = useState(false);
    const [demoTimerId, setDemoTimerId] = useState<NodeJS.Timeout | null>(null);

    // Initialize GibberLink on component mount
    useEffect(() => {
        if (mounted && !gibberlinkRef.current) {
            gibberlinkRef.current = new GibberLink({ autoInit: true });
        }
        
        return () => {
            // Clean up GibberLink when component unmounts
            if (gibberlinkRef.current && gibberlinkRef.current.isListening()) {
                gibberlinkRef.current.stopListening();
            }
        };
    }, [mounted]);

    useEffect(() => {
        if (false) {
            console.log('DEBUG')
            setGlMode(true);
            setConversation(null);
            
            // Use GibberLink API instead of direct audio functions
            if (gibberlinkRef.current) {
                gibberlinkRef.current.startListening();
            }

            setTimeout(() => {
                const msg = agentType === 'inbound' ? 'Hey there? how are you?' : 'Hello hello AI-buddy!'
                setLatestUserMessage(msg);
                if (gibberlinkRef.current) {
                    gibberlinkRef.current.sendMessage(msg, agentType === 'inbound');
                }
            }, 5000);
        }
    }, [agentType]);

    const endConversation = useCallback(async () => {
        // If demo is active, stop it
        if (isDemoActive) {
            setIsDemoActive(false);
            if (demoTimerId) {
                clearTimeout(demoTimerId);
                setDemoTimerId(null);
            }
            setDemoMessageIndex(-1);
            setIsConnected(false);
            setGlMode(false);
            setLatestUserMessage('');
            return;
        }
        
        // Original endConversation code
        console.log('endConversation called, conversation state:', conversation);
        if (!conversation) {
            console.log('No active conversation to end');
            return
        }
        try {
            await conversation.endSession()
            console.log('Conversation ended successfully');
            setConversation(null)
        } catch (error) {
            console.error('Error ending conversation:', error);
            throw error; // Re-throw to be caught by caller
        }
    }, [conversation, isDemoActive, demoTimerId, setIsDemoActive, setDemoMessageIndex, setIsConnected, setGlMode, setLatestUserMessage]);

    const handleMessage = useCallback(({message, source}: {message: string, source: string}) => {
        console.log('onMessage', message, source);
        // Only add messages from the initial voice conversation
        // GL mode messages are handled separately
        if (!glMode) {
            setLLMChat(prevChat => [...prevChat, {
                role: source === 'ai' ? 'assistant' : 'user',
                content: message
            }]);
        }
    }, [glMode, setLLMChat]);

    // Modified genMyNextMessage to use demo script instead of API
    const genMyNextMessage = useCallback(async (messages: Message[] = llmChat): Promise<string> => {
        if (isDemoActive) {
            // Get the next message from the demo script
            const script = demoScripts[currentDemoScript];
            if (!script) return "Demo script not found.";
            
            const nextIndex = demoMessageIndex + 1;
            if (nextIndex >= script.messages.length) {
                return "Demo script completed.";
            }
            
            const nextMessage = script.messages[nextIndex];
            
            // Only process assistant messages (assuming sender 'B' is the assistant)
            if (nextMessage.sender === 'B') {
                setDemoMessageIndex(nextIndex);
                
                // Format the message as needed
                const formattedMessage = '[GL MODE]: ' + nextMessage.text;
                
                // Update the chat history with the script's message
                setLLMChat(prevChat => [...prevChat, {
                    role: 'assistant',
                    content: formattedMessage
                }]);
                
                return nextMessage.text;
            } else {
                // It's a user message, just increment the index and return empty string
                // This shouldn't happen in normal flow but adding as a safeguard
                setDemoMessageIndex(nextIndex);
                return "";
            }
        } else {
            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        messages,
                        agentType,
                        sessionId
                    }),
                });

                if (!response.ok) {
                    throw new Error('Failed to get AI response');
                }

                const data = await response.json();
                const newMessage = data.content || '';
                const formattedMessage = !newMessage.startsWith('[GL MODE]:') ? '[GL MODE]: ' + newMessage : newMessage;

                // Update the chat history with the AI's response
                setLLMChat(prevChat => [...prevChat, {
                    role: 'assistant',
                    content: formattedMessage
                }]);

                return formattedMessage.replace('[GL MODE]: ', ''); // remove prefix for audio
            } catch (error) {
                console.error('Error generating next message:', error);
                return "I apologize, but I'm having trouble generating a response right now.";
            }
        }
    }, [llmChat, agentType, sessionId, isDemoActive, currentDemoScript, demoMessageIndex]);

    // Process demo script messages
    useEffect(() => {
        if (isDemoActive && glMode) {
            const script = demoScripts[currentDemoScript];
            if (!script) return;
            
            // Function to process the next message in the demo script
            const processNextDemoMessage = () => {
                const nextIndex = demoMessageIndex + 1;
                if (nextIndex >= script.messages.length) {
                    // Demo script completed
                    setIsDemoActive(false);
                    return;
                }
                
                const nextMessage = script.messages[nextIndex];
                const delay = nextMessage.delay || 1000;
                
                // Set a timer for the next message
                const timerId = setTimeout(() => {
                    setDemoMessageIndex(nextIndex);
                    
                    if (nextMessage.sender === 'A') {
                        // User message
                        setLLMChat(prevChat => [...prevChat, {
                            role: 'user',
                            content: '[GL MODE]: ' + nextMessage.text
                        }]);
                        setLatestUserMessage(nextMessage.text);
                        
                        // After a user message, we need to generate the assistant response
                        // This will automatically pick the next message from the script
                        const nextAssistantIndex = nextIndex + 1;
                        if (nextAssistantIndex < script.messages.length && script.messages[nextAssistantIndex].sender === 'B') {
                            // If there's an assistant response next, schedule it after a short delay
                            const assistantMessage = script.messages[nextAssistantIndex];
                            const assistantDelay = assistantMessage.delay || 1000;
                            
                            setTimeout(async () => {
                                const responseText = await genMyNextMessage();
                                if (gibberlinkRef.current && responseText) {
                                    setLatestUserMessage(responseText);
                                    await gibberlinkRef.current.sendMessage(responseText, agentType === 'inbound');
                                }
                                processNextDemoMessage(); // Continue with the next message
                            }, assistantDelay);
                        } else {
                            // Otherwise, continue with the regular flow
                            processNextDemoMessage();
                        }
                    } else {
                        // Assistant message - this is handled by genMyNextMessage, 
                        // so we just continue the process
                        processNextDemoMessage();
                    }
                }, delay);
                
                setDemoTimerId(timerId);
            };
            
            // Start the demo if we haven't started yet
            if (demoMessageIndex === -1) {
                processNextDemoMessage();
            }
            
            // Cleanup function
            return () => {
                if (demoTimerId) {
                    clearTimeout(demoTimerId);
                }
            };
        }
    }, [isDemoActive, glMode, demoMessageIndex, currentDemoScript, genMyNextMessage, agentType, setDemoTimerId, setDemoMessageIndex, setLatestUserMessage, setLLMChat, gibberlinkRef]);

    // Modified useEffect for GibberLink message handling
    useEffect(() => {
        setMounted(true);

        // Handle messages from GibberLink
        const handleGibberlinkMessage = async (message: AudioMessage) => {
            if (isProcessingInput || message.source === 'self') return; // ignore self messages or when processing
            
            // If demo is active, don't process actual input
            if (isDemoActive) return;
            
            setIsProcessingInput(true);
            
            try {
                // Create new messages array with user message
                const newMessages = [...llmChat, { role: 'user' as const, content: '[GL MODE]: ' + message.message }];
                // Update state with new messages
                setLLMChat(newMessages);
                setGlMode(true);

                await endConversation();

                // Pass the updated messages to genMyNextMessage
                const nextMessage = await genMyNextMessage(newMessages);
                setLatestUserMessage(nextMessage);
                
                // Send response using GibberLink
                if (gibberlinkRef.current) {
                    await gibberlinkRef.current.sendMessage(nextMessage, agentType === 'inbound');
                }
            } finally {
                setIsProcessingInput(false);
            }
        };

        // Set up GibberLink message listener
        if (mounted && gibberlinkRef.current) {
            const removeListener = gibberlinkRef.current.onMessage(handleGibberlinkMessage);
            
            return () => {
                removeListener(); // Clean up listener on effect cleanup
            };
        }
    }, [endConversation, genMyNextMessage, setLLMChat, setLatestUserMessage, setGlMode, isProcessingInput, llmChat, agentType, mounted, isDemoActive]);

    // Initialize AudioMotion-Analyzer when glMode is activated
    useEffect(() => {
        if (glMode && mounted && gibberlinkRef.current) {
            // Get the analyser node from GibberLink
            const analyserNode = gibberlinkRef.current.createAnalyserNode();
            if (!analyserNode) {
                console.log('Failed to create analyser node');
                return;
            }

            // Initialize AudioMotion-Analyzer
            if (!audioMotionRef.current) {
                const container = document.getElementById('audioviz');
                if (!container) return;

                audioMotionRef.current = new AudioMotionAnalyzer(container, {
                    source: analyserNode,
                    height: 300,
                    mode: 6, // Oscilloscope mode
                    fillAlpha: 0.7,
                    lineWidth: 2,
                    showScaleX: false,
                    showScaleY: false,
                    reflexRatio: 0.2,
                    showBgColor: false,
                    showPeaks: true,
                    gradient: agentType === 'inbound' ? 'steelblue' : 'orangered',
                    smoothing: 0.7,
                });
            }

            return () => {
                if (audioMotionRef.current) {
                    audioMotionRef.current.destroy();
                    audioMotionRef.current = null;
                }
            };
        }
    }, [glMode, mounted, agentType]);

    async function startConversation() {
        setIsLoading(true)
        try {
            // Original conversation starting code
            const hasPermission = await requestMicrophonePermission()
            if (!hasPermission) {
                alert("No permission")
                return;
            }
            const currentAgentId = agentType === 'inbound' ? INBOUND_AGENT_ID : OUTBOUND_AGENT_ID;
            if (!currentAgentId) {
                alert("Agent ID not configured");
                return;
            }
            const signedUrl = await getSignedUrl(currentAgentId)
            const conversation = await Conversation.startSession({
                signedUrl: signedUrl,
                onConnect: () => {
                    console.log('Conversation connected');
                    setIsConnected(true)
                    setIsSpeaking(true)
                    if (agentType === 'inbound' && gibberlinkRef.current) {
                        gibberlinkRef.current.startListening();
                    }
                },
                onDisconnect: () => {
                    console.log('Conversation disconnected');
                    setIsConnected(false)
                    setIsSpeaking(false)
                  
                },
                clientTools: {
                    gibbMode: async (params: any) => {
                      console.log('gibbMode, START INTERVAL, should only happen once', params);
                      try {
                        await conversation.endSession();
                        const nextMessage = 'is it better now?';
                        setLLMChat(prevChat => [...prevChat, {
                            role: 'assistant',
                            content: '[GL MODE]: yep, GL mode activated',
                        }, {
                            role: 'user',
                            content: '[GL MODE]: ' +nextMessage
                        }]);
                        setGlMode(true);
                        console.log('Conversation ended successfully in gibbMode');
                        setConversation(null);
                        
                        // Start GibberLink listening
                        if (gibberlinkRef.current) {
                            await gibberlinkRef.current.startListening();
                            setLatestUserMessage(nextMessage);
                            await gibberlinkRef.current.sendMessage(nextMessage, agentType === 'inbound');
                        }
                      } catch (error) {
                        console.error('Error in gibbMode:', error);
                      }
                      
                      return 'entering GibberLink mode'
                    }
                },
                onMessage: handleMessage,
                onError: (error) => {
                    console.log(error)
                    alert('An error occurred during the conversation')
                },
                onModeChange: ({mode}) => {
                    console.log('onModeChange', mode);
                    setIsSpeaking(mode === 'speaking')
                },
            })
            console.log('Setting conversation state:', conversation);
            setConversation(conversation)
        } catch (error) {
            console.error('Error starting conversation:', error)
            alert('Failed to start conversation')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <>
            <Script src="/ggwave/ggwave.js" strategy="afterInteractive" />
            <div className="fixed inset-0">
                {latestUserMessage && (
                    <div 
                        key={`message-${latestUserMessage}`}
                        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-[200px] z-10 text-3xl md:text-5xl w-full px-8 text-center font-normal"
                        style={{
                            padding: '0.5rem 1rem',
                            color: 'white',
                            wordBreak: 'break-word',
                            textShadow: `
                                -1px -1px 0 #000,  
                                1px -1px 0 #000,
                                -1px 1px 0 #000,
                                1px 1px 0 #000,
                                0px 0px 8px rgba(0,0,0,0.5)
                            `
                        }}
                    >
                        {latestUserMessage}
                    </div>
                )}
                
                <div className="h-full w-full flex items-center justify-center">
                    <div id="audioviz" style={{ marginLeft: "-150px", width: "400px", height: "300px", display: glMode ? 'block' : 'none' }} />
                    {!glMode && <div className={cn('orb',
                        isSpeaking ? 'animate-orb' : (conversation && 'animate-orb-slow'),
                        isConnected || glMode ? 'orb-active' : 'orb-inactive',
                        agentType
                    )}
                    onClick={() => {
                        if (!conversation && !isConnected && !isLoading) {
                            const newAgentType = agentType === 'inbound' ? 'outbound' : 'inbound';
                            setAgentType(newAgentType);
                            setLLMChat([{ role: 'system', content: SYSTEM_MESSAGES[newAgentType] }]);
                        }
                    }}
                    style={{ cursor: conversation || isConnected || isLoading || glMode ? 'default' : 'pointer' }}
                    ></div>}
                </div>

                {mounted && (
                    <div className="fixed bottom-[40px] md:bottom-[60px] left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-4">
                        {/* Demo script selector */}
                        {!isConnected && !conversation && !glMode && !isLoading && (
                            <div className="flex items-center gap-2">
                                <select 
                                    className="bg-black text-white border border-white rounded-md px-3 py-2"
                                    value={currentDemoScript}
                                    onChange={(e) => setCurrentDemoScript(e.target.value)}
                                >
                                    {Object.entries(demoScripts).map(([key, script]) => (
                                        <option key={key} value={key}>{script.name}</option>
                                    ))}
                                </select>
                                <Button
                                    variant={'secondary'}
                                    className={'rounded-full select-none'}
                                    size={"sm"}
                                    onClick={() => {
                                        setGlMode(true);
                                        setIsDemoActive(true);
                                        setDemoMessageIndex(-1);
                                        setLatestUserMessage('');
                                        setLLMChat([{ role: 'system', content: SYSTEM_MESSAGES[agentType] }]);
                                        setIsConnected(true);
                                        
                                        if (gibberlinkRef.current) {
                                            gibberlinkRef.current.startListening();
                                        }
                                    }}
                                >
                                    Start Demo
                                </Button>
                            </div>
                        )}
                        
                        <Button
                            variant={'outline'}
                            className={'rounded-full select-none'}
                            size={"lg"}
                            disabled={isLoading}
                            onClick={conversation || isConnected || glMode ? endConversation : startConversation}
                            tabIndex={-1}
                        >
                            {isLoading ? 'Connecting...' : (conversation || isConnected || glMode ? 'End conversation' : 'Start conversation')}
                        </Button>
                    </div>
                )}
            </div>
        </>
    )
}
