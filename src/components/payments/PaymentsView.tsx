import React from 'react';
import { useFirestoreCollection } from '@/hooks/useFirestore';
import { Payment } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { where } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';

export default function PaymentsView() {
  const { isAdmin, profile } = useAuth();
  const constraints = isAdmin ? [] : [where('studentId', '==', profile?.uid || '')];
  const { data: payments } = useFirestoreCollection<Payment>('payments', constraints);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Payment History</h2>
        <p className="text-muted-foreground">Track all student transactions and receipts.</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Transaction ID</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Receipt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="font-mono text-xs">{payment.id}</TableCell>
                  <TableCell>{new Date(payment.date).toLocaleDateString()}</TableCell>
                  <TableCell className="font-semibold">₦{payment.amount.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={payment.status === 'success' ? 'default' : 'destructive'}>
                      {payment.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="gap-2">
                      <FileText className="w-4 h-4" />
                      View Receipt
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {payments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    No payment records found.
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
