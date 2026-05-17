import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useFirestoreCollection } from '@/hooks/useFirestore';
import { where } from 'firebase/firestore';
import { Enrollment } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function CommissionsView() {
  const { profile } = useAuth();
  const { data: enrollments } = useFirestoreCollection<Enrollment>('enrollments', [
    where('mentorId', '==', profile?.uid || ''),
  ]);

  const totalCommission = enrollments.reduce((s, e) => s + (e.commissionEarned || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Commissions</h2>
        <p className="text-muted-foreground">
          Commission earned across enrollments (from recorded payments).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">₦{totalCommission.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {enrollments.length} enrollment{enrollments.length === 1 ? '' : 's'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">By enrollment</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Course</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Commission (₦)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enrollments.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{e.courseTitle}</TableCell>
                  <TableCell>{e.studentName}</TableCell>
                  <TableCell>{e.status}</TableCell>
                  <TableCell className="text-right font-medium">
                    {(e.commissionEarned || 0).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
              {enrollments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                    No enrollments yet.
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
