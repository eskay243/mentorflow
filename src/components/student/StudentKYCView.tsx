import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  ShieldCheck, 
  Upload, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  FileText,
  User,
  MapPin,
  Phone
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/context/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';

export default function StudentKYCView() {
  const { profile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    idType: '',
    idNumber: '',
    phoneNumber: '',
    address: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.idType || !formData.idNumber || !formData.phoneNumber || !formData.address) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      if (!profile) return;
      
      const kycData = {
        ...formData,
        submittedAt: Date.now(),
      };

      await updateDoc(doc(db, 'users', profile.uid), {
        kycStatus: 'pending',
        kycData
      });

      toast.success('KYC details submitted for verification');
    } catch (error) {
      console.error('KYC submission error:', error);
      toast.error('Failed to submit KYC details');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (profile?.kycStatus === 'pending') {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Card className="text-center p-8 border-none shadow-xl bg-white/50 backdrop-blur-sm">
          <CardContent className="space-y-6">
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 animate-pulse">
                <Loader2 className="w-10 h-10 animate-spin" />
              </div>
            </div>
            <h2 className="text-3xl font-serif font-bold text-gray-900">Verification Pending</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Our team is currently reviewing your identity documents. This usually takes 24-48 hours. We'll notify you once your account is verified.
            </p>
            <Button variant="outline" disabled className="rounded-xl">
              Processing Submission...
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (profile?.kycStatus === 'verified') {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Card className="text-center p-8 border-none shadow-xl bg-green-50/50 backdrop-blur-sm">
          <CardContent className="space-y-6">
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                <CheckCircle2 className="w-10 h-10" />
              </div>
            </div>
            <h2 className="text-3xl font-serif font-bold text-gray-900">Account Verified</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Your identity has been successfully verified. You now have full access to all MentorFlow features.
            </p>
            <div className="grid grid-cols-2 gap-4 text-left mt-8">
              <div className="p-4 rounded-xl bg-white border border-green-100">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">ID Type</p>
                <p className="font-medium">{profile.kycData?.idType}</p>
              </div>
              <div className="p-4 rounded-xl bg-white border border-green-100">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Status</p>
                <p className="font-medium text-green-600">Fully Verified</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8">
      <div className="mb-8 space-y-2">
        <h1 className="text-4xl font-serif font-bold tracking-tight text-gray-900">Identity Verification</h1>
        <p className="text-muted-foreground text-lg">
          Complete your KYC to ensure platform integrity and unlock premium features.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
          <CardHeader className="bg-primary/5 border-b border-primary/10">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-primary" />
              <div>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>Enter your details exactly as they appear on your ID.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="idType" className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  Identification Type
                </Label>
                <Select onValueChange={(v) => setFormData({ ...formData, idType: v })}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select ID Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nin">National ID (NIN)</SelectItem>
                    <SelectItem value="voters">Voter's Card</SelectItem>
                    <SelectItem value="passport">International Passport</SelectItem>
                    <SelectItem value="drivers">Driver's License</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="idNumber" className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  ID Number
                </Label>
                <Input 
                  id="idNumber" 
                  placeholder="Enter ID Number" 
                  className="rounded-xl"
                  value={formData.idNumber}
                  onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="phoneNumber" className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  Phone Number
                </Label>
                <Input 
                  id="phoneNumber" 
                  placeholder="+234 ..." 
                  className="rounded-xl"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address" className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  Residential Address
                </Label>
                <Input 
                  id="address" 
                  placeholder="Enter your full address" 
                  className="rounded-xl"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 flex gap-3 text-sm text-blue-800">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>
                Please ensure all information provided is accurate. Providing false information may lead to permanent account suspension.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="ghost" className="rounded-xl">
            Save Draft
          </Button>
          <Button type="submit" disabled={isSubmitting} className="rounded-xl px-8 py-6 text-lg shadow-lg shadow-primary/20">
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                Submit for Verification
                <ShieldCheck className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
