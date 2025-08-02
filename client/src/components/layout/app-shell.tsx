import React, { ReactNode, useState } from &apos;react&apos;;
import { Sidebar } from &apos;./sidebar&apos;;
import { Header } from &apos;./header&apos;;
import { useAuth } from &apos;@/providers/auth-provider&apos;;
import { useMobile } from &apos;@/hooks/use-mobile&apos;;

interface AppShellProps {
  _children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { user } = useAuth();
  const isMobile = useMobile();
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);

  const toggleSidebar = () => {
    setSidebarOpen(prev => !prev);
  };

  if (!user) {
    return <>{children}</>;
  }

  return (
    <div className=&quot;flex h-screen overflow-hidden bg-neutral-100&quot;>
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        role={user.role}
      />

      <div className=&quot;flex flex-col flex-1 overflow-hidden&quot;>
        <Header
          user={user}
          onMenuClick={toggleSidebar}
          isSidebarOpen={sidebarOpen}
        />

        <main className=&quot;flex-1 overflow-y-auto bg-neutral-50 p-6&quot;>
          <div className=&quot;max-w-7xl mx-auto&quot;>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
