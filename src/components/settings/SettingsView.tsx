import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  User,
  Phone,
  MapPin,
  Calendar,
  UserCircle,
  Save,
  Loader2,
  ShieldCheck,
  Landmark,
  KeyRound,
  Eye,
  EyeOff,
} from 'lucide-react';

// ── Shared profile fields (name + email) ───────────────────────────────────────
function ProfileCard({
  name,
  email,
  onChange,
}: {
  name: string;
  email: string;
  onChange: (name: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="bg-primary/5 border-b border-primary/10">
        <div className="flex items-center gap-3">
          <UserCircle className="w-6 h-6 text-primary" />
          <div>
            <CardTitle>Account Profile</CardTitle>
            <CardDescription>Your display name and login email.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="name"
                className="pl-9"
                value={name}
                onChange={(e) => onChange(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input id="email" disabled className="bg-muted/50" value={email} />
            <p className="text-[10px] text-muted-foreground">Email cannot be changed here.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Student Settings ───────────────────────────────────────────────────────────
function StudentSettings() {
  const { profile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
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
      setForm({
        name: profile.name ?? '',
        phoneNumber: profile.biodata?.phoneNumber ?? '',
        address: profile.biodata?.address ?? '',
        dateOfBirth: profile.biodata?.dateOfBirth ?? '',
        gender: profile.biodata?.gender ?? '',
        stateOfOrigin: profile.biodata?.stateOfOrigin ?? '',
        bio: profile.biodata?.bio ?? '',
      });
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        name: form.name,
        biodata: {
          phoneNumber: form.phoneNumber,
          address: form.address,
          dateOfBirth: form.dateOfBirth,
          gender: form.gender,
          stateOfOrigin: form.stateOfOrigin,
          bio: form.bio,
        },
      });
      toast.success('Settings saved');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <ProfileCard
        name={form.name}
        email={profile?.email ?? ''}
        onChange={(v) => setForm({ ...form, name: v })}
      />

      <Card>
        <CardHeader className="bg-primary/5 border-b border-primary/10">
          <div className="flex items-center gap-3">
            <User className="w-6 h-6 text-primary" />
            <div>
              <CardTitle>Learner Biodata</CardTitle>
              <CardDescription>Personal details for your learner profile.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="phone"
                  placeholder="+234 …"
                  className="pl-9"
                  value={form.phoneNumber}
                  onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dob">Date of Birth</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="dob"
                  type="date"
                  className="pl-9"
                  value={form.dateOfBirth}
                  onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <Select
                value={form.gender}
                onValueChange={(v) => setForm({ ...form, gender: v })}
              >
                <SelectTrigger id="gender">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State of Origin</Label>
              <Input
                id="state"
                placeholder="e.g. Abuja FCT"
                value={form.stateOfOrigin}
                onChange={(e) => setForm({ ...form, stateOfOrigin: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Residential Address</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <Textarea
                id="address"
                placeholder="Full address"
                className="pl-9 min-h-[80px]"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bio">About You</Label>
            <Textarea
              id="bio"
              placeholder="Tell us a bit about yourself…"
              className="min-h-[100px]"
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving} className="gap-2 px-8">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </Button>
      </div>
    </form>
  );
}

// ── Mentor Settings ────────────────────────────────────────────────────────────
function MentorSettings() {
  const { profile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phoneNumber: '',
    bio: '',
    address: '',
    bankName: '',
    accountNumber: '',
    accountName: '',
  });

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name ?? '',
        phoneNumber: profile.biodata?.phoneNumber ?? profile.kycData?.phoneNumber ?? '',
        bio: profile.biodata?.bio ?? '',
        address: profile.biodata?.address ?? profile.kycData?.address ?? '',
        bankName: profile.kycData?.bankName ?? '',
        accountNumber: profile.kycData?.accountNumber ?? '',
        accountName: profile.kycData?.accountName ?? '',
      });
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        name: form.name,
        biodata: { phoneNumber: form.phoneNumber, bio: form.bio, address: form.address },
        'kycData.bankName': form.bankName,
        'kycData.accountNumber': form.accountNumber,
        'kycData.accountName': form.accountName,
        'kycData.phoneNumber': form.phoneNumber,
        'kycData.address': form.address,
      });
      toast.success('Profile updated');
    } catch {
      toast.error('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <ProfileCard
        name={form.name}
        email={profile?.email ?? ''}
        onChange={(v) => setForm({ ...form, name: v })}
      />

      {/* KYC / payout info */}
      <Card>
        <CardHeader className="bg-primary/5 border-b border-primary/10">
          <div className="flex items-center gap-3">
            <Landmark className="w-6 h-6 text-primary" />
            <div>
              <CardTitle>Payout & KYC Details</CardTitle>
              <CardDescription>
                Banking and identity information used for commission payouts.
              </CardDescription>
            </div>
          </div>
          {profile?.kycStatus && (
            <div className="pt-1">
              <Badge
                variant={
                  profile.kycStatus === 'verified'
                    ? 'default'
                    : profile.kycStatus === 'pending'
                    ? 'secondary'
                    : 'outline'
                }
                className="capitalize"
              >
                KYC: {profile.kycStatus}
              </Badge>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="m-phone">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="m-phone"
                  placeholder="+234 …"
                  className="pl-9"
                  value={form.phoneNumber}
                  onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="m-bank">Bank Name</Label>
              <Input
                id="m-bank"
                placeholder="e.g. Zenith Bank"
                value={form.bankName}
                onChange={(e) => setForm({ ...form, bankName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="m-accno">Account Number</Label>
              <Input
                id="m-accno"
                placeholder="10-digit account number"
                maxLength={10}
                value={form.accountNumber}
                onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="m-accname">Account Name</Label>
              <Input
                id="m-accname"
                placeholder="As shown on bank statement"
                value={form.accountName}
                onChange={(e) => setForm({ ...form, accountName: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="m-addr">Address</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <Textarea
                id="m-addr"
                placeholder="Full address"
                className="pl-9 min-h-[80px]"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="m-bio">Professional Bio</Label>
            <Textarea
              id="m-bio"
              placeholder="Share your expertise and teaching philosophy…"
              className="min-h-[100px]"
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving} className="gap-2 px-8">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </Button>
      </div>
    </form>
  );
}

// ── API Keys Card (admin only) ─────────────────────────────────────────────────
function ApiKeysCard() {
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSecret, setShowSecret] = useState(false);
  const [form, setForm] = useState({ paystackSecretKey: '', paystackPublicKey: '' });

  useEffect(() => {
    getDoc(doc(db, 'config', 'apiKeys')).then((snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setForm({
          paystackSecretKey: (d.paystackSecretKey as string) ?? '',
          paystackPublicKey: (d.paystackPublicKey as string) ?? '',
        });
      }
    }).finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await setDoc(doc(db, 'config', 'apiKeys'), {
        paystackSecretKey: form.paystackSecretKey.trim(),
        paystackPublicKey: form.paystackPublicKey.trim(),
        updatedAt: Date.now(),
      }, { merge: true });
      toast.success('API keys saved');
    } catch {
      toast.error('Failed to save API keys');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="bg-primary/5 border-b border-primary/10">
        <div className="flex items-center gap-3">
          <KeyRound className="w-6 h-6 text-primary" />
          <div>
            <CardTitle>Platform API Keys</CardTitle>
            <CardDescription>
              Payment gateway credentials. Stored securely in Firestore (admin-only).
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="pk-key">Paystack Public Key</Label>
              <Input
                id="pk-key"
                placeholder="pk_live_… or pk_test_…"
                value={form.paystackPublicKey}
                onChange={(e) => setForm({ ...form, paystackPublicKey: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sk-key">Paystack Secret Key</Label>
              <div className="relative">
                <Input
                  id="sk-key"
                  type={showSecret ? 'text' : 'password'}
                  placeholder="sk_live_… or sk_test_…"
                  value={form.paystackSecretKey}
                  onChange={(e) => setForm({ ...form, paystackSecretKey: e.target.value })}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowSecret(!showSecret)}
                  aria-label={showSecret ? 'Hide secret key' : 'Show secret key'}
                >
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Used by Cloud Functions to sign Paystack webhook verifications and initiate checkouts.
              </p>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save API Keys
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

// ── Admin Settings ─────────────────────────────────────────────────────────────
function AdminSettings() {
  const { profile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => {
    if (profile) setName(profile.name ?? '');
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), { name });
      toast.success('Admin profile updated');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
    <form onSubmit={handleSubmit} className="space-y-8">
      <ProfileCard
        name={name}
        email={profile?.email ?? ''}
        onChange={setName}
      />

      <Card>
        <CardHeader className="bg-primary/5 border-b border-primary/10">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-primary" />
            <div>
              <CardTitle>Admin Privileges</CardTitle>
              <CardDescription>
                Your access level is managed via Firestore custom claims.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            <ShieldCheck className="w-5 h-5 flex-shrink-0" />
            <span>
              You have <strong>admin</strong> access to this platform. Role changes require direct
              Firebase console or Cloud Function intervention.
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving} className="gap-2 px-8">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </Button>
      </div>
    </form>

    <ApiKeysCard />
    </div>
  );
}

// ── Root SettingsView — dispatches to role-specific component ──────────────────
export default function SettingsView() {
  const { isAdmin, isMentor } = useAuth();

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your profile and account preferences.
        </p>
      </div>
      {isAdmin ? <AdminSettings /> : isMentor ? <MentorSettings /> : <StudentSettings />}
    </div>
  );
}
