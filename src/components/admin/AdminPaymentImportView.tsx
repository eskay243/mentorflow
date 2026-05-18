import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  collection,
  doc,
  writeBatch,
  type DocumentData,
  type DocumentReference,
} from 'firebase/firestore';
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2, RefreshCw, Upload } from 'lucide-react';
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
  buildSingleWorkbookImport,
  canonicalCourseKey,
  enrollmentStatusFromCourseStatus,
  makePlaceholderEmail,
  normalizeImportKey,
  parsePaymentTrackerFile,
  parseSingleWorkbookFile,
  parseStudentRecordFile,
  payoutStatusFromPaymentStatus,
  stableImportId,
  validPaymentTrackerRows,
  type AnyPaymentTrackerRow,
  type CombinedImportResult,
  type CombinedImportRow,
  type ImportReviewIssue,
  type PaymentTrackerParseResult,
  type SingleWorkbookParseResult,
  type StudentRecordImportRow,
  type StudentRecordParseResult,
} from '@/lib/paymentTrackerImport';

interface AdminPaymentImportViewProps {
  users: UserProfile[];
  courses: Course[];
  enrollments: Enrollment[];
  onImported?: () => void;
}

interface PendingWrite {
  ref: DocumentReference<DocumentData>;
  data: Record<string, unknown>;
}

interface ImportWriteSummary {
  mentors: number;
  students: number;
  courses: number;
  enrollments: number;
  payments: number;
  payouts: number;
  summaries: number;
  auditRecords: number;
  writes: number;
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
  reviewIssues?: ImportReviewIssue[];
}

interface ReviewedImportCommitResult {
  importId: string;
  version?: string;
  dryRun?: boolean;
  summary: ImportWriteSummary;
  errors: Array<{ rowNumber: number; field: string; message: string }>;
}

interface CallableImportErrorDetails {
  version?: string;
  phase?: string;
  trackerRowCount?: number;
  studentRowCount?: number;
  writeCount?: number;
  chunkIndex?: number;
  firstWritePath?: string | null;
  lastWritePath?: string | null;
}

interface EditableStudentRow extends StudentRecordImportRow {
  original: StudentRecordImportRow;
  correctedFields: string[];
}

export default function AdminPaymentImportView({ users, courses, enrollments, onImported }: AdminPaymentImportViewProps) {
  const { profile } = useAuth();
  const [trackerFileName, setTrackerFileName] = useState('');
  const [studentFileName, setStudentFileName] = useState('');
  const [masterFileName, setMasterFileName] = useState('');
  const [trackerResult, setTrackerResult] = useState<PaymentTrackerParseResult | null>(null);
  const [studentResult, setStudentResult] = useState<StudentRecordParseResult | null>(null);
  const [singleWorkbookResult, setSingleWorkbookResult] = useState<SingleWorkbookParseResult | null>(null);
  const [reviewRows, setReviewRows] = useState<EditableStudentRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [trackerSheetUrl, setTrackerSheetUrl] = useState('');
  const [masterSheetUrl, setMasterSheetUrl] = useState('https://docs.google.com/spreadsheets/d/1QUZkHIaqjKsRvCZezzRLFTruNnFq1HTk/edit?usp=sharing');
  const [trackerSheetTab, setTrackerSheetTab] = useState('');
  const [studentSheetUrl, setStudentSheetUrl] = useState('');
  const [studentSheetTab, setStudentSheetTab] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [sheetSummary, setSheetSummary] = useState<SheetSyncResult | null>(null);
  const [lastImportSummary, setLastImportSummary] = useState<ImportWriteSummary | null>(null);

  const reviewedStudentResult = useMemo<StudentRecordParseResult | null>(
    () => (studentResult ? { ...studentResult, rows: reviewRows, errors: [] } : null),
    [studentResult, reviewRows],
  );
  const combinedImport = useMemo(
    () => {
      if (!trackerResult || !reviewedStudentResult) return null;
      return singleWorkbookResult
        ? buildSingleWorkbookImport(trackerResult, reviewedStudentResult)
        : buildCombinedImport(trackerResult, reviewedStudentResult);
    },
    [trackerResult, reviewedStudentResult, singleWorkbookResult],
  );
  const combinedPreview = combinedImport?.preview ?? null;
  const reviewIssues = useMemo(
    () => buildReviewIssues(reviewRows, trackerResult ? validPaymentTrackerRows(trackerResult) : [], !!singleWorkbookResult),
    [reviewRows, trackerResult, singleWorkbookResult],
  );
  const blockingReviewIssues = reviewIssues.filter((issue) => issue.blocking);
  const readyReviewRows = reviewRows.filter((row) => !reviewIssues.some((issue) => reviewRowKey(issue.sourceSheet ?? '', issue.rowNumber) === reviewRowKey(row.sourceSheet, row.rowNumber))).length;
  const trackerBlockingErrors = useMemo(
    () => (trackerResult?.errors ?? []).filter(isBlockingTrackerError),
    [trackerResult],
  );
  const importBlockers = getImportBlockers({
    trackerResult,
    trackerBlockingErrors,
    blockingReviewIssues,
    combinedImport,
  });

  const canImport =
    !!trackerResult &&
    !!reviewedStudentResult &&
    trackerBlockingErrors.length === 0 &&
    blockingReviewIssues.length === 0 &&
    validPaymentTrackerRows(trackerResult).length > 0 &&
    (combinedImport?.rows.length ?? 0) > 0;

  const handleTrackerFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setTrackerFileName(file.name);
    setTrackerResult(null);
    setSingleWorkbookResult(null);
    setLastImportSummary(null);
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

  const handleMasterWorkbookChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setMasterFileName(file.name);
    setTrackerFileName('');
    setStudentFileName('');
    setTrackerResult(null);
    setStudentResult(null);
    setSingleWorkbookResult(null);
    setReviewRows([]);
    setLastImportSummary(null);
    setIsParsing(true);
    try {
      const result = await parseSingleWorkbookFile(file);
      setSingleWorkbookResult(result);
      setTrackerResult(result.trackerResult);
      setStudentResult(result.studentResult);
      setReviewRows(result.studentResult.rows.map((row) => ({ ...row, original: row, correctedFields: [] })));
      toast.success(`Parsed master workbook: ${result.summary.students} student row(s) and ${result.summary.mentors} mentor row(s).`);
    } catch (error) {
      console.error(error);
      toast.error('Could not parse the master workbook.');
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
    setLastImportSummary(null);
    setIsParsing(true);
    try {
      const result = await parseStudentRecordFile(file);
      setStudentResult(result);
      setReviewRows(result.rows.map((row) => ({ ...row, original: row, correctedFields: [] })));
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
    if (!canImport || !trackerResult || !reviewedStudentResult || !combinedImport) {
      toast.error('Resolve blocking review issues before importing.');
      return;
    }
    setIsImporting(true);
    try {
      const fn = httpsCallable(getFunctions(app), 'commitReviewedImport');
      const result = await fn({
        trackerRows: combinedImport.trackerRows,
        studentRows: combinedImport.rows,
        fileName: masterFileName || `${trackerFileName} + ${studentFileName}`,
      });
      const data = result.data as ReviewedImportCommitResult;
      const summary = data.summary;
      setLastImportSummary(summary);
      onImported?.();
      toast.success(`Synced ${summary.students} student(s), ${summary.courses} course(s), ${summary.payments} payment(s), and ${summary.payouts} payout(s).`);
    } catch (error) {
      const formattedError = formatImportCallableError(error);
      console.error('Reviewed import failed', { error, details: formattedError.details });
      toast.error(formattedError.message);
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

  const handleMasterSheetSync = async () => {
    if (!masterSheetUrl.trim()) {
      toast.error('Enter the master workbook Google Sheet URL.');
      return;
    }
    setIsSyncing(true);
    setSheetSummary(null);
    try {
      const fn = httpsCallable(getFunctions(app), 'syncMentorPaymentSheet');
      const result = await fn({
        singleWorkbookUrl: masterSheetUrl.trim(),
        studentSheetName: 'Import Ready — Students',
        mentorSheetName: 'Import Ready — Mentors',
      });
      const data = result.data as SheetSyncResult;
      setSheetSummary(data);
      toast[data.errors.length ? 'error' : 'success'](
        data.errors.length
          ? `Master workbook sync returned ${data.errors.length} review issue(s).`
          : `Synced ${data.summary.rows} row(s) from the master workbook.`,
      );
    } catch (error) {
      console.error(error);
      toast.error('Master workbook sync failed. Confirm the sheet is shared to anyone with the link.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5" />
          Master Workbook Import
        </CardTitle>
        <CardDescription>
          Upload or sync the single EduTrack workbook. MentorFlow reads the Import Ready student and mentor tabs, then stages records for review.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="upload">
          <TabsList>
            <TabsTrigger value="upload">Excel / CSV Upload</TabsTrigger>
            <TabsTrigger value="sheets">Google Sheets Sync</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-6 pt-4">
            <FileInputCard
              title="Single Master Workbook"
              description="Preferred: one workbook with Import Ready — Students and Import Ready — Mentors tabs."
              fileName={masterFileName}
              onChange={handleMasterWorkbookChange}
              disabled={isParsing || isImporting}
              errors={singleWorkbookResult?.errors ?? []}
              validRows={(singleWorkbookResult?.summary.students ?? 0) + (singleWorkbookResult?.summary.mentors ?? 0)}
            />

            <div className="rounded-lg border border-dashed p-4 space-y-3">
              <div>
                <h3 className="font-medium">Advanced: legacy dual upload</h3>
                <p className="text-sm text-muted-foreground">Use only if you still have separate mentor tracker and student record files.</p>
              </div>
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
              </div>
            )}

            {trackerResult && studentResult && (
              <ReviewAndFixTable
                rows={reviewRows}
                issues={reviewIssues}
                trackerRows={combinedImport?.trackerRows ?? validPaymentTrackerRows(trackerResult)}
                readyRows={readyReviewRows}
                onChange={setReviewRows}
              />
            )}

            {combinedPreview && (
              <CombinedPreviewPanel
                preview={combinedPreview}
                trackerRows={combinedImport?.trackerRows ?? []}
                rows={combinedImport?.rows ?? []}
                reviewIssues={blockingReviewIssues}
                importBlockers={importBlockers}
                lastImportSummary={lastImportSummary}
                canImport={canImport}
                isImporting={isImporting}
                onImport={handleImport}
                onExport={() => exportCorrectedWorkbook(combinedImport, reviewRows, reviewIssues)}
              />
            )}
          </TabsContent>

          <TabsContent value="sheets" className="space-y-6 pt-4">
            <div className="rounded-lg border p-4 space-y-3">
              <h3 className="font-medium">Single master workbook sync</h3>
              <p className="text-sm text-muted-foreground">Preferred: reads Import Ready — Students and Import Ready — Mentors from one Google workbook.</p>
              <div className="grid gap-2">
                <Label>Master workbook URL</Label>
                <Input value={masterSheetUrl} onChange={(event) => setMasterSheetUrl(event.target.value)} disabled={isSyncing} placeholder="https://docs.google.com/spreadsheets/d/..." />
              </div>
              <Button className="gap-2" onClick={handleMasterSheetSync} disabled={isSyncing}>
                {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Review and sync master workbook
              </Button>
            </div>
            <div className="rounded-lg border border-dashed p-4 space-y-4">
              <div>
                <h3 className="font-medium">Advanced: legacy dual sheet sync</h3>
                <p className="text-sm text-muted-foreground">Use only for older separate tracker and student sheets.</p>
              </div>
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
            </div>
            {sheetSummary && (
              <div className="space-y-4">
                <PreviewStats preview={sheetSummary.summary} />
                <ValidationPanel title="Google Sheets sync validation" errors={sheetSummary.errors} />
                {sheetSummary.reviewIssues && sheetSummary.reviewIssues.length > 0 && (
                  <ValidationPanel title="Google Sheets review issues" errors={sheetSummary.reviewIssues} />
                )}
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

function ReviewAndFixTable({
  rows,
  issues,
  trackerRows,
  readyRows,
  onChange,
}: {
  rows: EditableStudentRow[];
  issues: ImportReviewIssue[];
  trackerRows: AnyPaymentTrackerRow[];
  readyRows: number;
  onChange: (rows: EditableStudentRow[]) => void;
}) {
  const mentors = Array.from(new Set(trackerRows.map((row) => row.mentorName).filter(Boolean))).sort();
  const courses = Array.from(new Set(trackerRows.map((row) => row.course).filter(Boolean))).sort();
  const issuesByRow = new Map<string, ImportReviewIssue[]>();
  issues.forEach((issue) => {
    const key = reviewRowKey(issue.sourceSheet ?? '', issue.rowNumber);
    issuesByRow.set(key, [...(issuesByRow.get(key) ?? []), issue]);
  });
  const sortedRows = [...rows].sort((a, b) => {
    const aIssues = issuesByRow.has(reviewRowKey(a.sourceSheet, a.rowNumber)) ? 0 : 1;
    const bIssues = issuesByRow.has(reviewRowKey(b.sourceSheet, b.rowNumber)) ? 0 : 1;
    return aIssues - bIssues || a.sourceSheet.localeCompare(b.sourceSheet) || a.rowNumber - b.rowNumber;
  });

  const updateRow = (target: EditableStudentRow, patch: Partial<EditableStudentRow>) => {
    const changedFields = Object.keys(patch);
    onChange(rows.map((row) => {
      if (row.rowNumber !== target.rowNumber || row.sourceSheet !== target.sourceSheet) return row;
      return {
        ...row,
        ...patch,
        correctedFields: Array.from(new Set([...row.correctedFields, ...changedFields])),
      };
    }));
  };

  if (rows.length === 0) return null;

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Review & Fix</h3>
          <p className="text-sm text-muted-foreground">
            {readyRows} ready row(s), {issues.length} issue(s) needing review. Edit the fields below, then confirm import.
          </p>
        </div>
        <Badge variant={issues.length ? 'destructive' : 'secondary'}>
          {issues.length ? 'Needs review' : 'Ready'}
        </Badge>
      </div>
      <datalist id="mentor-options">
        {mentors.map((mentor) => <option key={mentor} value={mentor} />)}
      </datalist>
      <datalist id="course-options">
        {courses.map((course) => <option key={course} value={course} />)}
      </datalist>
      <div className="rounded-lg border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Course</TableHead>
              <TableHead>Mentor</TableHead>
              <TableHead>Onboarding</TableHead>
              <TableHead>Course Status</TableHead>
              <TableHead>Amount Paid</TableHead>
              <TableHead>Payment Status</TableHead>
              <TableHead>Issues</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRows.slice(0, 30).map((row) => {
              const rowIssues = issuesByRow.get(reviewRowKey(row.sourceSheet, row.rowNumber)) ?? [];
              return (
                <TableRow key={`${row.sourceSheet}-${row.rowNumber}`}>
                  <TableCell className="min-w-32">{row.sourceSheet} row {row.rowNumber}</TableCell>
                  <TableCell><Input className="min-w-44" value={row.name} onChange={(event) => updateRow(row, { name: event.target.value })} /></TableCell>
                  <TableCell><Input className="min-w-52" value={row.emailAddress} onChange={(event) => updateRow(row, { emailAddress: event.target.value })} /></TableCell>
                  <TableCell><Input className="min-w-36" value={row.phoneNumber ?? ''} onChange={(event) => updateRow(row, { phoneNumber: event.target.value })} /></TableCell>
                  <TableCell><Input className="min-w-44" list="course-options" value={row.course} onChange={(event) => updateRow(row, { course: event.target.value })} /></TableCell>
                  <TableCell><Input className="min-w-44" list="mentor-options" value={row.mentorName} onChange={(event) => updateRow(row, { mentorName: event.target.value })} /></TableCell>
                  <TableCell>
                    <Input
                      className="min-w-40"
                      type="date"
                      value={formatDateInput(row.onboardingDate)}
                      onChange={(event) => updateRow(row, { onboardingDate: dateInputToTimestamp(event.target.value) })}
                    />
                  </TableCell>
                  <TableCell><Input className="min-w-36" value={row.courseStatus} onChange={(event) => updateRow(row, { courseStatus: event.target.value })} /></TableCell>
                  <TableCell>
                    <Input
                      className="min-w-32"
                      type="number"
                      value={row.amountPaid}
                      onChange={(event) => updateRow(row, { amountPaid: Number(event.target.value) || 0 })}
                    />
                  </TableCell>
                  <TableCell><Input className="min-w-36" value={row.paymentStatus} onChange={(event) => updateRow(row, { paymentStatus: event.target.value })} /></TableCell>
                  <TableCell className="min-w-56">
                    {rowIssues.length ? rowIssues.map((issue) => (
                      <p key={`${issue.code}-${issue.field}`} className="text-xs text-destructive">{issue.message}</p>
                    )) : <span className="text-xs text-green-700">Ready</span>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {sortedRows.length > 30 && <p className="text-xs text-muted-foreground">Showing first 30 rows of {sortedRows.length}. Rows with issues are shown first.</p>}
    </div>
  );
}

function CombinedPreviewPanel({
  preview,
  trackerRows,
  rows,
  reviewIssues,
  importBlockers,
  lastImportSummary,
  canImport,
  isImporting,
  onImport,
  onExport,
}: {
  preview: CombinedPreview;
  trackerRows: AnyPaymentTrackerRow[];
  rows: CombinedImportRow[];
  reviewIssues: ImportReviewIssue[];
  importBlockers: string[];
  lastImportSummary: ImportWriteSummary | null;
  canImport: boolean;
  isImporting: boolean;
  onImport: () => void;
  onExport: () => void;
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
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={onExport} disabled={rows.length === 0 && trackerRows.length === 0}>
            <Download className="w-4 h-4" />
            Export corrected template
          </Button>
          <Button className="gap-2" onClick={onImport} disabled={!canImport || isImporting}>
            {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Sync corrected records to database
          </Button>
        </div>
      </div>
      <PreviewStats preview={preview} />
      {lastImportSummary && <ImportSummaryPanel summary={lastImportSummary} />}
      {importBlockers.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <p className="font-medium">Sync is waiting on:</p>
          <ul className="list-disc pl-5">
            {importBlockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
          </ul>
        </div>
      )}
      {reviewIssues.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-amber-700">
          <AlertCircle className="w-4 h-4" />
          Resolve {reviewIssues.length} blocking issue(s) in Review & Fix before importing.
        </div>
      )}
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

function ImportSummaryPanel({ summary }: { summary: ImportWriteSummary }) {
  const items = [
    ['Mentors', summary.mentors],
    ['Students', summary.students],
    ['Courses', summary.courses],
    ['Enrollments', summary.enrollments],
    ['Payments', summary.payments],
    ['Payouts', summary.payouts],
    ['Summaries', summary.summaries],
    ['Audit records', summary.auditRecords],
  ];
  return (
    <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
      <p className="font-medium">Last sync completed: {summary.writes} database write(s).</p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {items.map(([label, value]) => <span key={label}>{label}: <strong>{value}</strong></span>)}
      </div>
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

function isBlockingTrackerError(error: { field: string; message: string }) {
  if (['header', 'file'].includes(error.field)) return true;
  if (error.message.startsWith('Missing optional tracker column')) return false;
  if (['courseStatus', 'paymentStatus', 'startDate', 'dueDate', 'amountDue', 'amountDisbursed', 'commissionRate'].includes(error.field)) return false;
  return true;
}

function getImportBlockers({
  trackerResult,
  trackerBlockingErrors,
  blockingReviewIssues,
  combinedImport,
}: {
  trackerResult: PaymentTrackerParseResult | null;
  trackerBlockingErrors: Array<{ field: string; message: string }>;
  blockingReviewIssues: ImportReviewIssue[];
  combinedImport: CombinedImportResult | null;
}) {
  const blockers: string[] = [];
  if (!trackerResult) blockers.push('Upload a mentor payment tracker.');
  if (trackerBlockingErrors.length > 0) blockers.push(`${trackerBlockingErrors.length} blocking tracker issue(s) must be fixed in the source file.`);
  if (blockingReviewIssues.length > 0) blockers.push(`${blockingReviewIssues.length} review issue(s) must be resolved in the Review & Fix table.`);
  if (trackerResult && validPaymentTrackerRows(trackerResult).length === 0) blockers.push('No usable mentor tracker rows were found.');
  if (combinedImport && combinedImport.rows.length === 0) blockers.push('No matched student rows are ready to sync.');
  return blockers;
}

function buildReviewIssues(rows: EditableStudentRow[], trackerRows: AnyPaymentTrackerRow[], allowUnassignedCourses = false): ImportReviewIssue[] {
  const courseIndex = new Map<string, AnyPaymentTrackerRow[]>();
  trackerRows.forEach((row) => {
    const key = canonicalCourseKey(row.course);
    const existing = courseIndex.get(key) ?? [];
    if (!existing.some((item) => normalizeImportKey(item.mentorName) === normalizeImportKey(row.mentorName))) {
      existing.push(row);
    }
    courseIndex.set(key, existing);
  });

  const issues = rows.flatMap((row) => {
    const issues: ImportReviewIssue[] = [];
    const addIssue = (code: ImportReviewIssue['code'], field: string, message: string) => {
      issues.push({ code, rowNumber: row.rowNumber, sourceSheet: row.sourceSheet, field, message, blocking: true });
    };
    if (!row.name.trim()) addIssue('missingName', 'name', 'Student name is required.');
    if (!row.course.trim()) addIssue('missingCourse', 'course', 'Course is required.');
    if (!row.emailAddress.trim()) addIssue('missingEmail', 'emailAddress', 'Student email is required.');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.emailAddress)) addIssue('invalidEmail', 'emailAddress', 'Student email must be valid.');
    if (!row.onboardingDate || Number.isNaN(row.onboardingDate)) addIssue('invalidDate', 'onboardingDate', 'Onboarding date is missing or invalid.');

    if (row.course.trim()) {
      const matches = courseIndex.get(canonicalCourseKey(row.course)) ?? [];
      if (matches.length === 0 && !allowUnassignedCourses) {
        addIssue('unmatchedCourse', 'course', `No tracker course matches "${row.course}".`);
      } else if (matches.length > 1 && !row.mentorName.trim()) {
        addIssue('ambiguousCourse', 'mentorName', `Choose a mentor for "${row.course}".`);
      } else if (row.mentorName.trim() && !matches.some((match) => normalizeImportKey(match.mentorName) === normalizeImportKey(row.mentorName))) {
        addIssue('missingMentor', 'mentorName', `Mentor "${row.mentorName}" is not listed for "${row.course}" in the tracker.`);
      }
    }

    return issues;
  });
  return issues;
}

function reviewRowKey(sourceSheet: string, rowNumber: number): string {
  return `${sourceSheet}:${rowNumber}`;
}

function formatDateInput(timestamp: number): string {
  if (!timestamp || Number.isNaN(timestamp)) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function dateInputToTimestamp(value: string): number {
  if (!value) return 0;
  const parsed = new Date(`${value}T00:00:00`).getTime();
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function exportCorrectedWorkbook(combinedImport: CombinedImportResult | null, reviewRows: EditableStudentRow[], reviewIssues: ImportReviewIssue[]) {
  if (!combinedImport && reviewRows.length === 0) return;
  const workbook = XLSX.utils.book_new();
  const mergedRows = (combinedImport?.rows ?? []).map((row) => ({
    id: row.rowNumber,
    studentName: row.name,
    studentType: row.studentType ?? '',
    studentEmail: row.emailAddress,
    phoneNumber: row.phoneNumber ?? '',
    course: row.course,
    mentorName: row.mentorName,
    onboardingDate: formatDateInput(row.onboardingDate),
    courseStatus: row.courseStatus,
    amountPaid: row.amountPaid,
    paymentStatus: row.paymentStatus,
    cohort: row.cohort,
    totalAmountPaid: row.totalAmountPaid,
    amountDue: row.amountDue,
    amountDisbursed: row.amountDisbursed,
    payoutStatus: row.payoutStatus,
    commissionRate: row.commissionRate,
    coursePrice: row.coursePrice,
    sourceSheet: row.sourceSheet,
    sourceRowNumber: row.rowNumber,
    trackerSourceSheet: row.trackerSourceSheet ?? '',
    trackerRowNumber: row.trackerRowNumber ?? '',
    correctedFields: row.correctedFields?.join(', ') ?? '',
  }));
  const reviewExportRows = reviewRows.map((row) => ({
    id: row.rowNumber,
    studentName: row.name,
    studentType: row.studentType ?? '',
    studentEmail: row.emailAddress,
    phoneNumber: row.phoneNumber ?? '',
    course: row.course,
    mentorName: row.mentorName,
    onboardingDate: formatDateInput(row.onboardingDate),
    courseStatus: row.courseStatus,
    amountPaid: row.amountPaid,
    paymentStatus: row.paymentStatus,
    sourceSheet: row.sourceSheet,
    sourceRowNumber: row.rowNumber,
    correctedFields: row.correctedFields.join(', '),
  }));
  const trackerTemplate = (combinedImport?.trackerRows ?? []).map((row) => ({
    id: row.rowNumber,
    cohort: row.cohort,
    course: row.course,
    mentorName: row.mentorName,
    mentorEmail: row.mentorEmail ?? '',
    courseStatus: row.courseStatus,
    numberOfStudents: 'numberOfStudents' in row ? row.numberOfStudents : '',
    startDate: formatDateInput(row.startDate),
    dueDate: formatDateInput(row.dueDate),
    totalAmountPaid: row.totalAmountPaid,
    amountDue: row.amountDue,
    amountDisbursed: row.amountDisbursed,
    paymentStatus: row.paymentStatus,
    coursePrice: row.coursePrice,
    commissionRate: row.commissionRate,
  }));
  const issueRows = reviewIssues.map((issue) => ({
    sourceSheet: issue.sourceSheet ?? '',
    rowNumber: issue.rowNumber,
    field: issue.field,
    code: issue.code,
    blocking: issue.blocking ? 'yes' : 'no',
    message: issue.message,
  }));
  const summaryRows = [{
    students: reviewRows.length,
    mentors: combinedImport?.trackerRows.length ?? 0,
    readyRows: (combinedImport?.rows.length ?? 0),
    reviewIssues: reviewIssues.length,
    exportedAt: new Date().toISOString(),
  }];

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(reviewExportRows), 'Import Ready — Students');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(trackerTemplate), 'Import Ready — Mentors');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(mergedRows.length ? mergedRows : reviewExportRows), 'Merged Import');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(issueRows), 'Import Review Issues');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), 'Import Summary');
  XLSX.writeFile(workbook, `mentorflow-master-import-${new Date().toISOString().slice(0, 10)}.xlsx`);
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
}): { writes: PendingWrite[]; summary: ImportWriteSummary } {
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
    const resolvedStudentEmail = resolveStudentEmail(row);
    const existingStudent = usersByEmail.get(resolvedStudentEmail);
    const sameNamedExistingStudent = existingStudent && normalizeImportKey(existingStudent.name) === normalizeImportKey(row.name)
      ? existingStudent
      : undefined;
    const studentId = sameNamedExistingStudent?.uid ?? `imported_student_${stableImportId([row.name, resolvedStudentEmail, row.sourceSheet, row.rowNumber])}`;
    const existingEnrollment = enrollments.find((enrollment) => enrollment.studentId === studentId && enrollment.courseId === courseId);
    const enrollmentId = existingEnrollment?.id ?? `imported_enrollment_${stableImportId([studentId, courseId])}`;
    const commissionRate = trackerRow?.commissionRate ?? 0.37;
    const commissionEarned = trackerRow && 'numberOfStudents' in trackerRow && trackerRow.numberOfStudents > 0
      ? Math.round(trackerRow.amountDue / trackerRow.numberOfStudents)
      : Math.round(row.amountPaid * commissionRate);

    put(doc(db, 'users', studentId), {
      uid: studentId,
      email: resolvedStudentEmail,
      name: row.name,
      role: 'student',
      createdAt: sameNamedExistingStudent?.createdAt ?? now,
      kycStatus: sameNamedExistingStudent?.kycStatus ?? 'not_started',
      biodata: buildStudentBiodata(sameNamedExistingStudent?.biodata, row.phoneNumber),
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
      studentEmail: resolvedStudentEmail,
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
      corrections: buildCorrectionAudit(row, importedBy),
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
    corrections: studentRows
      .filter((row) => row.correctedFields?.length)
      .map((row) => ({
        sourceSheet: row.sourceSheet,
        sourceRowNumber: row.rowNumber,
        correctedFields: row.correctedFields,
      })),
  });

  const writeList = [...writes.values()];
  return { writes: writeList, summary: summarizeWrites(writeList) };
}

function resolveStudentEmail(row: CombinedImportRow): string {
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.emailAddress)) return row.emailAddress;
  return makePlaceholderEmail(`${row.name || 'student'}-${row.sourceSheet}-${row.rowNumber}`, 'student');
}

function buildStudentBiodata(existingBiodata: UserProfile['biodata'] | undefined, phoneNumber: string | undefined): Record<string, unknown> {
  const biodata = removeUndefinedValues({ ...(existingBiodata ?? {}) });
  const cleanedPhoneNumber = phoneNumber?.trim();
  if (cleanedPhoneNumber) biodata.phoneNumber = cleanedPhoneNumber;
  return biodata;
}

function removeUndefinedValues(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined));
}

function formatImportCallableError(error: unknown): { message: string; details?: CallableImportErrorDetails } {
  const callableError = error as { code?: string; message?: string; details?: CallableImportErrorDetails } | null;
  const code = callableError?.code ? `${callableError.code}: ` : '';
  const details = callableError?.details;
  const rawMessage = callableError?.message || (error instanceof Error ? error.message : '');
  if ((callableError?.code === 'functions/internal' || rawMessage.includes('internal')) && !details?.version) {
    return {
      message: 'Import failed: deployed import function returned no diagnostics. Deploy the latest commitReviewedImport function, then retry.',
      details,
    };
  }
  const phase = details?.phase ? ` [phase: ${details.phase}]` : '';
  const version = details?.version ? ` [version: ${details.version}]` : '';
  const writePath = details?.firstWritePath ? ` [first write: ${details.firstWritePath}]` : '';
  const message = rawMessage || 'Check the console for details.';
  return {
    message: `Import failed: ${code}${message}${phase}${version}${writePath}`,
    details,
  };
}

function summarizeWrites(writes: PendingWrite[]): ImportWriteSummary {
  const collectionCounts = (collectionName: string) => writes.filter((write) => write.ref.path.startsWith(`${collectionName}/`)).length;
  return {
    mentors: writes.filter((write) => write.ref.path.startsWith('users/') && write.data.role === 'mentor').length,
    students: writes.filter((write) => write.ref.path.startsWith('users/') && write.data.role === 'student').length,
    courses: collectionCounts('courses'),
    enrollments: collectionCounts('enrollments'),
    payments: collectionCounts('payments'),
    payouts: collectionCounts('payouts'),
    summaries: collectionCounts('paymentTrackerSummaries'),
    auditRecords: collectionCounts('studentRecordImports') + collectionCounts('imports'),
    writes: writes.length,
  };
}

function buildCorrectionAudit(row: CombinedImportRow, correctedBy: string) {
  if (!row.correctedFields?.length || !row.originalStudentRow) return null;
  const original = row.originalStudentRow;
  return {
    correctedFields: row.correctedFields,
    originalValues: Object.fromEntries(row.correctedFields.map((field) => [field, original[field as keyof typeof original] ?? null])),
    correctedValues: Object.fromEntries(row.correctedFields.map((field) => [field, row[field as keyof typeof row] ?? null])),
    correctedBy,
    correctedAt: Date.now(),
  };
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
  // Keep batches below Firestore rules' document-access limit when admin is proven via the user-profile fallback.
  const chunkSize = 10;
  for (let i = 0; i < writes.length; i += chunkSize) {
    const batch = writeBatch(db);
    writes.slice(i, i + chunkSize).forEach((write) => batch.set(write.ref, write.data, { merge: true }));
    await batch.commit();
  }
}
