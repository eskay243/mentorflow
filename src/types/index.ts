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
}

export interface Payment {
  id: string;
  enrollmentId: string;
  studentId: string;
  amount: number;
  date: number;
  status: 'success' | 'failed';
  receiptUrl?: string;
  paystackReference?: string;
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
