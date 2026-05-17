import React, { useState } from 'react';
import {
  signInWithPopup,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { LogIn, GraduationCap, Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function Login() {
  const [selectedRole, setSelectedRole] = useState<'student' | 'mentor'>('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      localStorage.setItem('preferred_role', selectedRole);
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login failed:', error);
      toast.error('Google sign-in failed.');
    }
  };

  const handleEmailSignUp = async () => {
    if (!email.trim() || password.length < 6) {
      toast.error('Enter a valid email and password (min 6 characters).');
      return;
    }
    localStorage.setItem('preferred_role', selectedRole);
    setEmailBusy(true);
    try {
      await createUserWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      console.error(error);
      toast.error('Could not create account. It may already exist—try sign in.');
    } finally {
      setEmailBusy(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error('Enter email and password.');
      return;
    }
    setEmailBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      console.error(error);
      toast.error('Sign-in failed. Check your credentials.');
    } finally {
      setEmailBusy(false);
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
            Abuja&apos;s Premier EdTech Platform
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setSelectedRole('student')}
              className={cn(
                'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-sm font-medium',
                selectedRole === 'student'
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-muted bg-card text-muted-foreground hover:border-muted-foreground/30',
              )}
            >
              <GraduationCap className="w-6 h-6" />
              Join as Student
            </button>
            <button
              type="button"
              onClick={() => setSelectedRole('mentor')}
              className={cn(
                'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-sm font-medium',
                selectedRole === 'mentor'
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-muted bg-card text-muted-foreground hover:border-muted-foreground/30',
              )}
            >
              <Briefcase className="w-6 h-6" />
              Join as Mentor
            </button>
          </div>

          <Button type="button" onClick={handleGoogleLogin} className="w-full py-6 text-lg gap-3">
            <LogIn className="w-6 h-6" />
            Sign in with Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or email</span>
            </div>
          </div>

          <form className="grid gap-4" onSubmit={handleEmailSignIn}>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit" variant="default" className="flex-1" disabled={emailBusy}>
                Sign in with email
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={emailBusy}
                onClick={() => void handleEmailSignUp()}
              >
                Create account
              </Button>
            </div>
          </form>

          <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <span className="w-2 h-2 bg-green-600 rounded-full animate-pulse" />
            Based in Abuja, Nigeria
          </div>

          <p className="text-xs text-center text-muted-foreground">
            By signing in, you agree to our Terms of Service and Privacy Policy. See docs/COMPLIANCE.md
            for data practices.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
