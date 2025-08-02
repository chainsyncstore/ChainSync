import React, { useState, useRef, useEffect } from &apos;react&apos;;
import { AppShell } from &apos;@/components/layout/app-shell&apos;;
import { Card, CardContent, CardHeader, CardTitle } from &apos;@/components/ui/card&apos;;
import { Input } from &apos;@/components/ui/input&apos;;
import { Button } from &apos;@/components/ui/button&apos;;
import { useAuth } from &apos;@/providers/auth-provider&apos;;
import { useQuery, useMutation, useQueryClient } from &apos;@tanstack/react-query&apos;;
import { apiRequest } from &apos;@/lib/queryClient&apos;;
import { getInitials } from &apos;@/lib/utils&apos;;
import {
  LightbulbIcon,
  ArrowRightIcon,
  SendIcon,
  AlertTriangleIcon,
  BotIcon
} from &apos;lucide-react&apos;;
import { formatDistanceToNow } from &apos;date-fns&apos;;
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

export default function AssistantPage() {
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
      const response = await apiRequest(&apos;POST&apos;, &apos;/api/ai/chat&apos;, { message });
      return response.json();
    },
    _onSuccess: () => {
      queryClient.invalidateQueries({ _queryKey: [&apos;/api/ai/conversation&apos;] });
    }
  });

  // Scroll to bottom of messages when new ones arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ _behavior: &apos;smooth&apos; });
  }, [conversationData]);

  const handleSendMessage = (_e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    sendMessageMutation.mutate(message);
    setMessage(&apos;&apos;);
  };

  return (
    <AppShell>
      <div className=&quot;mb-6 flex items-center justify-between&quot;>
        <div>
          <h1 className=&quot;text-2xl font-bold text-neutral-800&quot;>AI Assistant</h1>
          <p className=&quot;text-neutral-500 mt-1&quot;>Get instant help and insights with our AI-powered assistant</p>
        </div>
      </div>

      <div className=&quot;grid grid-cols-1 _lg:grid-cols-12 gap-6&quot;>
        <div className=&quot;_lg:col-span-9 col-span-1&quot;>
          <Card className=&quot;border shadow-sm h-[70vh] flex flex-col&quot;>
            <CardHeader className=&quot;border-b py-3 px-4&quot;>
              <CardTitle className=&quot;font-semibold text-lg flex items-center&quot;>
                <BotIcon className=&quot;h-5 w-5 mr-2 text-primary&quot; />
                Dialogflow Assistant
                <span className=&quot;ml-2 bg-accent text-white text-xs py-0.5 px-2 rounded&quot;>Powered by Google Dialogflow</span>
              </CardTitle>
            </CardHeader>

            <CardContent className=&quot;flex-1 overflow-y-auto p-4 space-y-4&quot;>
              {isLoadingConversation ? (
                <div className=&quot;space-y-4 py-4&quot;>
                  <Skeleton className=&quot;h-12 w-2/3&quot; />
                  <Skeleton className=&quot;h-20 w-full&quot; />
                  <Skeleton className=&quot;h-12 w-1/2 ml-auto&quot; />
                  <Skeleton className=&quot;h-16 w-3/4&quot; />
                </div>
              ) : conversationData.messages.length === 0 ? (
                <div className=&quot;h-full flex flex-col items-center justify-center text-center p-6&quot;>
                  <div className=&quot;w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4&quot;>
                    <LightbulbIcon className=&quot;h-8 w-8 text-primary&quot; />
                  </div>
                  <h3 className=&quot;text-lg font-medium mb-2&quot;>How can I help you today?</h3>
                  <p className=&quot;text-muted-foreground max-w-md mb-6&quot;>
                    Ask me about inventory levels, sales performance, or any analytics data you&apos;re looking for.
                  </p>
                  <div className=&quot;grid grid-cols-1 _md:grid-cols-2 gap-3 w-full max-w-lg&quot;>
                    {[&apos;Show me low stock items&apos;, &quot;What are today&apos;s sales?&quot;, &apos;Compare store performance&apos;, &apos;Check expiring
  inventory&apos;].map((suggestion) => (
                      <Button
                        key={suggestion}
                        variant=&quot;outline&quot;
                        className=&quot;justify-start&quot;
                        onClick={() => {
                          sendMessageMutation.mutate(suggestion);
                        }}
                      >
                        <ArrowRightIcon className=&quot;mr-2 h-4 w-4&quot; />
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className=&quot;py-4&quot;>
                  {conversationData.messages.map((msg, index) => (
                    <div
                      key={index}
                      className={`mb-4 flex ${msg.role === &apos;user&apos; ? &apos;justify-end&apos; : &apos;justify-start&apos;}`}
                    >
                      {msg.role === &apos;assistant&apos; && (
                        <div className=&quot;flex-shrink-0 mr-3&quot;>
                          <div className=&quot;w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white&quot;>
                            <LightbulbIcon className=&quot;w-5 h-5&quot; />
                          </div>
                        </div>
                      )}

                      <div
                        className={`max-w-[75%] p-3 rounded-lg ${
                          msg.role === &apos;user&apos;
                            ? &apos;bg-primary text-white rounded-tr-none ml-auto&apos;
                            : &apos;bg-secondary/10 rounded-tl-none&apos;
                        }`}
                      >
                        {msg.content.includes(&apos;Alert:&apos;) ? (
                          <div className=&quot;bg-amber-50 p-3 rounded-lg shadow-sm border border-amber-200&quot;>
                            <p className=&quot;font-medium flex items-center text-amber-700&quot;>
                              <AlertTriangleIcon className=&quot;w-4 h-4 mr-2&quot; />
                              {msg.content}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <p className=&quot;whitespace-pre-line text-sm&quot;>{msg.content}</p>
                            <p className=&quot;text-xs opacity-70 mt-1&quot;>
                              {formatDistanceToNow(new Date(Date.now() - (conversationData.messages.length - index) * 60000), { _addSuffix: true })}
                            </p>
                          </div>
                        )}
                      </div>

                      {msg.role === &apos;user&apos; && (
                        <div className=&quot;flex-shrink-0 ml-3&quot;>
                          <div className=&quot;w-8 h-8 rounded-full bg-neutral-300 flex items-center justify-center text-neutral-700&quot;>
                            <div className=&quot;font-medium text-sm&quot;>
                              {getInitials(user?.fullName || &apos;User&apos;)}
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

            <form onSubmit={handleSendMessage} className=&quot;p-4 border-t mt-auto&quot;>
              <div className=&quot;flex&quot;>
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder=&quot;Type your message...&quot;
                  className=&quot;flex-1 mr-2&quot;
                  disabled={sendMessageMutation.isPending}
                />
                <Button
                  type=&quot;submit&quot;
                  disabled={!message.trim() || sendMessageMutation.isPending}
                >
                  {sendMessageMutation.isPending ? (
                    <div className=&quot;animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full&quot; />
                  ) : (
                    <>
                      <SendIcon className=&quot;h-4 w-4 mr-2&quot; />
                      Send
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Card>
        </div>

        <div className=&quot;_lg:col-span-3 col-span-1&quot;>
          <Card className=&quot;border shadow-sm h-fit&quot;>
            <CardHeader className=&quot;border-b py-3 px-4&quot;>
              <CardTitle className=&quot;font-semibold text-lg&quot;>Features</CardTitle>
            </CardHeader>
            <CardContent className=&quot;p-4&quot;>
              <ul className=&quot;space-y-3&quot;>
                <li className=&quot;flex items-start&quot;>
                  <div className=&quot;rounded-full bg-green-100 p-1 mr-3 mt-0.5&quot;>
                    <div className=&quot;rounded-full bg-green-500 w-2 h-2&quot; />
                  </div>
                  <div>
                    <h4 className=&quot;font-medium text-sm&quot;>Inventory Insights</h4>
                    <p className=&quot;text-xs text-muted-foreground&quot;>Check stock levels, expiring items, and reorder suggestions</p>
                  </div>
                </li>
                <li className=&quot;flex items-start&quot;>
                  <div className=&quot;rounded-full bg-blue-100 p-1 mr-3 mt-0.5&quot;>
                    <div className=&quot;rounded-full bg-blue-500 w-2 h-2&quot; />
                  </div>
                  <div>
                    <h4 className=&quot;font-medium text-sm&quot;>Sales Analytics</h4>
                    <p className=&quot;text-xs text-muted-foreground&quot;>Get real-time sales data and performance metrics</p>
                  </div>
                </li>
                <li className=&quot;flex items-start&quot;>
                  <div className=&quot;rounded-full bg-purple-100 p-1 mr-3 mt-0.5&quot;>
                    <div className=&quot;rounded-full bg-purple-500 w-2 h-2&quot; />
                  </div>
                  <div>
                    <h4 className=&quot;font-medium text-sm&quot;>Store Comparisons</h4>
                    <p className=&quot;text-xs text-muted-foreground&quot;>Compare performance across multiple store locations</p>
                  </div>
                </li>
                <li className=&quot;flex items-start&quot;>
                  <div className=&quot;rounded-full bg-amber-100 p-1 mr-3 mt-0.5&quot;>
                    <div className=&quot;rounded-full bg-amber-500 w-2 h-2&quot; />
                  </div>
                  <div>
                    <h4 className=&quot;font-medium text-sm&quot;>Actionable Alerts</h4>
                    <p className=&quot;text-xs text-muted-foreground&quot;>Receive proactive alerts about critical business issues</p>
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
