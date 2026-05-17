import React, { useState } from 'react';
import { useFirestoreCollection } from '@/hooks/useFirestore';
import { Course, UserProfile } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, BookOpen, User, DollarSign, Loader2 } from 'lucide-react';
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
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';

import { useAuth } from '@/context/AuthContext';

export default function CoursesView() {
  const { isAdmin } = useAuth();
  const { data: courses } = useFirestoreCollection<Course>('courses');
  const { data: users } = useFirestoreCollection<UserProfile>('users');

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newCourse, setNewCourse] = useState({
    title: '',
    description: '',
    mentorId: '',
    price: '',
    commissionRate: '0.37'
  });

  const mentors = users.filter(u => u.role === 'mentor');
  // If admin, they can see all users to assign as mentor (will auto-update role if needed)
  const mentorOptions = isAdmin ? users : mentors;

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourse.title || !newCourse.mentorId || !newCourse.price) {
      toast.error('Please fill in all required fields');
      return;
    }

    const selectedMentor = users.find(m => m.uid === newCourse.mentorId);

    setIsSubmitting(true);
    try {
      // If the selected user is not a mentor, update their role first
      if (selectedMentor && selectedMentor.role !== 'mentor') {
        await updateDoc(doc(db, 'users', selectedMentor.uid), { 
          role: 'mentor',
          kycStatus: 'not_started'
        });
      }

      await addDoc(collection(db, 'courses'), {
        title: newCourse.title,
        description: newCourse.description,
        mentorId: newCourse.mentorId,
        mentorName: selectedMentor?.name || 'Unknown Mentor',
        price: parseFloat(newCourse.price),
        commissionRate: parseFloat(newCourse.commissionRate),
        createdAt: Date.now()
      });
      
      toast.success('Course created successfully');
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Course Catalog</h2>
          <p className="text-muted-foreground">Explore and manage educational programs.</p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger 
            render={
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Create Course
              </Button>
            } 
          />
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
            <CardFooter className="border-t pt-4">
              <Button className="w-full">View Details</Button>
            </CardFooter>
          </Card>
        ))}
        {courses.length === 0 && (
          <div className="col-span-full py-20 text-center border-2 border-dashed rounded-xl">
            <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No courses available</h3>
            <p className="text-muted-foreground">Start by creating your first educational program.</p>
            <Button className="mt-4" variant="outline">Create Course</Button>
          </div>
        )}
      </div>
    </div>
  );
}
