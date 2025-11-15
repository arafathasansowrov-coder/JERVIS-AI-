import { GoogleGenAI, GenerateContentResponse, Modality, Type, Chat, LiveSession, LiveServerMessage } from "@google/genai";
import { decode } from "./audioUtils";

// This file contains interactions with the Gemini API.

// --- TEXT FEATURES ---
export const startChat = (systemInstruction?: string): Chat => {
    // FIX: Directly use process.env.API_KEY for initialization.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    return ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: systemInstruction,
        },
    });
};

export const runGroundedSearch = async (prompt: string, useMaps: boolean, location?: { latitude: number, longitude: number }): Promise<GenerateContentResponse> => {
    // FIX: Directly use process.env.API_KEY for initialization.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const tools: any[] = [{ googleSearch: {} }];
    if (useMaps) {
        tools.push({ googleMaps: {} });
    }
    
    return ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { tools },
        toolConfig: useMaps && location ? { retrievalConfig: { latLng: location } } : undefined,
    });
};

export const runComplexTask = async (prompt: string): Promise<GenerateContentResponse> => {
    // FIX: Directly use process.env.API_KEY for initialization.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    return ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: prompt,
        config: { thinkingConfig: { thinkingBudget: 32768 } },
    });
};

// --- IMAGE FEATURES ---
export const generateImage = async (prompt: string, aspectRatio: string): Promise<string> => {
    // FIX: Directly use process.env.API_KEY for initialization.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
            numberOfImages: 1,
            outputMimeType: 'image/png',
            aspectRatio: aspectRatio as "1:1" | "3:4" | "4:3" | "9:16" | "16:9",
        },
    });
    const base64ImageBytes = response.generatedImages[0].image.imageBytes;
    return `data:image/png;base64,${base64ImageBytes}`;
};

export const editImage = async (prompt: string, imageBase64: string, mimeType: string): Promise<string> => {
    // FIX: Directly use process.env.API_KEY for initialization.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [
                { inlineData: { data: imageBase64, mimeType } },
                { text: prompt },
            ],
        },
        config: { responseModalities: [Modality.IMAGE] },
    });
    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
    }
    throw new Error("No image generated in response.");
};


export const analyzeImage = async (prompt: string, imageBase64: string, mimeType: string): Promise<string> => {
    // FIX: Directly use process.env.API_KEY for initialization.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
            parts: [
                { inlineData: { data: imageBase64, mimeType } },
                { text: prompt },
            ],
        },
    });
    return response.text;
};

// --- VIDEO FEATURES ---
export async function getVeoAiInstance() {
    if (typeof window.aistudio === 'undefined') {
        throw new Error("AI Studio context is not available.");
    }
    if (!(await window.aistudio.hasSelectedApiKey())) {
        await window.aistudio.openSelectKey();
    }
    // Always create a new instance to ensure the latest key is used.
    // FIX: Directly use process.env.API_KEY for initialization.
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
}

export const generateVideo = async (prompt: string | null, image: { base64: string; mimeType: string } | null, aspectRatio: '16:9' | '9:16') => {
    const ai = await getVeoAiInstance();
    const payload: any = {
        model: 'veo-3.1-fast-generate-preview',
        config: {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio: aspectRatio,
        },
    };
    if (prompt) payload.prompt = prompt;
    if (image) {
        payload.image = {
            imageBytes: image.base64,
            mimeType: image.mimeType,
        };
    }
    
    let operation = await ai.models.generateVideos(payload);
    while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
    }
    
    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) throw new Error("Video generation failed or returned no link.");
    
    // FIX: Directly use process.env.API_KEY for fetch request.
    const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    const videoBlob = await response.blob();
    return URL.createObjectURL(videoBlob);
};

export const analyzeVideo = async (prompt: string, frames: { base64: string; mimeType: string }[]): Promise<string> => {
    // FIX: Directly use process.env.API_KEY for initialization.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const imageParts = frames.map(frame => ({
        inlineData: { data: frame.base64, mimeType: frame.mimeType }
    }));
    
    const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: { parts: [...imageParts, { text: prompt }] },
    });
    return response.text;
};


// --- AUDIO FEATURES ---
export const generateSpeech = async (text: string): Promise<Uint8Array> => {
    // FIX: Directly use process.env.API_KEY for initialization.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
            },
        },
    });
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio data in response.");
    
    // FIX: Use decode utility and return Uint8Array.
    return decode(base64Audio);
};

export const startLiveConversation = (callbacks: {
    onOpen: () => void;
    onMessage: (message: LiveServerMessage) => void;
    onError: (e: ErrorEvent) => void;
    onClose: (e: CloseEvent) => void;
}, enableTranscription: boolean): Promise<LiveSession> => {
    // FIX: Directly use process.env.API_KEY for initialization.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    return ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
            onopen: callbacks.onOpen,
            onmessage: callbacks.onMessage,
            onerror: callbacks.onError,
            onclose: callbacks.onClose,
        },
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
            systemInstruction: 'You are Jervis, a friendly and helpful AI assistant.',
            ...(enableTranscription && {
                inputAudioTranscription: {},
                outputAudioTranscription: {},
            })
        },
    });
};