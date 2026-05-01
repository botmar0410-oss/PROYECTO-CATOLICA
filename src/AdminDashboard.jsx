import React, { useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { LogOut, Users, ShieldAlert, Star, Trash2, Plus, Minus, UserCheck, Shield, Ban, QrCode, Key, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const PAGE_SIZE = 50;

export default function AdminDashboard({ session, profile, levels = [], onLevelsUpdate }) {
  const [students, setStudents] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('usuarios');
  const [editingActivity, setEditingActivity] = useState(null);
  const [editingLevel, setEditingLevel] = useState(null);
  const [qrModalActivity, setQrModalActivity] = useState(null);
  const [resetResult, setResetResult] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const didMountSearch = useRef(false);
  const didMountPage = useRef(false);
  const isMaster = profile?.role === 'master';
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // ─── Debounce search ───────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // ─── Re-fetch when search changes (skip first mount, handled by fetchData) ─
  useEffect(() => {
    if (!didMountSearch.current) { didMountSearch.current = true; return; }
    setCurrentPage(0);
    fetchStudents(0, debouncedSearch);
  }, [debouncedSearch]);

  // ─── Re-fetch when page changes (skip first mount) ─────────────────────────
  useEffect(() => {
    if (!didMountPage.current) { didMountPage.current = true; return; }
    fetchStudents(currentPage, debouncedSearch);
  }, [currentPage]);

  // ─── Initial load + realtime channel ───────────────────────────────────────
  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('admin-profiles-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
        setStudents((prev) => {
          if (payload.eventType === 'UPDATE') {
            return prev.map(s => s.id === payload.new.id ? { ...s, ...payload.new } : s)
                       .sort((a, b) => b.xp_total - a.xp_total);
          }
          if (payload.eventType === 'INSERT') {
            setTotalCount(c => c + 1);
            return prev; // usuario nuevo aparecerá en la próxima recarga de página
          }
          if (payload.eventType === 'DELETE') {
            setTotalCount(c => Math.max(0, c - 1));
            return prev.filter(s => s.id !== payload.old.id);
          }
          return prev;
        });
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchStudents(0, ''), fetchActivities()]);
    setLoading(false);
  };

  const fetchActivities = async () => {
    try {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .order('id', { ascending: true });
      if (error && error.code !== 'PGRST116') throw error;
      if (data) setActivities(data);
    } catch (err) {
      console.error('Error cargando actividades', err);
    }
  };

  // Paginación server-side + búsqueda server-side (escala a 2000+ usuarios)
  const fetchStudents = async (page = 0, search = '') => {
    try {
      setLoading(true);
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('profiles')
        .select('id, full_name, email, xp_total, current_level, badges, status, role', { count: 'exact' })
        .order('xp_total', { ascending: false })
        .range(from, to);

      if (search.trim()) {
        query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      setStudents(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Error cargando estudiantes', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'activo' ? 'suspendido' : 'activo';
    try {
      const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('id', id);
      if (error) throw error;
      setStudents(prev => prev.map(s => s.id === id ? { ...s, status: newStatus } : s));
    } catch (err) {
      alert('Error al actualizar estado');
    }
  };

  const getRank = (xp) => {
    if (!levels || levels.length === 0) return 1;
    const matched = [...levels].sort((a,b) => b.min_xp - a.min_xp).find(l => xp >= l.min_xp);
    return matched ? matched.level : 1;
  };

  const handleUpdateXP = async (id, currentXP, amount) => {
    const newXP = Math.max(0, currentXP + amount);
    try {
      const { error } = await supabase.from('profiles').update({ xp_total: newXP }).eq('id', id);
      if (error) throw error;
      setStudents(prev =>
        prev.map(s => s.id === id ? { ...s, xp_total: newXP } : s)
            .sort((a, b) => b.xp_total - a.xp_total)
      );
    } catch (err) {
      alert('Error al actualizar XP');
    }
  };

  const handleUpdateLevel = async (id, currentLvl, amount) => {
    const newLvl = Math.max(1, Math.min(10, currentLvl + amount));
    try {
      const { error } = await supabase.from('profiles').update({ current_level: newLvl }).eq('id', id);
      if (error) throw error;
      setStudents(prev => prev.map(s => s.id === id ? { ...s, current_level: newLvl } : s));
    } catch (err) {
      alert('Error al actualizar nivel del mapa');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este registro permanentemente?')) return;
    try {
      const { error } = await supabase.rpc('delete_user_permanently', { target_user_id: id });
      if (error) throw error;
      setStudents(prev => prev.filter(s => s.id !== id));
      setTotalCount(c => Math.max(0, c - 1));
    } catch (err) {
      alert('Error al eliminar el usuario');
    }
  };

  const handleUpdateRole = async (id, currentRole) => {
    const newRole = currentRole === 'admin' ? 'student' : 'admin';
    try {
      const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', id);
      if (error) throw error;
      setStudents(prev => prev.map(s => s.id === id ? { ...s, role: newRole } : s));
    } catch (err) {
      alert('Error al cambiar rol');
    }
  };

  const handleResetPassword = async (student) => {
    if (!window.confirm(`¿Resetear contraseña de ${student.full_name}?`)) return;
    const tempPassword = `Cato${Math.floor(1000 + Math.random() * 9000)}!`;
    try {
      const { error } = await supabase.rpc('reset_user_password', { target_user_id: student.id, new_password: tempPassword });
      if (error) throw error;
      await supabase.from('profiles').update({ must_change_password: true }).eq('id', student.id);
      setResetResult({ name: student.full_name, email: student.email, newPassword: tempPassword });
    } catch (err) {
      alert("Error al resetear contraseña");
    }
  };

  const handleResetSemester = async () => {
    if (!window.confirm('¿Reiniciar todo el semestre?')) return;
    try {
      const { error } = await supabase.from('profiles').update({ xp_total: 0, current_level: 1 }).eq('role', 'student');
      if (error) throw error;
      // Re-fetch completo porque afecta a todos los estudiantes
      await fetchStudents(currentPage, debouncedSearch);
      alert('Reiniciado con éxito');
    } catch (err) {
      alert('Error al reiniciar');
    }
  };

  const handleSaveActivity = async (e) => {
    e.preventDefault();
    try {
      let activityToSave = { ...editingActivity };
      if (!activityToSave.id) activityToSave.id = (activities.length > 0 ? Math.max(...activities.map(a => a.id)) + 1 : 1);
      if (!activityToSave.qr_token) activityToSave.qr_token = `QUEST_${activityToSave.id}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const { error } = await supabase.from('activities').upsert(activityToSave);
      if (error) throw error;
      setEditingActivity(null);
      fetchActivities();
      alert("Guardado con éxito");
    } catch (err) {
      alert("Error al guardar actividad");
    }
  };

  const handleSaveLevel = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('levels').upsert(editingLevel);
      if (error) throw error;
      setEditingLevel(null);
      if (onLevelsUpdate) onLevelsUpdate();
      alert("Nivel actualizado");
    } catch (err) {
      alert("Error al guardar nivel");
    }
  };

  const handleDeleteLevel = async (id) => {
    if (!window.confirm("¿Eliminar nivel?")) return;
    try {
      const { error } = await supabase.from('levels').delete().eq('id', id);
      if (error) throw error;
      if (onLevelsUpdate) onLevelsUpdate();
    } catch (err) {
      alert("Error al eliminar nivel");
    }
  };

  // Stats basadas en datos del servidor (totalCount) o de la página actual
  const suspendedUsers = students.filter(s => s.status === 'suspendido').length;
  const adminUsers = students.filter(s => s.role === 'admin' || s.role === 'master').length;
  // filteredStudents = students ya viene filtrado y paginado desde el servidor
  const filteredStudents = students;

  return (
    <div className="min-h-screen bg-[#F0F4FA] font-['Outfit'] pb-12">
      <header className="bg-[#0012A6] text-white p-4 md:p-6 shadow-xl sticky top-0 z-[50]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3 md:gap-4 w-full md:w-auto">
            <div className="w-12 h-12 md:w-16 md:h-16 bg-white rounded-full p-1 flex items-center justify-center shrink-0">
               <img src="https://raw.githubusercontent.com/Gael04-web/assets-web/4d78ca7b26809e93fe82d22386a538ee428eb9ff/logo_SER-removebg-preview.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div className="flex-1">
              <h1 className="text-lg md:text-2xl font-black leading-tight">INDEPENDIENTES ECONOMÍA</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end border-t border-blue-400/30 pt-3 md:border-none md:pt-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-[10px] font-black border border-blue-400 uppercase">
                {profile?.full_name?.charAt(0)}
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider hidden sm:inline">{profile?.full_name?.split(' ')[0]}</span>
            </div>

            <div className="flex gap-2">
              {isMaster && (
                <button 
                  onClick={handleResetSemester} 
                  className="bg-white/10 hover:bg-white text-white hover:text-[#0012A6] px-3 py-2 md:px-4 md:py-2.5 rounded-xl text-[10px] font-black flex items-center gap-2 transition-all shadow-lg active:scale-95"
                >
                  <ShieldAlert size={16} />
                  <span className="hidden sm:inline">REINICIAR SEMESTRE</span>
                </button>
              )}
              <button 
                onClick={() => supabase.auth.signOut()} 
                className="bg-rose-500 hover:bg-rose-600 text-white px-3 py-2 md:px-4 md:py-2.5 rounded-xl text-[10px] font-black flex items-center gap-2 transition-all shadow-lg active:scale-95"
                title="Cerrar Sesión"
              >
                <LogOut size={16} />
                <span className="hidden sm:inline">SALIR</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 w-full md:w-fit overflow-x-auto no-scrollbar">
           {['usuarios', 'actividades', 'niveles'].map(tab => (
             <button 
               key={tab}
               onClick={() => setActiveTab(tab)}
               className={`flex-1 md:flex-none px-6 py-3 rounded-xl font-black text-[10px] md:text-sm uppercase transition-all whitespace-nowrap ${activeTab === tab ? 'bg-[#0012A6] text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
             >
               {tab}
             </button>
           ))}
        </div>

        {activeTab === 'usuarios' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'TOTAL REGISTROS', val: totalCount, icon: <Users />, bg: 'bg-blue-50', text: 'text-[#0012A6]' },
                { label: 'SUSPENDIDOS', val: suspendedUsers, icon: <Ban />, bg: 'bg-rose-50', text: 'text-rose-600' },
                { label: 'EQUIPO ADMIN', val: adminUsers, icon: <Shield />, bg: 'bg-amber-50', text: 'text-amber-500' }
              ].map((stat, i) => (
                <div key={i} className="bg-white rounded-[24px] md:rounded-[32px] p-5 md:p-6 shadow-sm border border-slate-100 flex items-center gap-4 md:gap-5">
                  <div className={`w-12 h-12 md:w-16 md:h-16 ${stat.bg} ${stat.text} rounded-2xl flex items-center justify-center shrink-0`}>{stat.icon}</div>
                  <div><p className="text-slate-400 font-bold text-[9px] md:text-sm uppercase tracking-wider">{stat.label}</p><h3 className="text-xl md:text-3xl font-black">{stat.val}</h3></div>
                </div>
              ))}
            </div>

            {/* SEARCH BAR */}
            <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-3 w-full md:w-96 relative">
              <Search className={`ml-3 shrink-0 transition-colors ${searchTerm !== debouncedSearch ? 'text-amber-400 animate-pulse' : 'text-slate-400'}`} size={20} />
              <input 
                type="text" 
                placeholder="Buscar por nombre o correo..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-transparent border-none outline-none text-sm font-bold text-slate-700 py-3 pr-4"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="mr-2 text-slate-300 hover:text-slate-500 font-black text-lg leading-none">×</button>
              )}
            </div>

            <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden">
               {/* VISTA TABLET/PC (HIDDEN ON MOBILE) */}
               <div className="hidden lg:block overflow-x-auto">
                 <table className="w-full text-left">
                   <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                     <tr>
                       <th className="px-6 py-5">Usuario</th>
                       <th className="px-6 py-5">Nivel / Progreso</th>
                       <th className="px-6 py-5">Logros</th>
                       <th className="px-6 py-5 text-center">Estado</th>
                       {isMaster && <th className="px-6 py-5 text-center">Privilegios</th>}
                       <th className="px-6 py-5 text-right">Administrar</th>
                     </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                     {filteredStudents.map(s => {
                       const canEdit = s.id !== profile?.id && (isMaster || (s.role !== 'admin' && s.role !== 'master'));
                       return (
                         <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                           <td className="px-6 py-4">
                             <div className="flex items-center gap-3">
                               <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-black uppercase text-slate-500">{s.full_name?.charAt(0)}</div>
                               <div><p className="font-black text-slate-800 text-sm leading-tight">{s.full_name}</p><p className="text-[10px] text-slate-400 font-bold">{s.email}</p></div>
                             </div>
                           </td>
                           <td className="px-6 py-4">
                             <div className="flex flex-col gap-1.5">
                               <div className="flex items-center gap-2">
                                 <span className="bg-blue-50 text-[#0012A6] px-2 py-0.5 rounded text-[10px] font-black">NIVEL {getRank(s.xp_total)}</span>
                                 <span className="text-amber-600 font-black text-xs">{s.xp_total} XP</span>
                               </div>
                               <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded text-[10px] font-black uppercase">ACTIVIDAD: {s.current_level}/10</span>
                             </div>
                           </td>
                           <td className="px-6 py-4">
                             <div className="flex flex-wrap gap-1 max-w-[150px]">
                               {s.badges && s.badges.length > 0 ? (
                                 s.badges.map((b, i) => (
                                   <span key={i} className="bg-amber-50 text-amber-600 px-2 py-0.5 rounded-[4px] text-[9px] font-bold border border-amber-100">
                                     {b}
                                   </span>
                                 ))
                               ) : (
                                 <span className="text-slate-300 text-[10px] italic font-bold">Sin logros</span>
                               )}
                             </div>
                           </td>
                           <td className="px-6 py-4 text-center">
                             <button disabled={!canEdit} onClick={() => handleUpdateStatus(s.id, s.status)} className={`text-[10px] font-black px-3 py-1 rounded-full border ${s.status === 'activo' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>{s.status.toUpperCase()}</button>
                           </td>
                           {isMaster && (
                             <td className="px-6 py-4 text-center">
                               <button disabled={s.id === profile?.id} onClick={() => handleUpdateRole(s.id, s.role)} className="text-[10px] font-black bg-slate-100 px-3 py-1.5 rounded-xl hover:bg-amber-100 transition-colors">{s.role === 'admin' ? 'REVOCAR' : 'HACER ADMIN'}</button>
                             </td>
                           )}
                           <td className="px-6 py-4">
                             <div className="flex items-center justify-end gap-3">
                               <div className="flex flex-col gap-2 p-2 bg-slate-50 rounded-2xl border border-slate-100">
                                 <div className="flex items-center justify-between gap-3 min-w-[120px]">
                                   <span className="text-[9px] font-black text-slate-400 w-5">XP</span>
                                   <div className="flex gap-1 items-center">
                                     <button disabled={!canEdit} onClick={() => handleUpdateXP(s.id, s.xp_total, -100)} className="w-8 h-8 flex items-center justify-center bg-white text-rose-500 rounded-lg shadow-sm border border-rose-100 active:scale-90"><Minus size={14} strokeWidth={3} /></button>
                                     <input type="number" disabled={!canEdit} key={`${s.id}-${s.xp_total}`} defaultValue={s.xp_total} onBlur={(e) => { const val = parseInt(e.target.value); if (!isNaN(val) && val !== s.xp_total) handleUpdateXP(s.id, 0, val); }} onKeyDown={(e) => e.key === 'Enter' && e.target.blur()} className="w-14 h-8 bg-white border border-slate-200 rounded-lg text-center font-black text-slate-700 text-[10px] outline-none" />
                                     <button disabled={!canEdit} onClick={() => handleUpdateXP(s.id, s.xp_total, 100)} className="w-8 h-8 flex items-center justify-center bg-white text-emerald-600 rounded-lg shadow-sm border border-emerald-100 active:scale-90"><Plus size={14} strokeWidth={3} /></button>
                                   </div>
                                 </div>
                                 <div className="flex items-center justify-between gap-3 min-w-[120px]">
                                   <span className="text-[9px] font-black text-slate-400 w-5">MAP</span>
                                   <div className="flex gap-1">
                                     <button disabled={!canEdit} onClick={() => handleUpdateLevel(s.id, s.current_level, 1)} className="w-8 h-8 flex items-center justify-center bg-white text-blue-600 rounded-lg shadow-sm border border-blue-100 active:scale-90"><Plus size={14} strokeWidth={3} /></button>
                                     <button disabled={!canEdit} onClick={() => handleUpdateLevel(s.id, s.current_level, -1)} className="w-8 h-8 flex items-center justify-center bg-white text-rose-500 rounded-lg shadow-sm border border-rose-100 active:scale-90"><Minus size={14} strokeWidth={3} /></button>
                                   </div>
                                 </div>
                               </div>
                               <div className="flex gap-1">
                                 <button disabled={!canEdit} onClick={() => handleResetPassword(s)} className="w-10 h-10 flex items-center justify-center bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100 shadow-sm"><Key size={18} /></button>
                                 <button disabled={!canEdit} onClick={() => handleDelete(s.id)} className="w-10 h-10 flex items-center justify-center bg-slate-100 text-slate-400 rounded-xl hover:bg-rose-100 hover:text-rose-600 shadow-sm"><Trash2 size={18} /></button>
                               </div>
                             </div>
                           </td>
                         </tr>

                       );
                     })}
                   </tbody>
                 </table>
               </div>

               {/* VISTA MÓVIL (CARDS) */}
               <div className="lg:hidden divide-y divide-slate-100">
                 {filteredStudents.map(s => {
                   const canEdit = s.id !== profile?.id && (isMaster || (s.role !== 'admin' && s.role !== 'master'));
                   return (
                     <div key={s.id} className="p-5 space-y-5">
                       <div className="flex items-center justify-between gap-4">
                         <div className="flex items-center gap-3">
                           <div className="w-12 h-12 bg-[#0012A6]/5 text-[#0012A6] rounded-2xl flex items-center justify-center font-black uppercase text-lg border border-[#0012A6]/10 shrink-0">{s.full_name?.charAt(0)}</div>
                           <div className="min-w-0">
                             <p className="font-black text-slate-800 leading-tight truncate">{s.full_name}</p>
                             <p className="text-[10px] text-slate-400 font-bold mt-0.5 truncate">{s.email}</p>
                           </div>
                         </div>
                         <button disabled={!canEdit} onClick={() => handleUpdateStatus(s.id, s.status)} className={`shrink-0 text-[10px] font-black px-4 py-1.5 rounded-full border shadow-sm ${s.status === 'activo' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>{s.status.toUpperCase()}</button>
                       </div>

                       <div className="grid grid-cols-2 gap-4">
                         <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100">
                           <p className="text-[8px] font-black text-slate-400 uppercase mb-1 tracking-widest text-center">NIVEL ACTUAL</p>
                           <p className="text-xs font-black text-[#0012A6] text-center">NIVEL {getRank(s.xp_total)}</p>
                           <p className="text-[14px] font-black text-amber-600 text-center mt-0.5">{s.xp_total} <span className="text-[9px]">XP</span></p>
                         </div>
                         <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100">
                           <p className="text-[8px] font-black text-slate-400 uppercase mb-1 tracking-widest text-center">MAPA (ACT.)</p>
                           <p className="text-xs font-black text-emerald-600 text-center">{s.current_level} DE 10</p>
                           <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden"><div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${(s.current_level/10)*100}%` }}></div></div>
                         </div>
                       </div>

                       <div className="flex flex-col gap-3 p-4 bg-slate-50 rounded-[32px] border border-slate-100">
                          <div className="flex items-center justify-between px-1">
                             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PUNTOS XP</span>
                             <div className="flex gap-2 items-center">
                               <button disabled={!canEdit} onClick={() => handleUpdateXP(s.id, s.xp_total, -100)} className="w-11 h-11 flex items-center justify-center bg-white text-rose-500 rounded-2xl shadow-sm border border-rose-100 active:scale-90"><Minus size={20} strokeWidth={3} /></button>
                               <input type="number" disabled={!canEdit} key={`mob-${s.id}-${s.xp_total}`} defaultValue={s.xp_total} onBlur={(e) => { const val = parseInt(e.target.value); if (!isNaN(val) && val !== s.xp_total) handleUpdateXP(s.id, 0, val); }} onKeyDown={(e) => e.key === 'Enter' && e.target.blur()} className="w-24 h-11 bg-white border border-slate-200 rounded-2xl text-center font-black text-[#0012A6] text-sm" />
                               <button disabled={!canEdit} onClick={() => handleUpdateXP(s.id, s.xp_total, 100)} className="w-11 h-11 flex items-center justify-center bg-white text-emerald-600 rounded-2xl shadow-sm border border-emerald-100 active:scale-90"><Plus size={20} strokeWidth={3} /></button>
                             </div>
                          </div>
                          <div className="h-px bg-slate-200 w-full opacity-50"></div>
                          <div className="flex items-center justify-between px-1">
                             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">MAPA</span>
                             <div className="flex gap-2 items-center">
                               <button disabled={!canEdit} onClick={() => handleUpdateLevel(s.id, s.current_level, -1)} className="w-11 h-11 flex items-center justify-center bg-white text-rose-500 rounded-2xl shadow-sm border border-rose-100 active:scale-90"><Minus size={20} strokeWidth={3} /></button>
                               <div className="w-24 h-11 flex items-center justify-center bg-white border border-slate-200 rounded-2xl font-black text-[#0012A6] text-sm">{s.current_level}/10</div>
                               <button disabled={!canEdit} onClick={() => handleUpdateLevel(s.id, s.current_level, 1)} className="w-11 h-11 flex items-center justify-center bg-white text-blue-600 rounded-2xl shadow-sm border border-blue-100 active:scale-90"><Plus size={20} strokeWidth={3} /></button>
                             </div>
                          </div>
                       </div>

                       <div className="flex gap-2 pt-2">
                         <button disabled={!canEdit} onClick={() => handleResetPassword(s)} className="flex-1 bg-amber-50 text-amber-600 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 border border-amber-100 shadow-sm active:scale-95 transition-all"><Key size={16} /> PASSWORD</button>
                         <button disabled={!canEdit} onClick={() => handleDelete(s.id)} className="w-14 h-14 flex items-center justify-center bg-rose-50 text-rose-500 rounded-2xl border border-rose-100 shadow-sm active:scale-95 transition-all"><Trash2 size={20} /></button>
                         {isMaster && (
                           <button disabled={s.id === profile?.id} onClick={() => handleUpdateRole(s.id, s.role)} className="w-14 h-14 flex items-center justify-center bg-[#0012A6] text-white rounded-2xl shadow-lg active:scale-95 transition-all" title={s.role === 'admin' ? 'Revocar Admin' : 'Hacer Admin'}><Shield size={20} /></button>
                         )}
                       </div>
                     </div>
                   );
                 })}
               </div>
            </div>

            {/* PAGINACIÓN */}
            {totalPages > 1 && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex items-center justify-between gap-4">
                <p className="text-xs font-black text-slate-400">
                  Mostrando <span className="text-slate-700">{currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, totalCount)}</span> de <span className="text-slate-700">{totalCount}</span> registros
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                    disabled={currentPage === 0 || loading}
                    className="w-9 h-9 flex items-center justify-center bg-slate-100 text-slate-500 rounded-xl hover:bg-[#0012A6] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const page = Math.min(Math.max(currentPage - 2, 0) + i, totalPages - 1);
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-9 h-9 rounded-xl font-black text-xs transition-all ${
                          page === currentPage
                            ? 'bg-[#0012A6] text-white shadow-lg'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {page + 1}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={currentPage >= totalPages - 1 || loading}
                    className="w-9 h-9 flex items-center justify-center bg-slate-100 text-slate-500 rounded-xl hover:bg-[#0012A6] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'actividades' && (
          <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
               <h2 className="text-xl font-black flex items-center gap-2"><Star className="text-amber-500" /> GESTIÓN DE ACTIVIDADES</h2>
               <button onClick={() => setEditingActivity({ title: '', pts: 0, lugar: 'Campus' })} className="bg-[#0012A6] text-white px-6 py-3 rounded-2xl text-xs font-black shadow-md flex items-center gap-2 transition-all active:translate-y-1"><Plus size={16} /> NUEVA ACTIVIDAD</button>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {activities.map(act => (
                 <div key={act.id} className="bg-slate-50 p-6 rounded-[28px] border border-slate-200 flex flex-col h-full">
                    <div className="flex justify-between mb-2"><span className="text-[10px] font-black text-slate-400 uppercase">ID: {act.id}</span><span className="text-amber-600 font-black text-sm">{act.pts} PTS</span></div>
                    <h3 className="text-lg font-black text-slate-800 mb-2">{act.title}</h3>
                    <div className="mb-4 space-y-1">
                      {act.lugar && <p className="text-[10px] font-bold text-slate-500 uppercase mt-2">Lugar: <span className="font-normal text-slate-400">{act.lugar}</span></p>}
                    </div>
                    <div className="flex gap-2 mt-auto">
                      <button onClick={() => setEditingActivity(act)} className="flex-1 bg-white border border-slate-200 py-3 rounded-xl font-black text-xs hover:border-[#0012A6] transition-all">EDITAR</button>
                      <button onClick={() => setQrModalActivity(act)} className="w-12 flex items-center justify-center bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-all"><QrCode size={18} /></button>
                    </div>
                 </div>
               ))}
            </div>
          </div>
        )}

        {activeTab === 'niveles' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex justify-between items-center">
               <div><h2 className="text-xl font-black">Escalafón de Niveles</h2><p className="text-slate-400 text-xs font-bold">Configura XP y premios.</p></div>
               <button onClick={() => setEditingLevel({ level: levels.length + 1, min_xp: 0, reward: '' })} className="bg-[#0012A6] text-white px-6 py-4 rounded-2xl font-black text-xs flex items-center gap-2 shadow-md active:translate-y-1"><Plus size={16} /> AGREGAR NIVEL</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {levels.map(lvl => (
                 <div key={lvl.id} className="bg-white p-6 rounded-[32px] border border-slate-200 relative group transition-all hover:border-[#0012A6]/30">
                    <div className="flex justify-between items-start mb-4">
                       <div className="w-12 h-12 bg-blue-50 text-[#0012A6] rounded-2xl flex items-center justify-center font-black text-xl">{lvl.level}</div>
                       <div className="flex gap-1">
                          <button onClick={() => setEditingLevel(lvl)} className="p-2 bg-slate-50 text-slate-400 hover:text-[#0012A6] rounded-lg transition-colors"><Shield size={16} /></button>
                          <button onClick={() => handleDeleteLevel(lvl.id)} className="p-2 bg-slate-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"><Trash2 size={16} /></button>
                       </div>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">RECOMPENSA</p>
                    <p className="font-black text-slate-800 mb-4">{lvl.reward || 'S/N'}</p>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><p className="text-[10px] font-black text-slate-400 uppercase mb-1">XP MÍNIMO</p><p className="text-2xl font-black text-[#0012A6]">{lvl.min_xp.toLocaleString()} <span className="text-xs text-blue-300">PTS</span></p></div>
                 </div>
               ))}
            </div>
          </div>
        )}

        {/* MODALS SECTION */}
        {editingActivity && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setEditingActivity(null)} />
             <div className="relative bg-white w-full max-w-2xl rounded-[40px] shadow-2xl p-8 overflow-hidden animate-in zoom-in duration-200">
                <h2 className="text-2xl font-black mb-6">EDITAR ACTIVIDAD</h2>
                <form onSubmit={handleSaveActivity} className="space-y-4">
                   <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                         <label className="text-[10px] font-black text-slate-400 ml-2">TÍTULO</label>
                         <input type="text" className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-bold outline-none focus:border-[#0012A6]" value={editingActivity.title || ''} onChange={e => setEditingActivity({...editingActivity, title: e.target.value})} />
                      </div>
                      <div>
                         <label className="text-[10px] font-black text-slate-400 ml-2">XP</label>
                         <input type="number" className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-bold outline-none focus:border-[#0012A6]" value={editingActivity.pts || 0} onChange={e => setEditingActivity({...editingActivity, pts: parseInt(e.target.value)})} />
                      </div>
                      <div>
                         <label className="text-[10px] font-black text-slate-400 ml-2">LUGAR</label>
                         <input type="text" className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-bold outline-none focus:border-[#0012A6]" value={editingActivity.lugar || ''} onChange={e => setEditingActivity({...editingActivity, lugar: e.target.value})} />
                      </div>
                   </div>
                   <div className="flex gap-3 pt-4">
                      <button type="button" onClick={() => setEditingActivity(null)} className="flex-1 bg-slate-100 py-4 rounded-2xl font-black text-slate-500">CANCELAR</button>
                      <button type="submit" className="flex-[2] bg-[#0012A6] text-white py-4 rounded-2xl font-black shadow-lg">GUARDAR CAMBIOS</button>
                   </div>
                </form>
             </div>
          </div>
        )}

        {editingLevel && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setEditingLevel(null)} />
             <div className="relative bg-white w-full max-w-md rounded-[40px] shadow-2xl p-8 animate-in zoom-in duration-200">
                <h2 className="text-2xl font-black mb-6">CONFIGURAR NIVEL</h2>
                <form onSubmit={handleSaveLevel} className="space-y-4">
                   <div className="grid grid-cols-2 gap-4">
                      <div><label className="text-[10px] font-black text-slate-400 ml-2">NIVEL #</label><input type="number" className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-black outline-none focus:border-[#0012A6]" value={editingLevel.level} onChange={e => setEditingLevel({...editingLevel, level: parseInt(e.target.value)})} /></div>
                      <div><label className="text-[10px] font-black text-slate-400 ml-2">XP MÍNIMO</label><input type="number" className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-black outline-none focus:border-[#0012A6]" value={editingLevel.min_xp} onChange={e => setEditingLevel({...editingLevel, min_xp: parseInt(e.target.value)})} /></div>
                   </div>
                   <div><label className="text-[10px] font-black text-slate-400 ml-2">RECOMPENSA</label><input type="text" className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-black outline-none focus:border-[#0012A6]" value={editingLevel.reward || ''} onChange={e => setEditingLevel({...editingLevel, reward: e.target.value})} /></div>
                   <div className="flex gap-3 pt-4">
                      <button type="button" onClick={() => setEditingLevel(null)} className="flex-1 bg-slate-100 py-4 rounded-2xl font-black text-slate-500">CANCELAR</button>
                      <button type="submit" className="flex-[2] bg-[#0012A6] text-white py-4 rounded-2xl font-black shadow-lg">GUARDAR NIVEL</button>
                   </div>
                </form>
             </div>
          </div>
        )}

        {qrModalActivity && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setQrModalActivity(null)} />
             <div className="relative bg-white w-full max-w-sm rounded-[40px] shadow-2xl p-8 text-center animate-in zoom-in duration-200">
                <h3 className="text-xl font-black text-slate-800 mb-4">{qrModalActivity.title}</h3>
                <div className="bg-slate-50 p-4 rounded-[32px] inline-block mb-6 border-4 border-white shadow-inner"><QRCodeSVG value={qrModalActivity.qr_token || ''} size={200} /></div>
                <p className="text-slate-400 text-xs font-bold mb-6">Muestra este código para que los estudiantes sumen puntos.</p>
                <button onClick={() => setQrModalActivity(null)} className="w-full bg-[#0012A6] text-white py-4 rounded-2xl font-black shadow-lg">CERRAR</button>
             </div>
          </div>
        )}

        {resetResult && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
             <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onClick={() => setResetResult(null)} />
             <div className="relative bg-white w-full max-w-sm rounded-[40px] shadow-2xl p-8 text-center animate-in zoom-in duration-200">
                <div className="bg-emerald-50 text-emerald-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-lg"><Key size={32} /></div>
                <h3 className="text-2xl font-black text-slate-800 mb-2">¡Clave Reseteada!</h3>
                <div className="bg-slate-50 p-6 rounded-[32px] mb-6 border-2 border-dashed border-slate-200">
                   <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Nueva Clave Temporal</p>
                   <p className="text-3xl font-black text-[#0012A6] tracking-tight">{resetResult.newPassword}</p>
                </div>
                <button onClick={() => setResetResult(null)} className="w-full bg-[#0012A6] text-white py-4 rounded-2xl font-black shadow-lg">ENTENDIDO, COPIADA</button>
             </div>
          </div>
        )}
      </main>
    </div>
  );
}
