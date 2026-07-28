import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { Dashboard } from "./pages/Dashboard";
import { CampaignSetup } from "./pages/CampaignSetup";
import { Campaigns } from "./pages/Campaigns";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { supabase } from "@/lib/supabase";
import { Settings } from "./pages/Settings";
import { UsersList } from "./pages/Users";
import { Checklists } from "./pages/Checklists";
import { Reports } from "./pages/Reports";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<string>("user");
  const [userEmail, setUserEmail] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Ensure demo localStorage items are cleared so UI uses actual DB
    localStorage.removeItem("platform_users");
    localStorage.removeItem("settings_teams");
    localStorage.removeItem("settings_countries");
    localStorage.removeItem("platform_campaigns");

    // Check active session for Supabase (if configured)
    if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_URL !== 'https://placeholder.supabase.co') {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setIsAuthenticated(true);
          setUserRole(session.user?.email === "bchaithanyababu@gmail.com" ? "admin" : (session.user?.user_metadata?.role || "user"));
          setUserEmail(session.user?.email || "");
        }
        setIsLoading(false);
      });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        setIsAuthenticated(!!session);
        if (session) {
           setUserRole(session.user?.email === "bchaithanyababu@gmail.com" ? "admin" : (session.user?.user_metadata?.role || "user"));
           setUserEmail(session.user?.email || "");
        }
      });

      return () => subscription.unsubscribe();
    } else {
      // Mock auth setup
      const storedAuth = localStorage.getItem("mockAuth");
      const storedEmail = localStorage.getItem("mockAuthEmail");
      if (storedAuth) {
        setIsAuthenticated(true);
        setUserRole(storedAuth);
        setUserEmail(storedEmail || "");
      }
      setIsLoading(false);
    }
  }, []);

  const handleMockLogin = (role: string, email?: string) => {
    setIsAuthenticated(true);
    setUserRole(role);
    setUserEmail(email || "");
    localStorage.setItem("mockAuth", role);
    if (email) {
      localStorage.setItem("mockAuthEmail", email);
    }
  };

  const handleLoginAsUser = (email: string, role: string) => {
    handleMockLogin(role, email);
    window.location.href = "/";
  };

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  return (
    <Router>
      <Routes>
        {!isAuthenticated ? (
          <>
            <Route path="/signup" element={<Signup />} />
            <Route path="*" element={<Login onLogin={handleMockLogin} />} />
          </>
        ) : (
          <Route path="/" element={<AppLayout role={userRole} />}>
            <Route index element={<Dashboard userEmail={userEmail} userRole={userRole} />} />
            <Route path="campaigns/new" element={<CampaignSetup userEmail={userEmail} />} />
            <Route path="campaigns" element={<Campaigns userEmail={userEmail} userRole={userRole} />} />
            <Route path="reports" element={<Reports />} />
            <Route path="users" element={userRole === "admin" ? <UsersList onLoginAsUser={handleLoginAsUser} /> : <Navigate to="/" replace />} />
            <Route path="settings" element={userRole === "admin" ? <Settings role={userRole} /> : <Navigate to="/" replace />} />
            <Route path="checklists" element={userRole === "admin" ? <Checklists role={userRole} /> : <Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        )}
      </Routes>
    </Router>
  );
}
