import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Tag, Image, AlertTriangle, Type, Maximize2, Minimize2, CheckSquare, FileCode2, Code, Copy, LayoutTemplate, HelpCircle, X, CheckCircle2, ChevronRight, Check, Eye, Grid, Monitor, ExternalLink, RefreshCw, Search, Globe } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from '@/lib/utils';

interface TagInspectionProps {
  htmlSource: string;
  subjectLine?: string;
  viewOnlineUrl?: string;
}

interface ExtractedImageItem {
  id: number;
  src: string;
  alt: string | null;
  alias: string | null;
  href: string | null;
  versionType: string;
}

export function TagInspection({ htmlSource, subjectLine, viewOnlineUrl }: TagInspectionProps) {
  // Requirement 1: Default to false so highlights don't show automatically until clicked
  const [showAlt, setShowAlt] = useState(false);
  const [showAlias, setShowAlias] = useState(false);
  const [showSup, setShowSup] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'webview' | 'gallery'>('webview');
  const [galleryFilter, setGalleryFilter] = useState<'all' | 'missing-alt' | 'missing-alias' | 'both-present'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // View Online URL image extraction state
  const [imageSourceMode, setImageSourceMode] = useState<'viewonline' | 'html'>(viewOnlineUrl ? 'viewonline' : 'html');
  const [onlineUrlInput, setOnlineUrlInput] = useState<string>(viewOnlineUrl || '');
  const [isFetchingOnline, setIsFetchingOnline] = useState<boolean>(false);
  const [onlineImages, setOnlineImages] = useState<ExtractedImageItem[]>([]);
  const [onlineError, setOnlineError] = useState<string | null>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Helper to extract image items from DOM
  const extractImagesFromDoc = (doc: Document): ExtractedImageItem[] => {
    const imgElements = doc.querySelectorAll('img');
    const items: ExtractedImageItem[] = [];

    imgElements.forEach((img, idx) => {
      const src = img.getAttribute('src') || img.getAttribute('data-src') || '';
      const alt = img.getAttribute('alt');
      
      const parentAnchor = img.closest('a');
      const alias = parentAnchor 
        ? (parentAnchor.getAttribute('alias') || parentAnchor.getAttribute('name') || parentAnchor.getAttribute('title'))
        : (img.getAttribute('alias') || img.getAttribute('name'));
      const href = parentAnchor ? parentAnchor.getAttribute('href') : null;

      let versionType = `Image #${idx + 1}`;
      const lowerSrc = src.toLowerCase();
      if (lowerSrc.includes('mob') || lowerSrc.includes('m_') || lowerSrc.includes('sp_') || lowerSrc.includes('phone')) {
        versionType = `Mobile / Version 2 (#${idx + 1})`;
      } else if (lowerSrc.includes('desk') || lowerSrc.includes('d_') || lowerSrc.includes('pc_') || lowerSrc.includes('main')) {
        versionType = `Desktop / Version 1 (#${idx + 1})`;
      }

      items.push({
        id: idx + 1,
        src,
        alt: alt !== null ? alt : null,
        alias: alias || null,
        href: href || null,
        versionType
      });
    });

    return items;
  };

  // Requirement 2 & 4: Extract all images from HTML source
  const parsedHtmlImages = useMemo<ExtractedImageItem[]>(() => {
    if (!htmlSource) return [];
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlSource, 'text/html');
      return extractImagesFromDoc(doc);
    } catch (err) {
      console.warn("Failed to parse HTML for images:", err);
      return [];
    }
  }, [htmlSource]);

  // Fetch images from View Online URL
  const handleFetchOnlineImages = async (urlToFetch?: string) => {
    const targetUrl = urlToFetch || onlineUrlInput || viewOnlineUrl;
    if (!targetUrl || !targetUrl.trim()) return;

    setIsFetchingOnline(true);
    setOnlineError(null);

    try {
      // Try direct fetch or cors proxy
      let responseText = "";
      try {
        const res = await fetch(targetUrl.trim());
        if (res.ok) {
          responseText = await res.text();
        }
      } catch (e) {
        console.warn("Direct fetch failed due to CORS, attempting proxy fetch...", e);
      }

      if (!responseText) {
        // Use allorigins cors proxy fallback
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl.trim())}`;
        const resProxy = await fetch(proxyUrl);
        if (resProxy.ok) {
          responseText = await resProxy.text();
        }
      }

      if (responseText) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(responseText, 'text/html');
        // Fix relative img src URLs
        const baseUrl = new URL(targetUrl.trim()).origin;
        doc.querySelectorAll('img').forEach((img) => {
          const s = img.getAttribute('src');
          if (s && !s.startsWith('http') && !s.startsWith('data:')) {
            img.setAttribute('src', new URL(s, baseUrl).href);
          }
        });

        const extracted = extractImagesFromDoc(doc);
        setOnlineImages(extracted);
        setImageSourceMode('viewonline');
      } else {
        throw new Error("Could not retrieve View Online page content.");
      }
    } catch (err: any) {
      console.error("View online fetch error:", err);
      setOnlineError("Unable to fetch View Online URL directly. Defaulting to HTML source code images.");
      // Fallback to HTML source code if online fails
      setImageSourceMode('html');
    } finally {
      setIsFetchingOnline(false);
    }
  };

  useEffect(() => {
    if (viewOnlineUrl && viewOnlineUrl.trim()) {
      setOnlineUrlInput(viewOnlineUrl);
      handleFetchOnlineImages(viewOnlineUrl);
    }
  }, [viewOnlineUrl]);

  // Determine active images array based on selected mode
  const activeParsedImages = useMemo(() => {
    if (imageSourceMode === 'viewonline' && onlineImages.length > 0) {
      return onlineImages;
    }
    return parsedHtmlImages;
  }, [imageSourceMode, onlineImages, parsedHtmlImages]);

  const filteredGalleryImages = useMemo(() => {
    return activeParsedImages.filter(img => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesQuery = (img.alt && img.alt.toLowerCase().includes(q)) ||
                             (img.alias && img.alias.toLowerCase().includes(q)) ||
                             (img.src && img.src.toLowerCase().includes(q)) ||
                             (img.versionType && img.versionType.toLowerCase().includes(q));
        if (!matchesQuery) return false;
      }

      if (galleryFilter === 'missing-alt') return img.alt === null || img.alt.trim() === '';
      if (galleryFilter === 'missing-alias') return !img.alias || img.alias.trim() === '';
      if (galleryFilter === 'both-present') return img.alt !== null && img.alt.trim() !== '' && img.alias && img.alias.trim() !== '';
      return true;
    });
  }, [activeParsedImages, galleryFilter, searchQuery]);

  const processedHtml = useMemo(() => {
    if (!htmlSource) return '';
    
    const script = `
      <style>
        @keyframes tagHighlight {
          0% { transform: scale(0.8); opacity: 0; box-shadow: 0 0 0 0px rgba(255,255,255,0.7); }
          50% { transform: scale(1.05); opacity: 1; box-shadow: 0 0 0 6px rgba(255,255,255,0); }
          100% { transform: scale(1); opacity: 1; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
        }
        @keyframes targetHighlight {
          0% { filter: brightness(1); outline: 2px solid transparent; }
          30% { filter: brightness(1.1) sepia(0.2); outline: 2px solid rgba(43, 97, 214, 0.8); outline-offset: 2px; }
          100% { filter: brightness(1); outline: 2px solid transparent; outline-offset: 0px; }
        }
        .qa-target-highlight {
          animation: targetHighlight 1.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        .qa-overlay {
          position: absolute;
          background: rgba(43, 97, 214, 0.9);
          color: white;
          font-family: monospace;
          font-size: 11px;
          padding: 2px 6px;
          border-radius: 4px;
          pointer-events: none;
          z-index: 10000;
          white-space: nowrap;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          border: 1px solid rgba(255,255,255,0.2);
          animation: tagHighlight 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        .qa-overlay.alt-tag { background: rgba(16, 185, 129, 0.9); }
        .qa-overlay.alias-tag { background: rgba(139, 92, 246, 0.9); }
        .qa-overlay.sup-tag { 
          background: rgba(225, 29, 72, 0.9); 
          font-size: 10px;
          padding: 1px 4px;
        }
        .qa-img-highlight-green {
          outline: 3px solid rgba(16, 185, 129, 0.8) !important;
          outline-offset: -3px;
        }
        .qa-img-highlight-red {
          outline: 3px solid rgba(225, 29, 72, 0.8) !important;
          outline-offset: -3px;
        }
        .qa-sup-missing {
          outline: 2px solid #e11d48 !important;
          outline-offset: 2px;
          position: relative;
        }
        html, body { min-height: 100%; margin: 0; padding: 0; }
      </style>
      <script>
        function updateOverlays(showAlt, showAlias, showSup, subjectLine) {
          document.querySelectorAll('.qa-overlay').forEach(el => el.remove());
          window.overlayPositions = [];
          document.querySelectorAll('.qa-img-highlight-red').forEach(el => el.classList.remove('qa-img-highlight-red'));
          document.querySelectorAll('.qa-img-highlight-green').forEach(el => el.classList.remove('qa-img-highlight-green'));
          document.querySelectorAll('.qa-target-highlight').forEach(el => el.classList.remove('qa-target-highlight'));
          
          if (showAlt) {
            document.querySelectorAll('img').forEach((img, idx) => {
              const alt = img.getAttribute('alt');
              const title = img.getAttribute('title');
              const ariaLabel = img.getAttribute('aria-label');
              const dataAlt = img.getAttribute('data-alt');

              const lowerSrc = (img.getAttribute('src') || '').toLowerCase();
              const isMobile = lowerSrc.includes('mob') || lowerSrc.includes('m_') || lowerSrc.includes('sp_') || lowerSrc.includes('phone') || img.classList.contains('mobile') || (img.parentElement && img.parentElement.classList.contains('mobile'));
              const tagPrefix = isMobile ? 'Alt (Mobile): ' : 'Alt: ';

              // Primary Alt Tag
              if (alt !== null && alt.trim() !== '') {
                let text = tagPrefix + alt;
                if (subjectLine && alt.trim().toLowerCase() === subjectLine.trim().toLowerCase()) {
                  text = (isMobile ? '[Mobile] Subjectline: ' : 'Subjectline: ') + alt;
                  img.classList.add('qa-img-highlight-green');
                }
                createOverlay(img, text, 'alt-tag', 'bottom');
              } else {
                img.classList.add('qa-img-highlight-red');
                createOverlay(img, isMobile ? 'Missing Alt (Mobile)' : 'Missing Alt', 'alt-tag', 'bottom', true);
              }

              // Secondary Title/Aria-Label Tag if present and different from Alt
              const secondaryTag = (title && title.trim() !== alt) ? title : ((ariaLabel && ariaLabel.trim() !== alt) ? ariaLabel : (dataAlt && dataAlt.trim() !== alt ? dataAlt : null));
              if (secondaryTag && secondaryTag.trim() !== '') {
                createOverlay(img, 'Title: ' + secondaryTag, 'alt-tag', 'bottom');
              }
            });
          }

          if (showAlias) {
            document.querySelectorAll('a').forEach(a => {
              const alias = a.getAttribute('alias') || a.getAttribute('name') || a.getAttribute('title') || a.getAttribute('data-alias');
              const target = a.querySelector('img') || a;
              if (alias) {
                let text = 'Alias: ' + alias;
                if (subjectLine && alias.trim().toLowerCase() === subjectLine.trim().toLowerCase()) {
                  text = 'Subjectline: ' + alias;
                  target.classList.add('qa-img-highlight-green');
                }
                createOverlay(target, text, 'alias-tag', 'top');
              }
            });
          }

          if (showSup) {
             const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
             const nodesToWrap = [];
             let node;
             while (node = walker.nextNode()) {
               if (node.parentNode && node.parentNode.nodeName !== 'SUP' && node.parentNode.nodeName !== 'STYLE' && node.parentNode.nodeName !== 'SCRIPT') {
                 if (/[®™©℠]/.test(node.nodeValue)) {
                   nodesToWrap.push(node);
                 }
               }
             }
             
             nodesToWrap.forEach(textNode => {
                const parent = textNode.parentNode;
                if (parent.classList && parent.classList.contains('qa-sup-missing-wrapper')) {
                   parent.classList.add('qa-sup-missing');
                   return;
                }
                const span = document.createElement('span');
                span.className = 'qa-sup-missing-wrapper';
                span.innerHTML = textNode.nodeValue.replace(/([®™©℠])/g, '<span class="qa-sup-missing">$1</span>');
                parent.replaceChild(span, textNode);
             });
             
             document.querySelectorAll('.qa-sup-missing').forEach(el => {
                createOverlay(el, 'Missing <sup>', 'sup-tag', 'top');
             });
          }
        }
        
        function createOverlay(target, text, className, position, isError = false) {
           let rect = target.getBoundingClientRect();
           
           // If target is hidden or 0-sized (e.g. mobile version image hidden on desktop view), find nearest visible parent
           if ((rect.width === 0 && rect.height === 0) || rect.top < 0) {
             let curr = target.parentElement;
             while (curr && curr !== document.body) {
               const pRect = curr.getBoundingClientRect();
               if (pRect.width > 0 && pRect.height > 0) {
                 rect = pRect;
                 break;
               }
               curr = curr.parentElement;
             }
           }

           if (!target.classList.contains('qa-sup-missing-wrapper')) {
             target.classList.add('qa-target-highlight');
           }
           
           const div = document.createElement('div');
           div.className = 'qa-overlay ' + className;
           div.textContent = text;
           if (isError) {
             div.style.background = 'rgba(225, 29, 72, 0.9)';
           }
           
           document.body.appendChild(div);
           
           const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
           const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
           
           let top = rect.top + scrollTop;
           let left = rect.left + scrollLeft + 4;
           
           if (position === 'bottom') {
              top = rect.bottom + scrollTop - 20;
           } else {
              top = rect.top + scrollTop + 4;
           }
           
           // If top is calculated as off-screen or negative, pin to visible document area
           if (top < 10) {
             top = 10;
           }

           let attempts = 0;
           while(attempts < 20) {
             const collision = window.overlayPositions.find(p => Math.abs(p.top - top) < 22 && Math.abs(p.left - left) < 160);
             if (collision) {
               top += 24;
               attempts++;
             } else {
               break;
             }
           }
           window.overlayPositions.push({top, left});
           
           div.style.top = top + 'px';
           div.style.left = left + 'px';
        }

        window.addEventListener('message', (e) => {
          if (e.data.type === 'updateTags') {
            updateOverlays(e.data.showAlt, e.data.showAlias, e.data.showSup, e.data.subjectLine);
          }
        });

        window.addEventListener('load', () => {
           window.parent.postMessage({ type: 'iframeLoaded' }, window.location.origin);
           setTimeout(() => window.parent.postMessage({ type: 'iframeLoaded' }, window.location.origin), 500);
        });
      </script>
    `;
    
    if (htmlSource.includes('</head>')) {
      return htmlSource.replace('</head>', script + '</head>');
    }
    return htmlSource + script;
  }, [htmlSource]);

  useEffect(() => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage({
        type: 'updateTags',
        showAlt, showAlias, showSup, subjectLine
      }, '*');
    }
  }, [showAlt, showAlias, showSup, processedHtml, subjectLine]);

  return (
    <div className={cn("flex flex-col bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden transition-all duration-300", isFullscreen ? "fixed inset-0 z-[9999]" : "flex-1")}>
      
      {/* Top Header & Sub-tabs */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-200 bg-slate-50/90 shrink-0 flex-wrap">
        <div className="flex items-center gap-1.5 bg-slate-200/80 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveSubTab('webview')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer",
              activeSubTab === 'webview' ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Monitor className="w-3.5 h-3.5 text-[#2b61d6]" />
            <span>Interactive Webview</span>
          </button>
          
          <button
            type="button"
            onClick={() => setActiveSubTab('gallery')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer",
              activeSubTab === 'gallery' ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Grid className="w-3.5 h-3.5 text-emerald-600" />
            <span>All Images Gallery</span>
            <span className="text-[10px] h-4 px-1.5 font-bold bg-slate-100 text-slate-700 rounded-full inline-flex items-center">
              {activeParsedImages.length}
            </span>
          </button>
        </div>

        {subjectLine && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-200 rounded-md max-w-xl">
            <span className="text-[10px] font-bold text-indigo-600 uppercase shrink-0">Subject:</span>
            <span className="text-xs font-semibold text-indigo-950 break-words leading-tight">{subjectLine}</span>
          </div>
        )}

        <div className="flex items-center gap-2 ml-auto">
          {activeSubTab === 'webview' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setActiveSubTab('gallery')}
              className="h-7 text-xs font-semibold text-[#2b61d6] border-blue-200 bg-blue-50/50 hover:bg-blue-100/60 gap-1.5"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Show All Images CTA ({activeParsedImages.length})</span>
            </Button>
          )}

          <button 
            type="button" 
            onClick={() => setIsFullscreen(!isFullscreen)} 
            className="text-slate-500 hover:text-[#2b61d6] p-1.5 bg-white rounded border border-slate-200 shadow-2xs transition-colors"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Subtab 1: Interactive Webview */}
      {activeSubTab === 'webview' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          <div className="flex items-center justify-between gap-3 px-4 py-2 bg-slate-100 border-b border-slate-200 text-xs text-slate-600 flex-wrap">
            <span className="font-medium text-slate-500 text-[11px]">
              Click button to highlight specific tags on the preview:
            </span>

            {/* Requirement 1: Click toggles overlays */}
            <div className="flex items-center gap-1.5 bg-white p-1 rounded-md border border-slate-200 shadow-2xs">
              <button 
                type="button"
                onClick={() => setShowAlt(!showAlt)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer",
                  showAlt ? "bg-emerald-600 text-white shadow-2xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                <Image className="w-3.5 h-3.5" /> Alt Tags
              </button>
              
              <button 
                type="button"
                onClick={() => setShowAlias(!showAlias)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer",
                  showAlias ? "bg-violet-600 text-white shadow-2xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                <Tag className="w-3.5 h-3.5" /> Alias Tags
              </button>

              <button 
                type="button"
                onClick={() => setShowSup(!showSup)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer",
                  showSup ? "bg-rose-600 text-white shadow-2xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                <Type className="w-3.5 h-3.5" /> Missing &lt;sup&gt;
              </button>
            </div>
          </div>

          <div className="bg-slate-100 relative overflow-hidden flex flex-col p-2 sm:p-4 w-full flex-1 min-h-0">
            <div className="bg-white shadow-xl border border-slate-300 rounded-lg overflow-hidden flex flex-col flex-1 w-full mx-auto relative h-full">
              {processedHtml ? (
                <iframe 
                  ref={iframeRef}
                  srcDoc={processedHtml}
                  className="w-full flex-1 border-0 bg-white h-full"
                  title="HTML Tags Inspection"
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-sm p-8 text-center h-full">
                  <FileCode2 className="w-12 h-12 text-slate-300 mb-3" />
                  <p className="font-semibold text-slate-700">No HTML Source Provided</p>
                  <p className="text-xs mt-1 max-w-sm">Please return to Step 1 and provide the HTML source code to inspect tags.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Subtab 2: Requirement 4 - All Images & Version Comparison Gallery (Stacked Bottom-by-Bottom) */}
      {activeSubTab === 'gallery' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-slate-100 p-4 space-y-4">
          
          {/* Source Selector & View Online URL Pull Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-[#2b61d6]" />
                <h4 className="font-bold text-xs text-slate-800">
                  Image Source Selection:
                </h4>
              </div>

              <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setImageSourceMode('viewonline')}
                  className={cn(
                    "px-3 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 cursor-pointer",
                    imageSourceMode === 'viewonline'
                      ? "bg-[#2b61d6] text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Pull from View Online URL</span>
                  {onlineImages.length > 0 && (
                    <span className="ml-1 bg-white/20 text-white px-1.5 py-0.2 rounded-full text-[10px]">
                      {onlineImages.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setImageSourceMode('html')}
                  className={cn(
                    "px-3 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 cursor-pointer",
                    imageSourceMode === 'html'
                      ? "bg-slate-800 text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  <FileCode2 className="w-3.5 h-3.5" />
                  <span>Pull from HTML Code</span>
                  <span className="ml-1 bg-slate-200 text-slate-800 px-1.5 py-0.2 rounded-full text-[10px]">
                    {parsedHtmlImages.length}
                  </span>
                </button>
              </div>
            </div>

            {/* View Online URL Input Row */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Globe className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  type="url"
                  placeholder="Paste View Online URL (e.g. https://viewonline.example.com/campaign/v1)..."
                  value={onlineUrlInput}
                  onChange={(e) => setOnlineUrlInput(e.target.value)}
                  className="pl-9 h-9 text-xs bg-slate-50 border-slate-200 focus:bg-white"
                />
              </div>

              <Button
                type="button"
                onClick={() => handleFetchOnlineImages()}
                disabled={isFetchingOnline || !onlineUrlInput.trim()}
                className="h-9 px-4 text-xs font-bold bg-[#2b61d6] hover:bg-blue-700 text-white gap-1.5 shrink-0"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", isFetchingOnline && "animate-spin")} />
                <span>{isFetchingOnline ? "Pulling Images..." : "Pull All Images"}</span>
              </Button>
            </div>

            {onlineError && (
              <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                <span>{onlineError}</span>
              </div>
            )}
          </div>

          {/* Controls & Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-2">
              <Grid className="w-4 h-4 text-[#2b61d6]" />
              <h4 className="font-bold text-xs text-slate-800">
                Images Stacked Bottom-by-Bottom ({filteredGalleryImages.length} of {activeParsedImages.length})
              </h4>
              <span className="text-[10px] bg-blue-50 text-[#2b61d6] px-2 py-0.5 rounded-full font-bold border border-blue-200">
                {imageSourceMode === 'viewonline' ? 'Source: View Online URL' : 'Source: HTML Code'}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <div className="relative w-48">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input 
                  placeholder="Search tags or src..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-7 text-xs bg-slate-50 border-slate-200"
                />
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md">
                <button
                  type="button"
                  onClick={() => setGalleryFilter('all')}
                  className={cn("px-2 py-0.5 text-[11px] font-semibold rounded transition-all cursor-pointer", galleryFilter === 'all' ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-800")}
                >
                  All ({activeParsedImages.length})
                </button>
                <button
                  type="button"
                  onClick={() => setGalleryFilter('missing-alt')}
                  className={cn("px-2 py-0.5 text-[11px] font-semibold rounded transition-all cursor-pointer", galleryFilter === 'missing-alt' ? "bg-rose-500 text-white shadow-2xs" : "text-slate-500 hover:text-slate-800")}
                >
                  Missing Alt
                </button>
                <button
                  type="button"
                  onClick={() => setGalleryFilter('missing-alias')}
                  className={cn("px-2 py-0.5 text-[11px] font-semibold rounded transition-all cursor-pointer", galleryFilter === 'missing-alias' ? "bg-amber-500 text-white shadow-2xs" : "text-slate-500 hover:text-slate-800")}
                >
                  Missing Alias
                </button>
                <button
                  type="button"
                  onClick={() => setGalleryFilter('both-present')}
                  className={cn("px-2 py-0.5 text-[11px] font-semibold rounded transition-all cursor-pointer", galleryFilter === 'both-present' ? "bg-emerald-600 text-white shadow-2xs" : "text-slate-500 hover:text-slate-800")}
                >
                  Both Valid
                </button>
              </div>
            </div>
          </div>

          {filteredGalleryImages.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-500 text-xs">
              {isFetchingOnline 
                ? "Pulling images from View Online URL, please wait..."
                : "No images matching filter criteria found. Click 'Pull All Images' to load from View Online URL or switch to HTML Code."}
            </div>
          ) : (
            /* Bottom-by-bottom vertical stack layout (single column) */
            <div className="flex flex-col space-y-6 max-w-4xl mx-auto w-full pb-10">
              {filteredGalleryImages.map((imgItem) => {
                const hasAlt = imgItem.alt !== null && imgItem.alt.trim() !== '';
                const hasAlias = imgItem.alias !== null && imgItem.alias.trim() !== '';
                const altMatchesSubject = subjectLine && imgItem.alt?.trim().toLowerCase() === subjectLine.trim().toLowerCase();

                return (
                  <div 
                    key={imgItem.id} 
                    className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col space-y-4 hover:border-slate-300 transition-all"
                  >
                    {/* Header bar for image */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-black">
                          #{imgItem.id}
                        </span>
                        <div>
                          <span className="text-xs font-bold text-slate-800 block">
                            {imgItem.versionType}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Pulled via {imageSourceMode === 'viewonline' ? 'View Online Page' : 'HTML Code'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {hasAlt ? (
                          <span className="px-2.5 py-1 text-[11px] font-bold bg-emerald-100 text-emerald-800 rounded-md border border-emerald-200 flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-600" /> Alt OK
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 text-[11px] font-bold bg-rose-100 text-rose-800 rounded-md border border-rose-200 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-rose-600" /> Missing Alt
                          </span>
                        )}

                        {hasAlias ? (
                          <span className="px-2.5 py-1 text-[11px] font-bold bg-violet-100 text-violet-800 rounded-md border border-violet-200 flex items-center gap-1">
                            <Check className="w-3 h-3 text-violet-600" /> Alias OK
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 text-[11px] font-bold bg-slate-100 text-slate-600 rounded-md border border-slate-200 flex items-center gap-1">
                            No Alias
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Full Size Image Display Container (Bottom by Bottom) */}
                    <div className="bg-slate-900/5 border border-slate-200 rounded-xl p-4 flex items-center justify-center min-h-[220px] overflow-hidden bg-radial from-slate-50 to-slate-100/50">
                      {imgItem.src ? (
                        <img 
                          src={imgItem.src} 
                          alt={imgItem.alt || "Preview"} 
                          className="max-h-[500px] w-auto max-w-full object-contain rounded-lg border border-slate-200 bg-white shadow-md transition-transform hover:scale-[1.01]"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <span className="text-xs text-slate-400 italic">No image source specified</span>
                      )}
                    </div>

                    {/* Detailed Tag Breakdown */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      {/* Alt Tag Value */}
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80 space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                          <span className="flex items-center gap-1.5 text-emerald-700">
                            <Image className="w-4 h-4" /> Image Alt Tag:
                          </span>
                          {altMatchesSubject && (
                            <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                              Matches Subjectline
                            </span>
                          )}
                        </div>
                        <div className={cn("text-xs font-mono break-all p-2 rounded-md bg-white border", hasAlt ? "text-slate-900 border-slate-200" : "text-rose-600 font-semibold border-rose-200 bg-rose-50/60")}>
                          {hasAlt ? `"${imgItem.alt}"` : "[MISSING ALT ATTRIBUTE]"}
                        </div>
                      </div>

                      {/* Link Alias Tag Value */}
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80 space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                          <span className="flex items-center gap-1.5 text-violet-700">
                            <Tag className="w-4 h-4" /> Link Alias Tag:
                          </span>
                        </div>
                        <div className={cn("text-xs font-mono break-all p-2 rounded-md bg-white border", hasAlias ? "text-slate-900 border-slate-200" : "text-slate-500 border-slate-200 bg-slate-100/50")}>
                          {hasAlias ? `"${imgItem.alias}"` : "[NO ALIAS / UNLINKED IMAGE]"}
                        </div>
                      </div>
                    </div>

                    {/* Footer Src URL & Link Target */}
                    <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] font-mono text-slate-500">
                      <div className="truncate max-w-full sm:max-w-xl" title={imgItem.src}>
                        <span className="font-bold text-slate-400">src: </span>
                        <span>{imgItem.src || "N/A"}</span>
                      </div>
                      {imgItem.src && (
                        <a 
                          href={imgItem.src} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-[#2b61d6] hover:underline flex items-center gap-1 font-sans text-xs shrink-0"
                        >
                          <span>Open Image</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

