import { Link } from "react-router-dom";
import { 
  FileType, 
  FileEdit, 
  Image as ImageIcon, 
  Sparkles, 
  ArrowRight,
  Zap,
  Shield,
  Clock,
  HardDrive
} from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/src/lib/utils";

const features = [
  {
    title: "File Vault",
    description:
      "Advanced virtual nested directory structure to organize files, apply tags, and edit notes.",
    icon: HardDrive,
    href: "/files",
    color: "bg-indigo-600",
  },
  {
    title: "Image to PDF",
    description:
      "Convert batches of images into high-quality PDF documents with customizable orientation.",
    icon: FileType,
    href: "/convert",
    color: "bg-indigo-500",
  },
  {
    title: "PDF Editor",
    description:
      "Full suite of PDF editing tools. Add text, images, and resize elements with ease.",
    icon: FileEdit,
    href: "/edit-pdf",
    color: "bg-slate-700",
  },
  {
    title: "Image Editor",
    description:
      "Annotate and edit images. Add text overlays and rotate or resize with precision.",
    icon: ImageIcon,
    href: "/edit-image",
    color: "bg-indigo-400",
  },
  {
    title: "AI Assistant",
    description:
      "Intelligent analysis for your files. Get improvement suggestions and deep insights.",
    icon: Sparkles,
    href: "/assistant",
    color: "bg-purple-600",
  },
];

export default function Dashboard() {
  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-xl bg-primary p-8 md:p-14 text-white shadow-xl shadow-indigo-200">
        <div className="relative z-10 max-w-2xl space-y-6">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="inline-flex items-center gap-2 rounded-sm bg-white/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest backdrop-blur-md"
          >
            <Zap size={12} className="text-amber-300" />
            <span>AI-Powered File Management</span>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl"
          >
            Manage Files with <br />
            <span className="text-white/60">Geometric Precision</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-indigo-100/80 leading-relaxed"
          >
            A minimal, industrial-grade toolkit for PDF and image processing, supercharged by Gemini-powered AI analysis.
          </motion.p>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex gap-4 pt-2"
          >
            <Link to="/convert" className="inline-flex items-center gap-2 rounded-md bg-white px-8 py-3 text-sm font-bold text-primary transition-all hover:bg-slate-50 hover:-translate-y-0.5 active:translate-y-0">
              Get Started <ArrowRight size={16} />
            </Link>
          </motion.div>
        </div>
        
        {/* Background Decorative Elements */}
        <div className="absolute right-0 top-0 h-full w-1/3 bg-white/5 skew-x-12 transform origin-top-right" />
      </section>

      <section className="space-y-6">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
          <h2 className="text-xl font-bold tracking-tight text-slate-800 uppercase text-[12px] tracking-[0.2em]">Core Features</h2>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Enterprise Ready</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, idx) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * idx }}
              className="group relative overflow-hidden rounded-md border border-slate-200 bg-white p-6 transition-all hover:border-primary hover:shadow-lg hover:shadow-indigo-50"
            >
              <Link to={feature.href} className="flex flex-col h-full space-y-4">
                <div className={cn("inline-flex h-10 w-10 items-center justify-center rounded-sm text-white", feature.color)}>
                  <feature.icon size={20} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-md font-bold text-slate-900">{feature.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
                <div className="pt-2 mt-auto">
                    <span className="text-[10px] font-bold text-primary uppercase tracking-widest inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                        Launch Tool <ArrowRight size={12} />
                    </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { icon: Shield, title: "Secure Processing", desc: "Industrial encryption standard for all file transfers." },
          { icon: Clock, title: "Optimized Speed", desc: "Low-latency pipelines for rapid batch conversions." },
          { icon: Sparkles, title: "Gemini Analysis", desc: "State-of-the-art vision models for file intelligence." }
        ].map((item) => (
          <div key={item.title} className="flex gap-4 rounded-md border border-slate-100 bg-slate-50/50 p-5 items-center">
            <div className="rounded-sm bg-white p-2.5 text-slate-600 border border-slate-200 shadow-sm">
              <item.icon size={20} />
            </div>
            <div className="space-y-0.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">{item.title}</h3>
              <p className="text-[11px] text-slate-500">{item.desc}</p>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
