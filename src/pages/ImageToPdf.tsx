import { useState } from "react";
import { Upload, FileType, Check, X, Shield, Settings, Download, Trash2, Layout } from "lucide-react";
import { motion, Reorder } from "motion/react";
import axios from "axios";
import toast from "react-hot-toast";
import { cn } from "@/src/lib/utils";

export default function ImageToPdf() {
  const [images, setImages] = useState<{ id: string; file: File; preview: string }[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newImages = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      preview: URL.createObjectURL(file)
    }));
    setImages(prev => [...prev, ...newImages]);
  };

  const removeImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
  };

  const handleConvert = async () => {
    if (images.length === 0) return;
    setIsConverting(true);
    const formData = new FormData();
    images.forEach(img => formData.append("images", img.file));
    formData.append("orientation", orientation);

    try {
      const response = await axios.post("/api/convert/images-to-pdf", formData, {
        responseType: "blob"
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `converted-${Date.now()}.pdf`);
      document.body.appendChild(link);
      link.click();
      toast.success("PDF generated successfully!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to generate PDF");
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="space-y-1 pb-4 border-b border-slate-200">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Image to PDF Converter</h1>
        <p className="text-slate-500 font-medium">Batch processing for high-fidelity PDF documents.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {/* Dropzone */}
          <div 
            onClick={() => document.getElementById('file-upload')?.click()}
            className="group relative cursor-pointer overflow-hidden rounded-md border border-dashed border-slate-300 bg-white p-16 text-center transition-all hover:border-primary hover:bg-indigo-50/30"
          >
            <input 
              id="file-upload" 
              type="file" 
              multiple 
              accept="image/*" 
              className="hidden" 
              onChange={handleFileChange}
            />
            <div className="space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-sm bg-slate-50 text-slate-400 border border-slate-200 transition-all group-hover:bg-white group-hover:text-primary group-hover:border-primary">
                <Upload size={24} />
              </div>
              <div className="space-y-1">
                <p className="font-bold text-slate-900 tracking-tight">Select source images</p>
                <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">PNG, JPEG, WEBP UP TO 50MB</p>
              </div>
            </div>
          </div>

          {/* Image List */}
          {images.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Processing Queue ({images.length})</p>
                <button onClick={() => setImages([])} className="text-[10px] font-bold text-red-500 uppercase tracking-widest hover:underline">Clear All</button>
              </div>
              <Reorder.Group axis="y" values={images} onReorder={setImages} className="space-y-2">
                {images.map((img) => (
                  <Reorder.Item 
                    key={img.id} 
                    value={img}
                    className="flex items-center gap-4 rounded-md border border-slate-200 bg-white p-4 group"
                  >
                    <div className="h-12 w-12 rounded-sm overflow-hidden bg-slate-100 border border-slate-200">
                      <img src={img.preview} alt="preview" className="h-full w-full object-cover" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="truncate text-sm font-bold text-slate-700">{img.file.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono tracking-tighter">{(img.file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <button 
                      onClick={() => removeImage(img.id)}
                      className="rounded-md p-2 text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </Reorder.Item>
                ))}
              </Reorder.Group>
            </div>
          )}
        </div>

        {/* Sidebar Controls */}
        <div className="space-y-6">
          <div className="rounded-md border border-slate-200 bg-white p-6 space-y-6 shadow-sm sticky top-24">
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                <Settings size={14} /> Global Settings
              </h3>
              <div className="space-y-3">
                <p className="text-[10px] font-bold text-slate-800 uppercase tracking-widest">Page Orientation</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setOrientation("portrait")}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-md border p-3 transition-all",
                      orientation === "portrait" 
                        ? "border-primary bg-indigo-50 text-primary" 
                        : "border-slate-200 hover:bg-slate-50 text-slate-600"
                    )}
                  >
                    <div className={cn("h-6 w-4 border-2 rounded-sm", orientation === "portrait" ? "border-primary" : "border-slate-300")} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Portrait</span>
                  </button>
                  <button
                    onClick={() => setOrientation("landscape")}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-md border p-3 transition-all",
                      orientation === "landscape" 
                        ? "border-primary bg-indigo-50 text-primary" 
                        : "border-slate-200 hover:bg-slate-50 text-slate-600"
                    )}
                  >
                    <div className={cn("h-4 w-6 border-2 rounded-sm", orientation === "landscape" ? "border-primary" : "border-slate-300")} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Landscape</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100">
              <button
                disabled={images.length === 0 || isConverting}
                onClick={handleConvert}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-3.5 text-sm font-bold text-white transition-all hover:bg-primary-hover hover:shadow-lg hover:shadow-indigo-100 disabled:opacity-30"
              >
                {isConverting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Download size={18} />
                    Download PDF
                  </>
                )}
              </button>
            </div>
            
            <div className="rounded-md bg-slate-50 p-4 border border-slate-100 space-y-2">
              <div className="flex gap-2 items-center text-green-600">
                <Shield size={14} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Confidential</span>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                Files are purged from our session memory immediately after conversion. No persistent logs are maintained.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
