import React, { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogIn, GraduationCap, Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Login() {
  const [selectedRole, setSelectedRole] = useState<'student' | 'mentor'>('student');

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      // Store the selected role in localStorage so AuthContext can pick it up for new users
      localStorage.setItem('preferred_role', selectedRole);
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-primary-foreground shadow-lg rotate-3">
              <span className="text-3xl font-bold">M</span>
            </div>
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight">MentorFlow</CardTitle>
          <CardDescription className="text-base">
            Abuja's Premier EdTech Platform
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setSelectedRole('student')}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-sm font-medium",
                selectedRole === 'student' 
                  ? "border-primary bg-primary/5 text-primary" 
                  : "border-muted bg-card text-muted-foreground hover:border-muted-foreground/30"
              )}
            >
              <GraduationCap className="w-6 h-6" />
              Join as Student
            </button>
            <button
              onClick={() => setSelectedRole('mentor')}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-sm font-medium",
                selectedRole === 'mentor' 
                  ? "border-primary bg-primary/5 text-primary" 
                  : "border-muted bg-card text-muted-foreground hover:border-muted-foreground/30"
              )}
            >
              <Briefcase className="w-6 h-6" />
              Join as Mentor
            </button>
          </div>

          <Button onClick={handleLogin} className="w-full py-6 text-lg gap-3">
            <LogIn className="w-6 h-6" />
            Sign in with Google
          </Button>

          <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <span className="w-2 h-2 bg-green-600 rounded-full animate-pulse" />
            Based in Abuja, Nigeria
          </div>
          
          <p className="text-xs text-center text-muted-foreground">
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
