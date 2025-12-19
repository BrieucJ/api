import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sun, Moon } from "lucide-react";

export default function DashboardLayout() {
  // Initialize state directly from prefers-color-scheme
  const prefersDark =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  const [theme, setTheme] = useState<"light" | "dark">(
    prefersDark ? "dark" : "light"
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <header className="flex items-center justify-between p-4 bg-gray-800 dark:bg-gray-800 text-white font-bold">
        <span>Console</span>
        <Button size="sm" variant="outline" onClick={toggleTheme}>
          {theme === "dark" ? (
            <Sun className="w-4 h-4" />
          ) : (
            <Moon className="w-4 h-4" />
          )}
        </Button>
      </header>

      <main className="flex-1 overflow-auto p-4">
        <Outlet />
      </main>
    </div>
  );
}
