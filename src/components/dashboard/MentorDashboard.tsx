import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useFirestoreCollection } from '@/hooks/useFirestore';
import { where, addDoc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import { Enrollment, Payout, Course } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DollarSign, Users, BookOpen, TrendingUp, AlertTriangle, CalendarPlus, Loader2 } from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';

export default function MentorDashboard({ onCompleteKyc }: { onCompleteKyc: () => void }) {
  const { profile } = useAuth();
  const [sessionOpen, setSessionOpen] = useState(false);
  const [sessionEnrollmentId, setSessionEnrollmentId] = useState('');
  const [sessionWhen, setSessionWhen] = useState('');
  const [scheduling, setScheduling] = useState(false);
  
  const { data: enrollments } = useFirestoreCollection<Enrollment>('enrollments', [
    where('mentorId', '==', profile?.uid || '')
  ]);
  
  const { data: payouts } = useFirestoreCollection<Payout>('payouts', [
    where('mentorId', '==', profile?.uid || '')
  ]);

  const { data: courses } = useFirestoreCollection<Course>('courses', [
    where('mentorId', '==', profile?.uid || '')
  ]);

  const totalEarnings = enrollments.reduce((sum, e) => sum + (e.commissionEarned || 0), 0);
  const totalStudents = enrollments.length;
  const activeCourses = courses.length;
  const pendingPayouts = payouts
    .filter(p => p.status === 'pending')
    .reduce((sum, p) => sum + p.amount, 0);

  // Prepare chart data
  const chartData = enrollments.reduce((acc: any[], e) => {
    const date = new Date(e.onboardedAt).toLocaleDateString();
    const existing = acc.find(item => item.date === date);
    if (existing) {
      existing.earnings += e.commissionEarned;
      existing.students += 1;
    } else {
      acc.push({ date, earnings: e.commissionEarned, students: 1 });
    }
    return acc;
  }, []).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const handleScheduleSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.uid || !sessionEnrollmentId || !sessionWhen) {
      toast.error('Choose an enrollment and date/time.');
      return;
    }
    const enr = enrollments.find((x) => x.id === sessionEnrollmentId);
    if (!enr) return;
    setScheduling(true);
    try {
      await addDoc(collection(db, 'sessions'), {
        courseId: enr.courseId,
        studentId: enr.studentId,
        mentorId: profile.uid,
        date: new Date(sessionWhen).getTime(),
        status: 'scheduled',
      });
      toast.success('Session scheduled');
      setSessionOpen(false);
      setSessionEnrollmentId('');
      setSessionWhen('');
    } catch (err) {
      console.error(err);
      toast.error('Could not schedule session.');
    } finally {
      setScheduling(false);
    }
  };

  return (
    <div className="space-y-8">
      {profile?.kycStatus !== 'verified' && (
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3 text-yellow-800">
              <AlertTriangle className="w-5 h-5" />
              <div>
                <p className="font-semibold text-sm">Profile Incomplete</p>
                <p className="text-xs">Please update your biodata and KYC information in settings to enable payouts and full account features.</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="bg-white border-yellow-300 text-yellow-800 hover:bg-yellow-100"
              onClick={onCompleteKyc}
            >
              Update Profile
            </Button>
          </CardContent>
        </Card>
      )}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₦{totalEarnings.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">+20.1% from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStudents}</div>
            <p className="text-xs text-muted-foreground">+12 new this week</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Active Courses</CardTitle>
            <BookOpen className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCourses}</div>
            <p className="text-xs text-muted-foreground">Across 3 categories</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Pending Payouts</CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₦{pendingPayouts.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Next payout in 3 days</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Earnings Overview</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₦${value}`} />
                <Tooltip />
                <Bar dataKey="earnings" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Student Onboarding</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="students" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>Recent Enrollments</CardTitle>
          <Dialog open={sessionOpen} onOpenChange={setSessionOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-2">
                <CalendarPlus className="h-4 w-4" />
                Schedule session
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleScheduleSession}>
                <DialogHeader>
                  <DialogTitle>Schedule a session</DialogTitle>
                  <DialogDescription>
                    Creates a scheduled session for a student you are mentoring.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>Enrollment</Label>
                    <Select
                      value={sessionEnrollmentId}
                      onValueChange={setSessionEnrollmentId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select enrollment" />
                      </SelectTrigger>
                      <SelectContent>
                        {enrollments.map((en) => (
                          <SelectItem key={en.id} value={en.id}>
                            {en.studentName} — {en.courseTitle}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="session-when">Date and time</Label>
                    <Input
                      id="session-when"
                      type="datetime-local"
                      value={sessionWhen}
                      onChange={(ev) => setSessionWhen(ev.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={scheduling || enrollments.length === 0}>
                    {scheduling ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Save session'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Commission</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enrollments.slice(0, 5).map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.studentName}</TableCell>
                  <TableCell>{e.courseTitle}</TableCell>
                  <TableCell>{new Date(e.onboardedAt).toLocaleDateString()}</TableCell>
                  <TableCell>₦{e.commissionEarned.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={e.status === 'active' ? 'default' : 'secondary'}>
                      {e.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {enrollments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No enrollments found.
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
