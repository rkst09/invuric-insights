import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import AppErrorBoundary from "@/components/AppErrorBoundary";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

const Index = lazy(() => import("./pages/Index.tsx"));
const ChooseDocumentType = lazy(() => import("./pages/ChooseDocumentType.tsx"));
const ChoosePath = lazy(() => import("./pages/ChoosePath.tsx"));
const PreviousProjects = lazy(() => import("./pages/PreviousProjects.tsx"));
const Questionnaire = lazy(() => import("./pages/Questionnaire.tsx"));
const UploadGapFlow = lazy(() => import("./pages/UploadGapFlow.tsx"));
const OutputFormat = lazy(() => import("./pages/OutputFormat.tsx"));
const ProcessFlowDiagram = lazy(() => import("./pages/ProcessFlowDiagram.tsx"));
const RaidDocument = lazy(() => import("./pages/RaidDocument.tsx"));
const WBSGenerator = lazy(() => import("./pages/WBSGenerator.tsx"));
const UserStories = lazy(() => import("./pages/UserStories.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

const RouteFallback = () => (
  <div className="min-h-screen bg-background">
    <div className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card/80 p-8 text-center shadow-[0_20px_80px_rgba(0,0,0,0.18)] backdrop-blur">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-secondary">
          <div className="h-5 w-5 rounded-md bg-primary animate-pulse" />
        </div>
        <p className="font-mono-label text-[11px] tracking-[0.24em] text-primary">INVURIC</p>
        <h1 className="mt-3 text-xl font-semibold text-foreground">Preparing your workspace</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Loading the tools and context for this workflow.
        </p>
      </div>
    </div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppErrorBoundary>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/document-generation" element={<ChooseDocumentType />} />
              <Route path="/choose-path" element={<ChoosePath />} />
              <Route path="/history" element={<PreviousProjects />} />
              <Route path="/questionnaire" element={<Questionnaire />} />
              <Route path="/upload-gap-flow" element={<UploadGapFlow />} />
              <Route path="/output-format" element={<OutputFormat />} />
              <Route path="/process-flow" element={<ProcessFlowDiagram />} />
              <Route path="/raid-document" element={<RaidDocument />} />
              <Route path="/wbs-generator" element={<WBSGenerator />} />
              <Route path="/user-stories" element={<UserStories />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AppErrorBoundary>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
