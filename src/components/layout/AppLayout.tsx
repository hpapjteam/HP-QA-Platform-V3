import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { SessionManager } from "../SessionManager";

export function AppLayout({ role }: { role: string }) {
  const location = useLocation();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-900 font-sans">
      <SessionManager />
      <Sidebar role={role} />
      <main className="flex-1 flex flex-col relative overflow-hidden bg-white">
        <div className="flex-1 overflow-y-auto overflow-x-hidden z-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
