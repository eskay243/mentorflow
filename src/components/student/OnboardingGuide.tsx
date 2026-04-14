import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft, 
  GraduationCap, 
  Users, 
  BookOpen, 
  ShieldCheck,
  Rocket
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/context/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';

const STEPS = [
  {
    title: "Welcome to MentorFlow",
    description: "Abuja's premier platform connecting ambitious students with world-class mentors. Let's get you set up for success.",
    icon: GraduationCap,
    color: "bg-blue-500",
  },
  {
    title: "Meet Your Mentors",
    description: "Our mentors are industry experts dedicated to your growth. You'll have 1-on-1 sessions and direct messaging access.",
    icon: Users,
    color: "bg-purple-500",
  },
  {
    title: "Explore Courses",
    description: "Browse our curated catalog of courses designed for the Nigerian market. From tech to business, we've got you covered.",
    icon: BookOpen,
    color: "bg-green-500",
  },
  {
    title: "Identity Verification",
    description: "To maintain platform integrity, we require a quick KYC check. This ensures a safe learning environment for everyone.",
    icon: ShieldCheck,
    color: "bg-orange-500",
  },
  {
    title: "Ready to Launch?",
    description: "You're all set! Complete your profile and start your journey towards excellence.",
    icon: Rocket,
    color: "bg-red-500",
  }
];

export default function OnboardingGuide({ onComplete }: { onComplete: () => void }) {
  const [currentStep, setCurrentStep] = useState(0);
  const { profile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleFinish = async () => {
    if (!profile) return;
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        onboardingCompleted: true
      });
      toast.success('Onboarding complete! Welcome aboard.');
      onComplete();
    } catch (error) {
      toast.error('Failed to save progress');
    } finally {
      setIsSubmitting(false);
    }
  };

  const StepIcon = STEPS[currentStep].icon;

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl overflow-hidden border-none shadow-2xl bg-white/80 backdrop-blur-xl">
        <div className="h-2 bg-muted">
          <motion.div 
            className="h-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
          />
        </div>
        
        <CardContent className="p-8 md:p-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="flex justify-center">
                <div className={`w-20 h-20 rounded-3xl ${STEPS[currentStep].color} flex items-center justify-center text-white shadow-lg rotate-3`}>
                  <StepIcon className="w-10 h-10" />
                </div>
              </div>

              <div className="text-center space-y-4">
                <h2 className="text-4xl font-serif font-bold tracking-tight text-gray-900">
                  {STEPS[currentStep].title}
                </h2>
                <p className="text-lg text-muted-foreground leading-relaxed max-w-md mx-auto">
                  {STEPS[currentStep].description}
                </p>
              </div>

              <div className="flex items-center justify-center gap-2">
                {STEPS.map((_, i) => (
                  <div 
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === currentStep ? "w-8 bg-primary" : "w-2 bg-muted"
                    }`}
                  />
                ))}
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="mt-12 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={currentStep === 0 || isSubmitting}
              className="gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>
            
            <Button
              onClick={handleNext}
              disabled={isSubmitting}
              className="gap-2 px-8 py-6 text-lg rounded-xl shadow-lg shadow-primary/20"
            >
              {currentStep === STEPS.length - 1 ? "Get Started" : "Continue"}
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
