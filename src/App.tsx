/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthProvider, useAuth } from './context/AuthContext';
import DashboardLayout from './components/layout/DashboardLayout';
import Login from './components/auth/Login';
import MentorDashboard from './components/dashboard/MentorDashboard';
import AdminDashboard from './components/dashboard/AdminDashboard';
import StudentDashboard from './components/dashboard/StudentDashboard';
import ChatModule from './components/messages/ChatModule';
import MentorsView from './components/mentors/MentorsView';
import StudentsView from './components/students/StudentsView';
import CoursesView from './components/courses/CoursesView';
import PaymentsView from './components/payments/PaymentsView';
import PayoutsView from './components/payouts/PayoutsView';
import NotificationsView from './components/notifications/NotificationsView';
import SettingsView from './components/settings/SettingsView';
import CommissionsView from './components/commissions/CommissionsView';
import SessionsView from './components/sessions/SessionsView';
import { Toaster } from '@/components/ui/sonner';
import { auth } from './lib/firebase';
import { signOut } from 'firebase/auth';

function AppContent() {
  const { user, profile, loading, isMentor, isAdmin, isStudent } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const renderContent = (activeTab: string, setActiveTab: (tab: string) => void) => {
    switch (activeTab) {
      case 'dashboard':
        if (isAdmin) return <AdminDashboard />;
        if (isMentor) return <MentorDashboard onCompleteKyc={() => setActiveTab('settings')} />;
        if (isStudent) return (
          <StudentDashboard 
            onStartOnboarding={() => setActiveTab('settings')} 
            onStartKyc={() => setActiveTab('settings')} 
          />
        );
        return null;
      case 'sessions':
        return <SessionsView />;
      case 'messages':
        return <ChatModule />;
      case 'mentors':
        return <MentorsView />;
      case 'students':
        return <StudentsView />;
      case 'courses':
        return <CoursesView />;
      case 'payments':
        return <PaymentsView />;
      case 'payouts':
        return <PayoutsView />;
      case 'settings':
        return <SettingsView />;
      case 'notifications':
        return <NotificationsView />;
      case 'commissions':
        if (isMentor) return <CommissionsView />;
        return null;
      default:
        return (
          <div className="p-12 text-center bg-card rounded-xl border border-dashed">
            <h3 className="text-lg font-semibold">Section Under Construction</h3>
            <p className="text-muted-foreground">The {activeTab} module is coming soon.</p>
          </div>
        );
    }
  };

  return (
    <DashboardLayout 
      userRole={isAdmin ? 'admin' : (profile?.role || 'student')} 
      userName={profile?.name || 'User'} 
      userEmail={profile?.email || ''}
      onLogout={() => signOut(auth)}
    >
      {(activeTab: string, setActiveTab: (tab: string) => void) => (
        <div className="space-y-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">Welcome back, {profile?.name}!</h1>
              <div className="px-2 py-1 rounded-full bg-green-50 text-green-700 border border-green-200 text-[10px] font-bold uppercase tracking-wider">
                Abuja, NG
              </div>
            </div>
            <p className="text-muted-foreground">
              {isAdmin ? "Oversee platform performance, manage mentors, and process payouts." :
               isMentor ? "Manage your courses, students, and track your 37% commission earnings." : 
               "Track your learning progress and connect with your mentors."}
            </p>
          </div>
          
          {renderContent(activeTab, setActiveTab)}
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




