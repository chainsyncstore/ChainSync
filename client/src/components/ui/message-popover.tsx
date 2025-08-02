import React, { useRef, useState } from &apos;react&apos;;
import { MessageSquare, X, ArrowRight } from &apos;lucide-react&apos;;
import { Button } from &apos;@/components/ui/button&apos;;
import { Card } from &apos;@/components/ui/card&apos;;
import { Popover, PopoverTrigger, PopoverContent } from &apos;@/components/ui/popover&apos;;
import { ScrollArea } from &apos;@/components/ui/scroll-area&apos;;
import { useAuth } from &apos;@/providers/auth-provider&apos;;
import { useQuery, useQueryClient, useMutation } from &apos;@tanstack/react-query&apos;;
import { apiRequest } from &apos;@/lib/queryClient&apos;;
import { Input } from &apos;@/components/ui/input&apos;;
import { formatDistanceToNow } from &apos;date-fns&apos;;
import { Link } from &apos;wouter&apos;;

// Interface for message data
interface Message {
  _role: &apos;user&apos; | &apos;assistant&apos;;
  _content: string;
}

interface ConversationData {
  _messages: Message[];
  id?: number;
  userId?: number;
}

export function MessagePopover() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(&apos;&apos;);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Fetch conversation history
  const { _data: conversationData = { messages: [] }, isLoading } = useQuery<ConversationData>({
    _queryKey: [&apos;/api/ai/conversation&apos;],
    // Only fetch when the popover is open to save resources
    _enabled: open
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

  // Scroll to bottom of messages when new ones arrive
  React.useEffect(() => {
    if (open) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ _behavior: &apos;smooth&apos; });
      }, 100);
    }
  }, [conversationData, open]);

  const handleSendMessage = (_e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    sendMessageMutation.mutate(message);
    setMessage(&apos;&apos;);
  };

  // Check if we have unread messages
  const hasUnreadMessages = conversationData.messages.length > 0 &&
    conversationData.messages[conversationData.messages.length - 1].role === &apos;assistant&apos;;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant=&quot;ghost&quot; size=&quot;icon&quot; className=&quot;relative mr-4 text-neutral-500 _hover:text-primary&quot;>
          {hasUnreadMessages && (
            <span className=&quot;absolute top-0 right-0 w-2 h-2 bg-accent rounded-full&quot; />
          )}
          <MessageSquare className=&quot;h-6 w-6&quot; />
        </Button>
      </PopoverTrigger>

      <PopoverContent align=&quot;end&quot; className=&quot;p-0 w-[350px] _md:w-[400px]&quot;>
        <Card className=&quot;border-0 shadow-none&quot;>
          <div className=&quot;flex items-center justify-between border-b p-3&quot;>
            <h3 className=&quot;font-medium&quot;>AI Assistant</h3>
            <div className=&quot;flex space-x-2&quot;>
              <Link href=&quot;/assistant&quot;>
                <Button variant=&quot;ghost&quot; size=&quot;sm&quot; className=&quot;h-8 px-2 text-muted-foreground&quot;>
                  Full View <ArrowRight className=&quot;ml-1 h-4 w-4&quot; />
                </Button>
              </Link>
              <Button variant=&quot;ghost&quot; size=&quot;sm&quot; className=&quot;h-8 px-2&quot; onClick={() => setOpen(false)}>
                <X className=&quot;h-4 w-4&quot; />
              </Button>
            </div>
          </div>

          <ScrollArea className=&quot;h-[300px] p-3&quot;>
            {isLoading ? (
              <div className=&quot;flex items-center justify-center h-full&quot;>
                <div className=&quot;animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full&quot; />
              </div>
            ) : (
              <>
                {conversationData.messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`mb-3 ${msg.role === &apos;user&apos; ? &apos;text-right&apos; : &apos;text-left&apos;}`}
                  >
                    <div
                      className={`inline-block p-2 rounded-lg max-w-[85%] text-sm ${
                        msg.role === &apos;user&apos;
                          ? &apos;bg-primary text-white&apos;
                          : &apos;bg-muted&apos;
                      }`}
                    >
                      {msg.content}
                    </div>
                    <div className=&quot;text-xs text-muted-foreground mt-1&quot;>
                      {formatDistanceToNow(new Date(Date.now() - (conversationData.messages.length - index) * 60000), { _addSuffix: true })}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </ScrollArea>

          <form onSubmit={handleSendMessage} className=&quot;border-t p-3&quot;>
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
                size=&quot;sm&quot;
                disabled={!message.trim() || sendMessageMutation.isPending}
              >
                {sendMessageMutation.isPending ? (
                  <div className=&quot;animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full&quot; />
                ) : (
                  &apos;Send&apos;
                )}
              </Button>
            </div>
          </form>
        </Card>
      </PopoverContent>
    </Popover>
  );
}
