import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useFirestoreCollection } from '@/hooks/useFirestore';
import { Chat, Message, UserProfile } from '@/types';
import { db } from '@/lib/firebase';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  where,
  Timestamp,
  doc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Search, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ChatModule() {
  const { profile } = useAuth();
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: chats } = useFirestoreCollection<Chat>('chats', [
    where('participants', 'array-contains', profile?.uid || '')
  ]);

  const { data: allUsers } = useFirestoreCollection<UserProfile>('users');

  useEffect(() => {
    if (!selectedChat) return;

    const q = query(
      collection(db, 'chats', selectedChat.id, 'messages'),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: Message[] = [];
      snapshot.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() } as Message);
      });
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [selectedChat]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat || !profile) return;

    const messageData = {
      chatId: selectedChat.id,
      senderId: profile.uid,
      content: newMessage,
      timestamp: Date.now()
    };

    try {
      await addDoc(collection(db, 'chats', selectedChat.id, 'messages'), messageData);
      await updateDoc(doc(db, 'chats', selectedChat.id), {
        lastMessage: newMessage,
        lastTimestamp: Date.now()
      });
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const getOtherParticipant = (chat: Chat) => {
    const otherId = chat.participants.find(id => id !== profile?.uid);
    return allUsers.find(u => u.uid === otherId);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-12rem)]">
      {/* Chat List */}
      <Card className="md:col-span-1 flex flex-col overflow-hidden">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Messages</CardTitle>
            <Button variant="ghost" size="icon">
              <Search className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <ScrollArea className="flex-1">
          <div className="divide-y">
            {chats.map((chat) => {
              const otherUser = getOtherParticipant(chat);
              return (
                <button
                  key={chat.id}
                  onClick={() => setSelectedChat(chat)}
                  className={cn(
                    "w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors text-left",
                    selectedChat?.id === chat.id && "bg-muted"
                  )}
                >
                  <Avatar>
                    <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUser?.name}`} />
                    <AvatarFallback>{otherUser?.name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm font-semibold truncate">{otherUser?.name}</span>
                      {chat.lastTimestamp && (
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(chat.lastTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{chat.lastMessage || "Start a conversation"}</p>
                  </div>
                </button>
              );
            })}
            {chats.length === 0 && (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No conversations yet.
              </div>
            )}
          </div>
        </ScrollArea>
      </Card>

      {/* Chat Window */}
      <Card className="md:col-span-2 flex flex-col overflow-hidden">
        {selectedChat ? (
          <>
            <CardHeader className="border-b py-3 px-4">
              <div className="flex items-center gap-3">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${getOtherParticipant(selectedChat)?.name}`} />
                  <AvatarFallback>{getOtherParticipant(selectedChat)?.name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-sm font-semibold">{getOtherParticipant(selectedChat)?.name}</CardTitle>
                  <p className="text-[10px] text-muted-foreground">Online</p>
                </div>
              </div>
            </CardHeader>
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex flex-col max-w-[80%] gap-1",
                      msg.senderId === profile?.uid ? "ml-auto items-end" : "items-start"
                    )}
                  >
                    <div
                      className={cn(
                        "px-4 py-2 rounded-2xl text-sm",
                        msg.senderId === profile?.uid
                          ? "bg-primary text-primary-foreground rounded-tr-none"
                          : "bg-muted rounded-tl-none"
                      )}
                    >
                      {msg.content}
                    </div>
                    <span className="text-[10px] text-muted-foreground px-1">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
                <div ref={scrollRef} />
              </div>
            </ScrollArea>
            <div className="p-4 border-t">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <Input
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" size="icon">
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold">Your Messages</h3>
            <p className="text-sm max-w-xs">Select a conversation from the list to start chatting with your mentors or students.</p>
          </div>
        )}
      </Card>
    </div>
  );
}
