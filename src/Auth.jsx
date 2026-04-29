import React, { useState } from 'react';
import { supabase } from './supabase';
import { motion } from 'framer-motion';
import { Mail, Lock, User, ChevronRight, AlertCircle } from 'lucide-react';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        if (!email.toLowerCase().trim().endsWith('@cu.ucsg.edu.ec')) {
          throw new Error('Solo se permiten correos universitarios válidos (@cu.ucsg.edu.ec)');
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName }
          }
        });
        if (error) throw error;
      }
    } catch (err) {
      setError(err.message || 'Error en la autenticación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center bg-slate-900 min-h-screen font-['Outfit'] select-none overflow-hidden">
      <div className="w-full max-w-xl bg-white min-h-screen relative flex flex-col justify-center px-8">
        
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
             <svg className="absolute w-[200%] h-[150%] left-[-50%] top-[-20%]" preserveAspectRatio="none">
               <path d="M0,450 Q400,300 800,450 T1600,450 L1600,2000 L0,2000 Z" fill="#1D4ED8" />
               <path d="M0,650 Q400,500 800,650 T1600,650 L1600,2000 L0,2000 Z" fill="#1E3A8A" />
             </svg>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 w-full max-w-sm mx-auto"
        >
          {/* Logo SER */}
          <div className="w-36 h-36 relative mx-auto mb-6 drop-shadow-xl flex justify-center items-center">
             <img 
               src="https://raw.githubusercontent.com/Gael04-web/assets-web/4d78ca7b26809e93fe82d22386a538ee428eb9ff/logo_SER-removebg-preview.png" 
               alt="Logo SER" 
               className="w-full h-full object-contain" 
             />
          </div>

          <div className="text-center mb-10">
            <h1 className="text-4xl font-black text-white italic tracking-tighter mb-2">
               INDEPENDIENTES <span className="text-[#FFD233]">ECONOMÍA</span>
            </h1>
            <p className="text-blue-200 font-medium">
              {isLogin ? 'Inicia sesión para continuar.' : 'Únete y descubre tu potencial.'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            
            {error && (
               <div className="bg-red-500/20 border border-red-500/50 p-3 flex rounded-2xl items-center gap-3 text-red-100 text-sm font-bold">
                 <AlertCircle size={18} />
                 <p>{error}</p>
               </div>
            )}

            {!isLogin && (
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                  type="text" 
                  required
                  placeholder="Nombre y Apellido"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 text-white placeholder:text-slate-400 pl-12 pr-4 py-4 rounded-2xl outline-none focus:border-[#FFD233] transition-colors"
                />
              </div>
            )}

            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input 
                type="email" 
                required
                placeholder="Correo Institucional"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-white/10 border border-white/20 text-white placeholder:text-slate-400 pl-12 pr-4 py-4 rounded-2xl outline-none focus:border-[#FFD233] transition-colors"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input 
                type="password" 
                required
                placeholder="Contraseña"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-white/10 border border-white/20 text-white placeholder:text-slate-400 pl-12 pr-4 py-4 rounded-2xl outline-none focus:border-[#FFD233] transition-colors"
              />
            </div>

            <button 
              disabled={loading}
              type="submit"
              className="w-full bg-[#FFD233] text-[#0D1B2A] font-black py-4 rounded-2xl text-lg mt-6 shadow-[0_6px_0_0_#B48600] active:translate-y-1 active:shadow-none transition-all flex justify-center items-center gap-2"
            >
              {loading ? 'Cargando...' : isLogin ? 'ENTRAR' : 'REGISTRARSE'}
              {!loading && <ChevronRight size={22} strokeWidth={3} />}
            </button>
          </form>

          <p className="text-center mt-8 text-slate-400 font-medium">
            {isLogin ? '¿No tienes una cuenta?' : '¿Ya tienes una cuenta?'}
            <button 
               type="button"
               onClick={() => setIsLogin(!isLogin)}
               className="ml-2 text-white font-bold underline decoration-[#FFD233] decoration-2 underline-offset-4"
            >
              {isLogin ? 'Regístrate aquí' : 'Inicia Sesión'}
            </button>
          </p>

        </motion.div>
      </div>
    </div>
  );
}
