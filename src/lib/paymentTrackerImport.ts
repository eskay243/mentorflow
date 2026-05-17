import * as XLSX from 'xlsx';

export type PaymentTrackerSource = 'excel' | 'google_sheets';
export type PaymentTrackerImportMode = 'student' | 'aggregate';

export interface PaymentTrackerBaseRow {
  rowNumber: number;
  sourceSheet?: string;
  cohort: string;
  course: string;
  mentorName: string;
  mentorEmail?: string;
  courseStatus: string;
  startDate: number;
  dueDate: number;
  totalAmountPaid: number;
  amountDue: number;
  amountDisbursed: number;
  paymentStatus: string;
  coursePrice: number;
  commissionRate: number;
}

export interface PaymentTrackerRow extends PaymentTrackerBaseRow {
  studentName: string;
  studentEmail: string;
}

export interface PaymentTrackerAggregateRow extends PaymentTrackerBaseRow {
  numberOfStudents: number;
}

export type AnyPaymentTrackerRow = PaymentTrackerRow | PaymentTrackerAggregateRow;

export interface PaymentTrackerValidationError {
  rowNumber: number;
  field: string;
  message: string;
}

export interface PaymentTrackerParseResult {
  mode: PaymentTrackerImportMode;
  rows: PaymentTrackerRow[];
  aggregateRows: PaymentTrackerAggregateRow[];
  errors: PaymentTrackerValidationError[];
  missingColumns: string[];
  headerRowNumber: number | null;
}

export interface PaymentTrackerPreview {
  mentors: number;
  students: number;
  courses: number;
  enrollments: number;
  summaries: number;
  payments: number;
  payouts: number;
  rows: number;
}

export interface StudentRecordImportRow {
  rowNumber: number;
  sourceSheet: string;
  name: string;
  course: string;
  mentorName: string;
  emailAddress: string;
  phoneNumber?: string;
  onboardingDate: number;
  courseStatus: string;
  amountPaid: number;
  paymentStatus: string;
}

export interface CombinedImportRow {
  rowNumber: number;
  sourceSheet: string;
  trackerRowNumber?: number;
  trackerSourceSheet?: string;
  cohort: string;
  name: string;
  emailAddress: string;
  phoneNumber?: string;
  course: string;
  mentorName: string;
  onboardingDate: number;
  courseStatus: string;
  amountPaid: number;
  paymentStatus: string;
  numberOfStudents?: number;
  totalAmountPaid: number;
  amountDue: number;
  amountDisbursed: number;
  payoutStatus: string;
  commissionRate: number;
  coursePrice: number;
}

export interface CombinedImportResult {
  rows: CombinedImportRow[];
  trackerRows: AnyPaymentTrackerRow[];
  studentRows: StudentRecordImportRow[];
  errors: PaymentTrackerValidationError[];
  preview: PaymentTrackerPreview & {
    matchedRows: number;
    unmatchedStudentRows: number;
    ambiguousStudentRows: number;
  };
}

export interface StudentRecordParseResult {
  rows: StudentRecordImportRow[];
  errors: PaymentTrackerValidationError[];
  missingColumns: string[];
  headerRowNumber: number | null;
}

export const REQUIRED_STUDENT_TRACKER_COLUMNS = [
  'cohort',
  'course',
  'mentorName',
  'studentName',
  'studentEmail',
  'courseStatus',
  'startDate',
  'dueDate',
  'totalAmountPaid',
  'amountDue',
  'amountDisbursed',
  'paymentStatus',
] as const;

export const REQUIRED_AGGREGATE_TRACKER_COLUMNS = [
  'course',
  'mentorName',
  'courseStatus',
  'numberOfStudents',
  'startDate',
  'dueDate',
  'totalAmountPaid',
  'amountDue',
  'amountDisbursed',
  'paymentStatus',
] as const;

type TrackerField = keyof Omit<PaymentTrackerRow & PaymentTrackerAggregateRow, 'rowNumber'>;

const HEADER_ALIASES: Record<string, TrackerField> = {
  cohort: 'cohort',
  batch: 'cohort',
  course: 'course',
  coursename: 'course',
  mentorsdetails: 'mentorName',
  mentordetails: 'mentorName',
  mentor: 'mentorName',
  mentorname: 'mentorName',
  mentoremail: 'mentorEmail',
  mentorsemail: 'mentorEmail',
  student: 'studentName',
  studentname: 'studentName',
  studentemail: 'studentEmail',
  coursestatus: 'courseStatus',
  status: 'courseStatus',
  numberofstudents: 'numberOfStudents',
  students: 'numberOfStudents',
  noofstudents: 'numberOfStudents',
  startdate: 'startDate',
  start: 'startDate',
  duedate: 'dueDate',
  due: 'dueDate',
  totalamountpaid: 'totalAmountPaid',
  totalpaid: 'totalAmountPaid',
  amountpaid: 'totalAmountPaid',
  paid: 'totalAmountPaid',
  amountdue: 'amountDue',
  commissiondue: 'amountDue',
  amountdisbursed: 'amountDisbursed',
  amountdisbussed: 'amountDisbursed',
  amountdisburssed: 'amountDisbursed',
  disbursed: 'amountDisbursed',
  disbussed: 'amountDisbursed',
  disburssed: 'amountDisbursed',
  paymentstatus: 'paymentStatus',
  payoutstatus: 'paymentStatus',
  courseprice: 'coursePrice',
  price: 'coursePrice',
  commissionrate: 'commissionRate',
};

type StudentRecordField = keyof Omit<StudentRecordImportRow, 'rowNumber'>;

const STUDENT_RECORD_REQUIRED_COLUMNS = [
  'name',
  'course',
  'emailAddress',
  'onboardingDate',
  'courseStatus',
  'amountPaid',
  'paymentStatus',
] as const;

const STUDENT_RECORD_HEADER_ALIASES: Record<string, StudentRecordField> = {
  name: 'name',
  student: 'name',
  studentname: 'name',
  course: 'course',
  coursename: 'course',
  mentor: 'mentorName',
  mentorname: 'mentorName',
  mentorsdetails: 'mentorName',
  email: 'emailAddress',
  emailaddress: 'emailAddress',
  studentemail: 'emailAddress',
  phonenumber: 'phoneNumber',
  phone: 'phoneNumber',
  number: 'phoneNumber',
  onboardingdate: 'onboardingDate',
  onboarddate: 'onboardingDate',
  date: 'onboardingDate',
  coursestatus: 'courseStatus',
  status: 'courseStatus',
  amountp: 'amountPaid',
  amountpaid: 'amountPaid',
  paid: 'amountPaid',
  fee: 'amountPaid',
  paymentstatus: 'paymentStatus',
};

export function normalizeImportKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/₦/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

export function stableImportId(parts: Array<string | number | undefined | null>): string {
  return parts
    .map((part) => normalizeImportKey(String(part ?? '')))
    .filter(Boolean)
    .join('_')
    .slice(0, 140);
}

export function canonicalCourseKey(course: string): string {
  const key = normalizeImportKey(course);
  const aliases: Record<string, string> = {
    frontenddevelopment: 'frontend',
    frontendreact: 'frontend',
    basicfrontend: 'frontend',
    frontend: 'frontend',
    webdesign: 'webdesign',
    webdevelopment: 'webdesign',
    fullstack: 'fullstack',
    fullstackjavascript: 'fullstack',
    uiux: 'uiux',
    uiuxdesign: 'uiux',
    dataanalysis: 'dataanalysis',
    datascience: 'datascience',
    digitalmarketing: 'digitalmarketing',
    socialmediamanagement: 'socialmediamanagement',
    contentcreationandstrategy: 'contentcreationandstrategy',
    projectmanagement: 'projectmanagement',
    python: 'python',
    wordpress: 'wordpress',
  };
  return aliases[key] ?? key;
}

export function enrollmentStatusFromCourseStatus(status: string): 'pending' | 'active' | 'completed' | 'cancelled' {
  const key = normalizeImportKey(status);
  if (['done', 'completed', 'complete'].includes(key)) return 'completed';
  if (['skipped', 'cancelled', 'canceled'].includes(key)) return 'cancelled';
  if (['notstarted', 'pending'].includes(key)) return 'pending';
  return 'active';
}

export function payoutStatusFromPaymentStatus(status: string): 'pending' | 'processed' | 'failed' {
  const key = normalizeImportKey(status);
  if (['completed', 'complete', 'paid', 'processed'].includes(key)) return 'processed';
  if (['failed', 'declined', 'cancelled', 'canceled'].includes(key)) return 'failed';
  return 'pending';
}

export function parseCurrency(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value !== 'string') return 0;
  const cleaned = value.replace(/[₦,\s]/g, '').trim();
  if (!cleaned || cleaned === '-') return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseTrackerDate(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return new Date(parsed.y, parsed.m - 1, parsed.d).getTime();
    return value;
  }
  if (typeof value !== 'string') return 0;
  const trimmed = value.trim();
  if (!trimmed || trimmed === '-') return 0;
  const slashDate = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashDate) {
    const [, first, second, year] = slashDate;
    const fullYear = year.length === 2 ? `20${year}` : year;
    const firstNumber = Number(first);
    const secondNumber = Number(second);
    const day = firstNumber > 12 ? firstNumber : secondNumber > 12 ? secondNumber : firstNumber;
    const month = firstNumber > 12 ? secondNumber : secondNumber > 12 ? firstNumber : secondNumber;
    return new Date(Number(fullYear), month - 1, day).getTime();
  }
  const textDate = trimmed.match(/^(\d{1,2})[-\s]([A-Za-z]{3,})[-\s](\d{2,4})$/);
  if (textDate) {
    const [, day, monthName, year] = textDate;
    const month = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(monthName.slice(0, 3).toLowerCase());
    const fullYear = year.length === 2 ? `20${year}` : year;
    if (month >= 0) return new Date(Number(fullYear), month, Number(day)).getTime();
  }
  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function makePlaceholderEmail(name: string, role: 'mentor' | 'student'): string {
  const slug = stableImportId([name]) || role;
  return `${slug}.${role}@imported.mentorflow.local`;
}

function canonicalHeader(header: unknown): TrackerField | null {
  const normalized = normalizeImportKey(String(header ?? ''));
  return HEADER_ALIASES[normalized] ?? null;
}

function findHeaderRow(table: unknown[][]): { headerIndex: number; headers: Array<TrackerField | null> } | null {
  let best: { headerIndex: number; headers: Array<TrackerField | null>; score: number } | null = null;
  table.forEach((row, index) => {
    const headers = row.map(canonicalHeader);
    const unique = new Set(headers.filter(Boolean));
    const score = unique.size;
    const hasCore =
      unique.has('course') &&
      unique.has('mentorName') &&
      unique.has('courseStatus') &&
      unique.has('totalAmountPaid');
    if (hasCore && (!best || score > best.score)) {
      best = { headerIndex: index, headers, score };
    }
  });
  return best ? { headerIndex: best.headerIndex, headers: best.headers } : null;
}

function worksheetToTable(worksheet: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: '',
    blankrows: false,
    raw: false,
  });
}

function rowsFromTable(table: unknown[][]): {
  rows: Array<{ rowNumber: number; raw: Record<string, unknown> }>;
  presentColumns: Set<string>;
  headerRowNumber: number | null;
} {
  const header = findHeaderRow(table);
  if (!header) {
    return { rows: [], presentColumns: new Set(), headerRowNumber: null };
  }

  const presentColumns = new Set<string>();
  header.headers.forEach((field) => {
    if (field) presentColumns.add(field);
  });

  let currentCohort = 'Imported Tracker';
  const rows = table.slice(header.headerIndex + 1).flatMap((values, offset) => {
    const raw: Record<string, unknown> = {};
    header.headers.forEach((field, colIndex) => {
      if (field) raw[field] = values[colIndex];
    });

    const cohortLabel = extractCohortLabel(raw, values);
    if (cohortLabel) {
      currentCohort = cohortLabel;
      return [];
    }

    if (isIgnorableRawRow(raw)) return [];
    raw.cohort = String(raw.cohort ?? '').trim() || currentCohort;
    return [{ rowNumber: header.headerIndex + offset + 2, raw }];
  });

  return { rows, presentColumns, headerRowNumber: header.headerIndex + 1 };
}

function extractCohortLabel(raw: Record<string, unknown>, values: unknown[]): string | null {
  const joined = (values.length ? values : [raw.cohort, raw.course, raw.mentorName])
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .join(' ');
  if (!/cohort|payment/i.test(joined)) return null;
  const hasCourse = String(raw.course ?? '').trim();
  const hasStatus = String(raw.courseStatus ?? '').trim();
  const hasMoney =
    parseCurrency(raw.totalAmountPaid) > 0 ||
    parseCurrency(raw.amountDue) > 0 ||
    parseCurrency(raw.amountDisbursed) > 0;
  if (hasCourse || hasStatus || hasMoney) return null;
  return joined.replace(/\s+/g, ' ').trim();
}

function isIgnorableRawRow(raw: Record<string, unknown>): boolean {
  const course = String(raw.course ?? '').trim();
  const mentorName = String(raw.mentorName ?? '').trim();
  const courseStatus = String(raw.courseStatus ?? '').trim();
  const numberOfStudents = Number(String(raw.numberOfStudents ?? '').replace(/,/g, '')) || 0;
  const hasMoney =
    parseCurrency(raw.totalAmountPaid) > 0 ||
    parseCurrency(raw.amountDue) > 0 ||
    parseCurrency(raw.amountDisbursed) > 0;
  const hasDate = parseTrackerDate(raw.startDate) > 0 || parseTrackerDate(raw.dueDate) > 0;
  const looksLikeCohortOnly = !!mentorName && !course && !courseStatus && !hasMoney && !hasDate;
  const looksLikeSkippedPlaceholder = !!course && ['skipped', 'cancelled', 'canceled'].includes(normalizeImportKey(courseStatus)) && !hasMoney && !hasDate && numberOfStudents === 0;

  if (!course || !mentorName) return true;
  if (!course && !mentorName && !courseStatus && !hasMoney && !hasDate) return true;
  if (looksLikeCohortOnly) return true;
  if (looksLikeSkippedPlaceholder) return true;
  return false;
}

export async function parsePaymentTrackerFile(file: File): Promise<PaymentTrackerParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) {
    return {
      mode: 'aggregate',
      rows: [],
      aggregateRows: [],
      errors: [{ rowNumber: 0, field: 'file', message: 'The workbook has no sheets.' }],
      missingColumns: [...REQUIRED_AGGREGATE_TRACKER_COLUMNS],
      headerRowNumber: null,
    };
  }
  return parsePaymentTrackerWorksheet(workbook.Sheets[firstSheet], firstSheet);
}

export function parsePaymentTrackerCsv(csv: string): PaymentTrackerParseResult {
  const workbook = XLSX.read(csv, { type: 'string' });
  const firstSheet = workbook.SheetNames[0];
  return parsePaymentTrackerWorksheet(workbook.Sheets[firstSheet], firstSheet);
}

export function parsePaymentTrackerWorksheet(worksheet: XLSX.WorkSheet, sourceSheet = 'Sheet1'): PaymentTrackerParseResult {
  const { rows: rawRows, presentColumns, headerRowNumber } = rowsFromTable(worksheetToTable(worksheet));
  const hasStudentColumns = presentColumns.has('studentName') || presentColumns.has('studentEmail');
  const mode: PaymentTrackerImportMode = hasStudentColumns ? 'student' : 'aggregate';
  const requiredColumns = mode === 'student' ? REQUIRED_STUDENT_TRACKER_COLUMNS : REQUIRED_AGGREGATE_TRACKER_COLUMNS;
  const missingColumns = requiredColumns.filter((key) => !presentColumns.has(key));
  const errors: PaymentTrackerValidationError[] = [];

  if (!headerRowNumber) {
    return {
      mode,
      rows: [],
      aggregateRows: [],
      errors: [{ rowNumber: 0, field: 'header', message: 'Could not find a tracker table header row.' }],
      missingColumns: [...requiredColumns],
      headerRowNumber: null,
    };
  }

  if (missingColumns.length > 0) {
    missingColumns.forEach((field) => {
      errors.push({
        rowNumber: headerRowNumber,
        field,
        message: `Missing required column "${field}".`,
      });
    });
  }

  if (mode === 'student') {
    const studentRows: PaymentTrackerRow[] = [];
    const seen = new Set<string>();
    rawRows.forEach(({ raw, rowNumber }) => {
      raw.sourceSheet = sourceSheet;
      const row = normalizeStudentRow(raw, rowNumber);
      const rowErrors = validateStudentRow(row);
      const duplicateKey = stableImportId([row.studentEmail, row.course, row.mentorName]);
      if (duplicateKey && seen.has(duplicateKey)) {
        rowErrors.push({ rowNumber, field: 'studentEmail', message: 'Duplicate student/course/mentor row in this file.' });
      }
      seen.add(duplicateKey);
      if (rowErrors.length) errors.push(...rowErrors);
      else studentRows.push(row);
    });
    return {
      mode,
      rows: missingColumns.length ? [] : studentRows,
      aggregateRows: [],
      errors,
      missingColumns,
      headerRowNumber,
    };
  }

  const aggregateRows: PaymentTrackerAggregateRow[] = [];
  const seen = new Set<string>();
  rawRows.forEach(({ raw, rowNumber }) => {
    raw.sourceSheet = sourceSheet;
    const row = normalizeAggregateRow(raw, rowNumber);
    const rowErrors = validateAggregateRow(row);
    const duplicateKey = stableImportId([row.cohort, row.course, row.mentorName, row.startDate, row.dueDate]);
    if (duplicateKey && seen.has(duplicateKey)) {
      rowErrors.push({ rowNumber, field: 'course', message: 'Duplicate cohort/course/mentor row in this file.' });
    }
    seen.add(duplicateKey);
    if (rowErrors.length) errors.push(...rowErrors);
    else aggregateRows.push(row);
  });

  return {
    mode,
    rows: [],
    aggregateRows: missingColumns.length ? [] : aggregateRows,
    errors,
    missingColumns,
    headerRowNumber,
  };
}

function baseRow(raw: Record<string, unknown>, rowNumber: number): PaymentTrackerBaseRow {
  const totalAmountPaid = parseCurrency(raw.totalAmountPaid);
  const amountDue = parseCurrency(raw.amountDue);
  const amountDisbursed = parseCurrency(raw.amountDisbursed);
  const commissionRate = Number(raw.commissionRate) || 0.37;
  return {
    rowNumber,
    sourceSheet: String(raw.sourceSheet ?? ''),
    cohort: String(raw.cohort ?? '').trim(),
    course: String(raw.course ?? '').trim(),
    mentorName: String(raw.mentorName ?? '').trim(),
    mentorEmail: String(raw.mentorEmail ?? '').trim().toLowerCase() || undefined,
    courseStatus: String(raw.courseStatus ?? '').trim(),
    startDate: parseTrackerDate(raw.startDate),
    dueDate: parseTrackerDate(raw.dueDate),
    totalAmountPaid,
    amountDue,
    amountDisbursed,
    paymentStatus: String(raw.paymentStatus ?? '').trim(),
    coursePrice: parseCurrency(raw.coursePrice) || totalAmountPaid,
    commissionRate,
  };
}

function normalizeStudentRow(raw: Record<string, unknown>, rowNumber: number): PaymentTrackerRow {
  return {
    ...baseRow(raw, rowNumber),
    studentName: String(raw.studentName ?? '').trim(),
    studentEmail: String(raw.studentEmail ?? '').trim().toLowerCase(),
  };
}

function normalizeAggregateRow(raw: Record<string, unknown>, rowNumber: number): PaymentTrackerAggregateRow {
  return {
    ...baseRow(raw, rowNumber),
    cohort: String(raw.cohort ?? '').trim() || inferCohortFromNearbyText(raw),
    numberOfStudents: Number(String(raw.numberOfStudents ?? '').replace(/,/g, '')) || 0,
  };
}

function inferCohortFromNearbyText(raw: Record<string, unknown>): string {
  const mentorText = String(raw.mentorName ?? '').trim();
  if (/cohort/i.test(mentorText)) return mentorText;
  return 'Imported Tracker';
}

function validateBaseRow(row: PaymentTrackerBaseRow): PaymentTrackerValidationError[] {
  const errors: PaymentTrackerValidationError[] = [];
  (['course', 'mentorName', 'courseStatus', 'paymentStatus'] as const).forEach((field) => {
    if (!String(row[field] ?? '').trim()) {
      errors.push({ rowNumber: row.rowNumber, field, message: 'Required value is missing.' });
    }
  });
  if (row.mentorEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.mentorEmail)) {
    errors.push({ rowNumber: row.rowNumber, field: 'mentorEmail', message: 'Mentor email must be valid when provided.' });
  }
  (['startDate', 'dueDate'] as const).forEach((field) => {
    if (!row[field] || Number.isNaN(row[field])) {
      errors.push({ rowNumber: row.rowNumber, field, message: 'Date is missing or invalid.' });
    }
  });
  (['totalAmountPaid', 'amountDue', 'amountDisbursed'] as const).forEach((field) => {
    if (row[field] < 0) {
      errors.push({ rowNumber: row.rowNumber, field, message: 'Amount cannot be negative.' });
    }
  });
  if (row.commissionRate < 0 || row.commissionRate > 1) {
    errors.push({ rowNumber: row.rowNumber, field: 'commissionRate', message: 'Commission rate must be between 0 and 1.' });
  }
  return errors;
}

function validateStudentRow(row: PaymentTrackerRow): PaymentTrackerValidationError[] {
  const errors = validateBaseRow(row);
  if (!row.studentName) errors.push({ rowNumber: row.rowNumber, field: 'studentName', message: 'Required value is missing.' });
  if (!row.studentEmail) errors.push({ rowNumber: row.rowNumber, field: 'studentEmail', message: 'Required value is missing.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.studentEmail)) {
    errors.push({ rowNumber: row.rowNumber, field: 'studentEmail', message: 'Student email must be a valid email address.' });
  }
  return errors;
}

function validateAggregateRow(row: PaymentTrackerAggregateRow): PaymentTrackerValidationError[] {
  const errors = validateBaseRow(row);
  if (row.numberOfStudents < 0) {
    errors.push({ rowNumber: row.rowNumber, field: 'numberOfStudents', message: 'Number of students cannot be negative.' });
  }
  return errors;
}

export function validPaymentTrackerRows(result: PaymentTrackerParseResult): AnyPaymentTrackerRow[] {
  return result.mode === 'student' ? result.rows : result.aggregateRows;
}

export function buildPaymentTrackerPreview(resultOrRows: PaymentTrackerParseResult | PaymentTrackerRow[]): PaymentTrackerPreview {
  const mode = Array.isArray(resultOrRows) ? 'student' : resultOrRows.mode;
  const rows: AnyPaymentTrackerRow[] = Array.isArray(resultOrRows) ? resultOrRows : validPaymentTrackerRows(resultOrRows);
  const mentors = new Set(rows.map((row) => row.mentorEmail || normalizeImportKey(row.mentorName)));
  const students = new Set(rows.flatMap((row) => ('studentEmail' in row ? [row.studentEmail] : [])));
  const courses = new Set(rows.map((row) => stableImportId([row.course, row.mentorEmail || row.mentorName])));
  const enrollments = mode === 'student'
    ? new Set((rows as PaymentTrackerRow[]).map((row) => stableImportId([row.studentEmail, row.course, row.mentorName]))).size
    : 0;
  const summaries = mode === 'aggregate'
    ? new Set((rows as PaymentTrackerAggregateRow[]).map((row) => stableImportId([row.cohort, row.course, row.mentorName, row.startDate, row.dueDate]))).size
    : 0;

  return {
    mentors: mentors.size,
    students: students.size,
    courses: courses.size,
    enrollments,
    summaries,
    payments: mode === 'student' ? rows.filter((row) => row.totalAmountPaid > 0).length : 0,
    payouts: rows.filter((row) => row.amountDisbursed > 0).length,
    rows: rows.length,
  };
}

function canonicalStudentRecordHeader(header: unknown): StudentRecordField | null {
  const normalized = normalizeImportKey(String(header ?? ''));
  return STUDENT_RECORD_HEADER_ALIASES[normalized] ?? null;
}

function findStudentRecordHeaderRow(table: unknown[][]): {
  headerIndex: number;
  headers: Array<StudentRecordField | null>;
} | null {
  let best: { headerIndex: number; headers: Array<StudentRecordField | null>; score: number } | null = null;
  table.forEach((row, index) => {
    const headers = row.map(canonicalStudentRecordHeader);
    const unique = new Set(headers.filter(Boolean));
    const hasCore = unique.has('name') && unique.has('course') && unique.has('emailAddress') && unique.has('amountPaid');
    if (hasCore && (!best || unique.size > best.score)) {
      best = { headerIndex: index, headers, score: unique.size };
    }
  });
  return best ? { headerIndex: best.headerIndex, headers: best.headers } : null;
}

function studentRowsFromTable(table: unknown[][]): {
  rows: Array<{ rowNumber: number; raw: Record<string, unknown> }>;
  presentColumns: Set<string>;
  headerRowNumber: number | null;
} {
  const header = findStudentRecordHeaderRow(table);
  if (!header) return { rows: [], presentColumns: new Set(), headerRowNumber: null };

  const presentColumns = new Set<string>();
  header.headers.forEach((field) => {
    if (field) presentColumns.add(field);
  });

  const rows = table.slice(header.headerIndex + 1).flatMap((values, offset) => {
    const raw: Record<string, unknown> = {};
    header.headers.forEach((field, colIndex) => {
      if (field) raw[field] = values[colIndex];
    });
    if (isIgnorableStudentRecordRow(raw)) return [];
    return [{ rowNumber: header.headerIndex + offset + 2, raw }];
  });

  return { rows, presentColumns, headerRowNumber: header.headerIndex + 1 };
}

function isIgnorableStudentRecordRow(raw: Record<string, unknown>): boolean {
  const name = String(raw.name ?? '').trim();
  const course = String(raw.course ?? '').trim();
  const emailAddress = String(raw.emailAddress ?? '').trim();
  const phoneNumber = String(raw.phoneNumber ?? '').trim();
  const amountPaid = parseCurrency(raw.amountPaid);
  const onboardingDate = parseTrackerDate(raw.onboardingDate);
  const courseStatus = String(raw.courseStatus ?? '').trim();
  const paymentStatus = String(raw.paymentStatus ?? '').trim();
  const hasIdentity = !!name || !!emailAddress || !!phoneNumber;
  const hasEnrollment = !!course || amountPaid > 0 || onboardingDate > 0;
  const hasOnlyDropdownStatus = !hasIdentity && !course && amountPaid === 0 && onboardingDate === 0 && (!!courseStatus || !!paymentStatus);

  if (!hasIdentity && !hasEnrollment) return true;
  if (hasOnlyDropdownStatus) return true;
  if (!emailAddress && !amountPaid && (!name || !course)) return true;
  return false;
}

export async function parseStudentRecordFile(file: File): Promise<StudentRecordParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  if (workbook.SheetNames.length === 0) {
    return {
      rows: [],
      errors: [{ rowNumber: 0, field: 'file', message: 'The workbook has no sheets.' }],
      missingColumns: [...STUDENT_RECORD_REQUIRED_COLUMNS],
      headerRowNumber: null,
    };
  }
  return mergeStudentRecordResults(
    workbook.SheetNames.map((sheetName) => parseStudentRecordWorksheet(workbook.Sheets[sheetName], sheetName)),
  );
}

export function parseStudentRecordCsv(csv: string): StudentRecordParseResult {
  const workbook = XLSX.read(csv, { type: 'string' });
  const firstSheet = workbook.SheetNames[0];
  return parseStudentRecordWorksheet(workbook.Sheets[firstSheet], firstSheet);
}

export function parseStudentRecordWorksheet(worksheet: XLSX.WorkSheet, sourceSheet = 'Sheet1'): StudentRecordParseResult {
  const { rows: rawRows, presentColumns, headerRowNumber } = studentRowsFromTable(worksheetToTable(worksheet));
  const missingColumns = STUDENT_RECORD_REQUIRED_COLUMNS.filter((key) => !presentColumns.has(key));
  const errors: PaymentTrackerValidationError[] = [];

  if (!headerRowNumber) {
    return {
      rows: [],
      errors: [{ rowNumber: 0, field: 'header', message: 'Could not find a student record table header row.' }],
      missingColumns: [...STUDENT_RECORD_REQUIRED_COLUMNS],
      headerRowNumber: null,
    };
  }

  missingColumns.forEach((field) => {
    errors.push({ rowNumber: headerRowNumber, field, message: `Missing required column "${field}".` });
  });

  const seen = new Set<string>();
  const rows: StudentRecordImportRow[] = [];
  rawRows.forEach(({ raw, rowNumber }) => {
    raw.sourceSheet = sourceSheet;
    const row = normalizeStudentRecordRow(raw, rowNumber);
    const rowErrors = validateStudentRecordRow(row);
    const duplicateKey = stableImportId([row.emailAddress, canonicalCourseKey(row.course), row.mentorName]);
    if (duplicateKey && seen.has(duplicateKey)) {
      rowErrors.push({ rowNumber, field: 'emailAddress', message: 'Duplicate student/course/mentor row in this file.' });
    }
    if (row.emailAddress && row.course) seen.add(duplicateKey);
    if (rowErrors.length) errors.push(...rowErrors);
    else rows.push(row);
  });

  return {
    rows: missingColumns.length ? [] : rows,
    errors,
    missingColumns,
    headerRowNumber,
  };
}

function normalizeStudentRecordRow(raw: Record<string, unknown>, rowNumber: number): StudentRecordImportRow {
  return {
    rowNumber,
    sourceSheet: String(raw.sourceSheet ?? ''),
    name: String(raw.name ?? '').trim(),
    course: String(raw.course ?? '').trim(),
    mentorName: String(raw.mentorName ?? '').trim(),
    emailAddress: String(raw.emailAddress ?? '').replace(/\s+/g, '').toLowerCase(),
    phoneNumber: String(raw.phoneNumber ?? '').trim() || undefined,
    onboardingDate: parseTrackerDate(raw.onboardingDate),
    courseStatus: String(raw.courseStatus ?? '').trim() || 'pending',
    amountPaid: parseCurrency(raw.amountPaid),
    paymentStatus: String(raw.paymentStatus ?? '').trim() || 'pending',
  };
}

function validateStudentRecordRow(row: StudentRecordImportRow): PaymentTrackerValidationError[] {
  const errors: PaymentTrackerValidationError[] = [];
  (['name', 'course', 'emailAddress'] as const).forEach((field) => {
    if (!String(row[field] ?? '').trim()) {
      errors.push({ rowNumber: row.rowNumber, field, message: 'Required value is missing.' });
    }
  });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.emailAddress)) {
    errors.push({ rowNumber: row.rowNumber, field: 'emailAddress', message: 'Student email must be a valid email address.' });
  }
  if (Number.isNaN(row.onboardingDate)) errors.push({ rowNumber: row.rowNumber, field: 'onboardingDate', message: 'Date is invalid.' });
  if (row.amountPaid < 0) {
    errors.push({ rowNumber: row.rowNumber, field: 'amountPaid', message: 'Amount cannot be negative.' });
  }
  return errors;
}

function mergeStudentRecordResults(results: StudentRecordParseResult[]): StudentRecordParseResult {
  const rows: StudentRecordImportRow[] = [];
  const errors: PaymentTrackerValidationError[] = [];
  const missingColumns = new Set<string>();
  let headerRowNumber: number | null = null;

  results.forEach((result) => {
    rows.push(...result.rows);
    errors.push(...result.errors);
    result.missingColumns.forEach((field) => missingColumns.add(field));
    headerRowNumber ??= result.headerRowNumber;
  });

  return { rows, errors, missingColumns: [...missingColumns], headerRowNumber };
}

export function buildCombinedImport(trackerResult: PaymentTrackerParseResult, studentResult: StudentRecordParseResult): CombinedImportResult {
  const trackerRows = validPaymentTrackerRows(trackerResult);
  const courseIndex = buildCourseMentorIndex(trackerRows);
  const errors: PaymentTrackerValidationError[] = [...trackerResult.errors, ...studentResult.errors];
  const rows: CombinedImportRow[] = [];
  let unmatchedStudentRows = 0;
  let ambiguousStudentRows = 0;

  studentResult.rows.forEach((studentRow) => {
    const explicitMentor = studentRow.mentorName.trim();
    const matches = courseIndex.get(canonicalCourseKey(studentRow.course)) ?? [];
    const trackerMatch = explicitMentor
      ? matches.find((row) => normalizeImportKey(row.mentorName) === normalizeImportKey(explicitMentor))
      : matches.length === 1
        ? matches[0]
        : undefined;

    if (!trackerMatch && matches.length === 0) {
      unmatchedStudentRows += 1;
      errors.push({
        rowNumber: studentRow.rowNumber,
        field: 'course',
        message: `${studentRow.sourceSheet}: No mentor tracker row matches course "${studentRow.course}".`,
      });
      return;
    }

    if (!trackerMatch && matches.length > 1) {
      ambiguousStudentRows += 1;
      errors.push({
        rowNumber: studentRow.rowNumber,
        field: 'course',
        message: `${studentRow.sourceSheet}: Course "${studentRow.course}" has multiple mentors in the tracker.`,
      });
      return;
    }

    if (!trackerMatch) return;

    rows.push({
      rowNumber: studentRow.rowNumber,
      sourceSheet: studentRow.sourceSheet,
      trackerRowNumber: trackerMatch.rowNumber,
      trackerSourceSheet: trackerMatch.sourceSheet,
      cohort: trackerMatch.cohort,
      name: studentRow.name,
      emailAddress: studentRow.emailAddress,
      phoneNumber: studentRow.phoneNumber,
      course: studentRow.course,
      mentorName: trackerMatch.mentorName,
      onboardingDate: studentRow.onboardingDate,
      courseStatus: studentRow.courseStatus || trackerMatch.courseStatus,
      amountPaid: studentRow.amountPaid,
      paymentStatus: studentRow.paymentStatus,
      numberOfStudents: 'numberOfStudents' in trackerMatch ? trackerMatch.numberOfStudents : undefined,
      totalAmountPaid: trackerMatch.totalAmountPaid,
      amountDue: trackerMatch.amountDue,
      amountDisbursed: trackerMatch.amountDisbursed,
      payoutStatus: trackerMatch.paymentStatus,
      commissionRate: trackerMatch.commissionRate,
      coursePrice: trackerMatch.coursePrice || studentRow.amountPaid,
    });
  });

  const preview = {
    mentors: new Set(trackerRows.map((row) => normalizeImportKey(row.mentorName))).size,
    students: new Set(rows.map((row) => row.emailAddress)).size,
    courses: new Set(rows.map((row) => stableImportId([row.mentorName, canonicalCourseKey(row.course)]))).size,
    enrollments: new Set(rows.map((row) => stableImportId([row.emailAddress, row.mentorName, canonicalCourseKey(row.course)]))).size,
    summaries: new Set(
      trackerRows
        .filter((row): row is PaymentTrackerAggregateRow => 'numberOfStudents' in row)
        .map((row) => stableImportId([row.cohort, row.course, row.mentorName, row.startDate, row.dueDate])),
    ).size,
    payments: rows.filter((row) => row.amountPaid > 0).length,
    payouts: trackerRows.filter((row) => row.amountDisbursed > 0).length,
    rows: rows.length,
    matchedRows: rows.length,
    unmatchedStudentRows,
    ambiguousStudentRows,
  };

  return { rows, trackerRows, studentRows: studentResult.rows, errors, preview };
}

function buildCourseMentorIndex(trackerRows: AnyPaymentTrackerRow[]) {
  const index = new Map<string, AnyPaymentTrackerRow[]>();
  trackerRows.forEach((row) => {
    const key = canonicalCourseKey(row.course);
    const existing = index.get(key) ?? [];
    if (!existing.some((item) => normalizeImportKey(item.mentorName) === normalizeImportKey(row.mentorName))) {
      existing.push(row);
    }
    index.set(key, existing);
  });
  return index;
}
