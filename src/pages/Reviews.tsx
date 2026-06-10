import { useState, useEffect } from "react";
import { MessageSquare, Star, Send, User, Lock } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { db, collection, addDoc, getDocs, query, orderBy, serverTimestamp, handleFirestoreError, OperationType } from "@/src/lib/firebase";
import toast from "react-hot-toast";
import { cn } from "@/src/lib/utils";
import { useAuth } from "@/src/lib/AuthContext";

interface Review {
  id: string;
  userName: string;
  rating: number;
  comment: string;
  userId?: string;
  userPhoto?: string;
  createdAt: any;
}

export default function Reviews() {
  const { user, login, loading: authLoading } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newReview, setNewReview] = useState({ rating: 5, comment: "" });

  // Fetch reviews once auth stability is confirmed
  useEffect(() => {
    if (authLoading) return;
    fetchReviews();
  }, [authLoading]);

  const fetchReviews = async () => {
    setIsLoading(true);
    setLoadError(false);
    const path = "reviews";
    try {
      // Using a simpler query first to debug permission issues
      const q = query(collection(db, path));
      const querySnapshot = await getDocs(q);
      const fetchedReviews = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Review[];
      
      // Manual sort if needed, or re-add orderBy later
      const sortedReviews = fetchedReviews.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });
      
      setReviews(sortedReviews);
    } catch (error: any) {
      console.error("Error fetching reviews:", error);
      setLoadError(true);
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (err: any) {
        const errorData = JSON.parse(err.message);
        if (errorData.error.includes("offline") || errorData.error.includes("backend")) {
          toast.error("Network issue: Could not reach database.");
        } else {
          toast.error("Failed to load reviews: " + errorData.error);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Please login to submit a review");
      return;
    }
    if (!newReview.comment.trim()) {
      toast.error("Please enter a comment");
      return;
    }

    setIsSubmitting(true);
    const path = "reviews";
    console.log("Submitting review to path:", path);
    try {
      const payload = {
        userName: user.displayName || "Anonymous",
        userId: user.uid,
        userPhoto: user.photoURL || null,
        rating: Number(newReview.rating),
        comment: newReview.comment.trim(),
        createdAt: serverTimestamp()
      };
      
      console.log("Review payload:", payload);
      await addDoc(collection(db, path), payload);
      
      toast.success("Review submitted! Thank you for your feedback.");
      setNewReview({ rating: 5, comment: "" });
      fetchReviews();
    } catch (error: any) {
      console.error("Error submitting review:", error);
      try {
        handleFirestoreError(error, OperationType.CREATE, path);
      } catch (err: any) {
        let errorMessage = "Unknown error";
        try {
          const errorData = JSON.parse(err.message);
          errorMessage = errorData.error;
        } catch (e) {
          errorMessage = err.message;
        }
        toast.error("Submission failed: " + errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || (isLoading && reviews.length === 0)) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-primary/10 border-t-primary rounded-full"
        />
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-900 font-mono">
            {authLoading ? "Synchronizing Identity" : "Fetching community logs"}
          </p>
          <p className="text-[9px] text-slate-400 font-medium uppercase tracking-[0.1em]">Accessing Distributed Ledger...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="space-y-1 pb-4 border-b border-slate-200">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">User Intelligence & Feedback</h1>
        <p className="text-slate-500 font-medium">Community telemetry and experience logs.</p>
      </div>

      <div className="grid gap-12 lg:grid-cols-[1fr_360px]">
        {/* Reviews List */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
              <MessageSquare size={14} /> Total Logs ({reviews.length})
            </h2>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 rounded-md bg-slate-50 border border-slate-100 animate-pulse" />
              ))}
            </div>
          ) : loadError ? (
            <div className="rounded-md border border-dashed border-red-200 bg-red-50/30 p-12 text-center space-y-4">
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold tracking-widest text-red-400">Connectivity Failure</p>
                <p className="text-xs text-slate-500 font-medium lowercase">The secure ledger is currently unreachable.</p>
              </div>
              <button 
                onClick={fetchReviews}
                className="rounded-md border border-red-200 bg-white px-6 py-2 text-[10px] font-bold uppercase tracking-widest text-red-500 hover:bg-red-50 transition-all"
              >
                Retry Handshake
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence>
                {reviews.map((review, idx) => (
                  <motion.div
                    key={review.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="rounded-md border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-slate-300"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {review.userPhoto ? (
                          <img src={review.userPhoto} alt="" className="h-10 w-10 rounded-sm border border-slate-200" />
                        ) : (
                          <div className="h-10 w-10 rounded-sm bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 font-bold">
                            {review.userName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="text-[12px] font-bold text-slate-900">{review.userName}</p>
                          <div className="flex text-amber-400 gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star key={i} size={10} fill={i < review.rating ? "currentColor" : "none"} />
                            ))}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {review.createdAt?.toDate ? review.createdAt.toDate().toLocaleDateString() : 'Just now'}
                      </span>
                    </div>
                    <p className="mt-4 text-[13px] leading-relaxed text-slate-600 font-medium">
                      {review.comment}
                    </p>
                  </motion.div>
                ))}
              </AnimatePresence>
              {reviews.length === 0 && (
                <div className="rounded-md border border-dashed border-slate-200 p-12 text-center text-[10px] uppercase font-bold tracking-widest text-slate-400">
                  No telemetry data available.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Review Form */}
        <div className="space-y-6">
          <div className="rounded-md border border-slate-200 bg-white p-6 shadow-sm sticky top-24">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-900 border-b border-slate-100 pb-3 mb-6">Log New Entry</h3>
            
            {user ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5 opacity-60">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Identifier</label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 text-slate-400" size={14} />
                    <input
                      type="text"
                      disabled
                      value={user.displayName || "Anonymous"}
                      className="w-full rounded-md border border-slate-200 bg-slate-50 p-2 pl-9 text-[12px] font-bold text-slate-900 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Metrics Rating</label>
                  <div className="flex gap-1 bg-slate-50 p-2 rounded-md border border-slate-100">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setNewReview({ ...newReview, rating: star })}
                        className={cn(
                          "rounded-sm p-1.5 transition-all hover:bg-white",
                          newReview.rating >= star ? "text-amber-400" : "text-slate-200"
                        )}
                      >
                        <Star size={18} fill={newReview.rating >= star ? "currentColor" : "none"} />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Observations</label>
                  <textarea
                    rows={4}
                    value={newReview.comment}
                    onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
                    className="w-full rounded-md border border-slate-200 bg-slate-50 p-3 text-[12px] font-medium text-slate-900 focus:border-primary focus:bg-white focus:outline-none transition-all placeholder:text-slate-300 resize-none min-h-[100px]"
                    placeholder="Describe your assessment..."
                  />
                </div>

                <button 
                  id="submit-review-btn"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 rounded-md bg-primary py-3.5 text-[11px] font-bold uppercase tracking-[0.2em] text-white transition-all hover:bg-primary-hover shadow-lg hover:shadow-indigo-100 disabled:opacity-30"
                >
                  {isSubmitting ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                  ) : (
                    <>
                      Submit Entry <Send size={12} />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <div className="text-center py-10 space-y-4">
                <div className="mx-auto w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 border border-slate-100">
                  <Lock size={24} />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Authentication Required</p>
                  <p className="text-xs text-slate-600 font-medium">Please login to share your feedback with the community.</p>
                </div>
                <button 
                  id="login-review-btn"
                  onClick={login}
                  className="w-full bg-primary text-white py-3 rounded-md text-[10px] font-bold uppercase tracking-widest hover:bg-primary-hover transition-all"
                >
                  Login with Google
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
