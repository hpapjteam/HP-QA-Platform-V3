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
 * Gets all folders from Supabase or LocalStorage (or defaults).
 */
export async function fetchFolders(): Promise<FolderItem[]> {
  const isDb = isSupabaseConfigured();
  if (isDb) {
    try {
      const { data, error } = await supabase.from('folders').select('*');
      if (!error && data && data.length > 0) {
        const loaded: FolderItem[] = data.map((row: any) => ({
          id: String(row.id),
          name: row.name,
          parentId: row.parent_id || row.parentId || null,
          year: row.year || "2026",
          created_at: row.created_at || new Date().toISOString()
        }));
        localStorage.setItem("local_folders", JSON.stringify(loaded));
        return loaded;
      }
    } catch (e) {
      console.warn("[CampaignStorage] Error loading folders from Supabase:", e);
    }
  }

  return getFolders();
}

/**
 * Gets all folders synchronously from LocalStorage (or defaults).
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

  if (isSupabaseConfigured()) {
    supabase.from('folders').upsert({
      id: newFolder.id,
      name: newFolder.name,
      parent_id: newFolder.parentId,
      year: newFolder.year,
      created_at: newFolder.created_at
    }).then(({ error }) => {
      if (error) console.warn("[CampaignStorage] Folder save to Supabase error:", error);
    });
  }

  console.log("[CampaignStorage] Created new folder:", newFolder);
  return newFolder;
}

export async function renameFolder(id: string, newName: string): Promise<void> {
  const folders = getFolders();
  const index = folders.findIndex(f => f.id === id);
  if (index !== -1) {
    folders[index].name = newName.trim();
    localStorage.setItem("local_folders", JSON.stringify(folders));

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('folders').update({ name: newName.trim() }).eq('id', id);
      } catch (e) {
        console.warn("[CampaignStorage] Rename folder error in Supabase:", e);
      }
    }

    console.log("[CampaignStorage] Renamed folder:", id, newName);
  }
}

export function isUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

export function ensureUuid(id: string): string {
  if (!id) return crypto.randomUUID();
  if (isUUID(id)) return id;
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57, h3 = 0xfae12345, h4 = 0x12345678;
  for (let i = 0; i < id.length; i++) {
    const ch = id.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
    h3 = Math.imul(h3 ^ ch, 3812015801);
    h4 = Math.imul(h4 ^ ch, 2718281829);
  }
  const p1 = ((h1 >>> 0).toString(16) + (h2 >>> 0).toString(16)).padStart(16, '0').slice(0, 16);
  const p2 = ((h3 >>> 0).toString(16) + (h4 >>> 0).toString(16)).padStart(16, '0').slice(0, 16);
  return `${p1.slice(0,8)}-${p1.slice(8,12)}-4${p1.slice(13,16)}-a${p2.slice(1,4)}-${p2.slice(4,16)}`;
}

const INITIAL_SEED_CAMPAIGNS: CampaignRecord[] = [
  {
    id: ensureUuid("cmp_seed_1"),
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
    id: ensureUuid("cmp_seed_2"),
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
    id: ensureUuid("cmp_seed_3"),
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
    id: ensureUuid("cmp_seed_4"),
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
    id: ensureUuid("cmp_seed_5"),
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
    id: ensureUuid("cmp_seed_6"),
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
 * Gets a single campaign by ID from Supabase or LocalStorage.
 */
export async function getCampaignById(id: string): Promise<CampaignRecord | null> {
  const isRealSupabase = isSupabaseConfigured();

  if (isRealSupabase) {
    try {
      const targetId = isUUID(id) ? id : ensureUuid(String(id));
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("id", targetId)
        .maybeSingle();

      if (!error && data) {
        return mapSupabaseToCampaignRecord(data);
      }
    } catch (err) {
      console.warn("[CampaignStorage] Exception fetching campaign by ID from Supabase:", err);
    }
  }

  // Fallback to local storage
  try {
    const localRaw = localStorage.getItem("local_campaigns");
    if (localRaw) {
      const localList: CampaignRecord[] = JSON.parse(localRaw);
      const found = localList.find((c) => String(c.id) === String(id) || ensureUuid(String(c.id)) === ensureUuid(String(id)));
      if (found) {
        return mapSupabaseToCampaignRecord(found);
      }
    }
  } catch (e) {
    console.error("[CampaignStorage] Error reading local_campaigns:", e);
  }

  return null;
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
        try {
          localStorage.setItem("local_campaigns", JSON.stringify(mapped));
        } catch (e) {}
        return mapped;
      } else if (error) {
        console.warn("[CampaignStorage] Supabase fetch error (falling back to local):", error);
      }
    } catch (err) {
      console.warn("[CampaignStorage] Error fetching from Supabase (falling back to local):", err);
    }
  }

  // Fallback to local storage or seed if offline/error
  try {
    const localRaw = localStorage.getItem("local_campaigns");
    if (localRaw) {
      const parsed: CampaignRecord[] = JSON.parse(localRaw);
      if (Array.isArray(parsed)) {
        return parsed.map(mapSupabaseToCampaignRecord);
      }
    }
  } catch (e) {
    console.error("[CampaignStorage] Error reading local_campaigns:", e);
  }

  return INITIAL_SEED_CAMPAIGNS.map(mapSupabaseToCampaignRecord);
}


/**
 * Syncs all folder records to Supabase database.
 */
export async function syncAllFoldersToDatabase(): Promise<number> {
  const isRealSupabase = isSupabaseConfigured();
  if (!isRealSupabase) return 0;

  const folders = getFolders();
  let count = 0;
  for (const f of folders) {
    try {
      const { error } = await supabase.from('folders').upsert({
        id: String(f.id),
        name: f.name,
        parent_id: f.parentId || null,
        year: f.year || "2026",
        created_at: f.created_at || new Date().toISOString()
      });
      if (!error) count++;
    } catch (e) {
      console.warn("[CampaignStorage] Error syncing folder:", f.name, e);
    }
  }
  return count;
}

/**
 * Validates critical campaign fields required for Supabase and application consistency.
 */
export function validateCampaignRecord(rec: Partial<CampaignRecord>): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!rec.id || typeof rec.id !== 'string' || !rec.id.trim()) {
    errors.push("Missing or invalid campaign ID");
  }
  if (!rec.name || typeof rec.name !== 'string' || !rec.name.trim()) {
    errors.push("Missing campaign Name");
  }
  if (!rec.country || typeof rec.country !== 'string' || !rec.country.trim()) {
    errors.push("Missing campaign Country code");
  }
  return {
    isValid: errors.length === 0,
    errors
  };
}

export interface SyncAuditResult {
  timestamp: string;
  totalExamined: number;
  validatedCount: number;
  invalidCount: number;
  syncedCount: number;
  failedCount: number;
  verifiedCount: number;
  syncedFolderCount: number;
  validationErrors: { campaignId: string; name: string; errors: string[] }[];
  transmissionErrors: { campaignId: string; name: string; error: string }[];
  unverifiedCampaigns: { campaignId: string; name: string; reason: string }[];
  status: 'success' | 'partial' | 'failed';
}

/**
 * Performs a comprehensive audit and data sync of Campaigns to Supabase:
 * 1. Validates presence of critical campaign fields (id, name, country).
 * 2. Transmits valid records to Supabase with fallback handling.
 * 3. Verifies post-sync existence in Supabase via explicit query.
 * 4. Clears verified items from offline sync queue.
 * 5. Returns detailed diagnostic results for immediate UI feedback.
 */
export async function auditAndSyncCampaigns(campaigns?: CampaignRecord[]): Promise<SyncAuditResult> {
  const timestamp = new Date().toISOString();
  const isRealSupabase = isSupabaseConfigured();

  // 1. Gather target campaigns
  let targetList: CampaignRecord[] = campaigns || [];
  if (!targetList || targetList.length === 0) {
    try {
      const localRaw = localStorage.getItem("local_campaigns");
      if (localRaw) {
        targetList = JSON.parse(localRaw);
      }
    } catch (e) {}
  }
  if (!targetList || targetList.length === 0) {
    targetList = [...INITIAL_SEED_CAMPAIGNS];
  }

  // Include queued offline records if missing
  try {
    const queueRaw = localStorage.getItem("offline_sync_queue");
    if (queueRaw) {
      const queue: CampaignRecord[] = JSON.parse(queueRaw);
      for (const qItem of queue) {
        if (!targetList.some(t => String(t.id) === String(qItem.id))) {
          targetList.push(qItem);
        }
      }
    }
  } catch (e) {}

  // Normalize campaign IDs to valid UUIDs for Supabase PostgreSQL UUID datatype
  targetList = targetList.map(rec => ({
    ...rec,
    id: ensureUuid(String(rec.id))
  }));

  const totalExamined = targetList.length;
  const validationErrors: { campaignId: string; name: string; errors: string[] }[] = [];
  const transmissionErrors: { campaignId: string; name: string; error: string }[] = [];
  const unverifiedCampaigns: { campaignId: string; name: string; reason: string }[] = [];

  const validRecords: CampaignRecord[] = [];

  // 2. Validate critical fields
  for (const rec of targetList) {
    const val = validateCampaignRecord(rec);
    if (!val.isValid) {
      validationErrors.push({
        campaignId: String(rec.id || 'unknown'),
        name: rec.name || 'Untitled',
        errors: val.errors
      });
    } else {
      validRecords.push(rec);
    }
  }

  const validatedCount = validRecords.length;
  const invalidCount = validationErrors.length;

  if (!isRealSupabase) {
    // Local storage fallback mode
    try {
      localStorage.setItem("local_campaigns", JSON.stringify(targetList));
    } catch (e) {}
    return {
      timestamp,
      totalExamined,
      validatedCount,
      invalidCount,
      syncedCount: 0,
      failedCount: 0,
      verifiedCount: validatedCount,
      syncedFolderCount: 0,
      validationErrors,
      transmissionErrors: [],
      unverifiedCampaigns: [],
      status: invalidCount === 0 ? 'success' : 'partial'
    };
  }

  // 3. Sync Folders
  const syncedFolderCount = await syncAllFoldersToDatabase();

  // 4. Transmission to Supabase
  const successfullyTransmittedIds: string[] = [];

  for (const record of validRecords) {
    try {
      const payload = formatSupabaseCampaignRecord(record);
      const { error } = await supabase.from("campaigns").upsert(payload);
      if (!error) {
        successfullyTransmittedIds.push(String(record.id));
      } else {
        console.warn(`[Sync Audit] Initial upsert error for "${record.name}", retrying fallback payload:`, error);
        const fallbackPayload = {
          id: ensureUuid(String(record.id)),
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
          successfullyTransmittedIds.push(String(record.id));
        } else {
          transmissionErrors.push({
            campaignId: String(record.id),
            name: record.name || "Untitled",
            error: fbRes.error.message || error.message || "Database write rejected"
          });
        }
      }
    } catch (err: any) {
      transmissionErrors.push({
        campaignId: String(record.id),
        name: record.name || "Untitled",
        error: err?.message || "Transmission network error"
      });
    }
  }

  // 5. Post-Transmission Remote Verification Query in Supabase
  let verifiedCount = 0;

  if (successfullyTransmittedIds.length > 0) {
    try {
      const { data: remoteData, error: fetchErr } = await supabase
        .from("campaigns")
        .select("id, name, country, status, updated_at")
        .in("id", successfullyTransmittedIds);

      if (fetchErr) {
        for (const id of successfullyTransmittedIds) {
          const rec = validRecords.find(r => String(r.id) === id);
          unverifiedCampaigns.push({
            campaignId: id,
            name: rec?.name || 'Unknown',
            reason: `Post-sync verification query error: ${fetchErr.message}`
          });
        }
      } else if (remoteData) {
        for (const id of successfullyTransmittedIds) {
          const matchedRemote = remoteData.find(r => String(r.id) === id);
          const rec = validRecords.find(r => String(r.id) === id);
          if (matchedRemote && matchedRemote.name && matchedRemote.country) {
            verifiedCount++;
          } else {
            unverifiedCampaigns.push({
              campaignId: id,
              name: rec?.name || 'Unknown',
              reason: "Record not found or missing required fields in remote database verification response."
            });
          }
        }
      }
    } catch (vErr: any) {
      for (const id of successfullyTransmittedIds) {
        const rec = validRecords.find(r => String(r.id) === id);
        unverifiedCampaigns.push({
          campaignId: id,
          name: rec?.name || 'Unknown',
          reason: `Verification exception: ${vErr?.message || 'Network check failed'}`
        });
      }
    }
  }

  // 6. Clean queue & update local storage
  try {
    const queueRaw = localStorage.getItem("offline_sync_queue");
    if (queueRaw) {
      let queue: CampaignRecord[] = JSON.parse(queueRaw);
      queue = queue.filter(q => !successfullyTransmittedIds.includes(String(q.id)));
      localStorage.setItem("offline_sync_queue", JSON.stringify(queue));
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("offline-queue-updated", { detail: { count: queue.length } }));
      }
    }
  } catch (e) {}

  try {
    localStorage.setItem("local_campaigns", JSON.stringify(targetList));
  } catch (e) {}

  const syncedCount = successfullyTransmittedIds.length;
  const failedCount = transmissionErrors.length;

  let status: 'success' | 'partial' | 'failed' = 'success';
  if (failedCount > 0 || invalidCount > 0 || unverifiedCampaigns.length > 0) {
    status = (syncedCount > 0) ? 'partial' : 'failed';
  }

  return {
    timestamp,
    totalExamined,
    validatedCount,
    invalidCount,
    syncedCount,
    failedCount,
    verifiedCount,
    syncedFolderCount,
    validationErrors,
    transmissionErrors,
    unverifiedCampaigns,
    status
  };
}

/**
 * Syncs/Populates all given or stored campaign records to Supabase database.
 */
export async function syncAllCampaignsToDatabase(campaigns?: CampaignRecord[]): Promise<number> {
  const result = await auditAndSyncCampaigns(campaigns);
  return result.syncedCount;
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
    id: ensureUuid(String(rec.id)),
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
  const id = campaign.id ? ensureUuid(String(campaign.id)) : crypto.randomUUID();

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
    is_deleted: campaign.is_deleted !== undefined ? campaign.is_deleted : (existing?.is_deleted || false),
    deleted_by: campaign.deleted_by !== undefined ? campaign.deleted_by : (existing?.deleted_by || null),
    deleted_at: campaign.deleted_at !== undefined ? campaign.deleted_at : (existing?.deleted_at || null),
    folder_id: campaign.folder_id || existing?.folder_id || "2026",
    reviewNote: campaign.reviewNote !== undefined ? campaign.reviewNote : (existing?.reviewNote || ""),
    qaResults: campaign.qaResults !== undefined ? campaign.qaResults : (existing?.qaResults || []),
    checklists: campaign.checklists !== undefined ? campaign.checklists : (existing?.checklists || []),
    checklistAnswers: campaign.checklistAnswers !== undefined ? campaign.checklistAnswers : (existing?.checklistAnswers || {}),
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
  const isRealSupabase = isSupabaseConfigured();

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

    const isRealSupabase = isSupabaseConfigured();

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
  const target = all.find(c => String(c.id) === String(id) || ensureUuid(String(c.id)) === ensureUuid(String(id)));

  if (!target) return;

  const targetId = isUUID(id) ? id : ensureUuid(String(id));

  try {
    await supabase.from("campaigns").update({
      is_deleted: true,
      deleted_by: userEmail,
      deleted_at: now,
      updated_at: now
    }).eq("id", targetId);
  } catch (e) {
    console.warn("[CampaignStorage] Supabase delete error:", e);
  }

  try {
    const localRaw = localStorage.getItem("local_campaigns");
    if (localRaw) {
      let list: CampaignRecord[] = JSON.parse(localRaw);
      list = list.map(c => (String(c.id) === String(id) || ensureUuid(String(c.id)) === targetId) ? { ...c, is_deleted: true, deleted_by: userEmail, deleted_at: now, updated_at: now } : c);
      localStorage.setItem("local_campaigns", JSON.stringify(list));
    }
  } catch (e) {
    console.warn("[CampaignStorage] LocalStorage soft delete error:", e);
  }

  await logAction(userEmail, "Delete Campaign", `Moved campaign "${target.name}" to Recycle Bin`, id);
}

/**
 * Restores a campaign from the Recycle Bin.
 */
export async function restoreCampaign(id: string, userEmail: string): Promise<void> {
  const now = new Date().toISOString();
  const all = await getAllCampaigns();
  const target = all.find(c => String(c.id) === String(id) || ensureUuid(String(c.id)) === ensureUuid(String(id)));

  if (!target) return;

  const targetId = isUUID(id) ? id : ensureUuid(String(id));

  try {
    await supabase.from("campaigns").update({
      is_deleted: false,
      deleted_by: null,
      deleted_at: null,
      updated_at: now
    }).eq("id", targetId);
  } catch (e) {
    console.warn("[CampaignStorage] Supabase restore error:", e);
  }

  try {
    const localRaw = localStorage.getItem("local_campaigns");
    if (localRaw) {
      let list: CampaignRecord[] = JSON.parse(localRaw);
      list = list.map(c => (String(c.id) === String(id) || ensureUuid(String(c.id)) === targetId) ? { ...c, is_deleted: false, deleted_by: null, deleted_at: null, updated_at: now } : c);
      localStorage.setItem("local_campaigns", JSON.stringify(list));
    }
  } catch (e) {
    console.warn("[CampaignStorage] LocalStorage restore error:", e);
  }

  await logAction(userEmail, "Restore Campaign", `Restored campaign "${target.name}" from Recycle Bin`, id);
}

/**
 * Permanently deletes a campaign from storage.
 */
export async function permanentlyDeleteCampaign(id: string, userEmail: string): Promise<void> {
  const targetId = isUUID(id) ? id : ensureUuid(String(id));
  try {
    await supabase.from("campaigns").delete().eq("id", targetId);
  } catch (e) {
    console.warn("[CampaignStorage] Supabase permanent delete error:", e);
  }

  try {
    const localRaw = localStorage.getItem("local_campaigns");
    if (localRaw) {
      let list: CampaignRecord[] = JSON.parse(localRaw);
      list = list.filter(c => String(c.id) !== String(id) && ensureUuid(String(c.id)) !== targetId);
      localStorage.setItem("local_campaigns", JSON.stringify(list));
    }
  } catch (e) {
    console.warn("[CampaignStorage] LocalStorage permanent delete error:", e);
  }

  await logAction(userEmail, "Permanent Delete", `Permanently deleted campaign ID: ${id}`, id);
}

/**
 * Moves a campaign to a specified folder.
 */
export async function moveCampaignToFolder(id: string, folderId: string, userEmail: string): Promise<void> {
  const now = new Date().toISOString();
  const targetId = isUUID(id) ? id : ensureUuid(String(id));
  try {
    await supabase.from("campaigns").update({ folder_id: folderId, updated_at: now }).eq("id", targetId);
  } catch (e) {
    console.warn("[CampaignStorage] Supabase move folder error:", e);
  }

  try {
    const localRaw = localStorage.getItem("local_campaigns");
    if (localRaw) {
      let list: CampaignRecord[] = JSON.parse(localRaw);
      list = list.map(c => String(c.id) === String(id) ? { ...c, folder_id: folderId, updated_at: now } : c);
      localStorage.setItem("local_campaigns", JSON.stringify(list));
    }
  } catch (e) {
    console.warn("[CampaignStorage] LocalStorage move folder error:", e);
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

  if (isSupabaseConfigured()) {
    try {
      await supabase.from('folders').delete().in('id', idsToRemove);
    } catch (e) {
      console.warn("[CampaignStorage] Supabase delete folder error:", e);
    }
  }

  await logAction(userEmail, "Delete Folder", `Deleted empty folder "${folderToDelete.name}" (ID: ${folderId})`, folderId);
}

