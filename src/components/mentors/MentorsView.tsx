import React, { useState } from 'react';
import { useFirestoreCollection } from '@/hooks/useFirestore';
import { UserProfile, Enrollment } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, MoreVertical, Mail, Loader2 } from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, X, Eye } from 'lucide-react';

export default function MentorsView() {
  const { data: users } = useFirestoreCollection<UserProfile>('users');
  const { data: enrollments } = useFirestoreCollection<Enrollment>('enrollments');
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newMentor, setNewMentor] = useState({ name: '', email: '' });
  const [selectedKycMentor, setSelectedKycMentor] = useState<UserProfile | null>(null);

  const mentors = users.filter(u => u.role === 'mentor' && u.kycStatus === 'verified');
  const pendingKyc = users.filter(u => u.role === 'mentor' && u.kycStatus === 'pending');

  const handleAddMentor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMentor.name || !newMentor.email) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'users'), {
        name: newMentor.name,
        email: newMentor.email.toLowerCase(),
        role: 'mentor',
        createdAt: Date.now(),
        kycStatus: 'not_started',
        uid: `pending_${Math.random().toString(36).substr(2, 9)}`
      });
      
      toast.success('Mentor added successfully');
      setIsAddDialogOpen(false);
      setNewMentor({ name: '', email: '' });
    } catch (error) {
      console.error('Error adding mentor:', error);
      toast.error('Failed to add mentor');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveKyc = async (mentorId: string) => {
    try {
      await updateDoc(doc(db, 'users', mentorId), {
        kycStatus: 'verified',
        'kycData.verifiedAt': Date.now()
      });
      toast.success('Mentor KYC verified successfully');
    } catch (error) {
      toast.error('Failed to verify KYC');
    }
  };

  const handleRejectKyc = async (mentorId: string, reason: string) => {
    try {
      await updateDoc(doc(db, 'users', mentorId), {
        kycStatus: 'rejected',
        'kycData.rejectionReason': reason
      });
      toast.success('Mentor KYC rejected');
    } catch (error) {
      toast.error('Failed to reject KYC');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Mentors Management</h2>
          <p className="text-muted-foreground">Manage and monitor mentor performance across Abuja.</p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Add New Mentor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleAddMentor}>
              <DialogHeader>
                <DialogTitle>Add New Mentor</DialogTitle>
                <DialogDescription>
                  Enter the details of the new mentor. They will be able to access the mentor dashboard once they sign in with this email.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input 
                    id="name" 
                    placeholder="e.g. John Doe" 
                    value={newMentor.name}
                    onChange={(e) => setNewMentor({ ...newMentor, name: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="mentor@example.com" 
                    value={newMentor.email}
                    onChange={(e) => setNewMentor({ ...newMentor, email: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Add Mentor
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList>
          <TabsTrigger value="active">Active Mentors ({mentors.length})</TabsTrigger>
          <TabsTrigger value="pending">KYC Approvals ({pendingKyc.length})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="active" className="mt-6">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[250px]">Mentor</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Students</TableHead>
                    <TableHead>Total Revenue</TableHead>
                    <TableHead>Commission (37%)</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mentors.map((mentor) => {
                    const mentorEnrollments = enrollments.filter(e => e.mentorId === mentor.uid);
                    const revenue = mentorEnrollments.reduce((sum, e) => sum + (e.totalPaid || 0), 0);
                    const commission = mentorEnrollments.reduce((sum, e) => sum + (e.commissionEarned || 0), 0);
                    
                    return (
                      <TableRow key={mentor.uid}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${mentor.name}`} />
                              <AvatarFallback>{mentor.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{mentor.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>{mentor.email}</TableCell>
                        <TableCell>{mentorEnrollments.length}</TableCell>
                        <TableCell>₦{revenue.toLocaleString()}</TableCell>
                        <TableCell className="font-semibold text-green-600">₦{commission.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => toast.info('Messaging feature coming soon')}>
                              <Mail className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => toast.info('Mentor settings coming soon')}>
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {mentors.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                        No active mentors found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending" className="mt-6">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mentor</TableHead>
                    <TableHead>Submitted At</TableHead>
                    <TableHead>ID Type</TableHead>
                    <TableHead>Bank</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingKyc.map((mentor) => (
                    <TableRow key={mentor.uid}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{mentor.name}</span>
                          <span className="text-xs text-muted-foreground">{mentor.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>{new Date(mentor.kycData?.submittedAt || 0).toLocaleDateString()}</TableCell>
                      <TableCell>{mentor.kycData?.idType}</TableCell>
                      <TableCell>{mentor.kycData?.bankName}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" onClick={() => setSelectedKycMentor(mentor)}>
                                <Eye className="w-4 h-4 mr-1" /> View
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[600px]">
                              <DialogHeader>
                                <DialogTitle>KYC Details: {mentor.name}</DialogTitle>
                                <DialogDescription>Review mentor's identity and banking information.</DialogDescription>
                              </DialogHeader>
                              <div className="grid gap-6 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">ID Type</Label>
                                    <p className="text-sm font-medium">{mentor.kycData?.idType}</p>
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">ID Number</Label>
                                    <p className="text-sm font-medium">{mentor.kycData?.idNumber}</p>
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Phone</Label>
                                    <p className="text-sm font-medium">{mentor.kycData?.phoneNumber}</p>
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Bank</Label>
                                    <p className="text-sm font-medium">{mentor.kycData?.bankName}</p>
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Account Number</Label>
                                    <p className="text-sm font-medium">{mentor.kycData?.accountNumber}</p>
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Account Name</Label>
                                    <p className="text-sm font-medium">{mentor.kycData?.accountName}</p>
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">Address</Label>
                                  <p className="text-sm font-medium">{mentor.kycData?.address}</p>
                                </div>
                              </div>
                              <DialogFooter className="gap-2 sm:justify-between">
                                <Button 
                                  variant="destructive" 
                                  onClick={() => {
                                    const reason = window.prompt('Reason for rejection:');
                                    if (reason) handleRejectKyc(mentor.uid, reason);
                                  }}
                                >
                                  <X className="w-4 h-4 mr-1" /> Reject
                                </Button>
                                <Button 
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={() => handleApproveKyc(mentor.uid)}
                                >
                                  <Check className="w-4 h-4 mr-1" /> Approve & Verify
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {pendingKyc.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                        No pending KYC approvals.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
