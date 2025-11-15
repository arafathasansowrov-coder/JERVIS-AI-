import React, { useState, useCallback } from 'react';
import { Card, Button, FileUpload, Spinner } from '../components/ui';
import * as geminiService from '../services/geminiService';

type Tab = 'generate' | 'edit' | 'analyze';

const ImageFeatures: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('generate');
    const [prompt, setPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState('1:1');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
    const [result, setResult] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFileSelect = useCallback((file: File) => {
        setImageFile(file);
        setOriginalImageUrl(URL.createObjectURL(file));
        setResult(null);
    }, []);

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

    const handleSubmit = async () => {
        setIsLoading(true);
        setError(null);
        setResult(null);

        try {
            if (activeTab === 'generate') {
                if (!prompt) throw new Error("Prompt is required.");
                const generatedImage = await geminiService.generateImage(prompt, aspectRatio);
                setResult(generatedImage);
            } else {
                if (!prompt) throw new Error("Prompt is required.");
                if (!imageFile) throw new Error("Image file is required.");
                const { base64, mimeType } = await fileToBase64(imageFile);
                if (activeTab === 'edit') {
                    const editedImage = await geminiService.editImage(prompt, base64, mimeType);
                    setResult(editedImage);
                } else if (activeTab === 'analyze') {
                    const analysis = await geminiService.analyzeImage(prompt, base64, mimeType);
                    setResult(analysis);
                }
            }
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };
    
    const TabButton: React.FC<{ tabId: Tab, children: React.ReactNode }> = ({ tabId, children }) => (
        <button
            onClick={() => setActiveTab(tabId)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === tabId ? 'bg-cyan-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
        >
            {children}
        </button>
    );

    const renderContent = () => {
        const showFileUpload = activeTab === 'edit' || activeTab === 'analyze';
        return (
            <div className="space-y-6">
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={
                      activeTab === 'generate' ? 'e.g., A majestic lion wearing a crown, cinematic lighting' :
                      activeTab === 'edit' ? 'e.g., Add a retro filter' :
                      'e.g., What is in this image?'
                    }
                    className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none min-h-[100px]"
                    disabled={isLoading}
                />
                {activeTab === 'generate' && (
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Aspect Ratio</label>
                        <select
                            value={aspectRatio}
                            onChange={(e) => setAspectRatio(e.target.value)}
                            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                        >
                            <option value="1:1">1:1 (Square)</option>
                            <option value="16:9">16:9 (Landscape)</option>
                            <option value="9:16">9:16 (Portrait)</option>
                            <option value="4:3">4:3</option>
                            <option value="3:4">3:4</option>
                        </select>
                    </div>
                )}
                {showFileUpload && (
                    <FileUpload onFileSelect={handleFileSelect} accept="image/*" label="Upload Image" />
                )}
                <Button onClick={handleSubmit} isLoading={isLoading} disabled={isLoading || !prompt || (showFileUpload && !imageFile)}>
                    {activeTab === 'generate' ? 'Generate' : activeTab === 'edit' ? 'Edit' : 'Analyze'}
                </Button>
            </div>
        );
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full">
            <div className="flex flex-col">
                <div className="flex space-x-2 mb-6">
                    <TabButton tabId="generate">Generate</TabButton>
                    <TabButton tabId="edit">Edit</TabButton>
                    <TabButton tabId="analyze">Analyze</TabButton>
                </div>
                <Card className="flex-grow">
                    {renderContent()}
                </Card>
            </div>
            <Card className="flex items-center justify-center p-4">
                {isLoading && <Spinner />}
                {error && <p className="text-red-400">Error: {error}</p>}
                {!isLoading && !error && result && (
                    activeTab === 'analyze' ? (
                        <div className="text-left overflow-y-auto max-h-full w-full p-4 bg-gray-900 rounded-lg">
                            <h3 className="text-lg font-bold mb-2 text-cyan-400">Analysis Result</h3>
                            <p className="text-gray-300 whitespace-pre-wrap">{result}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full h-full items-center">
                            {originalImageUrl && activeTab === 'edit' && (
                                <div className="text-center">
                                    <h3 className="mb-2 font-semibold">Original</h3>
                                    <img src={originalImageUrl} alt="Original" className="rounded-lg max-w-full max-h-[70vh] object-contain" />
                                </div>
                            )}
                            <div className={`text-center ${!originalImageUrl || activeTab !== 'edit' ? 'col-span-2' : ''}`}>
                                 <h3 className="mb-2 font-semibold">Result</h3>
                                <img src={result} alt="Result" className="rounded-lg max-w-full max-h-[70vh] object-contain mx-auto" />
                            </div>
                        </div>
                    )
                )}
                {!isLoading && !error && !result && <p className="text-gray-500">Your results will appear here</p>}
            </Card>
        </div>
    );
};

export default ImageFeatures;
