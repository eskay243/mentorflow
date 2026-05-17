import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import DashboardLayout from './components/layout/DashboardLayout';
import Login from './components/auth/Login';

// Dashboards
import MentorDashboard from './components/dashboard/MentorDashboard';
import AdminDashboard from './components/dashboard/AdminDashboard';
import StudentDashboard from './components/dashboard/StudentDashboard';

// Shared
import ChatModule from './components/messages/ChatModule';
import CoursesView from './components/courses/CoursesView';
import PaymentsView from './components/payments/PaymentsView';
import PayoutsView from './components/payouts/PayoutsView';
import NotificationsView from './components/notifications/NotificationsView';
import SettingsView from './components/settings/SettingsView';
import SessionsView from './components/sessions/SessionsView';

// Admin-specific
import AdminMentorsView from './components/admin/AdminMentorsView';
import AdminStudentsView from './components/admin/AdminStudentsView';
import AdminAssignmentsView from './components/admin/AdminAssignmentsView';

// Mentor-specific
import MentorStudentsView from './components/students/MentorStudentsView';
import CommissionsView from './components/commissions/CommissionsView';

// Student-specific
import StudentMentorsView from './components/mentors/StudentMentorsView';

import { Toaster } from '@/components/ui/sonner';
import { auth } from './lib/firebase';
import { signOut } from 'firebase/auth';

// ── Role-specific Access Denied fallback ───────────────────────────────────────
function AccessDenied({ tab }: { tab: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="text-4xl mb-4">🚫</div>
      <h3 className="text-xl font-semibold">Access Denied</h3>
      <p className="text-muted-foreground mt-2 max-w-sm">
        The <strong>{tab}</strong> section is not available for your role.
      </p>
    </div>
  );
}

// ── Route registries per role ──────────────────────────────────────────────────
function renderAdminTab(
  tab: string,
  setTab: (t: string) => void,
): React.ReactElement {
  switch (tab) {
    case 'dashboard':     return <AdminDashboard />;
    case 'mentors':       return <AdminMentorsView />;
    case 'students':      return <AdminStudentsView />;
    case 'assignments':   return <AdminAssignmentsView />;
    case 'courses':       return <CoursesView />;
    case 'payments':      return <PaymentsView />;
    case 'payouts':       return <PayoutsView />;
    case 'messages':      return <ChatModule />;
    case 'notifications': return <NotificationsView />;
    case 'settings':      return <SettingsView />;
    default:              return <AccessDenied tab={tab} />;
  }
}

function renderMentorTab(
  tab: string,
  setTab: (t: string) => void,
): React.ReactElement {
  switch (tab) {
    case 'dashboard':
      return (
        <MentorDashboard onCompleteKyc={() => setTab('settings')} />
      );
    case 'students':      return <MentorStudentsView />;
    case 'courses':       return <CoursesView />;
    case 'sessions':      return <SessionsView />;
    case 'commissions':   return <CommissionsView />;
    case 'payouts':       return <PayoutsView />;
    case 'messages':      return <ChatModule />;
    case 'notifications': return <NotificationsView />;
    case 'settings':      return <SettingsView />;
    default:              return <AccessDenied tab={tab} />;
  }
}

function renderStudentTab(
  tab: string,
  setTab: (t: string) => void,
): React.ReactElement {
  switch (tab) {
    case 'dashboard':
      return (
        <StudentDashboard
          onStartOnboarding={() => setTab('settings')}
          onStartKyc={() => setTab('settings')}
        />
      );
    case 'courses':       return <CoursesView />;
    case 'mentors':       return <StudentMentorsView />;
    case 'sessions':      return <SessionsView />;
    case 'payments':      return <PaymentsView />;
    case 'messages':      return <ChatModule />;
    case 'notifications': return <NotificationsView />;
    case 'settings':      return <SettingsView />;
    default:              return <AccessDenied tab={tab} />;
  }
}

// ── App ────────────────────────────────────────────────────────────────────────
function AppContent() {
  const { user, profile, loading, isMentor, isAdmin, isStudent } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return <Login />;

  const userRole = isAdmin ? 'admin' : isMentor ? 'mentor' : 'student';

  const renderTab = (tab: string, setTab: (t: string) => void) => {
    if (isAdmin)   return renderAdminTab(tab, setTab);
    if (isMentor)  return renderMentorTab(tab, setTab);
    if (isStudent) return renderStudentTab(tab, setTab);
    return <AccessDenied tab={tab} />;
  };

  const roleTagline = isAdmin
    ? 'Oversee platform performance, manage mentors, and process payouts.'
    : isMentor
    ? 'Manage your courses, students, and track your 37% commission earnings.'
    : 'Track your learning progress and connect with your mentors.';

  return (
    <DashboardLayout
      userRole={userRole}
      userName={profile?.name ?? 'User'}
      userEmail={profile?.email ?? ''}
      onLogout={() => signOut(auth)}
    >
      {(activeTab, setActiveTab) => (
        <div className="space-y-6">
          {activeTab === 'dashboard' && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold tracking-tight">
                  Welcome back, {profile?.name}!
                </h1>
                <span className="px-2 py-1 rounded-full bg-green-50 text-green-700 border border-green-200 text-[10px] font-bold uppercase tracking-wider">
                  Abuja, NG
                </span>
              </div>
              <p className="text-muted-foreground">{roleTagline}</p>
            </div>
          )}
          {renderTab(activeTab, setActiveTab)}
        </div>
      )}
    </DashboardLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
      <Toaster />
    </AuthProvider>
  );
}
