export type UserRole = 'admin' | 'mentor' | 'student';
export type KYCStatus = 'not_started' | 'pending' | 'verified' | 'rejected';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  createdAt: number;
  kycStatus?: KYCStatus;
  kycData?: MentorKYC;
  onboardingCompleted?: boolean;
  onboardingStep?: number;
  biodata?: Biodata;
}

export interface Biodata {
  phoneNumber?: string;
  address?: string;
  dateOfBirth?: string;
  gender?: string;
  stateOfOrigin?: string;
  bio?: string;
}

export interface MentorKYC {
  idType: string;
  idNumber: string;
  idImageUrl?: string;
  address: string;
  phoneNumber: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  submittedAt: number;
  verifiedAt?: number;
  rejectionReason?: string;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  mentorId: string;
  mentorName: string;
  price: number;
  commissionRate: number; // e.g., 0.37
}

export interface Enrollment {
  id: string;
  studentId: string;
  studentName: string;
  courseId: string;
  courseTitle: string;
  mentorId: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  onboardedAt: number;
  totalPaid: number;
  commissionEarned: number;
  cohort?: string;
  amountDue?: number;
  amountDisbursed?: number;
  sourceImportId?: string;
  sourceSheet?: string;
  sourceRowNumber?: number;
  trackerRowNumber?: number | null;
  updatedAt?: number;
}

export interface Payment {
  id: string;
  enrollmentId: string;
  studentId: string;
  amount: number;
  date: number;
  status: 'success' | 'failed';
  receiptUrl?: string;
}

export interface Payout {
  id: string;
  mentorId: string;
  amount: number;
  status: 'pending' | 'processed' | 'failed';
  requestedAt: number;
  processedAt?: number;
  receiptUrl?: string;
}

export interface PaymentTrackerSummary {
  id: string;
  cohort: string;
  courseId: string;
  courseTitle: string;
  mentorId: string;
  mentorName: string;
  courseStatus: string;
  numberOfStudents: number;
  startDate: number;
  dueDate: number;
  totalAmountPaid: number;
  amountDue: number;
  amountDisbursed: number;
  paymentStatus: string;
  commissionRate: number;
  sourceImportId: string;
  importedAt: number;
  updatedAt?: number;
}

export interface StudentRecordImportMetadata {
  id: string;
  sourceImportId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  phoneNumber?: string;
  courseId: string;
  courseTitle: string;
  mentorId: string;
  mentorName: string;
  onboardingDate: number;
  courseStatus: string;
  amountPaid: number;
  paymentStatus: string;
  sourceSheet?: string;
  sourceRowNumber?: number;
  trackerSourceSheet?: string | null;
  trackerRowNumber?: number | null;
  cohort?: string;
  importedAt: number;
  updatedAt?: number;
}

export interface Session {
  id: string;
  courseId: string;
  studentId: string;
  mentorId: string;
  date: number;
  status: 'scheduled' | 'completed' | 'cancelled';
  feedback?: string;
  rating?: number;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  timestamp: number;
}

export interface Chat {
  id: string;
  participants: string[]; // [uid1, uid2]
  lastMessage?: string;
  lastTimestamp?: number;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'session' | 'payment' | 'payout' | 'message';
  read: boolean;
  timestamp: number;
}
