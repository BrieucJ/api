import { useEffect, useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Sun,
  Moon,
  LayoutDashboard,
  FileText,
  Database,
  Activity,
} from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Logs", href: "/dashboard/logs", icon: FileText },
];

export default function DashboardLayout() {
  const location = useLocation();
  const initLogsSSE = useAppStore((state) => state.initLogsSSE);
  const initInfoPolling = useAppStore((state) => state.initInfoPolling);
  const initHealthPolling = useAppStore((state) => state.initHealthPolling);
  const apiInfo = useAppStore((state) => state.apiInfo);
  const healthStatus = useAppStore((state) => state.healthStatus);

  // Initialize state directly from prefers-color-scheme
  const prefersDark =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  const [theme, setTheme] = useState<"light" | "dark">(
    prefersDark ? "dark" : "light"
  );

  // Initialize SSE on mount - this ensures logs are available on all pages
  useEffect(() => {
    initLogsSSE();
  }, [initLogsSSE]);

  // Initialize info polling on mount - polls every 5 seconds
  useEffect(() => {
    const cleanup = initInfoPolling();
    return cleanup;
  }, [initInfoPolling]);

  // Initialize health polling on mount - polls every 5 seconds
  useEffect(() => {
    const cleanup = initHealthPolling();
    return cleanup;
  }, [initHealthPolling]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  // Generate breadcrumbs from pathname
  const pathSegments = location.pathname.split("/").filter(Boolean);
  const breadcrumbs = pathSegments.map((segment, index) => {
    const path = "/" + pathSegments.slice(0, index + 1).join("/");
    const name = segment.charAt(0).toUpperCase() + segment.slice(1);
    return { name, path };
  });

  const isActive = (href: string) => {
    // Exact match
    if (location.pathname === href) return true;

    // Check if any other nav item is a better match (more specific)
    const currentPath = location.pathname;
    const hrefPath = href;

    // If current path starts with this href, check if there's a more specific match
    if (currentPath.startsWith(hrefPath + "/")) {
      // Check if any other navigation item is a more specific match
      const moreSpecificMatch = navigation.some(
        (item) =>
          item.href !== href &&
          item.href.startsWith(hrefPath + "/") &&
          currentPath.startsWith(item.href)
      );
      // Only active if no more specific match exists
      return !moreSpecificMatch;
    }

    return false;
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen bg-background transition-colors">
        {/* Header - Full Width */}
        <header className="fixed top-0 left-0 right-0 z-10 w-full flex items-center justify-between gap-4 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 px-4 py-3 h-14">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <span className="font-semibold">
                {apiInfo?.name || "Console"}
              </span>
              {apiInfo && (
                <>
                  <Badge variant="outline" className="text-xs">
                    v{apiInfo.version}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {apiInfo.environment}
                  </Badge>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {apiInfo && (
              <>
                <Badge
                  variant={
                    healthStatus?.status === "healthy" ? "success" : "error"
                  }
                  className="text-xs"
                >
                  <Activity className="h-3 w-3 mr-1" />
                  {healthStatus?.status === "healthy"
                    ? "API Healthy"
                    : "API Unhealthy"}
                </Badge>
                <Badge
                  variant={apiInfo.database.connected ? "success" : "error"}
                  className="text-xs"
                >
                  <Database className="h-3 w-3 mr-1" />
                  {apiInfo.database.connected
                    ? "DB Connected"
                    : "DB Disconnected"}
                </Badge>
                <div className="hidden sm:flex flex-col text-xs text-muted-foreground">
                  <span>Uptime: {apiInfo.uptime.formatted}</span>
                  <span>
                    Updated: {new Date(apiInfo.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </>
            )}
            <Button size="sm" variant="outline" onClick={toggleTheme}>
              {theme === "dark" ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </Button>
          </div>
        </header>

        <Sidebar collapsible="icon" className="top-14">
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Navigation</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navigation.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton asChild isActive={active}>
                          <Link to={item.href}>
                            <Icon />
                            <span>{item.name}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <SidebarInset className="mt-14">
          <main
            className={cn(
              "flex-1 flex flex-col min-w-0",
              location.pathname === "/dashboard/logs"
                ? "overflow-hidden p-4"
                : "overflow-auto p-4"
            )}
          >
            {/* Breadcrumbs at top of page content */}
            <div className="mb-4 shrink-0">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to="/dashboard">Dashboard</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  {breadcrumbs.slice(1).map((crumb, index) => {
                    const isLast = index === breadcrumbs.slice(1).length - 1;
                    return (
                      <div key={crumb.path} className="flex items-center">
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                          {isLast ? (
                            <BreadcrumbPage>{crumb.name}</BreadcrumbPage>
                          ) : (
                            <BreadcrumbLink asChild>
                              <Link to={crumb.path}>{crumb.name}</Link>
                            </BreadcrumbLink>
                          )}
                        </BreadcrumbItem>
                      </div>
                    );
                  })}
                </BreadcrumbList>
              </Breadcrumb>
            </div>

            <div
              className={cn(
                location.pathname === "/dashboard/logs"
                  ? "flex-1 min-h-0 min-w-0"
                  : ""
              )}
            >
              <Outlet />
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
