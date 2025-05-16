import React, { useRef, useState } from 'react';
import { MessageSquare, X, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/providers/auth-provider';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Input } from '@/components/ui/input';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'wouter';

// Interface for message data
interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ConversationData {
  messages: Message[];
  id?: number;
  userId?: number;
}

export function MessagePopover() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  
  // Fetch conversation history
  const { data: conversationData = { messages: [] }, isLoading } = useQuery<ConversationData>({
    queryKey: ['/api/ai/conversation'],
    // Only fetch when the popover is open to save resources
    enabled: open,
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
  React.useEffect(() => {
    if (open) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [conversationData, open]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    sendMessageMutation.mutate(message);
    setMessage('');
  };
  
  // Check if we have unread messages
  const hasUnreadMessages = conversationData.messages.length > 0 && 
    conversationData.messages[conversationData.messages.length - 1].role === 'assistant';
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative mr-4 text-neutral-500 hover:text-primary">
          {hasUnreadMessages && (
            <span className="absolute top-0 right-0 w-2 h-2 bg-accent rounded-full"></span>
          )}
          <MessageSquare className="h-6 w-6" />
        </Button>
      </PopoverTrigger>
      
      <PopoverContent align="end" className="p-0 w-[350px] md:w-[400px]">
        <Card className="border-0 shadow-none">
          <div className="flex items-center justify-between border-b p-3">
            <h3 className="font-medium">AI Assistant</h3>
            <div className="flex space-x-2">
              <Link href="/assistant">
                <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground">
                  Full View <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
              <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <ScrollArea className="h-[300px] p-3">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full"></div>
              </div>
            ) : (
              <>
                {conversationData.messages.map((msg, index) => (
                  <div 
                    key={index} 
                    className={`mb-3 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}
                  >
                    <div 
                      className={`inline-block p-2 rounded-lg max-w-[85%] text-sm ${
                        msg.role === 'user' 
                          ? 'bg-primary text-white'
                          : 'bg-muted'
                      }`}
                    >
                      {msg.content}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(Date.now() - (conversationData.messages.length - index) * 60000), { addSuffix: true })}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </ScrollArea>
          
          <form onSubmit={handleSendMessage} className="border-t p-3">
            <div className="flex">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 mr-2"
                disabled={sendMessageMutation.isPending}
              />
              <Button 
                type="submit" 
                size="sm"
                disabled={!message.trim() || sendMessageMutation.isPending}
              >
                {sendMessageMutation.isPending ? (
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                ) : (
                  'Send'
                )}
              </Button>
            </div>
          </form>
        </Card>
      </PopoverContent>
    </Popover>
  );
}