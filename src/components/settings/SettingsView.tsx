import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, Phone, MapPin, Calendar, UserCircle, Save, Loader2 } from 'lucide-react';

export default function SettingsView() {
  const { profile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phoneNumber: '',
    address: '',
    dateOfBirth: '',
    gender: '',
    stateOfOrigin: '',
    bio: '',
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || '',
        phoneNumber: profile.biodata?.phoneNumber || '',
        address: profile.biodata?.address || '',
        dateOfBirth: profile.biodata?.dateOfBirth || '',
        gender: profile.biodata?.gender || '',
        stateOfOrigin: profile.biodata?.stateOfOrigin || '',
        bio: profile.biodata?.bio || '',
      });
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setIsSubmitting(true);
    try {
      const updateData = {
        name: formData.name,
        biodata: {
          phoneNumber: formData.phoneNumber,
          address: formData.address,
          dateOfBirth: formData.dateOfBirth,
          gender: formData.gender,
          stateOfOrigin: formData.stateOfOrigin,
          bio: formData.bio,
        }
      };

      await updateDoc(doc(db, 'users', profile.uid), updateData);
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-serif font-bold tracking-tight text-gray-900">Settings</h1>
        <p className="text-muted-foreground">Manage your account settings and profile information.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
          <CardHeader className="bg-primary/5 border-b border-primary/10">
            <div className="flex items-center gap-3">
              <UserCircle className="w-6 h-6 text-primary" />
              <div>
                <CardTitle>User Profile</CardTitle>
                <CardDescription>Basic information about your account.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    id="name" 
                    className="pl-9 rounded-xl"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input 
                  id="email" 
                  disabled 
                  className="rounded-xl bg-muted/50"
                  value={profile?.email || ''}
                />
                <p className="text-[10px] text-muted-foreground">Email cannot be changed.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
          <CardHeader className="bg-primary/5 border-b border-primary/10">
            <div className="flex items-center gap-3">
              <User className="w-6 h-6 text-primary" />
              <div>
                <CardTitle>Biodata</CardTitle>
                <CardDescription>Personal details for your student record.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    id="phoneNumber" 
                    placeholder="+234 ..." 
                    className="pl-9 rounded-xl"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    id="dateOfBirth" 
                    type="date"
                    className="pl-9 rounded-xl"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <Select 
                  value={formData.gender} 
                  onValueChange={(v) => setFormData({ ...formData, gender: v })}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select Gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="stateOfOrigin">State of Origin</Label>
                <Input 
                  id="stateOfOrigin" 
                  placeholder="e.g. Abuja FCT" 
                  className="rounded-xl"
                  value={formData.stateOfOrigin}
                  onChange={(e) => setFormData({ ...formData, stateOfOrigin: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Residential Address</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Textarea 
                  id="address" 
                  placeholder="Enter your full address" 
                  className="pl-9 rounded-xl min-h-[80px]"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea 
                id="bio" 
                placeholder="Tell us a bit about yourself..." 
                className="rounded-xl min-h-[120px]"
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button 
            type="submit" 
            disabled={isSubmitting} 
            className="rounded-xl px-8 py-6 text-lg shadow-lg shadow-primary/20 gap-2"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
