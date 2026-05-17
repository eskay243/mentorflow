import React, { useState } from 'react';
import { useFirestoreCollection } from '@/hooks/useFirestore';
import { UserProfile, Enrollment } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Plus,
  Check,
  X,
  Eye,
  Search,
  Users,
  UserCheck,
  MoreVertical,
  Loader2,
} from 'lucide-react';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';

export default function AdminMentorsView() {
  const { data: users, refresh: refreshUsers } = useFirestoreCollection<UserProfile>('users');
  const { data: enrollments } = useFirestoreCollection<Enrollment>('enrollments');

  const [search, setSearch] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newMentor, setNewMentor] = useState({ name: '', email: '' });
  const [editMentor, setEditMentor] = useState<UserProfile | null>(null);
  const [editName, setEditName] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [kycDetailMentor, setKycDetailMentor] = useState<UserProfile | null>(null);

  const allMentors = users.filter((u) => u.role === 'mentor');
  const activeMentors = allMentors.filter((u) => u.kycStatus === 'verified');
  const pendingKyc = allMentors.filter((u) => u.kycStatus === 'pending');
  const otherMentors = allMentors.filter(
    (u) => u.kycStatus !== 'verified' && u.kycStatus !== 'pending',
  );

  const filtered = (list: UserProfile[]) =>
    list.filter(
      (m) =>
        !search ||
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.email.toLowerCase().includes(search.toLowerCase()),
    );

  const enrollmentsFor = (mentorId: string) =>
    enrollments.filter((e) => e.mentorId === mentorId);

  const handleAddMentor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMentor.name.trim() || !newMentor.email.trim()) {
      toast.error('Name and email are required');
      return;
    }
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'users'), {
        name: newMentor.name.trim(),
        email: newMentor.email.trim().toLowerCase(),
        role: 'mentor',
        createdAt: Date.now(),
        kycStatus: 'not_started',
        uid: `pending_${Math.random().toString(36).substr(2, 9)}`,
      });
      toast.success('Mentor profile pre-created. They can sign in with this email.');
      setIsAddOpen(false);
      setNewMentor({ name: '', email: '' });
      refreshUsers();
    } catch {
      toast.error('Failed to add mentor');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMentor || !editName.trim()) return;
    setEditSaving(true);
    try {
      await updateDoc(doc(db, 'users', editMentor.uid), { name: editName.trim() });
      toast.success('Mentor profile updated');
      setEditMentor(null);
      refreshUsers();
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setEditSaving(false);
    }
  };

  const handleApproveKyc = async (mentorId: string) => {
    try {
      await updateDoc(doc(db, 'users', mentorId), {
        kycStatus: 'verified',
        'kycData.verifiedAt': Date.now(),
      });
      toast.success('KYC approved');
      refreshUsers();
    } catch {
      toast.error('Failed to approve KYC');
    }
  };

  const handleRejectKyc = async (mentorId: string) => {
    const reason = window.prompt('Reason for rejection:');
    if (!reason) return;
    try {
      await updateDoc(doc(db, 'users', mentorId), {
        kycStatus: 'rejected',
        'kycData.rejectionReason': reason,
      });
      toast.success('KYC rejected');
      refreshUsers();
    } catch {
      toast.error('Failed to reject KYC');
    }
  };

  const handleDeactivate = async (mentorId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'verified' ? 'not_started' : 'verified';
    try {
      await updateDoc(doc(db, 'users', mentorId), { kycStatus: newStatus });
      toast.success(`Mentor ${newStatus === 'verified' ? 're-activated' : 'deactivated'}`);
      refreshUsers();
    } catch {
      toast.error('Failed to update mentor status');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap gap-4 justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Mentor Management</h2>
          <p className="text-muted-foreground">
            Invite, verify, and manage all mentors on the platform.
          </p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Add Mentor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleAddMentor}>
              <DialogHeader>
                <DialogTitle>Invite New Mentor</DialogTitle>
                <DialogDescription>
                  Pre-create a mentor profile. The mentor signs in with this email to claim it.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="m-name">Full Name</Label>
                  <Input
                    id="m-name"
                    placeholder="e.g. John Doe"
                    value={newMentor.name}
                    onChange={(e) => setNewMentor({ ...newMentor, name: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="m-email">Email</Label>
                  <Input
                    id="m-email"
                    type="email"
                    placeholder="mentor@example.com"
                    value={newMentor.email}
                    onChange={(e) => setNewMentor({ ...newMentor, email: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
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

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search mentors…"
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">
            Active ({filtered(activeMentors).length})
          </TabsTrigger>
          <TabsTrigger value="kyc">
            KYC Pending ({filtered(pendingKyc).length})
          </TabsTrigger>
          <TabsTrigger value="other">
            Not Verified ({filtered(otherMentors).length})
          </TabsTrigger>
        </TabsList>

        {/* Active mentors */}
        <TabsContent value="active" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mentor</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Students</TableHead>
                    <TableHead>Revenue (₦)</TableHead>
                    <TableHead>Commission (₦)</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered(activeMentors).map((mentor) => {
                    const enrs = enrollmentsFor(mentor.uid);
                    const revenue = enrs.reduce((s, e) => s + (e.totalPaid ?? 0), 0);
                    const commission = enrs.reduce((s, e) => s + (e.commissionEarned ?? 0), 0);
                    return (
                      <TableRow key={mentor.uid}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="w-8 h-8">
                              <AvatarImage
                                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${mentor.name}`}
                              />
                              <AvatarFallback>{mentor.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{mentor.name}</p>
                              <Badge variant="default" className="text-[10px] mt-0.5">
                                Verified
                              </Badge>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{mentor.email}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Users className="w-3 h-3 text-muted-foreground" />
                            {enrs.length}
                          </div>
                        </TableCell>
                        <TableCell>₦{revenue.toLocaleString()}</TableCell>
                        <TableCell className="font-semibold text-green-600">
                          ₦{commission.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {/* Edit name */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditMentor(mentor);
                                setEditName(mentor.name);
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => handleDeactivate(mentor.uid, mentor.kycStatus ?? '')}
                            >
                              Deactivate
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filtered(activeMentors).length === 0 && (
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

        {/* KYC pending */}
        <TabsContent value="kyc" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mentor</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>ID Type</TableHead>
                    <TableHead>Bank</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered(pendingKyc).map((mentor) => (
                    <TableRow key={mentor.uid}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{mentor.name}</p>
                          <p className="text-xs text-muted-foreground">{mentor.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(mentor.kycData?.submittedAt ?? 0).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{mentor.kycData?.idType ?? '—'}</TableCell>
                      <TableCell>{mentor.kycData?.bankName ?? '—'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {/* View KYC detail */}
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => setKycDetailMentor(mentor)}
                          >
                            <Eye className="w-3 h-3" /> Review
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-green-700 border-green-300 hover:bg-green-50"
                            onClick={() => handleApproveKyc(mentor.uid)}
                          >
                            <Check className="w-3 h-3" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                            onClick={() => handleRejectKyc(mentor.uid)}
                          >
                            <X className="w-3 h-3" /> Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered(pendingKyc).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                        No pending KYC reviews.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Not verified */}
        <TabsContent value="other" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mentor</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>KYC Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered(otherMentors).map((mentor) => (
                    <TableRow key={mentor.uid}>
                      <TableCell className="font-medium">{mentor.name}</TableCell>
                      <TableCell className="text-sm">{mentor.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {mentor.kycStatus ?? 'not started'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditMentor(mentor);
                            setEditName(mentor.name);
                          }}
                        >
                          <MoreVertical className="w-3 h-3 mr-1" /> Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered(otherMentors).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                        No mentors in this category.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit mentor dialog */}
      <Dialog open={!!editMentor} onOpenChange={(o) => !o && setEditMentor(null)}>
        <DialogContent>
          <form onSubmit={handleSaveEdit}>
            <DialogHeader>
              <DialogTitle>Edit Mentor Profile</DialogTitle>
              <DialogDescription>Update mentor display name.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Full Name</Label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-muted-foreground">Email (read-only)</Label>
                <Input value={editMentor?.email ?? ''} disabled />
              </div>
              <div className="grid gap-2">
                <Label className="text-muted-foreground">KYC Status</Label>
                <Badge variant="outline" className="w-fit capitalize">
                  {editMentor?.kycStatus ?? 'not started'}
                </Badge>
              </div>
              {/* Students assigned */}
              <div className="grid gap-2">
                <Label className="text-muted-foreground">Assigned Students</Label>
                <p className="text-sm font-medium">
                  {editMentor
                    ? enrollmentsFor(editMentor.uid).length
                    : 0}{' '}
                  enrollment(s)
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditMentor(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={editSaving}>
                {editSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* KYC detail dialog */}
      <Dialog open={!!kycDetailMentor} onOpenChange={(o) => !o && setKycDetailMentor(null)}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>KYC Details — {kycDetailMentor?.name}</DialogTitle>
            <DialogDescription>
              Review identity and banking information before approving.
            </DialogDescription>
          </DialogHeader>
          {kycDetailMentor?.kycData && (
            <div className="grid grid-cols-2 gap-4 py-4">
              {[
                ['ID Type', kycDetailMentor.kycData.idType],
                ['ID Number', kycDetailMentor.kycData.idNumber],
                ['Phone', kycDetailMentor.kycData.phoneNumber],
                ['Bank', kycDetailMentor.kycData.bankName],
                ['Account Number', kycDetailMentor.kycData.accountNumber],
                ['Account Name', kycDetailMentor.kycData.accountName],
              ].map(([label, value]) => (
                <div key={label} className="space-y-1">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-sm font-medium">{value ?? '—'}</p>
                </div>
              ))}
              <div className="col-span-2 space-y-1">
                <p className="text-xs text-muted-foreground">Address</p>
                <p className="text-sm font-medium">{kycDetailMentor.kycData.address}</p>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="destructive"
              onClick={() => {
                if (kycDetailMentor) handleRejectKyc(kycDetailMentor.uid);
                setKycDetailMentor(null);
              }}
            >
              <X className="w-4 h-4 mr-1" /> Reject
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={() => {
                if (kycDetailMentor) handleApproveKyc(kycDetailMentor.uid);
                setKycDetailMentor(null);
              }}
            >
              <UserCheck className="w-4 h-4 mr-1" /> Approve & Verify
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
