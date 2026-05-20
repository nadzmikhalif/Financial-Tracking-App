import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, Plus, X, Upload, ArrowLeft, CheckCircle2, FileText, 
  Calendar, ArrowRight, Building2, Sparkles, AlertCircle, 
  Trash2, ArrowLeftCircle, Utensils, Car, Monitor, MoreHorizontal, LogOut,
  ChevronDown, Settings, ShoppingBag, Coffee, Home, Zap, Heart, Gift, Briefcase, 
  Gamepad2, Music, Plane, Dumbbell, Palette, Save, Trash
} from 'lucide-react';
import { supabase } from "./supabase";
import { SmokeyBackground, LoginForm, SignUpForm, VerifyRedirect } from "./login-form";

// --- Types ---
interface Transaction {
  id: number;
  filename: string;
  timestamp: string;
  amount: string;
  company: string;
  date: string;
  time?: string;
  category: string;
  category_id?: number;
  status: string;
  aiError?: string;
  image_url?: string;
  user_id?: string;
}

interface Category {
  id: number;
  name: string;
  color: string;
  icon: string;
}

interface Profile {
  id: string;
  wallpaper_color: string;
}

type ViewState = 'HOME' | 'CAPTURE' | 'SUCCESS' | 'STATS' | 'SETTINGS';

const CATEGORY_ICON_SIZE = 24;

const ICON_MAP: Record<string, any> = {
  Utensils, Car, Monitor, MoreHorizontal, ShoppingBag, Coffee, Home, Zap, Heart, Gift, 
  Briefcase, Gamepad2, Music, Plane, Dumbbell, Palette
};

const getCategoryStyle = (category: string, categories: Category[] = []) => {
  const dynamicCat = categories.find(c => c.name.toLowerCase() === category?.toLowerCase());
  if (dynamicCat) {
    const Icon = ICON_MAP[dynamicCat.icon] || MoreHorizontal;
    // Map hex to tailwind-like bg if possible, or use inline style
    return { 
      color: `text-[${dynamicCat.color}]`, 
      hex: dynamicCat.color, 
      bg: ``, // We'll use inline styles for better control
      icon: Icon, 
      size: 24,
      isDynamic: true
    };
  }

  const normalized = category?.toLowerCase() || '';
  if (normalized.includes('food')) {
    return { color: 'text-green-400', hex: '#4ade80', bg: 'from-green-500/20 to-emerald-500/20', icon: Utensils, size: 24 };
  }
  if (normalized.includes('transportation')) {
    return { color: 'text-yellow-400', hex: '#facc15', bg: 'from-yellow-500/20 to-orange-500/20', icon: Car, size: 24 };
  }
  if (normalized.includes('computer')) {
    return { color: 'text-blue-400', hex: '#60a5fa', bg: 'from-blue-500/20 to-cyan-500/20', icon: Monitor, size: 24 };
  }
  return { color: 'text-gray-400', hex: '#94a3b8', bg: 'from-gray-500/20 to-slate-500/20', icon: MoreHorizontal, size: 24 };
};

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [view, setView] = useState<ViewState>('HOME');
  const [isLoginView, setIsLoginView] = useState(true);
  const [isVerifyView, setIsVerifyView] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentTransaction, setCurrentTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [focusedTransaction, setFocusedTransaction] = useState<Transaction | null>(null);
  const [showFullImage, setShowFullImage] = useState(false);
  const [isFullImageClosing, setIsFullImageClosing] = useState(false);
  const touchStart = useRef<{ x: number, y: number } | null>(null);

  useEffect(() => {
    // Check for hash parameters on mount (e.g. #type=signup or #type=recovery)
    const hash = window.location.hash;
    if (hash.includes('type=signup') || hash.includes('type=recovery')) {
      setIsVerifyView(true);
      // Clear hash to prevent re-triggering on refresh
      window.history.replaceState(null, '', window.location.pathname);
    }

    supabase.auth.getSession().then(({ data: { session } }: any) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchTransactions = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const res = await fetch('/api/transactions', {
        headers: {
          'Authorization': `Bearer ${currentSession?.access_token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Fetch failed');
      setTransactions(data);
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    if (!session) return;
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const res = await fetch('/api/categories', {
        headers: { 'Authorization': `Bearer ${currentSession?.access_token}` }
      });
      if (res.ok) setCategories(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchProfile = async () => {
    if (!session) return;
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const res = await fetch('/api/profile', {
        headers: { 'Authorization': `Bearer ${currentSession?.access_token}` }
      });
      if (res.ok) setProfile(await res.json());
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (session) {
      setView('HOME');
      fetchTransactions();
      fetchCategories();
      fetchProfile();
    }
  }, [session]);

  useEffect(() => {
    if (session && view === 'HOME') {
      fetchTransactions();
    }
  }, [session, view]);

  const closeFullImage = () => {
    if (!showFullImage || isFullImageClosing) return;
    setIsFullImageClosing(true);
    setTimeout(() => {
      setShowFullImage(false);
      setIsFullImageClosing(false);
    }, 220);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const deltaX = Math.abs(e.touches[0].clientX - touchStart.current.x);
    const deltaY = Math.abs(e.touches[0].clientY - touchStart.current.y);
    if (deltaX > 50 || deltaY > 50) {
      closeFullImage();
      touchStart.current = null;
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Delete this record?')) {
      try {
        const res = await fetch(`/api/transactions/${id}`, { 
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${session?.access_token}` }
        });
        if (res.ok) {
          setFocusedTransaction(null);
          fetchTransactions();
        } else {
          const data = await res.json();
          alert(data.error || 'Delete failed');
        }
      } catch (e) { alert('Connection error'); }
    }
  };

  const formatAmount = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return '0';
    const rounded = Math.round(num * 100) / 100;
    return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(2);
  };

  const handleGlobalTouchStart = (e: React.TouchEvent) => {
    if (view !== 'HOME' && view !== 'STATS') return;
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleGlobalTouchMove = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const deltaX = e.touches[0].clientX - touchStart.current.x;
    const deltaY = Math.abs(e.touches[0].clientY - touchStart.current.y);
    if (Math.abs(deltaX) > 80 && deltaY < 50) {
      if (deltaX < 0 && view === 'HOME') setView('STATS');
      else if (deltaX > 0 && view === 'STATS') setView('HOME');
      touchStart.current = null;
    }
  };

  if (!session) {
    return (
      <main className="relative w-screen h-screen bg-gray-900 overflow-hidden">
        <SmokeyBackground className="absolute inset-0" />
        <div className="relative z-10 flex items-center justify-center w-full h-full p-4 -translate-y-[10px]">
          {isVerifyView ? (
            <VerifyRedirect onFinish={() => { 
              setIsVerifyView(false); 
              setIsLoginView(true); 
            }} />
          ) : isLoginView ? (
            <LoginForm onToggle={() => setIsLoginView(false)} />
          ) : (
            <SignUpForm onToggle={() => setIsLoginView(true)} />
          )}
        </div>
      </main>
    );
  }

  return (
    <div 
      className="h-[100dvh] w-full max-w-md mx-auto bg-space-black relative overflow-hidden flex flex-col font-sans"
      onTouchStart={handleGlobalTouchStart}
      onTouchMove={handleGlobalTouchMove}
    >
      <SmokeyBackground color={profile?.wallpaper_color || '#1E40AF'} backdropBlurAmount="none" className="opacity-40" />
      
      <div 
        className="bubble-glow w-64 h-64 top-[-10%] left-[-20%] animate-pulse-slow"
        style={{ backgroundColor: `${profile?.wallpaper_color || '#00f2ff'}1a` }}
      ></div>
      <div 
        className="bubble-glow w-64 h-64 bottom-[10%] right-[-20%] animate-pulse-slow"
        style={{ backgroundColor: `${profile?.wallpaper_color || '#bc13fe'}1a` }}
      ></div>

      {view === 'HOME' && (
        <div className="animate-slide-in-left h-full w-full">
          <HomeView 
            transactions={transactions} 
            categories={categories}
            loading={loading} 
            onNew={() => setView('CAPTURE')} 
            onFocus={setFocusedTransaction} 
            onStats={() => setView('STATS')} 
            onSettings={() => setView('SETTINGS')}
            formatAmount={formatAmount} 
          />
        </div>
      )}

      {view === 'STATS' && (
        <div className="animate-slide-in-right h-full w-full">
          <StatsView transactions={transactions} categories={categories} onBack={() => setView('HOME')} formatAmount={formatAmount} />
        </div>
      )}

      {view === 'SETTINGS' && (
        <div className="animate-slide-in-right h-full w-full">
          <SettingsView 
            profile={profile} 
            categories={categories} 
            onBack={() => setView('HOME')} 
            onLogout={() => supabase.auth.signOut()} 
            onUpdateProfile={(p: any) => setProfile(p)}
            onUpdateCategories={() => fetchCategories()}
            session={session}
          />
        </div>
      )}
      
      {view === 'CAPTURE' && (
        <CaptureView 
          onBack={() => setView('HOME')} 
          onSuccess={(data: any) => {
            setCurrentTransaction(data);
            setView('SUCCESS');
          }} 
          session={session}
        />
      )}

      {view === 'SUCCESS' && (
        <SuccessView transaction={currentTransaction} categories={categories} onDone={() => setView('HOME')} formatAmount={formatAmount} />
      )}

      {focusedTransaction && (() => {
        const style = getCategoryStyle(focusedTransaction.category, categories);
        const Icon = style.icon;
        return (
          <div onClick={() => { setFocusedTransaction(null); setShowFullImage(false); }} className="absolute inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-md bg-black/60 transition-all cursor-pointer">
            {showFullImage && focusedTransaction.image_url && (
              <div onClick={(e) => { e.stopPropagation(); closeFullImage(); }} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} className={`fixed inset-0 z-[200] bg-black/80 flex items-center justify-center cursor-zoom-out ${isFullImageClosing ? 'image-lightbox-hide' : 'image-lightbox-show'}`}>
                <img src={focusedTransaction.image_url} className={`w-full h-full object-contain max-w-[95vw] max-h-[95vh] ${isFullImageClosing ? 'image-content-hide' : 'image-content-show'}`} alt="Full Receipt" />
                <button onClick={(e) => { e.stopPropagation(); closeFullImage(); }} className="absolute top-8 right-8 p-3 bg-white/10 backdrop-blur-xl rounded-full border border-white/20 text-white"><X size={24} /></button>
              </div>
            )}
            <div onClick={(e) => e.stopPropagation()} className="w-full glass-card p-6 animate-in zoom-in-95 duration-200 cursor-default border-white/10">
               <div className="flex flex-col items-center text-center mb-6">
                  {focusedTransaction.image_url ? (
                    <div onClick={() => setShowFullImage(true)} className="w-full mb-6 rounded-2xl overflow-hidden border border-white/10 glass-card h-40 cursor-zoom-in group relative">
                      <img src={focusedTransaction.image_url} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="Receipt" />
                    </div>
                  ) : (
                    <div 
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center border border-white/10 mb-4`}
                      style={{ backgroundColor: style.isDynamic ? `${style.hex}33` : undefined }}
                    >
                      <Icon size={style.size} className={style.color} style={{ color: style.isDynamic ? style.hex : undefined }} />
                    </div>
                  )}
                  <h2 className="text-2xl font-black text-white leading-tight">{focusedTransaction.company}</h2>
                  <p className={`${style.color} text-xs font-bold uppercase tracking-widest mt-1`} style={{ color: style.isDynamic ? style.hex : undefined }}>{focusedTransaction.category}</p>
               </div>
               <div className="space-y-4 mb-10">
                  <div className="flex justify-between items-center py-3 border-b border-white/5">
                     <span className="text-white/40 text-xs font-bold uppercase">Amount</span>
                     <span className="text-2xl font-black text-white neon-text whitespace-nowrap">RM {formatAmount(focusedTransaction.amount)}</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-white/5">
                     <span className="text-white/40 text-xs font-bold uppercase">Date</span>
                     <span className="text-white/80 font-bold">{focusedTransaction.date} {focusedTransaction.time && <span className="ml-2 text-neon-blue/60">{focusedTransaction.time}</span>}</span>
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => setFocusedTransaction(null)} className="flex items-center justify-center gap-2 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold active:scale-95 transition-all"><ArrowLeftCircle size={20} /> BACK</button>
                  <button onClick={() => handleDelete(focusedTransaction.id)} className="flex items-center justify-center gap-2 py-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 font-bold active:scale-95 transition-all"><Trash2 size={20} /> DELETE</button>
               </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function HomeView({ transactions, categories, loading, onNew, onFocus, onStats, onSettings, formatAmount }: any) {
  return (
    <div className="flex flex-col h-full z-10">
      <header className="safe-top px-6 py-6 shrink-0">
        <div className="flex justify-between items-end">
          <div>
            <p className="text-neon-blue text-xs font-bold tracking-[0.2em] uppercase mb-1">Jarvis 2.0</p>
            <h1 className="text-3xl font-black tracking-tight">Activity</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={onStats} className="p-3 glass-card rounded-2xl active:scale-95 transition-all border-white/10"><FileText className="text-neon-blue" size={20} /></button>
            <button onClick={onSettings} className="p-3 glass-card rounded-2xl active:scale-95 transition-all border-white/10"><Settings className="text-gray-400" size={20} /></button>
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto px-6 py-2">
        {loading ? (
          <div className="flex justify-center items-center h-full"><div className="w-12 h-12 border-4 border-neon-blue/20 border-t-neon-blue rounded-full animate-spin"></div></div>
        ) : (
          <div className="space-y-4 pb-10">
            {transactions.map((t: any) => {
              const style = getCategoryStyle(t.category, categories);
              const Icon = style.icon;
              return (
                <div key={t.id} onClick={() => onFocus(t)} className="glass-card p-5 group hover:bg-white/10 transition-all border-white/5 cursor-pointer active:scale-[0.98]">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div 
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center border border-white/10 ${style.bg}`}
                        style={{ backgroundColor: style.isDynamic ? `${style.hex}33` : undefined }}
                      >
                        <Icon size={style.size} className={style.color} style={{ color: style.isDynamic ? style.hex : undefined }} />
                      </div>
                      <div>
                        <p className="font-bold text-white text-lg leading-tight">{t.company}</p>
                        <p 
                          className={`text-xs font-medium tracking-wide ${style.color}`}
                          style={{ color: style.isDynamic ? style.hex : undefined }}
                        >{t.category}</p>
                      </div>
                    </div>
                    <p className="text-xl font-black text-white neon-text whitespace-nowrap">RM {formatAmount(t.amount)}</p>
                  </div>
                  <div className="text-[10px] uppercase tracking-widest font-bold text-white/30 flex gap-2">
                    <span>{t.date}</span>
                    {t.time && <span className="text-neon-blue/50">• {t.time}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
      <footer className="safe-bottom px-6 shrink-0 py-4">
        <button onClick={onNew} className="w-full h-16 bg-white text-black rounded-[2rem] font-black text-lg flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(255,255,255,0.2)] active:scale-95 transition-all"><Plus size={24} strokeWidth={3} /> SCAN RECEIPT</button>
      </footer>
    </div>
  ); 
}

function CaptureView({ onBack, onSuccess, session }: any) {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: any) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setPreviewUrl(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedImage) return;
    setIsProcessing(true);
    const formData = new FormData();
    formData.append('image', selectedImage);
    try {
      const response = await fetch('/api/upload', { 
        method: 'POST', 
        body: formData,
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (response.ok) {
        onSuccess(await response.json());
      } else {
        const errData = await response.json();
        alert(errData.aiError || errData.error || 'Processing Failed');
      }
    } catch (err) { alert('Network Error'); } 
    finally { setIsProcessing(false); }
  };

  return (
    <div className="flex flex-col h-full z-10">
      <header className="safe-top p-6 flex items-center justify-between shrink-0">
        <button onClick={onBack} className="p-3 glass-card !rounded-2xl border-white/5"><ArrowLeft size={20} /></button>
        <div className="w-12"></div>
      </header>
      
      <main className="flex-1 flex flex-col items-center justify-center p-6 min-h-0">
        {!previewUrl && (
          <p className="text-xs font-black tracking-[0.3em] text-white/40 uppercase mb-8 text-center">Choose Upload Option</p>
        )}
        <div className="w-full aspect-[3/4] glass-card overflow-hidden relative border-white/10 p-2">
          {previewUrl ? (
            <div className="w-full h-full relative group">
              <img src={previewUrl} className="w-full h-full object-cover rounded-[2rem]" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent rounded-[2rem]"></div>
              <button onClick={() => { setSelectedImage(null); setPreviewUrl(null); }} className="absolute top-4 right-4 p-3 bg-black/50 backdrop-blur-xl rounded-2xl border border-white/10"><X size={20} /></button>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-8">
              <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-3 group">
                <div className="text-center">
                  <p className="text-sm font-bold text-white uppercase tracking-widest">Camera</p>
                </div>
                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center border border-white/10 group-active:scale-95 transition-all">
                  <Camera size={32} className="text-neon-blue" />
                </div>
              </button>

              <div className="w-32 h-px bg-white/5"></div>

              <button onClick={() => galleryInputRef.current?.click()} className="flex flex-col items-center gap-3 group">
                <div className="text-center">
                  <p className="text-sm font-bold text-white uppercase tracking-widest">Gallery</p>
                </div>
                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center border border-white/10 group-active:scale-95 transition-all">
                  <Upload size={32} className="text-neon-blue" />
                </div>
              </button>
            </div>
          )}
          {isProcessing && (
            <div className="absolute inset-0 z-20 pointer-events-none">
              <div className="w-full h-1 bg-neon-blue shadow-[0_0_20px_#00f2ff] animate-scan"></div>
            </div>
          )}
        </div>
        <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
        <input type="file" accept="image/*" ref={galleryInputRef} onChange={handleFileChange} className="hidden" />
      </main>
      
      <footer className="safe-bottom px-6 shrink-0 py-4">
        {selectedImage && (
          <button onClick={handleUpload} disabled={isProcessing} className="w-full h-16 bg-neon-blue text-black rounded-[2rem] font-black text-lg flex items-center justify-center gap-3 shadow-[0_0_40px_rgba(0,242,255,0.3)] disabled:opacity-50 transition-all">
            {isProcessing ? (
              <span className="flex items-center gap-3"><div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin"></div> ANALYZING...</span>
            ) : (
              <><Sparkles size={20} /> PROCESS RECEIPT</>
            )}
          </button>
        )}
      </footer>
      <style>{`
        @keyframes scan {
          0%, 100% { top: 0%; }
          50% { top: 100%; transform: translateY(-100%); }
        }
        .animate-scan {
           position: absolute;
           animation: scan 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  ); 
}

function SuccessView({ transaction, categories, onDone, formatAmount }: any) {
  if (!transaction) return null;
  const style = getCategoryStyle(transaction.category, categories);
  return (
    <div className="flex flex-col h-full z-10">
      <main className="flex-1 px-8 flex flex-col items-center justify-center text-center">
        <div className="w-24 h-24 rounded-full flex items-center justify-center mb-8 border border-neon-blue/30 bg-neon-blue/10"><CheckCircle2 size={48} className="text-neon-blue" /></div>
        <h1 className="text-3xl font-black mb-8">Transaction Added</h1>
        
        <div className="w-full glass-card p-6 space-y-4 border-white/10 text-left mt-4">
          <div className="flex justify-between items-center"><span className="text-white/50 text-xs font-bold uppercase text-left">Vendor</span><span className="font-black text-white text-lg text-right">{transaction.company}</span></div>
          <div className="flex justify-between items-center">
            <span className="text-white/50 text-xs font-bold uppercase text-left">Category</span>
            <span 
              className={`${style.isDynamic ? '' : style.bg} ${style.color} px-3 py-1 rounded-full text-[10px] font-black uppercase text-right`}
              style={{ backgroundColor: style.isDynamic ? `${style.hex}33` : undefined, color: style.isDynamic ? style.hex : undefined }}
            >{transaction.category}</span>
          </div>
          <div className="pt-4 border-t border-white/5 flex justify-between items-center"><span className="text-white/30 text-[10px] uppercase font-black">Total</span><span className="text-3xl font-black text-white neon-text">RM {formatAmount(transaction.amount)}</span></div>
        </div>
      </main>
      <footer className="safe-bottom px-6 shrink-0 py-4"><button onClick={onDone} className="w-full h-16 bg-white/10 border border-white/10 text-white rounded-[2rem] font-black text-lg flex items-center justify-center gap-3">CLOSE LOG <ArrowRight size={20} /></button></footer>
    </div>
  );
}

function StatsView({ transactions, categories, onBack, formatAmount }: any) {
  const [selectedMonth, setSelectedMonth] = useState<number | 'ALL'>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const filteredTransactions = transactions.filter((t: any) => {
    if (t.aiError) return false;
    if (!t.date) return false;
    const [year, month] = t.date.split('-').map(Number);
    
    const yearMatches = year === selectedYear;
    const monthMatches = selectedMonth === 'ALL' || (month - 1) === selectedMonth;
    
    return yearMatches && monthMatches;
  });

  const totalAmount = filteredTransactions.reduce((sum: number, t: any) => sum + parseFloat(t.amount || '0'), 0);
  const categoryTotals: any = {};
  filteredTransactions.forEach((t: any) => { categoryTotals[t.category] = (categoryTotals[t.category] || 0) + parseFloat(t.amount || '0'); });
  const categoryStats = Object.entries(categoryTotals).map(([name, amount]: any) => ({ 
    name, 
    amount, 
    percentage: totalAmount > 0 ? (amount / totalAmount) * 100 : 0, 
    style: getCategoryStyle(name, categories) 
  })).sort((a, b) => b.amount - a.amount);

  // Donut chart calculations
  let currentOffset = 0;
  const radius = 85;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="flex flex-col h-full z-10">
      <header className="safe-top p-6 flex items-center justify-center shrink-0"><p className="text-xs font-black tracking-[0.3em] text-white/40 uppercase">Spendings Summary</p></header>
      <main className="flex-1 overflow-y-auto px-6 py-2">
        <div className="flex flex-col items-center mb-10">
          
          {/* Month/Year Filter */}
          <div className="w-full flex gap-3 mb-8">
            <div className="flex-1 glass-card p-1 border-white/5 relative">
              <select 
                value={selectedMonth} 
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedMonth(val === 'ALL' ? 'ALL' : parseInt(val));
                }}
                className="w-full bg-transparent text-white text-sm font-bold p-3 outline-none appearance-none"
              >
                <option value="ALL" className="bg-[#0a0a0a] text-white">All Months</option>
                {months.map((m, i) => (
                  <option key={m} value={i} className="bg-[#0a0a0a] text-white">{m}</option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/40">
                <ChevronDown size={16} />
              </div>
            </div>
            <div className="w-28 glass-card p-1 border-white/5">
              <input 
                type="number" 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="w-full bg-transparent text-white text-sm font-bold p-3 outline-none"
                placeholder="Year"
              />
            </div>
          </div>

          {/* Donut Chart */}
          <div className="relative w-64 h-64 mb-8 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 200 200">
              <circle
                cx="100"
                cy="100"
                r={radius}
                stroke="currentColor"
                strokeWidth="10"
                fill="transparent"
                className="text-white/5"
              />
              {categoryStats.map((stat, i) => {
                const strokeDasharray = `${(stat.percentage * circumference) / 100} ${circumference}`;
                const strokeDashoffset = - (currentOffset * circumference) / 100;
                currentOffset += stat.percentage;
                return (
                  <circle
                    key={i}
                    cx="100"
                    cy="100"
                    r={radius}
                    stroke={stat.style.hex}
                    strokeWidth="10"
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    fill="transparent"
                    className="transition-all duration-1000 ease-out"
                  />
                );
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">Total Spent</p>
              <p className="text-3xl font-black text-white neon-text mt-1">RM {formatAmount(totalAmount)}</p>
            </div>
          </div>

          <div className="w-full space-y-3">
            {categoryStats.length > 0 ? categoryStats.map((stat, i) => {
              const Icon = stat.style.icon;
              return (
                <div key={i} className="glass-card p-4 flex items-center justify-between border-white/5">
                  <div className="flex items-center gap-4">
                    <div 
                      className={`w-10 h-10 rounded-xl flex items-center justify-center bg-white/5 ${stat.style.color}`}
                      style={{ color: stat.style.isDynamic ? stat.style.hex : undefined }}
                    >
                      <Icon size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-white capitalize">{stat.name}</p>
                      <p className="text-[10px] text-white/40 font-black uppercase">{stat.percentage.toFixed(1)}% Usage</p>
                    </div>
                  </div>
                  <p className="text-lg font-black text-white">RM {formatAmount(stat.amount)}</p>
                </div>
              );
            }) : (
              <div className="glass-card p-8 flex flex-col items-center justify-center border-white/5 opacity-50">
                <Calendar size={32} className="text-white mb-3" />
                <p className="text-xs font-bold uppercase tracking-widest text-white/40">No records found</p>
              </div>
            )}
          </div>
        </div>
      </main>
      <footer className="safe-bottom px-6 shrink-0 py-4"><button onClick={onBack} className="w-full h-16 bg-white/10 border border-white/10 text-white rounded-[2rem] font-black text-lg flex items-center justify-center gap-3"><ArrowLeft size={20} /> RETURN TO LOG</button></footer>
    </div>
  );
}

function SettingsView({ profile, categories, onBack, onLogout, onUpdateProfile, onUpdateCategories, session }: any) {
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState("#00f2ff");
  const [newCatIcon, setNewCatIcon] = useState("ShoppingBag");
  const [isAdding, setIsAdding] = useState(false);

  const colors = ["#00f2ff", "#bc13fe", "#4ade80", "#facc15", "#60a5fa", "#f87171", "#fb923c", "#a78bfa"];
  const wallpaperColors = ["#1E40AF", "#4C1D95", "#064E3B", "#7C2D12", "#000000", "#111827"];
  const icons = Object.keys(ICON_MAP);

  const handleUpdateWallpaper = async (color: string) => {
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ wallpaper_color: color })
    });
    if (res.ok) onUpdateProfile(await res.json());
  };

  const handleAddCategory = async () => {
    if (!newCatName) return;
    setIsAdding(true);
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: newCatName, color: newCatColor, icon: newCatIcon })
    });
    if (res.ok) {
      setNewCatName("");
      onUpdateCategories();
    }
    setIsAdding(false);
  };

  const handleDeleteCategory = async (id: number) => {
    if (window.confirm('Delete this category?')) {
      const res = await fetch(`/api/categories/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) onUpdateCategories();
    }
  };

  return (
    <div className="flex flex-col h-full z-10">
      <header className="safe-top p-6 flex items-center justify-between shrink-0">
        <button onClick={onBack} className="p-3 glass-card !rounded-2xl border-white/5"><ArrowLeft size={20} /></button>
        <p className="text-xs font-black tracking-[0.3em] text-white/40 uppercase">Settings</p>
        <div className="w-12"></div>
      </header>
      <main className="flex-1 overflow-y-auto px-6 py-2 space-y-10">
        
        {/* Wallpaper Section */}
        <section>
          <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">Background Theme</p>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {wallpaperColors.map(color => (
              <button 
                key={color} 
                onClick={() => handleUpdateWallpaper(color)}
                className={`w-12 h-12 rounded-full border-2 transition-all ${profile?.wallpaper_color === color ? 'border-white scale-110 shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'border-white/10'}`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </section>

        {/* Categories Section */}
        <section className="space-y-6">
          <div className="flex justify-between items-center">
            <p className="text-xs font-bold text-white/40 uppercase tracking-widest">Categories Editor</p>
          </div>
          <div className="space-y-3">
            {categories.map((cat: any) => {
              const Icon = ICON_MAP[cat.icon] || MoreHorizontal;
              return (
                <div key={cat.id} className="glass-card p-4 flex items-center justify-between border-white/5">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/5" style={{ color: cat.color }}>
                      <Icon size={20} />
                    </div>
                    <p className="font-bold text-white">{cat.name}</p>
                  </div>
                  <button onClick={() => handleDeleteCategory(cat.id)} className="p-2 text-white hover:text-red-400 transition-colors"><Trash size={18} /></button>
                </div>
              );
            })}
          </div>

          {/* Add Category Form */}
          <div className="glass-card p-6 border-white/10 space-y-6">
            <p className="text-sm font-black text-white/80 uppercase">Add New Category</p>
            <div className="space-y-4">
              <input 
                type="text" 
                value={newCatName} 
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="Category Name"
                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white font-bold outline-none focus:border-neon-blue transition-all"
              />
              
              <div>
                <p className="text-[10px] font-black text-white/30 uppercase mb-3">Pick Color</p>
                <div className="flex flex-wrap gap-3">
                  {colors.map(color => (
                    <button 
                      key={color} 
                      onClick={() => setNewCatColor(color)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${newCatColor === color ? 'border-white scale-110' : 'border-white/10'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-black text-white/30 uppercase mb-3">Pick Icon</p>
                <div className="grid grid-cols-6 gap-3">
                  {icons.map(iconName => {
                    const IconComp = ICON_MAP[iconName];
                    return (
                      <button 
                        key={iconName} 
                        onClick={() => setNewCatIcon(iconName)}
                        className={`p-2 rounded-xl border transition-all flex items-center justify-center ${newCatIcon === iconName ? 'bg-white/10 border-white text-white' : 'bg-white/5 border-white/5 text-white/30'}`}
                      >
                        <IconComp size={18} />
                      </button>
                    );
                  })}
                </div>
              </div>

              <button 
                onClick={handleAddCategory}
                disabled={isAdding || !newCatName}
                className="w-full py-4 bg-neon-blue text-black font-black rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isAdding ? <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin"></div> : <><Plus size={20} strokeWidth={3} /> ADD CATEGORY</>}
              </button>
            </div>
          </div>
        </section>

        {/* Logout Section */}
        <section className="pt-4 pb-10">
          <button 
            onClick={onLogout}
            className="w-full py-5 bg-red-500/10 border border-red-500/20 text-red-400 font-black rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all"
          >
            <LogOut size={20} /> LOG OUT
          </button>
        </section>
      </main>
    </div>
  );
}
