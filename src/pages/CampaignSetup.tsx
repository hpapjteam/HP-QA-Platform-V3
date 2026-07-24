import React, { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { QAWizard } from "@/src/components/QAWizard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { validateCampaignHTML } from "@/lib/qa-validator";
import { fetchAndValidateCountryUrls, fetchAllowedUrlPattern } from "@/lib/url-validator";
import { isCampaignNameUnique, saveCampaignRecord, getFolders, FolderItem } from "@/lib/campaign-storage";
import { logAction, getCampaignLogs } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import { useNavigate, useSearchParams } from "react-router-dom";
import { 
  FileCheck, 
  UploadCloud, 
  Monitor, 
  Smartphone, 
  Check, 
  Copy, 
  MonitorSmartphone, 
  Code2, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  ClipboardList, 
  History, 
  Layers, 
  Mail, 
  Image as ImageIcon, 
  Figma, 
  Undo, 
  Redo, 
  RotateCcw,
  Clock,
  Trash2,
  Sparkles,
  Folder,
  Maximize2,
  Minimize2,
  Tag,
  Link,
  ExternalLink,
  Tablet,
  Eye,
  CheckSquare,
  Square,
  Save
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const STEPS = [
  { id: "details", title: "Details & Source" },
  { id: "preview", title: "Preview & QA Validation" },
  { id: "grammar", title: "Grammar & Spell Check" },
  { id: "uploads", title: "Uploads & Links" },
  { id: "review", title: "Review & Decision" }
];

const formSchema = z.object({
  name: z.string().min(2, "Campaign name is required and must be at least 2 characters."),
  team: z.string().min(1, "Team selection is required."),
  country: z.string().min(1, "Country selection is required."),
  versionName: z.string().min(1, "Version selection is required."),
  folder_id: z.string().min(1, "Destination folder selection is required."),
  webViewUrl: z.string().min(1, "View Online link is required."),
  htmlSource: z.string().min(10, "HTML source code is required."),
  figmaUrl: z.string().optional(),
  litmusUrl: z.string().optional()
});

type FormValues = z.infer<typeof formSchema>;

export function CampaignSetup({ userEmail }: { userEmail?: string }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [countries, setCountries] = useState<any[]>([]);
  const [qaResults, setQaResults] = useState<any[]>([]);
  const [previewTab, setPreviewTab] = useState<"webview" | "html" | "qa" | "compare">("compare");
  const [viewportSize, setViewportSize] = useState<"desktop" | "mobile">("desktop");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  
  // File states
  const [briefFile, setBriefFile] = useState<File | null>(null);
  const [outlookFile, setOutlookFile] = useState<File | null>(null);
  const [mockupFile, setMockupFile] = useState<File | null>(null);
  const [mockupPreviewUrl, setMockupPreviewUrl] = useState<string | null>(null);
  
  // Design Choice State (Either Figma OR Uploaded Mockup Image)
  const [designChoice, setDesignChoice] = useState<"figma" | "image">("figma");

  // Extracted Outlook Subject Line
  const [outlookSubject, setOutlookSubject] = useState<string | null>(null);
  const [outlookFileName, setOutlookFileName] = useState<string | null>(null);
  const [outlookExtractedHtml, setOutlookExtractedHtml] = useState<string | null>(null);

  // Compare split-screen tabs
  const [leftCompareTab, setLeftCompareTab] = useState<"webview" | "outlook" | "html">("webview");

  // Fullscreen & Inspection States
  const [fullScreenTarget, setFullScreenTarget] = useState<"html" | "webview" | "step1" | "step2" | "step3" | "step4" | null>(null);
  const [showAliasInspector, setShowAliasInspector] = useState(false);
  const [showAltInspector, setShowAltInspector] = useState(false);
  const [viewOnlineDevice, setViewOnlineDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");

  // Review note and edit logs state
  const [reviewNote, setReviewNote] = useState("");
  const [campaignLogs, setCampaignLogs] = useState<any[]>([]);
  const [campaignStatus, setCampaignStatus] = useState<string>("Draft");

  const [grammarCheckResult, setGrammarCheckResult] = useState<string | null>(null);
  const [isCheckingGrammar, setIsCheckingGrammar] = useState(false);

  const [teamChecklists, setTeamChecklists] = useState<any[]>([]);
  const [checkedCheckpoints, setCheckedCheckpoints] = useState<Record<string, boolean>>({});
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  
  const [viewOnlineError, setViewOnlineError] = useState(false);

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const editId = searchParams.get('id');
  const targetFolderParam = searchParams.get('folder_id');

  const { register, handleSubmit, control, formState: { errors }, watch, trigger, setError, clearErrors, setValue, reset } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      team: "",
      country: "",
      versionName: "",
      folder_id: targetFolderParam || "",
      webViewUrl: "",
      htmlSource: "",
      figmaUrl: "",
      litmusUrl: ""
    }
  });

  const availableFolders = getFolders();
  const values = watch();
  const [userTeam, setUserTeam] = useState<string>("");

  useEffect(() => {
    const fetchUserTeam = async () => {
      if (userEmail) {
        try {
          if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_URL !== 'https://placeholder.supabase.co') {
            const { data, error } = await supabase.from('app_users').select('team').eq('email', userEmail).single();
            if (data && data.team) {
              setUserTeam(data.team);
              if (!isEditMode) {
                setValue('team', data.team);
              }
            }
          } else {
             // Mock auth - fallback for test env
             setUserTeam("HP-APJ");
             if (!isEditMode) setValue('team', "HP-APJ");
          }
        } catch(e) {
          console.error("Failed to fetch user team:", e);
        }
      }
    };
    fetchUserTeam();
  }, [userEmail, isEditMode, setValue]);

  // Analysis helpers for Alias tags, Alt tags, and Link Check
  const aliasTagsInfo = React.useMemo(() => {
    const html = values.htmlSource || "";
    if (!html) return { total: 0, items: [], missingInAnchors: [] };
    const regex = /(?:alias|data-alias)=["']([^"']+)["']/gi;
    const items: { alias: string; tag: string }[] = [];
    let match;
    while ((match = regex.exec(html)) !== null) {
      items.push({ alias: match[1], tag: match[0] });
    }
    
    // Check anchors missing alias
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const anchors = Array.from(doc.querySelectorAll("a"));
    const missingInAnchors = anchors.filter(a => !a.getAttribute("alias") && !a.getAttribute("data-alias")).map(a => ({
      text: a.textContent?.trim() || a.querySelector("img")?.getAttribute("alt") || "Unlabeled Link",
      href: a.getAttribute("href") || "#"
    }));

    return { total: items.length, items, missingInAnchors };
  }, [values.htmlSource]);

  const altTagsInfo = React.useMemo(() => {
    const html = values.htmlSource || "";
    if (!html) return { total: 0, withAlt: [], missingAlt: [] };
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const imgs = Array.from(doc.querySelectorAll("img"));
    const withAlt: { src: string; alt: string }[] = [];
    const missingAlt: { src: string }[] = [];

    imgs.forEach(img => {
      const src = img.getAttribute("src") || "inline/unspecified";
      const alt = img.getAttribute("alt");
      if (alt !== null && alt.trim() !== "") {
        withAlt.push({ src, alt: alt.trim() });
      } else {
        missingAlt.push({ src });
      }
    });

    return { total: imgs.length, withAlt, missingAlt };
  }, [values.htmlSource]);

  const linkAuditInfo = React.useMemo(() => {
    const html = values.htmlSource || "";
    if (!html) return { total: 0, valid: [], missing: [] };
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const anchors = Array.from(doc.querySelectorAll("a"));
    const valid: { text: string; href: string }[] = [];
    const missing: { text: string; href: string; reason: string }[] = [];

    anchors.forEach(a => {
      const text = a.textContent?.trim() || a.querySelector("img")?.getAttribute("alt") || "Banner Link";
      const href = a.getAttribute("href")?.trim() || "";

      if (!href) {
        missing.push({ text, href: "(empty)", reason: "Missing href attribute" });
      } else if (href === "#" || href === "http://" || href === "https://") {
        missing.push({ text, href, reason: "Placeholder or empty link" });
      } else if (href.includes("example.com") || href.includes("YOUR_URL_HERE")) {
        missing.push({ text, href, reason: "Dummy placeholder URL" });
      } else {
        valid.push({ text, href });
      }
    });

    return { total: anchors.length, valid, missing };
  }, [values.htmlSource]);

  const refreshLogs = async (id?: string | null, name?: string) => {
    const logs = await getCampaignLogs(id || editId || undefined, name || values.name || undefined);
    setCampaignLogs(logs);
  };

  useEffect(() => {
    if (editId || values.name) {
      refreshLogs(editId, values.name);
    }
  }, [editId, values.name]);

  // Clear the view online error automatically when both fields are filled out
  useEffect(() => {
    if (values.country && values.versionName) {
      setViewOnlineError(false);
    }
  }, [values.country, values.versionName]);

  const handleViewOnlineClick = (action: () => void) => {
    if (!values.country || !values.versionName) {
      setViewOnlineError(true);
      return;
    }
    setViewOnlineError(false);
    action();
  };

  // Handle Outlook MSG File upload and Subject extraction
  const handleOutlookFileChange = (file: File | null) => {
    setOutlookFile(file);
    if (!file) {
      setOutlookExtractedHtml(null);
      setOutlookSubject(null);
      setOutlookFileName(null);
      return;
    }

    setOutlookFileName(file.name);
    console.log(`[Outlook Extraction] Processing file '${file.name}'...`);

    // Auto-detect subject from file name or raw text parse
    let extractedSubject = file.name.replace(/\.msg$/i, "").replace(/^email[_-]?/i, "");
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        // Try extracting subject line from MSG headers
        const subjectMatch = text.match(/(?:Subject|Thread-Topic)\s*[:=]\s*([^\r\n\x00-\x1F]+)/i);
        if (subjectMatch && subjectMatch[1]?.trim()) {
          extractedSubject = subjectMatch[1].trim();
        }

        const htmlMatch = text.match(/<html[\s\S]*?<\/html>/i) || text.match(/<!DOCTYPE html[\s\S]*?<\/html>/i);
        if (htmlMatch) {
          setOutlookExtractedHtml(htmlMatch[0]);
        } else {
          setOutlookExtractedHtml(null);
        }
      }
      setOutlookSubject(extractedSubject);
      console.log(`[Outlook Extraction] Extracted Subject Line: "${extractedSubject}"`);
      setLeftCompareTab("outlook");
    };
    reader.readAsText(file, "latin1");
  };

  const handleMockupImageChange = (file: File | null) => {
    setMockupFile(file);
    if (!file) {
      setMockupPreviewUrl(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setMockupPreviewUrl(e.target?.result as string);
      setDesignChoice("image");
    };
    reader.readAsDataURL(file);
  };

  const handleManualSave = async () => {
    const data = watch();
    if (!data.name || data.name.trim().length < 2) {
      alert("Please provide a valid Campaign Name (at least 2 characters) before saving.");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const record = await saveCampaignRecord({
        id: editId || undefined,
        name: data.name,
        team: data.team,
        country: data.country,
        versionName: data.versionName,
        folder_id: data.folder_id,
        webViewUrl: data.webViewUrl || "",
        htmlSource: data.htmlSource || "",
        figmaUrl: designChoice === "figma" ? (data.figmaUrl || "") : "",
        litmusUrl: data.litmusUrl || "",
        status: "Draft",
        createdBy: userEmail,
        lastEditedBy: userEmail
      });
      
      setCampaignStatus("Draft");
      setDraftSavedAt(new Date().toLocaleTimeString());
      if (!editId && record.id) {
        setSearchParams((prev) => {
          prev.set("id", record.id);
          return prev;
        });
      }
    } catch (e) {
      console.error("Manual save failed:", e);
      alert("Failed to save draft.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAll = () => {
    reset({
      name: "",
      team: "",
      country: "",
      versionName: "",
      folder_id: targetFolderParam || "",
      webViewUrl: "",
      htmlSource: "",
      figmaUrl: "",
      litmusUrl: ""
    });
    localStorage.removeItem("campaign_draft");
    setBriefFile(null);
    setOutlookFile(null);
    setMockupFile(null);
    setMockupPreviewUrl(null);
    setOutlookSubject(null);
    setOutlookFileName(null);
    setOutlookExtractedHtml(null);
    clearErrors();
    setQaResults([]);
    setDraftSavedAt(null);
    console.log("[CampaignSetup] All input fields and uploads reset.");
  };

  useEffect(() => {
    const loadedChecklists = localStorage.getItem("platform_checklists");
    if (loadedChecklists) {
      setTeamChecklists(JSON.parse(loadedChecklists));
    }
  }, []);

  useEffect(() => {
    if (editId) {
      setIsEditMode(true);
      const loadCampaign = async () => {
        console.log(`[CampaignSetup] Loading campaign ID '${editId}' for editing...`);
        let campaignData = null;

        try {
          if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_URL !== 'https://placeholder.supabase.co') {
            const { data, error } = await supabase.from('campaigns').select('*').eq('id', editId).single();
            if (error) {
              console.warn("[CampaignSetup] Could not fetch campaign from Supabase, falling back to local storage:", error);
            } else if (data) {
              campaignData = data;
            }
          }
        } catch (e) {
          console.warn("[CampaignSetup] Exception fetching campaign from Supabase, falling back to local storage:", e);
        }

        if (!campaignData) {
          const localRaw = localStorage.getItem("local_campaigns");
          if (localRaw) {
            try {
              const localList: any[] = JSON.parse(localRaw);
              const found = localList.find((c: any) => String(c.id) === String(editId));
              if (found) campaignData = found;
            } catch (err) {}
          }
        }

        if (campaignData) {
          setValue('name', campaignData.name || "");
          setValue('team', campaignData.team || "HP-APJ");
          setValue('country', campaignData.country || "");
          setValue('versionName', campaignData.version_name || campaignData.versionName || "");
          setValue('folder_id', campaignData.folder_id || targetFolderParam || "");
          setValue('webViewUrl', campaignData.web_view_url || campaignData.webViewUrl || "");
          setValue('htmlSource', campaignData.html_source || campaignData.htmlSource || "");
          setValue('figmaUrl', campaignData.figma_url || campaignData.figmaUrl || "");
          setValue('litmusUrl', campaignData.litmus_url || campaignData.litmusUrl || "");
          setCampaignStatus(campaignData.status || "QA Pending");
          if (campaignData.figma_url || campaignData.figmaUrl) setDesignChoice("figma");
          refreshLogs(editId, campaignData.name);
        }
      };
      loadCampaign();
    } else {
      // New Campaign: Must start completely blank
      setIsEditMode(false);
      setCampaignStatus("Draft");
      localStorage.removeItem("campaign_draft");
      reset({
        name: "",
        team: "",
        country: "",
        versionName: "",
        folder_id: targetFolderParam || "",
        webViewUrl: "",
        htmlSource: "",
        figmaUrl: "",
        litmusUrl: ""
      });
    }
  }, [editId, setValue, reset, targetFolderParam]);

  // Auto-save draft logic with unique campaign name validation
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const subscription = watch(async (value) => {
      
      if (value.name && value.name.trim().length >= 2) {
        const unique = await isCampaignNameUnique(value.name, editId);
        if (!unique) {
          setError("name", {
            type: "manual",
            message: `Campaign name '${value.name}' already exists. Please choose a unique campaign name.`
          });
        } else {
          clearErrors("name");
          
          clearTimeout(timeoutId);
          timeoutId = setTimeout(async () => {
            try {
               const record = await saveCampaignRecord({
                  id: editId || undefined,
                  name: value.name || "Untitled Campaign",
                  team: value.team || "HP-APJ",
                  country: value.country || "",
                  versionName: value.versionName || "",
                  folder_id: value.folder_id || "2026",
                  webViewUrl: value.webViewUrl || "",
                  htmlSource: value.htmlSource || "",
                  figmaUrl: designChoice === "figma" ? (value.figmaUrl || "") : "",
                  litmusUrl: value.litmusUrl || "",
                  status: "Draft",
                  createdBy: userEmail,
                  lastEditedBy: userEmail
               });
               
               setCampaignStatus("Draft");
               setDraftSavedAt(new Date().toLocaleTimeString());
               if (!editId && record.id) {
                 setSearchParams((prev) => {
                   prev.set("id", record.id);
                   return prev;
                 });
               }
            } catch (e) {
               console.error("Auto-save failed:", e);
            }
          }, 5000); // 5 seconds debounce
        }
      }
    });
    return () => {
      subscription.unsubscribe();
      clearTimeout(timeoutId);
    };
  }, [watch, editId, setError, clearErrors, campaignStatus, designChoice, userEmail, setSearchParams]);

  useEffect(() => {
    const fetchCountries = async () => {
      try {
        let hasData = false;
        if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_URL !== 'https://placeholder.supabase.co') {
          const { data, error } = await supabase.from('countries').select('*').order('name');
          if (data && data.length > 0) {
            setCountries(data);
            hasData = true;
          }
        }
        if (!hasData) {
          const localCountries = localStorage.getItem("local_countries");
          if (localCountries) setCountries(JSON.parse(localCountries));
        }
      } catch (err) {
        console.warn("[CampaignSetup] Exception during fetchCountries, falling back to local:", err);
      }
    };
    fetchCountries();

    const storedChecklists = localStorage.getItem("platform_checklists");
    if (storedChecklists) {
      setTeamChecklists(JSON.parse(storedChecklists));
    } else {
      const defaults = [
        { team: "HP-APJ", items: [{ id: "1", text: "Verify APJ specific legal compliance" }, { id: "2", text: "Check translations for APAC regions" }] },
        { team: "HP-EMEA", items: [{ id: "3", text: "Ensure GDPR compliance points are met" }, { id: "4", text: "Verify EMEA pricing formats" }] }
      ];
      setTeamChecklists(defaults);
      localStorage.setItem("platform_checklists", JSON.stringify(defaults));
    }
  }, []);

  const selectedCountryConfig = countries.find((c: any) => c.name === values.country && c.code === values.versionName);
  const expectedPrefix = selectedCountryConfig?.url;
  const rawWebViewUrl = values.webViewUrl ? values.webViewUrl.trim() : "";
  const isPlaceholderUrl = !rawWebViewUrl || rawWebViewUrl === "{{ViewOnline}}" || rawWebViewUrl.includes("{{ViewOnline}}");
  const resolvedWebViewUrl = isPlaceholderUrl ? (expectedPrefix || "") : rawWebViewUrl;

  const processedHtmlSource = (values.htmlSource || "")
    .replace(/\{\{ViewOnline\}\}/g, resolvedWebViewUrl)
    .replace(/%2B%2BViewOnline%2B%2B/gi, resolvedWebViewUrl)
    .replace(/%%view_email_url%%/gi, resolvedWebViewUrl);

  const nextStep = async () => {
    let fieldsToValidate: any[] = [];
    if (currentStep === 1) fieldsToValidate = ["name", "country", "versionName", "webViewUrl", "htmlSource", "folder_id"];
    if (currentStep === 2) fieldsToValidate = [];
    if (currentStep === 3) fieldsToValidate = []; // Grammar step
    if (currentStep === 4) fieldsToValidate = ["litmusUrl"];
    
    // Uniqueness Check
    if (values.name) {
      const isUnique = await isCampaignNameUnique(values.name, editId);
      if (!isUnique) {
        setError("name", {
          type: "manual",
          message: "Campaign name must be unique. A campaign with this duplicate name already exists."
        });
        return;
      }
    }

    let isValid = await trigger(fieldsToValidate as any);
    
    if (currentStep === 1 && isValid) {
      const country = values.country;
      const version = values.versionName;
      
      const urlValidationSummary = await fetchAndValidateCountryUrls({
        html: values.htmlSource || "",
        rawWebViewUrl: values.webViewUrl || "",
        countryName: country,
        versionName: version,
        allowedPattern: expectedPrefix,
      });

      const allowedPattern = urlValidationSummary.allowedPattern;

      if (!allowedPattern) {
        setError("country", { type: "manual", message: `No URL pattern configured in database for country ${country} (${version}).` });
        isValid = false;
      }
      
      if (isValid) {
         const results = validateCampaignHTML(
           values.htmlSource || "", 
           allowedPattern || "", 
           values.webViewUrl, 
           country, 
           version
         );
         setQaResults(results);
      }
    }

    if (isValid) {
      clearErrors();
      setCurrentStep(prev => Math.min(prev + 1, 4));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleCopyQAResults = () => {
    const textToCopy = qaResults.map(r => `[${r.status.toUpperCase()}] ${r.name}: ${r.message}`).join('\n');
    navigator.clipboard.writeText(textToCopy).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const onInvalid = (fieldErrors: any) => {
    console.error("[CampaignSetup] Form submission blocked due to field validation errors:", fieldErrors);
    const errorDetails = Object.keys(fieldErrors)
      .map(key => `• ${key}: ${fieldErrors[key]?.message}`)
      .join('\n');
    alert(`Please fix the following form errors before saving:\n\n${errorDetails}`);
  };

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    try {
      const isUnique = await isCampaignNameUnique(data.name, editId);
      if (!isUnique) {
        setError("name", { type: "manual", message: "Campaign name must be unique." });
        setIsSubmitting(false);
        return;
      }

      const dbAllowedPattern = await fetchAllowedUrlPattern(data.country, data.versionName);
      const expectedUrl = dbAllowedPattern || expectedPrefix;
      const rawUrl = data.webViewUrl ? data.webViewUrl.trim() : "";
      const isPlaceholder = !rawUrl || rawUrl === "{{ViewOnline}}" || rawUrl.includes("{{ViewOnline}}");
      const finalWebViewUrl = isPlaceholder ? (expectedUrl || data.webViewUrl) : data.webViewUrl;

      await saveCampaignRecord({
        id: editId || undefined,
        name: data.name,
        team: data.team,
        country: data.country,
        versionName: data.versionName,
        folder_id: data.folder_id,
        webViewUrl: finalWebViewUrl,
        htmlSource: data.htmlSource,
        figmaUrl: designChoice === "figma" ? (data.figmaUrl || "") : "",
        litmusUrl: data.litmusUrl || "",
        status: "QA Pending",
        createdBy: userEmail,
        lastEditedBy: userEmail
      });

      localStorage.removeItem("campaign_draft");
      await logAction(userEmail, isEditMode ? "Update Campaign" : "Create Campaign", `Submitted campaign: ${data.name}`);
      navigate("/campaigns");
    } catch (err) {
      console.error("[CampaignSetup] Error in onSubmit:", err);
      alert("An error occurred while saving the campaign.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGrammarCheck = async () => {
    setIsCheckingGrammar(true);
    setGrammarCheckResult(null);
    try {
      const response = await fetch("/api/grammar-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ htmlContent: values.htmlSource || "" }),
      });
      const data = await response.json();
      if (data.error) {
        setGrammarCheckResult(`Error: ${data.error}`);
      } else {
        setGrammarCheckResult(data.result);
      }
    } catch (error) {
      console.error("Failed to check grammar:", error);
      setGrammarCheckResult("An error occurred while connecting to the grammar checking service.");
    } finally {
      setIsCheckingGrammar(false);
    }
  };

  const handleDecision = async (newStatus: "Approved" | "Failed" | "QA Pending") => {
    setIsSubmitting(true);
    try {
      const data = watch();
      const pattern = (data.country ? await fetchAllowedUrlPattern(data.country, data.versionName) : null) || expectedPrefix;
      const rawWebUrl = data.webViewUrl ? data.webViewUrl.trim() : "";
      const isPlaceholder = !rawWebUrl || rawWebUrl === "{{ViewOnline}}" || rawWebUrl.includes("{{ViewOnline}}");
      const finalWebViewUrl = isPlaceholder ? (pattern || resolvedWebViewUrl || data.webViewUrl) : data.webViewUrl;

      const record = await saveCampaignRecord({
        id: editId || undefined,
        name: data.name || "Untitled Campaign",
        team: data.team || "HP-APJ",
        country: data.country || "",
        versionName: data.versionName || "",
        folder_id: data.folder_id,
        webViewUrl: finalWebViewUrl || "",
        htmlSource: data.htmlSource || "",
        figmaUrl: designChoice === "figma" ? (data.figmaUrl || "") : "",
        litmusUrl: data.litmusUrl || "",
        status: newStatus,
        createdBy: userEmail,
        lastEditedBy: userEmail
      });

      setCampaignStatus(newStatus);
      await logAction(
        userEmail, 
        newStatus === "Approved" ? "Approve Campaign" : newStatus === "Failed" ? "Fail Campaign" : "Update Status",
        `Set status to ${newStatus}. Note: ${reviewNote || "No note"}`,
        record.id
      );

      refreshLogs(record.id, data.name);
      alert(`Campaign marked as ${newStatus} successfully.`);
    } catch (err) {
      console.error("Error setting decision:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s.includes("approved")) return "bg-emerald-100 text-emerald-800 border-emerald-300";
    if (s.includes("failed")) return "bg-rose-100 text-rose-800 border-rose-300";
    if (s.includes("draft")) return "bg-slate-100 text-slate-700 border-slate-300";
    return "bg-amber-100 text-amber-800 border-amber-300";
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <header className="h-20 flex items-center justify-between px-8 border-b border-slate-200 shrink-0 bg-white shadow-xs">
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">{isEditMode ? "Update Campaign" : "New Campaign Setup"}</h2>
              <span className={cn("px-2.5 py-0.5 text-xs font-semibold rounded-full border", getStatusBadgeClass(campaignStatus))}>
                {campaignStatus}
              </span>
              {draftSavedAt && (
                <span className="text-xs text-slate-400 flex items-center gap-1 font-medium bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                  <Clock className="w-3 h-3 text-slate-500" />
                  Autosaved {draftSavedAt}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Mandatory campaign details, design mockup/Figma comparison, and automated QA checks</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 text-slate-700 border-slate-300 text-xs font-semibold"
            onClick={handleManualSave}
            disabled={isSubmitting}
          >
            <Save className="w-4 h-4 text-[#2b61d6]" />
            Save Draft
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 text-slate-700 border-slate-300 text-xs font-semibold"
            onClick={() => setShowLogsModal(!showLogsModal)}
          >
            <History className="w-4 h-4 text-[#2b61d6]" />
            Audit Logs ({campaignLogs.length})
          </Button>

          {currentStep === 5 && (
            <>
              <Button
                type="button"
                size="sm"
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                onClick={() => handleDecision("Approved")}
                disabled={isSubmitting}
              >
                <CheckCircle2 className="w-4 h-4" />
                Approve Campaign
              </Button>

              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
                onClick={() => handleDecision("Failed")}
                disabled={isSubmitting}
              >
                <XCircle className="w-4 h-4" />
                Fail Campaign
              </Button>
            </>
          )}
        </div>
      </header>

      <form className="flex-1 overflow-hidden flex flex-col" onSubmit={(e) => { e.preventDefault(); handleSubmit(onSubmit, onInvalid)(e); }}>
        <QAWizard
          steps={STEPS}
          currentStep={currentStep}
          onNext={nextStep}
          onPrev={prevStep}
          onCancel={() => navigate("/campaigns")}
          onSubmit={handleSubmit(onSubmit, onInvalid)}
          isSubmitting={isSubmitting}
        >
          <div className="flex flex-col lg:flex-row h-full gap-4 w-full">
            <div className="flex-1 min-w-0 h-full overflow-y-auto pr-1 pb-1">
              {currentStep === 1 && (
                <Card className="shadow-xs border-slate-200 h-full flex flex-col">
                <CardHeader className="border-b border-slate-100 bg-white rounded-t-xl shrink-0 flex flex-row items-center justify-between py-4">
                  <div>
                    <CardTitle className="text-slate-900 text-base">Campaign Details & Source</CardTitle>
                    <CardDescription className="text-slate-500 text-xs">Specify mandatory unique campaign name, target region, and design reference.</CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleResetAll}
                    className="text-slate-700 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50 border-slate-300 gap-1.5 transition-colors text-xs font-semibold shadow-xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
                    Clear All Inputs
                  </Button>
                </CardHeader>
                <CardContent className="space-y-5 pt-5 bg-white flex-1 overflow-auto">
                  <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="name" className="text-xs font-semibold text-slate-800 flex items-center justify-between">
                        Campaign Name <span className="text-rose-500">* Mandatory</span>
                      </Label>
                      <Input 
                        id="name" 
                        placeholder="e.g. 2026 Q3 Summer Promo" 
                        className="border-slate-300 h-9 text-xs focus:ring-[#2b61d6]" 
                        {...register("name")} 
                      />
                      {errors.name && <p className="text-xs text-rose-600 font-semibold">{errors.name.message}</p>}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="team" className="text-xs font-semibold text-slate-800">Team</Label>
                      <Controller
                        control={control}
                        name="team"
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value || userTeam} disabled>
                            <SelectTrigger className="border-slate-300 h-9 text-xs bg-slate-50 cursor-not-allowed">
                              <SelectValue placeholder="Team" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="HP-APJ">HP-APJ</SelectItem>
                              <SelectItem value="HP-EMEA">HP-EMEA</SelectItem>
                              <SelectItem value="HP-AMS">HP-AMS</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {errors.team && <p className="text-xs text-rose-600 font-semibold">{errors.team.message}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="country" className="text-xs font-semibold text-slate-800">Country *</Label>
                        <Controller
                          control={control}
                          name="country"
                          render={({ field }) => {
                            const uniqueCountries = Array.from(new Set(countries.map(c => c.name)));
                            return (
                              <Select 
                                onValueChange={(val) => {
                                  field.onChange(val);
                                  setValue("versionName", "", { shouldValidate: true });
                                }} 
                                value={field.value}
                              >
                                <SelectTrigger className={cn("border-slate-300 h-9 text-xs", viewOnlineError && !field.value && "border-red-500 ring-1 ring-red-500 animate-shake")}>
                                  <SelectValue placeholder="Country" />
                                </SelectTrigger>
                                <SelectContent>
                                  {uniqueCountries.map(name => (
                                    <SelectItem key={name} value={name}>{name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            );
                          }}
                        />
                        {errors.country && <p className="text-xs text-rose-600 font-semibold">{errors.country.message}</p>}
                      </div>
                      
                      <div className="space-y-1.5">
                        <Label htmlFor="versionName" className="text-xs font-semibold text-slate-800">Version *</Label>
                        <Controller
                          control={control}
                          name="versionName"
                          render={({ field }) => {
                            const availableVersions = countries.filter(c => c.name === values.country);
                            return (
                              <Select onValueChange={field.onChange} value={field.value} disabled={!values.country}>
                                <SelectTrigger className={cn("border-slate-300 h-9 text-xs", viewOnlineError && !field.value && "border-red-500 ring-1 ring-red-500 animate-shake")}>
                                  <SelectValue placeholder="Version" />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableVersions.map(c => (
                                    <SelectItem key={c.id || c.code} value={c.code}>{c.code}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            );
                          }}
                        />
                        {errors.versionName && <p className="text-xs text-rose-600 font-semibold">{errors.versionName.message}</p>}
                      </div>
                    </div>

                    {/* FOLDER SELECTION */}
                    <div className="space-y-1.5">
                      <Label htmlFor="folder_id" className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                        <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>Save to Folder *</span>
                      </Label>
                      <Controller
                        control={control}
                        name="folder_id"
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value || "2026-q3"}>
                            <SelectTrigger className="border-amber-200 bg-amber-50/20 h-9 text-xs">
                              <SelectValue placeholder="Select Destination Folder" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableFolders.map(f => (
                                <SelectItem key={f.id} value={f.id}>
                                  📁 {f.parentId ? `└─ ${f.name}` : `${f.year} (${f.name})`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {errors.folder_id && <p className="text-xs text-rose-600 font-semibold">{errors.folder_id.message}</p>}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="webViewUrl" className="text-xs font-semibold text-slate-800">View Online Link</Label>
                      <Input id="webViewUrl" placeholder="{{ViewOnline}} or https://..." className="border-slate-300 h-9 text-xs" {...register("webViewUrl")} />
                      <p className="text-[10px] text-slate-500">
                        Pattern: <span className="font-semibold text-slate-700">{expectedPrefix || "Select Country"}</span>
                      </p>
                    </div>
                  </div>

                  {/* Design Reference Mode Switcher (Client provides EITHER Figma URL OR Uploaded Mockup) */}
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-slate-800">
                        Design Reference Mode (Choose Figma Link OR Upload Mockup)
                      </Label>
                      <div className="flex bg-slate-100 p-0.5 rounded-md border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setDesignChoice("figma")}
                          className={cn(
                            "px-3 py-1 text-xs font-semibold rounded transition-colors flex items-center gap-1.5",
                            designChoice === "figma" ? "bg-white text-[#2b61d6] shadow-xs" : "text-slate-600 hover:text-slate-900"
                          )}
                        >
                          <Figma className="w-3.5 h-3.5" /> Figma Link
                        </button>
                        <button
                          type="button"
                          onClick={() => setDesignChoice("image")}
                          className={cn(
                            "px-3 py-1 text-xs font-semibold rounded transition-colors flex items-center gap-1.5",
                            designChoice === "image" ? "bg-white text-[#2b61d6] shadow-xs" : "text-slate-600 hover:text-slate-900"
                          )}
                        >
                          <ImageIcon className="w-3.5 h-3.5" /> Upload Mockup Image
                        </button>
                      </div>
                    </div>

                    {designChoice === "figma" ? (
                      <div className="space-y-1.5">
                        <Input 
                          id="figmaUrl" 
                          placeholder="Paste Figma File or Frame Link (https://figma.com/file/...)" 
                          className="border-slate-300 h-9 text-xs" 
                          {...register("figmaUrl")} 
                        />
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <label className="border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100/80 rounded-lg p-3 flex flex-col items-center justify-center text-center cursor-pointer transition-colors">
                          <ImageIcon className="w-6 h-6 text-[#2b61d6] mb-1" />
                          <p className="text-xs font-semibold text-slate-800">
                            {mockupFile ? mockupFile.name : "Click to select or drop Mockup Image"}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5">PNG, JPG, WebP supported</p>
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleMockupImageChange(e.target.files?.[0] || null)} />
                        </label>
                        {mockupPreviewUrl && (
                          <div className="flex items-center justify-between text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-md font-medium">
                            <span>✓ Attached: {mockupFile?.name}</span>
                            <button type="button" onClick={() => handleMockupImageChange(null)} className="text-rose-600 hover:underline">Remove</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Outlook Email File Upload & Detected Subject Line Display */}
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <Label className="text-xs font-semibold text-slate-800">Outlook Email (.msg File)</Label>
                    <label className="border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 rounded-lg p-2.5 flex items-center justify-between cursor-pointer transition-colors text-xs text-slate-700 font-medium">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-[#2b61d6]" />
                        <span>{outlookFile ? `Attached: ${outlookFile.name}` : "Upload .msg File to compare Outlook rendering & extract Subject Line"}</span>
                      </div>
                      <span className="text-[11px] bg-white text-[#2b61d6] px-2.5 py-1 rounded border border-blue-200 font-semibold shadow-xs">
                        Browse
                      </span>
                      <input type="file" accept=".msg" className="hidden" onChange={(e) => handleOutlookFileChange(e.target.files?.[0] || null)} />
                    </label>

                    {/* Detected Subject Line Display */}
                    {outlookSubject && (
                      <div className="bg-blue-50/80 border border-blue-200 rounded-lg p-3 flex items-center justify-between text-xs animate-in fade-in">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-[#2b61d6] shrink-0" />
                          <div>
                            <span className="text-[10px] uppercase font-bold text-[#2b61d6] block">Detected Email Subject Line</span>
                            <span className="font-bold text-slate-900">{outlookSubject}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(outlookSubject);
                            alert("Subject line copied to clipboard!");
                          }}
                          className="px-2.5 py-1 bg-white text-[#2b61d6] border border-blue-200 hover:bg-blue-100 rounded text-[11px] font-semibold"
                        >
                          Copy
                        </button>
                      </div>
                    )}
                  </div>

                  {/* HTML Source Code Area */}
                  <div className="space-y-2 pt-3 border-t border-slate-100">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label htmlFor="htmlSource" className="text-xs font-semibold text-slate-800 flex items-center gap-2">
                        <span>Full Email HTML Source Code *</span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          ({values.htmlSource?.length || 0} chars)
                        </span>
                      </Label>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Toggle Alias Tags Inspector */}
                        <button
                          type="button"
                          onClick={() => setShowAliasInspector(!showAliasInspector)}
                          className={cn(
                            "px-2.5 py-1 text-xs font-semibold rounded-md border transition-all flex items-center gap-1 cursor-pointer",
                            showAliasInspector
                              ? "bg-purple-100 text-purple-700 border-purple-300 shadow-xs"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                          )}
                        >
                          <Tag className="w-3.5 h-3.5 text-purple-600" />
                          <span>Alias Tags ({aliasTagsInfo.total})</span>
                        </button>

                        {/* Toggle Alt Tags Inspector */}
                        <button
                          type="button"
                          onClick={() => setShowAltInspector(!showAltInspector)}
                          className={cn(
                            "px-2.5 py-1 text-xs font-semibold rounded-md border transition-all flex items-center gap-1 cursor-pointer",
                            showAltInspector
                              ? "bg-amber-100 text-amber-800 border-amber-300 shadow-xs"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                          )}
                        >
                          <ImageIcon className="w-3.5 h-3.5 text-amber-600" />
                          <span>Alt Tags ({altTagsInfo.withAlt.length}/{altTagsInfo.total})</span>
                        </button>

                        {/* Full Screen HTML Mode */}
                        <button
                          type="button"
                          onClick={() => setFullScreenTarget(fullScreenTarget === "html" ? null : "html")}
                          className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md border border-slate-200 flex items-center gap-1 cursor-pointer transition-colors"
                          title="View HTML tab in Full Screen"
                        >
                          {fullScreenTarget === "html" ? <Minimize2 className="w-3.5 h-3.5 text-slate-600" /> : <Maximize2 className="w-3.5 h-3.5 text-slate-600" />}
                          <span>{fullScreenTarget === "html" ? "Exit Fullscreen" : "Fullscreen HTML"}</span>
                        </button>
                      </div>
                    </div>

                    {/* Alias Tags Inspection Panel */}
                    {showAliasInspector && (
                      <div className="bg-purple-50/70 border border-purple-200 rounded-lg p-3 text-xs space-y-2 animate-in fade-in">
                        <div className="flex items-center justify-between">
                          <h5 className="font-bold text-purple-900 flex items-center gap-1.5">
                            <Tag className="w-4 h-4 text-purple-600" />
                            Alias Tags Summary ({aliasTagsInfo.total} detected)
                          </h5>
                          {aliasTagsInfo.missingInAnchors.length > 0 && (
                            <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-[10px] font-bold">
                              ⚠️ {aliasTagsInfo.missingInAnchors.length} links missing alias
                            </span>
                          )}
                        </div>

                        {aliasTagsInfo.items.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1 bg-white rounded border border-purple-100">
                            {aliasTagsInfo.items.map((item, i) => (
                              <span key={i} className="bg-purple-100 text-purple-800 text-[10px] px-2 py-0.5 rounded font-mono font-semibold">
                                {item.alias}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-purple-700 text-[11px]">No alias="..." or data-alias="..." attributes found in HTML.</p>
                        )}

                        {aliasTagsInfo.missingInAnchors.length > 0 && (
                          <div className="pt-2 border-t border-purple-200/60">
                            <p className="font-semibold text-purple-900 text-[11px] mb-1">Links without alias attributes:</p>
                            <ul className="space-y-1 max-h-24 overflow-y-auto text-[10px] text-slate-700">
                              {aliasTagsInfo.missingInAnchors.map((m, idx) => (
                                <li key={idx} className="bg-white/80 px-2 py-1 rounded border border-purple-100 flex justify-between gap-2">
                                  <span className="font-medium text-slate-800 truncate max-w-[200px]">{m.text}</span>
                                  <span className="font-mono text-slate-500 truncate max-w-[200px]">{m.href}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Alt Tags Inspection Panel */}
                    {showAltInspector && (
                      <div className="bg-amber-50/80 border border-amber-200 rounded-lg p-3 text-xs space-y-2 animate-in fade-in">
                        <div className="flex items-center justify-between">
                          <h5 className="font-bold text-amber-950 flex items-center gap-1.5">
                            <ImageIcon className="w-4 h-4 text-amber-600" />
                            Image Alt Tags Audit ({altTagsInfo.withAlt.length} of {altTagsInfo.total} images have alt text)
                          </h5>
                          {altTagsInfo.missingAlt.length > 0 ? (
                            <span className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded text-[10px] font-bold">
                              ❌ {altTagsInfo.missingAlt.length} images missing alt text
                            </span>
                          ) : altTagsInfo.total > 0 ? (
                            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold">
                              ✓ All images have alt text
                            </span>
                          ) : null}
                        </div>

                        {altTagsInfo.missingAlt.length > 0 && (
                          <div className="bg-white rounded p-2 border border-rose-200">
                            <p className="font-bold text-rose-800 text-[11px] mb-1">Images missing alt attribute:</p>
                            <ul className="space-y-1 max-h-24 overflow-y-auto text-[10px]">
                              {altTagsInfo.missingAlt.map((m, idx) => (
                                <li key={idx} className="bg-rose-50 px-2 py-1 rounded text-rose-900 font-mono truncate">
                                  Image src: {m.src}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {altTagsInfo.withAlt.length > 0 && (
                          <div className="bg-white rounded p-2 border border-amber-200">
                            <p className="font-bold text-amber-900 text-[11px] mb-1">Detected alt text entries:</p>
                            <ul className="space-y-1 max-h-28 overflow-y-auto text-[10px]">
                              {altTagsInfo.withAlt.map((item, idx) => (
                                <li key={idx} className="bg-amber-50/50 px-2 py-1 rounded flex justify-between gap-2 border border-amber-100">
                                  <span className="font-semibold text-slate-800 truncate max-w-[200px]">Alt: "{item.alt}"</span>
                                  <span className="font-mono text-slate-500 truncate max-w-[200px]">{item.src}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    <textarea 
                      id="htmlSource"
                      className="flex min-h-[300px] w-full rounded-md border border-slate-300 bg-slate-50/80 px-3 py-2.5 text-xs font-mono shadow-xs placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2b61d6]"
                      placeholder="Paste your full email HTML template code here..."
                      value={values.htmlSource || ""}
                      onChange={(e) => setValue("htmlSource", e.target.value, { shouldValidate: true })}
                    />
                    {errors.htmlSource && <p className="text-xs text-rose-600 font-semibold">{errors.htmlSource.message}</p>}
                  </div>
                </CardContent>
              </Card>
            )}
            
            {currentStep === 2 && (
              <div className={cn(
                "flex flex-col flex-1 min-h-[600px] border border-slate-200 rounded-xl shadow-xs bg-white overflow-hidden transition-all duration-300",
                fullScreenTarget === "step2" ? "fixed inset-0 z-[100] m-4 border-2 shadow-2xl" : ""
              )}>
                <div className="flex flex-wrap items-center justify-between px-6 py-3 border-b border-slate-100 bg-slate-50 shrink-0 gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <span>Live Preview, QA Validation & Split Compare</span>
                    </h3>
                    <p className="text-[11px] text-slate-500">Compare Outlook/ViewOnline against Figma or Mockup image side-by-side.</p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex bg-slate-200 p-1 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setPreviewTab("compare")}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer",
                          previewTab === "compare" ? "bg-white text-[#2b61d6] shadow-xs" : "text-slate-600 hover:text-slate-900"
                        )}
                      >
                        <Layers className="w-3.5 h-3.5" />
                        Split Compare
                      </button>
                      <button
                        type="button"
                        onClick={() => handleViewOnlineClick(() => setPreviewTab("webview"))}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer",
                          previewTab === "webview" ? "bg-white text-[#2b61d6] shadow-xs" : "text-slate-600 hover:text-slate-900"
                        )}
                      >
                        <MonitorSmartphone className="w-3.5 h-3.5" />
                        View Online
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewTab("html")}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer",
                          previewTab === "html" ? "bg-white text-[#2b61d6] shadow-xs" : "text-slate-600 hover:text-slate-900"
                        )}
                      >
                        <Code2 className="w-3.5 h-3.5" />
                        HTML Source
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewTab("qa")}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer",
                          previewTab === "qa" ? "bg-white text-emerald-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
                        )}
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        QA Checklist ({qaResults.length})
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setFullScreenTarget(fullScreenTarget === "step2" ? null : "step2")}
                        className="px-2.5 py-1.5 bg-white text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                        title="Toggle Fullscreen Preview"
                      >
                        {fullScreenTarget === "step2" ? <Minimize2 className="w-3.5 h-3.5 text-slate-600" /> : <Maximize2 className="w-3.5 h-3.5 text-slate-600" />}
                        <span>{fullScreenTarget === "step2" ? "Exit Fullscreen" : "Fullscreen View"}</span>
                      </button>

                      {viewOnlineError && (
                        <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2.5 py-1.5 rounded-md animate-in fade-in slide-in-from-top-1">
                          Please select Country and Version to View Online.
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex-1 bg-slate-100 relative p-3 flex flex-col overflow-hidden">
                  {previewTab === "webview" ? (
                    <div className="flex-1 flex flex-col h-full bg-slate-50 rounded-lg border border-slate-200 overflow-hidden shadow-xs">
                      {/* View Online Device & Link Toolbar */}
                      <div className="bg-white px-4 py-2 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                            <Eye className="w-4 h-4 text-[#2b61d6]" />
                            View Online Platform Preview
                          </span>
                          {resolvedWebViewUrl && (
                            <a
                              href={resolvedWebViewUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-[#2b61d6] hover:underline flex items-center gap-1 font-semibold ml-2"
                            >
                              Open External <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>

                        {/* Device Toggle */}
                        <div className="flex items-center gap-3">
                          <div className="flex bg-slate-100 p-0.5 rounded-md border border-slate-200">
                            <button
                              type="button"
                              onClick={() => setViewOnlineDevice("desktop")}
                              className={cn(
                                "px-2.5 py-1 text-[11px] font-semibold rounded flex items-center gap-1 cursor-pointer transition-colors",
                                viewOnlineDevice === "desktop" ? "bg-white text-[#2b61d6] shadow-xs" : "text-slate-600 hover:text-slate-900"
                              )}
                            >
                              <Monitor className="w-3.5 h-3.5" /> Desktop
                            </button>
                            <button
                              type="button"
                              onClick={() => setViewOnlineDevice("tablet")}
                              className={cn(
                                "px-2.5 py-1 text-[11px] font-semibold rounded flex items-center gap-1 cursor-pointer transition-colors",
                                viewOnlineDevice === "tablet" ? "bg-white text-[#2b61d6] shadow-xs" : "text-slate-600 hover:text-slate-900"
                              )}
                            >
                              <Tablet className="w-3.5 h-3.5" /> Tablet (768px)
                            </button>
                            <button
                              type="button"
                              onClick={() => setViewOnlineDevice("mobile")}
                              className={cn(
                                "px-2.5 py-1 text-[11px] font-semibold rounded flex items-center gap-1 cursor-pointer transition-colors",
                                viewOnlineDevice === "mobile" ? "bg-white text-[#2b61d6] shadow-xs" : "text-slate-600 hover:text-slate-900"
                              )}
                            >
                              <Smartphone className="w-3.5 h-3.5" /> Mobile (375px)
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Missing/Invalid Links Audit Banner */}
                      {linkAuditInfo.missing.length > 0 ? (
                        <div className="bg-rose-50 border-b border-rose-200 p-2.5 px-4 text-xs shrink-0 flex flex-col gap-1.5 animate-in fade-in">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-rose-800 flex items-center gap-1.5">
                              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                              Missing or Invalid Links Detected in View Online Template ({linkAuditInfo.missing.length} issue{linkAuditInfo.missing.length > 1 ? "s" : ""}):
                            </span>
                            <span className="text-[10px] bg-rose-200 text-rose-900 font-bold px-2 py-0.5 rounded">
                              QA Warning
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2 max-h-20 overflow-y-auto">
                            {linkAuditInfo.missing.map((m, idx) => (
                              <div key={idx} className="bg-white border border-rose-200 px-2 py-1 rounded text-[10px] text-slate-800 flex items-center gap-1.5">
                                <span className="font-bold text-rose-700">{m.text}</span>
                                <span className="text-slate-400">({m.reason}):</span>
                                <code className="bg-rose-50 text-rose-900 px-1 rounded font-mono">{m.href}</code>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : linkAuditInfo.total > 0 ? (
                        <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-1.5 text-[11px] text-emerald-800 font-medium flex items-center gap-2 shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>All {linkAuditInfo.total} template links verified with valid destination URLs</span>
                        </div>
                      ) : null}

                      {/* Landing Page Embedded Scrollable Viewer */}
                      <div className="flex-1 overflow-auto bg-slate-200/60 p-4 flex justify-center items-start">
                        <div
                          className={cn(
                            "bg-white shadow-xl transition-all duration-300 min-h-full border border-slate-300 rounded-lg overflow-hidden flex flex-col",
                            viewOnlineDevice === "desktop" ? "w-full" : viewOnlineDevice === "tablet" ? "w-[768px]" : "w-[375px]"
                          )}
                        >
                          {resolvedWebViewUrl ? (
                            <iframe
                              src={resolvedWebViewUrl}
                              title="Web View Online Landing Page Preview"
                              className="w-full h-full min-h-[600px] border-0"
                              sandbox="allow-same-origin allow-scripts allow-popups"
                            />
                          ) : processedHtmlSource ? (
                            <iframe
                              srcDoc={processedHtmlSource}
                              title="HTML Source Landing Page Render"
                              className="w-full h-full min-h-[600px] border-0"
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center p-12 text-slate-500 text-center text-xs">
                              <MonitorSmartphone className="w-12 h-12 text-slate-300 mb-3" />
                              <p className="font-bold text-slate-700">No View Online URL or HTML Source Provided</p>
                              <p className="text-slate-400 mt-1">Provide View Online link or HTML source in Step 1 to load landing page preview.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : previewTab === "html" ? (
                    processedHtmlSource ? (
                      <iframe srcDoc={processedHtmlSource} title="HTML Source Preview" className="w-full h-full border-0 bg-white rounded-lg shadow-xs" />
                    ) : (
                      <div className="flex items-center justify-center flex-1 text-slate-500 text-xs">No HTML source provided</div>
                    )
                  ) : previewTab === "qa" ? (
                    <div className="w-full h-full bg-white rounded-lg shadow-xs border border-slate-200 overflow-y-auto p-5">
                       <div className="flex items-center justify-between mb-4">
                         <h4 className="text-sm font-bold text-slate-900">Automated QA Checklist Results</h4>
                         {qaResults.length > 0 && (
                           <button onClick={handleCopyQAResults} className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md">
                             {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                             {isCopied ? "Copied" : "Copy Results"}
                           </button>
                         )}
                       </div>
                       
                       <div className="space-y-3">
                         {qaResults.map((result, idx) => (
                           <div key={idx} className={cn("p-3 border rounded-lg flex items-start gap-3 text-xs", 
                             result.status === "pass" ? "bg-emerald-50/70 border-emerald-200" :
                             result.status === "fail" ? "bg-rose-50/70 border-rose-200" : "bg-amber-50/70 border-amber-200"
                           )}>
                             <div className="mt-0.5 shrink-0">
                               {result.status === "pass" ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> :
                                result.status === "fail" ? <XCircle className="w-4 h-4 text-rose-600" /> :
                                <AlertTriangle className="w-4 h-4 text-amber-600" />}
                             </div>
                             <div>
                               <h5 className="font-bold text-slate-900">{result.name}</h5>
                               <p className="text-slate-700 mt-0.5">{result.message}</p>
                             </div>
                           </div>
                         ))}
                       </div>
                    </div>
                  ) : previewTab === "compare" ? (
                    <div className="flex-1 overflow-hidden flex divide-x divide-slate-200 bg-white rounded-lg shadow-xs border border-slate-200">
                      {/* LEFT PANEL: View Online / Outlook (.msg) */}
                      <div className="flex-1 flex flex-col h-full bg-slate-50">
                        <div className="flex items-center justify-between bg-slate-100 px-3 py-2 border-b border-slate-200 shrink-0">
                          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                            <Code2 className="w-3.5 h-3.5 text-[#2b61d6]" /> Email Content View
                          </span>
                          <div className="flex bg-slate-200/80 p-0.5 rounded-md gap-0.5">
                            <button
                              type="button"
                              onClick={() => handleViewOnlineClick(() => setLeftCompareTab("webview"))}
                              className={cn(
                                "px-2.5 py-1 text-[11px] font-semibold rounded transition-all flex items-center gap-1",
                                leftCompareTab === "webview" ? "bg-white text-[#2b61d6] shadow-xs" : "text-slate-600 hover:text-slate-900"
                              )}
                            >
                              View Online
                            </button>
                            <button
                              type="button"
                              onClick={() => setLeftCompareTab("outlook")}
                              className={cn(
                                "px-2.5 py-1 text-[11px] font-semibold rounded transition-all flex items-center gap-1",
                                leftCompareTab === "outlook" ? "bg-white text-[#2b61d6] shadow-xs" : "text-slate-600 hover:text-slate-900"
                              )}
                            >
                              Outlook (.msg)
                              {outlookFile && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => setLeftCompareTab("html")}
                              className={cn(
                                "px-2.5 py-1 text-[11px] font-semibold rounded transition-all flex items-center gap-1",
                                leftCompareTab === "html" ? "bg-white text-[#2b61d6] shadow-xs" : "text-slate-600 hover:text-slate-900"
                              )}
                            >
                              HTML Source
                            </button>
                          </div>
                        </div>

                        {outlookSubject && (
                          <div className="bg-blue-50 border-b border-blue-200 px-3 py-1.5 text-xs flex items-center justify-between shrink-0">
                            <span className="text-slate-600 font-medium truncate max-w-[300px]">
                              📧 Subject: <strong className="text-slate-900">{outlookSubject}</strong>
                            </span>
                            <span className="text-[10px] text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded font-bold">Extracted</span>
                          </div>
                        )}

                        <div className="flex-1 relative overflow-hidden bg-white">
                          {leftCompareTab === "webview" && (
                            resolvedWebViewUrl ? (
                              <iframe src={resolvedWebViewUrl} title="Web View Comparison" className="w-full h-full border-0" sandbox="allow-same-origin allow-scripts allow-popups" />
                            ) : processedHtmlSource ? (
                              <iframe srcDoc={processedHtmlSource} title="HTML Source Comparison" className="w-full h-full border-0" />
                            ) : (
                              <div className="flex flex-col items-center justify-center h-full text-slate-500 p-6 text-center text-xs">
                                No View Online link or HTML source provided.
                              </div>
                            )
                          )}

                          {leftCompareTab === "outlook" && (
                            outlookFile ? (
                              <div className="flex flex-col h-full">
                                <div className="flex-1 overflow-auto bg-white">
                                  {outlookExtractedHtml ? (
                                    <iframe srcDoc={outlookExtractedHtml} title="Outlook MSG Content" className="w-full h-full border-0" />
                                  ) : processedHtmlSource ? (
                                    <iframe srcDoc={processedHtmlSource} title="Outlook MSG HTML Source" className="w-full h-full border-0" />
                                  ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-500 p-6 text-center text-xs">
                                      Attached: {outlookFile.name}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center h-full p-6 text-center bg-slate-50/50">
                                <Mail className="w-10 h-10 text-slate-300 mb-2" />
                                <p className="text-xs font-semibold text-slate-700">No Outlook (.msg) File Uploaded</p>
                                <label className="mt-3 cursor-pointer bg-[#2b61d6] text-white px-3 py-1.5 rounded-md text-xs font-semibold shadow-xs">
                                  Upload .msg File
                                  <input type="file" accept=".msg" className="hidden" onChange={(e) => handleOutlookFileChange(e.target.files?.[0] || null)} />
                                </label>
                              </div>
                            )
                          )}

                          {leftCompareTab === "html" && (
                            processedHtmlSource ? (
                              <iframe srcDoc={processedHtmlSource} title="HTML Source Render" className="w-full h-full border-0" />
                            ) : (
                              <div className="flex flex-col items-center justify-center h-full text-slate-500 p-6 text-center text-xs">
                                No HTML source code provided.
                              </div>
                            )
                          )}
                        </div>
                      </div>

                      {/* RIGHT PANEL: Figma OR Uploaded Mockup Image */}
                      <div className="flex-1 flex flex-col h-full bg-slate-50">
                        <div className="flex items-center justify-between bg-slate-100 px-3 py-2 border-b border-slate-200 shrink-0">
                          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                            {designChoice === "figma" ? <Figma className="w-3.5 h-3.5 text-[#2b61d6]" /> : <ImageIcon className="w-3.5 h-3.5 text-[#2b61d6]" />}
                            Design Reference ({designChoice === "figma" ? "Figma Embed" : "Uploaded Mockup"})
                          </span>
                          <div className="flex bg-slate-200/80 p-0.5 rounded-md gap-0.5">
                            <button
                              type="button"
                              onClick={() => setDesignChoice("figma")}
                              className={cn(
                                "px-2.5 py-1 text-[11px] font-semibold rounded transition-all",
                                designChoice === "figma" ? "bg-white text-[#2b61d6] shadow-xs" : "text-slate-600 hover:text-slate-900"
                              )}
                            >
                              Figma
                            </button>
                            <button
                              type="button"
                              onClick={() => setDesignChoice("image")}
                              className={cn(
                                "px-2.5 py-1 text-[11px] font-semibold rounded transition-all",
                                designChoice === "image" ? "bg-white text-[#2b61d6] shadow-xs" : "text-slate-600 hover:text-slate-900"
                              )}
                            >
                              Mockup Image
                            </button>
                          </div>
                        </div>

                        <div className="flex-1 relative overflow-auto bg-white flex flex-col items-center justify-center">
                          {designChoice === "figma" ? (
                            values.figmaUrl ? (
                              <iframe
                                src={values.figmaUrl.includes('figma.com/embed') ? values.figmaUrl : `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(values.figmaUrl)}`}
                                className="w-full h-full border-0"
                                title="Figma Reference"
                              />
                            ) : (
                              <div className="flex flex-col items-center justify-center h-full p-6 text-center text-xs">
                                <Figma className="w-10 h-10 text-slate-300 mb-2" />
                                <p className="font-semibold text-slate-700">No Figma URL Provided</p>
                                <p className="text-slate-400 mt-0.5 mb-3">Provide Figma link in Stage 1 or switch to Mockup Image.</p>
                              </div>
                            )
                          ) : (
                            mockupPreviewUrl ? (
                              <div className="w-full h-full overflow-auto p-4 flex justify-center items-start bg-slate-100/50">
                                <img src={mockupPreviewUrl} alt="Design Mockup" className="max-w-full rounded shadow-md border border-slate-200" />
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center h-full p-6 text-center text-xs">
                                <ImageIcon className="w-10 h-10 text-slate-300 mb-2" />
                                <p className="font-semibold text-slate-700">No Mockup Image Uploaded</p>
                                <label className="mt-3 cursor-pointer bg-[#2b61d6] text-white px-3 py-1.5 rounded-md text-xs font-semibold shadow-xs">
                                  Upload Image
                                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleMockupImageChange(e.target.files?.[0] || null)} />
                                </label>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <Card className="shadow-xs border-slate-200 h-full flex flex-col">
                <CardHeader className="border-b border-slate-100 bg-white rounded-t-xl py-4 shrink-0">
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-slate-900 text-base">Grammar & Spell Check</CardTitle>
                      <CardDescription className="text-slate-500 text-xs">Analyze the HTML content for spelling and grammatical errors using AI.</CardDescription>
                    </div>
                    <Button 
                      type="button" 
                      onClick={handleGrammarCheck} 
                      disabled={isCheckingGrammar || !values.htmlSource}
                      className="bg-[#2b61d6] hover:bg-blue-700 text-white text-xs gap-1.5"
                    >
                      {isCheckingGrammar ? (
                        <>
                          <div className="w-3.5 h-3.5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                          Checking...
                        </>
                      ) : (
                        <>
                          <CheckSquare className="w-3.5 h-3.5" />
                          Run Grammar Check
                        </>
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0 flex-1 overflow-y-auto bg-slate-50/50">
                  {grammarCheckResult ? (
                    <div className="p-6">
                      <div className="prose prose-sm prose-slate max-w-none">
                        <div dangerouslySetInnerHTML={{ __html: grammarCheckResult.replace(/\n/g, '<br />') }} />
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                      <CheckSquare className="w-12 h-12 text-slate-300 mb-3" />
                      <p className="text-sm font-medium text-slate-700">No grammar check performed yet</p>
                      <p className="text-xs mt-1 max-w-sm">Click "Run Grammar Check" to analyze the visible text from your HTML source for spelling and grammatical errors.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {currentStep === 4 && (
              <Card className="shadow-xs border-slate-200 h-full">
                <CardHeader className="border-b border-slate-100 bg-white rounded-t-xl py-4">
                  <CardTitle className="text-slate-900 text-base">Additional Tracking & Brief Files</CardTitle>
                  <CardDescription className="text-slate-500 text-xs">Attach campaign briefs or Litmus rendering URL.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5 pt-5 bg-white">
                  <div className="grid md:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-800">Campaign Brief (CSV/Excel)</Label>
                      <label className="border-2 border-dashed border-slate-300 rounded-lg p-4 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors cursor-pointer bg-slate-50 h-28">
                        <UploadCloud className="h-6 w-6 text-[#2b61d6] mb-1" />
                        <p className="text-xs font-semibold text-slate-700">{briefFile ? briefFile.name : "Upload Brief File (.csv, .xlsx)"}</p>
                        <Input type="file" className="hidden" accept=".csv, .xlsx, .xls" onChange={(e) => setBriefFile(e.target.files?.[0] || null)} />
                      </label>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="litmusUrl" className="text-xs font-semibold text-slate-800">Litmus Test URL</Label>
                      <Input id="litmusUrl" placeholder="https://litmus.com/pub/..." className="border-slate-300 h-9 text-xs" {...register("litmusUrl")} />
                      <p className="text-[10px] text-slate-400">Optional URL for Litmus cross-client rendering tests</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {currentStep === 5 && (
              <>
                <Card className="shadow-xs border-slate-200">
                  <CardHeader className="border-b border-slate-100 bg-white rounded-t-xl py-4 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-slate-900 text-base">Summary & Approval Decision</CardTitle>
                      <CardDescription className="text-slate-500 text-xs">Review campaign properties, audit logs, and set final approval status.</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5 pt-5 bg-white text-xs">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <div>
                        <span className="text-slate-500 block">Campaign Name:</span>
                        <strong className="text-slate-900 font-bold">{values.name}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Team:</span>
                        <strong className="text-slate-900 font-bold">{values.team}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Country & Version:</span>
                        <strong className="text-slate-900 font-bold">{values.country} ({values.versionName})</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Status:</span>
                        <span className={cn("inline-block px-2 py-0.5 rounded text-[10px] font-bold border", getStatusBadgeClass(campaignStatus))}>
                          {campaignStatus}
                        </span>
                      </div>
                    </div>

                    {values.team && (
                      <div className="space-y-3 pt-2">
                        <Label className="text-xs font-semibold text-slate-800">Review Checklist</Label>
                        <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
                          {teamChecklists.find(c => c.team === values.team)?.items.map((item: any) => (
                            <div key={item.id} className="flex items-start gap-3 p-3 hover:bg-slate-50 transition-colors">
                              <input 
                                type="checkbox"
                                id={`check-${item.id}`}
                                className="mt-0.5 rounded border-slate-300 text-[#2b61d6] focus:ring-[#2b61d6]"
                                checked={checkedCheckpoints[item.id] || false}
                                onChange={(e) => setCheckedCheckpoints({...checkedCheckpoints, [item.id]: e.target.checked})}
                              />
                              <label htmlFor={`check-${item.id}`} className="text-sm text-slate-700 cursor-pointer select-none">
                                {item.text}
                              </label>
                            </div>
                          ))}
                          {(!teamChecklists.find(c => c.team === values.team) || teamChecklists.find(c => c.team === values.team)?.items.length === 0) && (
                            <div className="p-4 text-center text-slate-500 text-sm">
                              No checklist defined for {values.team}.
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2 pt-2">
                      <Label htmlFor="reviewNote" className="text-xs font-semibold text-slate-800">Reviewer Feedback Notes</Label>
                      <textarea
                        id="reviewNote"
                        rows={3}
                        placeholder="Leave optional QA feedback notes..."
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                        className="w-full p-2.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#2b61d6] bg-slate-50/50"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <Button
                        type="button"
                        className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-5"
                        onClick={() => handleDecision("Approved")}
                        disabled={isSubmitting}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Approve Campaign
                      </Button>

                      <Button
                        type="button"
                        variant="destructive"
                        className="gap-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-5"
                        onClick={() => handleDecision("Failed")}
                        disabled={isSubmitting}
                      >
                        <XCircle className="w-4 h-4" />
                        Fail Campaign
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Edit Logs & Audit Trail */}
                <Card className="shadow-xs border-slate-200 mt-5">
                  <CardHeader className="border-b border-slate-100 bg-white rounded-t-xl py-3 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-slate-900 text-sm flex items-center gap-2">
                        <History className="w-4 h-4 text-[#2b61d6]" />
                        Campaign Historical Edit Logs
                      </CardTitle>
                    </div>
                    <Button type="button" variant="ghost" size="sm" className="text-xs text-[#2b61d6]" onClick={() => refreshLogs(editId, values.name)}>
                      Refresh Logs
                    </Button>
                  </CardHeader>
                  <CardContent className="pt-4 bg-white text-xs">
                    {campaignLogs.length === 0 ? (
                      <p className="text-slate-400 text-center py-4">No historical edit logs recorded yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {campaignLogs.map((log: any, idx: number) => (
                          <div key={log.id || idx} className="p-3 rounded-md border border-slate-200 bg-slate-50 flex items-center justify-between">
                            <div>
                              <span className="font-bold text-slate-800">{log.action}: </span>
                              <span className="text-slate-600">{log.details}</span>
                            </div>
                            <span className="text-[10px] text-slate-400">
                              {log.created_at ? new Date(log.created_at).toLocaleString() : "Just now"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
            </div>

            {/* Checklist Sidebar */}
            {values.team && teamChecklists.length > 0 && (
              <div className="w-full lg:w-72 shrink-0 bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden shadow-xs h-full">
                 <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
                   <h3 className="text-sm font-bold text-slate-900">{values.team} Checklist</h3>
                 </div>
                 <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-slate-50/30">
                    {teamChecklists.find((c: any) => c.team === values.team)?.items?.map((item: any) => (
                      <div key={item.id} className="flex items-start gap-2 p-2 hover:bg-slate-50 rounded-lg transition-colors group cursor-pointer" onClick={() => setCheckedCheckpoints({...checkedCheckpoints, [item.id]: !checkedCheckpoints[item.id]})}>
                        <div className="mt-0.5 shrink-0">
                          {checkedCheckpoints[item.id] ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300 group-hover:text-slate-400" />
                          )}
                        </div>
                        <span className={cn("text-xs leading-relaxed", checkedCheckpoints[item.id] ? "text-slate-500 line-through" : "text-slate-700")}>
                          {item.text}
                        </span>
                      </div>
                    ))}
                    {(!teamChecklists.find((c: any) => c.team === values.team) || teamChecklists.find((c: any) => c.team === values.team)?.items?.length === 0) && (
                      <div className="p-4 text-center text-slate-500 text-xs">
                        No checkpoints defined for {values.team}.
                      </div>
                    )}
                 </div>
              </div>
            )}
          </div>
        </QAWizard>
      </form>

      {/* Audit Logs Modal */}
      {showLogsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <History className="w-4 h-4 text-[#2b61d6]" />
                Campaign Edit & Review Logs
              </h3>
              <button onClick={() => setShowLogsModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div className="max-h-80 overflow-y-auto space-y-2 text-xs">
              {campaignLogs.map((log: any, idx: number) => (
                <div key={log.id || idx} className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="flex justify-between font-bold text-slate-800 mb-1">
                    <span>{log.action}</span>
                    <span className="text-[10px] text-slate-400">{log.created_at ? new Date(log.created_at).toLocaleString() : "Recent"}</span>
                  </div>
                  <p className="text-slate-600">{log.details}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-2">
              <Button size="sm" variant="outline" onClick={() => setShowLogsModal(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Overlay Modal */}
      {fullScreenTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex flex-col p-4 md:p-6 animate-in fade-in">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl flex-1 flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <span className="bg-[#2b61d6] text-white px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                  Fullscreen Mode
                </span>
                <h3 className="text-sm font-bold">
                  {fullScreenTarget === "html" ? "Full Email HTML Source Code & Tag Inspection" :
                   fullScreenTarget === "webview" ? "View Online Platform Landing Page & Link Inspector" :
                   "Campaign Workspace Fullscreen"}
                </h3>
              </div>

              <div className="flex items-center gap-3">
                {fullScreenTarget === "webview" && (
                  <div className="flex bg-slate-800 p-0.5 rounded border border-slate-700">
                    <button
                      type="button"
                      onClick={() => setViewOnlineDevice("desktop")}
                      className={cn(
                        "px-2.5 py-1 text-[11px] font-semibold rounded transition-colors cursor-pointer",
                        viewOnlineDevice === "desktop" ? "bg-[#2b61d6] text-white" : "text-slate-300 hover:text-white"
                      )}
                    >
                      <Monitor className="w-3.5 h-3.5 inline mr-1" /> Desktop
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewOnlineDevice("tablet")}
                      className={cn(
                        "px-2.5 py-1 text-[11px] font-semibold rounded transition-colors cursor-pointer",
                        viewOnlineDevice === "tablet" ? "bg-[#2b61d6] text-white" : "text-slate-300 hover:text-white"
                      )}
                    >
                      <Tablet className="w-3.5 h-3.5 inline mr-1" /> Tablet
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewOnlineDevice("mobile")}
                      className={cn(
                        "px-2.5 py-1 text-[11px] font-semibold rounded transition-colors cursor-pointer",
                        viewOnlineDevice === "mobile" ? "bg-[#2b61d6] text-white" : "text-slate-300 hover:text-white"
                      )}
                    >
                      <Smartphone className="w-3.5 h-3.5 inline mr-1" /> Mobile
                    </button>
                  </div>
                )}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFullScreenTarget(null)}
                  className="bg-slate-800 hover:bg-slate-700 text-white border-slate-700 gap-1 text-xs font-semibold cursor-pointer"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                  Exit Fullscreen
                </Button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-auto bg-slate-100 p-4 flex flex-col">
              {fullScreenTarget === "html" ? (
                <div className="flex-1 flex flex-col bg-white border border-slate-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <Code2 className="w-4 h-4 text-[#2b61d6]" />
                      HTML Source Code Editor ({values.htmlSource?.length || 0} chars)
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-bold">
                        Alias Tags: {aliasTagsInfo.total}
                      </span>
                      <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold">
                        Alt Tags: {altTagsInfo.withAlt.length}/{altTagsInfo.total}
                      </span>
                    </div>
                  </div>
                  <textarea 
                    className="flex-1 min-h-[500px] w-full rounded-md border border-slate-300 bg-slate-900 text-emerald-400 p-4 text-xs font-mono shadow-xs focus:outline-none"
                    placeholder="Paste email HTML code here..."
                    value={values.htmlSource || ""}
                    onChange={(e) => setValue("htmlSource", e.target.value, { shouldValidate: true })}
                  />
                </div>
              ) : fullScreenTarget === "webview" ? (
                <div className="flex-1 flex flex-col bg-slate-200 rounded-lg overflow-hidden border border-slate-300">
                  {/* Link Audit Header Banner */}
                  {linkAuditInfo.missing.length > 0 && (
                    <div className="bg-rose-50 border-b border-rose-200 p-3 text-xs flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span className="font-bold text-rose-800">
                          Missing/Invalid Link Warnings ({linkAuditInfo.missing.length}):
                        </span>
                        <div className="flex gap-1.5 flex-wrap">
                          {linkAuditInfo.missing.map((m, i) => (
                            <span key={i} className="bg-white border border-rose-200 px-2 py-0.5 rounded text-[10px] text-rose-900 font-mono">
                              {m.text}: {m.href} ({m.reason})
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex-1 overflow-auto p-4 flex justify-center items-start">
                    <div
                      className={cn(
                        "bg-white shadow-2xl transition-all duration-300 min-h-full border border-slate-300 rounded-lg overflow-hidden flex flex-col",
                        viewOnlineDevice === "desktop" ? "w-full" : viewOnlineDevice === "tablet" ? "w-[768px]" : "w-[375px]"
                      )}
                    >
                      {resolvedWebViewUrl ? (
                        <iframe
                          src={resolvedWebViewUrl}
                          title="View Online Fullscreen"
                          className="w-full h-full min-h-[700px] border-0"
                          sandbox="allow-same-origin allow-scripts allow-popups"
                        />
                      ) : processedHtmlSource ? (
                        <iframe
                          srcDoc={processedHtmlSource}
                          title="HTML Source Fullscreen"
                          className="w-full h-full min-h-[700px] border-0"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center p-16 text-slate-500 text-xs">
                          No View Online link or HTML source provided.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 bg-white p-6 rounded-lg border border-slate-200 overflow-auto">
                  <p className="text-slate-600 text-xs">Expanded step workspace view active.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
