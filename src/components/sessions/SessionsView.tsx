import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useFirestoreCollection } from '@/hooks/useFirestore';
import { Session } from '@/types';
import { where, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar, CheckCircle, XCircle, Star, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

function statusVariant(status: string) {
  if (status === 'completed') return 'default';
  if (status === 'cancelled') return 'destructive';
  return 'secondary';
}

export default function SessionsView() {
  const { profile, isMentor, isStudent } = useAuth();

  const constraints = isMentor
    ? [where('mentorId', '==', profile?.uid || '')]
    : [where('studentId', '==', profile?.uid || '')];

  const { data: sessions, loading } = useFirestoreCollection<Session>('sessions', constraints);

  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Feedback dialog state (student)
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackSession, setFeedbackSession] = useState<Session | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackRating, setFeedbackRating] = useState('5');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const sorted = [...sessions].sort((a, b) => b.date - a.date);

  const handleUpdateStatus = async (session: Session, status: 'completed' | 'cancelled') => {
    setUpdatingId(session.id);
    try {
      await updateDoc(doc(db, 'sessions', session.id), { status });
      toast.success(`Session marked as ${status}.`);
    } catch (err) {
      console.error(err);
      toast.error('Could not update session status.');
    } finally {
      setUpdatingId(null);
    }
  };

  const openFeedbackDialog = (session: Session) => {
    setFeedbackSession(session);
    setFeedbackText(session.feedback ?? '');
    setFeedbackRating(String(session.rating ?? 5));
    setFeedbackOpen(true);
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackSession) return;
    const rating = parseInt(feedbackRating, 10);
    if (!feedbackText.trim() || isNaN(rating) || rating < 1 || rating > 5) {
      toast.error('Enter feedback and a rating between 1 and 5.');
      return;
    }
    setSubmittingFeedback(true);
    try {
      await updateDoc(doc(db, 'sessions', feedbackSession.id), {
        feedback: feedbackText.trim(),
        rating,
      });
      toast.success('Feedback submitted.');
      setFeedbackOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Could not submit feedback.');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Sessions</h2>
        <p className="text-muted-foreground">
          {isMentor
            ? 'Manage your scheduled and completed sessions.'
            : 'Your learning sessions and feedback history.'}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Upcoming</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {sessions.filter(s => s.status === 'scheduled' && s.date > Date.now()).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {sessions.filter(s => s.status === 'completed').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cancelled</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {sessions.filter(s => s.status === 'cancelled').length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date & Time</TableHead>
                {isMentor && <TableHead>Student ID</TableHead>}
                {isStudent && <TableHead>Mentor ID</TableHead>}
                <TableHead>Status</TableHead>
                <TableHead>Feedback</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10">
                    <Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…
                  </TableCell>
                </TableRow>
              )}
              {!loading && sorted.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{new Date(s.date).toLocaleString()}</span>
                    </div>
                  </TableCell>
                  {isMentor && (
                    <TableCell className="text-xs text-muted-foreground font-mono">{s.studentId}</TableCell>
                  )}
                  {isStudent && (
                    <TableCell className="text-xs text-muted-foreground font-mono">{s.mentorId}</TableCell>
                  )}
                  <TableCell>
                    <Badge variant={statusVariant(s.status)} className="capitalize">
                      {s.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate text-sm text-muted-foreground">
                    {s.feedback ?? '—'}
                  </TableCell>
                  <TableCell>
                    {s.rating ? (
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 fill-primary text-primary" />
                        <span className="text-sm">{s.rating}/5</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {isMentor && s.status === 'scheduled' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-green-700 border-green-300 hover:bg-green-50"
                            disabled={updatingId === s.id}
                            onClick={() => handleUpdateStatus(s, 'completed')}
                          >
                            {updatingId === s.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <CheckCircle className="w-3 h-3" />
                            )}
                            Complete
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                            disabled={updatingId === s.id}
                            onClick={() => handleUpdateStatus(s, 'cancelled')}
                          >
                            <XCircle className="w-3 h-3" />
                            Cancel
                          </Button>
                        </>
                      )}
                      {isStudent && s.status === 'completed' && !s.feedback && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => openFeedbackDialog(s)}
                        >
                          <Star className="w-3 h-3" />
                          Leave Feedback
                        </Button>
                      )}
                      {isStudent && s.status === 'completed' && s.feedback && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openFeedbackDialog(s)}
                        >
                          Edit Feedback
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && sorted.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    {isMentor
                      ? 'No sessions yet. Schedule one from your dashboard.'
                      : 'No sessions yet. Your mentor will schedule sessions for you.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Student feedback dialog */}
      <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <DialogContent>
          <form onSubmit={handleSubmitFeedback}>
            <DialogHeader>
              <DialogTitle>Session Feedback</DialogTitle>
              <DialogDescription>
                Share how the session went. Your rating and comments help improve quality.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="feedback-rating">Rating (1–5)</Label>
                <Select value={feedbackRating} onValueChange={setFeedbackRating}>
                  <SelectTrigger id="feedback-rating">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map(n => (
                      <SelectItem key={n} value={String(n)}>
                        {'★'.repeat(n)}{'☆'.repeat(5 - n)} — {n}/5
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="feedback-text">Comments</Label>
                <Textarea
                  id="feedback-text"
                  placeholder="What went well? What could improve?"
                  value={feedbackText}
                  onChange={e => setFeedbackText(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFeedbackOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submittingFeedback}>
                {submittingFeedback && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Submit Feedback
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
