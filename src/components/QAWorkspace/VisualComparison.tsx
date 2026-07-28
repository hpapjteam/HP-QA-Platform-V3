import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Monitor, FileImage, Frame, Smartphone, Sun, Moon, CheckSquare, Square, ChevronDown, ChevronUp, UploadCloud, CheckCircle2, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { parseMsgArrayBuffer, prepareEmailHtmlForDisplay } from '@/lib/msg-parser';

interface VisualComparisonProps {
  webViewUrl: string;
  figmaUrl?: string;
  onMsgUploaded?: (subject: string, htmlContent?: string, fileName?: string) => void;
  initialMsgHtml?: string | null;
  initialMsgFileName?: string | null;
  initialMsgSubject?: string | null;
}

export function VisualComparison({ 
  webViewUrl, 
  figmaUrl, 
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

  useEffect(() => {
    if (initialMsgHtml) {
      setCurrentMsgHtml(initialMsgHtml);
      setLeftTab('msg');
    } else if (initialMsgFileName) {
      setLeftTab('msg');
    }
  }, [initialMsgHtml, initialMsgFileName]);

  const [checks, setChecks] = useState({
    desktopLight: false,
    mobileLight: false,
    desktopDark: false,
    mobileDark: false,
  });

  const [msgFiles, setMsgFiles] = useState<Record<string, string>>({}); // preview URLs

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const key = `${device}-${theme}`;
      
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
      } else if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        setMsgFiles(prev => ({ ...prev, [key]: url }));
        onMsgUploaded?.(file.name.replace(/\.[^/.]+$/, ""), "", file.name);
      } else {
        const text = await file.text();
        setCurrentMsgHtml(text);
        setLeftTab('msg');
        onMsgUploaded?.(file.name, text, file.name);
      }
    }
  };

  const currentMsgFile = msgFiles[`${device}-${theme}`];
  
  const getFigmaEmbedUrl = (url: string) => {
    if (!url) return '';
    if (url.includes('figma.com')) {
      return `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(url)}`;
    }
    return url;
  };
  const figmaEmbed = getFigmaEmbedUrl(figmaUrl || '');

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
    <div ref={containerRef} className={cn("flex bg-slate-100 p-2 gap-1 overflow-hidden transition-all duration-300", isFullscreen ? "fixed inset-0 z-[9999]" : "h-full w-full")}>
      {/* Left Column: View Online / MSG */}
      <div className="flex flex-col bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden min-w-0" style={{ flex: splitRatio }}>
        
        {/* Top Controls */}
        <div className="bg-slate-50 border-b border-slate-200 p-2 flex flex-col gap-2 shrink-0 overflow-visible relative">
          <div className="flex items-center justify-between">
            <div className="flex bg-slate-200 p-1 rounded-md">
              <button type="button"  
                
                onClick={() => setLeftTab('viewonline')}
                className={cn("px-3 py-1.5 text-xs font-semibold rounded-sm flex items-center gap-2 transition-all", leftTab === 'viewonline' ? "bg-white shadow-sm text-blue-600" : "text-slate-600 hover:text-slate-900")}
              >
                <Monitor className="w-3.5 h-3.5" /> View Online
              </button>
              <button type="button"  
                
                onClick={() => setLeftTab('msg')}
                className={cn("px-3 py-1.5 text-xs font-semibold rounded-sm flex items-center gap-2 transition-all", leftTab === 'msg' ? "bg-white shadow-sm text-emerald-600" : "text-slate-600 hover:text-slate-900")}
              >
                <FileImage className="w-3.5 h-3.5" /> MSG / Screenshot
              </button>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex bg-slate-100 p-1 rounded-md border border-slate-200">
                <button type="button"  onClick={() => setDevice('desktop')} className={cn("px-2 py-1 text-xs rounded-sm", device === 'desktop' ? "bg-white shadow-sm text-slate-800" : "text-slate-500")}>
                  <Monitor className="w-3.5 h-3.5" />
                </button>
                <button type="button"  onClick={() => setDevice('mobile')} className={cn("px-2 py-1 text-xs rounded-sm", device === 'mobile' ? "bg-white shadow-sm text-slate-800" : "text-slate-500")}>
                  <Smartphone className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex bg-slate-100 p-1 rounded-md border border-slate-200">
                <button type="button"  onClick={() => setTheme('light')} className={cn("px-2 py-1 text-xs rounded-sm", theme === 'light' ? "bg-white shadow-sm text-amber-500" : "text-slate-500")}>
                  <Sun className="w-3.5 h-3.5" />
                </button>
                <button type="button"  onClick={() => setTheme('dark')} className={cn("px-2 py-1 text-xs rounded-sm", theme === 'dark' ? "bg-slate-800 shadow-sm text-blue-300" : "text-slate-500")}>
                  <Moon className="w-3.5 h-3.5" />
                </button>
              </div>
              
              {/* Hoverable Checklist Trigger */}
              <div 
                className="relative z-50"
                onMouseEnter={() => setChecklistOpen(true)}
                onMouseLeave={() => setChecklistOpen(false)}
              >
                <button type="button"  
                  
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md shadow-sm"
                >
                  <CheckSquare className="w-4 h-4 text-blue-500" />
                  QA Checklist
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </button>
                
                {checklistOpen && (
                  <div className="absolute top-full right-0 mt-1 w-64 bg-white rounded-md shadow-2xl border border-slate-200 p-2 grid gap-1">
                    {checklistItems.map((item) => (
                      <button type="button"  
                        key={item.id}
                        
                        onClick={() => toggleCheck(item.id)}
                        className={cn(
                          "flex items-center gap-2 p-2 rounded text-xs text-left transition-colors",
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
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-slate-200 relative flex justify-center overflow-auto p-4">
          {leftTab === 'viewonline' ? (
            <div className={cn(
              "bg-white shadow-xl transition-all duration-300 border border-slate-300 rounded overflow-hidden flex flex-col min-h-full",
              device === 'desktop' ? "w-full" : "w-[375px] shrink-0"
            )}>
              {webViewUrl && webViewUrl !== 'about:blank' ? (
                <iframe 
                  src={`/api/proxy?url=${encodeURIComponent(webViewUrl)}`}
                  className={cn("w-full h-full border-0", theme === 'dark' ? "invert hue-rotate-180 contrast-125" : "")} 
                  title="View Online"
                />
              ) : (
                <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
                  No View Online URL provided
                </div>
              )}
            </div>
          ) : (
            <div className={cn(
              "bg-white shadow-xl transition-all duration-300 border border-slate-300 rounded overflow-hidden flex flex-col min-h-full",
              device === 'desktop' ? "w-full" : "w-[375px] shrink-0"
            )}>
              {currentMsgHtml ? (
                <iframe
                  srcDoc={prepareEmailHtmlForDisplay(currentMsgHtml)}
                  className={cn("w-full h-full border-0 min-h-[500px]", theme === 'dark' ? "invert hue-rotate-180 contrast-125" : "")}
                  title="MSG Email HTML Content"
                />
              ) : currentMsgFile ? (
                <img src={currentMsgFile} alt="MSG Upload" className="w-full h-auto" />
              ) : (
                <label className="flex-1 flex flex-col items-center justify-center p-6 text-center border-2 border-dashed border-slate-300 m-8 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                  <UploadCloud className="w-12 h-12 text-slate-300 mb-4" />
                  <p className="text-sm font-bold text-slate-700">Upload Screenshot or MSG/EML</p>
                  <p className="text-xs text-slate-500 mt-1 mb-4">For {device} ({theme} mode)</p>
                  <span className="px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded text-xs font-semibold">
                    Browse File
                  </span>
                  <input type="file" className="hidden" accept=".msg,.eml,image/*" onChange={handleFileUpload} />
                </label>
              )}
            </div>
          )}
        </div>
      </div>

            {/* Resizer */}
      <div 
        className="w-2 shrink-0 cursor-col-resize group flex items-center justify-center z-10 transition-colors hover:bg-slate-200/60 rounded-full"
        onMouseDown={handleMouseDown}
      >
        <div className="w-1 h-12 bg-slate-300 group-hover:bg-blue-500 rounded-full transition-colors" />
      </div>

      {/* Right Column: Figma */}
      <div className="flex flex-col bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden min-w-0" style={{ flex: 100 - splitRatio }}>
        <div className="bg-slate-50 border-b border-slate-200 p-3 flex items-center justify-between shrink-0 h-[53px]">
          <div className="flex items-center gap-2">
            <Frame className="w-4 h-4 text-purple-600" />
            <h3 className="text-sm font-bold text-slate-800">Figma Design</h3>
          </div>
          <button type="button" onClick={() => setIsFullscreen(!isFullscreen)} className="text-slate-500 hover:text-[#2b61d6] p-1.5 bg-white rounded border border-slate-200 shadow-sm transition-colors">
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
  );
}
