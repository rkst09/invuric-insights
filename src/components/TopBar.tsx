interface TopBarProps {
  title: string;
}

const TopBar = ({ title }: TopBarProps) => {
  return (
    <header className="h-16 flex items-center px-6 lg:px-8 border-b border-border shrink-0">
      <h2 className="text-lg font-medium text-foreground lg:pl-0 pl-10">{title}</h2>
    </header>
  );
};

export default TopBar;
