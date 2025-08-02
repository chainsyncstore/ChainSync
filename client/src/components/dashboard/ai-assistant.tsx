import React, { useState, useRef, useEffect } from &apos;react&apos;;
import { Card, CardContent, CardHeader } from &apos;@/components/ui/card&apos;;
import { Input } from &apos;@/components/ui/input&apos;;
import { Button } from &apos;@/components/ui/button&apos;;
import { useAuth } from &apos;@/providers/auth-provider&apos;;
import { useQuery, useMutation, useQueryClient } from &apos;@tanstack/react-query&apos;;
import { apiRequest } from &apos;@/lib/queryClient&apos;;
import { LightbulbIcon, ArrowRightIcon, SendIcon, AlertTriangleIcon } from &apos;lucide-react&apos;;
import { Skeleton } from &apos;@/components/ui/skeleton&apos;;

interface Message {
  _role: &apos;user&apos; | &apos;assistant&apos;;
  _content: string;
}

interface ConversationData {
  _messages: Message[];
  id?: number;
  userId?: number;
}

export function AiAssistant() {
  const { user } = useAuth();
  const [message, setMessage] = useState(&apos;&apos;);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Fetch conversation history with default value
  const { _data: conversationData = { messages: [] }, _isLoading: isLoadingConversation } = useQuery<ConversationData>({
    queryKey: [&apos;/api/ai/conversation&apos;]
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    _mutationFn: async(_message: string) => {
      return await apiRequest(&apos;POST&apos;, &apos;/api/ai/chat&apos;, { message });
    },
    _onSuccess: () => {
      queryClient.invalidateQueries({ _queryKey: [&apos;/api/ai/conversation&apos;] });
    }
  });

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ _behavior: &apos;smooth&apos; });
  }, [conversationData]);

  const handleSendMessage = (_e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    sendMessageMutation.mutate(message);
    setMessage(&apos;&apos;);
  };

  const renderMessages = () => {
    if (isLoadingConversation) {
      return [1, 2, 3].map((_, i) => (
        <div key={i} className={`flex items-start ${i % 2 === 0 ? &apos;&apos; : &apos;justify-end&apos;}`}>
          <Skeleton className={`w-8 h-8 rounded-full flex-shrink-0 ${i % 2 === 0 ? &apos;mr-3&apos; : &apos;ml-3 order-2&apos;}`} />
          <Skeleton className=&quot;h-24 w-4/5 rounded-lg&quot; />
        </div>
      ));
    }

    // Ensure conversationData and messages exist with proper type checks
    const messages = Array.isArray(conversationData?.messages) ? conversationData.messages : [];

    // The backend now always returns at least a welcome message
    // This is just a fallback in case no messages are returned
    if (messages.length === 0) {
      return (
        <div className=&quot;flex flex-col items-center justify-center h-48 text-center p-4&quot;>
          <LightbulbIcon className=&quot;w-12 h-12 text-primary mb-4 opacity-20&quot; />
          <p className=&quot;text-neutral-500&quot;>Ask me about sales trends, inventory levels, or store performance.</p>
          <p className=&quot;text-sm text-neutral-400 mt-2&quot;>Example: &quot;Show sales for Downtown Store vs Westside Mall last month&quot;</p>
        </div>
      );
    }

    return messages.map((_msg: Message, _index: number) => {
      if (msg.role === &apos;assistant&apos;) {
        return (
          <div key={index} className=&quot;flex items-start mb-4&quot;>
            <div className=&quot;flex-shrink-0 mr-3&quot;>
              <div className=&quot;w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white&quot;>
                <LightbulbIcon className=&quot;w-5 h-5&quot; />
              </div>
            </div>
            <div className=&quot;bg-white p-3 rounded-lg shadow-sm max-w-[85%] text-sm&quot;>
              {/* Check if this is an alert message */}
              {msg.content.includes(&apos;Alert:&apos;) ? (
                <div className=&quot;bg-amber-50 p-3 rounded-lg shadow-sm border border-amber-200&quot;>
                  <p className=&quot;font-medium flex items-center text-amber-700&quot;>
                    <AlertTriangleIcon className=&quot;w-4 h-4 mr-2&quot; />
                    {msg.content}
                  </p>
                </div>
              ) : (
                <p className=&quot;whitespace-pre-line&quot;>{msg.content}</p>
              )}
            </div>
          </div>
        );
      } else {
        return (
          <div key={index} className=&quot;flex items-start justify-end mb-4&quot;>
            <div className=&quot;bg-primary-50 p-3 rounded-lg shadow-sm max-w-[85%] text-sm&quot;>
              <p>{msg.content}</p>
            </div>
            <div className=&quot;flex-shrink-0 ml-3&quot;>
              <div className=&quot;w-8 h-8 rounded-full bg-neutral-300 flex items-center justify-center text-neutral-700&quot;>
                <span className=&quot;text-sm font-medium&quot;>{user?.fullName.split(&apos; &apos;).map(n => n[0]).join(&apos;&apos;)}</span>
              </div>
            </div>
          </div>
        );
      }
    });
  };

  return (
    <Card className=&quot;bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden h-full flex flex-col&quot;>
      <CardHeader className=&quot;p-4 border-b border-neutral-200 bg-primary-50&quot;>
        <div className=&quot;flex items-center justify-between&quot;>
          <div className=&quot;flex items-center&quot;>
            <div className=&quot;p-2 bg-primary rounded-full mr-3&quot;>
              <LightbulbIcon className=&quot;w-5 h-5 text-white&quot; />
            </div>
            <div>
              <h2 className=&quot;text-lg font-medium text-neutral-800&quot;>Dialogflow Assistant</h2>
              <p className=&quot;text-sm text-neutral-500&quot;>Powered by Google Dialogflow</p>
            </div>
          </div>
          <div className=&quot;flex items-center bg-amber-100 text-amber-700 text-xs rounded px-2 py-1&quot;>
            <AlertTriangleIcon className=&quot;w-3 h-3 mr-1&quot; />
            DEMO MODE
          </div>
        </div>
        <div className=&quot;mt-2 text-xs text-neutral-500 bg-white p-2 rounded border border-neutral-200&quot;>
          <p>This assistant is running in demo mode with mock responses. For full functionality, add <span
  className = &quot;font-mono bg-neutral-100 px-1 rounded&quot;>GOOGLE_APPLICATION_CREDENTIALS</span> and <span className=&quot;font-mono bg-neutral-100 px-1 rounded&quot;>DIALOGFLOW_PROJECT_ID</span> to your environment.</p>
        </div>
      </CardHeader>
      <CardContent className=&quot;flex-1 overflow-y-auto p-4 bg-neutral-50&quot;>
        <div className=&quot;space-y-4&quot;>
          {renderMessages()}
          <div ref={messagesEndRef} />
        </div>
      </CardContent>
      <div className=&quot;p-4 border-t border-neutral-200&quot;>
        <form onSubmit={handleSendMessage} className=&quot;flex&quot;>
          <Input
            type=&quot;text&quot;
            placeholder=&quot;Ask anything about your stores...&quot;
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className=&quot;flex-1 rounded-l-md&quot;
            disabled={sendMessageMutation.isPending}
          />
          <Button
            type=&quot;submit&quot;
            className=&quot;bg-primary text-white rounded-r-md _hover:bg-primary-600&quot;
            disabled={sendMessageMutation.isPending || !message.trim()}
          >
            {sendMessageMutation.isPending ? (
              <div className=&quot;w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin&quot; />
            ) : (
              <SendIcon className=&quot;w-5 h-5&quot; />
            )}
          </Button>
        </form>
      </div>
    </Card>
  );
}
