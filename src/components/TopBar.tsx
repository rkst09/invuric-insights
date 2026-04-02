import { Search, Bell } from "lucide-react";

interface TopBarProps {
  title: string;
}

const TopBar = ({ title }: TopBarProps) => {
  return (
    <header className="h-16 flex items-center justify-between px-6 lg:px-8 border-b border-border shrink-0">
      <h2 className="text-lg font-medium text-foreground lg:pl-0 pl-10">{title}</h2>

      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border w-64">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search projects..."
            className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full"
          />
        </div>

        <button className="relative p-2 rounded-lg hover:bg-secondary transition-colors duration-200">
          <Bell className="w-4 h-4 text-muted-foreground" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary" />
        </button>
      </div>
    </header>
  );
};

export default TopBar;
