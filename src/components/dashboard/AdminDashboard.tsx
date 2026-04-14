import React from 'react';
import { useFirestoreCollection } from '@/hooks/useFirestore';
import { Payout, UserProfile, Enrollment } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DollarSign, Users, CheckCircle, Clock, ShieldCheck, Check, X } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AdminDashboard() {
  const { data: payouts } = useFirestoreCollection<Payout>('payouts');
  const { data: users } = useFirestoreCollection<UserProfile>('users');
  const { data: enrollments } = useFirestoreCollection<Enrollment>('enrollments');

  const mentorUsers = users.filter(u => u.role === 'mentor');
  const studentUsers = users.filter(u => u.role === 'student');
  const pendingKyc = users.filter(u => u.kycStatus === 'pending');
  
  const totalPayouts = payouts.reduce((sum, p) => sum + p.amount, 0);
  const pendingPayouts = payouts.filter(p => p.status === 'pending');
  const totalRevenue = enrollments.reduce((sum, e) => sum + (e.totalPaid || 0), 0);

  const handleProcessPayout = async (payoutId: string) => {
    try {
      const docRef = doc(db, 'payouts', payoutId);
      await updateDoc(docRef, {
        status: 'processed',
        processedAt: Date.now()
      });
      toast.success('Payout processed successfully');
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
    } catch (error) {
      toast.error('Failed to verify KYC');
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-serif font-bold tracking-tight text-gray-900">Platform Overview</h1>
        <p className="text-muted-foreground">Manage revenue, payouts, and identity verification.</p>
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
          <TabsTrigger value="performance" className="rounded-lg">Performance</TabsTrigger>
        </TabsList>

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
