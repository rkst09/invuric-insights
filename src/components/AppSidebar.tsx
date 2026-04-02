import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FolderPlus,
  Clock,
  Settings,
  Menu,
  X,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/" },
  { label: "New Project", icon: FolderPlus, path: "/document-generation" },
  { label: "History", icon: Clock, path: "/history" },
  { label: "Settings", icon: Settings, path: "/settings" },
];

const AppSidebar = ({ activeItem = "Dashboard" }: { activeItem?: string }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      {/* Mobile trigger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-card border border-border lg:hidden"
      >
        <Menu className="w-5 h-5 text-foreground" />
      </button>

      {/* Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-screen w-60 flex flex-col border-r border-border bg-background
          transition-transform duration-200
          lg:relative lg:translate-x-0
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Close on mobile */}
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 p-1 lg:hidden"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>

        {/* Logo */}
        <div className="px-6 pt-8 pb-8">
          <h1 className="text-xl font-light tracking-tight text-foreground">
            Invuric
          </h1>
          <p className="font-mono-label text-xs text-primary mt-0.5 tracking-wider">
            BA Agent
          </p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={() => { navigate(item.path); setMobileOpen(false); }}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200
                ${
                  item.label === activeItem
                    ? "bg-secondary border-l-2 border-l-primary text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }
              `}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* User */}
        <div className="px-4 py-6 border-t border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-medium text-foreground">
              JD
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground truncate">Jane Doe</p>
              <p className="font-mono-label text-[10px] text-primary tracking-wider">
                PRO PLAN
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default AppSidebar;
