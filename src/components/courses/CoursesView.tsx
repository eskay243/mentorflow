import React, { useState, useEffect } from 'react';
import { useFirestoreCollection } from '@/hooks/useFirestore';
import { Course, UserProfile, type Enrollment } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, BookOpen, User, DollarSign, Loader2, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  collection,
  deleteDoc,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';

export default function CoursesView() {
  const { profile, isAdmin, isMentor, isStudent } = useAuth();
  const { data: courses, refresh: refreshCourses } = useFirestoreCollection<Course>('courses');
  const { data: users } = useFirestoreCollection<UserProfile>('users');
  const { data: enrollments } = useFirestoreCollection<Enrollment>('enrollments');

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [enrollingCourseId, setEnrollingCourseId] = useState<string | null>(null);
  const [newCourse, setNewCourse] = useState({
    title: '',
    description: '',
    mentorId: '',
    price: '',
    commissionRate: '0.37'
  });
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editCourseForm, setEditCourseForm] = useState({
    title: '',
    description: '',
    mentorId: '',
    price: '',
    commissionRate: '0.37',
  });

  const mentors = users.filter(u => u.role === 'mentor');
  // If admin, they can see all users to assign as mentor (will auto-update role if needed)
  const mentorOptions = isAdmin ? users : mentors;

  useEffect(() => {
    if (isAddDialogOpen && isMentor && !isAdmin && profile?.uid) {
      setNewCourse((prev) => ({ ...prev, mentorId: profile.uid }));
    }
  }, [isAddDialogOpen, isMentor, isAdmin, profile?.uid]);

  const handleEnroll = async (course: Course) => {
    if (!profile?.uid || !isStudent) return;
    setEnrollingCourseId(course.id);
    try {
      const dupQ = query(
        collection(db, 'enrollments'),
        where('studentId', '==', profile.uid),
        where('courseId', '==', course.id),
      );
      const existing = await getDocs(dupQ);
      if (!existing.empty) {
        toast.info('You are already enrolled in this course.');
        return;
      }
      const payload: Omit<Enrollment, 'id'> = {
        studentId: profile.uid,
        studentName: profile.name,
        courseId: course.id,
        courseTitle: course.title,
        mentorId: course.mentorId,
        status: 'pending',
        onboardedAt: Date.now(),
        totalPaid: 0,
        commissionEarned: 0,
      };
      await addDoc(collection(db, 'enrollments'), payload);
      toast.success('Enrollment submitted.');
    } catch (err) {
      console.error(err);
      toast.error('Could not enroll. Try again.');
    } finally {
      setEnrollingCourseId(null);
    }
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    const mentorId =
      isMentor && !isAdmin && profile?.uid ? profile.uid : newCourse.mentorId;
    if (!newCourse.title || !mentorId || !newCourse.price) {
      toast.error('Please fill in all required fields');
      return;
    }

    const selectedMentor = mentors.find((m) => m.uid === mentorId);

    setIsSubmitting(true);
    try {
      const courseRef = doc(collection(db, 'courses'));
      const price = parseFloat(newCourse.price);
      const commissionRate = parseFloat(newCourse.commissionRate);
      await setDoc(courseRef, {
        id: courseRef.id,
        title: newCourse.title,
        description: newCourse.description,
        mentorId,
        mentorName: selectedMentor?.name || profile?.name || 'Unknown Mentor',
        price,
        commissionRate,
        createdAt: Date.now(),
      });
      
      toast.success('Course created successfully');
      refreshCourses();
      setIsAddDialogOpen(false);
      setNewCourse({
        title: '',
        description: '',
        mentorId: '',
        price: '',
        commissionRate: '0.37'
      });
    } catch (error) {
      console.error('Error creating course:', error);
      toast.error('Failed to create course');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditCourse = (course: Course) => {
    setEditingCourse(course);
    setEditCourseForm({
      title: course.title,
      description: course.description,
      mentorId: course.mentorId,
      price: String(course.price),
      commissionRate: String(course.commissionRate),
    });
  };

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourse || !editCourseForm.title || !editCourseForm.mentorId || !editCourseForm.price) {
      toast.error('Please fill in all required fields');
      return;
    }
    const selectedMentor = users.find((m) => m.uid === editCourseForm.mentorId);
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, 'courses', editingCourse.id), {
        title: editCourseForm.title.trim(),
        description: editCourseForm.description.trim(),
        mentorId: editCourseForm.mentorId,
        mentorName: selectedMentor?.name ?? editingCourse.mentorName,
        price: Number(editCourseForm.price) || 0,
        commissionRate: Number(editCourseForm.commissionRate) || 0.37,
        updatedAt: Date.now(),
      });
      toast.success('Course updated');
      setEditingCourse(null);
      refreshCourses();
    } catch {
      toast.error('Failed to update course');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCourse = async (course: Course) => {
    const relatedEnrollments = enrollments.filter((enrollment) => enrollment.courseId === course.id);
    const confirmed = window.confirm(
      `Delete "${course.title}"? It has ${relatedEnrollments.length} enrollment(s). Related enrollments are not removed automatically.`,
    );
    if (!confirmed) return;
    try {
      await deleteDoc(doc(db, 'courses', course.id));
      toast.success('Course deleted');
      refreshCourses();
    } catch {
      toast.error('Failed to delete course');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Course Catalog</h2>
          <p className="text-muted-foreground">Explore and manage educational programs.</p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          {(isAdmin || isMentor) && (
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Create Course
            </Button>
          </DialogTrigger>
          )}
          <DialogContent className="sm:max-w-[500px]">
            <form onSubmit={handleCreateCourse}>
              <DialogHeader>
                <DialogTitle>Create New Course</DialogTitle>
                <DialogDescription>
                  Fill in the details to add a new course to the catalog.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">Course Title</Label>
                  <Input 
                    id="title" 
                    placeholder="e.g. Advanced Mathematics" 
                    value={newCourse.title}
                    onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea 
                    id="description" 
                    placeholder="Briefly describe the course..." 
                    value={newCourse.description}
                    onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="mentor">Assign Mentor</Label>
                    {isMentor && !isAdmin ? (
                      <p className="text-sm py-2 text-muted-foreground" id="mentor">
                        {profile?.name || 'You'} (your mentor account)
                      </p>
                    ) : (
                    <Select 
                      value={newCourse.mentorId} 
                      onValueChange={(value) => setNewCourse({ ...newCourse, mentorId: value })}
                    >
                      <SelectTrigger id="mentor">
                        <SelectValue placeholder="Select mentor" />
                      </SelectTrigger>
                      <SelectContent>
                        {mentorOptions.map((m) => (
                          <SelectItem key={m.uid} value={m.uid}>
                            {m.name} {m.role !== 'mentor' ? `(${m.role})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="price">Price (₦)</Label>
                    <Input 
                      id="price" 
                      type="number" 
                      placeholder="50000" 
                      value={newCourse.price}
                      onChange={(e) => setNewCourse({ ...newCourse, price: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="commission">Commission Rate (e.g. 0.37 for 37%)</Label>
                  <Input 
                    id="commission" 
                    type="number" 
                    step="0.01"
                    placeholder="0.37" 
                    value={newCourse.commissionRate}
                    onChange={(e) => setNewCourse({ ...newCourse, commissionRate: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create Course
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => (
          <Card key={course.id} className="flex flex-col">
            <CardHeader>
              <div className="flex justify-between items-start mb-2">
                <Badge variant="secondary">Education</Badge>
                <span className="text-lg font-bold text-primary">₦{course.price.toLocaleString()}</span>
              </div>
              <CardTitle className="text-xl">{course.title}</CardTitle>
              <CardDescription className="line-clamp-2">{course.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="flex flex-col gap-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  <span>Mentor: {course.mentorName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  <span>Commission: {(course.commissionRate * 100).toFixed(0)}%</span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4 flex flex-col gap-2">
              {isStudent && (
                <Button
                  className="w-full gap-2"
                  onClick={() => handleEnroll(course)}
                  disabled={enrollingCourseId === course.id}
                >
                  {enrollingCourseId === course.id ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Enrolling…
                    </>
                  ) : (
                    'Enroll now'
                  )}
                </Button>
              )}
              {(isAdmin || isMentor) && (
                <div className="grid grid-cols-3 gap-2 w-full">
                  <Button variant="outline" onClick={() => toast.info(`${course.title}: ₦${course.price.toLocaleString()} with ${course.mentorName}`)}>View</Button>
                  <Button variant="outline" onClick={() => openEditCourse(course)}>
                    <Pencil className="w-3 h-3 mr-1" /> Edit
                  </Button>
                  <Button variant="ghost" className="text-destructive" onClick={() => handleDeleteCourse(course)}>
                    <Trash2 className="w-3 h-3 mr-1" /> Delete
                  </Button>
                </div>
              )}
            </CardFooter>
          </Card>
        ))}
        {courses.length === 0 && (
          <div className="col-span-full py-20 text-center border-2 border-dashed rounded-xl">
            <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No courses available</h3>
            <p className="text-muted-foreground">
              {isStudent ? 'Check back later for new courses.' : 'Start by creating your first educational program.'}
            </p>
            {(isAdmin || isMentor) && (
              <Button className="mt-4" variant="outline" onClick={() => setIsAddDialogOpen(true)}>Create Course</Button>
            )}
          </div>
        )}
      </div>

      <Dialog open={!!editingCourse} onOpenChange={(open) => !open && setEditingCourse(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleSaveCourse}>
            <DialogHeader>
              <DialogTitle>Edit Course</DialogTitle>
              <DialogDescription>Update course details and mentor assignment.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Course Title</Label>
                <Input value={editCourseForm.title} onChange={(e) => setEditCourseForm({ ...editCourseForm, title: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Description</Label>
                <Textarea value={editCourseForm.description} onChange={(e) => setEditCourseForm({ ...editCourseForm, description: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Assign Mentor</Label>
                <Select value={editCourseForm.mentorId} onValueChange={(value) => setEditCourseForm({ ...editCourseForm, mentorId: value })}>
                  <SelectTrigger><SelectValue placeholder="Select mentor" /></SelectTrigger>
                  <SelectContent>
                    {mentorOptions.map((m) => (
                      <SelectItem key={m.uid} value={m.uid}>{m.name} {m.role !== 'mentor' ? `(${m.role})` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Price (₦)</Label>
                  <Input type="number" value={editCourseForm.price} onChange={(e) => setEditCourseForm({ ...editCourseForm, price: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Commission Rate</Label>
                  <Input type="number" step="0.01" value={editCourseForm.commissionRate} onChange={(e) => setEditCourseForm({ ...editCourseForm, commissionRate: e.target.value })} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingCourse(null)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
