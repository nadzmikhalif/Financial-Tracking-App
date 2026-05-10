import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, Plus, History, X, Upload, ArrowLeft, CheckCircle2, FileText, 
  Calendar, DollarSign, ArrowRight, Building2, Tag, Sparkles, AlertCircle, 
  Trash2, ArrowLeftCircle, Utensils, Car, Monitor, MoreHorizontal 
} from 'lucide-react';

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
  status: string;
  aiError?: string;
}

type ViewState = 'HOME' | 'CAPTURE' | 'SUCCESS';

// --- Helper for Category Styling ---
const getCategoryStyle = (category: string) => {
  const normalized = category?.toLowerCase() || '';
  if (normalized.includes('food')) {
    return { color: 'text-green-400', bg: 'from-green-500/20 to-emerald-500/20', icon: Utensils };
  }
  if (normalized.includes('transportation')) {
    return { color: 'text-yellow-400', bg: 'from-yellow-500/20 to-orange-500/20', icon: Car };
  }
  if (normalized.includes('computer')) {
    return { color: 'text-blue-400', bg: 'from-blue-500/20 to-cyan-500/20', icon: Monitor };
  }
  return { color: 'text-gray-400', bg: 'from-gray-500/20 to-slate-500/20', icon: MoreHorizontal };
};

// --- Main App Component ---
export default function App() {
  const [view, setView] = useState<ViewState>('HOME');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentTransaction, setCurrentTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [focusedTransaction, setFocusedTransaction] = useState<Transaction | null>(null);

  const fetchTransactions = () => {
    setLoading(true);
    fetch('/api/transactions')
      .then(res => res.json())
      .then(data => {
        setTransactions(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    if (view === 'HOME') {
      fetchTransactions();
    }
  }, [view]);

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to permanently delete this transaction record?')) {
      try {
        const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
        if (res.ok) {
          setFocusedTransaction(null);
          fetchTransactions();
        } else {
          alert('Delete failed');
        }
      } catch (e) {
        alert('Connection error');
      }
    }
  };

  return (
    <div className="h-[100dvh] w-full max-w-md mx-auto bg-space-black relative overflow-hidden flex flex-col font-sans">
      {/* Background Glow Bubbles */}
      <div className="bubble-glow w-64 h-64 bg-neon-blue/10 top-[-10%] left-[-20%] animate-pulse-slow"></div>
      <div className="bubble-glow w-64 h-64 bg-neon-purple/10 bottom-[10%] right-[-20%] animate-pulse-slow"></div>

      {view === 'HOME' && (
        <HomeView 
          transactions={transactions} 
          loading={loading} 
          onNew={() => setView('CAPTURE')} 
          onFocus={setFocusedTransaction}
        />
      )}
      
      {view === 'CAPTURE' && (
        <CaptureView 
          onBack={() => setView('HOME')} 
          onSuccess={(data) => {
            setCurrentTransaction(data);
            setView('SUCCESS');
          }} 
        />
      )}

      {view === 'SUCCESS' && (
        <SuccessView 
          transaction={currentTransaction} 
          onDone={() => setView('HOME')} 
        />
      )}

      {/* Focused Detail Modal */}
      {focusedTransaction && (() => {
        const style = getCategoryStyle(focusedTransaction.category);
        const Icon = style.icon;
        return (
          <div 
            onClick={() => setFocusedTransaction(null)}
            className="absolute inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-md bg-black/60 transition-all cursor-pointer"
          >
            <div 
              onClick={(e) => e.stopPropagation()}
              className={`w-full glass-card p-6 animate-in zoom-in-95 duration-200 cursor-default border-white/10 ${focusedTransaction.aiError ? 'border-red-500/30' : ''}`}
            >
               <div className="flex flex-col items-center text-center mb-8">
                  <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br flex items-center justify-center border border-white/10 mb-4 ${focusedTransaction.aiError ? 'from-red-500/20 to-orange-500/20' : style.bg}`}>
                    {focusedTransaction.aiError ? <AlertCircle size={32} className="text-red-400" /> : <Icon size={32} className={style.color} />}
                  </div>
                  <h2 className="text-2xl font-black text-white leading-tight">{focusedTransaction.company}</h2>
                  <p className={`${focusedTransaction.aiError ? 'text-red-400' : style.color} text-xs font-bold uppercase tracking-widest mt-1`}>
                    {focusedTransaction.aiError ? 'Error' : focusedTransaction.category}
                  </p>
               </div>

               <div className="space-y-4 mb-10">
                  <div className="flex justify-between items-center py-3 border-b border-white/5">
                     <span className="text-white/40 text-xs font-bold uppercase">Amount</span>
                     <span className="text-2xl font-black text-white neon-text">${focusedTransaction.amount}</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-white/5">
                     <span className="text-white/40 text-xs font-bold uppercase">Date & Time</span>
                     <span className="text-white/80 font-bold">{focusedTransaction.date} {focusedTransaction.time && <span className="ml-2 text-neon-blue/60">{focusedTransaction.time}</span>}</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-white/5 overflow-hidden">
                     <span className="text-white/40 text-xs font-bold uppercase">ID</span>
                     <span className="text-white/30 text-[10px] font-mono truncate ml-4">{focusedTransaction.filename}</span>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setFocusedTransaction(null)}
                    className="flex items-center justify-center gap-2 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold active:scale-95 transition-all"
                  >
                    <ArrowLeftCircle size={20} /> BACK
                  </button>
                  <button 
                    onClick={() => handleDelete(focusedTransaction.id)}
                    className="flex items-center justify-center gap-2 py-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 font-bold active:scale-95 transition-all"
                  >
                    <Trash2 size={20} /> DELETE
                  </button>
               </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// --- View: Home ---
function HomeView({ transactions, loading, onNew, onFocus }: { transactions: Transaction[], loading: boolean, onNew: () => void, onFocus: (t: Transaction) => void }) {
  return (
    <div className="flex flex-col h-full z-10">
      <header className="safe-top px-6 py-6 shrink-0">
        <div className="flex justify-between items-end">
          <div>
            <p className="text-neon-blue text-xs font-bold tracking-[0.2em] uppercase mb-1">Jarvis 1.0</p>
            <h1 className="text-3xl font-black tracking-tight">Activity</h1>
          </div>
          <div className="p-3 glass-card rounded-2xl">
            <Sparkles className="text-neon-blue" size={20} />
          </div>
        </div>
      </header>
      
      <main className="flex-1 overflow-y-auto px-6 py-2">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <div className="w-12 h-12 border-4 border-neon-blue/20 border-t-neon-blue rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-4 pb-10">
            {transactions.map(t => {
              const style = getCategoryStyle(t.category);
              const Icon = style.icon;
              return (
                <div 
                  key={t.id} 
                  onClick={() => onFocus(t)}
                  className={`glass-card p-5 group hover:bg-white/10 transition-all border-white/5 cursor-pointer active:scale-[0.98] ${t.aiError ? 'border-red-500/30' : ''}`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center border border-white/10 ${t.aiError ? 'from-red-500/20 to-orange-500/20' : style.bg}`}>
                        {t.aiError ? <AlertCircle size={20} className="text-red-400" /> : <Icon size={20} className={style.color} />}
                      </div>
                      <div>
                        <p className="font-bold text-white text-lg leading-tight">{t.company}</p>
                        <p className={`text-xs font-medium tracking-wide ${t.aiError ? 'text-white/40' : style.color}`}>{t.aiError ? 'Processing Error' : t.category}</p>
                      </div>
                    </div>
                    <p className="text-xl font-black text-white neon-text">${t.amount}</p>
                  </div>
                  <div className="flex justify-between items-center text-[10px] uppercase tracking-widest font-bold text-white/30">
                    <span>{t.date} {t.time && <span className="ml-2 text-neon-blue/40">{t.time}</span>}</span>
                    {t.aiError && <span className="text-red-400/60">Failed</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
      
      <footer className="safe-bottom px-6 shrink-0 py-4">
        <button onClick={onNew} className="w-full h-16 bg-white text-black rounded-[2rem] font-black text-lg flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(255,255,255,0.2)] active:scale-95 transition-all">
          <Plus size={24} strokeWidth={3} /> 
          SCAN RECEIPT
        </button>
      </footer>
    </div>
  );
}

// --- View: Capture ---
function CaptureView({ onBack, onSuccess }: { onBack: () => void, onSuccess: (data: Transaction) => void }) {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      const response = await fetch('/api/upload', { method: 'POST', body: formData });
      if (response.ok) {
        const data = await response.json();
        onSuccess(data);
      } else { 
        const errData = await response.json();
        alert(errData.aiError || 'Processing Failed'); 
      }
    } catch (err) { alert('Network Error'); } 
    finally { setIsProcessing(false); }
  };

  return (
    <div className="flex flex-col h-full z-10">
      <header className="safe-top p-6 flex items-center justify-between shrink-0">
        <button onClick={onBack} className="p-3 glass-card !rounded-2xl border-white/5"><ArrowLeft size={20} /></button>
        <p className="text-xs font-black tracking-[0.3em] text-white/40 uppercase">A.I. Visual Scan</p>
        <div className="w-12"></div>
      </header>
      
      <main className="flex-1 flex flex-col items-center justify-center p-6 min-h-0">
        <div className="w-full aspect-[3/4] glass-card overflow-hidden relative border-white/10 p-2">
          {previewUrl ? (
            <div className="w-full h-full relative group">
              <img src={previewUrl} className="w-full h-full object-cover rounded-[2rem]" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
              <button onClick={() => { setSelectedImage(null); setPreviewUrl(null); }} className="absolute top-4 right-4 p-3 bg-black/50 backdrop-blur-xl rounded-2xl border border-white/10"><X size={20} /></button>
            </div>
          ) : (
            <button onClick={() => fileInputRef.current?.click()} className="w-full h-full flex flex-col items-center justify-center gap-6">
              <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center border border-white/10 animate-float">
                <Camera size={32} className="text-neon-blue" />
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-white mb-1">Initialize Sensor</p>
                <p className="text-white/30 text-xs">Tap to activate camera</p>
              </div>
            </button>
          )}
          {/* Scanning Animation */}
          {isProcessing && (
            <div className="absolute inset-0 z-20 pointer-events-none">
              <div className="w-full h-1 bg-neon-blue shadow-[0_0_20px_#00f2ff] animate-[scan_2s_ease-in-out_infinite]"></div>
            </div>
          )}
        </div>
        <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
      </main>
      
      <footer className="safe-bottom px-6 shrink-0 py-4">
        {selectedImage && (
          <button onClick={handleUpload} disabled={isProcessing} className="w-full h-16 bg-neon-blue text-black rounded-[2rem] font-black text-lg flex items-center justify-center gap-3 shadow-[0_0_40px_rgba(0,242,255,0.3)] disabled:opacity-50">
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
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(400px); }
        }
      `}</style>
    </div>
  );
}

// --- View: Success ---
function SuccessView({ transaction, onDone }: { transaction: Transaction | null, onDone: () => void }) {
  if (!transaction) return null;
  const isError = !!transaction.aiError;
  const style = getCategoryStyle(transaction.category);
  const Icon = isError ? AlertCircle : style.icon;

  return (
    <div className="flex flex-col h-full z-10">
      <main className="flex-1 px-8 flex flex-col items-center justify-center text-center">
        <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-8 border shadow-[0_0_50px_rgba(0,242,255,0.1)] ${isError ? 'bg-red-500/10 border-red-500/30' : 'bg-neon-blue/10 border-neon-blue/30'}`}>
          {isError ? <AlertCircle size={48} className="text-red-400" /> : <CheckCircle2 size={48} className="text-neon-blue" />}
        </div>
        
        <h1 className="text-3xl font-black mb-2 tracking-tight">
          {isError ? 'Processing Error' : 'Intelligence Acquired'}
        </h1>
        <p className={`text-sm mb-10 uppercase tracking-widest font-bold ${isError ? 'text-red-400/60' : 'text-white/40'}`}>
          {isError ? 'System failed to analyze image' : 'Receipt Processed via Gemini'}
        </p>
        
        <div className={`w-full glass-card p-6 space-y-6 border-white/10 text-left ${isError ? 'border-red-500/20' : ''}`}>
          {isError ? (
             <div className="bg-red-500/10 p-4 rounded-xl border border-red-500/20 max-h-[40vh] overflow-y-auto">
               <div className="sticky top-0 bg-[#1a0b0b] pb-2">
                 <p className="text-red-400 text-xs font-bold uppercase">Error Log</p>
               </div>
               <p className="text-white/70 text-sm leading-relaxed break-words">
                 {transaction.aiError}
               </p>
             </div>
          ) : (
            <>
              <div className="flex justify-between items-center group">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/5 rounded-lg text-neon-blue"><Building2 size={16} /></div>
                  <span className="text-white/50 text-xs font-bold uppercase tracking-tighter">Vendor</span>
                </div>
                <span className="font-black text-white text-lg tracking-tight">{transaction.company}</span>
              </div>

              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className={`p-2 bg-white/5 rounded-lg ${style.color}`}><Icon size={16} /></div>
                  <span className="text-white/50 text-xs font-bold uppercase tracking-tighter">Category</span>
                </div>
                <span className={`${style.bg} ${style.color} px-3 py-1 rounded-full text-[10px] font-black uppercase border border-white/10`}>
                  {transaction.category}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/5 rounded-lg text-neon-blue"><Calendar size={16} /></div>
                  <span className="text-white/50 text-xs font-bold uppercase tracking-tighter">Date & Time</span>
                </div>
                <span className="font-bold text-white/80">{transaction.date} {transaction.time && <span className="ml-2 text-neon-blue/60">{transaction.time}</span>}</span>
              </div>

              <div className="pt-4 mt-4 border-t border-white/5 flex justify-between items-center">
                 <span className="text-white/30 text-[10px] uppercase font-black tracking-widest">Total Credit</span>
                 <span className="text-3xl font-black text-white neon-text">${transaction.amount}</span>
              </div>
            </>
          )}
        </div>
      </main>
      
      <footer className="safe-bottom px-6 shrink-0 py-4">
        <button onClick={onDone} className="w-full h-16 bg-white/10 border border-white/10 text-white rounded-[2rem] font-black text-lg flex items-center justify-center gap-3 active:scale-95 transition-all">
          CLOSE LOG <ArrowRight size={20} />
        </button>
      </footer>
    </div>
  );
}
