import {
  Mic,
  Speech,
  AlarmClock,
  Code2,
  MessageSquare,
  Home,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

// Menu items.
const items = [
  {
    title: "home",
    url: "/",
    icon: Home,
  },
  {
    title: "recorder",
    url: "/recorder",
    icon: Mic,
  },
  {
    title: "speech",
    url: "/speech",
    icon: Speech,
  },
  {
    title: "debounce",
    url: "/debounce",
    icon: AlarmClock,
  },
  {
    title: "editor",
    url: "/code",
    icon: Code2,
  },
  {
    title: "chat",
    url: "/chat",
    icon: MessageSquare,
  },
];

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Application</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <a
                      href={item.url}
                      className="inline-flex items-center justify-start h-12"
                    >
                      <div className="flex items-center justify-center space-x-2">
                        <item.icon />
                        <span className="text-xl">{item.title}</span>
                      </div>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
