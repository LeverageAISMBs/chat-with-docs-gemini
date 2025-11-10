/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { ChatMessage, MessageSender, Model } from '../types'; 
import MessageItem from './MessageItem';
import { Send, Menu, Mic, Radio } from 'lucide-react';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (query: string) => void;
  isLoading: boolean;
  placeholderText?: string;
  initialQuerySuggestions?: string[];
  onSuggestedQueryClick?: (query: string) => void;
  isFetchingSuggestions?: boolean;
  onToggleSidebar?: () => void;
  selectedModel: Model;
  onModelChange: (model: Model) => void;
  isRecording: boolean;
  onToggleRecording: () => void;
  isSessionRecording: boolean;
  onToggleSessionRecording: () => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  messages, 
  onSendMessage, 
  isLoading, 
  placeholderText,
  initialQuerySuggestions,
  onSuggestedQueryClick,
  isFetchingSuggestions,
  onToggleSidebar,
  selectedModel,
  onModelChange,
  isRecording,
  onToggleRecording,
  isSessionRecording,
  onToggleSessionRecording,
}) => {
  const [userQuery, setUserQuery] = React.useState('');
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  React.useEffect(scrollToBottom, [messages]);

  const handleSend = () => {
    if (userQuery.trim() && !isLoading) {
      onSendMessage(userQuery.trim());
      setUserQuery('');
    }
  };

  const showSuggestions = initialQuerySuggestions && initialQuerySuggestions.length > 0 && messages.filter(m => m.sender !== MessageSender.SYSTEM).length <= 1;

  return (
    <div className="flex flex-col h-full bg-[#1E1E1E] rounded-xl shadow-md border border-[rgba(255,255,255,0.05)]">
      <div className="p-4 border-b border-[rgba(255,255,255,0.05)] flex justify-between items-center">
        <div className="flex items-center gap-3">
           {onToggleSidebar && (
            <button 
              onClick={onToggleSidebar}
              className="p-1.5 text-[#A8ABB4] hover:text-white rounded-md hover:bg-white/10 transition-colors md:hidden"
              aria-label="Open knowledge base"
            >
              <Menu size={20} />
            </button>
          )}
          <div>
            <h2 className="text-xl font-semibold text-[#E2E2E2]">Documentation Browser</h2>
            {placeholderText && messages.filter(m => m.sender !== MessageSender.SYSTEM).length === 0 && (
               <p className="text-xs text-[#A8ABB4] mt-1 max-w-md truncate" title={placeholderText}>{placeholderText}</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex-grow p-4 overflow-y-auto chat-container bg-[#282828]">
        <div className="max-w-4xl mx-auto w-full">
          {messages.map((msg) => (
            <MessageItem key={msg.id} message={msg} />
          ))}
          
          {isFetchingSuggestions && (
              <div className="flex justify-center items-center p-3">
                  <div className="flex items-center space-x-1.5 text-[#A8ABB4]">
                      <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce"></div>
                      <span className="text-sm">Fetching suggestions...</span>
                  </div>
              </div>
          )}

          {showSuggestions && onSuggestedQueryClick && (
            <div className="my-3 px-1">
              <p className="text-xs text-[#A8ABB4] mb-1.5 font-medium">Or try one of these: </p>
              <div className="flex flex-wrap gap-1.5">
                {initialQuerySuggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => onSuggestedQueryClick(suggestion)}
                    className="bg-[#79B8FF]/10 text-[#79B8FF] px-2.5 py-1 rounded-full text-xs hover:bg-[#79B8FF]/20 transition-colors shadow-sm"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="p-4 border-t border-[rgba(255,255,255,0.05)] bg-[#1E1E1E] rounded-b-xl">
        <div className="mb-2">
            <label htmlFor="model-select" className="block text-xs font-medium text-[#A8ABB4] mb-1">Interaction Mode</label>
            <select
                id="model-select"
                value={selectedModel}
                onChange={(e) => onModelChange(e.target.value as Model)}
                disabled={isRecording}
                className="w-full py-1.5 pl-3 pr-8 text-xs appearance-none border border-[rgba(255,255,255,0.1)] bg-[#2C2C2C] text-[#E2E2E2] rounded-md focus:ring-1 focus:ring-white/20 focus:border-white/20 disabled:opacity-50"
            >
                <option value={Model.CHAT_WITH_DOCS}>Chat with Docs (Text)</option>
                <option value={Model.CHAT_WITH_GOOGLE_SEARCH}>Chat with Google Search</option>
                <option value={Model.VOICE_CONVERSATION}>Voice Conversation</option>
            </select>
        </div>

        <div className="flex items-center gap-2">
          <textarea
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            placeholder={placeholderText}
            className="flex-grow h-8 min-h-[32px] py-1.5 px-2.5 border border-[rgba(255,255,255,0.1)] bg-[#2C2C2C] text-[#E2E2E2] placeholder-[#777777] rounded-lg focus:ring-1 focus:ring-white/20 focus:border-white/20 transition-shadow resize-none text-sm disabled:opacity-50"
            rows={1}
            disabled={isLoading || isFetchingSuggestions || selectedModel === Model.VOICE_CONVERSATION}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || isFetchingSuggestions || !userQuery.trim() || selectedModel === Model.VOICE_CONVERSATION}
            className="h-8 w-8 p-1.5 bg-white/[.12] hover:bg-white/20 text-white rounded-lg transition-colors disabled:bg-[#4A4A4A] disabled:text-[#777777] flex items-center justify-center flex-shrink-0"
            aria-label="Send message"
          >
            {(isLoading && messages[messages.length-1]?.isLoading && messages[messages.length-1]?.sender === MessageSender.MODEL) ? 
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> 
              : <Send size={16} />
            }
          </button>
          <button
            onClick={onToggleSessionRecording}
            disabled={isRecording || selectedModel !== Model.VOICE_CONVERSATION}
            className={`h-8 w-8 p-1.5 rounded-lg transition-colors flex items-center justify-center flex-shrink-0
              ${isSessionRecording ? 'bg-red-500/80 hover:bg-red-500/90 text-white' : 'bg-white/[.12] hover:bg-white/20 text-white'}
              disabled:bg-[#4A4A4A] disabled:text-[#777777] disabled:cursor-not-allowed
            `}
            aria-label={isSessionRecording ? "Disable recording for next session" : "Enable recording for next session"}
          >
            <Radio size={16} />
          </button>
          <button
            onClick={onToggleRecording}
            disabled={isLoading || isFetchingSuggestions || selectedModel !== Model.VOICE_CONVERSATION}
            className={`h-8 w-8 p-1.5 rounded-lg transition-colors flex items-center justify-center flex-shrink-0
              ${isRecording ? 'bg-red-500/80 hover:bg-red-500/90 text-white animate-pulse' : 'bg-white/[.12] hover:bg-white/20 text-white'}
              disabled:bg-[#4A4A4A] disabled:text-[#777777] disabled:cursor-not-allowed
            `}
            aria-label={isRecording ? "Stop voice session" : "Start voice session"}
          >
            <Mic size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;