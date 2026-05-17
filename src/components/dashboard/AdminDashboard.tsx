import React, { useState } from 'react';
import { useFirestoreCollection } from '@/hooks/useFirestore';
import { Payout, UserProfile, Enrollment } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DollarSign, Users, CheckCircle, Clock, ShieldCheck, Check, X, RefreshCw, Loader2 } from 'lucide-react';
import { doc, updateDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';

export default function AdminDashboard() {
  const { data: payouts, refresh: refreshPayouts } = useFirestoreCollection<Payout>('payouts');
  const { data: users, refresh: refreshUsers } = useFirestoreCollection<UserProfile>('users');
  const { data: enrollments, refresh: refreshEnrollments } = useFirestoreCollection<Enrollment>('enrollments');

  const [userSearch, setUserSearch] = useState('');
  
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignmentData, setAssignmentData] = useState({
    studentId: '',
    mentorId: '',
    courseTitle: 'General Mentorship'
  });

  const handleRefreshAll = () => {
    refreshPayouts();
    refreshUsers();
    refreshEnrollments();
    toast.success('Data refreshed');
  };

  const handleAssignStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignmentData.studentId || !assignmentData.mentorId) {
      toast.error('Please select both a student and a mentor');
      return;
    }

    setIsAssigning(true);
    try {
      const student = users.find(u => u.uid === assignmentData.studentId);
      const mentor = users.find(u => u.uid === assignmentData.mentorId);

      await addDoc(collection(db, 'enrollments'), {
        studentId: assignmentData.studentId,
        studentName: student?.name || 'Unknown',
        mentorId: assignmentData.mentorId,
        mentorName: mentor?.name || 'Unknown',
        courseTitle: assignmentData.courseTitle,
        status: 'active',
        onboardedAt: Date.now(),
        commissionEarned: 0,
        totalPaid: 0
      });

      toast.success('Student assigned to mentor successfully');
      refreshEnrollments();
      setAssignmentData({ ...assignmentData, studentId: '', mentorId: '' });
    } catch (error) {
      console.error('Error assigning student:', error);
      toast.error('Failed to assign student');
    } finally {
      setIsAssigning(false);
    }
  };
  
  const mentorUsers = users.filter(u => u.role === 'mentor');
  const studentUsers = users.filter(u => u.role === 'student');
  const adminUsers = users.filter(u => u.role === 'admin');
  const pendingKyc = users.filter(u => u.role === 'mentor' && u.kycStatus === 'pending');
  
  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(userSearch.toLowerCase()) || 
    u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  const totalPayouts = payouts.reduce((sum, p) => sum + p.amount, 0);
  const pendingPayouts = payouts.filter(p => p.status === 'pending');
  const totalRevenue = enrollments.reduce((sum, e) => sum + (e.totalPaid || 0), 0);

  const handleUpdateRole = async (userId: string, newRole: 'admin' | 'mentor' | 'student') => {
    try {
      await updateDoc(doc(db, 'users', userId), { 
        role: newRole,
        // If changing to mentor, ensure they have a kycStatus
        ...(newRole === 'mentor' && { kycStatus: 'not_started' })
      });
      toast.success(`User role updated to ${newRole}`);
      refreshUsers();
    } catch (error) {
      toast.error('Failed to update user role');
    }
  };

  const handleProcessPayout = async (payoutId: string) => {
    try {
      const docRef = doc(db, 'payouts', payoutId);
      await updateDoc(docRef, {
        status: 'processed',
        processedAt: Date.now()
      });
      toast.success('Payout processed successfully');
      refreshPayouts();
    } catch (error) {
      toast.error('Failed to process payout');
    }
  };

  const handleApproveKyc = async (userId: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        kycStatus: 'verified',
        'kycData.verifiedAt': Date.now()
      });
      toast.success('KYC verified successfully');
      refreshUsers();
    } catch (error) {
      toast.error('Failed to verify KYC');
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-serif font-bold tracking-tight text-gray-900">Platform Overview</h1>
          <p className="text-muted-foreground">Manage revenue, payouts, and identity verification.</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefreshAll} className="gap-2 rounded-xl">
          <RefreshCw className="w-4 h-4" />
          Refresh Data
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-none shadow-lg bg-white/80 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Total Revenue</CardTitle>
            <DollarSign className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">₦{totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-green-600 font-medium mt-1">+12.5% from last month</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-lg bg-white/80 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Active Mentors</CardTitle>
            <Users className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{mentorUsers.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Verified educators</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-lg bg-white/80 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Pending Payouts</CardTitle>
            <Clock className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{pendingPayouts.length}</div>
            <p className="text-xs text-orange-600 font-medium mt-1">Action required</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-lg bg-white/80 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">KYC Pending</CardTitle>
            <ShieldCheck className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{pendingKyc.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Identity reviews</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="payouts" className="w-full">
        <TabsList className="bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="payouts" className="rounded-lg">Payout Requests</TabsTrigger>
          <TabsTrigger value="kyc" className="rounded-lg">KYC Approvals ({pendingKyc.length})</TabsTrigger>
          <TabsTrigger value="assignments" className="rounded-lg">Assignments</TabsTrigger>
          <TabsTrigger value="users" className="rounded-lg">Users Management</TabsTrigger>
          <TabsTrigger value="performance" className="rounded-lg">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="assignments" className="mt-6">
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="md:col-span-1 border-none shadow-xl bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="font-serif">New Assignment</CardTitle>
                <p className="text-xs text-muted-foreground">Link a student to a mentor.</p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAssignStudent} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Select Student</Label>
                    <select 
                      className="w-full h-10 px-3 rounded-xl border bg-background text-sm"
                      value={assignmentData.studentId}
                      onChange={(e) => setAssignmentData({ ...assignmentData, studentId: e.target.value })}
                    >
                      <option value="">-- Select Student --</option>
                      {studentUsers.map(s => (
                        <option key={s.uid} value={s.uid}>{s.name} ({s.email})</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Select Mentor</Label>
                    <select 
                      className="w-full h-10 px-3 rounded-xl border bg-background text-sm"
                      value={assignmentData.mentorId}
                      onChange={(e) => setAssignmentData({ ...assignmentData, mentorId: e.target.value })}
                    >
                      <option value="">-- Select Mentor --</option>
                      {mentorUsers.map(m => (
                        <option key={m.uid} value={m.uid}>{m.name} ({m.email})</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Course/Program Title</Label>
                    <Input 
                      placeholder="e.g. Backend Development"
                      value={assignmentData.courseTitle}
                      onChange={(e) => setAssignmentData({ ...assignmentData, courseTitle: e.target.value })}
                      className="rounded-xl"
                    />
                  </div>
                  <Button type="submit" className="w-full rounded-xl" disabled={isAssigning}>
                    {isAssigning && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Assign Mentorship
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="md:col-span-2 border-none shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
              <CardHeader>
                <CardTitle className="font-serif">Active Assignments</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Student</TableHead>
                      <TableHead>Mentor</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {enrollments.map((en) => (
                      <TableRow key={en.id}>
                        <TableCell className="font-medium">{en.studentName}</TableCell>
                        <TableCell>{en.mentorName}</TableCell>
                        <TableCell>{en.courseTitle}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10">Remove</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {enrollments.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                          No active mentorship assignments found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="users" className="mt-6">
          <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-serif">Platform Users</CardTitle>
              <div className="relative w-64">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Search by name or email..." 
                  className="pl-9 rounded-xl"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>User</TableHead>
                    <TableHead>Current Role</TableHead>
                    <TableHead className="text-right">Change Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((u) => (
                    <TableRow key={u.uid}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{u.name}</span>
                          <span className="text-xs text-muted-foreground">{u.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize rounded-full">
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleUpdateRole(u.uid, 'mentor')}
                            disabled={u.role === 'mentor'}
                          >
                            Set Mentor
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleUpdateRole(u.uid, 'student')}
                            disabled={u.role === 'student'}
                          >
                            Set Student
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredUsers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-12 text-muted-foreground">
                        No users found matching "{userSearch}"
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payouts" className="mt-6">
          <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
            <CardHeader>
              <CardTitle className="font-serif">Payout Requests</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Mentor</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Requested At</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payouts.map((p) => {
                    const mentor = mentorUsers.find(m => m.uid === p.mentorId);
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{mentor?.name || 'Unknown Mentor'}</TableCell>
                        <TableCell>₦{p.amount.toLocaleString()}</TableCell>
                        <TableCell>{new Date(p.requestedAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge variant={p.status === 'processed' ? 'default' : 'secondary'} className="rounded-full">
                            {p.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {p.status === 'pending' && (
                            <Button size="sm" onClick={() => handleProcessPayout(p.id)} className="rounded-lg">
                              Process
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {payouts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                        No payout requests found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kyc" className="mt-6">
          <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
            <CardHeader>
              <CardTitle className="font-serif">Identity Verification Requests</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>ID Type</TableHead>
                    <TableHead>Submitted At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingKyc.map((user) => (
                    <TableRow key={user.uid}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{user.name}</span>
                          <span className="text-xs text-muted-foreground">{user.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize rounded-full">{user.role}</Badge>
                      </TableCell>
                      <TableCell>{user.kycData?.idType}</TableCell>
                      <TableCell>{new Date(user.kycData?.submittedAt || 0).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => handleApproveKyc(user.uid)}
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              const reason = window.prompt('Reason for rejection:');
                              if (reason) {
                                updateDoc(doc(db, 'users', user.uid), {
                                  kycStatus: 'rejected',
                                  'kycData.rejectionReason': reason
                                });
                                toast.success('KYC rejected');
                              }
                            }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {pendingKyc.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                        No pending KYC requests.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="mt-6">
          <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
            <CardHeader>
              <CardTitle className="font-serif">Mentor Performance</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Mentor</TableHead>
                    <TableHead>Students</TableHead>
                    <TableHead>Total Revenue</TableHead>
                    <TableHead>Commission (37%)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mentorUsers.map((m) => {
                    const mentorEnrollments = enrollments.filter(e => e.mentorId === m.uid);
                    const revenue = mentorEnrollments.reduce((sum, e) => sum + (e.totalPaid || 0), 0);
                    const commission = mentorEnrollments.reduce((sum, e) => sum + (e.commissionEarned || 0), 0);
                    return (
                      <TableRow key={m.uid}>
                        <TableCell className="font-medium">{m.name}</TableCell>
                        <TableCell>{mentorEnrollments.length}</TableCell>
                        <TableCell>₦{revenue.toLocaleString()}</TableCell>
                        <TableCell className="font-semibold text-primary">₦{commission.toLocaleString()}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
