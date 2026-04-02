import { Zap, ArrowRight } from "lucide-react";
import { startFullPipeline } from "@/lib/api";

const steps = ["Document", "PFD", "RAID", "WBS", "User Stories"];

const PipelineBanner = () => {
  return (
    <div className="card-surface border-l-[3px] border-l-primary p-6 lg:p-8 animate-fade-up">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Left */}
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-medium text-foreground">
              Complete BA Package
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Generate all 5 documents in one pipeline — SOW, PFD, RAID, WBS & User Stories
            </p>
          </div>
        </div>

        {/* Pipeline steps */}
        <div className="hidden md:flex items-center gap-0 shrink-0">
          {steps.map((step, i) => (
            <div key={step} className="flex items-center">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`w-3 h-3 rounded-full border-2 ${
                    i === 0
                      ? "border-primary bg-primary animate-pulse-glow"
                      : "border-border bg-background"
                  }`}
                />
                <span className="font-mono-label text-[10px] text-muted-foreground whitespace-nowrap">
                  {step}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className="w-8 h-px bg-border mb-5 mx-1" />
              )}
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={startFullPipeline}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity duration-200 shrink-0"
        >
          Start Full Pipeline
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default PipelineBanner;
