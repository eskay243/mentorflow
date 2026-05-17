import { useAuth } from '@/context/AuthContext';
import { useFirestoreCollection } from '@/hooks/useFirestore';
import { UserProfile, Enrollment } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Mail, Users } from 'lucide-react';
import { toast } from 'sonner';

export default function StudentMentorsView() {
  const { profile } = useAuth();
  const { data: users } = useFirestoreCollection<UserProfile>('users');
  const { data: enrollments } = useFirestoreCollection<Enrollment>('enrollments');

  const myEnrollments = enrollments.filter((e) => e.studentId === profile?.uid);
  const verifiedMentors = users.filter((u) => u.role === 'mentor' && u.kycStatus === 'verified');
  const myMentors = verifiedMentors.filter((m) =>
    myEnrollments.some((e) => e.mentorId === m.uid),
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">My Mentors</h2>
        <p className="text-muted-foreground">
          Connect and learn from your assigned mentors.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {myMentors.map((mentor) => {
          const enrCount = myEnrollments.filter((e) => e.mentorId === mentor.uid).length;
          return (
            <Card
              key={mentor.uid}
              className="overflow-hidden hover:shadow-lg transition-shadow"
            >
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar className="w-14 h-14 border-2 border-primary/10">
                    <AvatarImage
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${mentor.name}`}
                    />
                    <AvatarFallback>{mentor.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <h3 className="font-bold text-lg truncate">{mentor.name}</h3>
                    <p className="text-sm text-muted-foreground truncate">{mentor.email}</p>
                    <Badge variant="default" className="mt-1 text-[10px] uppercase font-bold">
                      Verified Mentor
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Users className="w-3.5 h-3.5" />
                  <span>{enrCount} course{enrCount !== 1 ? 's' : ''} together</span>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    className="flex-1 gap-2"
                    onClick={() =>
                      toast.info(
                        'Open Messages in the sidebar, then New conversation, to chat with this mentor.',
                      )
                    }
                  >
                    <Mail className="w-4 h-4" />
                    Message
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {myMentors.length === 0 && (
          <Card className="md:col-span-2 lg:col-span-3 border-dashed border-2 bg-transparent">
            <CardContent className="flex flex-col items-center justify-center py-14 text-center">
              <Users className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
              <h3 className="text-lg font-semibold">No Mentors Yet</h3>
              <p className="text-muted-foreground max-w-sm mx-auto mt-2 text-sm">
                You haven't enrolled in any courses yet. Browse the course catalog to get
                matched with a mentor.
              </p>
              <Button className="mt-6" variant="outline">
                Browse Courses
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
