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
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Send, MessageSquare, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function ChatModule() {
  const { profile } = useAuth();
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [targetUid, setTargetUid] = useState('');
  const [startingChat, setStartingChat] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: chats } = useFirestoreCollection<Chat>('chats', [
    where('participants', 'array-contains', profile?.uid || ''),
  ]);

  const { data: allUsers } = useFirestoreCollection<UserProfile>('users', [], { maxDocs: 200 });

  const eligibleContacts = allUsers.filter(
    (u) => u.uid !== profile?.uid && ['mentor', 'student', 'admin'].includes(u.role),
  );

  const startOrOpenChat = async () => {
    if (!profile?.uid || !targetUid) {
      toast.error('Select someone to message.');
      return;
    }
    setStartingChat(true);
    try {
      const pair = [profile.uid, targetUid].sort();
      const chatId = `${pair[0]}__${pair[1]}`;
      const chatRef = doc(db, 'chats', chatId);
      const existing = await getDoc(chatRef);
      if (existing.exists()) {
        setSelectedChat({ id: chatId, ...(existing.data() as Omit<Chat, 'id'>) });
      } else {
        await setDoc(chatRef, {
          participants: pair,
          lastMessage: '',
          lastTimestamp: Date.now(),
        });
        setSelectedChat({
          id: chatId,
          participants: pair,
          lastMessage: '',
          lastTimestamp: Date.now(),
        });
      }
      setNewChatOpen(false);
      setTargetUid('');
    } catch (err) {
      console.error(err);
      toast.error('Could not start conversation.');
    } finally {
      setStartingChat(false);
    }
  };

  useEffect(() => {
    if (!selectedChat) return;

    const q = query(
      collection(db, 'chats', selectedChat.id, 'messages'),
      orderBy('timestamp', 'asc'),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: Message[] = [];
      snapshot.forEach((d) => {
        msgs.push({ id: d.id, ...d.data() } as Message);
      });
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [selectedChat]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat || !profile) return;

    const messageData = {
      chatId: selectedChat.id,
      senderId: profile.uid,
      content: newMessage,
      timestamp: Date.now(),
    };

    try {
      await addDoc(collection(db, 'chats', selectedChat.id, 'messages'), messageData);
      await updateDoc(doc(db, 'chats', selectedChat.id), {
        lastMessage: newMessage,
        lastTimestamp: Date.now(),
      });
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const getOtherParticipant = (chat: Chat) => {
    const otherId = chat.participants.find((id) => id !== profile?.uid);
    return allUsers.find((u) => u.uid === otherId);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-12rem)]">
      <Card className="md:col-span-1 flex flex-col overflow-hidden">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-lg">Messages</CardTitle>
            <Dialog open={newChatOpen} onOpenChange={setNewChatOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1">
                  <UserPlus className="h-4 w-4" />
                  New
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New conversation</DialogTitle>
                  <DialogDescription>
                    Chats are de-duplicated by participant pair. Pick a mentor, student, or admin.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-2 py-2">
                  <Label>Contact</Label>
                  <Select value={targetUid} onValueChange={setTargetUid}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a user" />
                    </SelectTrigger>
                    <SelectContent>
                      {eligibleContacts.map((u) => (
                        <SelectItem key={u.uid} value={u.uid}>
                          {u.name} ({u.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button type="button" onClick={() => void startOrOpenChat()} disabled={startingChat}>
                    {startingChat ? 'Opening…' : 'Open chat'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <ScrollArea className="flex-1">
          <div className="divide-y">
            {chats.map((chat) => {
              const otherUser = getOtherParticipant(chat);
              return (
                <button
                  key={chat.id}
                  type="button"
                  onClick={() => setSelectedChat(chat)}
                  className={cn(
                    'w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors text-left',
                    selectedChat?.id === chat.id && 'bg-muted',
                  )}
                >
                  <Avatar>
                    <AvatarImage
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUser?.name}`}
                    />
                    <AvatarFallback>{otherUser?.name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm font-semibold truncate">{otherUser?.name}</span>
                      {chat.lastTimestamp && (
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(chat.lastTimestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {chat.lastMessage || 'Start a conversation'}
                    </p>
                  </div>
                </button>
              );
            })}
            {chats.length === 0 && (
              <div className="p-8 text-center text-muted-foreground text-sm">No conversations yet.</div>
            )}
          </div>
        </ScrollArea>
      </Card>

      <Card className="md:col-span-2 flex flex-col overflow-hidden">
        {selectedChat ? (
          <>
            <CardHeader className="border-b py-3 px-4">
              <div className="flex items-center gap-3">
                <Avatar className="w-8 h-8">
                  <AvatarImage
                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${getOtherParticipant(selectedChat)?.name}`}
                  />
                  <AvatarFallback>{getOtherParticipant(selectedChat)?.name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-sm font-semibold">
                    {getOtherParticipant(selectedChat)?.name}
                  </CardTitle>
                  <p className="text-[10px] text-muted-foreground">Direct message</p>
                </div>
              </div>
            </CardHeader>
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex flex-col max-w-[80%] gap-1',
                      msg.senderId === profile?.uid ? 'ml-auto items-end' : 'items-start',
                    )}
                  >
                    <div
                      className={cn(
                        'px-4 py-2 rounded-2xl text-sm',
                        msg.senderId === profile?.uid
                          ? 'bg-primary text-primary-foreground rounded-tr-none'
                          : 'bg-muted rounded-tl-none',
                      )}
                    >
                      {msg.content}
                    </div>
                    <span className="text-[10px] text-muted-foreground px-1">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
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
            <p className="text-sm max-w-xs">
              Select a conversation or start a new one. Each pair of users shares one thread.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
