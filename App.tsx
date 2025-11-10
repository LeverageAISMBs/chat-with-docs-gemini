/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChatMessage, MessageSender, URLGroup, Model, StoredFile } from './types';
import { generateContentWithUrlContext, getInitialSuggestions, decode, decodeAudioData, createBlob, generateContentWithGoogleSearch } from './services/geminiService';
import * as storageService from './services/storageService';
import KnowledgeBaseManager from './components/KnowledgeBaseManager';
import ChatInterface from './components/ChatInterface';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';

const GEMINI_DOCS_URLS = [
  "https://ai.google.dev/gemini-api/docs",
  "https://ai.google.dev/gemini-api/docs/quickstart",
  "https://ai.google.dev/gemini-api/docs/api-key",
  "https://ai.google.dev/gemini-api/docs/libraries",
  "https://ai.google.dev/gemini-api/docs/models",
  "https://ai.google.dev/gemini-api/docs/pricing",
  "https://ai.google.dev/gemini-api/docs/rate-limits",
  "https://ai.google.dev/gemini-api/docs/billing",
  "https://ai.google.dev/gemini-api/docs/changelog",
];

const MODEL_CAPABILITIES_URLS = [
  "https://ai.google.dev/gemini-api/docs/text-generation",
  "https://ai.google.dev/gemini-api/docs/image-generation",
  "https://ai.google.dev/gemini-api/docs/video",
  "https://ai.google.dev/gemini-api/docs/speech-generation",
  "https://ai.google.dev/gemini-api/docs/music-generation",
  "https://ai.google.dev/gemini-api/docs/long-context",
  "https://ai.google.dev/gemini-api/docs/structured-output",
  "https://ai.google.dev/gemini-api/docs/thinking",
  "https://ai.google.dev/gemini-api/docs/function-calling",
  "https://ai.google.dev/gemini-api/docs/document-processing",
  "https://ai.google.dev/gemini-api/docs/image-understanding",
  "https://ai.google.dev/gemini-api/docs/video-understanding",
  "https://ai.google.dev/gemini-api/docs/audio",
  "https://ai.google.dev/gemini-api/docs/code-execution",
  "https://ai.google.dev/gemini-api/docs/grounding",
];

const INITIAL_URL_GROUPS: URLGroup[] = [
  { id: 'gemini-overview', name: 'Gemini Docs Overview', urls: GEMINI_DOCS_URLS },
  { id: 'model-capabilities', name: 'Model Capabilities', urls: MODEL_CAPABILITIES_URLS },
  { id: 'custom-docs', name: 'My Custom Docs', urls: [] },
];

const App: React.FC = () => {
  const [urlGroups, setUrlGroups] = useState<URLGroup[]>(INITIAL_URL_GROUPS);
  const [activeUrlGroupId, setActiveUrlGroupId] = useState<string>(INITIAL_URL_GROUPS[0].id);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const [initialQuerySuggestions, setInitialQuerySuggestions] = useState<string[]>([]);
  
  const [selectedModel, setSelectedModel] = useState<Model>(Model.CHAT_WITH_DOCS);
  const [isRecording, setIsRecording] = useState(false);
  const [storedFiles, setStoredFiles] = useState<StoredFile[]>([]);
  
  // Refs for managing voice session resources
  const sessionPromiseRef = useRef<any>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  let currentInputTranscription = '';
  let currentOutputTranscription = '';

  const MAX_URLS = 20;

  const activeGroup = urlGroups.find(group => group.id === activeUrlGroupId);
  const currentUrlsForChat = activeGroup ? activeGroup.urls : [];
  const activeFilesCount = storedFiles.filter(f => f.isActive).length;

  useEffect(() => {
    const loadFiles = async () => {
      try {
        const files = await storageService.getFiles();
        setStoredFiles(files);
      } catch (error) {
        console.error("Failed to load files from storage:", error);
        setChatMessages(prev => [...prev, { id: `sys-err-files-load-${Date.now()}`, text: "Error: Could not load local files from browser storage.", sender: MessageSender.SYSTEM, timestamp: new Date() }]);
      }
    };
    loadFiles();
  }, []);

   useEffect(() => {
    const apiKey = process.env.API_KEY;
    const currentActiveGroup = urlGroups.find(group => group.id === activeUrlGroupId);
    
    let welcomeMessageText: string;
    if (!apiKey) {
      welcomeMessageText = 'ERROR: Gemini API Key (process.env.API_KEY) is not configured. Please set this environment variable to use the application.';
    } else if (selectedModel === Model.VOICE_CONVERSATION) {
      let contextInfo = '';
      if (currentUrlsForChat.length > 0) contextInfo += `the documents in "${currentActiveGroup?.name || 'the active group'}"`;
      if (activeFilesCount > 0) {
        if (contextInfo) contextInfo += ' and ';
        contextInfo += `${activeFilesCount} uploaded file(s)`;
      }
      welcomeMessageText = `Welcome to Voice Conversation! Press the microphone button to start speaking. I will use ${contextInfo || 'our conversation history'} as context for our talk.`;
    } else if (selectedModel === Model.CHAT_WITH_GOOGLE_SEARCH) {
      welcomeMessageText = "Welcome to Chat with Google Search! Ask me anything, and I'll use Google Search to find the most up-to-date information for you.";
    } else {
      let contextInfo = '';
      if (currentUrlsForChat.length > 0) contextInfo += `content from: "${currentActiveGroup?.name || 'None'}"`;
      if (activeFilesCount > 0) {
        if (contextInfo) contextInfo += ' and ';
        contextInfo += `${activeFilesCount} active file(s)`;
      }
      welcomeMessageText = `Welcome to Documentation Browser! You're currently browsing ${contextInfo || 'no context'}. Just ask me questions, or try one of the suggestions below to get started.`;
    }
    
    setChatMessages([{
      id: `system-welcome-${activeUrlGroupId}-${selectedModel}-${activeFilesCount}-${Date.now()}`,
      text: welcomeMessageText,
      sender: MessageSender.SYSTEM,
      timestamp: new Date(),
    }]);
  }, [activeUrlGroupId, urlGroups, selectedModel, storedFiles]); 


  const fetchAndSetInitialSuggestions = useCallback(async (currentUrls: string[]) => {
    if (currentUrls.length === 0 || selectedModel !== Model.CHAT_WITH_DOCS) {
      setInitialQuerySuggestions([]);
      return;
    }
      
    setIsFetchingSuggestions(true);
    setInitialQuerySuggestions([]); 

    try {
      const response = await getInitialSuggestions(currentUrls); 
      let suggestionsArray: string[] = [];
      if (response.text) {
        try {
          let jsonStr = response.text.trim();
          const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s; 
          const match = jsonStr.match(fenceRegex);
          if (match && match[2]) {
            jsonStr = match[2].trim();
          }
          const parsed = JSON.parse(jsonStr);
          if (parsed && Array.isArray(parsed.suggestions)) {
            suggestionsArray = parsed.suggestions.filter((s: unknown) => typeof s === 'string');
          } else {
            console.warn("Parsed suggestions response, but 'suggestions' array not found or invalid:", parsed);
             setChatMessages(prev => [...prev, { id: `sys-err-suggestion-fmt-${Date.now()}`, text: "Received suggestions in an unexpected format.", sender: MessageSender.SYSTEM, timestamp: new Date() }]);
          }
        } catch (parseError) {
          console.error("Failed to parse suggestions JSON:", parseError, "Raw text:", response.text);
          setChatMessages(prev => [...prev, { id: `sys-err-suggestion-parse-${Date.now()}`, text: "Error parsing suggestions from AI.", sender: MessageSender.SYSTEM, timestamp: new Date() }]);
        }
      }
      setInitialQuerySuggestions(suggestionsArray.slice(0, 4)); 
    } catch (e: any) {
      const errorMessage = e.message || 'Failed to fetch initial suggestions.';
      setChatMessages(prev => [...prev, { id: `sys-err-suggestion-fetch-${Date.now()}`, text: `Error fetching suggestions: ${errorMessage}`, sender: MessageSender.SYSTEM, timestamp: new Date() }]);
    } finally {
      setIsFetchingSuggestions(false);
    }
  }, [selectedModel]); 

  useEffect(() => {
    if (currentUrlsForChat.length > 0 && process.env.API_KEY && selectedModel === Model.CHAT_WITH_DOCS) { 
        fetchAndSetInitialSuggestions(currentUrlsForChat);
    } else {
        setInitialQuerySuggestions([]); 
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUrlGroupId, fetchAndSetInitialSuggestions, selectedModel]); 


  const handleAddUrl = (url: string) => {
    setUrlGroups(prevGroups => 
      prevGroups.map(group => {
        if (group.id === activeUrlGroupId) {
          if (group.urls.length < MAX_URLS && !group.urls.includes(url)) {
            return { ...group, urls: [...group.urls, url] };
          }
        }
        return group;
      })
    );
  };

  const handleRemoveUrl = (urlToRemove: string) => {
    setUrlGroups(prevGroups =>
      prevGroups.map(group => {
        if (group.id === activeUrlGroupId) {
          return { ...group, urls: group.urls.filter(url => url !== urlToRemove) };
        }
        return group;
      })
    );
  };

  const handleFileUpload = async (file: File) => {
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          const newFile: Omit<StoredFile, 'id'> = {
            name: file.name,
            type: file.type,
            size: file.size,
            content: content,
            isActive: true, // Activate new files by default
          };
          const savedFile = await storageService.saveFile(newFile);
          setStoredFiles(prevFiles => [...prevFiles, savedFile]);
        } catch (saveError) {
           console.error("Error saving file to storage:", saveError);
           setChatMessages(prev => [...prev, { id: `sys-err-file-save-${Date.now()}`, text: `Error saving file: ${String(saveError)}`, sender: MessageSender.SYSTEM, timestamp: new Date() }]);
        }
      };
      reader.onerror = (e) => {
        console.error("File reading error:", e);
        setChatMessages(prev => [...prev, { id: `sys-err-file-read-${Date.now()}`, text: "Error reading the selected file.", sender: MessageSender.SYSTEM, timestamp: new Date() }]);
      };
      reader.readAsText(file);
    } catch (uploadError) {
      console.error("Error handling file upload:", uploadError);
      setChatMessages(prev => [...prev, { id: `sys-err-file-upload-${Date.now()}`, text: `Error handling file upload: ${String(uploadError)}`, sender: MessageSender.SYSTEM, timestamp: new Date() }]);
    }
  };

  const handleFileToggle = async (id: number, isActive: boolean) => {
    const fileToUpdate = storedFiles.find(f => f.id === id);
    if (fileToUpdate) {
      try {
        const updatedFile = { ...fileToUpdate, isActive };
        await storageService.updateFile(updatedFile);
        setStoredFiles(prevFiles => prevFiles.map(f => f.id === id ? updatedFile : f));
      } catch (error) {
        console.error("Failed to toggle file status:", error);
        setChatMessages(prev => [...prev, { id: `sys-err-file-toggle-${Date.now()}`, text: `Error updating file status: ${String(error)}`, sender: MessageSender.SYSTEM, timestamp: new Date() }]);
      }
    }
  };

  const handleFileDelete = async (id: number) => {
    try {
      await storageService.deleteFile(id);
      setStoredFiles(prevFiles => prevFiles.filter(f => f.id !== id));
    } catch (error)      {
      console.error("Failed to delete file:", error);
      setChatMessages(prev => [...prev, { id: `sys-err-file-delete-${Date.now()}`, text: `Error deleting file: ${String(error)}`, sender: MessageSender.SYSTEM, timestamp: new Date() }]);
    }
  };

  const handleSendMessage = async (query: string) => {
    if (!query.trim() || isLoading || isFetchingSuggestions) return;

    const apiKey = process.env.API_KEY;
    if (!apiKey) {
       setChatMessages(prev => [...prev, {
        id: `error-apikey-${Date.now()}`,
        text: 'ERROR: API Key (process.env.API_KEY) is not configured. Please set it up to send messages.',
        sender: MessageSender.SYSTEM,
        timestamp: new Date(),
      }]);
      return;
    }
    
    setIsLoading(true);
    setInitialQuerySuggestions([]); 

    const activeFiles = storedFiles.filter(f => f.isActive);
    let fullQuery = query;

    if (activeFiles.length > 0) {
      const fileContext = activeFiles.map(file => 
        `--- START OF FILE: ${file.name} ---\n${file.content}\n--- END OF FILE: ${file.name} ---`
      ).join('\n\n');
      fullQuery = `Use the content from the following file(s) as context for my question.\n\n${fileContext}\n\nMy question is: ${query}`;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      text: query, // Show the user's original, shorter query
      sender: MessageSender.USER,
      timestamp: new Date(),
    };
    
    const modelPlaceholderMessage: ChatMessage = {
      id: `model-response-${Date.now()}`,
      text: 'Thinking...', 
      sender: MessageSender.MODEL,
      timestamp: new Date(),
      isLoading: true,
    };

    setChatMessages(prevMessages => [...prevMessages, userMessage, modelPlaceholderMessage]);

    try {
      let response;
      if (selectedModel === Model.CHAT_WITH_GOOGLE_SEARCH) {
        response = await generateContentWithGoogleSearch(fullQuery);
      } else { // Default to CHAT_WITH_DOCS
        response = await generateContentWithUrlContext(fullQuery, currentUrlsForChat);
      }
      
      setChatMessages(prevMessages =>
        prevMessages.map(msg =>
          msg.id === modelPlaceholderMessage.id
            ? { 
                ...modelPlaceholderMessage, 
                text: response.text || "I received an empty response.", 
                isLoading: false, 
                urlContext: response.urlContextMetadata,
                groundingMetadata: response.groundingMetadata,
              }
            : msg
        )
      );
    } catch (e: any) {
      const errorMessage = e.message || 'Failed to get response from AI.';
      setChatMessages(prevMessages =>
        prevMessages.map(msg =>
          msg.id === modelPlaceholderMessage.id
            ? { ...modelPlaceholderMessage, text: `Error: ${errorMessage}`, sender: MessageSender.SYSTEM, isLoading: false } 
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestedQueryClick = (query: string) => {
    handleSendMessage(query);
  };
  
  const handleCleanup = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
      inputAudioContextRef.current.close().catch(console.error);
    }
    inputAudioContextRef.current = null;

    if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
      outputAudioContextRef.current.close().catch(console.error);
    }
    outputAudioContextRef.current = null;
    
    audioSourcesRef.current.forEach(source => source.stop());
    audioSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    
    sessionPromiseRef.current = null;
    setIsRecording(false);
  }, []);
  
  const handleToggleRecording = async () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      setChatMessages(prev => [...prev, { id: `err-voice-no-key-${Date.now()}`, text: 'ERROR: API Key is not configured. Cannot start voice session.', sender: MessageSender.SYSTEM, timestamp: new Date() }]);
      return;
    }

    if (isRecording) {
      sessionPromiseRef.current?.then((session: any) => session.close());
      // onclose callback will trigger cleanup
      return;
    }

    setIsRecording(true);
    setChatMessages(prev => [...prev, { id: `status-${Date.now()}`, text: 'Connecting to voice session...', sender: MessageSender.SYSTEM, timestamp: new Date() }]);

    const ai = new GoogleGenAI({ apiKey });
    
    try {
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      const activeFiles = storedFiles.filter(f => f.isActive);
      let fileContextInstruction = '';
      if (activeFiles.length > 0) {
          fileContextInstruction = `In addition to the URLs, use the following file contents as primary context for your answers:\n\n` + activeFiles.map(file => 
              `--- START OF FILE: ${file.name} ---\n${file.content}\n--- END OF FILE: ${file.name} ---`
          ).join('\n\n');
      }
      const urlList = currentUrlsForChat.length > 0 ? `Please use the following URLs as context for your answers:\n${currentUrlsForChat.join('\n')}` : '';
      const systemInstruction = `You are a helpful documentation assistant. ${urlList} ${fileContextInstruction}`.trim();

      sessionPromiseRef.current = ai.live.connect({
        model: Model.VOICE_CONVERSATION,
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          systemInstruction: systemInstruction,
        },
        callbacks: {
          onopen: () => {
            if (!mediaStreamRef.current || !inputAudioContextRef.current) return;
            setChatMessages(prev => [...prev.filter(m => m.text !== 'Connecting to voice session...'), { id: `status-${Date.now()}`, text: 'Connection open. Start speaking.', sender: MessageSender.SYSTEM, timestamp: new Date() }]);
            const source = inputAudioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
            const scriptProcessor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
              const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionPromiseRef.current?.then((session: any) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContextRef.current.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.inputTranscription) {
              currentInputTranscription += message.serverContent.inputTranscription.text;
            }
            if (message.serverContent?.outputTranscription) {
              currentOutputTranscription += message.serverContent.outputTranscription.text;
            }
            if (message.serverContent?.turnComplete) {
              if (currentInputTranscription) {
                setChatMessages(prev => [...prev, { id: `user-voice-${Date.now()}`, text: currentInputTranscription, sender: MessageSender.USER, timestamp: new Date() }]);
              }
              if (currentOutputTranscription) {
                setChatMessages(prev => [...prev, { id: `model-voice-${Date.now()}`, text: currentOutputTranscription, sender: MessageSender.MODEL, timestamp: new Date() }]);
              }
              currentInputTranscription = '';
              currentOutputTranscription = '';
            }

            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current) {
              const ctx = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(ctx.destination);
              source.addEventListener('ended', () => audioSourcesRef.current.delete(source));
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              audioSourcesRef.current.add(source);
            }
            if (message.serverContent?.interrupted) {
              audioSourcesRef.current.forEach(source => source.stop());
              audioSourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onclose: () => {
            setChatMessages(prev => [...prev, { id: `status-${Date.now()}`, text: 'Voice session closed.', sender: MessageSender.SYSTEM, timestamp: new Date() }]);
            handleCleanup();
          },
          onerror: (e: ErrorEvent) => {
            console.error('Live session error:', e);
            setChatMessages(prev => [...prev, { id: `err-${Date.now()}`, text: `Voice session error: ${e.message}`, sender: MessageSender.SYSTEM, timestamp: new Date() }]);
            handleCleanup();
          },
        },
      });
    } catch (err: any) {
      console.error('Failed to start voice session:', err);
      let errorMessage = `Failed to start voice session: ${err.message}`;
      if (err.name === 'NotAllowedError') {
        errorMessage = 'Microphone access was denied. Please allow microphone permissions in your browser settings to use voice chat.';
      }
      setChatMessages(prev => [...prev, { id: `err-start-${Date.now()}`, text: errorMessage, sender: MessageSender.SYSTEM, timestamp: new Date() }]);
      handleCleanup();
    }
  };


  const chatPlaceholder = selectedModel === Model.VOICE_CONVERSATION
    ? "Select the microphone to start speaking."
    : (selectedModel === Model.CHAT_WITH_GOOGLE_SEARCH
      ? "Ask a question to search the web..."
      : ((currentUrlsForChat.length > 0 || activeFilesCount > 0)
        ? `Ask about "${activeGroup?.name}" ${activeFilesCount > 0 ? `and ${activeFilesCount} active file(s)` : ''}...`
        : "Add URLs or upload files to the knowledge base to enable chat."));


  return (
    <div 
      className="h-screen max-h-screen antialiased relative overflow-x-hidden bg-[#121212] text-[#E2E2E2]"
    >
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-20 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      
      <div className="flex h-full w-full md:p-4 md:gap-4">
        <div className={`
          fixed top-0 left-0 h-full w-11/12 max-w-sm z-30 transform transition-transform ease-in-out duration-300 p-3
          md:static md:p-0 md:w-1/3 lg:w-1/4 md:h-full md:max-w-none md:translate-x-0 md:z-auto
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <KnowledgeBaseManager
            urls={currentUrlsForChat}
            onAddUrl={handleAddUrl}
            onRemoveUrl={handleRemoveUrl}
            maxUrls={MAX_URLS}
            urlGroups={urlGroups}
            activeUrlGroupId={activeUrlGroupId}
            onSetGroupId={setActiveUrlGroupId}
            onCloseSidebar={() => setIsSidebarOpen(false)}
            files={storedFiles}
            onFileUpload={handleFileUpload}
            onFileToggle={handleFileToggle}
            onFileDelete={handleFileDelete}
          />
        </div>

        <div className="w-full h-full p-3 md:p-0 md:w-2/3 lg:w-3/4">
          <ChatInterface
            messages={chatMessages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            placeholderText={chatPlaceholder}
            initialQuerySuggestions={initialQuerySuggestions}
            onSuggestedQueryClick={handleSuggestedQueryClick}
            isFetchingSuggestions={isFetchingSuggestions}
            onToggleSidebar={() => setIsSidebarOpen(true)}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            isRecording={isRecording}
            onToggleRecording={handleToggleRecording}
          />
        </div>
      </div>
    </div>
  );
};

export default App;