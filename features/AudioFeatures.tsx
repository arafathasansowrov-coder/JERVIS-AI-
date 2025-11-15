import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Card, Button, Spinner } from '../components/ui';
import * as geminiService from '../services/geminiService';
// FIX: Import decode utility.
import { decodeAudioData, createPcmBlob, decode } from '../services/audioUtils';
import type { LiveSession, LiveServerMessage } from '@google/genai';

type Tab = 'assistant' | 'transcribe' | 'tts';

const AudioFeatures: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('assistant');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // TTS state
    const [ttsText, setTtsText] = useState('Hello! I am Jervis. How can I assist you today?');

    // Assistant & Transcribe state
    const [isListening, setIsListening] = useState(false);
    const [transcription, setTranscription] = useState<string>('');
    const [fullTranscriptionHistory, setFullTranscriptionHistory] = useState<string[]>([]);
    
    const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    
    // Live API audio playback state
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const nextStartTimeRef = useRef(0);
    const audioQueueRef = useRef<Set<AudioBufferSourceNode>>(new Set());

    const stopListening = useCallback(() => {
        setIsListening(false);
        
        if (sessionPromiseRef.current) {
            sessionPromiseRef.current.then(session => session.close());
            sessionPromiseRef.current = null;
        }
        
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        if (mediaStreamSourceRef.current) {
            mediaStreamSourceRef.current.disconnect();
            mediaStreamSourceRef.current = null;
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
             outputAudioContextRef.current.close();
             outputAudioContextRef.current = null;
        }
        
        audioQueueRef.current.forEach(source => source.stop());
        audioQueueRef.current.clear();
        nextStartTimeRef.current = 0;
    }, []);

    const startAssistant = useCallback(async () => {
        if (isListening) {
            stopListening();
            return;
        }
        setIsListening(true);
        setError(null);
        setTranscription('');
        setFullTranscriptionHistory([]);

        try {
            mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            
            let currentInputTranscription = '';
            let currentOutputTranscription = '';

            const liveCallbacks = {
                onOpen: () => {
                    const source = audioContextRef.current!.createMediaStreamSource(mediaStreamRef.current!);
                    mediaStreamSourceRef.current = source;
                    const scriptProcessor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
                    scriptProcessorRef.current = scriptProcessor;

                    scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                        const pcmBlob = createPcmBlob(inputData);
                        if (sessionPromiseRef.current) {
                          sessionPromiseRef.current.then((session) => {
                            session.sendRealtimeInput({ media: pcmBlob });
                          });
                        }
                    };
                    source.connect(scriptProcessor);
                    scriptProcessor.connect(audioContextRef.current!.destination);
                },
                onMessage: async (message: LiveServerMessage) => {
                    if (message.serverContent?.inputTranscription) {
                        currentInputTranscription += message.serverContent.inputTranscription.text;
                        setTranscription(`You: ${currentInputTranscription}`);
                    }
                    if (message.serverContent?.outputTranscription) {
                        currentOutputTranscription += message.serverContent.outputTranscription.text;
                        setTranscription(`Jervis: ${currentOutputTranscription}`);
                    }
                    if (message.serverContent?.turnComplete) {
                        setFullTranscriptionHistory(prev => [...prev, `You: ${currentInputTranscription}`, `Jervis: ${currentOutputTranscription}`]);
                        currentInputTranscription = '';
                        currentOutputTranscription = '';
                        setTranscription('');
                    }

                    if (activeTab === 'assistant') {
                        const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                        if (base64Audio) {
                            // FIX: Use decode utility for reliable base64 decoding.
                            const audioBuffer = await decodeAudioData(
                                decode(base64Audio),
                                outputAudioContextRef.current!, 24000, 1
                            );
                            const source = outputAudioContextRef.current!.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputAudioContextRef.current!.destination);
                            const currentTime = outputAudioContextRef.current!.currentTime;
                            const startTime = Math.max(currentTime, nextStartTimeRef.current);
                            source.start(startTime);
                            nextStartTimeRef.current = startTime + audioBuffer.duration;
                            audioQueueRef.current.add(source);
                            source.onended = () => audioQueueRef.current.delete(source);
                        }
                    }

                    if (message.serverContent?.interrupted) {
                       audioQueueRef.current.forEach(source => source.stop());
                       audioQueueRef.current.clear();
                       nextStartTimeRef.current = 0;
                    }
                },
                onClose: () => { stopListening(); },
                onError: (e: ErrorEvent) => {
                    console.error("Live session error:", e);
                    setError("A connection error occurred.");
                    stopListening();
                }
            };

            sessionPromiseRef.current = geminiService.startLiveConversation(liveCallbacks, true);

        } catch (err: any) {
            console.error("Failed to start audio session:", err);
            setError("Could not access microphone. Please grant permission and try again.");
            setIsListening(false);
        }
    }, [isListening, stopListening, activeTab]);

    const handleTts = async () => {
        if (!ttsText || isLoading) return;
        setIsLoading(true);
        setError(null);
        try {
            // FIX: Use custom decodeAudioData for raw PCM audio from TTS.
            const audioData = await geminiService.generateSpeech(ttsText);
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            const source = audioContext.createBufferSource();
            source.buffer = await decodeAudioData(audioData, audioContext, 24000, 1);
            source.connect(audioContext.destination);
            source.start(0);
        } catch (err: any) {
            setError(err.message || 'Failed to generate speech.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };
    
    // Cleanup on component unmount
    useEffect(() => {
        return () => {
            stopListening();
        };
    }, [stopListening]);

    const TabButton: React.FC<{ tabId: Tab, children: React.ReactNode }> = ({ tabId, children }) => (
        <button
            onClick={() => {
                stopListening();
                setActiveTab(tabId)
            }}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === tabId ? 'bg-cyan-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
        >
            {children}
        </button>
    );

    const renderContent = () => {
        switch (activeTab) {
            case 'assistant':
            case 'transcribe':
                return (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <h2 className="text-2xl font-bold mb-2 text-cyan-300">{activeTab === 'assistant' ? 'Live Voice Assistant' : 'Audio Transcription'}</h2>
                        <p className="text-gray-400 mb-6">{activeTab === 'assistant' ? 'Hold a real-time conversation with Jervis.' : 'Record your voice to get a live transcription.'}</p>
                        <Button onClick={startAssistant} className="w-48 h-16 rounded-full text-lg">
                           {isListening ? "Stop" : "Start"}
                        </Button>
                        <div className="mt-8 p-4 bg-gray-900/50 rounded-lg min-h-[200px] w-full text-left">
                            <h3 className="font-semibold text-gray-400 border-b border-gray-700 pb-2 mb-2">Conversation Log</h3>
                            <div className="space-y-2 text-sm text-gray-300">
                                {fullTranscriptionHistory.map((text, i) => <p key={i}>{text}</p>)}
                                {isListening && <p className="text-cyan-400">{transcription}<span className="animate-pulse">|</span></p>}
                            </div>
                        </div>
                    </div>
                );
            case 'tts':
                return (
                     <div className="space-y-6">
                        <h2 className="text-2xl font-bold text-cyan-300">Text-to-Speech</h2>
                        <textarea
                            value={ttsText}
                            onChange={(e) => setTtsText(e.target.value)}
                            placeholder="Enter text to synthesize..."
                            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none min-h-[150px]"
                        />
                        <Button onClick={handleTts} isLoading={isLoading} disabled={isLoading || !ttsText}>
                            Speak
                        </Button>
                    </div>
                );
        }
    };
    
    return (
        <div className="flex flex-col h-full max-w-3xl mx-auto">
            <div className="flex space-x-2 mb-6">
                <TabButton tabId="assistant">Voice Assistant</TabButton>
                <TabButton tabId="transcribe">Transcribe</TabButton>
                <TabButton tabId="tts">Text-to-Speech</TabButton>
            </div>
            <Card className="flex-grow">
                {error && <p className="text-red-400 mb-4">Error: {error}</p>}
                {renderContent()}
            </Card>
        </div>
    );
};

export default AudioFeatures;