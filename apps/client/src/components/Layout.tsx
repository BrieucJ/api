import { useEffect, useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Sun,
  Moon,
  LayoutDashboard,
  FileText,
  Database,
  Activity,
  RotateCcw,
  Cpu,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  LogOut,
  User,
} from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { useAuthStore } from "@/store/authStore";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  { name: "Metrics", href: "/dashboard/metrics", icon: Activity },
  { name: "Replay", href: "/dashboard/replay", icon: RotateCcw },
  { name: "Worker", href: "/dashboard/worker", icon: Cpu },
];

type StatusType = "healthy" | "unhealthy" | "degraded" | "unknown";

function getStatusColor(status: StatusType): string {
  switch (status) {
    case "healthy":
      return "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20";
    case "degraded":
      return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20";
    case "unhealthy":
      return "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20";
    case "unknown":
      return "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20";
    default:
      return "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20";
  }
}

function getStatusIcon(status: StatusType, size: string = "h-3 w-3") {
  const Icon = (() => {
    switch (status) {
      case "healthy":
        return CheckCircle2;
      case "degraded":
        return AlertTriangle;
      case "unhealthy":
        return XCircle;
      case "unknown":
      default:
        return HelpCircle;
    }
  })();
  return <Icon className={size} />;
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

function formatHeartbeatAge(seconds: number | undefined): string {
  if (seconds === undefined) return "unknown";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

export default function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const initLogsPolling = useAppStore((state) => state.initLogsPolling);
  const initInfoPolling = useAppStore((state) => state.initInfoPolling);
  const initHealthPolling = useAppStore((state) => state.initHealthPolling);
  const apiInfo = useAppStore((state) => state.apiInfo);
  const healthStatus = useAppStore((state) => state.healthStatus);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  // Initialize state directly from prefers-color-scheme
  const prefersDark =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  const [theme, setTheme] = useState<"light" | "dark">(
    prefersDark ? "dark" : "light"
  );

  // Initialize logs polling on mount - this ensures logs are available on all pages
  useEffect(() => {
    const cleanup = initLogsPolling();
    return cleanup;
  }, [initLogsPolling]);

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

  const handleLogout = () => {
    logout();
    navigate("/login");
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
      {/* Header - Full Width */}
      <header className="fixed top-0 left-0 right-0 z-10 w-full flex items-center justify-between gap-2 md:gap-4 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 px-2 md:px-4 py-2 md:py-3 h-12 md:h-14">
        <div className="flex items-center gap-2 md:gap-4 min-w-0">
          <SidebarTrigger />
          <div className="flex items-center gap-1 md:gap-2 min-w-0">
            <span className="font-semibold text-sm md:text-base truncate">
              {apiInfo?.name}
            </span>
            {apiInfo && (
              <>
                <Badge
                  variant="outline"
                  className="text-[10px] md:text-xs hidden sm:inline-flex px-1 md:px-2"
                >
                  v{apiInfo.version}
                </Badge>
                <Badge
                  variant="outline"
                  className="text-[10px] md:text-xs hidden md:inline-flex px-1 md:px-2"
                >
                  {apiInfo.environment}
                </Badge>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 md:gap-2">
          {healthStatus && (
            <>
              {/* Overall System Health */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    className={`${getStatusColor(
                      healthStatus.status as StatusType
                    )} text-[10px] md:text-xs px-1.5 md:px-2 gap-1 cursor-help`}
                  >
                    {getStatusIcon(healthStatus.status as StatusType)}
                    <span className="hidden sm:inline capitalize">
                      {healthStatus.status}
                    </span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <div className="space-y-1">
                    <div className="font-semibold">Overall System Health</div>
                    <div className="text-xs">
                      Status:{" "}
                      <span className="capitalize">{healthStatus.status}</span>
                    </div>
                    <div className="text-xs">
                      Uptime: {formatUptime(healthStatus.uptime || 0)}
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>

              {/* Database Health */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    className={`${getStatusColor(
                      (healthStatus.database?.status || "unknown") as StatusType
                    )} text-[10px] md:text-xs px-1.5 md:px-2 gap-1 cursor-help`}
                  >
                    <Database className="h-3 w-3" />
                    <span className="hidden md:inline">DB</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <div className="space-y-1">
                    <div className="font-semibold">Database Health</div>
                    <div className="text-xs">
                      Status:{" "}
                      <span className="capitalize">
                        {healthStatus.database?.status || "unknown"}
                      </span>
                    </div>
                    <div className="text-xs">
                      Response Time:{" "}
                      {healthStatus.database?.responseTime !== undefined
                        ? `${healthStatus.database.responseTime}ms`
                        : "N/A"}
                    </div>
                    <div className="text-xs">
                      Connection:{" "}
                      {healthStatus.database?.connected
                        ? "Connected"
                        : "Disconnected"}
                    </div>
                    {healthStatus.database?.error && (
                      <div className="text-xs text-red-400 mt-1">
                        {healthStatus.database.error}
                      </div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>

              {/* Worker Health */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    className={`${getStatusColor(
                      (healthStatus.worker?.status || "unknown") as StatusType
                    )} text-[10px] md:text-xs px-1.5 md:px-2 gap-1 cursor-help`}
                  >
                    <Cpu className="h-3 w-3" />
                    <span className="hidden md:inline">Worker</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <div className="space-y-1">
                    <div className="font-semibold">Worker Health</div>
                    <div className="text-xs">
                      Status:{" "}
                      <span className="capitalize">
                        {healthStatus.worker?.status || "unknown"}
                      </span>
                    </div>
                    {healthStatus.worker?.workerMode && (
                      <>
                        <div className="text-xs">
                          Mode:{" "}
                          <span className="capitalize">
                            {healthStatus.worker.workerMode}
                          </span>
                        </div>
                        <div className="text-xs">
                          Last Heartbeat:{" "}
                          {formatHeartbeatAge(healthStatus.worker.heartbeatAge)}
                        </div>
                        {healthStatus.worker.queueSize !== undefined && (
                          <div className="text-xs">
                            Queue: {healthStatus.worker.queueSize} | Processing:{" "}
                            {healthStatus.worker.processingCount || 0}
                          </div>
                        )}
                      </>
                    )}
                    {healthStatus.worker?.error && (
                      <div className="text-xs text-yellow-400 mt-1">
                        {healthStatus.worker.error}
                      </div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </>
          )}
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0 md:h-9 md:w-9"
                >
                  <User className="h-3 w-3 md:h-4 md:w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">Account</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={toggleTheme}>
                  {theme === "dark" ? (
                    <Sun className="mr-2 h-4 w-4" />
                  ) : (
                    <Moon className="mr-2 h-4 w-4" />
                  )}
                  <span>Toggle theme</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} variant="destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      <Sidebar collapsible="icon" className="top-12 md:top-14">
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

      <SidebarInset className="mt-12 md:mt-14">
        <div
          className={cn(
            "flex-1 flex flex-col min-w-0 w-full h-full",
            location.pathname === "/dashboard/logs"
              ? "overflow-hidden p-2 md:p-4"
              : "overflow-auto p-2 md:p-4"
          )}
        >
          {/* Breadcrumbs at top of page content */}
          <div className="mb-2 md:mb-4 shrink-0">
            <Breadcrumb>
              <BreadcrumbList className="text-xs md:text-sm">
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
              "w-full min-w-0",
              location.pathname === "/dashboard/logs" ? "flex-1 min-h-0" : ""
            )}
          >
            <Outlet />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
