import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import ChooseDocumentType from "./pages/ChooseDocumentType.tsx";
import ChoosePath from "./pages/ChoosePath.tsx";
import PreviousProjects from "./pages/PreviousProjects.tsx";
import Questionnaire from "./pages/Questionnaire.tsx";
import UploadGapFlow from "./pages/UploadGapFlow.tsx";
import OutputFormat from "./pages/OutputFormat.tsx";
import ProcessFlowDiagram from "./pages/ProcessFlowDiagram.tsx";
import RaidDocument from "./pages/RaidDocument.tsx";
import WBSGenerator from "./pages/WBSGenerator.tsx";
import UserStories from "./pages/UserStories.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
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
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
