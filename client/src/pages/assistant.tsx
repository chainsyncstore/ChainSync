import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { LightbulbIcon, ArrowRightIcon, SendIcon, AlertTriangleIcon, BotIcon } from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';

import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { apiRequest } from '@/lib/queryClient';
import { getInitials } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ConversationData {
  messages: Message[];
  id?: number;
  userId?: number;
}

export default function AssistantPage() {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Fetch conversation history with default value
  const { data: conversationData = { messages: [] }, isLoading: isLoadingConversation } =
    useQuery<ConversationData>({
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

  // Scroll to bottom of messages when new ones arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationData]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    sendMessageMutation.mutate(message);
    setMessage('');
  };

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800">AI Assistant</h1>
          <p className="text-neutral-500 mt-1">
            Get instant help and insights with our AI-powered assistant
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-9 col-span-1">
          <Card className="border shadow-sm h-[70vh] flex flex-col">
            <CardHeader className="border-b py-3 px-4">
              <CardTitle className="font-semibold text-lg flex items-center">
                <BotIcon className="h-5 w-5 mr-2 text-primary" />
                Dialogflow Assistant
                <span className="ml-2 bg-accent text-white text-xs py-0.5 px-2 rounded">
                  Powered by Google Dialogflow
                </span>
              </CardTitle>
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
              {isLoadingConversation ? (
                <div className="space-y-4 py-4">
                  <Skeleton className="h-12 w-2/3" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-12 w-1/2 ml-auto" />
                  <Skeleton className="h-16 w-3/4" />
                </div>
              ) : conversationData.messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <LightbulbIcon className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">How can I help you today?</h3>
                  <p className="text-muted-foreground max-w-md mb-6">
                    Ask me about inventory levels, sales performance, or any analytics data you're
                    looking for.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-lg">
                    {[
                      'Show me low stock items',
                      "What are today's sales?",
                      'Compare store performance',
                      'Check expiring inventory',
                    ].map(suggestion => (
                      <Button
                        key={suggestion}
                        variant="outline"
                        className="justify-start"
                        onClick={() => {
                          sendMessageMutation.mutate(suggestion);
                        }}
                      >
                        <ArrowRightIcon className="mr-2 h-4 w-4" />
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="py-4">
                  {conversationData.messages.map((msg, index) => (
                    <div
                      key={index}
                      className={`mb-4 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {msg.role === 'assistant' && (
                        <div className="flex-shrink-0 mr-3">
                          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white">
                            <LightbulbIcon className="w-5 h-5" />
                          </div>
                        </div>
                      )}

                      <div
                        className={`max-w-[75%] p-3 rounded-lg ${
                          msg.role === 'user'
                            ? 'bg-primary text-white rounded-tr-none ml-auto'
                            : 'bg-secondary/10 rounded-tl-none'
                        }`}
                      >
                        {msg.content.includes('Alert:') ? (
                          <div className="bg-amber-50 p-3 rounded-lg shadow-sm border border-amber-200">
                            <p className="font-medium flex items-center text-amber-700">
                              <AlertTriangleIcon className="w-4 h-4 mr-2" />
                              {msg.content}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <p className="whitespace-pre-line text-sm">{msg.content}</p>
                            <p className="text-xs opacity-70 mt-1">
                              {formatDistanceToNow(
                                new Date(
                                  Date.now() - (conversationData.messages.length - index) * 60000
                                ),
                                { addSuffix: true }
                              )}
                            </p>
                          </div>
                        )}
                      </div>

                      {msg.role === 'user' && (
                        <div className="flex-shrink-0 ml-3">
                          <div className="w-8 h-8 rounded-full bg-neutral-300 flex items-center justify-center text-neutral-700">
                            <div className="font-medium text-sm">
                              {getInitials(user?.fullName || 'User')}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </CardContent>

            <form onSubmit={handleSendMessage} className="p-4 border-t mt-auto">
              <div className="flex">
                <Input
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 mr-2"
                  disabled={sendMessageMutation.isPending}
                />
                <Button type="submit" disabled={!message.trim() || sendMessageMutation.isPending}>
                  {sendMessageMutation.isPending ? (
                    <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                  ) : (
                    <>
                      <SendIcon className="h-4 w-4 mr-2" />
                      Send
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Card>
        </div>

        <div className="lg:col-span-3 col-span-1">
          <Card className="border shadow-sm h-fit">
            <CardHeader className="border-b py-3 px-4">
              <CardTitle className="font-semibold text-lg">Features</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <ul className="space-y-3">
                <li className="flex items-start">
                  <div className="rounded-full bg-green-100 p-1 mr-3 mt-0.5">
                    <div className="rounded-full bg-green-500 w-2 h-2"></div>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm">Inventory Insights</h4>
                    <p className="text-xs text-muted-foreground">
                      Check stock levels, expiring items, and reorder suggestions
                    </p>
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="rounded-full bg-blue-100 p-1 mr-3 mt-0.5">
                    <div className="rounded-full bg-blue-500 w-2 h-2"></div>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm">Sales Analytics</h4>
                    <p className="text-xs text-muted-foreground">
                      Get real-time sales data and performance metrics
                    </p>
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="rounded-full bg-purple-100 p-1 mr-3 mt-0.5">
                    <div className="rounded-full bg-purple-500 w-2 h-2"></div>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm">Store Comparisons</h4>
                    <p className="text-xs text-muted-foreground">
                      Compare performance across multiple store locations
                    </p>
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="rounded-full bg-amber-100 p-1 mr-3 mt-0.5">
                    <div className="rounded-full bg-amber-500 w-2 h-2"></div>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm">Actionable Alerts</h4>
                    <p className="text-xs text-muted-foreground">
                      Receive proactive alerts about critical business issues
                    </p>
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
