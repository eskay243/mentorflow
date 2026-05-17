import React from 'react';
import { motion } from 'motion/react';
import { LogOut, Menu, X, ChevronRight, Bell, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { navForRole, type UserRole } from '@/config/navigation';

interface SidebarItemProps {
  icon: React.ElementType;
  label: string;
  isActive?: boolean;
  onClick: () => void;
}

const SidebarItem = ({ icon: Icon, label, isActive, onClick }: SidebarItemProps) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'flex items-center w-full gap-3 px-4 py-3 text-sm font-medium transition-colors rounded-lg group',
      isActive
        ? 'bg-primary text-primary-foreground'
        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
    )}
  >
    <Icon
      className={cn(
        'w-5 h-5',
        isActive
          ? 'text-primary-foreground'
          : 'text-muted-foreground group-hover:text-accent-foreground',
      )}
    />
    <span>{label}</span>
    {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
  </button>
);

interface DashboardLayoutProps {
  children:
    | ((activeTab: string, setActiveTab: (tab: string) => void) => React.ReactNode)
    | React.ReactNode;
  userRole: UserRole;
  userName: string;
  userEmail: string;
  onLogout: () => void;
}

export default function DashboardLayout({
  children,
  userRole,
  userName,
  userEmail,
  onLogout,
}: DashboardLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState('dashboard');

  const navItems = navForRole(userRole);

  const roleBadgeClass = {
    admin: 'bg-red-50 text-red-700 border-red-200',
    mentor: 'bg-blue-50 text-blue-700 border-blue-200',
    student: 'bg-green-50 text-green-700 border-green-200',
  }[userRole];

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 0, opacity: isSidebarOpen ? 1 : 0 }}
        className={cn(
          'relative flex flex-col h-full border-r bg-card transition-all duration-300 ease-in-out z-30',
          !isSidebarOpen && 'pointer-events-none',
        )}
      >
        <div className="flex items-center h-16 px-6 border-b">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">
              M
            </div>
            <span>MentorFlow</span>
          </div>
        </div>

        <ScrollArea className="flex-1 px-4 py-6">
          <div className="space-y-1">
            {navItems.map((item) => (
              <div key={item.id}>
                <SidebarItem
                  icon={item.icon}
                  label={item.label}
                  isActive={activeTab === item.id}
                  onClick={() => setActiveTab(item.id)}
                />
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="p-4 border-t">
          <div className="flex items-center gap-3 px-2 py-3 mb-2">
            <Avatar>
              <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userName}`} />
              <AvatarFallback>{userName.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold truncate">{userName}</span>
                <Badge
                  variant="outline"
                  className={cn('text-[10px] px-1.5 py-0 h-4 uppercase font-bold', roleBadgeClass)}
                >
                  {userRole}
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground truncate">{userEmail}</span>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
            onClick={onLogout}
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </Button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between h-16 px-6 border-b bg-card/50 backdrop-blur-md z-20">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
              {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
            <h2 className="text-lg font-semibold capitalize">
              {navItems.find((n) => n.id === activeTab)?.label ?? activeTab}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setActiveTab('settings')}
              aria-label="Open settings"
            >
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-muted/30 p-6">
          <div className="max-w-7xl mx-auto">
            {typeof children === 'function' ? children(activeTab, setActiveTab) : children}
          </div>
        </main>
      </div>
    </div>
  );
}
