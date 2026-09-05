import { HashRouter, Routes, Route, Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './components/AppSidebar';
import { Separator } from '@/components/ui/separator';
import { useChatStore } from './stores/chat-store';
import { Dashboard } from './pages/Dashboard';
import { Companies } from './pages/Companies';
import { Employees } from './pages/Employees';
import { EmployeeProfile } from './pages/EmployeeProfile';
import { Projects } from './pages/Projects';
import { ProjectDetail } from './pages/ProjectDetail';
import { Tasks } from './pages/Tasks';
import { TaskDetail } from './pages/TaskDetail';
import { Cabinet } from './pages/Cabinet';

function AppLayout() {
  // Connect the WebSocket for chat streaming once on app start
  useEffect(() => {
    const chat = useChatStore.getState();
    if (!chat.connected) {
      chat.connectWs();
    }
  }, []);

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <AppSidebar />
      <SidebarInset className="overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <span className="text-sm text-muted-foreground">Fold AI</span>
        </header>
        {/* Pages scroll here; full-height pages (chat) fit exactly with no page scroll */}
        <div className="flex flex-1 flex-col gap-4 p-6 min-h-0 overflow-y-auto">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="companies" element={<Companies />} />
          <Route path="employees" element={<Employees />} />
          <Route path="employees/:id" element={<EmployeeProfile />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="tasks/:id" element={<TaskDetail />} />
          <Route path="cabinet" element={<Cabinet />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}