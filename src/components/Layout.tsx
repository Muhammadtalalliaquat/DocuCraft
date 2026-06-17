import { Outlet, Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  FileType,
  FileEdit,
  Image as ImageIcon,
  Sparkles,
  MessageSquare,
  Menu,
  X,
  LogOut,
  LogIn,
  HardDrive,
} from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/src/lib/utils";
import { useAuth } from "@/src/lib/AuthContext";
import Logo from "@/src/components/Logo";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "File Vault", href: "/files", icon: HardDrive },
  { name: "Image to PDF", href: "/convert", icon: FileType },
  { name: "PDF Editor", href: "/edit-pdf", icon: FileEdit },
  { name: "Image Editor", href: "/edit-image", icon: ImageIcon },
  { name: "AI Assistant", href: "/assistant", icon: Sparkles },
  { name: "Reviews", href: "/reviews", icon: MessageSquare },
];

export default function Layout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { user, login, logout, loading } = useAuth();

  return (
    <div className="min-h-screen bg-surface-bg text-slate-900 font-sans">
      {/* Sidebar - Desktop */}
      <aside className="fixed left-0 top-0 hidden h-full w-64 border-r border-border-main bg-white lg:flex lg:flex-col">
        <div className="p-6">
          <Link to="/" className="block">
            <Logo size="md" />
          </Link>
        </div>

        <nav className="flex-1 px-4 mt-4 space-y-1">
          <div className="text-[10px] uppercase font-semibold text-slate-400 px-3 py-2 tracking-widest">
            Main Menu
          </div>
          {navigation.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200 border border-transparent",
                location.pathname === item.href
                  ? "bg-indigo-50 text-primary border-indigo-100"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              <item.icon
                size={18}
                className={cn(
                  location.pathname === item.href
                    ? "text-primary"
                    : "text-slate-400",
                )}
              />
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="p-4 mt-auto border-t border-slate-100">
          {loading ? (
            <div className="h-12 bg-slate-50 animate-pulse rounded-lg" />
          ) : user ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || ""}
                    className="w-10 h-10 rounded-full border-2 border-white shadow-sm"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold">
                    {user.displayName?.[0] || "U"}
                  </div>
                )}
                <div className="overflow-hidden">
                  <p className="text-sm font-semibold truncate text-slate-900">
                    {user.displayName || "User"}
                  </p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                    Welcome
                  </p>
                </div>
              </div>
              <button
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md text-[10px] font-bold uppercase tracking-[0.2em] text-red-500 hover:bg-red-50 transition-all border border-transparent hover:border-red-100"
              >
                <LogOut size={14} /> End Session
              </button>
            </div>
          ) : (
            <button
              onClick={login}
              className="w-full flex items-center justify-center gap-2 bg-primary text-white p-3 rounded-lg text-[10px] font-bold uppercase tracking-[0.2em] shadow-lg shadow-indigo-100 hover:bg-primary-hover hover:-translate-y-0.5 active:translate-y-0 transition-all"
            >
              <LogIn size={16} /> Authenticate
            </button>
          )}
        </div>
      </aside>

      {/* Header - Mobile */}
      <header className="sticky top-0 z-50 border-b border-border-main bg-white/80 backdrop-blur-md lg:hidden">
        <div className="flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center">
            <Logo size="sm" />
          </Link>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="rounded-md p-2 text-slate-900 hover:bg-slate-50"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="lg:pl-64">
        <div className="mx-auto min-h-screen max-w-7xl p-4 md:p-8 lg:p-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 z-50 w-72 bg-white p-6 shadow-2xl lg:hidden"
            >
              <div className="mb-8">
                <Link
                  to="/"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block"
                >
                  <Logo size="md" />
                </Link>
              </div>
              <nav className="space-y-1">
                <div className="text-[10px] uppercase font-semibold text-slate-400 px-3 py-2 tracking-widest">
                  Main Menu
                </div>
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200 border border-transparent",
                      location.pathname === item.href
                        ? "bg-indigo-50 text-primary border-indigo-100"
                        : "text-slate-600 hover:bg-slate-50",
                    )}
                  >
                    <item.icon
                      size={18}
                      className={cn(
                        location.pathname === item.href
                          ? "text-primary"
                          : "text-slate-400",
                      )}
                    />
                    {item.name}
                  </Link>
                ))}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
