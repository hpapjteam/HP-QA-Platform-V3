import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  getAllCampaigns, 
  getFolders, 
  createFolder, 
  renameFolder,
  deleteFolder,
  softDeleteCampaign, 
  restoreCampaign, 
  permanentlyDeleteCampaign, 
  moveCampaignToFolder,
  CampaignRecord, 
  FolderItem 
} from "@/lib/campaign-storage";
import { logAction } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import { 
  PlusCircle, 
  Search, 
  Filter, 
  LayoutGrid, 
  List, 
  CheckCircle2, 
  XCircle, 
  History, 
  Trash2, 
  RotateCcw, 
  FolderPlus, 
  Folder, 
  FolderOpen, 
  Calendar, 
  Clock, 
  User, 
  MoveRight, 
  AlertTriangle,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Home,
  ArrowLeft,
  X,
  Globe
} from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "all", label: "All Campaigns" },
  { id: "drafts", label: "Drafts" },
  { id: "active", label: "Active" },
  { id: "review", label: "Needs Review" },
  { id: "completed", label: "Completed" },
  { id: "recycle_bin", label: "Recycle Bin", isRecycle: true }
];

export function Campaigns({ userEmail = "admin@example.com", userRole }: { userEmail?: string; userRole?: string }) {
  const [activeTab, setActiveTab] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>("all");
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [searchScope, setSearchScope] = useState<"all" | "current">("all");

  const toggleFolderCollapse = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));
  };
  
  // Folder Creation Modal
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null);

  // Delete Folder Modal
  const [folderToDelete, setFolderToDelete] = useState<FolderItem | null>(null);

  // Rename Folder Modal
  const [folderToRename, setFolderToRename] = useState<FolderItem | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Drag and Drop state
  const [draggedCampaignId, setDraggedCampaignId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  // Delete Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState<CampaignRecord | null>(null);
  const [isPermanentDelete, setIsPermanentDelete] = useState(false);

  // Move Folder Modal
  const [moveTarget, setMoveTarget] = useState<CampaignRecord | null>(null);
  const [targetFolderId, setTargetFolderId] = useState<string>("");

  const navigate = useNavigate();

  const loadData = async () => {
    console.log("[Campaigns Page] Refreshing campaigns & folders data...");
    const folderList = getFolders();
    setFolders(folderList);

    const campaignList = await getAllCampaigns();
    setCampaigns(campaignList);
  };

  useEffect(() => {
    loadData();
  }, [userEmail]);

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    createFolder(newFolderName.trim(), newFolderParentId);
    setNewFolderName("");
    setShowFolderModal(false);
    loadData();
  };

  const handleConfirmDeleteFolder = async () => {
    if (!folderToDelete) return;
    await deleteFolder(folderToDelete.id, userEmail);
    if (selectedFolderId === folderToDelete.id) {
      setSelectedFolderId("all");
    }
    setFolderToDelete(null);
    loadData();
  };

  const handleRenameFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderToRename || !renameValue.trim()) return;
    await renameFolder(folderToRename.id, renameValue.trim());
    setFolderToRename(null);
    setRenameValue("");
    loadData();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    if (isPermanentDelete) {
      await permanentlyDeleteCampaign(deleteTarget.id, userEmail);
    } else {
      await softDeleteCampaign(deleteTarget.id, userEmail);
    }
    setDeleteTarget(null);
    setIsPermanentDelete(false);
    loadData();
  };

  const handleRestore = async (campaign: CampaignRecord) => {
    await restoreCampaign(campaign.id, userEmail);
    loadData();
  };

  const handleMoveFolder = async () => {
    if (!moveTarget || !targetFolderId) return;
    await moveCampaignToFolder(moveTarget.id, targetFolderId, userEmail);
    setMoveTarget(null);
    loadData();
  };

  // Drag & Drop event handlers
  const handleDragStart = (e: React.DragEvent, campaign: CampaignRecord) => {
    setDraggedCampaignId(campaign.id);
    e.dataTransfer.setData("text/plain", campaign.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggedCampaignId(null);
    setDragOverFolderId(null);
  };

  const handleDragOver = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverFolderId !== folderId) {
      setDragOverFolderId(folderId);
    }
  };

  const handleDragLeave = (folderId: string) => {
    if (dragOverFolderId === folderId) {
      setDragOverFolderId(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetFolderId: string) => {
    e.preventDefault();
    const cId = e.dataTransfer.getData("text/plain") || draggedCampaignId;
    if (cId) {
      const campaign = campaigns.find(c => String(c.id) === String(cId));
      await moveCampaignToFolder(cId, targetFolderId, userEmail);
      const targetName = targetFolderId === "all" ? "All Folders" : getFolderName(targetFolderId);
      setToastNotice(`✓ Moved "${campaign?.name || "Campaign"}" to ${targetName}`);
      setTimeout(() => setToastNotice(null), 3500);
      loadData();
    }
    setDragOverFolderId(null);
    setDraggedCampaignId(null);
  };

  const handleUpdateCampaignStatus = async (id: string, newStatus: "Approved" | "Failed") => {
    const target = campaigns.find(c => String(c.id) === String(id));
    const campaignName = target?.name || "Campaign";

    setCampaigns(prev => prev.map(c => {
      if (String(c.id) === String(id)) {
        return {
          ...c,
          status: newStatus,
          updated_at: new Date().toISOString(),
          lastEditedBy: userEmail
        };
      }
      return c;
    }));

    try {
      if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_URL !== 'https://placeholder.supabase.co') {
        await supabase.from("campaigns").update({ 
          status: newStatus, 
          updated_at: new Date().toISOString() 
        }).eq("id", id);
      }
    } catch (err) {
      console.warn("Supabase status update skipped/failed:", err);
    }

    try {
      const localRaw = localStorage.getItem("local_campaigns");
      if (localRaw) {
        let localList: any[] = JSON.parse(localRaw);
        localList = localList.map((c: any) => String(c.id) === String(id) ? { ...c, status: newStatus, updated_at: new Date().toISOString(), lastEditedBy: userEmail } : c);
        localStorage.setItem("local_campaigns", JSON.stringify(localList));
      }
    } catch (e) {
      console.error("LocalStorage status update error:", e);
    }

    await logAction(
      userEmail, 
      newStatus === "Approved" ? "Approve Campaign" : "Fail Campaign", 
      `Campaign "${campaignName}" (ID: ${id}) marked as ${newStatus}`,
      String(id)
    );
  };

  const getBadgeStyle = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s.includes("draft")) return "bg-slate-100 text-slate-700 border-slate-300";
    if (s.includes("pending")) return "bg-amber-100 text-amber-800 border-amber-300";
    if (s.includes("in progress") || s.includes("automating")) return "bg-blue-100 text-blue-800 border-blue-300";
    if (s.includes("approved") || s.includes("completed")) return "bg-emerald-100 text-emerald-800 border-emerald-300";
    if (s.includes("rejected") || s.includes("failed")) return "bg-rose-100 text-rose-800 border-rose-300";
    return "bg-slate-100 text-slate-700 border-slate-200";
  };

  const formatDateTime = (isoString?: string) => {
    if (!isoString) return "N/A";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      }) + " " + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return "N/A";
    }
  };

  // Helper to construct breadcrumbs path
  const getBreadcrumbs = () => {
    const rootItem = {
      id: "all",
      name: "All Campaigns",
      isRoot: true,
      count: campaigns.filter(c => !c.is_deleted).length
    };

    if (selectedFolderId === "all") {
      return [rootItem];
    }

    const currentFolder = folders.find(f => f.id === selectedFolderId);
    if (!currentFolder) {
      return [rootItem];
    }

    const path: { id: string; name: string; isRoot?: boolean; count: number }[] = [rootItem];

    if (currentFolder.parentId) {
      const parentFolder = folders.find(f => f.id === currentFolder.parentId);
      if (parentFolder) {
        const parentCount = campaigns.filter(c => !c.is_deleted && (c.folder_id === parentFolder.id || folders.filter(sub => sub.parentId === parentFolder.id).some(s => s.id === c.folder_id))).length;
        path.push({ id: parentFolder.id, name: parentFolder.name, count: parentCount });
      }
    }

    const currentCount = campaigns.filter(c => !c.is_deleted && (c.folder_id === currentFolder.id || (!currentFolder.parentId && folders.filter(sub => sub.parentId === currentFolder.id).some(s => s.id === c.folder_id)))).length;
    path.push({ id: currentFolder.id, name: currentFolder.name, count: currentCount });

    return path;
  };

  // Filtering campaigns
  const filteredCampaigns = campaigns.filter(c => {
    // Search query filter (matches campaign name, country, version, or folder name)
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesName = c.name.toLowerCase().includes(q);
      const matchesCountry = c.country?.toLowerCase().includes(q);
      const matchesVersion = c.versionName?.toLowerCase().includes(q);
      const matchesFolder = getFolderName(c.folder_id).toLowerCase().includes(q);
      if (!matchesName && !matchesCountry && !matchesVersion && !matchesFolder) {
        return false;
      }
    }

    // Folder filter: apply folder check ONLY if no search query is active OR searchScope is 'current'
    if (selectedFolderId !== "all" && (!searchQuery || searchScope === "current")) {
      if (c.folder_id !== selectedFolderId) {
        // check if selected folder is parent year folder and campaign is in subfolder
        const subfoldersOfParent = folders.filter(f => f.parentId === selectedFolderId).map(f => f.id);
        if (!subfoldersOfParent.includes(c.folder_id || "")) {
          return false;
        }
      }
    }

    // Recycle bin tab logic
    if (activeTab === "recycle_bin") {
      return c.is_deleted === true;
    } else {
      // Hide deleted campaigns from normal tabs
      if (c.is_deleted) return false;
    }

    if (activeTab === "all") return true;
    if (activeTab === "drafts") return c.status === "Draft";
    if (activeTab === "active" && c.status !== "Completed" && c.status !== "Approved" && c.status !== "Failed") return true;
    if (activeTab === "review" && (c.status === "Failed" || c.status === "QA Pending" || c.status === "Review Pending")) return true;
    if (activeTab === "completed" && (c.status === "Completed" || c.status === "Approved")) return true;

    return true;
  });

  const getFolderName = (folderId?: string | null) => {
    if (!folderId) return "Default / 2026";
    const found = folders.find(f => f.id === folderId);
    if (!found) return "2026";
    if (found.parentId) {
      const parent = folders.find(f => f.id === found.parentId);
      return `${parent?.name || found.year || "Folder"} / ${found.name}`;
    }
    return found.name;
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <header className="h-20 flex items-center justify-between px-8 border-b border-slate-200 bg-white shrink-0 shadow-xs">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Campaigns & Folder Directory</h2>
          <p className="text-xs text-slate-500 mt-0.5">Manage, organize by year/folders, QA validate, and restore deleted campaigns</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFolderModal(true)}
            className="px-3.5 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-md text-xs font-semibold transition-colors inline-flex items-center gap-1.5 border border-slate-300 shadow-xs"
          >
            <FolderPlus className="h-4 w-4 text-[#2b61d6]" />
            New Folder
          </button>
          <Link
            to="/campaigns/new"
            className="px-4 py-2 bg-[#2b61d6] text-white rounded-md text-xs font-semibold hover:bg-blue-700 transition-colors inline-flex items-center gap-2 shadow-xs"
          >
            <PlusCircle className="h-4 w-4" />
            New Campaign
          </Link>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar: Folder Navigation */}
        <aside className="w-64 bg-white border-r border-slate-200 p-4 flex flex-col shrink-0 overflow-y-auto">
          <div className="flex items-center justify-between mb-3 px-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-[#2b61d6]" />
              Folders & Years
            </span>
            <button
              onClick={() => setShowFolderModal(true)}
              className="text-xs text-[#2b61d6] hover:underline font-semibold"
            >
              + Add
            </button>
          </div>

          <nav className="space-y-1">
            <button
              onClick={() => setSelectedFolderId("all")}
              onDragOver={(e) => handleDragOver(e, "all")}
              onDragLeave={() => handleDragLeave("all")}
              onDrop={(e) => handleDrop(e, "all")}
              className={cn(
                "w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-all cursor-pointer",
                dragOverFolderId === "all"
                  ? "bg-blue-100 border-2 border-dashed border-[#2b61d6] scale-[1.02] text-[#2b61d6] font-bold shadow-xs"
                  : selectedFolderId === "all"
                  ? "bg-blue-50 text-[#2b61d6] font-semibold"
                  : "text-slate-700 hover:bg-slate-100"
              )}
            >
              <span className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-blue-600" />
                All Folders & Files
              </span>
              <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">
                {campaigns.filter(c => !c.is_deleted).length}
              </span>
            </button>

            {/* Render Year folders (parentId == null) */}
            {folders.filter(f => f.parentId === null).map((yearFolder) => {
              const childFolders = folders.filter(f => f.parentId === yearFolder.id);
              const isSelected = selectedFolderId === yearFolder.id;
              const yearCount = campaigns.filter(c => !c.is_deleted && (c.folder_id === yearFolder.id || childFolders.some(ch => ch.id === c.folder_id))).length;
              const isDragOver = dragOverFolderId === yearFolder.id;
              const isCollapsed = !!collapsedFolders[yearFolder.id];

              return (
                <div key={yearFolder.id} className="space-y-0.5">
                  <div
                    onClick={() => setSelectedFolderId(yearFolder.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setFolderToRename(yearFolder);
                      setRenameValue(yearFolder.name);
                    }}
                    onDragOver={(e) => handleDragOver(e, yearFolder.id)}
                    onDragLeave={() => handleDragLeave(yearFolder.id)}
                    onDrop={(e) => handleDrop(e, yearFolder.id)}
                    className={cn(
                      "w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-all mt-1 cursor-pointer group/item",
                      isDragOver
                        ? "bg-blue-100 border-2 border-dashed border-[#2b61d6] scale-[1.02] text-[#2b61d6] font-bold shadow-xs"
                        : isSelected
                        ? "bg-blue-50 text-[#2b61d6]"
                        : "text-slate-800 hover:bg-slate-100"
                    )}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      {childFolders.length > 0 ? (
                        <button
                          type="button"
                          onClick={(e) => toggleFolderCollapse(yearFolder.id, e)}
                          className="p-0.5 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-900 transition-colors shrink-0"
                          title={isCollapsed ? "Expand subfolders" : "Collapse subfolders"}
                        >
                          {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      ) : (
                        <span className="w-4 shrink-0" />
                      )}
                      <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{yearFolder.name}</span>
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full border border-slate-200">
                        {yearCount}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFolderToDelete(yearFolder);
                        }}
                        title={`Delete folder "${yearFolder.name}"`}
                        className="opacity-0 group-hover/item:opacity-100 p-0.5 hover:bg-rose-100 text-slate-400 hover:text-rose-600 rounded transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Subfolders (visible if not collapsed) */}
                  {!isCollapsed && childFolders.map((sub) => {
                    const subSelected = selectedFolderId === sub.id;
                    const subCount = campaigns.filter(c => !c.is_deleted && c.folder_id === sub.id).length;
                    const isSubDragOver = dragOverFolderId === sub.id;

                    return (
                      <div
                        key={sub.id}
                        onClick={() => setSelectedFolderId(sub.id)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setFolderToRename(sub);
                          setRenameValue(sub.name);
                        }}
                        onDragOver={(e) => handleDragOver(e, sub.id)}
                        onDragLeave={() => handleDragLeave(sub.id)}
                        onDrop={(e) => handleDrop(e, sub.id)}
                        className={cn(
                          "w-full text-left pl-8 pr-3 py-1 rounded-md text-[11px] font-medium flex items-center justify-between transition-all cursor-pointer group/subitem",
                          isSubDragOver
                            ? "bg-blue-100 border-2 border-dashed border-[#2b61d6] scale-[1.02] text-[#2b61d6] font-bold shadow-xs"
                            : subSelected
                            ? "bg-blue-100 text-[#2b61d6] font-semibold"
                            : "text-slate-600 hover:bg-slate-100"
                        )}
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          <Folder className="w-3 h-3 text-slate-400" />
                          {sub.name}
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] text-slate-500 font-normal">
                            {subCount}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFolderToDelete(sub);
                            }}
                            title={`Delete folder "${sub.name}"`}
                            className="opacity-0 group-hover/subitem:opacity-100 p-0.5 hover:bg-rose-100 text-slate-400 hover:text-rose-600 rounded transition-opacity"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </nav>
        </aside>

        {/* Main Directory Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs Header */}
          <div className="px-8 pt-4 bg-white border-b border-slate-200 shrink-0">
            <nav className="flex space-x-6">
              {TABS.map((tab) => {
                const count = campaigns.filter(c => {
                  if (tab.isRecycle) return c.is_deleted === true;
                  if (c.is_deleted) return false;
                  if (tab.id === "all") return true;
                  if (tab.id === "drafts") return c.status === "Draft";
                  if (tab.id === "active") return c.status !== "Completed" && c.status !== "Approved" && c.status !== "Failed";
                  if (tab.id === "review") return c.status === "Failed" || c.status === "QA Pending" || c.status === "Review Pending";
                  if (tab.id === "completed") return c.status === "Completed" || c.status === "Approved";
                  return true;
                }).length;

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "pb-3 text-xs font-semibold transition-colors relative flex items-center gap-1.5",
                      activeTab === tab.id
                        ? tab.isRecycle ? "text-rose-600" : "text-[#2b61d6]"
                        : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    {tab.isRecycle && <Trash2 className="w-3.5 h-3.5 text-rose-500" />}
                    {tab.label}
                    <span className={cn(
                      "px-1.5 py-0.2 text-[10px] rounded-full font-bold",
                      tab.isRecycle ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"
                    )}>
                      {count}
                    </span>
                    {activeTab === tab.id && (
                      <span className={cn(
                        "absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full",
                        tab.isRecycle ? "bg-rose-600" : "bg-[#2b61d6]"
                      )} />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Breadcrumb Navigation Bar */}
          <div className="bg-slate-50 border-b border-slate-200/80 px-8 py-2.5 flex items-center justify-between shrink-0 text-xs gap-3">
            <nav className="flex items-center flex-wrap gap-1.5 font-medium text-slate-600">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mr-1">Location:</span>
              {getBreadcrumbs().map((crumb, index, arr) => {
                const isLast = index === arr.length - 1;
                return (
                  <React.Fragment key={crumb.id}>
                    {index > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                    <button
                      onClick={() => setSelectedFolderId(crumb.id)}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all cursor-pointer",
                        isLast
                          ? "bg-white text-[#2b61d6] font-bold border border-slate-200 shadow-2xs"
                          : "hover:bg-slate-200/70 text-slate-700 hover:text-slate-900"
                      )}
                    >
                      {crumb.isRoot ? <Home className="w-3.5 h-3.5 text-[#2b61d6]" /> : <Folder className="w-3.5 h-3.5 text-amber-500" />}
                      <span>{crumb.name}</span>
                      <span className="text-[10px] bg-slate-200/80 text-slate-600 px-1.5 rounded-full font-semibold">
                        {crumb.count}
                      </span>
                    </button>
                  </React.Fragment>
                );
              })}
            </nav>

            {selectedFolderId !== "all" && (
              <button
                onClick={() => {
                  const currentFolder = folders.find(f => f.id === selectedFolderId);
                  if (currentFolder?.parentId) {
                    setSelectedFolderId(currentFolder.parentId);
                  } else {
                    setSelectedFolderId("all");
                  }
                }}
                className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-[#2b61d6] bg-white border border-slate-200 hover:border-slate-300 px-2.5 py-1 rounded-md transition-colors cursor-pointer shadow-2xs shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Up Level
              </button>
            )}
          </div>

          {/* Search & View Mode Toolbar */}
          <div className="px-8 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between shrink-0 relative gap-3">
            {toastNotice && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-emerald-700 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg flex items-center gap-2 animate-bounce z-20">
                <span>{toastNotice}</span>
              </div>
            )}

            <div className="flex items-center gap-3 flex-1 max-w-xl">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search campaigns across folders, country, or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-8 pl-9 pr-8 rounded-md border border-slate-300 bg-slate-50/50 text-xs focus:outline-none focus:ring-1 focus:ring-[#2b61d6]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Search Scope Toggle */}
              <div className="flex bg-slate-100 p-0.5 rounded-md border border-slate-200 shrink-0 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setSearchScope("all")}
                  className={cn(
                    "px-2.5 py-1 rounded transition-colors cursor-pointer flex items-center gap-1",
                    searchScope === "all" ? "bg-white text-[#2b61d6] shadow-2xs font-bold" : "text-slate-600 hover:text-slate-900"
                  )}
                  title="Search across all folders"
                >
                  <Globe className="w-3 h-3 text-[#2b61d6]" />
                  All Folders
                </button>
                <button
                  type="button"
                  onClick={() => setSearchScope("current")}
                  className={cn(
                    "px-2.5 py-1 rounded transition-colors cursor-pointer flex items-center gap-1",
                    searchScope === "current" ? "bg-white text-[#2b61d6] shadow-2xs font-bold" : "text-slate-600 hover:text-slate-900"
                  )}
                  title="Search only within current folder"
                >
                  <Folder className="w-3 h-3 text-amber-500" />
                  Current Folder
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {searchQuery && (
                <span className="text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-md font-semibold">
                  Found {filteredCampaigns.length} campaign{filteredCampaigns.length === 1 ? "" : "s"}
                </span>
              )}

              <div className="flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-200">
                <button
                  onClick={() => setViewMode("list")}
                  className={cn(
                    "p-1 rounded transition-colors cursor-pointer",
                    viewMode === "list" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-700"
                  )}
                  title="List View"
                >
                  <List className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className={cn(
                    "p-1 rounded transition-colors cursor-pointer",
                    viewMode === "grid" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-700"
                  )}
                  title="Grid View"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Table / List View Area */}
          <div className="flex-1 p-6 overflow-y-auto bg-slate-100/60">
            {filteredCampaigns.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center mb-3 border border-slate-200 shadow-xs">
                  {activeTab === "recycle_bin" ? (
                    <Trash2 className="h-7 w-7 text-slate-300" />
                  ) : (
                    <Folder className="h-7 w-7 text-slate-300" />
                  )}
                </div>
                <p className="text-xs font-semibold text-slate-600">
                  {activeTab === "recycle_bin" ? "Recycle Bin is Empty" : "No campaigns found in this view"}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {activeTab === "recycle_bin" ? "Deleted campaigns will appear here before permanent removal." : "Create a new campaign or choose a different folder."}
                </p>
              </div>
            ) : viewMode === "list" ? (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 border-b border-slate-200">
                      <th className="px-5 py-3">Campaign Name</th>
                      <th className="px-5 py-3">Country & Version</th>
                      <th className="px-5 py-3">Folder Path</th>
                      <th className="px-5 py-3">Created Date & Time</th>
                      <th className="px-5 py-3">Last Modified</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Actions & Decision</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs divide-y divide-slate-100">
                    {filteredCampaigns.map((campaign) => (
                      <tr 
                        key={campaign.id} 
                        draggable={!campaign.is_deleted}
                        onDragStart={(e) => handleDragStart(e, campaign)}
                        onDragEnd={handleDragEnd}
                        className={cn(
                          "hover:bg-slate-50/80 transition-colors group cursor-grab active:cursor-grabbing",
                          draggedCampaignId === campaign.id && "opacity-40 bg-blue-50 border-2 border-dashed border-blue-400"
                        )}
                      >
                        <td className="px-5 py-3.5 font-semibold text-slate-900">
                          <div className="flex items-center gap-2">
                            <GripVertical className="w-4 h-4 text-slate-300 group-hover:text-slate-500 shrink-0 cursor-grab active:cursor-grabbing" title="Drag to move to a folder" />
                            <button
                              onClick={() => navigate(`/campaigns/new?id=${campaign.id}`)}
                              className="text-left font-bold text-slate-900 hover:text-[#2b61d6] hover:underline flex items-center gap-1.5"
                            >
                              {campaign.name}
                            </button>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600">
                          <span className="font-semibold text-slate-800">{campaign.country}</span>
                          <span className="text-[10px] text-slate-400 ml-1.5">({campaign.versionName || "Standard"})</span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-500">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFolderId(campaign.folder_id || "all");
                            }}
                            className="bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-900 px-2 py-0.5 rounded text-[10px] font-semibold border border-slate-200 hover:border-amber-300 transition-colors inline-flex items-center gap-1 cursor-pointer"
                            title={`Jump to folder "${getFolderName(campaign.folder_id)}"`}
                          >
                            <Folder className="w-3 h-3 text-amber-500" />
                            <span>{getFolderName(campaign.folder_id)}</span>
                          </button>
                        </td>
                        <td className="px-5 py-3.5 text-slate-500">
                          <div className="flex flex-col">
                            <span className="text-slate-700 font-medium">{formatDateTime(campaign.created_at)}</span>
                            <span className="text-[10px] text-slate-400">By {campaign.createdBy || campaign.userEmail}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-slate-500">
                          <div className="flex flex-col">
                            <span className="text-slate-700 font-medium">{formatDateTime(campaign.updated_at)}</span>
                            <span className="text-[10px] text-slate-400">By {campaign.lastEditedBy || campaign.createdBy || "User"}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border", getBadgeStyle(campaign.status))}>
                            {campaign.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {activeTab === "recycle_bin" ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleRestore(campaign)}
                                className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300 rounded text-xs font-semibold inline-flex items-center gap-1 shadow-xs"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Restore
                              </button>
                              <button
                                onClick={() => {
                                  setDeleteTarget(campaign);
                                  setIsPermanentDelete(true);
                                }}
                                className="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-300 rounded text-xs font-semibold inline-flex items-center gap-1 shadow-xs"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete Forever
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleUpdateCampaignStatus(campaign.id, "Approved")}
                                className={cn(
                                  "px-2 py-1 rounded text-[11px] font-semibold inline-flex items-center gap-1 transition-colors border shadow-xs",
                                  campaign.status === "Approved"
                                    ? "bg-emerald-600 text-white border-emerald-600"
                                    : "bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                                )}
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                Approve
                              </button>
                              <button
                                onClick={() => handleUpdateCampaignStatus(campaign.id, "Failed")}
                                className={cn(
                                  "px-2 py-1 rounded text-[11px] font-semibold inline-flex items-center gap-1 transition-colors border shadow-xs",
                                  campaign.status === "Failed"
                                    ? "bg-rose-600 text-white border-rose-600"
                                    : "bg-white text-rose-700 border-rose-300 hover:bg-rose-50"
                                )}
                              >
                                <XCircle className="w-3 h-3" />
                                Fail
                              </button>
                              <button
                                onClick={() => {
                                  setMoveTarget(campaign);
                                  setTargetFolderId(campaign.folder_id || "2026");
                                }}
                                className="px-2 py-1 bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 rounded text-[11px] font-medium shadow-xs"
                                title="Move to Folder"
                              >
                                Move
                              </button>
                              <button
                                onClick={() => navigate(`/campaigns/new?id=${campaign.id}`)}
                                className="px-2 py-1 bg-white text-[#2b61d6] hover:bg-blue-50 border border-blue-200 rounded text-[11px] font-semibold shadow-xs inline-flex items-center gap-1"
                              >
                                <History className="w-3 h-3" />
                                Open
                              </button>
                              <button
                                onClick={() => {
                                  setDeleteTarget(campaign);
                                  setIsPermanentDelete(false);
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                                title="Move to Recycle Bin"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Grid View */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredCampaigns.map((campaign) => (
                  <div 
                    key={campaign.id} 
                    draggable={!campaign.is_deleted}
                    onDragStart={(e) => handleDragStart(e, campaign)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between cursor-grab active:cursor-grabbing group",
                      draggedCampaignId === campaign.id && "opacity-40 border-2 border-dashed border-blue-400 scale-95"
                    )}
                  >
                    <div>
                      <div className="p-4 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
                        <div className="flex items-start gap-2">
                          <GripVertical className="w-4 h-4 text-slate-300 group-hover:text-slate-500 shrink-0 mt-0.5 cursor-grab active:cursor-grabbing" title="Drag to move to a folder" />
                          <div>
                            <button
                              onClick={() => navigate(`/campaigns/new?id=${campaign.id}`)}
                              className="font-bold text-sm text-slate-900 hover:text-[#2b61d6] text-left line-clamp-1"
                            >
                              {campaign.name}
                            </button>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {campaign.country} ({campaign.versionName || "Standard"})
                            </p>
                          </div>
                        </div>
                        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border shrink-0", getBadgeStyle(campaign.status))}>
                          {campaign.status}
                        </span>
                      </div>

                      <div className="p-4 space-y-2 text-xs">
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="text-slate-400 flex items-center gap-1"><Folder className="w-3 h-3 text-amber-500" /> Folder:</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFolderId(campaign.folder_id || "all");
                            }}
                            className="font-semibold text-slate-700 hover:text-[#2b61d6] hover:underline cursor-pointer truncate max-w-[160px] text-right"
                            title={`Jump to folder "${getFolderName(campaign.folder_id)}"`}
                          >
                            {getFolderName(campaign.folder_id)}
                          </button>
                        </div>
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" /> Created:</span>
                          <span className="font-medium text-slate-700">{formatDateTime(campaign.created_at)}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="text-slate-400 flex items-center gap-1"><User className="w-3 h-3" /> Modified:</span>
                          <span className="font-medium text-slate-700">{formatDateTime(campaign.updated_at)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2">
                      {activeTab === "recycle_bin" ? (
                        <div className="flex items-center justify-between w-full">
                          <button
                            onClick={() => handleRestore(campaign)}
                            className="px-3 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300 rounded text-xs font-semibold inline-flex items-center gap-1"
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> Restore
                          </button>
                          <button
                            onClick={() => {
                              setDeleteTarget(campaign);
                              setIsPermanentDelete(true);
                            }}
                            className="px-3 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-300 rounded text-xs font-semibold inline-flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => navigate(`/campaigns/new?id=${campaign.id}`)}
                            className="flex-1 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded text-xs font-semibold shadow-xs flex items-center justify-center gap-1"
                          >
                            <History className="w-3.5 h-3.5 text-[#2b61d6]" /> Open
                          </button>
                          <button
                            onClick={() => {
                              setDeleteTarget(campaign);
                              setIsPermanentDelete(false);
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CREATE FOLDER MODAL */}
      {showFolderModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Create New Folder</h3>
            <p className="text-xs text-slate-500 mb-4">Create a Year folder or subfolder to organize your campaigns.</p>
            <form onSubmit={handleCreateFolder} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">Folder Name</label>
                <input
                  type="text"
                  placeholder="e.g. 2027 or Q4 Promotions"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-slate-300 text-xs focus:ring-2 focus:ring-[#2b61d6] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">Parent Directory (Optional)</label>
                <select
                  value={newFolderParentId || ""}
                  onChange={(e) => setNewFolderParentId(e.target.value ? e.target.value : null)}
                  className="w-full h-9 px-3 rounded-md border border-slate-300 text-xs bg-white"
                >
                  <option value="">Top Level (New Year Directory)</option>
                  {folders.filter(f => f.parentId === null).map((f) => (
                    <option key={f.id} value={f.id}>
                      Year: {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFolderModal(false)}
                  className="px-4 py-2 rounded-md border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-md bg-[#2b61d6] text-white text-xs font-semibold hover:bg-blue-700"
                >
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MOVE FOLDER MODAL */}
      {moveTarget && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Move Campaign</h3>
            <p className="text-xs text-slate-500 mb-4">Select target folder for "{moveTarget.name}".</p>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">Destination Folder</label>
                <select
                  value={targetFolderId}
                  onChange={(e) => setTargetFolderId(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-slate-300 text-xs bg-white"
                >
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.parentId ? `└ ${f.name} (${folders.find(p => p.id === f.parentId)?.name})` : `Year: ${f.name}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMoveTarget(null)}
                  className="px-4 py-2 rounded-md border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleMoveFolder}
                  className="px-4 py-2 rounded-md bg-[#2b61d6] text-white text-xs font-semibold hover:bg-blue-700"
                >
                  Move Campaign
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE FOLDER MODAL */}
      {folderToDelete && (() => {
        const childFolderIds = folders.filter(f => f.parentId === folderToDelete.id).map(f => f.id);
        const idsToCheck = [folderToDelete.id, ...childFolderIds];
        const activeCampaignsInFolder = campaigns.filter(c => !c.is_deleted && idsToCheck.includes(c.folder_id || ""));
        const count = activeCampaignsInFolder.length;

        return (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
              <div className="flex items-center gap-3 text-rose-600">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <h3 className="text-lg font-bold text-slate-900">
                  {count > 0 ? "Cannot Delete Folder" : "Delete Empty Folder?"}
                </h3>
              </div>

              {count > 0 ? (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg space-y-2">
                  <p className="text-xs text-rose-900 font-bold leading-relaxed">
                    Folder <strong className="text-rose-950 font-black">"{folderToDelete.name}"</strong> contains {count} campaign(s).
                  </p>
                  <p className="text-[11px] text-rose-800 leading-relaxed">
                    Folders with campaigns cannot be deleted to prevent data loss. Only empty folders can be deleted. Please move or delete the campaign(s) inside this folder first.
                  </p>
                  <div className="text-[11px] font-mono text-rose-900 bg-white/80 p-2 rounded border border-rose-200/80 max-h-24 overflow-y-auto space-y-1">
                    {activeCampaignsInFolder.map(c => (
                      <div key={c.id} className="truncate flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                        <span className="font-semibold">{c.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-600 leading-relaxed">
                  Are you sure you want to delete empty folder <strong className="text-slate-900">"{folderToDelete.name}"</strong>?
                  This folder currently has no campaigns.
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setFolderToDelete(null)}
                  className="px-4 py-2 rounded-md border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  {count > 0 ? "Understood / Close" : "Cancel"}
                </button>
                {count === 0 && (
                  <button
                    type="button"
                    onClick={handleConfirmDeleteFolder}
                    className="px-4 py-2 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs"
                  >
                    Delete Folder
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* RENAME FOLDER MODAL */}
      {folderToRename && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Rename Folder</h3>
            <p className="text-xs text-slate-500 mb-4">Update the name for this folder.</p>
            <form onSubmit={handleRenameFolder} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">Folder Name</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. 2026-q4"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="w-full h-9 rounded-md border border-slate-300 px-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setFolderToRename(null)}
                  className="px-4 py-2 rounded-md border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!renameValue.trim() || renameValue.trim() === folderToRename.name}
                  className="px-4 py-2 rounded-md bg-[#2b61d6] hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  Rename
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center gap-3 text-amber-600 mb-3">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-lg font-bold text-slate-900">
                {isPermanentDelete ? "Permanently Delete Campaign?" : "Move to Recycle Bin?"}
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              {isPermanentDelete
                ? `Are you sure you want to PERMANENTLY delete "${deleteTarget.name}"? This action cannot be undone.`
                : `Are you sure you want to move "${deleteTarget.name}" to the Recycle Bin? You can restore it anytime.`}
            </p>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(null);
                  setIsPermanentDelete(false);
                }}
                className="px-4 py-2 rounded-md border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className={cn(
                  "px-4 py-2 rounded-md text-white text-xs font-semibold shadow-xs",
                  isPermanentDelete ? "bg-rose-600 hover:bg-rose-700" : "bg-amber-600 hover:bg-amber-700"
                )}
              >
                {isPermanentDelete ? "Delete Forever" : "Move to Recycle Bin"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
