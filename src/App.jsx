import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Map, 
  Award, 
  User, 
  MoreHorizontal, 
  Check, 
  Play, 
  Lock, 
  X,
  Zap,
  TrendingUp,
  Shield,
  Star,
  Settings,
  LogOut,
  ChevronRight
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';
import confetti from 'canvas-confetti';

import { supabase } from './supabase';
import Auth from './Auth';
import AdminDashboard from './AdminDashboard';

// Helper to determine current partial
const isSecondPartial = new Date().getMonth() >= 6; // starts in July (index 6)

// Helper to determine current XP Rank
const getRank = (xp) => {
  const currentLevel = [...LEVELS].reverse().find(l => xp >= l.minXp);
  return currentLevel ? currentLevel.level : 1;
};

const LEVELS = [
  { level: 1, minXp: 0, reward: null },
  { level: 2, minXp: 1000, reward: 'Pop Sucket' },
  { level: 3, minXp: 3000, reward: 'Gorra' },
  { level: 4, minXp: 6500, reward: 'Bolsa con Termo' },
  { level: 5, minXp: 10000, reward: 'Chompa' },
];

const CHECKPOINTS = [
  { id: 1, title: 'Bienvenida', pts: 500, p1: 'Bienvenida', f1: '04-12/05', p2: 'Bienvenida Parcial 2', f2: '01/07', lugar: 'Campus', hora: 'TBA' },
  { id: 2, title: 'Búsqueda del Tesoro', pts: 500, p1: 'Búsqueda del tesoro', f1: '13/05', p2: 'Búsqueda del tesoro P2', f2: '15/07', lugar: 'Campus', hora: 'TBA' },
  { id: 3, title: 'Integración', pts: 1000, p1: 'Integración', f1: '15/05', p2: 'Charla', f2: '21/07', lugar: 'Campus', hora: 'TBA' },
  { id: 4, title: 'Jueves Amarillo', pts: 750, p1: 'Jueves amarillo', f1: '21/05', p2: 'Curso', f2: 'TBA', lugar: 'Campus', hora: 'TBA' },
  { id: 5, title: 'Charla', pts: 1250, p1: 'Charla', f1: '26/05', p2: '4K', f2: 'TBA', lugar: 'Campus', hora: 'TBA' },
  { id: 6, title: 'Ayuda a Fundación', pts: 700, p1: 'Ayuda a fundación', f1: '29/05', p2: 'Día de cine', f2: 'TBA', lugar: 'Campus', hora: 'TBA' },
  { id: 7, title: 'Bingo del Niño', pts: 800, p1: 'Bingo del niño', f1: '01/06', p2: 'Feria de emprendimiento', f2: 'TBA', lugar: 'Campus', hora: 'TBA' },
  { id: 8, title: 'Curso', pts: 1000, p1: 'Curso', f1: '03/06', p2: 'Fiesta', f2: 'TBA', lugar: 'Campus', hora: 'TBA' },
  { id: 9, title: 'Fiesta', pts: 1500, p1: 'Fiesta', f1: '12/06', p2: 'Caravana', f2: '31/07', lugar: 'Campus', hora: 'TBA' },
  { id: 10, title: 'Torneo Fut Relámpago', pts: 2000, p1: 'Torneo Fut Relámpago', f1: '20/06', p2: 'Elecciones', f2: 'TBA', lugar: 'Campus', hora: 'TBA' },
];

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const [badges, setBadges] = useState([]);
  const [activeTab, setActiveTab] = useState('camino');
  const [activeCp, setActiveCp] = useState(null);
  const [showQR, setShowQR] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [activities, setActivities] = useState(CHECKPOINTS);
  const [scanError, setScanError] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchProfile(session.user.id);
        fetchActivitiesFromDB();
      }
      else setIsAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchProfile(session.user.id);
        fetchActivitiesFromDB();
      }
      else {
        setProfile(null);
        setIsAuthLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchActivitiesFromDB = async () => {
    try {
      const { data, error } = await supabase.from('activities').select('*').order('id', { ascending: true });
      if (error && error.code !== 'PGRST116') throw error;
      if (data && data.length > 0) setActivities(data);
    } catch (err) {
      console.warn("Table 'activities' not found or empty, using defaults.");
    }
  };

  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error; // PGRST116 is row not found
      
      if (data) {
        setProfile(data);
        setLevel(data.current_level || 1);
        setXp(data.xp_total || 0);
      }
    } catch (err) {
      console.error("Error fetching profile", err);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const updateProgressInDB = async (newLevel, newXp) => {
    if (!session) return;
    await supabase.from('profiles').update({ current_level: newLevel, xp_total: newXp }).eq('id', session.user.id);
  };

  const handleComplete = () => {
    setShowQR(true);
    setScanError(null);
  };

  const nextLevel = () => {
    if (activeCp) {
      // Trigger success effects
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FACC15', '#2563EB', '#FFFFFF']
      });

      const newXp = xp + activeCp.pts;
      const nextCheckpoint = activeCp.id + 1;
      
      setXp(newXp);
      setLevel(nextCheckpoint);
      updateProgressInDB(nextCheckpoint, newXp);
      
      LEVELS.forEach(lvl => {
        if (newXp >= lvl.minXp && lvl.reward && !badges.includes(lvl.reward)) {
          setBadges(prev => [...prev, lvl.reward]);
        }
      });
    }
    setActiveCp(null);
    setShowQR(false);
    setSelectedTasks([]);
    setScanError(null);
  };

  const handleSkipLevel = () => {
    if (activeCp) {
      const newLevel = Math.min(level + 1, CHECKPOINTS.length + 1);
      setLevel(newLevel);
      updateProgressInDB(newLevel, xp);
    }
    setActiveCp(null);
    setShowQR(false);
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center font-['Outfit'] text-[#FFD233] text-xl font-black italic">
        CARGANDO INDEPENDIENTES ECONOMÍA...
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  if (profile?.status === 'suspendido') {
    return (
      <div className="min-h-screen bg-rose-950 flex flex-col items-center justify-center font-['Outfit'] text-white text-center p-8">
        <Shield size={64} className="text-rose-500 mb-6" />
        <h1 className="text-3xl font-black italic mb-2">ACCESO DENEGADO</h1>
        <p className="text-rose-200 font-medium max-w-sm mb-8">Tu cuenta ha sido suspendida por incumplir con las normativas de la universidad.</p>
        <button onClick={() => supabase.auth.signOut()} className="bg-white/10 hover:bg-white/20 px-6 py-3 rounded-xl font-bold transition">
          Cerrar Sesión
        </button>
      </div>
    );
  }

  if (profile?.role === 'admin' || profile?.role === 'master') {
    return <AdminDashboard session={session} profile={profile} />;
  }

  return (
    <div className="flex justify-center bg-slate-900 min-h-screen font-['Outfit'] select-none overflow-x-hidden">
      <div className="w-full max-w-xl md:max-w-2xl bg-white min-h-screen shadow-2xl relative flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="bg-red-600 text-white text-xs font-mono p-2 text-center" style={{ zIndex: 9999 }}>
          DEBUG: Session Email = {session?.user?.email} | Profile Role = {profile?.role || 'NULL/NO-EXISTE'}
        </div>
        <header className="shrink-0 z-[60] bg-white p-6 pb-2 flex flex-col relative pt-[max(1.5rem,env(safe-area-inset-top))]">
          <div className="flex justify-between items-start mb-2">
            <h1 className="text-[#FFC400] text-3xl font-black italic tracking-tight">
               Nivel {getRank(xp)}
            </h1>
            {/* Logo SER */}
            <div className="w-24 h-24 relative -mt-4 -mr-2 drop-shadow-xl flex justify-center items-center">
               <img 
                 src="https://raw.githubusercontent.com/Gael04-web/assets-web/4d78ca7b26809e93fe82d22386a538ee428eb9ff/logo_SER-removebg-preview.png" 
                 alt="Logo SER" 
                 className="w-full h-full object-contain" 
               />
            </div>
          </div>
          
          <div className="flex flex-col gap-1 pr-12">
             <div className="w-full h-4 bg-black rounded-full overflow-hidden shadow-inner relative flex items-center p-[2px]">
               <motion.div 
                 className="h-full bg-gradient-to-r from-[#8B4513] via-[#DAA520] to-black rounded-full"
                 initial={{ width: 0 }}
                 animate={{ width: `${Math.min((level - 1) / CHECKPOINTS.length * 100, 100)}%` }}
                 transition={{ duration: 1, ease: "circOut" }}
               />
             </div>
             <div className="flex justify-end pr-4">
                <span className="text-[#8B4513] font-black text-xl tracking-tight">{xp} xp</span>
             </div>
          </div>
        </header>

        {/* Content Tabs */}
        <main className="flex-1 overflow-hidden relative bg-white">
          {/* High-Fidelity Background Waves (Hills) */}
          <div className="absolute inset-0 pointer-events-none z-0">
             <svg className="absolute w-[200%] h-full left-[-50%] top-0 overflow-visible" preserveAspectRatio="none">
               <path d="M0,50 Q400,-50 800,50 T1600,50 L1600,2000 L0,2000 Z" fill="#1E4ED9" opacity="1" />
               <path d="M0,350 Q400,200 800,350 T1600,350 L1600,2000 L0,2000 Z" fill="#3B82F6" opacity="0.9" />
               <path d="M0,650 Q400,500 800,650 T1600,650 L1600,2000 L0,2000 Z" fill="#60A5FA" opacity="0.7" />
               <path d="M0,950 Q400,800 800,950 T1600,950 L1600,2000 L0,2000 Z" fill="#BFDBFE" opacity="0.5" />
             </svg>
             
             {/* Side Text Outline - Higher Fidelity */}
             <div className="absolute right-4 top-40 flex flex-col items-center gap-1 opacity-60 transform translate-x-2">
                {"SER".split("").map((t, idx) => (
                  <span key={idx} className="text-transparent text-9xl font-black leading-none [-webkit-text-stroke:3px_white]">
                    {t}
                  </span>
                ))}
             </div>
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'camino' && (
              <motion.div 
                key="camino"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="w-full h-full relative z-10"
              >
                {/* Cámara de paneo dinámico */}
                <motion.div 
                  className="absolute top-0 w-full"
                  animate={{ y: -(level - 1) * 250 + 120 }}
                  transition={{ type: "spring", damping: 22, stiffness: 80 }}
                >
                  <div 
                    className="absolute top-0 left-0 w-full pointer-events-none"
                    style={{ height: `${(activities.length * 250) + 300}px` }}
                  >
                     <WindingPath nodes={activities.length} currentCheckpoint={level} />
                  </div>

                  <div 
                    className="relative z-10 w-full"
                    style={{ height: `${(activities.length * 250) + 300}px` }}
                  >
                    {activities.map((cp) => {
                      const activityTitle = isSecondPartial ? (cp.p2 || cp.title) : (cp.p1 || cp.title);
                      return (
                        <CheckpointNode 
                          key={cp.id}
                          checkpoint={{...cp, title: activityTitle}}
                          index={cp.id}
                          currentLevel={level}
                          onClick={() => cp.id === level ? setActiveCp(cp) : null}
                        />
                      );
                    })}
                  </div>
                </motion.div>
              </motion.div>
            )}

            {activeTab === 'logros' && (
              <motion.div 
                key="logros"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="p-6 pb-24 h-full overflow-y-auto relative z-10"
              >
                <h2 className="text-3xl font-black text-slate-800 mb-6">Mis Premios</h2>
                <div className="grid grid-cols-2 gap-4">
                  {LEVELS.filter(l => l.reward).map((lvl) => {
                    const isUnlocked = getRank(xp) >= lvl.level;
                    return (
                      <div 
                        key={lvl.level}
                        className={`p-4 rounded-[24px] border-2 text-center transition-all ${
                          isUnlocked ? 'bg-white border-secondary/20 shadow-lg' : 'bg-slate-50 border-transparent grayscale'
                        }`}
                      >
                        <div className={`w-16 h-16 mx-auto mb-3 rounded-2xl flex items-center justify-center ${
                          isUnlocked ? 'bg-secondary/10 text-secondary' : 'bg-slate-100 text-slate-300'
                        }`}>
                          <Award size={32} />
                        </div>
                        <p className={`font-black text-sm ${isUnlocked ? 'text-slate-800' : 'text-slate-400'}`}>
                          {lvl.reward}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-widest">
                          Nivel {lvl.level} {isUnlocked ? '• Desbloqueado' : `• ${lvl.minXp} XP`}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {activeTab === 'perfil' && (
              <motion.div 
                key="perfil"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="p-6 pb-24 h-full overflow-y-auto relative z-10"
              >
                <div className="bg-white rounded-[32px] p-8 shadow-xl text-center border-b-8 border-slate-100 mb-8">
                  <div className="relative inline-block mb-6">
                    <div className="w-32 h-32 rounded-full border-8 border-primary/10 overflow-hidden bg-slate-100 flex items-center justify-center text-slate-300">
                       <User size={80} strokeWidth={1.5} />
                    </div>
                    <div className="absolute bottom-2 right-2 w-8 h-8 bg-primary rounded-full border-4 border-white flex items-center justify-center text-white">
                      <Star size={12} fill="currentColor" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 mb-1">{profile?.full_name || 'Estudiante'}</h3>
                  <p className="text-slate-400 font-bold mb-6 truncate">{profile?.email || session?.user?.email}</p>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <StatItem icon={<TrendingUp size={20} />} label="Nivel" value={level} color="text-primary" />
                    <StatItem icon={<Zap size={20} />} label="XP" value={xp} color="text-secondary-dark" />
                    <StatItem icon={<Award size={20} />} label="Logros" value={badges.length} color="text-yellow-600" />
                  </div>
                </div>

                <div className="space-y-3">
                  <ProfileLink onClick={() => supabase.auth.signOut()} icon={<LogOut size={20} />} label="Cerrar Sesión" red />
                </div>
              </motion.div>
            )}
            
            {activeTab === 'mas' && (
              <motion.div 
                key="mas"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-6 pb-24 h-full overflow-y-auto relative z-10"
              >
                <h2 className="text-3xl font-black text-slate-800 mb-6">Más Opciones</h2>
                <div className="space-y-4">
                  <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[28px] p-6 text-white overflow-hidden relative">
                    <div className="relative z-10">
                      <h4 className="text-xl font-black mb-2">Independientes Economía</h4>
                      <p className="text-sm opacity-80 mb-4">Sube de nivel más rápido con beneficios exclusivos.</p>
                      <button className="bg-white text-indigo-600 font-black px-6 py-2 rounded-full text-sm">PROBAR GRATIS</button>
                    </div>
                    <Award size={100} className="absolute -right-4 -bottom-4 opacity-10 rotate-12" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <MenuSquare label="Tienda" icon={<Star fill="currentColor" />} />
                    <MenuSquare label="Equipo" icon={<User fill="currentColor" />} />
                    <MenuSquare label="Racha" icon={<Zap fill="currentColor" />} />
                    <MenuSquare label="Rankings" icon={<TrendingUp />} />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Navigation Bar */}
        <nav className="shrink-0 bg-white border-t border-slate-100 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] flex justify-around items-center z-50">
          <NavBtn icon={<Map />} label="Camino" active={activeTab === 'camino'} onClick={() => setActiveTab('camino')} />
          <NavBtn icon={<Award />} label="Logros" active={activeTab === 'logros'} onClick={() => setActiveTab('logros')} />
          <NavBtn icon={<User />} label="Perfil" active={activeTab === 'perfil'} onClick={() => setActiveTab('perfil')} />
          <NavBtn icon={<MoreHorizontal />} label="Más" active={activeTab === 'mas'} onClick={() => setActiveTab('mas')} />
        </nav>

        {/* Activity Modal */}
        <AnimatePresence>
          {activeCp && (
            <div className="fixed inset-0 z-[100] flex items-end justify-center">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setActiveCp(null)}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="relative w-full max-w-md bg-white rounded-t-[40px] p-8 shadow-2xl"
              >
                {!showQR ? (
                  <div className="text-left w-full pb-4">
                    <h2 className="text-4xl font-black text-[#0012A6] mb-4 tracking-tighter leading-tight">
                       {isSecondPartial ? (activeCp.p2 || activeCp.title) : (activeCp.p1 || activeCp.title)}
                    </h2>
                    
                    <div className="space-y-4 mb-8">
                       <div className={`p-5 rounded-[32px] border-2 shadow-sm ${isSecondPartial ? 'bg-amber-50 border-amber-100' : 'bg-blue-50 border-blue-100'}`}>
                          <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${isSecondPartial ? 'text-amber-500' : 'text-blue-500'}`}>
                             {isSecondPartial ? 'SEGUNDO PARCIAL (P2)' : 'PRIMER PARCIAL (P1)'}
                          </p>
                          <div className="flex items-start justify-between gap-4">
                             <div>
                                <p className="text-2xl font-black text-slate-800 leading-tight mb-1">
                                   {isSecondPartial ? (activeCp.p2 || activeCp.title) : (activeCp.p1 || activeCp.title)}
                                </p>
                                <p className="text-sm font-bold text-slate-500">
                                   {isSecondPartial ? (activeCp.f2 || 'Fecha por definir') : (activeCp.f1 || 'Fecha por definir')}
                                </p>
                             </div>
                             <div className="bg-white/80 p-3 rounded-2xl shadow-inner font-black text-center min-w-[70px]">
                                <p className="text-[10px] text-slate-400 uppercase leading-none mb-1">XP</p>
                                <p className={`text-xl ${isSecondPartial ? 'text-amber-600' : 'text-blue-600'}`}>+{activeCp.pts}</p>
                             </div>
                          </div>
                       </div>
                    </div>

                    <div className="flex gap-4 mt-8">
                      <button 
                        onClick={handleComplete}
                        className="flex-1 bg-[#0012A6] text-white font-black py-4 rounded-[32px] text-xl shadow-[0_6px_0_0_#000B66] active:translate-y-1 active:shadow-none transition-all"
                      >
                        Asistí
                      </button>
                      <button 
                        onClick={handleSkipLevel}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-500 font-black py-4 rounded-[32px] text-xl active:scale-95 transition-all"
                      >
                        Pasar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="mb-6">
                       <h2 className="text-3xl font-black text-slate-800 mb-2">VALIDACIÓN QR</h2>
                       <p className="text-slate-500 text-sm">Escanea el código de la actividad para recibir tus {activeCp.pts} XP.</p>
                    </div>
                    
                    <div className="relative mx-auto w-full max-w-[280px] aspect-square bg-slate-100 rounded-[40px] overflow-hidden border-4 border-[#0012A6] mb-6 shadow-xl">
                       <QRScanner 
                         onResult={(token) => {
                           if (token === activeCp.qr_token) {
                             nextLevel();
                           } else {
                             setScanError("Código incorrecto. Escanea el QR de esta actividad.");
                           }
                         }} 
                       />
                       {scanError && (
                         <div className="absolute inset-0 bg-rose-600/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-white animate-in fade-in duration-300">
                            <X size={48} strokeWidth={3} className="mb-2" />
                            <p className="font-black text-center leading-tight">{scanError}</p>
                            <button 
                              onClick={() => setScanError(null)}
                              className="mt-4 bg-white text-rose-600 px-4 py-2 rounded-xl font-bold text-xs"
                            >
                              REINTENTAR
                            </button>
                         </div>
                       )}
                    </div>

                    <button 
                      onClick={() => { setShowQR(false); setScanError(null); }}
                      className="w-full bg-slate-100 text-slate-500 font-black py-4 rounded-2xl transition-all text-xl"
                    >
                      REGRESAR
                    </button>
                  </div>
                )}
                
                <button 
                   onClick={() => setActiveCp(null)}
                   className="absolute top-6 right-6 text-slate-300 hover:text-slate-500 transition-colors"
                >
                  <X size={28} />
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function QRScanner({ onResult }) {
  const [isReady, setIsReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    const html5QrCode = new Html5Qrcode("reader");
    
    // Auto-start camera if possible
    const startCamera = async () => {
      try {
        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            onResult(decodedText);
            html5QrCode.stop().catch(console.error);
          },
          () => {} // quiet error
        );
        setIsReady(true);
      } catch (err) {
        console.error("Error starting camera", err);
        setErrorMsg("Acceso a cámara denegado o no disponible.");
      }
    };

    startCamera();

    return () => {
      if (html5QrCode.isScanning) {
        html5QrCode.stop().catch(console.error);
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
      <div id="reader" className="w-full h-full object-cover" />
      
      {!isReady && !errorMsg && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-10">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-white font-bold text-sm">Iniciando cámara...</p>
        </div>
      )}

      {errorMsg && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-10 p-6 text-center">
          <p className="text-white font-bold mb-4">{errorMsg}</p>
          <p className="text-slate-400 text-xs leading-relaxed">
            Asegúrate de estar usando una conexión segura (HTTPS) y de haber permitido el acceso a la cámara.
          </p>
        </div>
      )}

      {isReady && (
        <div className="absolute inset-0 pointer-events-none border-[40px] border-black/40">
           <div className="w-full h-full border-2 border-amber-500/50 rounded-2xl relative">
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-amber-500 rounded-tl-lg" />
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-amber-500 rounded-tr-lg" />
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-amber-500 rounded-bl-lg" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-amber-500 rounded-br-lg" />
           </div>
        </div>
      )}
    </div>
  );
}

function WindingPath({ nodes, currentCheckpoint }) {
  let path = "M 50 150 "; // Start centered at the first node
  const totalHeight = (nodes * 250) + 300;
  
  for (let i = 1; i < nodes; i++) {
    const y = 150 + (i * 250);
    const prevY = 150 + ((i - 1) * 250);
    const x = 50 + (i % 2 === 0 ? -25 : 25);
    const prevX = 50 + ((i - 1) % 2 === 0 ? -25 : 25);
    
    path += `C ${prevX} ${prevY + 125}, ${x} ${y - 125}, ${x} ${y} `;
  }

  return (
    <svg width="100%" height="100%" viewBox={`0 0 100 ${totalHeight}`} preserveAspectRatio="none">
      <path d={path} fill="none" stroke="white" strokeWidth="0.5" strokeLinecap="round" className="opacity-30" />
      <motion.path 
        d={path} 
        fill="none" 
        stroke="white" 
        strokeWidth="0.8" 
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: (currentCheckpoint - 1) / (nodes - 1) }}
        transition={{ duration: 1.5, ease: "easeInOut" }}
      />
    </svg>
  );
}

function CheckpointNode({ checkpoint, index, currentLevel, onClick }) {
  const isDone = index < currentLevel;
  const isActive = index === currentLevel;
  const isLocked = index > currentLevel;

  const y = 150 + ((index - 1) * 250);
  const x = 50 + ((index - 1) % 2 === 0 ? -25 : 25);

  return (
    <div 
      style={{ left: `${x}%`, top: y }}
      className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group"
    >
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1 }}
        whileHover={!isLocked ? { scale: 1.1 } : {}}
        whileTap={!isLocked ? { scale: 0.95 } : {}}
        onClick={onClick}
        className={`w-20 h-20 rounded-full flex items-center justify-center cursor-pointer relative shadow-lg transition-all ${
          isLocked ? 'bg-primary/50 grayscale' : 'bg-primary'
        }`}
      >
        {isDone ? <Check size={44} className="text-[#0D1B2A] font-light" strokeWidth={2} /> : 
         isActive ? <Play size={44} className="text-[#0D1B2A] fill-[#0D1B2A] ml-1" /> : 
         <Lock size={36} className="text-[#0D1B2A]/40" strokeWidth={2} />}
        
        {isActive && (
          <motion.div 
            animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute -inset-4 border-4 border-primary rounded-full pointer-events-none"
          />
        )}
      </motion.div>
      
      {!isLocked && (
        <div className="mt-4 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-xs font-black text-white whitespace-nowrap shadow-sm">
          {checkpoint.title.toUpperCase()}
        </div>
      )}
    </div>
  );
}

function NavBtn({ icon, label, active, onClick }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-secondary scale-110' : 'text-slate-300 hover:text-slate-400'}`}
    >
      <div className={`transition-all ${active ? 'rotate-[-8deg]' : ''}`}>
        {React.cloneElement(icon, { size: 26, strokeWidth: active ? 3 : 2 })}
      </div>
      <span className="text-[10px] font-black uppercase tracking-wider">{label}</span>
    </button>
  );
}

function StatItem({ icon, label, value, color }) {
  return (
    <div className="text-center">
      <div className={`mx-auto mb-2 w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">{label}</p>
      <p className="text-xl font-black text-slate-800">{value}</p>
    </div>
  );
}

function ProfileLink({ icon, label, red, onClick }) {
  return (
    <div onClick={onClick} className={`flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${red ? 'text-red-500' : 'text-slate-600'}`}>
      <div className="flex items-center gap-3">
        {icon}
        <span className="font-bold">{label}</span>
      </div>
      <ChevronRight size={18} />
    </div>
  );
}

function MenuSquare({ label, icon }) {
  return (
    <div className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer flex flex-col items-center text-center">
       <div className="text-secondary mb-2">{icon}</div>
       <span className="font-black text-slate-700 text-sm tracking-tight">{label}</span>
    </div>
  );
}
