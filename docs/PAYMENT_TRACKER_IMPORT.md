# Mentor Payment Tracker Import

MentorFlow imports payment tracker files as student-level enrollment records. Each row should represent one student's enrollment/payment for one course. Aggregate rows such as "number of students: 7" cannot create student dashboards unless the file also includes the individual student details.

## Required Columns

| Column | Description | Example |
| --- | --- | --- |
| `cohort` | Cohort or payment batch label | `Cohort March to June 2025` |
| `course` | Course name | `Basic Frontend` |
| `mentorName` | Mentor full name | `Abdulgafar Mohammad` |
| `studentName` | Student full name | `Jane Smith` |
| `studentEmail` | Student email address | `jane@example.com` |
| `courseStatus` | Course progress status | `Done`, `In progress`, `Skipped` |
| `startDate` | Course start date | `17/03/2025` |
| `dueDate` | Course due date | `11/06/2025` |
| `totalAmountPaid` | Amount paid by the student | `540000` |
| `amountDue` | Mentor commission due | `199800` |
| `amountDisbursed` | Amount already paid to the mentor | `199800` |
| `paymentStatus` | Mentor payout/payment status | `Completed`, `Pending` |

## Optional Columns

| Column | Description |
| --- | --- |
| `mentorEmail` | Mentor email address. If omitted, MentorFlow creates a pending mentor profile using a generated placeholder email. |
| `coursePrice` | Course list price. If omitted, `totalAmountPaid` is used. |
| `commissionRate` | Mentor commission rate. Defaults to `0.37`. |

## Import Behavior

- Mentors are matched by `mentorEmail` when present, otherwise by normalized `mentorName`.
- Students are matched by `studentEmail`.
- Courses are matched by normalized `course` + mentor.
- Enrollments are matched by student + course.
- Payments are created/updated from `totalAmountPaid`.
- Payout records are created/updated from `amountDisbursed` and `paymentStatus`.
- An `imports` audit record is stored for every confirmed upload or Google Sheets sync.

## Google Sheets Sync

For Google Sheets sync, publish the sheet or make it accessible by link, then provide the sheet URL in the admin import panel. The sync uses the same column names and validation rules as Excel/CSV upload.
