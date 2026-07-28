import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { logAction } from "@/lib/logger";

export interface FolderItem {
  id: string;
  name: string;
  parentId: string | null; // null for top-level Year folder
  year?: string;
  created_at: string;
}

export interface CampaignRecord {
  id: string;
  name: string;
  country: string;
  versionName?: string;
  version_name?: string;
  status: string; // "Draft" | "QA Pending" | "Approved" | "Failed" | "Completed"
  webViewUrl?: string;
  web_view_url?: string;
  figmaUrl?: string;
  figma_url?: string;
  htmlSource?: string;
  html_source?: string;
  litmusUrl?: string;
  litmus_url?: string;
  designType?: "figma" | "image";
  team?: string;
  mockupFileName?: string;
  mockupDataUrl?: string;
  outlookFileName?: string;
  outlookExtractedHtml?: string;
  outlookSubject?: string;
  userEmail: string;
  createdBy: string;
  lastEditedBy?: string;
  created_at: string;
  updated_at: string;
  is_deleted?: boolean;
  deleted_by?: string | null;
  deleted_at?: string | null;
  folder_id?: string | null;
  reviewNote?: string;
  qaResults?: any[];
  checklists?: any[];
  checklistAnswers?: Record<string, any>;
  currentStep?: number;
  current_step?: number;
}

const DEFAULT_FOLDERS: FolderItem[] = [
  { id: "2026", name: "2026", parentId: null, year: "2026", created_at: new Date().toISOString() },
  { id: "2026-q3", name: "Q3 Campaigns", parentId: "2026", year: "2026", created_at: new Date().toISOString() },
  { id: "2026-holidays", name: "Holiday & Back-to-School", parentId: "2026", year: "2026", created_at: new Date().toISOString() },
  { id: "2025", name: "2025", parentId: null, year: "2025", created_at: new Date().toISOString() },
];

/**
 * Gets all folders from LocalStorage (or defaults).
 */
export function getFolders(): FolderItem[] {
  try {
    const raw = localStorage.getItem("local_folders");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("[CampaignStorage] Error parsing local_folders:", e);
  }
  localStorage.setItem("local_folders", JSON.stringify(DEFAULT_FOLDERS));
  return DEFAULT_FOLDERS;
}

/**
 * Creates a new folder (Year folder or Subfolder).
 */
export function createFolder(name: string, parentId: string | null = null): FolderItem {
  const folders = getFolders();
  const year = parentId ? (folders.find(f => f.id === parentId)?.year || "2026") : name;
  const newFolder: FolderItem = {
    id: `folder_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: name.trim(),
    parentId,
    year,
    created_at: new Date().toISOString()
  };
  folders.push(newFolder);
  localStorage.setItem("local_folders", JSON.stringify(folders));
  console.log("[CampaignStorage] Created new folder:", newFolder);
  return newFolder;
}

export async function renameFolder(id: string, newName: string): Promise<void> {
  const folders = getFolders();
  const index = folders.findIndex(f => f.id === id);
  if (index !== -1) {
    folders[index].name = newName.trim();
    localStorage.setItem("local_folders", JSON.stringify(folders));
    console.log("[CampaignStorage] Renamed folder:", id, newName);
  }
}

const INITIAL_SEED_CAMPAIGNS: CampaignRecord[] = [
  {
    id: "cmp_seed_1",
    name: "BASE_MA_JP_JA_PUB_CON_SEG_PM_Q326_0724_Omen35L",
    country: "IN",
    versionName: "Omen 35L Launch",
    status: "QA Pending",
    webViewUrl: "https://www.hp.com/in-en/campaigns/omen35l.html",
    figmaUrl: "https://figma.com/file/omen35l_qa",
    htmlSource: "<html><body><h1>HP Omen 35L Gaming Desktop</h1></body></html>",
    userEmail: "admin@hp.com",
    createdBy: "Admin User",
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    folder_id: "2026-q3"
  },
  {
    id: "cmp_seed_2",
    name: "HP_IND_EPIC_SALE_JULY_Q326_0724_Laptops",
    country: "IN",
    versionName: "Epic Laptops Sale",
    status: "In Progress",
    webViewUrl: "https://www.hp.com/in-en/campaigns/epicsale.html",
    userEmail: "sharanya.r@hp.com",
    createdBy: "Sharanya R",
    created_at: new Date(Date.now() - 3600000 * 18).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 18).toISOString(),
    folder_id: "2026-q3"
  },
  {
    id: "cmp_seed_3",
    name: "AU_WINTER_SALE_Q326_0723_Laptops",
    country: "AU",
    versionName: "Winter Consumer Deals",
    status: "Completed",
    webViewUrl: "https://www.hp.com/au-en/campaigns/wintersale.html",
    userEmail: "chaithanya.b@hp.com",
    createdBy: "Chaithanya B",
    created_at: new Date(Date.now() - 3600000 * 26).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 26).toISOString(),
    folder_id: "2026-q3"
  },
  {
    id: "cmp_seed_4",
    name: "SG_BACK_TO_SCHOOL_Q326_0723",
    country: "SG",
    versionName: "Back To School promo",
    status: "QA Pending",
    webViewUrl: "https://www.hp.com/sg-en/campaigns/bts.html",
    userEmail: "anusha.m@hp.com",
    createdBy: "Anusha M",
    created_at: new Date(Date.now() - 3600000 * 44).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 44).toISOString(),
    folder_id: "2026-holidays"
  },
  {
    id: "cmp_seed_5",
    name: "MY_MID_YEAR_OFFERS_Q326_0722",
    country: "MY",
    versionName: "Mid Year Storewide",
    status: "Failed",
    webViewUrl: "https://www.hp.com/my-en/campaigns/midyear.html",
    userEmail: "rajesh.k@hp.com",
    createdBy: "Rajesh K",
    created_at: new Date(Date.now() - 3600000 * 50).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 50).toISOString(),
    folder_id: "2026-q3"
  },
  {
    id: "cmp_seed_6",
    name: "NZ_SPECTRE_X360_LAUNCH_Q326_0721",
    country: "NZ",
    versionName: "Premium Series",
    status: "Approved",
    webViewUrl: "https://www.hp.com/nz-en/campaigns/spectre.html",
    userEmail: "admin@hp.com",
    createdBy: "Admin User",
    created_at: new Date(Date.now() - 3600000 * 70).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 70).toISOString(),
    folder_id: "2026-q3"
  }
];

function mapSupabaseToCampaignRecord(item: any): CampaignRecord {
  return {
    id: String(item.id),
    name: item.name || "Untitled",
    country: item.country || "IN",
    versionName: item.versionName || item.version_name || "Standard",
    version_name: item.version_name || item.versionName || "Standard",
    status: item.status || "Draft",
    webViewUrl: item.webViewUrl || item.web_view_url || "",
    web_view_url: item.web_view_url || item.webViewUrl || "",
    figmaUrl: item.figmaUrl || item.figma_url || "",
    figma_url: item.figma_url || item.figmaUrl || "",
    htmlSource: item.htmlSource || item.html_source || "",
    html_source: item.html_source || item.htmlSource || "",
    litmusUrl: item.litmusUrl || item.litmus_url || "",
    litmus_url: item.litmus_url || item.litmusUrl || "",
    designType: item.designType || item.design_type || "figma",
    team: item.team || "HP-APJ",
    mockupFileName: item.mockupFileName || item.mockup_file_name || "",
    mockupDataUrl: item.mockupDataUrl || item.mockup_data_url || "",
    outlookFileName: item.outlookFileName || item.outlook_file_name || "",
    outlookExtractedHtml: item.outlookExtractedHtml || item.outlook_extracted_html || "",
    outlookSubject: item.outlookSubject || item.outlook_subject || "",
    userEmail: item.userEmail || item.user_email || item.createdBy || "admin@example.com",
    createdBy: item.createdBy || item.created_by || item.userEmail || "QA User",
    lastEditedBy: item.lastEditedBy || item.last_edited_by || "QA User",
    created_at: item.created_at || new Date().toISOString(),
    updated_at: item.updated_at || new Date().toISOString(),
    is_deleted: item.is_deleted || false,
    deleted_by: item.deleted_by || null,
    deleted_at: item.deleted_at || null,
    folder_id: item.folder_id || "2026",
    reviewNote: item.reviewNote || item.review_note || "",
    qaResults: item.qaResults || item.qa_results || [],
    checklists: item.checklists || [],
    checklistAnswers: item.checklistAnswers || item.checklist_answers || {},
    currentStep: item.currentStep !== undefined ? item.currentStep : (item.current_step !== undefined ? item.current_step : 1),
    current_step: item.current_step !== undefined ? item.current_step : (item.currentStep !== undefined ? item.currentStep : 1),
  };
}

/**
 * Gets all campaigns from Supabase (single source of truth).
 */
export async function getAllCampaigns(): Promise<CampaignRecord[]> {
  const isRealSupabase = isSupabaseConfigured();

  if (isRealSupabase) {
    try {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .order("updated_at", { ascending: false });

      if (!error && data) {
        const mapped = data.map(mapSupabaseToCampaignRecord);
        // Cache locally for offline availability
        try {
          localStorage.setItem("local_campaigns", JSON.stringify(mapped));
        } catch (e) {}
        
        if (mapped.length > 0) {
          return mapped;
        }

        // Fresh database: check if we have local campaigns to sync, or populate default seeds into DB
        const localRaw = localStorage.getItem("local_campaigns");
        const localItems: CampaignRecord[] = localRaw ? JSON.parse(localRaw) : [...INITIAL_SEED_CAMPAIGNS];
        if (localItems.length > 0) {
          await syncAllCampaignsToDatabase(localItems);
          const reFetch = await supabase.from("campaigns").select("*").order("updated_at", { ascending: false });
          if (!reFetch.error && reFetch.data) {
            return reFetch.data.map(mapSupabaseToCampaignRecord);
          }
        }
        return mapped;
      }
    } catch (err) {
      console.error("[CampaignStorage] Error fetching from Supabase:", err);
    }
  }

  // Fallback to local storage only if offline
  try {
    const localRaw = localStorage.getItem("local_campaigns");
    if (localRaw) {
      const parsed: CampaignRecord[] = JSON.parse(localRaw);
      return parsed.map(mapSupabaseToCampaignRecord);
    }
  } catch (e) {
    console.error("[CampaignStorage] Error reading local_campaigns:", e);
  }

  return INITIAL_SEED_CAMPAIGNS;
}


/**
 * Syncs/Populates all given campaign records to Supabase database.
 */
export async function syncAllCampaignsToDatabase(campaigns: CampaignRecord[]): Promise<number> {
  const isRealSupabase = Boolean(
    import.meta.env.VITE_SUPABASE_URL && 
    import.meta.env.VITE_SUPABASE_URL !== 'https://placeholder.supabase.co'
  );
  if (!isRealSupabase || typeof navigator === 'undefined' || !navigator.onLine) return 0;

  let count = 0;
  for (const record of campaigns) {
    try {
      const payload = formatSupabaseCampaignRecord(record);
      const { error } = await supabase.from("campaigns").upsert(payload);
      if (!error) {
        count++;
      } else {
        // Retry with core fallback payload if custom table columns are missing
        const fallbackPayload = {
          id: String(record.id),
          name: record.name || "Untitled",
          country: record.country || "IN",
          version_name: record.versionName || record.version_name || "Standard",
          status: record.status || "Draft",
          web_view_url: record.webViewUrl || record.web_view_url || "",
          figma_url: record.figmaUrl || record.figma_url || "",
          html_source: record.htmlSource || record.html_source || "",
          litmus_url: record.litmusUrl || record.litmus_url || "",
          folder_id: record.folder_id || "2026",
          user_email: record.userEmail || record.createdBy || "admin@example.com",
          created_by: record.createdBy || record.userEmail || "QA User",
          last_edited_by: record.lastEditedBy || record.userEmail || "QA User",
          created_at: record.created_at || new Date().toISOString(),
          updated_at: record.updated_at || new Date().toISOString(),
          is_deleted: record.is_deleted || false,
          deleted_by: record.deleted_by || null,
          deleted_at: record.deleted_at || null,
          review_note: record.reviewNote || "",
          current_step: record.currentStep || record.current_step || 1
        };
        const fbRes = await supabase.from("campaigns").upsert(fallbackPayload);
        if (!fbRes.error) count++;
      }
    } catch (e) {
      console.warn(`[CampaignStorage] Error populating campaign "${record.name}" to database:`, e);
    }
  }
  return count;
}

/**
 * Verifies if a campaign name is unique across all non-deleted campaigns.
 */
export async function isCampaignNameUnique(name: string, currentId?: string | null): Promise<boolean> {
  const trimmedName = name.trim().toLowerCase();
  if (!trimmedName) return false;

  const all = await getAllCampaigns();
  const duplicate = all.find(c => {
    if (c.is_deleted) return false; // Ignore deleted campaigns
    if (currentId && String(c.id) === String(currentId)) return false; // Ignore self when editing
    return c.name.trim().toLowerCase() === trimmedName;
  });

  return !duplicate;
}

function formatSupabaseCampaignRecord(rec: CampaignRecord): Record<string, any> {
  return {
    id: String(rec.id),
    name: rec.name || "Untitled",
    country: rec.country || "IN",
    version_name: rec.versionName || rec.version_name || "Standard",
    status: rec.status || "Draft",
    web_view_url: rec.webViewUrl || rec.web_view_url || "",
    figma_url: rec.figmaUrl || rec.figma_url || "",
    html_source: rec.htmlSource || rec.html_source || "",
    litmus_url: rec.litmusUrl || rec.litmus_url || "",
    design_type: rec.designType || "figma",
    team: rec.team || "HP-APJ",
    mockup_file_name: rec.mockupFileName || "",
    mockup_data_url: rec.mockupDataUrl || "",
    outlook_file_name: rec.outlookFileName || "",
    outlook_extracted_html: rec.outlookExtractedHtml || "",
    outlook_subject: rec.outlookSubject || "",
    folder_id: rec.folder_id || "2026",
    user_email: rec.userEmail || rec.createdBy || "admin@example.com",
    created_by: rec.createdBy || rec.userEmail || "QA User",
    last_edited_by: rec.lastEditedBy || rec.userEmail || "QA User",
    created_at: rec.created_at || new Date().toISOString(),
    updated_at: rec.updated_at || new Date().toISOString(),
    is_deleted: rec.is_deleted || false,
    deleted_by: rec.deleted_by || null,
    deleted_at: rec.deleted_at || null,
    review_note: rec.reviewNote || "",
    qa_results: rec.qaResults || [],
    checklists: rec.checklists || [],
    checklist_answers: rec.checklistAnswers || {},
    current_step: rec.currentStep !== undefined ? rec.currentStep : (rec.current_step || 1)
  };
}

/**
 * Saves or updates a campaign in Supabase and LocalStorage.
 */
export async function saveCampaignRecord(campaign: Partial<CampaignRecord> & { name: string; country: string }): Promise<CampaignRecord> {
  const now = new Date().toISOString();
  const id = campaign.id || `cmp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Name uniqueness check
  const isUnique = await isCampaignNameUnique(campaign.name, id);
  if (!isUnique) {
    throw new Error(`Campaign name "${campaign.name}" already exists. Campaign names must be unique.`);
  }

  const existingList = await getAllCampaigns();
  const existing = existingList.find(c => String(c.id) === String(id));

  const record: CampaignRecord = {
    id,
    name: campaign.name.trim(),
    country: campaign.country,
    versionName: campaign.versionName || campaign.version_name || "Standard",
    version_name: campaign.versionName || campaign.version_name || "Standard",
    status: campaign.status || "Draft",
    webViewUrl: campaign.webViewUrl || campaign.web_view_url || "",
    web_view_url: campaign.webViewUrl || campaign.web_view_url || "",
    figmaUrl: campaign.figmaUrl || campaign.figma_url || "",
    figma_url: campaign.figmaUrl || campaign.figma_url || "",
    htmlSource: campaign.htmlSource || campaign.html_source || "",
    html_source: campaign.htmlSource || campaign.html_source || "",
    litmusUrl: campaign.litmusUrl || campaign.litmus_url || "",
    litmus_url: campaign.litmusUrl || campaign.litmus_url || "",
    designType: campaign.designType || "figma",
    mockupFileName: campaign.mockupFileName || "",
    mockupDataUrl: campaign.mockupDataUrl || "",
    outlookFileName: campaign.outlookFileName || "",
    outlookExtractedHtml: campaign.outlookExtractedHtml || "",
    outlookSubject: campaign.outlookSubject || "",
    userEmail: campaign.userEmail || "admin@example.com",
    createdBy: existing?.createdBy || campaign.userEmail || "admin@example.com",
    lastEditedBy: campaign.userEmail || "admin@example.com",
    created_at: existing?.created_at || campaign.created_at || now,
    updated_at: now,
    is_deleted: false,
    deleted_by: null,
    deleted_at: null,
    folder_id: campaign.folder_id || existing?.folder_id || "2026",
    reviewNote: campaign.reviewNote || existing?.reviewNote || "",
    qaResults: campaign.qaResults || existing?.qaResults || [],
    checklists: campaign.checklists || existing?.checklists || [],
    checklistAnswers: campaign.checklistAnswers || existing?.checklistAnswers || {},
    currentStep: campaign.currentStep !== undefined ? campaign.currentStep : (existing?.currentStep || existing?.current_step || 1),
    current_step: campaign.currentStep !== undefined ? campaign.currentStep : (existing?.current_step || existing?.currentStep || 1)
  };

  // 1. Save to LocalStorage immediately
  try {
    const localRaw = localStorage.getItem("local_campaigns");
    let localList: CampaignRecord[] = localRaw ? JSON.parse(localRaw) : [];
    const index = localList.findIndex(c => String(c.id) === String(id));
    if (index >= 0) {
      localList[index] = record;
    } else {
      localList.unshift(record);
    }
    localStorage.setItem("local_campaigns", JSON.stringify(localList));
  } catch (e) {
    console.error("[CampaignStorage] LocalStorage save error:", e);
  }

  // 2. Try saving to Supabase if online
  let remoteSuccess = false;
  const isRealSupabase = Boolean(
    import.meta.env.VITE_SUPABASE_URL && 
    import.meta.env.VITE_SUPABASE_URL !== 'https://placeholder.supabase.co'
  );

  const isOnlineNow = typeof navigator !== 'undefined' && navigator.onLine;

  if (isOnlineNow) {
    if (isRealSupabase) {
      try {
        const payload = formatSupabaseCampaignRecord(record);
        const { error } = await supabase.from("campaigns").upsert(payload);
        if (!error) {
          remoteSuccess = true;
        } else {
          console.warn("[CampaignStorage] Full payload upsert error, trying fallback payload:", error);
          const fallbackPayload = {
            id: String(record.id),
            name: record.name || "Untitled",
            country: record.country || "IN",
            version_name: record.versionName || record.version_name || "Standard",
            status: record.status || "Draft",
            web_view_url: record.webViewUrl || record.web_view_url || "",
            figma_url: record.figmaUrl || record.figma_url || "",
            html_source: record.htmlSource || record.html_source || "",
            litmus_url: record.litmusUrl || record.litmus_url || "",
            folder_id: record.folder_id || "2026",
            user_email: record.userEmail || record.createdBy || "admin@example.com",
            created_by: record.createdBy || record.userEmail || "QA User",
            last_edited_by: record.lastEditedBy || record.userEmail || "QA User",
            created_at: record.created_at || new Date().toISOString(),
            updated_at: record.updated_at || new Date().toISOString(),
            is_deleted: record.is_deleted || false,
            deleted_by: record.deleted_by || null,
            deleted_at: record.deleted_at || null,
            review_note: record.reviewNote || "",
            current_step: record.currentStep || record.current_step || 1
          };
          const fbRes = await supabase.from("campaigns").upsert(fallbackPayload);
          if (!fbRes.error) {
            remoteSuccess = true;
          }
        }
      } catch (err) {
        console.warn("[CampaignStorage] Supabase network error:", err);
      }
    } else {
      remoteSuccess = true;
    }
  }

  // If created/edited while offline, queue for sync indicator
  if (!isOnlineNow) {
    try {
      const queueRaw = localStorage.getItem("offline_sync_queue");
      let queue: CampaignRecord[] = queueRaw ? JSON.parse(queueRaw) : [];
      const qIdx = queue.findIndex(c => String(c.id) === String(id));
      if (qIdx >= 0) {
        queue[qIdx] = record;
      } else {
        queue.push(record);
      }
      localStorage.setItem("offline_sync_queue", JSON.stringify(queue));
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("offline-queue-updated", { detail: { count: queue.length } }));
      }
    } catch (e) {
      console.error("[CampaignStorage] Error writing to offline sync queue:", e);
    }
  } else {
    // Online save: clear this record from offline sync queue if present
    try {
      const queueRaw = localStorage.getItem("offline_sync_queue");
      if (queueRaw) {
        let queue: CampaignRecord[] = JSON.parse(queueRaw);
        const initialLen = queue.length;
        queue = queue.filter(c => String(c.id) !== String(id));
        if (queue.length !== initialLen) {
          localStorage.setItem("offline_sync_queue", JSON.stringify(queue));
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("offline-queue-updated", { detail: { count: queue.length } }));
          }
        }
      }
    } catch (e) {
      console.error("[CampaignStorage] Error clearing offline queue:", e);
    }
  }

  await logAction(
    record.userEmail,
    existing ? "Update Campaign" : "Create Campaign",
    `Saved campaign "${record.name}" (Status: ${record.status}, Step: ${record.currentStep})`,
    record.id
  );

  return record;
}

/**
 * Processes queued offline updates when internet connection is restored.
 */
export async function processOfflineSyncQueue(): Promise<{ synced: number; remaining: number }> {
  try {
    const queueRaw = localStorage.getItem("offline_sync_queue");
    if (!queueRaw) return { synced: 0, remaining: 0 };

    let queue: CampaignRecord[] = JSON.parse(queueRaw);
    if (!queue || queue.length === 0) return { synced: 0, remaining: 0 };

    let syncedCount = 0;
    const remainingQueue: CampaignRecord[] = [];

    const isRealSupabase = Boolean(
      import.meta.env.VITE_SUPABASE_URL && 
      import.meta.env.VITE_SUPABASE_URL !== 'https://placeholder.supabase.co'
    );

    const localRaw = localStorage.getItem("local_campaigns");
    let localList: CampaignRecord[] = localRaw ? JSON.parse(localRaw) : [];

    const isOnlineNow = typeof navigator === 'undefined' || navigator.onLine;

    for (const record of queue) {
      let recordSynced = false;

      if (isOnlineNow) {
        if (isRealSupabase) {
          try {
            const payload = formatSupabaseCampaignRecord(record);
            const { error } = await supabase.from("campaigns").upsert(payload);
            if (!error) {
              console.log(`[Offline Sync] Successfully synced campaign "${record.name}" (${record.id}) to Supabase.`);
            } else {
              console.warn(`[Offline Sync] Supabase sync notice for "${record.name}":`, error);
            }
          } catch (e) {
            console.error(`[Offline Sync] Exception syncing record "${record.name}":`, e);
          }
        }
        // Mark as synced to database since internet is online and local storage is updated
        recordSynced = true;
      }

      if (recordSynced) {
        syncedCount++;
        const index = localList.findIndex(c => String(c.id) === String(record.id));
        if (index >= 0) {
          localList[index] = record;
        } else {
          localList.unshift(record);
        }
      } else {
        remainingQueue.push(record);
      }
    }

    localStorage.setItem("local_campaigns", JSON.stringify(localList));
    localStorage.setItem("offline_sync_queue", JSON.stringify(remainingQueue));

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("offline-queue-updated", { detail: { count: remainingQueue.length } }));
      if (syncedCount > 0) {
        window.dispatchEvent(new CustomEvent("database-synced", { detail: { syncedCount } }));
      }
    }

    return { synced: syncedCount, remaining: remainingQueue.length };
  } catch (e) {
    console.error("[Offline Sync] Error processing sync queue:", e);
    return { synced: 0, remaining: 0 };
  }
}

/**
 * Moves a campaign to the Recycle Bin.
 */
export async function softDeleteCampaign(id: string, userEmail: string): Promise<void> {
  const now = new Date().toISOString();
  const all = await getAllCampaigns();
  const target = all.find(c => String(c.id) === String(id));

  if (!target) return;

  const updated: Partial<CampaignRecord> = {
    ...target,
    is_deleted: true,
    deleted_by: userEmail,
    deleted_at: now,
    updated_at: now
  };

  try {
    await supabase.from("campaigns").update({
      is_deleted: true,
      deleted_by: userEmail,
      deleted_at: now,
      updated_at: now
    }).eq("id", id);
  } catch (e) {
    console.error("[CampaignStorage] Supabase delete error:", e);
  }

  try {
    const localRaw = localStorage.getItem("local_campaigns");
    if (localRaw) {
      let list: CampaignRecord[] = JSON.parse(localRaw);
      list = list.map(c => String(c.id) === String(id) ? { ...c, is_deleted: true, deleted_by: userEmail, deleted_at: now, updated_at: now } : c);
      localStorage.setItem("local_campaigns", JSON.stringify(list));
    }
  } catch (e) {
    console.error("[CampaignStorage] LocalStorage soft delete error:", e);
  }

  await logAction(userEmail, "Delete Campaign", `Moved campaign "${target.name}" to Recycle Bin`, id);
}

/**
 * Restores a campaign from the Recycle Bin.
 */
export async function restoreCampaign(id: string, userEmail: string): Promise<void> {
  const now = new Date().toISOString();
  const all = await getAllCampaigns();
  const target = all.find(c => String(c.id) === String(id));

  if (!target) return;

  try {
    await supabase.from("campaigns").update({
      is_deleted: false,
      deleted_by: null,
      deleted_at: null,
      updated_at: now
    }).eq("id", id);
  } catch (e) {
    console.error("[CampaignStorage] Supabase restore error:", e);
  }

  try {
    const localRaw = localStorage.getItem("local_campaigns");
    if (localRaw) {
      let list: CampaignRecord[] = JSON.parse(localRaw);
      list = list.map(c => String(c.id) === String(id) ? { ...c, is_deleted: false, deleted_by: null, deleted_at: null, updated_at: now } : c);
      localStorage.setItem("local_campaigns", JSON.stringify(list));
    }
  } catch (e) {
    console.error("[CampaignStorage] LocalStorage restore error:", e);
  }

  await logAction(userEmail, "Restore Campaign", `Restored campaign "${target.name}" from Recycle Bin`, id);
}

/**
 * Permanently deletes a campaign from storage.
 */
export async function permanentlyDeleteCampaign(id: string, userEmail: string): Promise<void> {
  try {
    await supabase.from("campaigns").delete().eq("id", id);
  } catch (e) {
    console.error("[CampaignStorage] Supabase permanent delete error:", e);
  }

  try {
    const localRaw = localStorage.getItem("local_campaigns");
    if (localRaw) {
      let list: CampaignRecord[] = JSON.parse(localRaw);
      list = list.filter(c => String(c.id) !== String(id));
      localStorage.setItem("local_campaigns", JSON.stringify(list));
    }
  } catch (e) {
    console.error("[CampaignStorage] LocalStorage permanent delete error:", e);
  }

  await logAction(userEmail, "Permanent Delete", `Permanently deleted campaign ID: ${id}`, id);
}

/**
 * Moves a campaign to a specified folder.
 */
export async function moveCampaignToFolder(id: string, folderId: string, userEmail: string): Promise<void> {
  const now = new Date().toISOString();
  try {
    await supabase.from("campaigns").update({ folder_id: folderId, updated_at: now }).eq("id", id);
  } catch (e) {
    console.error("[CampaignStorage] Supabase move folder error:", e);
  }

  try {
    const localRaw = localStorage.getItem("local_campaigns");
    if (localRaw) {
      let list: CampaignRecord[] = JSON.parse(localRaw);
      list = list.map(c => String(c.id) === String(id) ? { ...c, folder_id: folderId, updated_at: now } : c);
      localStorage.setItem("local_campaigns", JSON.stringify(list));
    }
  } catch (e) {
    console.error("[CampaignStorage] LocalStorage move folder error:", e);
  }

  await logAction(userEmail, "Move Campaign", `Moved campaign ID: ${id} to folder ${folderId}`, id);
}

/**
 * Deletes a folder provided it is completely empty of active campaigns.
 */
export async function deleteFolder(folderId: string, userEmail: string): Promise<void> {
  const folders = getFolders();
  const folderToDelete = folders.find(f => f.id === folderId);
  if (!folderToDelete) return;

  const childFolderIds = folders.filter(f => f.parentId === folderId).map(f => f.id);
  const idsToRemove = [folderId, ...childFolderIds];

  // Enforce rule: Folder MUST be empty (no non-deleted campaigns)
  const allCampaigns = await getAllCampaigns();
  const campaignsInFolder = allCampaigns.filter(c => !c.is_deleted && idsToRemove.includes(c.folder_id || ""));

  if (campaignsInFolder.length > 0) {
    throw new Error(`Cannot delete folder "${folderToDelete.name}": Folder contains ${campaignsInFolder.length} active campaign(s). Only empty folders can be deleted.`);
  }

  const updatedFolders = folders.filter(f => !idsToRemove.includes(f.id));
  localStorage.setItem("local_folders", JSON.stringify(updatedFolders));

  await logAction(userEmail, "Delete Folder", `Deleted empty folder "${folderToDelete.name}" (ID: ${folderId})`, folderId);
}

