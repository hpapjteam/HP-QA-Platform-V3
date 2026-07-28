import React, { useState, useEffect } from "react";
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Database, 
  CloudUpload,
  Radio,
  Sliders,
  Check
} from "lucide-react";
import { processOfflineSyncQueue } from "@/lib/campaign-storage";
import { cn } from "@/lib/utils";

export function NetworkStatusBar() {
  const [isBrowserOnline, setIsBrowserOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [isSimulatedOffline, setIsSimulatedOffline] = useState<boolean>(false);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  
  // Toast state
  const [showToast, setShowToast] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ title: string; desc: string; type: "success" | "offline" | "info" }>({
    title: "",
    desc: "",
    type: "info"
  });
  const [showSimulatorModal, setShowSimulatorModal] = useState<boolean>(false);

  // Effective online status
  const isOnline = isBrowserOnline && !isSimulatedOffline;

  // Read queue count
  const updateQueueCount = () => {
    try {
      const raw = localStorage.getItem("offline_sync_queue");
      if (raw) {
        const queue = JSON.parse(raw);
        setPendingCount(Array.isArray(queue) ? queue.length : 0);
      } else {
        setPendingCount(0);
      }
    } catch {
      setPendingCount(0);
    }
  };

  // Perform sync
  const triggerSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);

    try {
      const [res] = await Promise.all([
        processOfflineSyncQueue(),
        new Promise((resolve) => setTimeout(resolve, 600)) // minimum pulse animation duration
      ]);

      updateQueueCount();

      if (res.synced > 0) {
        setToastMessage({
          title: "Database Synchronized",
          desc: `Successfully pushed ${res.synced} pending record${res.synced === 1 ? "" : "s"} to the database.`,
          type: "success"
        });
        setShowToast(true);
      } else if (pendingCount > 0 && res.remaining === 0) {
        setToastMessage({
          title: "Queue Cleared",
          desc: "All local offline drafts are up to date in database.",
          type: "success"
        });
        setShowToast(true);
      }
    } catch (err) {
      console.error("[NetworkStatusBar] Sync error:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    updateQueueCount();

    const handleOnlineEvent = () => {
      setIsBrowserOnline(true);
      if (!isSimulatedOffline) {
        setToastMessage({
          title: "Internet Restored",
          desc: "Reconnected to internet. Initiating database sync...",
          type: "info"
        });
        setShowToast(true);
        triggerSync();
      }
    };

    const handleOfflineEvent = () => {
      setIsBrowserOnline(false);
      setToastMessage({
        title: "Working Offline",
        desc: "Internet connection lost. Changes will be saved locally in cache.",
        type: "offline"
      });
      setShowToast(true);
    };

    const handleQueueUpdate = () => {
      updateQueueCount();
    };

    window.addEventListener("online", handleOnlineEvent);
    window.addEventListener("offline", handleOfflineEvent);
    window.addEventListener("storage", updateQueueCount);
    window.addEventListener("offline-queue-updated", handleQueueUpdate);

    // Initial check on mount: if online and queue has items, auto-sync!
    if (navigator.onLine && !isSimulatedOffline) {
      const raw = localStorage.getItem("offline_sync_queue");
      if (raw) {
        try {
          const q = JSON.parse(raw);
          if (Array.isArray(q) && q.length > 0) {
            triggerSync();
          }
        } catch {}
      }
    }

    return () => {
      window.removeEventListener("online", handleOnlineEvent);
      window.removeEventListener("offline", handleOfflineEvent);
      window.removeEventListener("storage", updateQueueCount);
      window.removeEventListener("offline-queue-updated", handleQueueUpdate);
    };
  }, [isSimulatedOffline]);

  // Handle manual simulator toggle
  const toggleSimulation = (simulateOffline: boolean) => {
    setIsSimulatedOffline(simulateOffline);
    setShowSimulatorModal(false);

    if (simulateOffline) {
      setToastMessage({
        title: "Simulated Offline Mode",
        desc: "Network connection simulated as offline. Drafts will be stored in offline queue.",
        type: "offline"
      });
      setShowToast(true);
    } else {
      setToastMessage({
        title: "Simulated Online Mode",
        desc: "Network connection restored. Syncing pending offline queue...",
        type: "info"
      });
      setShowToast(true);
      triggerSync();
    }
  };

  // Auto hide toast after 5s
  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => {
        setShowToast(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  return (
    <>
      {/* 1. Persistent Top Network Status Bar */}
      <header className={cn(
        "w-full px-4 py-2 text-xs border-b transition-all duration-300 flex items-center justify-between z-30 shrink-0 select-none",
        !isOnline 
          ? "bg-amber-50 text-amber-900 border-amber-200" 
          : isSyncing 
          ? "bg-blue-50 text-blue-900 border-blue-200"
          : "bg-slate-900 text-slate-200 border-slate-800"
      )}>
        <div className="flex items-center gap-3">
          {/* Status Badge & Pulsing Icon */}
          <div className="flex items-center gap-2">
            {!isOnline ? (
              <div className="relative flex items-center justify-center">
                <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              </div>
            ) : isSyncing ? (
              <div className="relative flex items-center justify-center">
                <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-blue-400 opacity-75"></span>
                <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin relative z-10" />
              </div>
            ) : (
              <div className="relative flex items-center justify-center">
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </div>
            )}

            <div className="flex items-center gap-1.5 font-semibold">
              {!isOnline ? (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span className="text-amber-900 font-bold">Offline Mode</span>
                </>
              ) : isSyncing ? (
                <>
                  <span className="text-blue-900 font-bold">Syncing Data...</span>
                </>
              ) : (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="text-white font-medium">Online</span>
                </>
              )}
            </div>
          </div>

          <span className="text-slate-400 dark:text-slate-500">•</span>

          {/* Detailed Message */}
          <span className="text-[11px] font-medium text-slate-300">
            {!isOnline ? (
              <span className="text-amber-800">Changes stored locally in offline cache.</span>
            ) : isSyncing ? (
              <span className="text-blue-800 font-medium">Pushing queued changes to database...</span>
            ) : pendingCount > 0 ? (
              <span className="text-amber-300 font-semibold">{pendingCount} record{pendingCount === 1 ? "" : "s"} waiting to sync</span>
            ) : (
              <span className="text-slate-300">Database synchronized & connected</span>
            )}
          </span>

          {/* Queue Count Pill */}
          {pendingCount > 0 && (
            <span className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-bold tracking-tight",
              !isOnline ? "bg-amber-200 text-amber-900" : "bg-blue-950 text-blue-300 border border-blue-800"
            )}>
              {pendingCount} Pending
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {isOnline && pendingCount > 0 && (
            <button
              type="button"
              onClick={triggerSync}
              disabled={isSyncing}
              className="bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1 rounded text-[11px] font-bold transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={cn("w-3 h-3", isSyncing && "animate-spin")} />
              {isSyncing ? "Syncing..." : "Sync Database Now"}
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowSimulatorModal(prev => !prev)}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded text-[11px] font-medium transition-colors inline-flex items-center gap-1 cursor-pointer border border-slate-700"
            title="Open Connection Simulator"
          >
            <Sliders className="w-3 h-3 text-slate-400" />
            <span className="hidden sm:inline">Network Simulator</span>
          </button>
        </div>
      </header>

      {/* 2. Simulator Drawer/Modal */}
      {showSimulatorModal && (
        <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 text-xs text-slate-200 flex items-center justify-between gap-4 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <p className="font-bold text-white">Network Connection Testing Simulator</p>
              <p className="text-[11px] text-slate-400">Toggle simulated connection drop to test local draft saves and auto-syncing.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggleSimulation(true)}
              className={cn(
                "px-3 py-1.5 rounded text-xs font-bold transition-all border cursor-pointer",
                isSimulatedOffline 
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/50" 
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:text-white"
              )}
            >
              Simulate Offline
            </button>

            <button
              type="button"
              onClick={() => toggleSimulation(false)}
              className={cn(
                "px-3 py-1.5 rounded text-xs font-bold transition-all border cursor-pointer",
                !isSimulatedOffline 
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50" 
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:text-white"
              )}
            >
              Simulate Online
            </button>

            <button
              type="button"
              onClick={() => setShowSimulatorModal(false)}
              className="text-slate-400 hover:text-white p-1 ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 3. Floating Non-Intrusive Toast Notification */}
      {showToast && (
        <div className="fixed bottom-6 right-6 z-[1000] max-w-sm w-full px-2 pointer-events-auto transition-all duration-300 animate-in fade-in slide-in-from-bottom-5">
          <div className={cn(
            "rounded-xl p-4 shadow-2xl border backdrop-blur-md transition-all relative overflow-hidden flex items-start gap-3",
            toastMessage.type === "success"
              ? "bg-slate-900 text-slate-100 border-emerald-500/80 shadow-emerald-950/20"
              : toastMessage.type === "offline"
              ? "bg-slate-900 text-slate-100 border-amber-500/80 shadow-amber-950/20"
              : "bg-slate-900 text-slate-100 border-blue-500/80 shadow-blue-950/20"
          )}>
            <div className={cn(
              "absolute top-0 left-0 right-0 h-1",
              toastMessage.type === "success" ? "bg-emerald-500" : toastMessage.type === "offline" ? "bg-amber-500" : "bg-blue-500"
            )} />

            <div className={cn(
              "p-2 rounded-lg shrink-0 mt-0.5",
              toastMessage.type === "success" 
                ? "bg-emerald-500/20 text-emerald-400" 
                : toastMessage.type === "offline"
                ? "bg-amber-500/20 text-amber-400"
                : "bg-blue-500/20 text-blue-400"
            )}>
              {toastMessage.type === "success" ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : toastMessage.type === "offline" ? (
                <WifiOff className="w-5 h-5" />
              ) : (
                <Wifi className="w-5 h-5" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold text-white tracking-tight">{toastMessage.title}</h4>
              <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">{toastMessage.desc}</p>
            </div>

            <button
              type="button"
              onClick={() => setShowToast(false)}
              className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
