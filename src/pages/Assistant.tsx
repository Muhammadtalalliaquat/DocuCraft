import { useState } from "react";
import { Sparkles, Upload, FileText, Bot, Send, ArrowRight, Shield, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import toast from "react-hot-toast";
import { analyzeFile } from "@/src/lib/gemini";
import ReactMarkdown from "react-markdown";

export default function Assistant() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      if (selectedFile.type.startsWith("image/")) {
        setPreview(URL.createObjectURL(selectedFile));
      } else {
        setPreview(null);
      }
      setAnalysis(null);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setIsAnalyzing(true);
    setAnalysis(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = (reader.result as string).split(",")[1];
        const prompt = "Analyze this file (image or document). Provide suggestions for improvements, corrections, and enhancements. Be professional and constructive.";
        
        try {
          const result = await analyzeFile(base64Data, file.type, prompt);
          setAnalysis(result ?? null);
          toast.success("Analysis complete!");
        } catch (error) {
          console.error(error);
          toast.error("Failed to analyze file");
        } finally {
          setIsAnalyzing(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error(error);
      toast.error("Error reading file");
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-sm bg-indigo-50 border border-indigo-100 px-2.5 py-1 text-[10px] font-bold text-primary uppercase tracking-widest">
            <Sparkles size={10} />
            <span>AI Neural Architecture</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Intelligent Assistant</h1>
          <p className="text-slate-500 font-medium">Deep analysis for visual and structural integrity.</p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Workspace */}
        <div className="space-y-6">
          <div 
            onClick={() => document.getElementById('ai-upload')?.click()}
            className="group relative cursor-pointer overflow-hidden rounded-md border border-dashed border-slate-300 bg-white p-16 text-center transition-all hover:border-primary hover:bg-slate-50/50"
          >
            <input 
              id="ai-upload" 
              type="file" 
              accept="image/*,application/pdf" 
              className="hidden" 
              onChange={handleFileChange}
            />
            {file ? (
              <div className="space-y-4">
                {preview ? (
                  <div className="mx-auto h-48 w-full max-w-sm rounded-sm overflow-hidden border border-slate-200 bg-slate-100 shadow-inner">
                    <img src={preview} alt="preview" className="h-full w-full object-contain" />
                  </div>
                ) : (
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-sm bg-indigo-50 text-primary border border-indigo-100">
                    <FileText size={40} />
                  </div>
                )}
                <div className="space-y-1">
                  <p className="font-bold text-slate-900 tracking-tight">{file.name}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Click to swap source asset</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 py-8">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-sm bg-slate-50 text-slate-400 border border-slate-200 transition-all group-hover:bg-white group-hover:text-primary group-hover:border-primary">
                  <Upload size={24} />
                </div>
                <div>
                  <p className="font-bold text-slate-900 tracking-tight">Initialize Workspace</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">PDF, PNG, JPEG, WEBP</p>
                </div>
              </div>
            )}
          </div>

          <AnimatePresence>
            {analysis && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-md bg-white border border-slate-200 p-8 shadow-sm"
              >
                <div className="flex items-center gap-3 mb-8 pb-4 border-b border-slate-100">
                  <div className="bg-primary p-2 rounded-sm text-white">
                    <Bot size={18} />
                  </div>
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Analysis Logs & Logic</h3>
                </div>
                <div className="prose prose-sm max-w-none text-slate-700 prose-headings:text-slate-900 prose-headings:font-bold prose-headings:tracking-tight prose-strong:text-slate-900">
                  <ReactMarkdown>{analysis}</ReactMarkdown>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sidebar Controls */}
        <div className="space-y-6">
          <div className="rounded-md border border-slate-200 bg-white p-6 space-y-6 shadow-sm sticky top-24">
            <div className="space-y-4">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                Assistant Matrix
              </h3>
              <p className="text-[11px] text-slate-500 leading-relaxed font-bold font-sans">
                Neural scanning active for visual hierarchy, contrast metrics, and semantic integrity.
              </p>
              
              <div className="flex flex-col gap-2 pt-2">
                <div className="flex gap-2 items-center text-[10px] font-bold uppercase tracking-widest text-slate-600 p-2.5 bg-slate-50 rounded-sm border border-slate-100">
                  <Shield size={12} className="text-green-500" /> AES-256 Encrypted
                </div>
                <div className="flex gap-2 items-center text-[10px] font-bold uppercase tracking-widest text-slate-600 p-2.5 bg-slate-50 rounded-sm border border-slate-100">
                    <Bot size={12} className="text-primary" /> Gemini-1.5 Core
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100">
              <button
                disabled={!file || isAnalyzing}
                onClick={handleAnalyze}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-4 text-[12px] font-bold uppercase tracking-widest text-white transition-all hover:bg-primary-hover shadow-lg hover:shadow-indigo-100 disabled:opacity-30"
              >
                {isAnalyzing ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                    Crunching Data...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Execute Analysis
                  </>
                )}
              </button>
            </div>

            {!file && (
              <div className="flex gap-3 text-amber-600 bg-amber-50 p-4 rounded-md border border-amber-100">
                <AlertCircle size={18} className="shrink-0" />
                <p className="text-[10px] font-bold uppercase tracking-widest leading-relaxed">
                  Workspace empty. Please load an asset to begin analysis.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
