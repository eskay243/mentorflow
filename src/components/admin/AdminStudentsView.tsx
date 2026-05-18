import React, { useState } from 'react';
import { useFirestoreCollection } from '@/hooks/useFirestore';
import { UserProfile, Enrollment, Course, Session, Payment } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Search, Filter, Loader2, GraduationCap, Pencil, Trash2 } from 'lucide-react';
import { doc, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';

export default function AdminStudentsView() {
  const { data: users, refresh: refreshUsers } = useFirestoreCollection<UserProfile>('users');
  const { data: enrollments, refresh: refreshEnrollments } = useFirestoreCollection<Enrollment>('enrollments');
  const { data: courses } = useFirestoreCollection<Course>('courses');
  const { data: sessions } = useFirestoreCollection<Session>('sessions');
  const { data: payments } = useFirestoreCollection<Payment>('payments');

  const [search, setSearch] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newStudent, setNewStudent] = useState({ name: '', email: '' });
  const [detailStudent, setDetailStudent] = useState<UserProfile | null>(null);
  const [editStudent, setEditStudent] = useState<UserProfile | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', phoneNumber: '', kycStatus: 'not_started' });

  const allStudents = users
    .filter((u) => u.role === 'student')
    .filter(
      (u) =>
        !search ||
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()),
    );

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.name.trim() || !newStudent.email.trim()) {
      toast.error('Name and email are required');
      return;
    }
    setIsSubmitting(true);
    try {
      const tempId = `pre_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      await setDoc(doc(db, 'users', tempId), {
        uid: tempId,
        name: newStudent.name.trim(),
        email: newStudent.email.trim().toLowerCase(),
        role: 'student',
        createdAt: Date.now(),
        kycStatus: 'not_started',
      });
      toast.success(
        'Student pre-registered. They can sign in with this email to activate their account.',
      );
      setIsAddOpen(false);
      setNewStudent({ name: '', email: '' });
      refreshUsers();
    } catch {
      toast.error('Failed to register student');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditStudent = (student: UserProfile) => {
    setEditStudent(student);
    setEditForm({
      name: student.name,
      email: student.email,
      phoneNumber: student.biodata?.phoneNumber ?? '',
      kycStatus: student.kycStatus ?? 'not_started',
    });
  };

  const handleSaveStudent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editStudent || !editForm.name.trim() || !editForm.email.trim()) return;
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, 'users', editStudent.uid), {
        name: editForm.name.trim(),
        email: editForm.email.trim().toLowerCase(),
        kycStatus: editForm.kycStatus,
        biodata: { ...(editStudent.biodata ?? {}), phoneNumber: editForm.phoneNumber.trim() },
        updatedAt: Date.now(),
      });
      toast.success('Student updated');
      setEditStudent(null);
      refreshUsers();
    } catch {
      toast.error('Failed to update student');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteStudent = async (student: UserProfile) => {
    const relatedEnrollments = enrollments.filter((enrollment) => enrollment.studentId === student.uid);
    const relatedPayments = payments.filter((payment) => payment.studentId === student.uid);
    const confirmed = window.confirm(
      `Delete ${student.name}? This will remove the profile plus ${relatedEnrollments.length} enrollment(s) and ${relatedPayments.length} payment record(s).`,
    );
    if (!confirmed) return;
    try {
      const batch = writeBatch(db);
      relatedEnrollments.forEach((enrollment) => batch.delete(doc(db, 'enrollments', enrollment.id)));
      relatedPayments.forEach((payment) => batch.delete(doc(db, 'payments', payment.id)));
      batch.delete(doc(db, 'users', student.uid));
      await batch.commit();
      toast.success('Student deleted');
      refreshUsers();
      refreshEnrollments();
    } catch {
      toast.error('Failed to delete student');
    }
  };

  const studentDetail = (student: UserProfile) => {
    const enrs = enrollments.filter((e) => e.studentId === student.uid);
    const sess = sessions.filter((s) => s.studentId === student.uid);
    const pays = payments.filter((p) => p.studentId === student.uid);
    const totalPaid = pays
      .filter((p) => p.status === 'success')
      .reduce((s, p) => s + p.amount, 0);
    const mentorIds = [...new Set(enrs.map((e) => e.mentorId))];
    const mentorNames = mentorIds.map(
      (id) => users.find((u) => u.uid === id)?.name ?? id,
    );
    return { enrs, sess, totalPaid, mentorNames };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap gap-4 justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Student Management</h2>
          <p className="text-muted-foreground">
            Full student directory, enrollment status, and assignment controls.
          </p>
        </div>
        <Button className="gap-2" onClick={() => setIsAddOpen(true)}>
          <Plus className="w-4 h-4" />
          Onboard Student
        </Button>
      </div>

      {/* Search */}
      <div className="flex gap-3 max-w-lg">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {search && (
          <Button variant="outline" className="gap-2" onClick={() => setSearch('')}>
            <Filter className="w-4 h-4" /> Clear
          </Button>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Enrollments</TableHead>
                <TableHead>Mentor(s)</TableHead>
                <TableHead>KYC</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allStudents.map((student) => {
                const enrs = enrollments.filter((e) => e.studentId === student.uid);
                const mentorIds = [...new Set(enrs.map((e) => e.mentorId))];
                const mentorNames = mentorIds.map(
                  (id) => users.find((u) => u.uid === id)?.name ?? 'Unknown',
                );
                return (
                  <TableRow key={student.uid}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarImage
                            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${student.name}`}
                          />
                          <AvatarFallback>{student.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{student.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{student.email}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <GraduationCap className="w-3.5 h-3.5 text-muted-foreground" />
                        {enrs.length}
                      </div>
                    </TableCell>
                    <TableCell>
                      {mentorNames.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {mentorNames.map((n) => (
                            <Badge key={n} variant="secondary" className="text-xs">
                              {n}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          student.kycStatus === 'verified'
                            ? 'default'
                            : student.kycStatus === 'pending'
                            ? 'secondary'
                            : 'outline'
                        }
                        className="capitalize"
                      >
                        {student.kycStatus ?? 'not started'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(student.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => setDetailStudent(student)}>View</Button>
                        <Button size="sm" variant="outline" onClick={() => openEditStudent(student)}>
                          <Pencil className="w-3 h-3 mr-1" /> Edit
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDeleteStudent(student)}>
                          <Trash2 className="w-3 h-3 mr-1" /> Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {allStudents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    No students found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Onboard student dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <form onSubmit={handleAddStudent}>
            <DialogHeader>
              <DialogTitle>Pre-register Student</DialogTitle>
              <DialogDescription>
                Creates a placeholder profile linked by email. The student signs in with this email
                to activate their account.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="s-name">Full Name</Label>
                <Input
                  id="s-name"
                  placeholder="e.g. Jane Smith"
                  value={newStudent.name}
                  onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="s-email">Email Address</Label>
                <Input
                  id="s-email"
                  type="email"
                  placeholder="student@example.com"
                  value={newStudent.email}
                  onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Pre-register
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editStudent} onOpenChange={(open) => !open && setEditStudent(null)}>
        <DialogContent>
          <form onSubmit={handleSaveStudent}>
            <DialogHeader>
              <DialogTitle>Edit Student</DialogTitle>
              <DialogDescription>Update student profile details.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Phone</Label>
                <Input value={editForm.phoneNumber} onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>KYC Status</Label>
                <Input value={editForm.kycStatus} onChange={(e) => setEditForm({ ...editForm, kycStatus: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditStudent(null)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Student detail dialog */}
      {detailStudent && (() => {
        const { enrs, sess, totalPaid, mentorNames } = studentDetail(detailStudent);
        return (
          <Dialog open onOpenChange={() => setDetailStudent(null)}>
            <DialogContent className="sm:max-w-[560px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Avatar className="w-8 h-8">
                    <AvatarImage
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${detailStudent.name}`}
                    />
                    <AvatarFallback>{detailStudent.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  {detailStudent.name}
                </DialogTitle>
                <DialogDescription>{detailStudent.email}</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4 py-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Role</p>
                  <Badge variant="outline" className="capitalize">
                    {detailStudent.role}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">KYC Status</p>
                  <Badge
                    variant={
                      detailStudent.kycStatus === 'verified'
                        ? 'default'
                        : detailStudent.kycStatus === 'pending'
                        ? 'secondary'
                        : 'outline'
                    }
                    className="capitalize"
                  >
                    {detailStudent.kycStatus ?? 'not started'}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Enrollments</p>
                  <p className="font-semibold">{enrs.length}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Sessions</p>
                  <p className="font-semibold">{sess.length}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Total Paid</p>
                  <p className="font-semibold text-green-600">₦{totalPaid.toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Joined</p>
                  <p className="font-semibold">
                    {new Date(detailStudent.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="col-span-2 space-y-1">
                  <p className="text-xs text-muted-foreground">Mentor(s)</p>
                  {mentorNames.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {mentorNames.map((n) => (
                        <Badge key={n} variant="secondary">
                          {n}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No mentor assigned yet</p>
                  )}
                </div>
                {enrs.length > 0 && (
                  <div className="col-span-2 space-y-2">
                    <p className="text-xs text-muted-foreground">Enrollments</p>
                    <div className="space-y-1">
                      {enrs.map((e) => {
                        const course = courses.find((c) => c.id === e.courseId);
                        return (
                          <div
                            key={e.id}
                            className="flex justify-between items-center text-sm border rounded px-3 py-2"
                          >
                            <span>{course?.title ?? e.courseTitle}</span>
                            <Badge
                              variant={e.status === 'active' ? 'default' : 'outline'}
                              className="capitalize ml-2"
                            >
                              {e.status}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDetailStudent(null)}>
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
}
