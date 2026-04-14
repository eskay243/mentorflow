import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { MentorKYC } from '@/types';

export default function KYCView() {
  const { profile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<Partial<MentorKYC>>(profile?.kycData || {
    idType: 'National ID',
    idNumber: '',
    address: '',
    phoneNumber: '',
    bankName: '',
    accountNumber: '',
    accountName: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.uid) return;

    // Basic validation
    const requiredFields = ['idNumber', 'address', 'phoneNumber', 'bankName', 'accountNumber', 'accountName'];
    for (const field of requiredFields) {
      if (!formData[field as keyof MentorKYC]) {
        toast.error(`Please fill in the ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const kycData: MentorKYC = {
        ...formData as MentorKYC,
        submittedAt: Date.now(),
      };

      await updateDoc(doc(db, 'users', profile.uid), {
        kycStatus: 'pending',
        kycData: kycData
      });

      toast.success('KYC details submitted for verification');
    } catch (error) {
      console.error('Error submitting KYC:', error);
      toast.error('Failed to submit KYC details');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (profile?.kycStatus === 'pending') {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4 text-center">
        <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600">
          <Clock className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold">Verification Pending</h2>
        <p className="text-muted-foreground max-w-md">
          Your KYC details have been submitted and are currently being reviewed by our team in Abuja. 
          We'll notify you once your account is verified.
        </p>
        <Button variant="outline" onClick={() => window.location.reload()}>Refresh Status</Button>
      </div>
    );
  }

  if (profile?.kycStatus === 'verified') {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-green-600">
          <CheckCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold">Account Verified</h2>
        <p className="text-muted-foreground max-w-md">
          Congratulations! Your account is fully verified. You can now manage your courses and receive payouts.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl text-left mt-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Bank Details</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p><span className="text-muted-foreground">Bank:</span> {profile.kycData?.bankName}</p>
              <p><span className="text-muted-foreground">Account:</span> {profile.kycData?.accountNumber}</p>
              <p><span className="text-muted-foreground">Name:</span> {profile.kycData?.accountName}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Identity</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p><span className="text-muted-foreground">Type:</span> {profile.kycData?.idType}</p>
              <p><span className="text-muted-foreground">Number:</span> {profile.kycData?.idNumber}</p>
              <p><span className="text-muted-foreground">Verified:</span> {new Date(profile.kycData?.verifiedAt || 0).toLocaleDateString()}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Mentor Onboarding & KYC</h2>
        <p className="text-muted-foreground">
          Please provide your identity and banking details to complete your onboarding.
        </p>
      </div>

      {profile?.kycStatus === 'rejected' && (
        <Card className="bg-destructive/5 border-destructive/20">
          <CardContent className="p-4 flex gap-4 items-start">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-destructive">Verification Rejected</h4>
              <p className="text-sm text-destructive/80">
                Reason: {profile.kycData?.rejectionReason || 'Please review your details and resubmit.'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Identity Information</CardTitle>
            <CardDescription>We need this to verify your identity as a mentor.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="idType">Identification Type</Label>
                <Select 
                  value={formData.idType} 
                  onValueChange={(value) => setFormData({ ...formData, idType: value })}
                >
                  <SelectTrigger id="idType">
                    <SelectValue placeholder="Select ID type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="National ID">National ID (NIN)</SelectItem>
                    <SelectItem value="Voters Card">Voters Card</SelectItem>
                    <SelectItem value="International Passport">International Passport</SelectItem>
                    <SelectItem value="Drivers License">Drivers License</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="idNumber">ID Number</Label>
                <Input 
                  id="idNumber" 
                  placeholder="Enter your ID number" 
                  value={formData.idNumber}
                  onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Input 
                id="phoneNumber" 
                placeholder="+234..." 
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Residential Address</Label>
              <Textarea 
                id="address" 
                placeholder="Your full address in Abuja or elsewhere" 
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Banking Details</CardTitle>
            <CardDescription>Where you'll receive your 37% commission payouts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bankName">Bank Name</Label>
              <Input 
                id="bankName" 
                placeholder="e.g. GTBank, Zenith Bank" 
                value={formData.bankName}
                onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="accountNumber">Account Number</Label>
                <Input 
                  id="accountNumber" 
                  placeholder="10 digits" 
                  maxLength={10}
                  value={formData.accountNumber}
                  onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountName">Account Name</Label>
                <Input 
                  id="accountName" 
                  placeholder="As it appears on your bank statement" 
                  value={formData.accountName}
                  onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Submit for Verification
          </Button>
        </div>
      </form>
    </div>
  );
}
