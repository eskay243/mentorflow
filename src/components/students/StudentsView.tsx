import React, { useState } from 'react';
import { useFirestoreCollection } from '@/hooks/useFirestore';
import { useAuth } from '@/context/AuthContext';
import { UserProfile, Enrollment } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Search, Filter, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { doc, setDoc } from 'firebase/firestore';
import { where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';

export default function StudentsView() {
  const { isAdmin, isMentor, profile } = useAuth();

  const { data: users } = useFirestoreCollection<UserProfile>('users');

  const enrollmentConstraints = isMentor && profile?.uid
    ? [where('mentorId', '==', profile.uid)]
    : [];
  const { data: enrollments } = useFirestoreCollection<Enrollment>('enrollments', enrollmentConstraints);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newStudent, setNewStudent] = useState({ name: '', email: '' });
  const [search, setSearch] = useState('');

  const enrolledStudentIds = isMentor ? new Set(enrollments.map(e => e.studentId)) : null;

  const students = users
    .filter(u => u.role === 'student')
    .filter(u => !enrolledStudentIds || enrolledStudentIds.has(u.uid))
    .filter(u =>
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
    );

  const handleOnboardStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.name || !newStudent.email) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const tempId = `pre_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      await setDoc(doc(db, 'users', tempId), {
        uid: tempId,
        name: newStudent.name,
        email: newStudent.email.toLowerCase(),
        role: 'student',
        createdAt: Date.now(),
        kycStatus: 'not_started',
      });

      toast.success('Student pre-registered. They can sign in with this email to access their dashboard.');
      setIsAddDialogOpen(false);
      setNewStudent({ name: '', email: '' });
    } catch (error) {
      console.error('Error onboarding student:', error);
      toast.error('Failed to onboard student');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {isMentor ? 'My Students' : 'Students Directory'}
          </h2>
          <p className="text-muted-foreground">
            {isMentor
              ? 'Students enrolled in your courses.'
              : 'Monitor student progress and onboarding status.'}
          </p>
        </div>

        {isAdmin && (
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Onboard Student
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleOnboardStudent}>
                <DialogHeader>
                  <DialogTitle>Pre-register Student</DialogTitle>
                  <DialogDescription>
                    Creates a placeholder profile linked by email. The student can sign in with this email to activate their account.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g. Jane Smith"
                      value={newStudent.name}
                      onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="student@example.com"
                      value={newStudent.email}
                      onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
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
        )}
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search students by name or email..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button variant="outline" className="gap-2" onClick={() => setSearch('')}>
          <Filter className="w-4 h-4" />
          Clear
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[250px]">Student</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Enrollments</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>KYC Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => {
                const studentEnrollments = enrollments.filter(e => e.studentId === student.uid);

                return (
                  <TableRow key={student.uid}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${student.name}`} />
                          <AvatarFallback>{student.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{student.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{student.email}</TableCell>
                    <TableCell>{studentEnrollments.length}</TableCell>
                    <TableCell>{new Date(student.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge
                        variant={student.kycStatus === 'verified' ? 'default' : student.kycStatus === 'pending' ? 'secondary' : 'outline'}
                        className="capitalize"
                      >
                        {student.kycStatus ?? 'not started'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => toast.info('Student profile details coming soon')}>View Profile</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {students.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    {isMentor ? 'No students enrolled in your courses yet.' : 'No students found.'}
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
