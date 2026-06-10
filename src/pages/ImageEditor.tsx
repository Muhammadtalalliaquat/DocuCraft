import { useEffect, useRef, useState } from "react";
import { Canvas, FabricImage, IText, FabricObject, filters } from "fabric";
import { 
  Upload, Type, RotateCw, Download, Trash2, Image as ImageIcon, 
  MousePointer2, Sparkles, Palette, Sliders, Wand2, Sun, Contrast 
} from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/src/lib/utils";
import { removeBackground } from "@imgly/background-removal";

export default function ImageEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const fabricCanvas = useRef<Canvas | null>(null);
  const [hasImage, setHasImage] = useState(false);
  const [selectedObject, setSelectedObject] = useState<FabricObject | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Property state
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [isGrayscale, setIsGrayscale] = useState(false);

  useEffect(() => {
    if (canvasRef.current && !fabricCanvas.current && workspaceRef.current) {
        const workspace = workspaceRef.current;
        
        const computeDimensions = () => {
            const style = window.getComputedStyle(workspace);
            const paddingLeft = parseFloat(style.paddingLeft);
            const paddingRight = parseFloat(style.paddingRight);
            const paddingTop = parseFloat(style.paddingTop);
            const paddingBottom = parseFloat(style.paddingBottom);
            
            const availableW = workspace.clientWidth - paddingLeft - paddingRight;
            const availableH = workspace.clientHeight - paddingTop - paddingBottom;
            
            const w = availableW;
            const h = Math.max(availableH, 600);
            return { w, h };
        };

        const { w, h } = computeDimensions();

      fabricCanvas.current = new Canvas(canvasRef.current, {
        width: w,
        height: h,
      });

      const handleResize = () => {
        if (!fabricCanvas.current) return;
        const { w: newWidth, h: newHeight } = computeDimensions();
        fabricCanvas.current.setDimensions({ width: newWidth, height: newHeight });
        fabricCanvas.current.renderAll();
      };

      window.addEventListener("resize", handleResize);

      fabricCanvas.current.on("selection:created", (e) => setSelectedObject(e.selected?.[0] || null));
      fabricCanvas.current.on("selection:updated", (e) => setSelectedObject(e.selected?.[0] || null));
      fabricCanvas.current.on("selection:cleared", () => setSelectedObject(null));

      return () => {
        window.removeEventListener("resize", handleResize);
        fabricCanvas.current?.dispose();
        fabricCanvas.current = null;
      };
    }
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !fabricCanvas.current) return;

    const reader = new FileReader();
    reader.onload = async (f) => {
      const data = f.target?.result as string;
      await loadImageToCanvas(data);
    };
    reader.readAsDataURL(file);
  };

  const loadImageToCanvas = async (data: string) => {
    if (!fabricCanvas.current) return;
    try {
        const img = await FabricImage.fromURL(data);
        const canvas = fabricCanvas.current!;
        canvas.clear();
        
        const padding = 10; 
        const scaleX = canvas.width / img.width;
        const scaleY = canvas.height / img.height;
        const scale = Math.min(scaleX, scaleY);
        
        img.scale(scale);
        canvas.centerObject(img); 
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
        setHasImage(true);
        resetFilters();
    } catch (error) {
        console.error("Error loading image:", error);
        toast.error("Failed to load image");
    }
  }

  const resetFilters = () => {
    setBrightness(0);
    setContrast(0);
    setIsGrayscale(false);
  }

  const handleBackgroundRemoval = async () => {
    if (!selectedObject || !(selectedObject instanceof FabricImage) || isProcessing) return;

    setIsProcessing(true);
    const toastId = toast.loading("Removing background... This may take a moment.");
    
    try {
        // Use highest possible resolution for background removal to maintain quality
        const currentScale = selectedObject.scaleX || 1;
        const dataUrl = selectedObject.toDataURL({ 
            multiplier: 1 / currentScale 
        });
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        
        // Remove background
        const resultBlob = await removeBackground(blob);
        const resultDataUrl = URL.createObjectURL(resultBlob);
        
        // Load the new image
        const newImg = await FabricImage.fromURL(resultDataUrl);
        
        if (fabricCanvas.current && selectedObject) {
            // Restore transformation
            newImg.set({
                left: selectedObject.left,
                top: selectedObject.top,
                scaleX: selectedObject.scaleX,
                scaleY: selectedObject.scaleY,
                angle: selectedObject.angle,
                flipX: selectedObject.flipX,
                flipY: selectedObject.flipY,
                originX: selectedObject.originX,
                originY: selectedObject.originY
            });
            
            fabricCanvas.current.remove(selectedObject);
            fabricCanvas.current.add(newImg);
            fabricCanvas.current.setActiveObject(newImg);
            fabricCanvas.current.renderAll();
        }
        
        toast.success("Background removed in high definition!", { id: toastId });
    } catch (error) {
        console.error("BG Removal failed:", error);
        toast.error("Background removal failed. Some images may be too large.", { id: toastId });
    } finally {
        setIsProcessing(false);
    }
  };

  const applyFabricFilters = () => {
    if (!selectedObject || !(selectedObject instanceof FabricImage) || !fabricCanvas.current) return;
    
    const img = selectedObject;
    img.filters = [];
    
    if (isGrayscale) {
        img.filters.push(new filters.Grayscale());
    }
    
    if (brightness !== 0) {
        img.filters.push(new filters.Brightness({ brightness: brightness / 100 }));
    }
    
    if (contrast !== 0) {
        img.filters.push(new filters.Contrast({ contrast: contrast / 100 }));
    }
    
    img.applyFilters();
    fabricCanvas.current.renderAll();
  }

  useEffect(() => {
    applyFabricFilters();
  }, [brightness, contrast, isGrayscale]);

  const addText = () => {
    if (!fabricCanvas.current) return;
    const text = new IText("Double click to edit", {
      left: 100,
      top: 100,
      fontFamily: "Inter",
      fontSize: 24,
      fill: "#1A1A1A",
    });
    fabricCanvas.current.add(text);
    fabricCanvas.current.setActiveObject(text);
  };

  const rotateSelected = () => {
    if (!selectedObject || !fabricCanvas.current) return;
    const currentAngle = selectedObject.angle || 0;
    selectedObject.rotate((currentAngle + 90) % 360);
    fabricCanvas.current.renderAll();
  };

  const deleteSelected = () => {
    if (!selectedObject || !fabricCanvas.current) return;
    fabricCanvas.current.remove(selectedObject);
    fabricCanvas.current.discardActiveObject();
    fabricCanvas.current.renderAll();
  };

  const downloadImage = () => {
    if (!fabricCanvas.current) return;
    
    // Find the images to determine native resolution for high quality export
    const objects = fabricCanvas.current.getObjects();
    const images = objects.filter(obj => obj instanceof FabricImage) as FabricImage[];
    
    let multiplier = 2; // Default fallback
    
    if (images.length > 0) {
        // Find the most 'downscaled' image to determine the multiplier needed to restore it
        // We want to export at a resolution that respects the largest image's native size
        const scales = images.map(img => 1 / (img.scaleX || 1));
        const maxScale = Math.max(...scales);
        
        // Calculate multiplier to match original image resolution
        // If canvas is 800px and original was 4000px, maxScale is 5.
        // We target at least original resolution plus a safety margin for text clarity.
        multiplier = Math.max(maxScale, 2); 
        
        // Cap it to something high but safe for modern browsers (approx 8k-10k px max dim)
        multiplier = Math.min(multiplier, 8); 
    }

    const toastId = toast.loading("Processing Ultra-HD Image Export...");

    try {
        const dataURL = fabricCanvas.current.toDataURL({
            format: "png",
            multiplier: multiplier,
        });
        const link = document.createElement("a");
        link.download = `edited-image-${Date.now()}.png`;
        link.href = dataURL;
        link.click();
        toast.success("High-quality image exported successfully!", { id: toastId });
    } catch (error) {
        console.error("Export failure:", error);
        toast.error("Export failed. Try reducing complexity.", { id: toastId });
    }
  };

  return (
    <div className="max-w-screen-2xl mx-auto space-y-6 md:space-y-8 px-4 md:px-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4 md:pb-6">
        <div className="space-y-1">
          <h1 className="text-xl md:text-3xl font-bold tracking-tight text-slate-900">Creative Image Editor</h1>
          <p className="text-[11px] md:text-sm text-slate-500 font-medium">Advanced visual composition and AI-assisted retouching.</p>
        </div>
        <div className="flex gap-3">
            <button
                onClick={downloadImage}
                disabled={!hasImage}
                className="w-full md:w-auto flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-2 md:py-3 text-[10px] md:text-[12px] font-bold uppercase tracking-widest text-white transition-all hover:bg-primary-hover disabled:opacity-30 shadow-lg shadow-indigo-100"
            >
                <Download size={14} className="md:w-4 md:h-4" /> Download Final
            </button>
        </div>
      </div>

      <div className="grid gap-6 lg:gap-8 lg:grid-cols-[1fr_360px]">
        {/* Editor Area */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 rounded-md border border-slate-200 bg-white p-2 md:p-3 md:px-6 shadow-sm min-h-[56px]">
                <div className="flex items-center gap-1.5 md:gap-2 flex-wrap justify-center md:justify-start">
                    <button 
                        onClick={addText}
                        className="flex items-center gap-1.5 md:gap-2 rounded-sm px-2 md:px-4 py-2 hover:bg-slate-50 text-slate-700 text-[9px] md:text-[11px] font-bold uppercase tracking-widest transition-all active:scale-95 whitespace-nowrap"
                        title="Add Text"
                    >
                        <Type size={14} className="md:w-4 md:h-4" /> <span className="sm:inline">Text</span>
                    </button>
                    <div className="h-4 w-px bg-slate-200 mx-1 shrink-0 hidden md:block" />
                    <button 
                        onClick={rotateSelected}
                        disabled={!selectedObject}
                        className="p-1.5 md:p-2 hover:bg-slate-50 rounded-md text-slate-600 disabled:opacity-30 transition-all active:scale-95"
                        title="Rotate 90°"
                    >
                        <RotateCw size={16} className="md:w-4 md:h-4" />
                    </button>
                    <button 
                        onClick={handleBackgroundRemoval}
                        disabled={!selectedObject || !(selectedObject instanceof FabricImage) || isProcessing}
                        className="flex items-center gap-1.5 md:gap-2 rounded-sm px-2 md:px-4 py-2 hover:bg-indigo-50 text-indigo-600 text-[9px] md:text-[11px] font-bold uppercase tracking-widest disabled:opacity-30 transition-all active:scale-95 whitespace-nowrap"
                        title="AI Background Removal"
                    >
                        <Wand2 size={14} className="md:w-4 md:h-4" /> <span>{isProcessing ? "..." : "Remove BG"}</span>
                    </button>
                    <button 
                        onClick={deleteSelected}
                        disabled={!selectedObject}
                        className="flex items-center gap-1.5 md:gap-2 rounded-sm px-2 md:px-4 py-2 hover:bg-red-50 text-red-500 text-[9px] md:text-[11px] font-bold uppercase tracking-widest disabled:opacity-30 transition-all active:scale-95 md:ml-auto whitespace-nowrap"
                    >
                        <Trash2 size={14} className="md:w-4 md:h-4" /> <span className="sm:inline">Delete</span>
                    </button>
                </div>
            </div>
          </div>

          <div ref={workspaceRef} id="image-editor-workspace" className="relative overflow-auto rounded-md border border-slate-200 bg-slate-100/50 shadow-inner h-[calc(100vh-320px)] min-h-[400px] md:min-h-[500px] flex items-center justify-center p-0">
            {!hasImage && !isProcessing && (
                <div id="image-empty-state" className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 bg-white">
                    <div className="rounded-sm bg-slate-100 border border-slate-200 p-8 text-slate-400">
                        <ImageIcon size={48} strokeWidth={1.5} />
                    </div>
                    <div className="text-center space-y-1">
                        <p className="text-lg font-bold text-slate-900 tracking-tight">System Idle: No Assets Loaded</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Import an image to initialize workspace</p>
                    </div>
                    <button 
                        id="image-import-btn"
                        onClick={() => document.getElementById('img-edit-upload')?.click()}
                        className="rounded-md bg-primary px-10 py-3 text-[12px] font-bold uppercase tracking-widest text-white hover:bg-primary-hover shadow-lg hover:shadow-indigo-100"
                    >
                        Import Image
                    </button>
                </div>
            )}
            
            {isProcessing && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-white/90 backdrop-blur-md">
                    <div className="relative">
                        <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
                        <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary animate-pulse" size={24} />
                    </div>
                    <div className="text-center">
                        <p className="text-sm font-bold text-slate-900 uppercase tracking-widest">AI Neural Processing...</p>
                        <p className="text-[10px] text-slate-400 font-bold mt-1">Downloading models and segmenting layers</p>
                    </div>
                </div>
            )}

            <div 
                id="image-canvas-container" 
                className="shadow-2xl border border-slate-200 transition-all mx-auto relative"
                style={{
                    backgroundImage: `linear-gradient(45deg, #f0f0f0 25%, transparent 25%), 
                                     linear-gradient(-45deg, #f0f0f0 25%, transparent 25%), 
                                     linear-gradient(45deg, transparent 75%, #f0f0f0 75%), 
                                     linear-gradient(-45deg, transparent 75%, #f0f0f0 75%)`,
                    backgroundSize: '20px 20px',
                    backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                    backgroundColor: 'white'
                }}
            >
              <canvas ref={canvasRef} />
            </div>
            <input 
                id="img-edit-upload" 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handleImageUpload} 
            />
          </div>
        </div>

        {/* Info Sidebar */}
        <div className="space-y-6">
            <div className="rounded-md border border-slate-200 bg-white p-6 space-y-6 shadow-sm overflow-hidden animate-in fade-in slide-in-from-right-4 duration-500">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                    <MousePointer2 size={14} /> Element Inspector
                </h3>
                
                {selectedObject instanceof FabricImage ? (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {/* Filters Panel */}
                        <div className="space-y-4">
                            <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
                                <Sliders size={14} /> Color Correction
                            </label>
                            
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-[10px] font-medium text-slate-600 flex items-center gap-1"><Sun size={12} /> Brightness</span>
                                        <span className="text-[10px] font-mono text-slate-400">{brightness}%</span>
                                    </div>
                                    <input 
                                        type="range"
                                        min="-100"
                                        max="100"
                                        value={brightness}
                                        onChange={(e) => setBrightness(parseInt(e.target.value))}
                                        className="w-full accent-primary h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                                
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-[10px] font-medium text-slate-600 flex items-center gap-1"><Contrast size={12} /> Contrast</span>
                                        <span className="text-[10px] font-mono text-slate-400">{contrast}%</span>
                                    </div>
                                    <input 
                                        type="range"
                                        min="-100"
                                        max="100"
                                        value={contrast}
                                        onChange={(e) => setContrast(parseInt(e.target.value))}
                                        className="w-full accent-primary h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                            </div>

                            <button 
                                onClick={() => setIsGrayscale(!isGrayscale)}
                                className={cn(
                                    "w-full py-2 rounded-md border text-[10px] font-bold uppercase tracking-widest transition-all",
                                    isGrayscale ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                                )}
                            >
                                {isGrayscale ? "Disable Monochrome" : "Enable Monochrome"}
                            </button>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
                                <Palette size={14} /> Layer Styles
                            </label>
                            <button 
                                onClick={handleBackgroundRemoval}
                                disabled={isProcessing}
                                className="w-full py-3 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-widest hover:bg-indigo-100 transition-all flex items-center justify-center gap-2"
                            >
                                <Sparkles size={14} /> Remove Background
                            </button>
                        </div>
                    </div>
                ) : selectedObject instanceof IText ? (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <p className="text-[11px] leading-relaxed text-slate-500 font-medium">
                            Text properties (font family, size, color) are currently available via direct canvas interaction. 
                            Select individual text layers to modify their descriptors.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4 py-8 text-center grayscale opacity-60 animate-in fade-in duration-500">
                        <div className="mx-auto w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 mb-4">
                            <MousePointer2 size={20} className="text-slate-300" />
                        </div>
                        <p className="text-[11px] leading-relaxed text-slate-500 font-medium max-w-[200px] mx-auto">
                            Identify a layer on the canvas to activate the property inspection suite.
                        </p>
                    </div>
                )}
            </div>

            <div className="rounded-md bg-slate-900 p-6 space-y-4 shadow-xl">
                <div className="flex gap-3 items-start">
                    <Sparkles size={18} className="text-indigo-400 shrink-0 mt-0.5" />
                    <div className="space-y-2">
                        <p className="text-[11px] text-white leading-relaxed font-bold uppercase tracking-widest">
                            AI Super-Resolution
                        </p>
                        <p className="text-[10px] text-slate-400 leading-relaxed font-medium">
                            Our neural engine automatically segments person-specific features for edge-refined background extraction.
                        </p>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
