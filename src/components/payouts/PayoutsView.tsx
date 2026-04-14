import React, { useState } from 'react';
import { useFirestoreCollection } from '@/hooks/useFirestore';
import { Payout, UserProfile } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DollarSign, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
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
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';

export default function PayoutsView() {
  const { isAdmin, profile } = useAuth();
  const { data: payouts } = useFirestoreCollection<Payout>('payouts');
  const { data: users } = useFirestoreCollection<UserProfile>('users');

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');

  const filteredPayouts = isAdmin 
    ? payouts 
    : payouts.filter(p => p.mentorId === profile?.uid);

  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutAmount || parseFloat(payoutAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'payouts'), {
        mentorId: profile?.uid,
        amount: parseFloat(payoutAmount),
        status: 'pending',
        requestedAt: Date.now(),
      });
      
      toast.success('Payout request submitted');
      setIsAddDialogOpen(false);
      setPayoutAmount('');
    } catch (error) {
      console.error('Error requesting payout:', error);
      toast.error('Failed to submit payout request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Commission Payouts</h2>
          <p className="text-muted-foreground">
            {isAdmin ? "Manage and process mentor commission distributions." : "Track your earnings and payout status."}
          </p>
        </div>
        {!isAdmin && (
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <DollarSign className="w-4 h-4" />
                Request Payout
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleRequestPayout}>
                <DialogHeader>
                  <DialogTitle>Request Payout</DialogTitle>
                  <DialogDescription>
                    Enter the amount you wish to withdraw from your earned commissions.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="amount">Amount (₦)</Label>
                    <Input 
                      id="amount" 
                      type="number" 
                      placeholder="e.g. 5000" 
                      value={payoutAmount}
                      onChange={(e) => setPayoutAmount(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Submit Request
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Paid Out</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₦{filteredPayouts.filter(p => p.status === 'processed').reduce((sum, p) => sum + p.amount, 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Payouts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₦{filteredPayouts.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Last Payout</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredPayouts.filter(p => p.status === 'processed').length > 0 ? "₦" + filteredPayouts.filter(p => p.status === 'processed').sort((a,b) => (b.processedAt || 0) - (a.processedAt || 0))[0].amount.toLocaleString() : "None"}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {isAdmin && <TableHead>Mentor</TableHead>}
                <TableHead>Amount</TableHead>
                <TableHead>Requested At</TableHead>
                <TableHead>Processed At</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Receipt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayouts.map((payout) => {
                const mentor = users.find(u => u.uid === payout.mentorId);
                return (
                  <TableRow key={payout.id}>
                    {isAdmin && <TableCell className="font-medium">{mentor?.name || 'Unknown'}</TableCell>}
                    <TableCell className="font-semibold">₦{payout.amount.toLocaleString()}</TableCell>
                    <TableCell>{new Date(payout.requestedAt).toLocaleDateString()}</TableCell>
                    <TableCell>{payout.processedAt ? new Date(payout.processedAt).toLocaleDateString() : '-'}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={payout.status === 'processed' ? 'default' : payout.status === 'pending' ? 'secondary' : 'destructive'}
                        className="gap-1"
                      >
                        {payout.status === 'processed' ? <CheckCircle className="w-3 h-3" /> : payout.status === 'pending' ? <Clock className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                        {payout.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {payout.receiptUrl ? (
                        <Button variant="ghost" size="sm">View</Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredPayouts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 6 : 5} className="text-center py-12 text-muted-foreground">
                    No payout records found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
