import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppShell from "@/components/AppShell";
import Dashboard from "./pages/Dashboard";
import Crypto from "./pages/Crypto";
import Analytics from "./pages/Analytics";
import AIInsights from "./pages/AIInsights";
import ModelComparison from "./pages/ModelComparison";
import PortfolioPage from "./pages/PortfolioPage";
import NewsPage from "./pages/NewsPage";
import Chat from "./pages/Chat";
import Optimizer from "./pages/Optimizer";
import Compliance from "./pages/Compliance";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import PaperTrading from "./pages/PaperTrading";
import ProtectedRoute from "./components/ProtectedRoute";
import Admin from "./pages/Admin";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route element={<AppShell />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/crypto" element={<Crypto />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/ai-insights" element={<AIInsights />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/models" element={<ModelComparison />} />
            <Route path="/portfolio" element={<PortfolioPage />} />
            <Route path="/optimizer" element={<Optimizer />} />
            <Route path="/news" element={<NewsPage />} />
            <Route path="/compliance" element={<Compliance />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/paper" element={<PaperTrading />} />
              <Route path="/admin" element={<Admin />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
