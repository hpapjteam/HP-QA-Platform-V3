import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { 
  Monitor, FileImage, Frame, Smartphone, Sun, Moon, CheckSquare, Square, 
  ChevronDown, UploadCloud, CheckCircle2, Maximize2, Minimize2, Type, 
  Tag, FileCode, Table, RefreshCw, Search, Copy, Check, X, AlertTriangle, Globe
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { parseMsgArrayBuffer, prepareEmailHtmlForDisplay } from '@/lib/msg-parser';

interface VisualComparisonProps {
  webViewUrl: string;
  figmaUrl?: string;
  htmlSource?: string;
  onMsgUploaded?: (subject: string, htmlContent?: string, fileName?: string) => void;
  initialMsgHtml?: string | null;
  initialMsgFileName?: string | null;
  initialMsgSubject?: string | null;
}

export interface ExtractedTypographyItem {
  id: number;
  tag: string;
  textContent: string;
  className: string;
  idName: string;
  fontSize: string;
  lineHeight: string;
  fontFamily: string;
  fontWeight: string;
  color: string;
  styleRaw: string;
}

export function VisualComparison({ 
  webViewUrl, 
  figmaUrl, 
  htmlSource,
  onMsgUploaded,
  initialMsgHtml,
  initialMsgFileName,
  initialMsgSubject
}: VisualComparisonProps) {
  const [leftTab, setLeftTab] = useState<'viewonline' | 'msg'>(() => {
    return (initialMsgHtml || initialMsgFileName) ? 'msg' : 'viewonline';
  });
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentMsgHtml, setCurrentMsgHtml] = useState<string | null>(initialMsgHtml || null);

  // Overlay state toggles in Visual Comparison stage
  const [showTypography, setShowTypography] = useState<boolean>(true);
  const [showAlt, setShowAlt] = useState<boolean>(false);
  const [showAlias, setShowAlias] = useState<boolean>(false);

  // Style Table Inspector drawer state
  const [showStyleInspector, setShowStyleInspector] = useState<boolean>(false);
  const [styleSearch, setStyleSearch] = useState<string>('');
  const [styleFilter, setStyleFilter] = useState<'all' | 'p' | 'headings' | 'span' | 'cells'>('all');
  const [copiedStyleId, setCopiedStyleId] = useState<number | null>(null);

  // View online HTML fetching
  const [onlineHtml, setOnlineHtml] = useState<string>('');
  const [isFetchingOnline, setIsFetchingOnline] = useState<boolean>(false);
  const [onlineUrlInput, setOnlineUrlInput] = useState<string>(webViewUrl || '');
  const [fetchError, setFetchError] = useState<string | null>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  const normalizeUrl = useCallback((u: string) => {
    if (!u) return '';
    let trimmed = u.trim();
    if (trimmed === 'about:blank') return trimmed;
    if (!/^https?:\/\//i.test(trimmed)) {
      trimmed = 'https://' + trimmed;
    }
    return trimmed;
  }, []);

  const fetchViewOnlineHtml = useCallback(async (urlToFetch?: string) => {
    const rawUrl = urlToFetch || onlineUrlInput || webViewUrl;
    if (!rawUrl || rawUrl === 'about:blank' || !rawUrl.trim()) return;

    const normalized = normalizeUrl(rawUrl);
    setIsFetchingOnline(true);
    setFetchError(null);

    let text = "";

    // Tier 1: Internal proxy
    try {
      const res = await fetch(`/api/proxy?url=${encodeURIComponent(normalized)}`);
      if (res.ok) {
        text = await res.text();
      }
    } catch (e) {
      console.warn("[VisualComparison] Internal proxy fetch failed:", e);
    }

    // Tier 2: Direct fetch
    if (!text) {
      try {
        const res = await fetch(normalized);
        if (res.ok) {
          text = await res.text();
        }
      } catch (e) {
        console.warn("[VisualComparison] Direct fetch failed:", e);
      }
    }

    // Tier 3: External allorigins proxy
    if (!text) {
      try {
        const extProxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(normalized)}`;
        const resExt = await fetch(extProxyUrl);
        if (resExt.ok) {
          text = await resExt.text();
        }
      } catch (e) {
        console.warn("[VisualComparison] External proxy fetch failed:", e);
      }
    }

    if (text) {
      setOnlineHtml(text);
      setFetchError(null);
    } else {
      setFetchError("Could not fetch View Online content via proxy. Standard iframe preview will be used.");
    }
    setIsFetchingOnline(false);
  }, [onlineUrlInput, webViewUrl, normalizeUrl]);

  useEffect(() => {
    if (initialMsgHtml) {
      setCurrentMsgHtml(initialMsgHtml);
      setLeftTab('msg');
    } else if (initialMsgFileName) {
      setLeftTab('msg');
    }
  }, [initialMsgHtml, initialMsgFileName]);

  // Automatically fetch view online HTML if URL is provided or changes
  useEffect(() => {
    if (webViewUrl && webViewUrl !== 'about:blank') {
      setOnlineUrlInput(webViewUrl);
      fetchViewOnlineHtml(webViewUrl);
    }
  }, [webViewUrl, fetchViewOnlineHtml]);

  // Determine active HTML code for preview (View Online HTML or HTML Source or MSG HTML)
  const activePreviewHtml = useMemo(() => {
    if (leftTab === 'viewonline') {
      if (onlineHtml) return onlineHtml;
      if (htmlSource) return htmlSource;
      return '';
    } else {
      if (currentMsgHtml) return currentMsgHtml;
      if (htmlSource) return htmlSource;
      return '';
    }
  }, [leftTab, onlineHtml, htmlSource, currentMsgHtml]);

  // Inject overlay inspection script into the HTML string
  const processedPreviewHtml = useMemo(() => {
    if (!activePreviewHtml) return '';

    const script = `
      <style>
        .qa-overlay {
          position: absolute !important;
          z-index: 999999 !important;
          pointer-events: none !important;
          font-family: system-ui, -apple-system, sans-serif !important;
          line-height: 1.2 !important;
          white-space: nowrap !important;
        }
        .qa-overlay.alt-tag {
          background: rgba(16, 185, 129, 0.95) !important;
          color: #ffffff !important;
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 700;
          box-shadow: 0 2px 5px rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.4);
        }
        .qa-overlay.alias-tag {
          background: rgba(79, 70, 229, 0.95) !important;
          color: #ffffff !important;
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 700;
          box-shadow: 0 2px 5px rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.4);
        }
        .qa-overlay.typography-tag {
          background: rgba(217, 119, 6, 0.95) !important;
          color: #ffffff !important;
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 700;
          box-shadow: 0 2px 5px rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.4);
        }
      </style>
      <script>
        function createOverlay(targetEl, text, customClass, position) {
          const rect = targetEl.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) return;

          const overlay = document.createElement('div');
          overlay.className = 'qa-overlay ' + (customClass || '');
          overlay.textContent = text;

          const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
          const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

          overlay.style.left = (rect.left + scrollLeft) + 'px';
          if (position === 'bottom') {
            overlay.style.top = (rect.top + scrollTop + rect.height + 2) + 'px';
          } else {
            overlay.style.top = Math.max(0, rect.top + scrollTop - 20) + 'px';
          }

          document.body.appendChild(overlay);
        }

        function updateOverlays(showAlt, showAlias, showTypography) {
          document.querySelectorAll('.qa-overlay').forEach(el => el.remove());

          if (showAlt) {
            document.querySelectorAll('img').forEach((img) => {
              const alt = img.getAttribute('alt');
              const text = (alt === null || alt === undefined) ? 'ALT: MISSING' : (alt.trim() === '' ? 'ALT: EMPTY' : 'ALT: "' + alt + '"');
              createOverlay(img, text, 'alt-tag', 'top');
            });
          }

          if (showAlias) {
            document.querySelectorAll('a').forEach((a) => {
              const alias = a.getAttribute('alias') || a.getAttribute('name') || a.getAttribute('title');
              const text = alias ? 'ALIAS: "' + alias + '"' : 'ALIAS: MISSING';
              createOverlay(a, text, 'alias-tag', 'bottom');
            });
          }

          if (showTypography) {
            document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, td, th, a, font, div, li').forEach((el) => {
              const tag = el.tagName.toLowerCase();
              if (tag === 'div' || tag === 'td' || tag === 'th') {
                if (el.querySelector('p, h1, h2, h3, h4, h5, h6, li')) return;
              }
              const txt = (el.textContent || '').trim();
              if (!txt || txt.length < 1) return;

              const computed = window.getComputedStyle ? window.getComputedStyle(el) : null;
              const styleAttr = el.getAttribute('style') || '';
              const classAttr = el.getAttribute('class') || el.className || '';

              let fs = computed ? computed.fontSize : '';
              if (!fs || fs === '0px') {
                const fsMatch = styleAttr.match(/font-size\s*:\s*([^;]+)/i);
                if (fsMatch) fs = fsMatch[1].trim();
                else if (typeof classAttr === 'string') {
                  if (classAttr.includes('text-xs')) fs = '12px';
                  else if (classAttr.includes('text-sm')) fs = '14px';
                  else if (classAttr.includes('text-base')) fs = '16px';
                  else if (classAttr.includes('text-lg')) fs = '18px';
                  else if (classAttr.includes('text-xl')) fs = '20px';
                  else if (classAttr.includes('text-2xl')) fs = '24px';
                  else if (tag === 'h1') fs = '32px';
                  else if (tag === 'h2') fs = '24px';
                  else if (tag === 'h3') fs = '18px';
                  else fs = '14px';
                }
              }

              let lh = computed ? computed.lineHeight : '';
              if (!lh || lh === 'normal') {
                const lhMatch = styleAttr.match(/line-height\s*:\s*([^;]+)/i);
                if (lhMatch) lh = lhMatch[1].trim();
                else lh = 'Normal';
              }

              let text = '<' + tag + '>';
              if (classAttr && typeof classAttr === 'string' && classAttr.trim()) {
                const classList = classAttr.trim().split(/\\s+/).slice(0, 2).join(' .');
                text += ' Class: .' + classList;
              } else {
                text += ' Class: None';
              }
              if (fs) text += ' | Size: ' + fs;
              if (lh && lh !== 'normal') text += ' | LH: ' + lh;

              createOverlay(el, text, 'typography-tag', 'top');
            });
          }
        }

        window.addEventListener('message', (e) => {
          if (e.data && e.data.type === 'QA_OVERLAY_UPDATE') {
            updateOverlays(e.data.showAlt, e.data.showAlias, e.data.showTypography);
          }
        });

        window.addEventListener('load', () => {
          setTimeout(() => {
            updateOverlays(${showAlt}, ${showAlias}, ${showTypography});
          }, 300);
        });
      </script>
    `;

    let result = activePreviewHtml;
    if (leftTab === 'viewonline' && webViewUrl) {
      result = `<base href="${webViewUrl}">` + result;
    }

    if (result.includes('</head>')) {
      return result.replace('</head>', script + '</head>');
    }
    return result + script;
  }, [activePreviewHtml, leftTab, webViewUrl, showAlt, showAlias, showTypography]);

  // PostMessage updates to iframe whenever toggles change
  useEffect(() => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage({
          type: 'QA_OVERLAY_UPDATE',
          showAlt,
          showAlias,
          showTypography
        }, '*');
      } catch (err) {
        console.warn("Error posting overlay update to iframe:", err);
      }
    }
  }, [showAlt, showAlias, showTypography]);

  // Extract typography elements for the Inspector Drawer
  const extractedTypographyItems = useMemo<ExtractedTypographyItem[]>(() => {
    if (!activePreviewHtml) return [];
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(activePreviewHtml, 'text/html');
      const elements = doc.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, td, th, a, font, div, li');
      const items: ExtractedTypographyItem[] = [];
      let counter = 1;

      elements.forEach((el) => {
        const tag = el.tagName.toLowerCase();
        if (tag === 'div' || tag === 'td' || tag === 'th') {
          if (el.querySelector('p, h1, h2, h3, h4, h5, h6, li')) return;
        }

        const text = (el.textContent || '').trim();
        if (!text || text.length < 2) return;

        const styleRaw = el.getAttribute('style') || '';
        const className = el.getAttribute('class') || el.className || '';
        const idName = el.getAttribute('id') || '';

        // Font size parsing
        let fontSize = '';
        const fsMatch = styleRaw.match(/font-size\s*:\s*([^;]+)/i);
        if (fsMatch) {
          fontSize = fsMatch[1].trim();
        } else if (typeof className === 'string') {
          if (className.includes('text-xs')) fontSize = '12px';
          else if (className.includes('text-sm')) fontSize = '14px';
          else if (className.includes('text-base')) fontSize = '16px';
          else if (className.includes('text-lg')) fontSize = '18px';
          else if (className.includes('text-xl')) fontSize = '20px';
          else if (className.includes('text-2xl')) fontSize = '24px';
          else if (tag === 'h1') fontSize = '32px';
          else if (tag === 'h2') fontSize = '24px';
          else if (tag === 'h3') fontSize = '18px';
          else fontSize = '14px';
        } else {
          fontSize = '14px';
        }

        // Line height parsing
        let lineHeight = '';
        const lhMatch = styleRaw.match(/line-height\s*:\s*([^;]+)/i);
        if (lhMatch) {
          lineHeight = lhMatch[1].trim();
        } else {
          lineHeight = 'Normal (Auto)';
        }

        // Font family parsing
        let fontFamily = '';
        const ffMatch = styleRaw.match(/font-family\s*:\s*([^;]+)/i);
        if (ffMatch) {
          fontFamily = ffMatch[1].trim().replace(/['"]/g, '');
        } else {
          fontFamily = 'Inherited';
        }

        // Font weight parsing
        let fontWeight = '';
        const fwMatch = styleRaw.match(/font-weight\s*:\s*([^;]+)/i);
        if (fwMatch) {
          fontWeight = fwMatch[1].trim();
        } else if (typeof className === 'string' && className.includes('font-bold')) {
          fontWeight = 'Bold (700)';
        } else {
          fontWeight = 'Normal (400)';
        }

        // Color parsing
        let color = '';
        const colorMatch = styleRaw.match(/(?:^|;|\s)color\s*:\s*([^;]+)/i);
        if (colorMatch) {
          color = colorMatch[1].trim();
        } else {
          color = '#000000';
        }

        items.push({
          id: counter++,
          tag,
          textContent: text.length > 120 ? text.substring(0, 120) + '...' : text,
          className: typeof className === 'string' && className ? className : 'None',
          idName: idName || 'None',
          fontSize,
          lineHeight,
          fontFamily,
          fontWeight,
          color,
          styleRaw
        });
      });

      return items;
    } catch (err) {
      console.warn("Failed to extract typography for inspection table:", err);
      return [];
    }
  }, [activePreviewHtml]);

  const filteredStyleItems = useMemo(() => {
    return extractedTypographyItems.filter(item => {
      if (styleSearch) {
        const q = styleSearch.toLowerCase();
        const matchesQuery = item.textContent.toLowerCase().includes(q) ||
                             item.className.toLowerCase().includes(q) ||
                             item.tag.toLowerCase().includes(q) ||
                             item.fontSize.toLowerCase().includes(q) ||
                             item.lineHeight.toLowerCase().includes(q) ||
                             item.fontFamily.toLowerCase().includes(q);
        if (!matchesQuery) return false;
      }

      if (styleFilter === 'p') return item.tag === 'p';
      if (styleFilter === 'headings') return item.tag.startsWith('h');
      if (styleFilter === 'span') return item.tag === 'span' || item.tag === 'a';
      if (styleFilter === 'cells') return item.tag === 'td' || item.tag === 'th';

      return true;
    });
  }, [extractedTypographyItems, styleSearch, styleFilter]);

  const handleCopyStyleInfo = (item: ExtractedTypographyItem) => {
    const textToCopy = `Tag: <${item.tag}>\nClass: ${item.className}\nFont Size: ${item.fontSize}\nLine Height: ${item.lineHeight}\nFont Family: ${item.fontFamily}\nFont Weight: ${item.fontWeight}\nColor: ${item.color}\nContent: "${item.textContent}"`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedStyleId(item.id);
    setTimeout(() => setCopiedStyleId(null), 2000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.name.endsWith('.msg')) {
         const reader = new FileReader();
         reader.onload = async (e) => {
            const buffer = e.target?.result as ArrayBuffer;
            if (buffer) {
               const parsed = await parseMsgArrayBuffer(buffer, file.name);
               setCurrentMsgHtml(parsed.htmlContent);
               setLeftTab('msg');
               onMsgUploaded?.(parsed.subject, parsed.htmlContent, file.name);
            }
         };
         reader.readAsArrayBuffer(file);
      } else {
        const text = await file.text();
        setCurrentMsgHtml(text);
        setLeftTab('msg');
        onMsgUploaded?.(file.name, text, file.name);
      }
    }
  };

  const getFigmaEmbedUrl = (url: string) => {
    if (!url) return '';
    if (url.includes('figma.com')) {
      return `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(url)}`;
    }
    return url;
  };
  const figmaEmbed = getFigmaEmbedUrl(figmaUrl || '');

  const [checks, setChecks] = useState({
    desktopLight: false,
    mobileLight: false,
    desktopDark: false,
    mobileDark: false,
  });

  const toggleCheck = (key: keyof typeof checks) => {
    setChecks(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const checklistItems = [
    { id: 'desktopLight', label: 'Desktop (Light Mode)' },
    { id: 'mobileLight', label: 'Mobile (Light Mode)' },
    { id: 'desktopDark', label: 'Desktop (Dark Mode)' },
    { id: 'mobileDark', label: 'Mobile (Dark Mode)' },
  ] as const;

  const [splitRatio, setSplitRatio] = useState(50);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newRatio = ((e.clientX - containerRect.left) / containerRect.width) * 100;
    if (newRatio > 20 && newRatio < 80) {
      setSplitRatio(newRatio);
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    document.body.style.cursor = 'default';
  }, []);

  useEffect(() => {
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <div ref={containerRef} className={cn("flex flex-col bg-slate-100 p-2 gap-2 overflow-hidden transition-all duration-300 relative", isFullscreen ? "fixed inset-0 z-[9999]" : "h-full w-full")}>
      
      {/* Visual Comparison Split Container */}
      <div className="flex flex-1 min-h-0 gap-1 overflow-hidden">
        
        {/* Left Column: View Online / MSG Preview with Template Overlays */}
        <div className="flex flex-col bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden min-w-0" style={{ flex: splitRatio }}>
          
          {/* Top Control Bar */}
          <div className="bg-slate-50 border-b border-slate-200 p-2 flex flex-col gap-2 shrink-0 overflow-visible relative">
            
            {/* Row 1: Left Tab & Device/Theme */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex bg-slate-200 p-1 rounded-md">
                <button 
                  type="button"  
                  onClick={() => setLeftTab('viewonline')}
                  className={cn("px-3 py-1.5 text-xs font-semibold rounded-sm flex items-center gap-2 transition-all cursor-pointer", leftTab === 'viewonline' ? "bg-white shadow-2xs text-blue-600" : "text-slate-600 hover:text-slate-900")}
                >
                  <Monitor className="w-3.5 h-3.5" /> View Online Template
                </button>
                <button 
                  type="button"  
                  onClick={() => setLeftTab('msg')}
                  className={cn("px-3 py-1.5 text-xs font-semibold rounded-sm flex items-center gap-2 transition-all cursor-pointer", leftTab === 'msg' ? "bg-white shadow-2xs text-emerald-600" : "text-slate-600 hover:text-slate-900")}
                >
                  <FileImage className="w-3.5 h-3.5" /> MSG / HTML
                </button>
              </div>
              
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex bg-slate-100 p-1 rounded-md border border-slate-200">
                  <button type="button" onClick={() => setDevice('desktop')} className={cn("px-2 py-1 text-xs rounded-sm cursor-pointer", device === 'desktop' ? "bg-white shadow-2xs text-slate-800 font-bold" : "text-slate-500")}>
                    <Monitor className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => setDevice('mobile')} className={cn("px-2 py-1 text-xs rounded-sm cursor-pointer", device === 'mobile' ? "bg-white shadow-2xs text-slate-800 font-bold" : "text-slate-500")}>
                    <Smartphone className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-md border border-slate-200">
                  <button type="button" onClick={() => setTheme('light')} className={cn("px-2 py-1 text-xs rounded-sm cursor-pointer", theme === 'light' ? "bg-white shadow-2xs text-amber-500" : "text-slate-500")}>
                    <Sun className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => setTheme('dark')} className={cn("px-2 py-1 text-xs rounded-sm cursor-pointer", theme === 'dark' ? "bg-slate-800 shadow-2xs text-blue-300" : "text-slate-500")}>
                    <Moon className="w-3.5 h-3.5" />
                  </button>
                </div>
                
                {/* Hoverable QA Checklist Trigger */}
                <div 
                  className="relative z-50"
                  onMouseEnter={() => setChecklistOpen(true)}
                  onMouseLeave={() => setChecklistOpen(false)}
                >
                  <button 
                    type="button"  
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md shadow-2xs cursor-pointer"
                  >
                    <CheckSquare className="w-4 h-4 text-blue-500" />
                    QA Checklist
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </button>
                  
                  {checklistOpen && (
                    <div className="absolute top-full right-0 mt-1 w-64 bg-white rounded-md shadow-2xl border border-slate-200 p-2 grid gap-1">
                      {checklistItems.map((item) => (
                        <button 
                          type="button"  
                          key={item.id}
                          onClick={() => toggleCheck(item.id)}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded text-xs text-left transition-colors cursor-pointer",
                            checks[item.id] ? "bg-emerald-50 text-emerald-800" : "hover:bg-slate-50 text-slate-600"
                          )}
                        >
                          {checks[item.id] ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <Square className="w-4 h-4 text-slate-300 shrink-0" />}
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Row 1.5: View Online URL Input Bar when View Online tab is active */}
            {leftTab === 'viewonline' && (
              <div className="bg-blue-50/70 p-2 rounded-md border border-blue-100 flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 shrink-0">
                  <Globe className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-xs font-bold text-slate-700">View Online URL:</span>
                </div>
                <div className="relative flex-1 min-w-[220px]">
                  <input
                    type="url"
                    value={onlineUrlInput}
                    onChange={(e) => setOnlineUrlInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') fetchViewOnlineHtml(); }}
                    placeholder="Paste View Online URL (e.g. https://viewonline.example.com)..."
                    className="w-full h-7 px-2.5 text-xs bg-white border border-slate-300 rounded focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-mono text-slate-800"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => fetchViewOnlineHtml()}
                  disabled={isFetchingOnline || !onlineUrlInput.trim()}
                  className="h-7 px-3 text-xs font-bold bg-[#2b61d6] hover:bg-blue-700 disabled:opacity-50 text-white rounded flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors shadow-2xs"
                >
                  <RefreshCw className={cn("w-3 h-3", isFetchingOnline && "animate-spin")} />
                  <span>{isFetchingOnline ? "Loading..." : "Fetch Template"}</span>
                </button>

                {onlineHtml ? (
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md border border-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Template Loaded
                  </span>
                ) : fetchError ? (
                  <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-md border border-amber-300 flex items-center gap-1" title={fetchError}>
                    <AlertTriangle className="w-3 h-3 text-amber-600" /> {fetchError}
                  </span>
                ) : null}
              </div>
            )}

            {/* Row 2: Template Class & Styles Overlay Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/80">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">
                  Template Overlays:
                </span>

                {/* Primary Requested Feature: Classes, Font Sizes & Line Heights Overlay Button */}
                <button
                  type="button"
                  onClick={() => setShowTypography(!showTypography)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer",
                    showTypography 
                      ? "bg-amber-600 text-white ring-2 ring-amber-400/50" 
                      : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                  )}
                  title="Show/Hide Classes, Font Sizes & Line Heights directly on the template tags"
                >
                  <Type className="w-4 h-4" />
                  <span>Classes, Font Sizes &amp; Line Heights</span>
                  {showTypography && (
                    <span className="ml-1 bg-white/20 text-white px-1.5 py-0.2 rounded-full text-[10px]">
                      ON
                    </span>
                  )}
                </button>

                {/* Alt Tags Toggle */}
                <button
                  type="button"
                  onClick={() => setShowAlt(!showAlt)}
                  className={cn(
                    "px-2.5 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1 cursor-pointer",
                    showAlt 
                      ? "bg-emerald-600 text-white shadow-2xs" 
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                  )}
                  title="Show Alt Tags on images"
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span>Alt Tags</span>
                </button>

                {/* Alias Tags Toggle */}
                <button
                  type="button"
                  onClick={() => setShowAlias(!showAlias)}
                  className={cn(
                    "px-2.5 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1 cursor-pointer",
                    showAlias 
                      ? "bg-indigo-600 text-white shadow-2xs" 
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                  )}
                  title="Show Alias Tags on links"
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>Alias Tags</span>
                </button>
              </div>

              {/* Styles Inspection Table Drawer Button */}
              <button
                type="button"
                onClick={() => setShowStyleInspector(!showStyleInspector)}
                className={cn(
                  "px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 cursor-pointer border",
                  showStyleInspector 
                    ? "bg-slate-800 text-white border-slate-800 shadow-2xs" 
                    : "bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100"
                )}
              >
                <Table className="w-3.5 h-3.5 text-amber-600" />
                <span>Inspect Styles Table ({extractedTypographyItems.length})</span>
              </button>
            </div>

          </div>

          {/* Main Preview Container with Injected Overlay Script */}
          <div className="flex-1 bg-slate-200 relative flex justify-center overflow-auto p-4">
            <div className={cn(
              "bg-white shadow-xl transition-all duration-300 border border-slate-300 rounded overflow-hidden flex flex-col min-h-full relative",
              device === 'desktop' ? "w-full" : "w-[375px] shrink-0"
            )}>
              {processedPreviewHtml ? (
                <iframe 
                  ref={iframeRef}
                  srcDoc={processedPreviewHtml}
                  className={cn("w-full h-full border-0 min-h-[500px]", theme === 'dark' ? "invert hue-rotate-180 contrast-125" : "")} 
                  title="Visual Comparison View Online Preview with Class & Style Overlays"
                />
              ) : webViewUrl && webViewUrl !== 'about:blank' ? (
                <iframe 
                  ref={iframeRef}
                  src={`/api/proxy?url=${encodeURIComponent(webViewUrl)}`}
                  className={cn("w-full h-full border-0 min-h-[500px]", theme === 'dark' ? "invert hue-rotate-180 contrast-125" : "")} 
                  title="View Online Proxy Preview"
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400 text-sm gap-2">
                  <Globe className="w-10 h-10 text-slate-300 mb-1" />
                  <span className="font-bold text-slate-600">No Template Content Loaded</span>
                  <span className="text-xs text-slate-400 max-w-sm">
                    Enter a View Online URL in Stage 1 or upload a MSG/HTML file to preview classes, font sizes, and line heights.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Resizer */}
        <div 
          className="w-2 shrink-0 cursor-col-resize group flex items-center justify-center z-10 transition-colors hover:bg-slate-200/60 rounded-full"
          onMouseDown={handleMouseDown}
        >
          <div className="w-1 h-12 bg-slate-300 group-hover:bg-blue-500 rounded-full transition-colors" />
        </div>

        {/* Right Column: Figma Design */}
        <div className="flex flex-col bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden min-w-0" style={{ flex: 100 - splitRatio }}>
          <div className="bg-slate-50 border-b border-slate-200 p-3 flex items-center justify-between shrink-0 h-[53px]">
            <div className="flex items-center gap-2">
              <Frame className="w-4 h-4 text-purple-600" />
              <h3 className="text-sm font-bold text-slate-800">Figma Design</h3>
            </div>
            <button 
              type="button" 
              onClick={() => setIsFullscreen(!isFullscreen)} 
              className="text-slate-500 hover:text-[#2b61d6] p-1.5 bg-white rounded border border-slate-200 shadow-2xs transition-colors cursor-pointer"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
          <div className="flex-1 bg-slate-100 relative">
            {figmaEmbed ? (
              <iframe 
                src={figmaEmbed}
                className="w-full h-full border-0 bg-white"
                title="Figma"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 text-sm gap-3">
                <Frame className="w-12 h-12 opacity-20" />
                <span>No Figma URL provided</span>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Style & Typography Inspector Drawer Panel (Toggleable inside Visual Comparison) */}
      {showStyleInspector && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xl space-y-3 shrink-0 max-h-[350px] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Type className="w-4 h-4 text-amber-600" />
              <h4 className="font-bold text-xs text-slate-900">
                Classes, Font Sizes &amp; Line Heights Inspection Table ({filteredStyleItems.length} items)
              </h4>
              <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                Extracted from {leftTab === 'viewonline' ? 'View Online' : 'MSG/HTML'} Template
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowStyleInspector(false)}
              className="text-slate-400 hover:text-slate-700 p-1 rounded-md hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search & Tag Filter controls */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                type="text"
                placeholder="Search classes, font sizes, line heights, or text..."
                value={styleSearch}
                onChange={(e) => setStyleSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-slate-50 border-slate-200"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setStyleFilter('all')}
                className={cn("px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer", styleFilter === 'all' ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-800")}
              >
                All ({extractedTypographyItems.length})
              </button>
              <button
                type="button"
                onClick={() => setStyleFilter('p')}
                className={cn("px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer", styleFilter === 'p' ? "bg-white text-blue-700 shadow-2xs" : "text-slate-500 hover:text-slate-800")}
              >
                &lt;p&gt;
              </button>
              <button
                type="button"
                onClick={() => setStyleFilter('headings')}
                className={cn("px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer", styleFilter === 'headings' ? "bg-white text-emerald-700 shadow-2xs" : "text-slate-500 hover:text-slate-800")}
              >
                &lt;h&gt;
              </button>
              <button
                type="button"
                onClick={() => setStyleFilter('span')}
                className={cn("px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer", styleFilter === 'span' ? "bg-white text-violet-700 shadow-2xs" : "text-slate-500 hover:text-slate-800")}
              >
                &lt;span/a&gt;
              </button>
              <button
                type="button"
                onClick={() => setStyleFilter('cells')}
                className={cn("px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer", styleFilter === 'cells' ? "bg-white text-amber-700 shadow-2xs" : "text-slate-500 hover:text-slate-800")}
              >
                &lt;td&gt;
              </button>
            </div>
          </div>

          {/* Table displaying classes, font sizes and line heights */}
          <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-bold">
                <tr>
                  <th className="p-2.5">Tag</th>
                  <th className="p-2.5">Class Name</th>
                  <th className="p-2.5">Font Size</th>
                  <th className="p-2.5">Line Height</th>
                  <th className="p-2.5">Font Family</th>
                  <th className="p-2.5">Content Snippet</th>
                  <th className="p-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {filteredStyleItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-400">
                      No matching classes, font sizes, or line heights found.
                    </td>
                  </tr>
                ) : (
                  filteredStyleItems.slice(0, 100).map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-2.5 font-bold">
                        <span className="bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded font-mono text-[11px]">
                          &lt;{item.tag}&gt;
                        </span>
                      </td>
                      <td className="p-2.5 font-mono text-slate-700 max-w-[150px] truncate" title={item.className}>
                        {item.className !== 'None' ? (
                          <span className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded border border-slate-200 text-[11px]">
                            .{item.className}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </td>
                      <td className="p-2.5 text-emerald-700 font-bold">
                        {item.fontSize}
                      </td>
                      <td className="p-2.5 text-blue-700 font-bold">
                        {item.lineHeight}
                      </td>
                      <td className="p-2.5 text-slate-600 max-w-[120px] truncate" title={item.fontFamily}>
                        {item.fontFamily}
                      </td>
                      <td className="p-2.5 text-slate-500 max-w-[200px] truncate" title={item.textContent}>
                        "{item.textContent}"
                      </td>
                      <td className="p-2.5 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyStyleInfo(item)}
                          className="h-7 px-2 text-[11px] text-slate-600 hover:text-slate-900"
                        >
                          {copiedStyleId === item.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
