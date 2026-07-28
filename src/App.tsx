import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { Dashboard } from "./pages/Dashboard";
import { CampaignSetup } from "./pages/CampaignSetup";
import { Campaigns } from "./pages/Campaigns";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Settings } from "./pages/Settings";
import { UsersList } from "./pages/Users";
import { Checklists } from "./pages/Checklists";
import { Reports } from "./pages/Reports";
import { DatabaseRequirementScreen } from "./components/DatabaseRequirementScreen";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<string>("user");
  const [userEmail, setUserEmail] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  const dbConnected = isSupabaseConfigured();

  useEffect(() => {
    // Clear legacy mock auth storage
    localStorage.removeItem("mockAuth");
    localStorage.removeItem("mockAuthEmail");
    localStorage.removeItem("platform_users");

    if (!dbConnected) {
      setIsLoading(false);
      return;
    }

    // Check active session in Supabase Auth
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsAuthenticated(true);
        setUserRole(session.user?.user_metadata?.role || "user");
        setUserEmail(session.user?.email || "");
      }
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
      if (session) {
        setUserRole(session.user?.user_metadata?.role || "user");
        setUserEmail(session.user?.email || "");
      } else {
        setUserRole("user");
        setUserEmail("");
      }
    });

    return () => subscription.unsubscribe();
  }, [dbConnected]);

  if (!dbConnected) {
    return <DatabaseRequirementScreen />;
  }

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-900 text-white font-sans text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 font-medium">Verifying database session...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {!isAuthenticated ? (
          <>
            <Route path="/signup" element={<Signup />} />
            <Route path="*" element={<Login onLogin={() => setIsAuthenticated(true)} />} />
          </>
        ) : (
          <Route path="/" element={<AppLayout role={userRole} />}>
            <Route index element={<Dashboard userEmail={userEmail} userRole={userRole} />} />
            <Route path="campaigns/new" element={<CampaignSetup userEmail={userEmail} />} />
            <Route path="campaigns" element={<Campaigns userEmail={userEmail} userRole={userRole} />} />
            <Route path="reports" element={<Reports />} />
            <Route path="users" element={userRole === "admin" ? <UsersList /> : <Navigate to="/" replace />} />
            <Route path="settings" element={userRole === "admin" ? <Settings role={userRole} /> : <Navigate to="/" replace />} />
            <Route path="checklists" element={userRole === "admin" ? <Checklists role={userRole} /> : <Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        )}
      </Routes>
    </Router>
  );
}

