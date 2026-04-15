import AppSidebar from "@/components/AppSidebar";
import TopBar from "@/components/TopBar";
import ModuleCards from "@/components/ModuleCards";
import RecentProjects from "@/components/RecentProjects";

const Index = () => {
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar title="Invuric Business Analyst Dashboard" />

        <main className="flex-1 overflow-y-auto">
          <div className="glow-top">
            <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8 space-y-8">
              <div>
                <p className="text-[13px] text-muted-foreground mb-5">Choose what you want to generate</p>
                <ModuleCards />
              </div>
              <RecentProjects />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Index;
