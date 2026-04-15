import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: false,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("cytoscape")) return "diagram-cytoscape";
          if (id.includes("katex")) return "diagram-katex";
          if (id.includes("mermaid")) return "diagram-mermaid";
          if (id.includes("d3-")) return "diagram-d3";
          if (id.includes("chevrotain")) return "vendor-chevrotain";
          if (id.includes("langium") || id.includes("vscode-")) return "vendor-langium";
          if (id.includes("lodash-es")) return "vendor-lodash";
          if (id.includes("dompurify")) return "vendor-dompurify";
          if (id.includes("roughjs")) return "vendor-roughjs";
          if (id.includes("marked")) return "vendor-marked";
          if (id.includes("dayjs")) return "vendor-dayjs";
          if (id.includes("layout-base") || id.includes("cose-base")) return "vendor-graph-layout";
          if (id.includes("upsetjs")) return "vendor-diagram-utils";
          if (id.includes("@floating-ui")) return "vendor-floating-ui";
          if (id.includes("tailwind-merge")) return "vendor-tailwind-merge";
          if (id.includes("next-themes")) return "vendor-next-themes";
          if (id.includes("xlsx")) return "spreadsheet";
          if (id.includes("lucide-react")) return "icons";
          if (id.includes("recharts")) return "charts";
          if (id.includes("date-fns")) return "date-utils";
          if (id.includes("@hookform") || id.includes("zod")) return "forms";
          if (id.includes("sonner") || id.includes("vaul") || id.includes("cmdk")) return "ui-extras";
          if (id.includes("react-day-picker")) return "calendar";
          if (id.includes("@tanstack")) return "react-query";
          if (id.includes("@radix-ui")) return "radix";
          if (id.includes("react-router")) return "router";
          if (id.includes("react") || id.includes("scheduler")) return "react-vendor";
          return "vendor";
        },
      },
    },
  },
}));
