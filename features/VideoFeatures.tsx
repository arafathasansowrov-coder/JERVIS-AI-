import React, { useState, useCallback, useRef } from 'react';
import { Card, Button, FileUpload, Spinner } from '../components/ui';
import * as geminiService from '../services/geminiService';

type Tab = 'generate' | 'analyze';

const VEO_LOADING_MESSAGES = [
    "Warming up the digital film crew...",
    "Rendering pixels into motion...",
    "Choreographing digital actors...",
    "Polishing the final cut...",
    "This can take a few minutes. Great art takes time!",
];

const VideoFeatures: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('generate');
    const [prompt, setPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [result, setResult] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState(VEO_LOADING_MESSAGES[0]);
    const [error, setError] = useState<string | null>(null);
    const [apiKeyReady, setApiKeyReady] = useState(false);

    const messageIntervalRef = useRef<number | null>(null);

    const checkApiKey = useCallback(async () => {
        try {
            if (typeof window.aistudio !== 'undefined' && await window.aistudio.hasSelectedApiKey()) {
                setApiKeyReady(true);
                return true;
            }
            setApiKeyReady(false);
            return false;
        } catch (e) {
            console.error("Error checking API key", e);
            setApiKeyReady(false);
            return false;
        }
    }, []);

    const handleSelectKey = async () => {
        try {
            await window.aistudio.openSelectKey();
            // Assume success and optimistically update UI
            setApiKeyReady(true);
        } catch (e) {
            console.error("Could not open select key dialog", e);
            setError("Failed to open API key selection. Please try again.");
        }
    };
    
    // Check key on tab switch to 'generate'
    React.useEffect(() => {
        if (activeTab === 'generate') {
            checkApiKey();
        }
    }, [activeTab, checkApiKey]);

    const fileToBase64 = (file: File): Promise<{ base64: string, mimeType: string }> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const result = reader.result as string;
                const base64 = result.split(',')[1];
                resolve({ base64, mimeType: file.type });
            };
            reader.onerror = error => reject(error);
        });
    };

    const startLoadingMessages = () => {
        let i = 0;
        messageIntervalRef.current = window.setInterval(() => {
            i = (i + 1) % VEO_LOADING_MESSAGES.length;
            setLoadingMessage(VEO_LOADING_MESSAGES[i]);
        }, 5000);
    };

    const stopLoadingMessages = () => {
        if (messageIntervalRef.current) {
            clearInterval(messageIntervalRef.current);
            messageIntervalRef.current = null;
        }
    };
    
    const handleSubmit = async () => {
        setIsLoading(true);
        setError(null);
        setResult(null);

        try {
            if (activeTab === 'generate') {
                if (!prompt && !imageFile) throw new Error("A text prompt or an image is required for video generation.");
                startLoadingMessages();
                const imagePayload = imageFile ? await fileToBase64(imageFile) : null;
                const videoUrl = await geminiService.generateVideo(prompt || null, imagePayload, aspectRatio);
                setResult(videoUrl);
            } else if (activeTab === 'analyze') {
                if (!prompt) throw new Error("A prompt is required for analysis.");
                if (!videoFile) throw new Error("A video file is required for analysis.");
                // This is a simplified frame extraction for demo purposes
                const frames = await extractFramesFromVideo(videoFile, 5);
                const analysisResult = await geminiService.analyzeVideo(prompt, frames);
                setResult(analysisResult);
            }
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred.');
            if (err.message?.includes("Requested entity was not found")) {
                setError("API Key not found or invalid. Please select a valid key.");
                setApiKeyReady(false);
            }
            console.error(err);
        } finally {
            setIsLoading(false);
            stopLoadingMessages();
        }
    };
    
    const extractFramesFromVideo = (videoFile: File, frameCount: number): Promise<{ base64: string, mimeType: string }[]> => {
        return new Promise((resolve) => {
            const video = document.createElement('video');
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            const frames: { base64: string, mimeType: string }[] = [];
            video.src = URL.createObjectURL(videoFile);
            video.muted = true;

            video.onloadedmetadata = () => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const duration = video.duration;
                const interval = duration / frameCount;
                let currentTime = 0;
                let capturedFrames = 0;

                video.onseeked = () => {
                    if (context) {
                        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
                        const dataUrl = canvas.toDataURL('image/jpeg');
                        frames.push({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' });
                        capturedFrames++;
                        if (capturedFrames < frameCount) {
                            currentTime += interval;
                            video.currentTime = currentTime;
                        } else {
                            URL.revokeObjectURL(video.src);
                            resolve(frames);
                        }
                    }
                };
                video.currentTime = currentTime;
            };
            video.load();
        });
    };

    const renderGenerateContent = () => {
        if (!apiKeyReady) {
            return (
                <div className="text-center">
                    <h3 className="text-lg font-semibold text-white mb-2">Veo Video Generation Requires an API Key</h3>
                    <p className="text-gray-400 mb-4">Please select your API key to proceed. Ensure your project has billing enabled by visiting <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">ai.google.dev/gemini-api/docs/billing</a>.</p>
                    <Button onClick={handleSelectKey}>Select API Key</Button>
                     {error && <p className="text-red-400 mt-4">Error: {error}</p>}
                </div>
            );
        }
        return (
             <div className="space-y-6">
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g., A neon hologram of a cat driving at top speed"
                    className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none min-h-[100px]"
                />
                <FileUpload onFileSelect={setImageFile} accept="image/*" label="Upload Starting Image (Optional)" />
                 <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Aspect Ratio</label>
                    <select
                        value={aspectRatio}
                        onChange={(e) => setAspectRatio(e.target.value as '16:9' | '9:16')}
                        className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                    >
                        <option value="16:9">16:9 (Landscape)</option>
                        <option value="9:16">9:16 (Portrait)</option>
                    </select>
                </div>
                <Button onClick={handleSubmit} isLoading={isLoading} disabled={isLoading || (!prompt && !imageFile)}>
                    Generate Video
                </Button>
            </div>
        );
    };
    
    const TabButton: React.FC<{ tabId: Tab, children: React.ReactNode }> = ({ tabId, children }) => (
        <button
            onClick={() => setActiveTab(tabId)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === tabId ? 'bg-cyan-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
        >
            {children}
        </button>
    );

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full">
            <div className="flex flex-col">
                 <div className="flex space-x-2 mb-6">
                    <TabButton tabId="generate">Generate</TabButton>
                    <TabButton tabId="analyze">Analyze</TabButton>
                </div>
                 <Card className="flex-grow">
                    {activeTab === 'generate' ? renderGenerateContent() : (
                         <div className="space-y-6">
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="e.g., What is happening in this video?"
                                className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg min-h-[100px]"
                            />
                            <FileUpload onFileSelect={setVideoFile} accept="video/*" label="Upload Video" />
                            <Button onClick={handleSubmit} isLoading={isLoading} disabled={isLoading || !prompt || !videoFile}>Analyze Video</Button>
                        </div>
                    )}
                </Card>
            </div>
            <Card className="flex items-center justify-center p-4">
                {isLoading && (
                    <div className="text-center">
                        <Spinner />
                        <p className="mt-4 text-cyan-300">{loadingMessage}</p>
                    </div>
                )}
                {error && <p className="text-red-400">Error: {error}</p>}
                {!isLoading && !error && result && (
                    activeTab === 'generate' ? (
                        <video src={result} controls className="max-w-full max-h-full rounded-lg" />
                    ) : (
                        <div className="text-left overflow-y-auto max-h-full w-full p-4 bg-gray-900 rounded-lg">
                            <h3 className="text-lg font-bold mb-2 text-cyan-400">Analysis Result</h3>
                            <p className="text-gray-300 whitespace-pre-wrap">{result}</p>
                        </div>
                    )
                )}
                {!isLoading && !error && !result && <p className="text-gray-500">Your results will appear here</p>}
            </Card>
        </div>
    );
};

export default VideoFeatures;
