import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/providers/auth-provider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { LightbulbIcon, ArrowRightIcon, SendIcon, AlertTriangleIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ConversationData {
  messages: Message[];
  id?: number;
  userId?: number;
}

export function AiAssistant() {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  
  // Fetch conversation history with default value
  const { data: conversationData = { messages: [] }, isLoading: isLoadingConversation } = useQuery<ConversationData>({
    queryKey: ['/api/ai/conversation'],
  });
  
  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest('POST', '/api/ai/chat', { message });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai/conversation'] });
    },
  });

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationData]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    sendMessageMutation.mutate(message);
    setMessage('');
  };

  const renderMessages = () => {
    if (isLoadingConversation) {
      return [1, 2, 3].map((_, i) => (
        <div key={i} className={`flex items-start ${i % 2 === 0 ? '' : 'justify-end'}`}>
          <Skeleton className={`w-8 h-8 rounded-full flex-shrink-0 ${i % 2 === 0 ? 'mr-3' : 'ml-3 order-2'}`} />
          <Skeleton className="h-24 w-4/5 rounded-lg" />
        </div>
      ));
    }

    // Ensure conversationData and messages exist with proper type checks
    const messages = Array.isArray(conversationData?.messages) ? conversationData.messages : [];
    
    if (messages.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-48 text-center p-4">
          <LightbulbIcon className="w-12 h-12 text-primary mb-4 opacity-20" />
          <p className="text-neutral-500">Ask me about sales trends, inventory levels, or store performance.</p>
          <p className="text-sm text-neutral-400 mt-2">Example: "Show sales for Downtown Store vs Westside Mall last month"</p>
        </div>
      );
    }

    return messages.map((msg: Message, index: number) => {
      if (msg.role === 'assistant') {
        return (
          <div key={index} className="flex items-start mb-4">
            <div className="flex-shrink-0 mr-3">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white">
                <LightbulbIcon className="w-5 h-5" />
              </div>
            </div>
            <div className="bg-white p-3 rounded-lg shadow-sm max-w-[85%] text-sm">
              {/* Check if this is an alert message */}
              {msg.content.includes('Alert:') ? (
                <div className="bg-amber-50 p-3 rounded-lg shadow-sm border border-amber-200">
                  <p className="font-medium flex items-center text-amber-700">
                    <AlertTriangleIcon className="w-4 h-4 mr-2" />
                    {msg.content}
                  </p>
                </div>
              ) : (
                <p className="whitespace-pre-line">{msg.content}</p>
              )}
            </div>
          </div>
        );
      } else {
        return (
          <div key={index} className="flex items-start justify-end mb-4">
            <div className="bg-primary-50 p-3 rounded-lg shadow-sm max-w-[85%] text-sm">
              <p>{msg.content}</p>
            </div>
            <div className="flex-shrink-0 ml-3">
              <div className="w-8 h-8 rounded-full bg-neutral-300 flex items-center justify-center text-neutral-700">
                <span className="text-sm font-medium">{user?.fullName.split(' ').map(n => n[0]).join('')}</span>
              </div>
            </div>
          </div>
        );
      }
    });
  };

  return (
    <Card className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden h-full flex flex-col">
      <CardHeader className="p-4 border-b border-neutral-200 bg-primary-50">
        <div className="flex items-center">
          <div className="p-2 bg-primary rounded-full mr-3">
            <LightbulbIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-medium text-neutral-800">Dialogflow Assistant</h2>
            <p className="text-sm text-neutral-500">Powered by Google Dialogflow</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto p-4 bg-neutral-50">
        <div className="space-y-4">
          {renderMessages()}
          <div ref={messagesEndRef} />
        </div>
      </CardContent>
      <div className="p-4 border-t border-neutral-200">
        <form onSubmit={handleSendMessage} className="flex">
          <Input
            type="text"
            placeholder="Ask anything about your stores..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="flex-1 rounded-l-md"
            disabled={sendMessageMutation.isPending}
          />
          <Button 
            type="submit" 
            className="bg-primary text-white rounded-r-md hover:bg-primary-600" 
            disabled={sendMessageMutation.isPending || !message.trim()}
          >
            {sendMessageMutation.isPending ? (
              <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
            ) : (
              <SendIcon className="w-5 h-5" />
            )}
          </Button>
        </form>
      </div>
    </Card>
  );
}
