import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useFirestoreCollection } from '@/hooks/useFirestore';
import { where } from 'firebase/firestore';
import { Session } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, User, BookOpen, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SessionsView() {
  const { profile, isStudent, isMentor } = useAuth();
  
  const queryConstraints = [];
  if (isStudent) {
    queryConstraints.push(where('studentId', '==', profile?.uid || ''));
  } else if (isMentor) {
    queryConstraints.push(where('mentorId', '==', profile?.uid || ''));
  }

  const { data: sessions, loading } = useFirestoreCollection<Session>('sessions', queryConstraints);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'completed': return 'bg-green-100 text-green-700 border-green-200';
      case 'cancelled': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-serif font-bold tracking-tight text-gray-900">
          {isStudent ? 'My Learning Sessions' : 'My Mentoring Sessions'}
        </h1>
        <p className="text-muted-foreground">
          {isStudent ? 'Track and manage your upcoming and past sessions with your mentors.' : 'Manage your schedule and provide feedback for your students.'}
        </p>
      </div>

      <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="text-lg font-serif">Session Schedule</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Date & Time</TableHead>
                <TableHead>{isStudent ? 'Mentor' : 'Student'}</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Feedback</TableHead>
                <TableHead className="text-right">Rating</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <div className="flex items-center justify-center gap-2">
                      <Clock className="w-5 h-5 animate-spin text-primary" />
                      <span>Loading sessions...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : sessions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    No sessions found.
                  </TableCell>
                </TableRow>
              ) : (
                sessions.sort((a, b) => b.date - a.date).map((session) => (
                  <TableRow key={session.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <div className="flex flex-col">
                          <span className="font-medium">{new Date(session.date).toLocaleDateString()}</span>
                          <span className="text-xs text-muted-foreground">{new Date(session.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span>{isStudent ? 'Mentor Name' : 'Student Name'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-muted-foreground" />
                        <span className="max-w-[150px] truncate">Course Title</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider", getStatusColor(session.status))}>
                        {session.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate italic text-sm text-muted-foreground">
                      {session.feedback || 'No feedback yet'}
                    </TableCell>
                    <TableCell className="text-right">
                      {session.rating ? (
                        <div className="flex items-center justify-end gap-1 text-yellow-600">
                          <Star className="w-3 h-3 fill-current" />
                          <span className="font-bold">{session.rating}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
