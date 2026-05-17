import React from 'react';
import { useFirestoreCollection } from '@/hooks/useFirestore';
import { Notification } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { where, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, MessageSquare, CreditCard, Calendar, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function NotificationsView() {
  const { profile } = useAuth();
  const { data: notifications } = useFirestoreCollection<Notification>('notifications', [
    where('userId', '==', profile?.uid || '')
  ]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'message': return <MessageSquare className="w-4 h-4" />;
      case 'payment': return <CreditCard className="w-4 h-4" />;
      case 'session': return <Calendar className="w-4 h-4" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">Notifications</h2>
        <Button variant="outline" size="sm">Mark all as read</Button>
      </div>

      <div className="space-y-4">
        {notifications.sort((a, b) => b.timestamp - a.timestamp).map((n) => (
          <Card key={n.id} className={cn("transition-colors", !n.read && "bg-primary/5 border-primary/20")}>
            <CardContent className="p-4 flex gap-4 items-start">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                !n.read ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                {getIcon(n.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <h4 className="text-sm font-semibold">{n.title}</h4>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(n.timestamp).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{n.message}</p>
              </div>
              {!n.read && (
                <Button variant="ghost" size="icon" onClick={() => markAsRead(n.id)}>
                  <Check className="w-4 h-4" />
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
        {notifications.length === 0 && (
          <div className="text-center py-20 border-2 border-dashed rounded-xl">
            <Bell className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No notifications</h3>
            <p className="text-muted-foreground">We'll alert you when something important happens.</p>
          </div>
        )}
      </div>
    </div>
  );
}
