import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useFirestoreCollection } from '@/hooks/useFirestore';
import { where } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/lib/firebase';
import { toast } from 'sonner';
import { Enrollment, Session, Payment } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BookOpen, Calendar, CreditCard, Star, Rocket, ArrowRight, ShieldCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function StudentDashboard({ onStartOnboarding, onStartKyc }: { onStartOnboarding: () => void, onStartKyc: () => void }) {
  const { profile } = useAuth();
  const [payingEnrollmentId, setPayingEnrollmentId] = useState<string | null>(null);
  
  const { data: enrollments } = useFirestoreCollection<Enrollment>('enrollments', [
    where('studentId', '==', profile?.uid || '')
  ]);
  
  const { data: sessions } = useFirestoreCollection<Session>('sessions', [
    where('studentId', '==', profile?.uid || '')
  ]);

  const { data: payments } = useFirestoreCollection<Payment>('payments', [
    where('studentId', '==', profile?.uid || '')
  ]);

  const activeEnrollments = enrollments.filter(e => e.status === 'active');
  const pendingEnrollments = enrollments.filter((e) => e.status === 'pending');
  const upcomingSessions = sessions.filter(s => s.status === 'scheduled' && s.date > Date.now());

  const startPaystackCheckout = async (enrollmentId: string) => {
    setPayingEnrollmentId(enrollmentId);
    try {
      const fn = httpsCallable(getFunctions(app), 'createPaystackCheckout');
      const callbackUrl =
        typeof window !== 'undefined' ? `${window.location.origin}/` : undefined;
      const res = await fn({ enrollmentId, callbackUrl });
      const data = res.data as { authorizationUrl?: string };
      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      } else {
        toast.error('Could not start checkout.');
      }
    } catch (e) {
      console.error(e);
      toast.error(
        'Payment could not start. Deploy Cloud Functions and configure Paystack (see docs/PAYSTACK.md).',
      );
    } finally {
      setPayingEnrollmentId(null);
    }
  };

  const isOnboardingComplete = profile?.onboardingCompleted;
  const isKycVerified = profile?.kycStatus === 'verified';

  return (
    <div className="space-y-8 pb-12">
      {/* Onboarding Progress Tracker */}
      {!isOnboardingComplete && (
        <Card className="border-none shadow-xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent overflow-hidden">
          <CardContent className="p-0">
            <div className="p-6 md:p-8 flex flex-col md:flex-row items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg rotate-3 shrink-0">
                <Rocket className="w-8 h-8" />
              </div>
              <div className="flex-1 text-center md:text-left space-y-2">
                <h2 className="text-2xl font-serif font-bold text-gray-900">Welcome to Your Journey</h2>
                <p className="text-muted-foreground">Complete your onboarding guide to unlock the full potential of MentorFlow.</p>
                <div className="flex items-center gap-4 pt-2">
                  <Progress value={20} className="h-2 flex-1" />
                  <span className="text-xs font-bold text-primary uppercase tracking-wider">20% Complete</span>
                </div>
              </div>
              <Button onClick={onStartOnboarding} className="rounded-xl px-6 py-6 text-lg gap-2 shadow-lg shadow-primary/20">
                Continue Setup
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KYC Warning if onboarding is done but KYC isn't */}
      {isOnboardingComplete && !isKycVerified && (
        <Card className="border-none shadow-lg bg-orange-50 border-l-4 border-l-orange-400">
          <CardContent className="p-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-orange-900">Identity Verification Required</h3>
                <p className="text-sm text-orange-800/80">Please complete your KYC to access premium courses and sessions.</p>
              </div>
            </div>
            <Button onClick={onStartKyc} variant="outline" className="border-orange-200 text-orange-800 hover:bg-orange-100 rounded-xl">
              Verify Identity
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Active Courses</CardTitle>
            <BookOpen className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeEnrollments.length}</div>
            <p className="text-xs text-muted-foreground">Currently learning</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Upcoming Sessions</CardTitle>
            <Calendar className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingSessions.length}</div>
            <p className="text-xs text-muted-foreground">Next one tomorrow</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
            <CreditCard className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₦{payments.reduce((sum, p) => sum + p.amount, 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Investment in future</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
            <Star className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4.8</div>
            <p className="text-xs text-muted-foreground">From your mentors</p>
          </CardContent>
        </Card>
      </div>

      {pendingEnrollments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Complete payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              You have enrollments awaiting payment. After paying, your enrollment becomes active when
              Paystack confirms the charge (webhook).
            </p>
            <div className="space-y-2">
              {pendingEnrollments.map((e) => (
                <div
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{e.courseTitle}</p>
                    <p className="text-xs text-muted-foreground">Enrollment ID: {e.id}</p>
                  </div>
                  <Button
                    size="sm"
                    disabled={payingEnrollmentId === e.id}
                    onClick={() => startPaystackCheckout(e.id)}
                  >
                    {payingEnrollmentId === e.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Pay with Paystack'
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Course Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {activeEnrollments.map((e) => (
              <div key={e.id} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{e.courseTitle}</span>
                  <span className="text-muted-foreground">65%</span>
                </div>
                <Progress value={65} className="h-2" />
              </div>
            ))}
            {activeEnrollments.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No active courses. Browse our catalog to start learning!
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcomingSessions.map((s) => (
                <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">Session with Mentor</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(s.date).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
              {upcomingSessions.length === 0 && (
                <div className="text-center py-4 text-xs text-muted-foreground">
                  No upcoming sessions.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Session History & Feedback</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Mentor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Feedback</TableHead>
                <TableHead>Rating</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.filter(s => s.status === 'completed').map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{new Date(s.date).toLocaleDateString()}</TableCell>
                  <TableCell>Mentor Name</TableCell>
                  <TableCell>
                    <Badge variant="default">Completed</Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {s.feedback || "No feedback yet"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 fill-primary text-primary" />
                      <span>{s.rating || "-"}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {sessions.filter(s => s.status === 'completed').length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No completed sessions yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
