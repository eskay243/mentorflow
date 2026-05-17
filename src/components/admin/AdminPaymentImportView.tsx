import React, { useMemo, useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  collection,
  doc,
  writeBatch,
  type DocumentData,
  type DocumentReference,
} from 'firebase/firestore';
import { AlertCircle, CheckCircle2, FileSpreadsheet, Loader2, RefreshCw, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { app, db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { Course, Enrollment, UserProfile } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  buildCombinedImport,
  canonicalCourseKey,
  enrollmentStatusFromCourseStatus,
  makePlaceholderEmail,
  normalizeImportKey,
  parsePaymentTrackerFile,
  parseStudentRecordFile,
  payoutStatusFromPaymentStatus,
  stableImportId,
  validPaymentTrackerRows,
  type AnyPaymentTrackerRow,
  type CombinedImportResult,
  type CombinedImportRow,
  type PaymentTrackerParseResult,
  type StudentRecordParseResult,
} from '@/lib/paymentTrackerImport';

interface AdminPaymentImportViewProps {
  users: UserProfile[];
  courses: Course[];
  enrollments: Enrollment[];
}

interface PendingWrite {
  ref: DocumentReference<DocumentData>;
  data: Record<string, unknown>;
}

interface CombinedPreview {
  mentors: number;
  students: number;
  courses: number;
  enrollments: number;
  summaries: number;
  payments: number;
  payouts: number;
  rows: number;
  matchedRows: number;
  unmatchedStudentRows: number;
  ambiguousStudentRows: number;
}

interface SheetSyncResult {
  importId: string;
  summary: CombinedPreview;
  errors: Array<{ rowNumber: number; field: string; message: string }>;
}

export default function AdminPaymentImportView({ users, courses, enrollments }: AdminPaymentImportViewProps) {
  const { profile } = useAuth();
  const [trackerFileName, setTrackerFileName] = useState('');
  const [studentFileName, setStudentFileName] = useState('');
  const [trackerResult, setTrackerResult] = useState<PaymentTrackerParseResult | null>(null);
  const [studentResult, setStudentResult] = useState<StudentRecordParseResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [trackerSheetUrl, setTrackerSheetUrl] = useState('');
  const [trackerSheetTab, setTrackerSheetTab] = useState('');
  const [studentSheetUrl, setStudentSheetUrl] = useState('');
  const [studentSheetTab, setStudentSheetTab] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [sheetSummary, setSheetSummary] = useState<SheetSyncResult | null>(null);

  const combinedImport = useMemo(
    () => (trackerResult && studentResult ? buildCombinedImport(trackerResult, studentResult) : null),
    [trackerResult, studentResult],
  );
  const combinedPreview = combinedImport?.preview ?? null;
  const mergeErrors = combinedImport && trackerResult && studentResult
    ? diffErrors(combinedImport.errors, [...trackerResult.errors, ...studentResult.errors])
    : [];

  const canImport =
    !!trackerResult &&
    !!studentResult &&
    trackerResult.errors.length === 0 &&
    studentResult.errors.length === 0 &&
    mergeErrors.length === 0 &&
    validPaymentTrackerRows(trackerResult).length > 0 &&
    (combinedImport?.rows.length ?? 0) > 0;

  const handleTrackerFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setTrackerFileName(file.name);
    setTrackerResult(null);
    setIsParsing(true);
    try {
      const result = await parsePaymentTrackerFile(file);
      setTrackerResult(result);
      toast[result.errors.length ? 'error' : 'success'](
        result.errors.length
          ? 'Mentor payment tracker has validation errors.'
          : `Parsed ${validPaymentTrackerRows(result).length} mentor tracker row(s).`,
      );
    } finally {
      setIsParsing(false);
      event.target.value = '';
    }
  };

  const handleStudentFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setStudentFileName(file.name);
    setStudentResult(null);
    setIsParsing(true);
    try {
      const result = await parseStudentRecordFile(file);
      setStudentResult(result);
      toast[result.errors.length ? 'error' : 'success'](
        result.errors.length
          ? 'Student record has validation errors.'
          : `Parsed ${result.rows.length} student record row(s).`,
      );
    } finally {
      setIsParsing(false);
      event.target.value = '';
    }
  };

  const handleImport = async () => {
    if (!canImport || !trackerResult || !studentResult || !combinedImport) {
      toast.error('Upload valid mentor tracker and student record files before importing.');
      return;
    }
    setIsImporting(true);
    try {
      const importId = doc(collection(db, 'imports')).id;
      const writes = buildDualImportWrites({
        combinedImport,
        importId,
        fileName: `${trackerFileName} + ${studentFileName}`,
        importedBy: profile?.uid ?? 'unknown',
        users,
        courses,
        enrollments,
      });
      await commitWritesInChunks(writes);
      toast.success(`Imported ${combinedImport.rows.length} matched student record(s) and ${combinedImport.trackerRows.length} tracker row(s).`);
      setTrackerResult(null);
      setStudentResult(null);
      setTrackerFileName('');
      setStudentFileName('');
    } catch (error) {
      console.error(error);
      toast.error('Dual import failed. Check the console for details.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleSheetSync = async () => {
    if (!trackerSheetUrl.trim() || !studentSheetUrl.trim()) {
      toast.error('Enter both mentor tracker and student record Google Sheet URLs.');
      return;
    }
    setIsSyncing(true);
    setSheetSummary(null);
    try {
      const fn = httpsCallable(getFunctions(app), 'syncMentorPaymentSheet');
      const studentSheetNames = studentSheetTab
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean);
      const result = await fn({
        trackerSheetUrl: trackerSheetUrl.trim(),
        trackerSheetName: trackerSheetTab.trim() || undefined,
        studentSheetUrl: studentSheetUrl.trim(),
        studentSheetName: studentSheetTab.trim() || undefined,
        studentSheetNames: studentSheetNames.length > 1 ? studentSheetNames : undefined,
      });
      const data = result.data as SheetSyncResult;
      setSheetSummary(data);
      toast[data.errors.length ? 'error' : 'success'](
        data.errors.length
          ? `Sheet sync finished with ${data.errors.length} validation error(s).`
          : `Synced ${data.summary.rows} row(s) from both sheets.`,
      );
    } catch (error) {
      console.error(error);
      toast.error('Google Sheets sync failed. Confirm both sheets are shared or published.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5" />
          Mentor & Student Import
        </CardTitle>
        <CardDescription>
          Upload the mentor payment tracker and student record together. The import merges them using the existing workbook course names.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="upload">
          <TabsList>
            <TabsTrigger value="upload">Excel / CSV Upload</TabsTrigger>
            <TabsTrigger value="sheets">Google Sheets Sync</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-6 pt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FileInputCard
                title="Mentor Payment Tracker"
                description="Course, mentor, student count, amount due, disbursed, and payment status."
                fileName={trackerFileName}
                onChange={handleTrackerFileChange}
                disabled={isParsing || isImporting}
                errors={trackerResult?.errors ?? []}
                validRows={trackerResult ? validPaymentTrackerRows(trackerResult).length : 0}
              />
              <FileInputCard
                title="Student Record"
                description="Reads all student tabs. Name, course, email, phone, onboarding date, amount paid, and payment status are pulled from the workbook."
                fileName={studentFileName}
                onChange={handleStudentFileChange}
                disabled={isParsing || isImporting}
                errors={studentResult?.errors ?? []}
                validRows={studentResult?.rows.length ?? 0}
              />
            </div>

            {isParsing && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Parsing file…
              </div>
            )}

            {(trackerResult || studentResult) && (
              <div className="space-y-4">
                {trackerResult && <ValidationPanel title="Mentor tracker validation" errors={trackerResult.errors} />}
                {studentResult && <ValidationPanel title="Student record validation" errors={studentResult.errors} />}
                {trackerResult && studentResult && <ValidationPanel title="Course and mentor matching" errors={mergeErrors} />}
              </div>
            )}

            {combinedPreview && (
              <CombinedPreviewPanel
                preview={combinedPreview}
                trackerRows={combinedImport?.trackerRows ?? []}
                rows={combinedImport?.rows ?? []}
                canImport={canImport}
                isImporting={isImporting}
                onImport={handleImport}
              />
            )}
          </TabsContent>

          <TabsContent value="sheets" className="space-y-6 pt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <SheetInput
                title="Mentor tracker sheet"
                url={trackerSheetUrl}
                tab={trackerSheetTab}
                onUrl={setTrackerSheetUrl}
                onTab={setTrackerSheetTab}
                disabled={isSyncing}
              />
              <SheetInput
                title="Student record sheet"
                url={studentSheetUrl}
                tab={studentSheetTab}
                onUrl={setStudentSheetUrl}
                onTab={setStudentSheetTab}
                disabled={isSyncing}
              />
            </div>
            <Button className="gap-2" onClick={handleSheetSync} disabled={isSyncing}>
              {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Sync both sheets
            </Button>
            {sheetSummary && (
              <div className="space-y-4">
                <PreviewStats preview={sheetSummary.summary} />
                <ValidationPanel title="Google Sheets sync validation" errors={sheetSummary.errors} />
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function FileInputCard({
  title,
  description,
  fileName,
  validRows,
  errors,
  disabled,
  onChange,
}: {
  title: string;
  description: string;
  fileName: string;
  validRows: number;
  errors: Array<{ rowNumber: number; field: string; message: string }>;
  disabled: boolean;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div>
        <h3 className="font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Input type="file" accept=".xlsx,.xls,.csv" onChange={onChange} disabled={disabled} />
      {fileName && (
        <div className="text-sm">
          <p className="font-medium">{fileName}</p>
          <p className={errors.length ? 'text-destructive' : 'text-green-700'}>
            {validRows} valid row(s), {errors.length} error(s)
          </p>
        </div>
      )}
    </div>
  );
}

function SheetInput({
  title,
  url,
  tab,
  disabled,
  onUrl,
  onTab,
}: {
  title: string;
  url: string;
  tab: string;
  disabled: boolean;
  onUrl: (value: string) => void;
  onTab: (value: string) => void;
}) {
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <h3 className="font-medium">{title}</h3>
      <div className="grid gap-2">
        <Label>Google Sheet URL</Label>
        <Input value={url} onChange={(event) => onUrl(event.target.value)} disabled={disabled} placeholder="https://docs.google.com/spreadsheets/d/..." />
      </div>
      <div className="grid gap-2">
        <Label>Tab name (optional)</Label>
        <Input value={tab} onChange={(event) => onTab(event.target.value)} disabled={disabled} placeholder="Sheet1" />
      </div>
    </div>
  );
}

function CombinedPreviewPanel({
  preview,
  trackerRows,
  rows,
  canImport,
  isImporting,
  onImport,
}: {
  preview: CombinedPreview;
  trackerRows: AnyPaymentTrackerRow[];
  rows: CombinedImportRow[];
  canImport: boolean;
  isImporting: boolean;
  onImport: () => void;
}) {
  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Combined import preview</h3>
          <p className="text-sm text-muted-foreground">
            {trackerRows.length} mentor tracker row(s) + {rows.length} matched student row(s)
          </p>
        </div>
        <Button className="gap-2" onClick={onImport} disabled={!canImport || isImporting}>
          {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          Confirm dual import
        </Button>
      </div>
      <PreviewStats preview={preview} />
      {preview.unmatchedStudentRows > 0 || preview.ambiguousStudentRows > 0 ? (
        <div className="flex items-center gap-2 text-sm text-amber-700">
          <AlertCircle className="w-4 h-4" />
          {preview.unmatchedStudentRows} course row(s) were not found in the mentor tracker, and {preview.ambiguousStudentRows} course row(s) matched more than one mentor.
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-green-700">
          <CheckCircle2 className="w-4 h-4" />
          All student rows match a mentor tracker course.
        </div>
      )}
      <StudentPreviewTable rows={rows} />
    </div>
  );
}

function PreviewStats({ preview }: { preview: CombinedPreview }) {
  const stats = [
    ['Mentors', preview.mentors],
    ['Students', preview.students],
    ['Courses', preview.courses],
    ['Enrollments', preview.enrollments],
    ['Summaries', preview.summaries],
    ['Payouts', preview.payouts],
    ['Unmatched', preview.unmatchedStudentRows],
    ['Ambiguous', preview.ambiguousStudentRows],
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-8">
      {stats.map(([label, value]) => (
        <div key={label} className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold">{value}</p>
        </div>
      ))}
    </div>
  );
}

function StudentPreviewTable({ rows }: { rows: CombinedImportRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student</TableHead>
            <TableHead>Mentor</TableHead>
            <TableHead>Course</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Amount Paid</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.slice(0, 8).map((row) => (
            <TableRow key={`${row.rowNumber}-${row.emailAddress}-${row.course}`}>
              <TableCell>
                <p className="font-medium">{row.name}</p>
                <p className="text-xs text-muted-foreground">{row.emailAddress}</p>
              </TableCell>
              <TableCell>{row.mentorName}</TableCell>
              <TableCell>{row.course}</TableCell>
              <TableCell>{row.sourceSheet} row {row.rowNumber}</TableCell>
              <TableCell>₦{row.amountPaid.toLocaleString()}</TableCell>
              <TableCell>
                <Badge variant="outline">{row.paymentStatus}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {rows.length > 8 && <p className="text-xs text-muted-foreground px-4 py-2 border-t">Showing first 8 rows of {rows.length}.</p>}
    </div>
  );
}

function ValidationPanel({
  title,
  errors,
}: {
  title: string;
  errors: Array<{ rowNumber: number; field: string; message: string }>;
}) {
  if (errors.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-700">
        <CheckCircle2 className="w-4 h-4" />
        {title}: no validation errors.
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-destructive">
        <AlertCircle className="w-4 h-4" />
        {title}
      </div>
      {errors.slice(0, 25).map((error, index) => (
        <p key={`${error.rowNumber}-${error.field}-${index}`} className="text-sm">
          Row {error.rowNumber}, <span className="font-medium">{error.field}</span>: {error.message}
        </p>
      ))}
      {errors.length > 25 && <p className="text-xs text-muted-foreground">Showing first 25 errors of {errors.length}.</p>}
    </div>
  );
}

function diffErrors(
  allErrors: Array<{ rowNumber: number; field: string; message: string }>,
  parserErrors: Array<{ rowNumber: number; field: string; message: string }>,
) {
  const parserKeys = new Set(parserErrors.map((error) => `${error.rowNumber}:${error.field}:${error.message}`));
  return allErrors.filter((error) => !parserKeys.has(`${error.rowNumber}:${error.field}:${error.message}`));
}

function buildDualImportWrites({
  combinedImport,
  importId,
  fileName,
  importedBy,
  users,
  courses,
  enrollments,
}: {
  combinedImport: CombinedImportResult;
  importId: string;
  fileName: string;
  importedBy: string;
  users: UserProfile[];
  courses: Course[];
  enrollments: Enrollment[];
}): PendingWrite[] {
  const writes = new Map<string, PendingWrite>();
  const now = Date.now();
  const trackerRows = combinedImport.trackerRows;
  const studentRows = combinedImport.rows;
  const usersByEmail = new Map(users.map((user) => [user.email.toLowerCase(), user]));
  const mentorsByName = new Map(users.filter((user) => user.role === 'mentor').map((user) => [normalizeImportKey(user.name), user]));
  const trackerByCourse = new Map(trackerRows.map((row) => [mergeKey(row.mentorName, canonicalCourseKey(row.course)), row]));
  const put = (ref: DocumentReference<DocumentData>, data: Record<string, unknown>) => writes.set(ref.path, { ref, data });

  const resolveMentorCourse = (mentorName: string, courseName: string, trackerRow?: AnyPaymentTrackerRow) => {
    const mentorEmail = (trackerRow?.mentorEmail || makePlaceholderEmail(mentorName, 'mentor')).toLowerCase();
    const existingMentor = usersByEmail.get(mentorEmail) || mentorsByName.get(normalizeImportKey(mentorName));
    const mentorId = existingMentor?.uid ?? `imported_mentor_${stableImportId([mentorEmail || mentorName])}`;
    const existingCourse = courses.find((course) => canonicalCourseKey(course.title) === canonicalCourseKey(courseName) && course.mentorId === mentorId);
    const courseId = existingCourse?.id ?? `imported_course_${stableImportId([courseName, mentorId])}`;

    put(doc(db, 'users', mentorId), {
      uid: mentorId,
      email: mentorEmail,
      name: mentorName,
      role: 'mentor',
      createdAt: existingMentor?.createdAt ?? now,
      kycStatus: existingMentor?.kycStatus ?? 'not_started',
      sourceImportId: importId,
      updatedAt: now,
    });
    put(doc(db, 'courses', courseId), {
      id: courseId,
      title: courseName,
      description: `${trackerRow?.cohort ?? 'Student record'} imported from tracker records.`,
      mentorId,
      mentorName,
      price: trackerRow?.coursePrice ?? 0,
      commissionRate: trackerRow?.commissionRate ?? 0.37,
      createdAt: (existingCourse as Course & { createdAt?: number } | undefined)?.createdAt ?? now,
      sourceImportId: importId,
      updatedAt: now,
    });
    return { mentorId, courseId };
  };

  trackerRows.forEach((row) => {
    const { mentorId, courseId } = resolveMentorCourse(row.mentorName, row.course, row);
    if ('numberOfStudents' in row) {
      const summaryId = `imported_summary_${stableImportId([row.cohort, courseId, mentorId, row.startDate, row.dueDate])}`;
      put(doc(db, 'paymentTrackerSummaries', summaryId), {
        id: summaryId,
        cohort: row.cohort,
        courseId,
        courseTitle: row.course,
        mentorId,
        mentorName: row.mentorName,
        courseStatus: row.courseStatus,
        numberOfStudents: row.numberOfStudents,
        startDate: row.startDate,
        dueDate: row.dueDate,
        totalAmountPaid: row.totalAmountPaid,
        amountDue: row.amountDue,
        amountDisbursed: row.amountDisbursed,
        paymentStatus: row.paymentStatus,
        commissionRate: row.commissionRate,
        sourceImportId: importId,
        importedAt: now,
        updatedAt: now,
      });
      if (row.amountDisbursed > 0) putPayout(put, `imported_payout_${stableImportId([mentorId, summaryId])}`, mentorId, row, importId, now, undefined, summaryId);
    }
  });

  studentRows.forEach((row) => {
    const trackerRow = trackerByCourse.get(mergeKey(row.mentorName, canonicalCourseKey(row.course)));
    const { mentorId, courseId } = resolveMentorCourse(row.mentorName, row.course, trackerRow);
    const existingStudent = usersByEmail.get(row.emailAddress);
    const studentId = existingStudent?.uid ?? `imported_student_${stableImportId([row.emailAddress])}`;
    const existingEnrollment = enrollments.find((enrollment) => enrollment.studentId === studentId && enrollment.courseId === courseId);
    const enrollmentId = existingEnrollment?.id ?? `imported_enrollment_${stableImportId([studentId, courseId])}`;
    const commissionRate = trackerRow?.commissionRate ?? 0.37;
    const commissionEarned = trackerRow && 'numberOfStudents' in trackerRow && trackerRow.numberOfStudents > 0
      ? Math.round(trackerRow.amountDue / trackerRow.numberOfStudents)
      : Math.round(row.amountPaid * commissionRate);

    put(doc(db, 'users', studentId), {
      uid: studentId,
      email: row.emailAddress,
      name: row.name,
      role: 'student',
      createdAt: existingStudent?.createdAt ?? now,
      kycStatus: existingStudent?.kycStatus ?? 'not_started',
      biodata: { ...(existingStudent?.biodata ?? {}), phoneNumber: row.phoneNumber },
      sourceImportId: importId,
      updatedAt: now,
    });
    put(doc(db, 'enrollments', enrollmentId), {
      id: enrollmentId,
      studentId,
      studentName: row.name,
      courseId,
      courseTitle: row.course,
      mentorId,
      status: enrollmentStatusFromCourseStatus(row.courseStatus),
      onboardedAt: row.onboardingDate,
      totalPaid: row.amountPaid,
      commissionEarned,
      cohort: row.cohort,
      sourceSheet: row.sourceSheet,
      sourceRowNumber: row.rowNumber,
      trackerRowNumber: row.trackerRowNumber ?? null,
      amountDue: row.amountDue,
      amountDisbursed: row.amountDisbursed,
      sourceImportId: importId,
      updatedAt: now,
    });
    if (row.amountPaid > 0) {
      const paymentId = `imported_payment_${stableImportId([enrollmentId])}`;
      put(doc(db, 'payments', paymentId), {
        id: paymentId,
        enrollmentId,
        studentId,
        amount: row.amountPaid,
        date: row.onboardingDate || now,
        status: 'success',
        paystackReference: `student-import:${importId}:${row.rowNumber}`,
        sourceSheet: row.sourceSheet,
        sourceRowNumber: row.rowNumber,
        sourceImportId: importId,
        updatedAt: now,
      });
    }
    const studentRecordId = `imported_student_record_${stableImportId([studentId, courseId, mentorId])}`;
    put(doc(db, 'studentRecordImports', studentRecordId), {
      id: studentRecordId,
      sourceImportId: importId,
      studentId,
      studentName: row.name,
      studentEmail: row.emailAddress,
      phoneNumber: row.phoneNumber ?? null,
      courseId,
      courseTitle: row.course,
      mentorId,
      mentorName: row.mentorName,
      onboardingDate: row.onboardingDate,
      courseStatus: row.courseStatus,
      amountPaid: row.amountPaid,
      paymentStatus: row.paymentStatus,
      sourceSheet: row.sourceSheet,
      sourceRowNumber: row.rowNumber,
      trackerSourceSheet: row.trackerSourceSheet ?? null,
      trackerRowNumber: row.trackerRowNumber ?? null,
      cohort: row.cohort,
      importedAt: now,
      updatedAt: now,
    });
  });

  put(doc(db, 'imports', importId), {
    id: importId,
    sourceType: 'dual_excel',
    mode: 'dual',
    fileName,
    importedBy,
    importedAt: now,
    rowCount: trackerRows.length + studentRows.length,
    successCount: trackerRows.length + studentRows.length,
    errorCount: 0,
    summary: combinedImport.preview,
  });

  return [...writes.values()];
}

function putPayout(
  put: (ref: DocumentReference<DocumentData>, data: Record<string, unknown>) => void,
  payoutId: string,
  mentorId: string,
  row: AnyPaymentTrackerRow,
  importId: string,
  now: number,
  enrollmentId?: string,
  summaryId?: string,
) {
  const payoutStatus = payoutStatusFromPaymentStatus(row.paymentStatus);
  put(doc(db, 'payouts', payoutId), {
    id: payoutId,
    mentorId,
    amount: row.amountDisbursed,
    status: payoutStatus,
    requestedAt: row.dueDate || now,
    processedAt: payoutStatus === 'processed' ? row.dueDate || now : null,
    enrollmentId: enrollmentId ?? null,
    summaryId: summaryId ?? null,
    sourceImportId: importId,
    updatedAt: now,
  });
}

function mergeKey(mentorName: string, course: string) {
  return stableImportId([mentorName, course]);
}

async function commitWritesInChunks(writes: PendingWrite[]) {
  const chunkSize = 450;
  for (let i = 0; i < writes.length; i += chunkSize) {
    const batch = writeBatch(db);
    writes.slice(i, i + chunkSize).forEach((write) => batch.set(write.ref, write.data, { merge: true }));
    await batch.commit();
  }
}
