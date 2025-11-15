import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage } from '../types';
import { Card, Button, Spinner } from '../components/ui';
import * as geminiService from '../services/geminiService';
import type { Chat } from '@google/genai';
import Markdown from 'react-markdown';

const TextFeatures: React.FC = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [useGrounding, setUseGrounding] = useState(false);
    const [useMaps, setUseMaps] = useState(false);
    const [useThinkingMode, setUseThinkingMode] = useState(false);
    const [location, setLocation] = useState<{latitude: number, longitude: number} | null>(null);

    const chatRef = useRef<Chat | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        chatRef.current = geminiService.startChat("You are Jervis, a helpful AI assistant.");
        setMessages([{ role: 'model', text: 'Hello! How can I help you today? You can ask me anything, or enable special modes like Grounding for real-time info or Thinking Mode for complex problems.' }]);
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (useMaps && !location) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setLocation({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                    });
                },
                (error) => {
                    console.error("Geolocation error:", error);
                    alert("Could not get location. Maps grounding may be less accurate.");
                    setUseMaps(false);
                }
            );
        }
    }, [useMaps, location]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage: ChatMessage = { role: 'user', text: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            let response;
            if (useThinkingMode) {
                response = await geminiService.runComplexTask(input);
            } else if (useGrounding) {
                response = await geminiService.runGroundedSearch(input, useMaps, location ?? undefined);
            } else {
                if (!chatRef.current) throw new Error("Chat not initialized");
                response = await chatRef.current.sendMessage({ message: input });
            }
            
            const modelMessage: ChatMessage = {
                role: 'model',
                text: response.text,
                citations: response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [],
            };
            setMessages(prev => [...prev, modelMessage]);

        } catch (error) {
            console.error("Error sending message:", error);
            const errorMessage: ChatMessage = { role: 'model', text: "Sorry, I encountered an error. Please try again." };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const ModeToggle: React.FC<{
      label: string;
      description: string;
      isChecked: boolean;
      onChange: (checked: boolean) => void;
    }> = ({ label, description, isChecked, onChange }) => (
        <label className="flex items-center p-3 rounded-lg bg-gray-800/50 hover:bg-gray-800 cursor-pointer transition-colors">
            <input
                type="checkbox"
                checked={isChecked}
                onChange={(e) => onChange(e.target.checked)}
                className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-cyan-500 focus:ring-cyan-600"
            />
            <div className="ml-3">
                <span className="text-sm font-medium text-white">{label}</span>
                <p className="text-xs text-gray-400">{description}</p>
            </div>
        </label>
    );

    return (
        <div className="flex flex-col h-full max-w-4xl mx-auto">
            <Card className="mb-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <ModeToggle 
                      label="Grounding"
                      description="Use Google Search for current info."
                      isChecked={useGrounding}
                      onChange={(checked) => { setUseGrounding(checked); if (checked) setUseThinkingMode(false); }}
                    />
                     <ModeToggle 
                      label="Use Maps"
                      description="Enhance grounding with location."
                      isChecked={useMaps}
                      onChange={(checked) => {
                        if (checked && !useGrounding) setUseGrounding(true);
                        setUseMaps(checked);
                      }}
                    />
                    <ModeToggle 
                      label="Thinking Mode"
                      description="For complex reasoning tasks."
                      isChecked={useThinkingMode}
                      onChange={(checked) => { setUseThinkingMode(checked); if (checked) setUseGrounding(false); }}
                    />
                </div>
            </Card>

            <div className="flex-1 overflow-y-auto pr-4 -mr-4 space-y-4 mb-4">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-lg p-4 rounded-2xl ${msg.role === 'user' ? 'bg-cyan-600 text-white rounded-br-none' : 'bg-gray-700 text-gray-200 rounded-bl-none'}`}>
                            <div className="prose prose-invert prose-sm max-w-none">
                              <Markdown>{msg.text}</Markdown>
                            </div>
                            {msg.citations && msg.citations.length > 0 && (
                                <div className="mt-4 border-t border-gray-600 pt-2">
                                    <h4 className="text-xs font-semibold text-gray-400 mb-1">Sources:</h4>
                                    <ul className="text-xs space-y-1">
                                        {msg.citations.map((chunk, i) => (
                                            <li key={i}>
                                               {(chunk.web || chunk.maps) && (
                                                 <a href={(chunk.web || chunk.maps).uri} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline break-all">
                                                   {i + 1}. {(chunk.web || chunk.maps).title}
                                                 </a>
                                               )}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex justify-start">
                       <div className="max-w-lg p-4 rounded-2xl bg-gray-700 text-gray-200 rounded-bl-none flex items-center space-x-2">
                            <Spinner size="sm" /> <span>Jervis is thinking...</span>
                       </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSubmit} className="flex items-center space-x-4">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type your message..."
                    className="flex-1 p-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                    disabled={isLoading}
                />
                <Button type="submit" isLoading={isLoading} disabled={!input.trim()}>
                    Send
                </Button>
            </form>
        </div>
    );
};

export default TextFeatures;
