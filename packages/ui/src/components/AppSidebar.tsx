import { useEffect } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  Users,
  FolderKanban,
  ListTodo,
  Archive,
} from "lucide-react";
import { useCompanyStore } from "../stores/company-store";
import { useProjectStore } from "../stores/project-store";
import { useTaskStore } from "../stores/task-store";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/companies", label: "Companies", icon: Building2 },
  { to: "/employees", label: "Employees", icon: Users },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/tasks", label: "Tasks", icon: ListTodo },
  { to: "/cabinet", label: "Cabinet", icon: Archive },
];

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const selectedSlug = useCompanyStore((s) => s.selectedSlug);

  useEffect(() => {
    if (selectedSlug) {
      useProjectStore.getState().load(selectedSlug);
      useTaskStore.getState().load(selectedSlug);
    }
  }, [selectedSlug]);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <NavLink to="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
                  F
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">Fold AI</span>
                  {selectedSlug && (
                    <span className="text-xs text-muted-foreground truncate">{selectedSlug}</span>
                  )}
                </div>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <NavLink to={item.to} end={item.end}>
                    {({ isActive }) => (
                      <SidebarMenuButton isActive={isActive} tooltip={item.label}>
                        <item.icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    )}
                  </NavLink>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <p className="px-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          Virtual company on OpenCode
        </p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}