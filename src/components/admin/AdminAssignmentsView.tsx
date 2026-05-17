import React, { useState } from 'react';
import { useFirestoreCollection } from '@/hooks/useFirestore';
import { UserProfile, Enrollment, Course } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Link2, Loader2, ClipboardList } from 'lucide-react';
import { collection, doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import AdminPaymentImportView from './AdminPaymentImportView';

export default function AdminAssignmentsView() {
  const { data: users } = useFirestoreCollection<UserProfile>('users');
  const { data: courses } = useFirestoreCollection<Course>('courses');
  const { data: enrollments, refresh: refreshEnrollments } =
    useFirestoreCollection<Enrollment>('enrollments');

  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');

  const students = users.filter((u) => u.role === 'student');
  const mentors = users.filter((u) => u.role === 'mentor');

  const getMentorName = (id: string) => users.find((u) => u.uid === id)?.name ?? id;
  const getStudentName = (id: string) => users.find((u) => u.uid === id)?.name ?? id;
  const getCourseName = (id: string) => courses.find((c) => c.id === id)?.title ?? id;

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !selectedCourse) {
      toast.error('Select both a student and a course');
      return;
    }

    const course = courses.find((c) => c.id === selectedCourse);
    if (!course) {
      toast.error('Course not found');
      return;
    }

    const student = users.find((u) => u.uid === selectedStudent);
    if (!student) {
      toast.error('Student not found');
      return;
    }

    // Duplicate check
    const existing = enrollments.find(
      (e) => e.studentId === selectedStudent && e.courseId === selectedCourse,
    );
    if (existing) {
      toast.error('This student is already enrolled in that course');
      return;
    }

    setIsSubmitting(true);
    try {
      const enrollRef = doc(collection(db, 'enrollments'));
      await setDoc(enrollRef, {
        id: enrollRef.id,
        studentId: student.uid,
        studentName: student.name,
        courseId: course.id,
        courseTitle: course.title,
        mentorId: course.mentorId,
        status: 'active',
        onboardedAt: Date.now(),
        totalPaid: 0,
        commissionEarned: 0,
      });

      toast.success(`${student.name} enrolled in "${course.title}"`);
      setIsAssignOpen(false);
      setSelectedStudent('');
      setSelectedCourse('');
      refreshEnrollments();
    } catch {
      toast.error('Failed to create enrollment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const enrollmentsByMentor = mentors.map((mentor) => ({
    mentor,
    enrollments: enrollments.filter((e) => e.mentorId === mentor.uid),
  })).filter(({ enrollments: enrs }) => enrs.length > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap gap-4 justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Assignments</h2>
          <p className="text-muted-foreground">
            Assign students to courses and manage mentor–student relationships.
          </p>
        </div>
        <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Assign Student to Course
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleAssign}>
              <DialogHeader>
                <DialogTitle>Assign Student to Course</DialogTitle>
                <DialogDescription>
                  The mentor is derived automatically from the selected course.
                  Duplicate enrollments are prevented.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Student</Label>
                  <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select student…" />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((s) => (
                        <SelectItem key={s.uid} value={s.uid}>
                          {s.name} — {s.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Course</Label>
                  <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select course…" />
                    </SelectTrigger>
                    <SelectContent>
                      {courses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.title} — {getMentorName(c.mentorId)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedCourse && (
                  <div className="rounded-lg bg-muted/60 p-3 text-sm space-y-1">
                    <p className="text-muted-foreground text-xs uppercase font-semibold">
                      Course details
                    </p>
                    {(() => {
                      const c = courses.find((x) => x.id === selectedCourse);
                      if (!c) return null;
                      return (
                        <>
                          <p>
                            <span className="text-muted-foreground">Mentor: </span>
                            {getMentorName(c.mentorId)}
                          </p>
                          <p>
                            <span className="text-muted-foreground">Price: </span>
                            ₦{c.price.toLocaleString()}
                          </p>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAssignOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Assign
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <AdminPaymentImportView
        users={users}
        courses={courses}
        enrollments={enrollments}
      />

      {/* All enrollments table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="w-4 h-4" />
            All Enrollments ({enrollments.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Mentor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Total Paid</TableHead>
                <TableHead>Commission</TableHead>
                <TableHead>Enrolled</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enrollments.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{getStudentName(e.studentId)}</TableCell>
                  <TableCell>{getCourseName(e.courseId)}</TableCell>
                  <TableCell>{getMentorName(e.mentorId)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={e.status === 'active' ? 'default' : 'outline'}
                      className="capitalize"
                    >
                      {e.status}
                    </Badge>
                  </TableCell>
                  <TableCell>₦{(e.totalPaid ?? 0).toLocaleString()}</TableCell>
                  <TableCell className="text-green-600 font-medium">
                    ₦{(e.commissionEarned ?? 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(e.onboardedAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
              {enrollments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <ClipboardList className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
                    <p className="text-muted-foreground">
                      No enrollments yet. Click "Assign Student to Course" to create one.
                    </p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* By mentor breakdown */}
      {enrollmentsByMentor.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">By Mentor</h3>
          {enrollmentsByMentor.map(({ mentor, enrollments: enrs }) => (
            <Card key={mentor.uid}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  {mentor.name}
                  <span className="text-muted-foreground font-normal ml-2">
                    — {enrs.length} student{enrs.length !== 1 ? 's' : ''}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Paid</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {enrs.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>{getStudentName(e.studentId)}</TableCell>
                        <TableCell>{getCourseName(e.courseId)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={e.status === 'active' ? 'default' : 'outline'}
                            className="capitalize"
                          >
                            {e.status}
                          </Badge>
                        </TableCell>
                        <TableCell>₦{(e.totalPaid ?? 0).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
