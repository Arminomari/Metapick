import { useEffect, useRef, useState } from 'react';
import { useChatMessages, useSendMessage, useMarkChatRead } from '@/hooks/api';
import { useAuthStore } from '@/stores/authStore';
import type { ChatMessageDto } from '@/types';
import { Button } from './index';

interface ChatPanelProps {
  assignmentId: string;
}

export function ChatPanel({ assignmentId }: ChatPanelProps) {
  const { userId } = useAuthStore();
  const { data: messages = [], isLoading } = useChatMessages(assignmentId);
  const send = useSendMessage();
  const markRead = useMarkChatRead();
  const [body, setBody] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark read when panel opens
  useEffect(() => {
    if (assignmentId) {
      markRead.mutate(assignmentId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    try {
      await send.mutateAsync({ assignmentId, body: trimmed });
      setBody('');
    } catch {
      alert('Kunde inte skicka meddelandet');
    }
  };

  const isOwn = (msg: ChatMessageDto) => msg.senderId === userId;

  return (
    <div className="flex flex-col h-[420px] border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <h3 className="font-semibold text-sm">Meddelanden</h3>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading && (
          <p className="text-sm text-muted-foreground text-center">Laddar...</p>
        )}
        {!isLoading && messages.length === 0 && (
          <p className="text-sm text-muted-foreground text-center">Inga meddelanden än. Starta konversationen!</p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${isOwn(msg) ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${
              isOwn(msg)
                ? 'bg-primary text-primary-foreground rounded-br-sm'
                : 'bg-muted rounded-bl-sm'
            }`}>
              {!isOwn(msg) && (
                <p className="text-xs font-medium mb-0.5 opacity-70">{msg.senderName}</p>
              )}
              <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
              <p className={`text-xs mt-1 opacity-60 ${isOwn(msg) ? 'text-right' : ''}`}>
                {new Date(msg.createdAt).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                {isOwn(msg) && (
                  <span className="ml-1">{msg.isRead ? '✓✓' : '✓'}</span>
                )}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="border-t border-border p-3 flex gap-2">
        <input
          type="text"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Skriv ett meddelande..."
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend(e as unknown as React.FormEvent);
            }
          }}
        />
        <Button type="submit" size="sm" disabled={send.isPending || !body.trim()}>
          Skicka
        </Button>
      </form>
    </div>
  );
}
