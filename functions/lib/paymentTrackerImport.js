import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { firestoreDb } from './db.js';
const STUDENT_REQUIRED = [
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
];
const AGGREGATE_REQUIRED = [
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
];
const HEADER_ALIASES = {
    cohort: 'cohort',
    batch: 'cohort',
    course: 'course',
    coursename: 'course',
    mentorsdetails: 'mentorName',
    mentordetails: 'mentorName',
    mentor: 'mentorName',
    mentorname: 'mentorName',
    mentoremail: 'mentorEmail',
    student: 'studentName',
    studentname: 'studentName',
    studentemail: 'studentEmail',
    coursestatus: 'courseStatus',
    status: 'courseStatus',
    numberofstudents: 'numberOfStudents',
    students: 'numberOfStudents',
    noofstudents: 'numberOfStudents',
    numstudents: 'numberOfStudents',
    startdate: 'startDate',
    start: 'startDate',
    duedate: 'dueDate',
    due: 'dueDate',
    totalamountpaid: 'totalAmountPaid',
    totalpaid: 'totalAmountPaid',
    amountpaid: 'totalAmountPaid',
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
    commission37pct: 'amountDue',
    balancedue: 'amountDue',
};
const STUDENT_RECORD_REQUIRED = [
    'name',
    'course',
    'emailAddress',
    'onboardingDate',
    'courseStatus',
    'amountPaid',
    'paymentStatus',
];
const STUDENT_RECORD_HEADERS = {
    name: 'name',
    student: 'name',
    studentname: 'name',
    studenttype: 'studentType',
    course: 'course',
    coursename: 'course',
    mentor: 'mentorName',
    mentorname: 'mentorName',
    email: 'emailAddress',
    emailaddress: 'emailAddress',
    studentemail: 'emailAddress',
    phonenumber: 'phoneNumber',
    phone: 'phoneNumber',
    number: 'phoneNumber',
    onboardingdate: 'onboardingDate',
    enrollmentdate: 'onboardingDate',
    date: 'onboardingDate',
    coursestatus: 'courseStatus',
    status: 'courseStatus',
    amountp: 'amountPaid',
    amountpaid: 'amountPaid',
    paid: 'amountPaid',
    paymentstatus: 'paymentStatus',
};
const UNASSIGNED_MENTOR_NAME = 'Unassigned Mentor';
const UNASSIGNED_MENTOR_EMAIL = 'unassigned.mentor@imported.mentorflow.local';
const REVIEWED_IMPORT_FUNCTION_VERSION = 'commit-reviewed-import-diagnostics-v1';
export const syncMentorPaymentSheet = onCall(async (request) => {
    const uid = request.auth?.uid;
    if (!uid)
        throw new HttpsError('unauthenticated', 'Sign in required');
    const db = firestoreDb();
    const userSnap = await db.collection('users').doc(uid).get();
    const isAdmin = request.auth?.token.admin === true || userSnap.data()?.role === 'admin';
    if (!isAdmin)
        throw new HttpsError('permission-denied', 'Only admins can sync payment tracker sheets');
    const singleWorkbookUrl = String(request.data?.singleWorkbookUrl ?? '').trim();
    const trackerSheetUrl = String(request.data?.trackerSheetUrl ?? request.data?.sheetUrl ?? '').trim();
    const trackerSheetName = String(request.data?.trackerSheetName ?? request.data?.sheetName ?? '').trim();
    const studentSheetUrl = String(request.data?.studentSheetUrl ?? '').trim();
    const studentSheetName = String(request.data?.studentSheetName ?? '').trim();
    const studentSheetNames = Array.isArray(request.data?.studentSheetNames)
        ? request.data.studentSheetNames.map((name) => String(name).trim()).filter(Boolean)
        : [];
    const sheetUrl = trackerSheetUrl;
    const sheetName = trackerSheetName;
    const importId = db.collection('imports').doc().id;
    if (singleWorkbookUrl) {
        const mentorSheetName = String(request.data?.mentorSheetName ?? 'Import Ready — Mentors').trim();
        const masterStudentSheetName = String(request.data?.studentSheetName ?? 'Import Ready — Students').trim();
        const [mentorResponse, studentResponse] = await Promise.all([
            fetch(toCsvExportUrl(singleWorkbookUrl, mentorSheetName)),
            fetch(toCsvExportUrl(singleWorkbookUrl, masterStudentSheetName)),
        ]);
        if (!mentorResponse.ok || !studentResponse.ok) {
            throw new HttpsError('failed-precondition', `Could not fetch master workbook CSV (${mentorResponse.status}/${studentResponse.status})`);
        }
        const parsed = parseTrackerCsv(await mentorResponse.text(), mentorSheetName);
        const studentParsed = parseStudentRecordCsv(await studentResponse.text(), masterStudentSheetName);
        const trackerRows = parsed.mode === 'student' ? parsed.rows : parsed.aggregateRows;
        const resolvedStudents = resolveSingleWorkbookStudents(trackerRows, studentParsed.rows);
        const errors = [...parsed.errors, ...studentParsed.errors];
        const reviewIssues = errors.map(toReviewIssue);
        const summary = buildDualSummary([...trackerRows, ...resolvedStudents.generatedTrackerRows], resolvedStudents.rows);
        if (errors.length > 0) {
            await db.collection('imports').doc(importId).set({
                id: importId,
                sourceType: 'single_google_sheet',
                mode: 'single_workbook',
                sheetUrl: singleWorkbookUrl,
                mentorSheetName,
                studentSheetName: masterStudentSheetName,
                importedBy: uid,
                importedAt: Date.now(),
                rowCount: studentParsed.rows.length + trackerRows.length,
                successCount: 0,
                errorCount: errors.length,
                errors: errors.slice(0, 100),
                reviewIssues: reviewIssues.slice(0, 100),
                summary,
            });
            return { importId, mode: 'single_workbook', summary, errors, reviewIssues };
        }
        await commitWritesInChunks(await buildDualImportWrites({
            parsed: { ...parsed, mode: 'aggregate', rows: [], aggregateRows: [...trackerRows.filter((row) => 'numberOfStudents' in row), ...resolvedStudents.generatedTrackerRows] },
            studentRows: resolvedStudents.rows,
            importId,
            importedBy: uid,
            trackerSheetUrl: singleWorkbookUrl,
            trackerSheetName: mentorSheetName,
            studentSheetUrl: singleWorkbookUrl,
            studentSheetName: masterStudentSheetName,
        }));
        return { importId, mode: 'single_workbook', summary, errors: [] };
    }
    if (!sheetUrl)
        throw new HttpsError('invalid-argument', 'sheetUrl is required');
    const response = await fetch(toCsvExportUrl(sheetUrl, sheetName));
    if (!response.ok) {
        throw new HttpsError('failed-precondition', `Could not fetch sheet CSV (${response.status})`);
    }
    const parsed = parseTrackerCsv(await response.text(), sheetName || 'Mentor Payment Tracker');
    if (studentSheetUrl) {
        const requestedStudentSheets = studentSheetNames.length > 0 ? studentSheetNames : [studentSheetName || 'Student Record'];
        const studentResults = await Promise.all(requestedStudentSheets.map(async (name) => {
            const studentResponse = await fetch(toCsvExportUrl(studentSheetUrl, name === 'Student Record' ? studentSheetName : name));
            if (!studentResponse.ok) {
                throw new HttpsError('failed-precondition', `Could not fetch student sheet CSV (${studentResponse.status})`);
            }
            return parseStudentRecordCsv(await studentResponse.text(), name);
        }));
        const studentParsed = mergeStudentResults(studentResults);
        const trackerRows = parsed.mode === 'student' ? parsed.rows : parsed.aggregateRows;
        const resolvedStudents = resolveStudentMentors(trackerRows, studentParsed.rows);
        const errors = [...parsed.errors, ...studentParsed.errors, ...resolvedStudents.errors];
        const reviewIssues = errors.map(toReviewIssue);
        const summary = buildDualSummary(trackerRows, resolvedStudents.rows);
        if (errors.length > 0) {
            await db.collection('imports').doc(importId).set({
                id: importId,
                sourceType: 'dual_google_sheets',
                mode: 'dual',
                trackerSheetUrl,
                trackerSheetName: trackerSheetName || null,
                studentSheetUrl,
                studentSheetName: studentSheetName || null,
                importedBy: uid,
                importedAt: Date.now(),
                rowCount: 0,
                successCount: 0,
                errorCount: errors.length,
                errors: errors.slice(0, 100),
                reviewIssues: reviewIssues.slice(0, 100),
                summary,
            });
            return { importId, mode: 'dual', summary, errors, reviewIssues };
        }
        await commitWritesInChunks(await buildDualImportWrites({
            parsed,
            studentRows: resolvedStudents.rows,
            importId,
            importedBy: uid,
            trackerSheetUrl,
            trackerSheetName,
            studentSheetUrl,
            studentSheetName,
        }));
        return { importId, mode: 'dual', summary, errors: [] };
    }
    const summary = buildSummary(parsed.mode === 'student' ? parsed.rows : parsed.aggregateRows, parsed.mode);
    if (parsed.errors.length > 0) {
        await db.collection('imports').doc(importId).set({
            id: importId,
            sourceType: 'google_sheets',
            mode: parsed.mode,
            sheetUrl,
            sheetName: sheetName || null,
            importedBy: uid,
            importedAt: Date.now(),
            rowCount: 0,
            successCount: 0,
            errorCount: parsed.errors.length,
            errors: parsed.errors.slice(0, 100),
            summary,
        });
        return { importId, mode: parsed.mode, summary, errors: parsed.errors };
    }
    await commitWritesInChunks(await buildImportWrites({
        parsed,
        importId,
        importedBy: uid,
        sheetUrl,
        sheetName,
    }));
    return { importId, mode: parsed.mode, summary, errors: [] };
});
export const commitReviewedImport = onCall(async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'Sign in required', reviewedImportDetails('auth-admin-lookup'));
    }
    let phase = 'auth-admin-lookup';
    let trackerRows = [];
    let studentRows = [];
    let writes = [];
    const dryRun = request.data?.dryRun === true;
    try {
        const db = firestoreDb();
        const userSnap = await db.collection('users').doc(uid).get();
        const isAdmin = request.auth?.token.admin === true || userSnap.data()?.role === 'admin';
        if (!isAdmin) {
            throw new HttpsError('permission-denied', 'Only admins can commit reviewed imports', reviewedImportDetails(phase));
        }
        phase = 'payload-parsing';
        trackerRows = parseReviewedTrackerRows(request.data?.trackerRows);
        studentRows = parseReviewedStudentRows(request.data?.studentRows);
        if (trackerRows.length === 0 || studentRows.length === 0) {
            throw new HttpsError('invalid-argument', 'Reviewed import requires mentor tracker rows and student rows', reviewedImportDetails(phase, trackerRows, studentRows));
        }
        phase = 'write-construction';
        const importId = db.collection('imports').doc().id;
        const fileName = String(request.data?.fileName ?? 'Reviewed upload import').trim() || 'Reviewed upload import';
        writes = await buildDualImportWrites({
            trackerRows,
            studentRows,
            importId,
            importedBy: uid,
            fileName,
            sourceType: 'dual_excel',
        });
        const summary = summarizeWrites(writes);
        const preview = buildDualSummary(trackerRows, studentRows);
        if (dryRun) {
            phase = 'dry-run';
            return {
                importId,
                mode: 'dual',
                version: REVIEWED_IMPORT_FUNCTION_VERSION,
                dryRun: true,
                summary,
                preview,
                errors: [],
            };
        }
        phase = 'firestore-commit';
        await commitWritesInChunks(writes, { trackerRows, studentRows });
        return {
            importId,
            mode: 'dual',
            version: REVIEWED_IMPORT_FUNCTION_VERSION,
            dryRun: false,
            summary,
            preview,
            errors: [],
        };
    }
    catch (error) {
        if (error instanceof HttpsError)
            throw error;
        console.error('commitReviewedImport failed', error);
        throw new HttpsError('internal', `Reviewed import failed during ${phase}: ${error instanceof Error ? error.message : 'Unknown server error'}`, reviewedImportDetails(phase, trackerRows, studentRows, writes));
    }
});
function reviewedImportDetails(phase, trackerRows = [], studentRows = [], writes = [], extra = {}) {
    return {
        version: REVIEWED_IMPORT_FUNCTION_VERSION,
        phase,
        trackerRowCount: trackerRows.length,
        studentRowCount: studentRows.length,
        writeCount: writes.length,
        ...extra,
    };
}
function toCsvExportUrl(input, sheetName) {
    const url = new URL(input);
    const id = url.pathname.match(/\/spreadsheets\/d\/([^/]+)/)?.[1];
    if (!id)
        throw new HttpsError('invalid-argument', 'Invalid Google Sheets URL');
    if (sheetName) {
        return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
    }
    const gid = url.searchParams.get('gid') ?? '0';
    return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${encodeURIComponent(gid)}`;
}
function parseReviewedTrackerRows(value) {
    if (!Array.isArray(value))
        return [];
    return value
        .map((row, index) => {
        const record = isRecord(row) ? row : {};
        const base = {
            rowNumber: toNumber(record.rowNumber, index + 1),
            sourceSheet: toStringValue(record.sourceSheet) || 'Reviewed Upload',
            cohort: toStringValue(record.cohort) || 'Imported Tracker',
            course: toStringValue(record.course),
            mentorName: toStringValue(record.mentorName),
            mentorEmail: toStringValue(record.mentorEmail).toLowerCase() || undefined,
            courseStatus: toStringValue(record.courseStatus) || 'pending',
            startDate: toNumber(record.startDate),
            dueDate: toNumber(record.dueDate),
            totalAmountPaid: toNumber(record.totalAmountPaid),
            amountDue: toNumber(record.amountDue),
            amountDisbursed: toNumber(record.amountDisbursed),
            paymentStatus: toStringValue(record.paymentStatus) || 'pending',
            coursePrice: toNumber(record.coursePrice),
            commissionRate: toNumber(record.commissionRate, 0.37),
        };
        if (toNumber(record.numberOfStudents) > 0) {
            return { ...base, numberOfStudents: toNumber(record.numberOfStudents) };
        }
        return {
            ...base,
            studentName: toStringValue(record.studentName),
            studentEmail: toStringValue(record.studentEmail).toLowerCase(),
        };
    })
        .filter((row) => row.course && row.mentorName);
}
function parseReviewedStudentRows(value) {
    if (!Array.isArray(value))
        return [];
    return value
        .map((row, index) => {
        const record = isRecord(row) ? row : {};
        return {
            rowNumber: toNumber(record.rowNumber, index + 1),
            sourceSheet: toStringValue(record.sourceSheet) || 'Reviewed Upload',
            studentType: toStringValue(record.studentType) || undefined,
            name: toStringValue(record.name),
            course: toStringValue(record.course),
            mentorName: toStringValue(record.mentorName),
            emailAddress: toStringValue(record.emailAddress).replace(/\s+/g, '').toLowerCase(),
            phoneNumber: toStringValue(record.phoneNumber) || undefined,
            onboardingDate: toNumber(record.onboardingDate),
            courseStatus: toStringValue(record.courseStatus) || 'pending',
            amountPaid: toNumber(record.amountPaid),
            paymentStatus: toStringValue(record.paymentStatus) || 'pending',
            trackerSourceSheet: toStringValue(record.trackerSourceSheet) || null,
            trackerRowNumber: record.trackerRowNumber === null ? null : toNumber(record.trackerRowNumber),
            cohort: toStringValue(record.cohort) || undefined,
            amountDue: toNumber(record.amountDue),
            amountDisbursed: toNumber(record.amountDisbursed),
            correctedFields: Array.isArray(record.correctedFields) ? record.correctedFields.map((field) => String(field)) : [],
            originalStudentRow: isRecord(record.originalStudentRow) ? record.originalStudentRow : undefined,
        };
    })
        .filter((row) => row.name && row.course && row.mentorName);
}
function toStringValue(value) {
    return String(value ?? '').trim();
}
function toNumber(value, fallback = 0) {
    const parsed = typeof value === 'number' ? value : Number(String(value ?? '').replace(/[₦,\s]/g, ''));
    return Number.isFinite(parsed) ? parsed : fallback;
}
function parseTrackerCsv(csv, sourceSheet = 'Mentor Payment Tracker') {
    const table = parseCsv(csv);
    const header = findHeaderRow(table);
    if (!header) {
        return {
            mode: 'aggregate',
            rows: [],
            aggregateRows: [],
            errors: [{ rowNumber: 0, field: 'header', message: 'Could not find a tracker table header row.' }],
        };
    }
    const present = new Set(header.headers.filter(Boolean));
    const mode = present.has('studentName') || present.has('studentEmail') ? 'student' : 'aggregate';
    const required = mode === 'student' ? STUDENT_REQUIRED : AGGREGATE_REQUIRED;
    const errors = [];
    required.forEach((field) => {
        if (!present.has(field)) {
            errors.push({ rowNumber: header.index + 1, field, message: `Missing required column "${field}".` });
        }
    });
    let currentCohort = 'Imported Tracker';
    const rawRows = table.slice(header.index + 1).flatMap((values, offset) => {
        const raw = {};
        header.headers.forEach((field, colIndex) => {
            if (field)
                raw[field] = values[colIndex] ?? '';
        });
        const cohortLabel = extractCohortLabel(raw, values);
        if (cohortLabel) {
            currentCohort = cohortLabel;
            return [];
        }
        if (isIgnorableRawRow(raw))
            return [];
        raw.cohort = raw.cohort || currentCohort;
        raw.sourceSheet = sourceSheet;
        return [{ raw, rowNumber: header.index + offset + 2 }];
    });
    if (mode === 'student') {
        const rows = [];
        const seen = new Set();
        rawRows.forEach(({ raw, rowNumber }) => {
            const row = normalizeStudentRow(raw, rowNumber);
            const rowErrors = validateStudentRow(row);
            const duplicate = stableImportId([row.studentEmail, row.course, row.mentorName]);
            if (seen.has(duplicate))
                rowErrors.push({ rowNumber, field: 'studentEmail', message: 'Duplicate row.' });
            seen.add(duplicate);
            if (rowErrors.length)
                errors.push(...rowErrors);
            rows.push(row);
        });
        return { mode, rows, aggregateRows: [], errors };
    }
    const aggregateRows = [];
    const seen = new Set();
    rawRows.forEach(({ raw, rowNumber }) => {
        const row = normalizeAggregateRow(raw, rowNumber);
        const rowErrors = validateAggregateRow(row);
        const duplicate = stableImportId([row.cohort, row.course, row.mentorName, row.startDate, row.dueDate]);
        if (seen.has(duplicate))
            rowErrors.push({ rowNumber, field: 'course', message: 'Duplicate row.' });
        seen.add(duplicate);
        if (rowErrors.length)
            errors.push(...rowErrors);
        aggregateRows.push(row);
    });
    return { mode, rows: [], aggregateRows, errors };
}
function parseCsv(csv) {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < csv.length; i += 1) {
        const char = csv[i];
        const next = csv[i + 1];
        if (char === '"' && quoted && next === '"') {
            cell += '"';
            i += 1;
        }
        else if (char === '"') {
            quoted = !quoted;
        }
        else if (char === ',' && !quoted) {
            row.push(cell.trim());
            cell = '';
        }
        else if ((char === '\n' || char === '\r') && !quoted) {
            if (char === '\r' && next === '\n')
                i += 1;
            row.push(cell.trim());
            if (row.some(Boolean))
                rows.push(row);
            row = [];
            cell = '';
        }
        else {
            cell += char;
        }
    }
    row.push(cell.trim());
    if (row.some(Boolean))
        rows.push(row);
    return rows;
}
function findHeaderRow(table) {
    let best = null;
    table.forEach((row, index) => {
        const headers = row.map((value) => HEADER_ALIASES[normalizeImportKey(value)] ?? null);
        const unique = new Set(headers.filter(Boolean));
        const hasCore = unique.has('course') && unique.has('mentorName') && unique.has('totalAmountPaid');
        if (hasCore && (!best || unique.size > best.score))
            best = { index, headers, score: unique.size };
    });
    return best;
}
function isIgnorableRawRow(raw) {
    const course = String(raw.course ?? '').trim();
    const mentorName = String(raw.mentorName ?? '').trim();
    const courseStatus = String(raw.courseStatus ?? '').trim();
    const numberOfStudents = Number(String(raw.numberOfStudents ?? '').replace(/,/g, '')) || 0;
    const hasMoney = parseCurrency(raw.totalAmountPaid) > 0 || parseCurrency(raw.amountDue) > 0 || parseCurrency(raw.amountDisbursed) > 0;
    const hasDate = parseDate(raw.startDate) > 0 || parseDate(raw.dueDate) > 0;
    const skippedPlaceholder = !!course && ['skipped', 'cancelled', 'canceled'].includes(normalizeImportKey(courseStatus)) && !hasMoney && !hasDate && numberOfStudents === 0;
    return !course || !mentorName || (!course && !mentorName && !courseStatus && !hasMoney && !hasDate) || (!!mentorName && !course && !courseStatus && !hasMoney && !hasDate) || skippedPlaceholder;
}
function extractCohortLabel(raw, values) {
    const joined = (values.length ? values : [raw.cohort, raw.course, raw.mentorName]).map((value) => String(value ?? '').trim()).filter(Boolean).join(' ');
    if (!/cohort|payment/i.test(joined))
        return null;
    const hasCourse = String(raw.course ?? '').trim();
    const hasStatus = String(raw.courseStatus ?? '').trim();
    const hasMoney = parseCurrency(raw.totalAmountPaid) > 0 || parseCurrency(raw.amountDue) > 0 || parseCurrency(raw.amountDisbursed) > 0;
    if (hasCourse || hasStatus || hasMoney)
        return null;
    return joined.replace(/\s+/g, ' ').trim();
}
function normalizeBaseRow(raw, rowNumber) {
    const totalAmountPaid = parseCurrency(raw.totalAmountPaid);
    const amountDue = parseCurrency(raw.amountDue);
    return {
        rowNumber,
        sourceSheet: (raw.sourceSheet ?? '').trim(),
        cohort: (raw.cohort ?? '').trim() || 'Imported Tracker',
        course: (raw.course ?? '').trim(),
        mentorName: (raw.mentorName ?? '').trim(),
        mentorEmail: (raw.mentorEmail ?? '').trim().toLowerCase() || undefined,
        courseStatus: (raw.courseStatus ?? '').trim() || 'pending',
        startDate: parseDate(raw.startDate),
        dueDate: parseDate(raw.dueDate),
        totalAmountPaid,
        amountDue,
        amountDisbursed: parseCurrency(raw.amountDisbursed),
        paymentStatus: (raw.paymentStatus ?? '').trim() || 'pending',
        coursePrice: parseCurrency(raw.coursePrice) || totalAmountPaid,
        commissionRate: Number(raw.commissionRate) || 0.37,
    };
}
function normalizeStudentRow(raw, rowNumber) {
    return {
        ...normalizeBaseRow(raw, rowNumber),
        studentName: (raw.studentName ?? '').trim(),
        studentEmail: (raw.studentEmail ?? '').trim().toLowerCase(),
    };
}
function normalizeAggregateRow(raw, rowNumber) {
    const courseStatusValue = String(raw.courseStatus ?? '').trim();
    const parsedStudents = Number(String(raw.numberOfStudents ?? '').replace(/,/g, '')) || 0;
    const statusAsStudentCount = !parsedStudents && /^\d+$/.test(courseStatusValue) ? Number(courseStatusValue) : 0;
    return {
        ...normalizeBaseRow(raw, rowNumber),
        courseStatus: statusAsStudentCount ? 'pending' : (raw.courseStatus ?? '').trim() || 'pending',
        numberOfStudents: parsedStudents || statusAsStudentCount,
    };
}
function validateBaseRow(row) {
    const errors = [];
    ['course', 'mentorName'].forEach((field) => {
        if (!String(row[field] ?? '').trim())
            errors.push({ rowNumber: row.rowNumber, field, message: 'Required value is missing.' });
    });
    if (row.mentorEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.mentorEmail)) {
        errors.push({ rowNumber: row.rowNumber, field: 'mentorEmail', message: 'Invalid email.' });
    }
    if (Number.isNaN(row.startDate))
        errors.push({ rowNumber: row.rowNumber, field: 'startDate', message: 'Invalid date.' });
    if (Number.isNaN(row.dueDate))
        errors.push({ rowNumber: row.rowNumber, field: 'dueDate', message: 'Invalid date.' });
    if (row.totalAmountPaid < 0)
        errors.push({ rowNumber: row.rowNumber, field: 'totalAmountPaid', message: 'Cannot be negative.' });
    if (row.amountDue < 0)
        errors.push({ rowNumber: row.rowNumber, field: 'amountDue', message: 'Cannot be negative.' });
    if (row.amountDisbursed < 0)
        errors.push({ rowNumber: row.rowNumber, field: 'amountDisbursed', message: 'Cannot be negative.' });
    if (row.commissionRate < 0 || row.commissionRate > 1)
        errors.push({ rowNumber: row.rowNumber, field: 'commissionRate', message: 'Must be between 0 and 1.' });
    return errors;
}
function validateStudentRow(row) {
    const errors = validateBaseRow(row);
    if (!row.studentName)
        errors.push({ rowNumber: row.rowNumber, field: 'studentName', message: 'Required value is missing.' });
    if (!row.studentEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.studentEmail)) {
        errors.push({ rowNumber: row.rowNumber, field: 'studentEmail', message: 'Valid student email is required.' });
    }
    return errors;
}
function validateAggregateRow(row) {
    const errors = validateBaseRow(row);
    if (row.numberOfStudents < 0)
        errors.push({ rowNumber: row.rowNumber, field: 'numberOfStudents', message: 'Cannot be negative.' });
    return errors;
}
function parseStudentRecordCsv(csv, sourceSheet = 'Student Record') {
    const table = parseCsv(csv);
    const header = findStudentRecordHeaderRow(table);
    if (!header) {
        return {
            rows: [],
            errors: [{ rowNumber: 0, field: 'header', message: 'Could not find a student record table header row.' }],
        };
    }
    const present = new Set(header.headers.filter(Boolean));
    const errors = [];
    STUDENT_RECORD_REQUIRED.forEach((field) => {
        if (!present.has(field)) {
            errors.push({ rowNumber: header.index + 1, field, message: `Missing required column "${field}".` });
        }
    });
    const rows = [];
    const seen = new Set();
    table.slice(header.index + 1).forEach((values, offset) => {
        const raw = {};
        header.headers.forEach((field, colIndex) => {
            if (field)
                raw[field] = values[colIndex] ?? '';
        });
        raw.sourceSheet = sourceSheet;
        if (isIgnorableStudentRecordRow(raw))
            return;
        const row = normalizeStudentRecordRow(raw, header.index + offset + 2);
        const rowErrors = validateStudentRecordRow(row);
        const duplicate = stableImportId([row.emailAddress, row.mentorName, canonicalCourseKey(row.course)]);
        if (seen.has(duplicate))
            rowErrors.push({ rowNumber: row.rowNumber, field: 'emailAddress', message: 'Duplicate row.' });
        if (row.emailAddress && row.course)
            seen.add(duplicate);
        if (rowErrors.length)
            errors.push(...rowErrors);
        rows.push(row);
    });
    return { rows, errors };
}
function toReviewIssue(error) {
    const fieldCode = {
        name: 'missingName',
        emailAddress: error.message.toLowerCase().includes('valid') ? 'invalidEmail' : 'missingEmail',
        course: error.message.toLowerCase().includes('no mentor') ? 'unmatchedCourse' : 'missingCourse',
        mentorName: error.message.toLowerCase().includes('multiple') ? 'ambiguousCourse' : 'missingMentor',
        onboardingDate: 'invalidDate',
        studentEmail: 'invalidEmail',
    };
    return {
        ...error,
        code: fieldCode[error.field] ?? 'validation',
        blocking: true,
    };
}
function isIgnorableStudentRecordRow(raw) {
    const name = String(raw.name ?? '').trim();
    const course = String(raw.course ?? '').trim();
    const emailAddress = String(raw.emailAddress ?? '').trim();
    const phoneNumber = String(raw.phoneNumber ?? '').trim();
    const amountPaid = parseCurrency(raw.amountPaid);
    const onboardingDate = parseDate(raw.onboardingDate);
    const courseStatus = String(raw.courseStatus ?? '').trim();
    const paymentStatus = String(raw.paymentStatus ?? '').trim();
    const hasIdentity = !!name || !!emailAddress || !!phoneNumber;
    const hasEnrollment = !!course || amountPaid > 0 || onboardingDate > 0;
    const hasOnlyDropdownStatus = !hasIdentity && !course && amountPaid === 0 && onboardingDate === 0 && (!!courseStatus || !!paymentStatus);
    if (!hasIdentity && !hasEnrollment)
        return true;
    if (hasOnlyDropdownStatus)
        return true;
    return false;
}
function mergeStudentResults(results) {
    return {
        rows: results.flatMap((result) => result.rows),
        errors: results.flatMap((result) => result.errors),
    };
}
function findStudentRecordHeaderRow(table) {
    let best = null;
    table.forEach((row, index) => {
        const headers = row.map((value) => STUDENT_RECORD_HEADERS[normalizeImportKey(value)] ?? null);
        const unique = new Set(headers.filter(Boolean));
        const hasCore = unique.has('name') && unique.has('course') && unique.has('emailAddress') && unique.has('amountPaid');
        if (hasCore && (!best || unique.size > best.score))
            best = { index, headers, score: unique.size };
    });
    return best;
}
function normalizeStudentRecordRow(raw, rowNumber) {
    return {
        rowNumber,
        sourceSheet: (raw.sourceSheet ?? '').trim(),
        studentType: (raw.studentType ?? '').trim() || undefined,
        name: (raw.name ?? '').trim(),
        course: (raw.course ?? '').trim(),
        mentorName: (raw.mentorName ?? '').trim(),
        emailAddress: (raw.emailAddress ?? '').replace(/\s+/g, '').toLowerCase(),
        phoneNumber: (raw.phoneNumber ?? '').trim() || undefined,
        onboardingDate: parseDate(raw.onboardingDate),
        courseStatus: (raw.courseStatus ?? '').trim() || 'pending',
        amountPaid: parseCurrency(raw.amountPaid),
        paymentStatus: (raw.paymentStatus ?? '').trim() || 'pending',
    };
}
function validateStudentRecordRow(row) {
    const errors = [];
    ['name', 'course', 'emailAddress'].forEach((field) => {
        if (!String(row[field] ?? '').trim())
            errors.push({ rowNumber: row.rowNumber, field, message: 'Required value is missing.' });
    });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.emailAddress)) {
        errors.push({ rowNumber: row.rowNumber, field: 'emailAddress', message: 'Valid email is required.' });
    }
    if (Number.isNaN(row.onboardingDate))
        errors.push({ rowNumber: row.rowNumber, field: 'onboardingDate', message: 'Invalid date.' });
    if (row.amountPaid < 0)
        errors.push({ rowNumber: row.rowNumber, field: 'amountPaid', message: 'Cannot be negative.' });
    return errors;
}
function resolveStudentMentors(trackerRows, studentRows) {
    const courseIndex = buildCourseMentorIndex(trackerRows);
    const errors = [];
    const rows = studentRows.flatMap((row) => {
        if (row.mentorName.trim())
            return [row];
        const matches = courseIndex.get(canonicalCourseKey(row.course)) ?? [];
        if (matches.length === 0) {
            errors.push({ rowNumber: row.rowNumber, field: 'course', message: `No mentor tracker row matches course "${row.course}".` });
            return [];
        }
        if (matches.length > 1) {
            errors.push({
                rowNumber: row.rowNumber,
                field: 'mentorName',
                message: `Course "${row.course}" has multiple mentors in the tracker. Add mentorName for this student row.`,
            });
            return [];
        }
        return [{ ...row, mentorName: matches[0].mentorName }];
    });
    return { rows, errors };
}
function resolveSingleWorkbookStudents(trackerRows, studentRows) {
    const courseIndex = buildCourseMentorIndex(trackerRows);
    const generatedTrackerRows = [];
    const rows = studentRows.map((row) => {
        if (row.mentorName.trim())
            return row;
        const matches = courseIndex.get(canonicalCourseKey(row.course)) ?? [];
        if (matches.length === 1)
            return { ...row, mentorName: matches[0].mentorName };
        if (matches.length > 1)
            return row;
        const existingGenerated = generatedTrackerRows.find((trackerRow) => canonicalCourseKey(trackerRow.course) === canonicalCourseKey(row.course));
        if (!existingGenerated) {
            generatedTrackerRows.push({
                rowNumber: 900000 + generatedTrackerRows.length,
                sourceSheet: 'Generated Unassigned Mentor',
                cohort: row.studentType || 'Unassigned Courses',
                course: row.course,
                mentorName: UNASSIGNED_MENTOR_NAME,
                mentorEmail: UNASSIGNED_MENTOR_EMAIL,
                courseStatus: 'pending',
                startDate: 0,
                dueDate: 0,
                totalAmountPaid: row.amountPaid,
                amountDue: 0,
                amountDisbursed: 0,
                paymentStatus: 'pending',
                coursePrice: row.amountPaid,
                commissionRate: 0.37,
                numberOfStudents: 1,
            });
        }
        else {
            existingGenerated.totalAmountPaid += row.amountPaid;
            existingGenerated.coursePrice = Math.round(existingGenerated.totalAmountPaid / Math.max(existingGenerated.numberOfStudents + 1, 1));
            existingGenerated.numberOfStudents += 1;
        }
        return { ...row, mentorName: UNASSIGNED_MENTOR_NAME };
    });
    return { rows, generatedTrackerRows };
}
function buildCourseMentorIndex(trackerRows) {
    const index = new Map();
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
async function buildImportWrites({ parsed, importId, importedBy, sheetUrl, sheetName, }) {
    const db = firestoreDb();
    const now = Date.now();
    const [usersSnap, coursesSnap, enrollmentsSnap] = await Promise.all([
        db.collection('users').get(),
        db.collection('courses').get(),
        db.collection('enrollments').get(),
    ]);
    const users = usersSnap.docs.map((snap) => snap.data());
    const courses = coursesSnap.docs.map((snap) => snap.data());
    const enrollments = enrollmentsSnap.docs.map((snap) => snap.data());
    const usersByEmail = new Map(users.map((user) => [String(user.email).toLowerCase(), user]));
    const mentorsByName = new Map(users.filter((user) => user.role === 'mentor').map((user) => [stableImportId([String(user.name)]), user]));
    const writes = new Map();
    const put = (ref, data) => writes.set(ref.path, { ref, data });
    const resolveMentorCourse = (row) => {
        const mentorEmail = (row.mentorEmail || makePlaceholderEmail(row.mentorName, 'mentor')).toLowerCase();
        const existingMentor = usersByEmail.get(mentorEmail) || mentorsByName.get(stableImportId([row.mentorName]));
        const mentorId = String(existingMentor?.uid ?? `imported_mentor_${stableImportId([mentorEmail || row.mentorName])}`);
        const existingCourse = courses.find((course) => canonicalCourseKey(String(course.title)) === canonicalCourseKey(row.course) && course.mentorId === mentorId);
        const courseId = String(existingCourse?.id ?? `imported_course_${stableImportId([row.course, mentorId])}`);
        put(db.collection('users').doc(mentorId), {
            uid: mentorId,
            email: mentorEmail,
            name: row.mentorName,
            role: 'mentor',
            createdAt: existingMentor?.createdAt ?? now,
            kycStatus: existingMentor?.kycStatus ?? 'not_started',
            sourceImportId: importId,
            updatedAt: now,
        });
        put(db.collection('courses').doc(courseId), {
            id: courseId,
            title: row.course,
            description: `${row.cohort} imported from mentor payment tracker.`,
            mentorId,
            mentorName: row.mentorName,
            price: row.coursePrice,
            commissionRate: row.commissionRate,
            createdAt: existingCourse?.createdAt ?? now,
            sourceImportId: importId,
            updatedAt: now,
        });
        return { mentorId, courseId };
    };
    if (parsed.mode === 'student') {
        parsed.rows.forEach((row) => {
            const { mentorId, courseId } = resolveMentorCourse(row);
            const existingStudent = usersByEmail.get(row.studentEmail);
            const sameNamedExistingStudent = existingStudent && normalizeImportKey(existingStudent.name) === normalizeImportKey(row.studentName)
                ? existingStudent
                : undefined;
            const studentId = String(sameNamedExistingStudent?.uid ?? `imported_student_${stableImportId([row.studentName, row.studentEmail, row.sourceSheet, row.rowNumber])}`);
            const existingEnrollment = enrollments.find((enrollment) => enrollment.studentId === studentId && enrollment.courseId === courseId);
            const enrollmentId = String(existingEnrollment?.id ?? `imported_enrollment_${stableImportId([studentId, courseId])}`);
            put(db.collection('users').doc(studentId), {
                uid: studentId,
                email: row.studentEmail,
                name: row.studentName,
                role: 'student',
                createdAt: sameNamedExistingStudent?.createdAt ?? now,
                kycStatus: sameNamedExistingStudent?.kycStatus ?? 'not_started',
                sourceImportId: importId,
                updatedAt: now,
            });
            put(db.collection('enrollments').doc(enrollmentId), {
                id: enrollmentId,
                studentId,
                studentName: row.studentName,
                courseId,
                courseTitle: row.course,
                mentorId,
                status: enrollmentStatusFromCourseStatus(row.courseStatus),
                onboardedAt: row.startDate,
                dueDate: row.dueDate,
                totalPaid: row.totalAmountPaid,
                commissionEarned: row.amountDue || Math.round(row.totalAmountPaid * row.commissionRate),
                cohort: row.cohort,
                sourceImportId: importId,
                updatedAt: now,
            });
            if (row.totalAmountPaid > 0) {
                put(db.collection('payments').doc(`imported_payment_${stableImportId([enrollmentId])}`), {
                    id: `imported_payment_${stableImportId([enrollmentId])}`,
                    enrollmentId,
                    studentId,
                    amount: row.totalAmountPaid,
                    date: row.dueDate || now,
                    status: 'success',
                    paystackReference: `sheet:${importId}:${row.rowNumber}`,
                    sourceImportId: importId,
                    updatedAt: now,
                });
            }
            if (row.amountDisbursed > 0)
                putPayout(put, `imported_payout_${stableImportId([mentorId, enrollmentId])}`, mentorId, row, importId, now, enrollmentId);
        });
    }
    else {
        parsed.aggregateRows.forEach((row) => {
            const { mentorId, courseId } = resolveMentorCourse(row);
            const summaryId = `imported_summary_${stableImportId([row.cohort, courseId, mentorId, row.startDate, row.dueDate])}`;
            put(db.collection('paymentTrackerSummaries').doc(summaryId), {
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
            if (row.amountDisbursed > 0)
                putPayout(put, `imported_payout_${stableImportId([mentorId, summaryId])}`, mentorId, row, importId, now, undefined, summaryId);
        });
    }
    const activeRows = parsed.mode === 'student' ? parsed.rows : parsed.aggregateRows;
    put(db.collection('imports').doc(importId), {
        id: importId,
        sourceType: 'google_sheets',
        mode: parsed.mode,
        sheetUrl,
        sheetName: sheetName || null,
        importedBy,
        importedAt: now,
        rowCount: activeRows.length,
        successCount: activeRows.length,
        errorCount: 0,
        summary: buildSummary(activeRows, parsed.mode),
    });
    return [...writes.values()];
}
async function buildDualImportWrites({ parsed, trackerRows: providedTrackerRows, studentRows, importId, importedBy, trackerSheetUrl, trackerSheetName, studentSheetUrl, studentSheetName, fileName, sourceType = 'dual_google_sheets', }) {
    const db = firestoreDb();
    const now = Date.now();
    const trackerRows = providedTrackerRows ?? (parsed?.mode === 'student' ? parsed.rows : parsed?.aggregateRows ?? []);
    const [usersSnap, coursesSnap, enrollmentsSnap] = await Promise.all([
        db.collection('users').get(),
        db.collection('courses').get(),
        db.collection('enrollments').get(),
    ]);
    const users = usersSnap.docs.map((snap) => snap.data());
    const courses = coursesSnap.docs.map((snap) => snap.data());
    const enrollments = enrollmentsSnap.docs.map((snap) => snap.data());
    const usersByEmail = new Map(users.map((user) => [String(user.email).toLowerCase(), user]));
    const mentorsByName = new Map(users.filter((user) => user.role === 'mentor').map((user) => [normalizeImportKey(String(user.name)), user]));
    const trackerByCourse = new Map(trackerRows.map((row) => [stableImportId([row.mentorName, canonicalCourseKey(row.course)]), row]));
    const writes = new Map();
    const put = (ref, data) => writes.set(ref.path, { ref, data });
    const resolveMentorCourse = (mentorName, courseName, trackerRow) => {
        const mentorEmail = (trackerRow?.mentorEmail || makePlaceholderEmail(mentorName, 'mentor')).toLowerCase();
        const existingMentor = usersByEmail.get(mentorEmail) || mentorsByName.get(normalizeImportKey(mentorName));
        const mentorId = String(existingMentor?.uid ?? `imported_mentor_${stableImportId([mentorEmail || mentorName])}`);
        const existingCourse = courses.find((course) => canonicalCourseKey(String(course.title)) === canonicalCourseKey(courseName) && course.mentorId === mentorId);
        const courseId = String(existingCourse?.id ?? `imported_course_${stableImportId([courseName, mentorId])}`);
        put(db.collection('users').doc(mentorId), {
            uid: mentorId,
            email: mentorEmail,
            name: mentorName,
            role: 'mentor',
            createdAt: existingMentor?.createdAt ?? now,
            kycStatus: existingMentor?.kycStatus ?? 'not_started',
            sourceImportId: importId,
            updatedAt: now,
        });
        put(db.collection('courses').doc(courseId), {
            id: courseId,
            title: courseName,
            description: `${trackerRow?.cohort ?? 'Student record'} imported from tracker records.`,
            mentorId,
            mentorName,
            price: trackerRow?.coursePrice ?? 0,
            commissionRate: trackerRow?.commissionRate ?? 0.37,
            createdAt: existingCourse?.createdAt ?? now,
            sourceImportId: importId,
            updatedAt: now,
        });
        return { mentorId, courseId };
    };
    trackerRows.forEach((row) => {
        const { mentorId, courseId } = resolveMentorCourse(row.mentorName, row.course, row);
        if ('numberOfStudents' in row) {
            const summaryId = `imported_summary_${stableImportId([row.cohort, courseId, mentorId, row.startDate, row.dueDate])}`;
            put(db.collection('paymentTrackerSummaries').doc(summaryId), {
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
            if (row.amountDisbursed > 0)
                putPayout(put, `imported_payout_${stableImportId([mentorId, summaryId])}`, mentorId, row, importId, now, undefined, summaryId);
        }
    });
    studentRows.forEach((row) => {
        const trackerRow = trackerByCourse.get(stableImportId([row.mentorName, canonicalCourseKey(row.course)]));
        const { mentorId, courseId } = resolveMentorCourse(row.mentorName, row.course, trackerRow);
        const resolvedStudentEmail = resolveStudentEmail(row);
        const existingStudent = usersByEmail.get(resolvedStudentEmail);
        const sameNamedExistingStudent = existingStudent && normalizeImportKey(existingStudent.name) === normalizeImportKey(row.name)
            ? existingStudent
            : undefined;
        const studentId = String(sameNamedExistingStudent?.uid ?? `imported_student_${stableImportId([row.name, resolvedStudentEmail, row.sourceSheet, row.rowNumber])}`);
        const existingEnrollment = enrollments.find((enrollment) => enrollment.studentId === studentId && enrollment.courseId === courseId);
        const enrollmentId = String(existingEnrollment?.id ?? `imported_enrollment_${stableImportId([studentId, courseId])}`);
        const commissionRate = trackerRow?.commissionRate ?? 0.37;
        const commissionEarned = trackerRow && 'numberOfStudents' in trackerRow && trackerRow.numberOfStudents > 0
            ? Math.round(trackerRow.amountDue / trackerRow.numberOfStudents)
            : Math.round(row.amountPaid * commissionRate);
        put(db.collection('users').doc(studentId), {
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
        put(db.collection('enrollments').doc(enrollmentId), {
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
            cohort: row.cohort ?? trackerRow?.cohort ?? 'Imported Tracker',
            sourceSheet: row.sourceSheet,
            sourceRowNumber: row.rowNumber,
            trackerRowNumber: row.trackerRowNumber ?? trackerRow?.rowNumber ?? null,
            amountDue: row.amountDue ?? trackerRow?.amountDue ?? 0,
            amountDisbursed: row.amountDisbursed ?? trackerRow?.amountDisbursed ?? 0,
            sourceImportId: importId,
            updatedAt: now,
        });
        if (row.amountPaid > 0) {
            const paymentId = `imported_payment_${stableImportId([enrollmentId])}`;
            put(db.collection('payments').doc(paymentId), {
                id: paymentId,
                enrollmentId,
                studentId,
                amount: row.amountPaid,
                date: row.onboardingDate || now,
                status: 'success',
                paystackReference: `student-sheet:${importId}:${row.rowNumber}`,
                sourceSheet: row.sourceSheet,
                sourceRowNumber: row.rowNumber,
                sourceImportId: importId,
                updatedAt: now,
            });
        }
        const studentRecordId = `imported_student_record_${stableImportId([studentId, courseId, mentorId])}`;
        put(db.collection('studentRecordImports').doc(studentRecordId), {
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
            trackerSourceSheet: row.trackerSourceSheet ?? trackerRow?.sourceSheet ?? null,
            trackerRowNumber: row.trackerRowNumber ?? trackerRow?.rowNumber ?? null,
            cohort: row.cohort ?? trackerRow?.cohort ?? 'Imported Tracker',
            corrections: buildCorrectionAudit(row, importedBy),
            importedAt: now,
            updatedAt: now,
        });
    });
    const importRecord = {
        id: importId,
        sourceType,
        mode: 'dual',
        importedBy,
        importedAt: now,
        rowCount: trackerRows.length + studentRows.length,
        successCount: trackerRows.length + studentRows.length,
        errorCount: 0,
        summary: buildDualSummary(trackerRows, studentRows),
    };
    if (fileName)
        importRecord.fileName = fileName;
    if (trackerSheetUrl)
        importRecord.trackerSheetUrl = trackerSheetUrl;
    if (trackerSheetName !== undefined)
        importRecord.trackerSheetName = trackerSheetName || null;
    if (studentSheetUrl)
        importRecord.studentSheetUrl = studentSheetUrl;
    if (studentSheetName !== undefined)
        importRecord.studentSheetName = studentSheetName || null;
    const corrections = studentRows
        .filter((row) => row.correctedFields?.length)
        .map((row) => ({
        sourceSheet: row.sourceSheet,
        sourceRowNumber: row.rowNumber,
        correctedFields: row.correctedFields,
    }));
    if (corrections.length)
        importRecord.corrections = corrections;
    put(db.collection('imports').doc(importId), importRecord);
    return [...writes.values()];
}
function putPayout(put, payoutId, mentorId, row, importId, now, enrollmentId, summaryId) {
    const status = payoutStatusFromPaymentStatus(row.paymentStatus);
    put(firestoreDb().collection('payouts').doc(payoutId), {
        id: payoutId,
        mentorId,
        amount: row.amountDisbursed,
        status,
        requestedAt: row.dueDate || now,
        processedAt: status === 'processed' ? row.dueDate || now : null,
        enrollmentId: enrollmentId ?? null,
        summaryId: summaryId ?? null,
        sourceImportId: importId,
        updatedAt: now,
    });
}
async function commitWritesInChunks(writes, diagnostics) {
    const db = firestoreDb();
    for (let i = 0; i < writes.length; i += 450) {
        const batch = db.batch();
        const chunk = writes.slice(i, i + 450);
        chunk.forEach((write) => batch.set(write.ref, sanitizeForFirestore(write.data), { merge: true }));
        try {
            await batch.commit();
        }
        catch (error) {
            throw new HttpsError('internal', `Firestore commit failed at chunk ${Math.floor(i / 450) + 1}: ${error instanceof Error ? error.message : 'Unknown commit error'}`, reviewedImportDetails('firestore-commit', diagnostics?.trackerRows ?? [], diagnostics?.studentRows ?? [], writes, {
                chunkIndex: Math.floor(i / 450),
                firstWritePath: chunk[0]?.ref.path ?? null,
                lastWritePath: chunk[chunk.length - 1]?.ref.path ?? null,
            }));
        }
    }
}
function sanitizeForFirestore(value) {
    if (!isRecord(value))
        return {};
    return removeUndefinedDeep(value);
}
function removeUndefinedDeep(value) {
    return Object.fromEntries(Object.entries(value)
        .filter(([, fieldValue]) => fieldValue !== undefined)
        .map(([key, fieldValue]) => [
        key,
        isRecord(fieldValue)
            ? removeUndefinedDeep(fieldValue)
            : Array.isArray(fieldValue)
                ? fieldValue.map((item) => (isRecord(item) ? removeUndefinedDeep(item) : item)).filter((item) => item !== undefined)
                : fieldValue,
    ]));
}
function summarizeWrites(writes) {
    const collectionCounts = (collectionName) => writes.filter((write) => write.ref.path.startsWith(`${collectionName}/`)).length;
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
function buildSummary(rows, mode) {
    return {
        mentors: new Set(rows.map((row) => row.mentorEmail || normalizeImportKey(row.mentorName))).size,
        students: mode === 'student' ? new Set(rows.map((row) => row.studentEmail)).size : 0,
        courses: new Set(rows.map((row) => stableImportId([row.course, row.mentorEmail || row.mentorName]))).size,
        enrollments: mode === 'student' ? new Set(rows.map((row) => stableImportId([row.studentEmail, row.course, row.mentorName]))).size : 0,
        summaries: mode === 'aggregate' ? new Set(rows.map((row) => stableImportId([row.cohort, row.course, row.mentorName, row.startDate, row.dueDate]))).size : 0,
        payments: mode === 'student' ? rows.filter((row) => row.totalAmountPaid > 0).length : 0,
        payouts: rows.filter((row) => row.amountDisbursed > 0).length,
        rows: rows.length,
    };
}
function buildDualSummary(trackerRows, studentRows) {
    const trackerKeys = new Set(trackerRows.map((row) => stableImportId([row.mentorName, canonicalCourseKey(row.course)])));
    const mentors = new Set([
        ...trackerRows.map((row) => normalizeImportKey(row.mentorName)),
        ...studentRows.map((row) => normalizeImportKey(row.mentorName)),
    ]);
    const courses = new Set([
        ...trackerRows.map((row) => stableImportId([row.mentorName, canonicalCourseKey(row.course)])),
        ...studentRows.map((row) => stableImportId([row.mentorName, canonicalCourseKey(row.course)])),
    ]);
    return {
        mentors: mentors.size,
        students: new Set(studentRows.map((row) => row.emailAddress)).size,
        courses: courses.size,
        enrollments: new Set(studentRows.map((row) => stableImportId([row.emailAddress, row.mentorName, canonicalCourseKey(row.course)]))).size,
        summaries: new Set(trackerRows
            .filter((row) => 'numberOfStudents' in row)
            .map((row) => stableImportId([row.cohort, row.course, row.mentorName, row.startDate, row.dueDate]))).size,
        payments: studentRows.filter((row) => row.amountPaid > 0).length,
        payouts: trackerRows.filter((row) => row.amountDisbursed > 0).length,
        rows: trackerRows.length + studentRows.length,
        unmatchedStudentRows: studentRows.filter((row) => !trackerKeys.has(stableImportId([row.mentorName, canonicalCourseKey(row.course)]))).length,
    };
}
function buildCorrectionAudit(row, correctedBy) {
    if (!row.correctedFields?.length || !row.originalStudentRow)
        return null;
    return {
        correctedFields: row.correctedFields,
        originalValues: Object.fromEntries(row.correctedFields.map((field) => [field, row.originalStudentRow?.[field] ?? null])),
        correctedValues: Object.fromEntries(row.correctedFields.map((field) => [field, row[field] ?? null])),
        correctedBy,
        correctedAt: Date.now(),
    };
}
function normalizeImportKey(value) {
    return value.trim().toLowerCase().replace(/₦/g, '').replace(/[^a-z0-9]+/g, '');
}
function stableImportId(parts) {
    return parts.map((part) => normalizeImportKey(String(part ?? ''))).filter(Boolean).join('_').slice(0, 140);
}
function canonicalCourseKey(course) {
    const key = normalizeImportKey(course);
    const aliases = {
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
function makePlaceholderEmail(name, role) {
    const slug = stableImportId([name]) || role;
    return `${slug}.${role}@imported.mentorflow.local`;
}
function resolveStudentEmail(row) {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.emailAddress))
        return row.emailAddress;
    return makePlaceholderEmail(`${row.name || 'student'}-${row.sourceSheet}-${row.rowNumber}`, 'student');
}
function buildStudentBiodata(existingBiodata, phoneNumber) {
    const biodata = removeUndefinedValues(isRecord(existingBiodata) ? existingBiodata : {});
    const cleanedPhoneNumber = phoneNumber?.trim();
    if (cleanedPhoneNumber)
        biodata.phoneNumber = cleanedPhoneNumber;
    return biodata;
}
function removeUndefinedValues(value) {
    return Object.fromEntries(Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined));
}
function isRecord(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}
function parseCurrency(value) {
    if (typeof value === 'number')
        return Number.isFinite(value) ? value : 0;
    if (typeof value !== 'string')
        return 0;
    const parsed = Number(value.replace(/[₦,\s]/g, '').trim());
    return Number.isFinite(parsed) ? parsed : 0;
}
function parseDate(value) {
    if (typeof value === 'number')
        return Number.isFinite(value) ? value : 0;
    const trimmed = String(value ?? '').trim();
    if (!trimmed || trimmed === '-')
        return 0;
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
        if (month >= 0)
            return new Date(Number(fullYear), month, Number(day)).getTime();
    }
    const parsed = Date.parse(trimmed);
    return Number.isFinite(parsed) ? parsed : 0;
}
function enrollmentStatusFromCourseStatus(status) {
    const key = normalizeImportKey(status);
    if (['done', 'completed', 'complete'].includes(key))
        return 'completed';
    if (['skipped', 'cancelled', 'canceled'].includes(key))
        return 'cancelled';
    if (['notstarted', 'pending'].includes(key))
        return 'pending';
    return 'active';
}
function payoutStatusFromPaymentStatus(status) {
    const key = normalizeImportKey(status);
    if (['completed', 'complete', 'paid', 'processed'].includes(key))
        return 'processed';
    if (['failed', 'declined', 'cancelled', 'canceled'].includes(key))
        return 'failed';
    return 'pending';
}
