import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { LogOut, Users, ShieldAlert, Star, Trash2, Plus, Minus, UserCheck, Shield, Ban, QrCode, Key } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function AdminDashboard({ session, profile }) {
  const [students, setStudents] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('usuarios'); // 'usuarios' or 'actividades'
  const [editingActivity, setEditingActivity] = useState(null);
  const [qrModalActivity, setQrModalActivity] = useState(null);
  const [resetResult, setResetResult] = useState(null); // { email, newPassword }

  const isMaster = profile?.role === 'master';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchStudents(), fetchActivities()]);
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
      console.error("Error cargando actividades", err);
    }
  };

  const fetchStudents = async () => {
    try {
      setLoading(true);
      // Fetch everybody, we'll disable UI based on roles
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('xp_total', { ascending: false });
        
      if (error) throw error;
      setStudents(data);
    } catch (err) {
      console.error("Error cargando estudiantes", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'activo' ? 'suspendido' : 'activo';
    try {
      const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('id', id);
      if (error) throw error;
      fetchStudents();
    } catch (err) {
      alert("Error al actualizar estado");
    }
  };

  const handleUpdateXP = async (id, currentXP, amount) => {
    const newXP = Math.max(0, currentXP + amount);
    
    // Thresholds: 1000, 3000, 6500, 10000
    let newLevel = 1;
    if (newXP >= 10000) newLevel = 5;
    else if (newXP >= 6500) newLevel = 4;
    else if (newXP >= 3000) newLevel = 3;
    else if (newXP >= 1000) newLevel = 2;

    try {
      const { error } = await supabase.from('profiles').update({ xp_total: newXP, current_level: newLevel }).eq('id', id);
      if (error) throw error;
      fetchStudents();
    } catch (err) {
      alert("Error al actualizar XP");
    }
  };

  const handleDelete = async (id) => {
    if(!window.confirm("¿Estás seguro de eliminar este registro permanentemente? Esta acción borrará la cuenta de autenticación y los datos del perfil.")) return;
    try {
      // Llamamos a la función RPC que elimina tanto de Auth como de Profiles
      const { error } = await supabase.rpc('delete_user_permanently', { 
        target_user_id: id 
      });
      
      if (error) throw error;
      fetchStudents();
    } catch (err) {
      console.error(err);
      alert("Error al eliminar el usuario: " + (err.message || "Error desconocido"));
    }
  };

  const handleUpdateRole = async (id, currentRole) => {
    const newRole = currentRole === 'admin' ? 'student' : 'admin';
    try {
      const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', id);
      if (error) throw error;
      fetchStudents();
    } catch (err) {
      alert("Error al cambiar rol");
    }
  };

  const handleResetPassword = async (student) => {
    if (!window.confirm(`¿Estás seguro de resetear la contraseña de ${student.full_name}? Se generará una clave temporal.`)) return;
    
    // Generate a secure temporary password
    const tempPassword = `Cato${Math.floor(1000 + Math.random() * 9000)}!`;
    
    try {
      const { data, error } = await supabase.rpc('reset_user_password', { 
        target_user_id: student.id, 
        new_password: tempPassword 
      });

      if (error) throw error;
      
      setResetResult({
        name: student.full_name,
        email: student.email,
        newPassword: tempPassword
      });
    } catch (err) {
      console.error(err);
      alert(`Error al resetear contraseña: ${err.message || 'Error desconocido'}`);
    }
  };

  const handleResetSemester = async () => {
    if (!window.confirm("¡ATENCIÓN! Esta acción restablecerá el XP y Nivel de TODOS los estudiantes a cero para iniciar el nuevo semestre. ¿Deseas continuar?")) return;
    
    try {
      setLoading(true);
      const { error } = await supabase
        .from('profiles')
        .update({ xp_total: 0, current_level: 1 })
        .eq('role', 'student');
        
      if (error) throw error;
      alert("Semestre reiniciado con éxito.");
      fetchStudents();
    } catch (err) {
      console.error(err);
      alert("Error al reiniciar el semestre.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveActivity = async (e) => {
    e.preventDefault();
    try {
      let activityToSave = { ...editingActivity };
      
      // If no ID, it's a new activity, find the next one
      if (!activityToSave.id) {
        const nextId = (activities.length > 0 ? Math.max(...activities.map(a => a.id)) + 1 : 1);
        activityToSave.id = nextId;
      }

      // Ensure QR Token exists
      if (!activityToSave.qr_token) {
        activityToSave.qr_token = `QUEST_${activityToSave.id}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      }

      const { error } = await supabase
        .from('activities')
        .upsert(activityToSave);
      
      if (error) throw error;
      setEditingActivity(null);
      fetchActivities();
      alert("¡Actividad guardada con éxito!");
    } catch (err) {
      console.error(err);
      alert("Error al guardar actividad. Asegúrate de que la tabla 'activities' existe.");
    }
  };

  // Stats
  const totalUsers = students.length;
  const suspendedUsers = students.filter(s => s.status === 'suspendido').length;
  const adminUsers = students.filter(s => s.role === 'admin' || s.role === 'master').length;

  // Current Partial Logic
  const isSecondPartial = new Date().getMonth() >= 6;
  const currentPartialLabel = isSecondPartial ? 'SEGUNDO PARCIAL (P2)' : 'PRIMER PARCIAL (P1)';

  return (
    <div className="min-h-screen bg-[#F0F4FA] font-['Outfit'] pb-12">
      {/* HEADER */}
      <header className="bg-[#0012A6] text-white p-6 shadow-xl flex justify-between items-center relative z-10 sticky top-0">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white rounded-full p-1 flex items-center justify-center shadow-md">
             <img 
               src="https://raw.githubusercontent.com/Gael04-web/assets-web/4d78ca7b26809e93fe82d22386a538ee428eb9ff/logo_SER-removebg-preview.png" 
               alt="Logo SER" 
               className="w-full h-full object-contain" 
             />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight leading-tight">INDEPENDIENTES ECONOMÍA</h1>
            <div className="flex items-center gap-2">
               <p className="text-blue-200 text-[10px] font-bold opacity-80 uppercase tracking-widest bg-white/10 px-2 py-0.5 rounded-md">
                 Panel {isMaster ? 'Master' : 'Administrativo'}
               </p>
               <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
               <p className="text-emerald-300 text-[10px] font-black uppercase tracking-tighter">{currentPartialLabel}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isMaster && (
            <button 
              onClick={handleResetSemester}
              className="bg-white text-[#0012A6] hover:bg-rose-50 hover:text-rose-600 px-5 py-3 rounded-2xl text-xs font-black transition-all border-b-4 border-slate-200 active:border-b-0 active:translate-y-1"
            >
              REINICIAR SEMESTRE
            </button>
          )}
          <button 
            onClick={() => supabase.auth.signOut()}
            className="flex items-center gap-2 bg-white/10 hover:bg-rose-500/80 px-5 py-3 rounded-2xl text-sm font-bold transition-colors"
          >
            <LogOut size={18} /> Cerrar Sesión
          </button>
        </div>
      </header>

      <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        
        {/* TABS SELECTOR */}
        <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 w-fit">
           <button 
             onClick={() => setActiveTab('usuarios')}
             className={`px-6 py-2.5 rounded-xl font-black text-sm transition-all ${activeTab === 'usuarios' ? 'bg-[#0012A6] text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
           >
             USUARIOS
           </button>
           <button 
             onClick={() => setActiveTab('actividades')}
             className={`px-6 py-2.5 rounded-xl font-black text-sm transition-all ${activeTab === 'actividades' ? 'bg-[#0012A6] text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
           >
             ACTIVIDADES
           </button>
        </div>

        {activeTab === 'usuarios' ? (
          <>
            {/* ANALYTICS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex items-center gap-5">
            <div className="w-16 h-16 bg-blue-50 text-[#0012A6] rounded-2xl flex items-center justify-center">
              <Users size={28} />
            </div>
            <div>
              <p className="text-slate-400 font-bold text-sm">TOTAL REGISTROS</p>
              <h3 className="text-3xl font-black text-slate-800">{totalUsers}</h3>
            </div>
          </div>
          
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex items-center gap-5">
            <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center">
              <Ban size={28} />
            </div>
            <div>
              <p className="text-slate-400 font-bold text-sm">SUSPENDIDOS</p>
              <h3 className="text-3xl font-black text-slate-800">{suspendedUsers}</h3>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex items-center gap-5">
            <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center">
              <Shield size={28} />
            </div>
            <div>
              <p className="text-slate-400 font-bold text-sm">EQUIPO ADMIN</p>
              <h3 className="text-3xl font-black text-slate-800">{adminUsers}</h3>
            </div>
          </div>
        </div>

        {/* DATA TABLE */}
        <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center gap-3">
             <ShieldAlert className="text-[#0012A6]" size={24} />
             <h2 className="text-2xl font-black text-slate-800">Directorio de Estudiantes</h2>
          </div>
          
          <div className="overflow-x-auto p-2">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="text-slate-400 text-sm">
                  <th className="px-6 py-4 font-bold uppercase tracking-wider">Usuario</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider">Progreso</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider">Estado</th>
                  {isMaster && <th className="px-6 py-4 font-bold uppercase tracking-wider text-center">Privilegios</th>}
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-right">Administrar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {students.map((student) => {
                  // Admin logic: Regular admin can't touch another admin/master.
                  const isTouchForbidden = !isMaster && (student.role === 'admin' || student.role === 'master');
                  const isSelf = student.id === profile?.id;
                  const canEdit = !isSelf && !isTouchForbidden;

                  return (
                    <tr key={student.id} className="hover:bg-slate-50/50 transition-colors group">
                      
                      {/* USUARIO */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-black">
                            {student.full_name ? student.full_name.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div>
                            <p className="font-black text-slate-800 flex items-center gap-2">
                              {student.full_name || 'Sin Nombre'}
                              {student.role === 'master' && <span className="bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider border border-amber-200 shrink-0">Master</span>}
                              {student.role === 'admin' && <span className="bg-blue-100 text-[#0012A6] text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider border border-blue-200 shrink-0">Admin</span>}
                              {isSelf && <span className="text-[10px] text-slate-400 font-normal ml-1">(Tú)</span>}
                            </p>
                            <p className="text-slate-500 text-sm font-medium">{student.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* PROGRESO */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-slate-100 text-slate-700 font-black text-sm border border-slate-200">
                            {student.current_level}
                          </span>
                          <span className="text-sm font-black text-slate-600 flex items-center gap-1 bg-amber-50 px-3 py-1 rounded-full border border-amber-100">
                            <Star size={14} className="text-amber-500 fill-amber-500"/> {student.xp_total} XP
                          </span>
                        </div>
                      </td>

                      {/* ESTADO */}
                      <td className="px-6 py-4">
                        <button 
                          disabled={!canEdit}
                          onClick={() => handleUpdateStatus(student.id, student.status)}
                          className={`px-4 py-1.5 text-xs font-black rounded-full border transition-all ${
                            student.status === 'activo' 
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100' 
                            : 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'
                          } ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {student.status.toUpperCase()}
                        </button>
                      </td>

                      {/* PRIVILEGIOS (Solo Master) */}
                      {isMaster && (
                        <td className="px-6 py-4 text-center">
                          <button 
                            disabled={isSelf || student.role === 'master'}
                            onClick={() => handleUpdateRole(student.id, student.role)}
                            className={`flex items-center justify-center gap-1 mx-auto px-3 py-1.5 rounded-xl font-bold text-xs border transition ${
                              student.role === 'admin' 
                              ? 'bg-amber-100 border-amber-300 text-amber-700 hover:bg-amber-200' 
                              : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'
                            } ${(isSelf || student.role === 'master') ? 'opacity-30 cursor-not-allowed' : ''}`}
                          >
                            {student.role === 'admin' ? <Shield size={14} /> : <UserCheck size={14} />}
                            {student.role === 'admin' ? 'Revocar' : 'Hacer Admin'}
                          </button>
                        </td>
                      )}

                      {/* ADMINISTRAR (XP & Eliminar) */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            disabled={!canEdit}
                            title="Descontar 50 XP (Penalidad)"
                            onClick={() => handleUpdateXP(student.id, student.xp_total, -50)}
                            className={`w-9 h-9 flex items-center justify-center bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition ${!canEdit && 'opacity-30 cursor-not-allowed'}`}
                          >
                            <Minus size={18} strokeWidth={3} />
                          </button>
                          <button 
                            disabled={!canEdit}
                            title="Otorgar 50 XP (Bonificación)"
                            onClick={() => handleUpdateXP(student.id, student.xp_total, 50)}
                            className={`w-9 h-9 flex items-center justify-center bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl transition ${!canEdit && 'opacity-30 cursor-not-allowed'}`}
                          >
                            <Plus size={18} strokeWidth={3} />
                          </button>
                          <div className="w-px h-6 bg-slate-200 mx-1"></div>
                          <button 
                            disabled={!canEdit || isSelf || student.role === 'master'}
                            onClick={() => handleResetPassword(student)}
                            className={`w-9 h-9 flex items-center justify-center border border-slate-200 rounded-xl transition-all ${(isSelf || student.role === 'master') ? 'opacity-20 bg-slate-100 cursor-not-allowed' : 'bg-white hover:bg-amber-50 hover:border-amber-400 hover:text-amber-600'}`}
                            title="Resetear Contraseña a clave temporal"
                          >
                            <Key size={16} />
                          </button>
                          <button 
                            disabled={!canEdit}
                            title="Eliminar Perfil"
                            onClick={() => handleDelete(student.id)}
                            className={`w-9 h-9 flex items-center justify-center hover:bg-rose-600 text-slate-300 hover:text-white rounded-xl transition ${!canEdit && 'opacity-30 cursor-not-allowed'}`}
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })}
                {students.length === 0 && !loading && (
                   <tr>
                     <td colSpan={6} className="p-12 text-center text-slate-400 font-bold">
                       Aún no hay perfiles registrados en la base de datos.
                     </td>
                   </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </>
    ) : (
          /* ACTIVITIES MANAGEMENT */
          <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
               <div className="flex items-center gap-3">
                 <Star className="text-amber-500" size={24} />
                 <h2 className="text-2xl font-black text-slate-800">Gestión de Actividades</h2>
               </div>
               <button 
                 onClick={() => setEditingActivity({ title: '', pts: 0, p1: '', f1: '', p2: '', f2: '', lugar: 'Campus', hora: 'TBA' })}
                 className="bg-[#0012A6] text-white px-6 py-3 rounded-2xl text-xs font-black shadow-[0_4px_0_0_#000B66] active:translate-y-1 active:shadow-none transition-all flex items-center gap-2"
               >
                 <Plus size={16} strokeWidth={3} /> NUEVA ACTIVIDAD
               </button>
            </div>

            <div className="overflow-x-auto p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {activities.map((act) => (
                   <div key={act.id} className="bg-slate-50 rounded-[28px] p-6 border border-slate-200 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-4">
                           <span className="bg-[#0012A6] text-white px-3 py-1 rounded-full text-[10px] font-black">ID: {act.id}</span>
                           <span className="text-amber-600 font-black text-sm">{act.pts} Puntos</span>
                        </div>
                        <h3 className="text-xl font-black text-slate-800 mb-4">{act.title}</h3>
                        
                        <div className="space-y-3 mb-6">
                           <div className="bg-white p-3 rounded-2xl border border-slate-100">
                              <p className="text-[10px] font-black text-blue-400 uppercase mb-1">P1: {act.p1}</p>
                              <p className="text-xs font-bold text-slate-600">{act.f1}</p>
                           </div>
                           <div className="bg-white p-3 rounded-2xl border border-slate-100">
                              <p className="text-[10px] font-black text-amber-500 uppercase mb-1">P2: {act.p2}</p>
                              <p className="text-xs font-bold text-slate-600">{act.f2}</p>
                           </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button 
                          onClick={() => setEditingActivity(act)}
                          className="flex-[2] bg-white border border-slate-200 hover:border-[#0012A6] hover:text-[#0012A6] py-3 rounded-2xl font-black text-sm transition-all"
                        >
                          EDITAR
                        </button>
                        <button 
                          onClick={() => setQrModalActivity(act)}
                          className="flex-1 bg-amber-500 text-white hover:bg-amber-600 py-3 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2"
                          title="Mostrar código QR para estudiantes"
                        >
                          <QrCode size={18} />
                          QR
                        </button>
                      </div>
                   </div>
                 ))}
              </div>
              {activities.length === 0 && !loading && (
                 <div className="p-12 text-center text-slate-400 font-bold">
                   No se encontraron actividades. Asegúrate de que la tabla 'activities' existe en Supabase.
                 </div>
              )}
            </div>
          </div>
        )}

        {/* EDIT MODAL */}
        {editingActivity && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setEditingActivity(null)} />
             <div className="relative bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="bg-[#0012A6] p-8 text-white">
                   <h2 className="text-3xl font-black italic">EDITAR ACTIVIDAD #{editingActivity.id}</h2>
                   <p className="opacity-70 font-bold uppercase text-xs tracking-widest">Asegúrate de guardar los cambios para aplicarlos a todos los estudiantes.</p>
                </div>
                
                <form onSubmit={handleSaveActivity} className="p-8 space-y-6">
                   <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Título de la Actividad</label>
                        <input 
                          type="text" 
                          className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-bold outline-none focus:border-[#0012A6]"
                          value={editingActivity.title}
                          onChange={e => setEditingActivity({...editingActivity, title: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Puntos (XP)</label>
                        <input 
                          type="number" 
                          className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-bold outline-none focus:border-[#0012A6]"
                          value={editingActivity.pts}
                          onChange={e => setEditingActivity({...editingActivity, pts: parseInt(e.target.value)})}
                        />
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <h4 className="font-black text-blue-600 border-b pb-2">PRIMER PARCIAL</h4>
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Actividad P1</label>
                          <input 
                            type="text" 
                            className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold outline-none focus:border-[#0012A6]"
                            value={editingActivity.p1}
                            onChange={e => setEditingActivity({...editingActivity, p1: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Fecha P1</label>
                          <input 
                            type="text" 
                            className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold outline-none focus:border-[#0012A6]"
                            value={editingActivity.f1}
                            onChange={e => setEditingActivity({...editingActivity, f1: e.target.value})}
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="font-black text-amber-500 border-b pb-2">SEGUNDO PARCIAL</h4>
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Actividad P2</label>
                          <input 
                            type="text" 
                            className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold outline-none focus:border-[#0012A6]"
                            value={editingActivity.p2}
                            onChange={e => setEditingActivity({...editingActivity, p2: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Fecha P2</label>
                          <input 
                            type="text" 
                            className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold outline-none focus:border-[#0012A6]"
                            value={editingActivity.f2}
                            onChange={e => setEditingActivity({...editingActivity, f2: e.target.value})}
                          />
                        </div>
                      </div>
                   </div>

                   <div className="flex gap-4 pt-4">
                      <button 
                        type="button"
                        onClick={() => setEditingActivity(null)}
                        className="flex-1 bg-slate-100 text-slate-500 font-black py-4 rounded-2xl active:scale-95 transition-all"
                      >
                        CANCELAR
                      </button>
                      <button 
                        type="submit"
                        className="flex-[2] bg-[#0012A6] text-white font-black py-4 rounded-2xl shadow-[0_6px_0_0_#000B66] active:translate-y-1 active:shadow-none transition-all"
                      >
                        GUARDAR CAMBIOS
                      </button>
                   </div>
                </form>
             </div>
          </div>
        )}

        {/* QR CODE MODAL */}
        {qrModalActivity && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onClick={() => setQrModalActivity(null)} />
            <div className="relative bg-white w-full max-w-sm rounded-[40px] shadow-2xl p-8 text-center animate-in zoom-in duration-300">
               <div className="bg-amber-50 text-amber-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <QrCode size={32} />
               </div>
               <h3 className="text-2xl font-black text-slate-800 mb-2">{qrModalActivity.title}</h3>
               <p className="text-slate-500 text-sm font-bold mb-6 truncate px-4 bg-slate-100 py-2 rounded-xl border border-slate-200 uppercase tracking-widest">
                  TOKEN: {qrModalActivity.qr_token || 'GENERANDO...'}
               </p>
               
               <div className="bg-white border-8 border-slate-50 p-6 rounded-[32px] inline-block shadow-inner mb-6">
                  <QRCodeSVG value={qrModalActivity.qr_token || ''} size={220} />
               </div>
               
               <p className="text-slate-400 text-xs font-bold leading-relaxed mb-6 px-4">
                  Muestra este código a los estudiantes para que lo escaneen desde su aplicación.
               </p>
               
               <button 
                 onClick={() => setQrModalActivity(null)}
                 className="w-full bg-[#0012A6] text-white font-black py-4 rounded-2xl shadow-[0_4px_0_0_#000B66] active:translate-y-1 active:shadow-none transition-all"
               >
                 CERRAR VENTANA
               </button>
            </div>
          </div>
        )}

        {/* PASSWORD RESET RESULT MODAL */}
        {resetResult && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onClick={() => setResetResult(null)} />
            <div className="relative bg-white w-full max-w-sm rounded-[40px] shadow-2xl p-8 text-center animate-in zoom-in duration-300">
               <div className="bg-emerald-50 text-emerald-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-xl">
                  <Key size={32} />
               </div>
               <h3 className="text-2xl font-black text-slate-800 mb-2">¡Clave Reseteada!</h3>
               <p className="text-slate-500 text-sm font-bold mb-6">
                  La contraseña de <span className="text-slate-800">{resetResult.name}</span> ha sido cambiada.
               </p>
               
               <div className="bg-slate-50 border-2 border-dashed border-slate-200 p-6 rounded-[32px] mb-8">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nueva Clave Temporal</p>
                  <p className="text-3xl font-black text-[#0012A6] tracking-tight">{resetResult.newPassword}</p>
               </div>
               
               <div className="bg-amber-50 p-4 rounded-2xl mb-8 border border-amber-100">
                  <p className="text-amber-700 text-[10px] font-black leading-tight">
                     COPIA ESTA CLAVE Y ENTRÉGALA AL USUARIO. NO PODRÁS VERLA DE NUEVO AL CERRAR ESTA VENTANA.
                  </p>
               </div>
               
               <button 
                 onClick={() => setResetResult(null)}
                 className="w-full bg-[#0012A6] text-white font-black py-4 rounded-2xl shadow-[0_4px_0_0_#000B66] active:translate-y-1 active:shadow-none transition-all"
               >
                 ENTENDIDO, COPIADA
               </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
