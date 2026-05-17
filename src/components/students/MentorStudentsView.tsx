import { useAuth } from '@/context/AuthContext';
import { useFirestoreCollection } from '@/hooks/useFirestore';
import { UserProfile, Enrollment, Session } from '@/types';
import { where } from 'firebase/firestore';
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
import { Users } from 'lucide-react';

export default function MentorStudentsView() {
  const { profile } = useAuth();

  const { data: enrollments } = useFirestoreCollection<Enrollment>(
    'enrollments',
    profile?.uid ? [where('mentorId', '==', profile.uid)] : [],
  );
  const { data: sessions } = useFirestoreCollection<Session>(
    'sessions',
    profile?.uid ? [where('mentorId', '==', profile.uid)] : [],
  );
  const { data: users } = useFirestoreCollection<UserProfile>('users');

  const enrolledStudentIds = [...new Set(enrollments.map((e) => e.studentId))];
  const myStudents = users.filter(
    (u) => u.role === 'student' && enrolledStudentIds.includes(u.uid),
  );

  const sessionsFor = (studentId: string) =>
    sessions.filter((s) => s.studentId === studentId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">My Students</h2>
        <p className="text-muted-foreground">
          Students enrolled in your courses.
        </p>
      </div>

      {myStudents.length === 0 ? (
        <Card className="border-dashed border-2 bg-transparent">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <Users className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
            <h3 className="text-lg font-semibold">No Students Yet</h3>
            <p className="text-muted-foreground max-w-sm mx-auto mt-2 text-sm">
              Students will appear here once they enroll in one of your courses.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Course(s)</TableHead>
                  <TableHead>Sessions</TableHead>
                  <TableHead>Enrollment Status</TableHead>
                  <TableHead>Total Paid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myStudents.map((student) => {
                  const enrs = enrollments.filter((e) => e.studentId === student.uid);
                  const sess = sessionsFor(student.uid);
                  const totalPaid = enrs.reduce((s, e) => s + (e.totalPaid ?? 0), 0);
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
                      <TableCell className="text-sm text-muted-foreground">
                        {student.email}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          {enrs.map((e) => (
                            <span key={e.id} className="text-xs">{e.courseTitle}</span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{sess.length}</span>
                      </TableCell>
                      <TableCell>
                        {enrs.map((e) => (
                          <Badge
                            key={e.id}
                            variant={e.status === 'active' ? 'default' : 'outline'}
                            className="capitalize text-[10px] mr-1"
                          >
                            {e.status}
                          </Badge>
                        ))}
                      </TableCell>
                      <TableCell className="font-medium">
                        ₦{totalPaid.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
