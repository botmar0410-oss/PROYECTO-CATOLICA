import React, { useState } from 'react';
import { supabase } from './supabase';
import { motion } from 'framer-motion';
import { Mail, Lock, User, ChevronRight, AlertCircle, GraduationCap, Hash, Calendar } from 'lucide-react';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [carrera, setCarrera] = useState('');
  const [ciclo, setCiclo] = useState('');
  const [edad, setEdad] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showForgotMessage, setShowForgotMessage] = useState(false);
  const [showCarreraDropdown, setShowCarreraDropdown] = useState(false);

  const carreras = [
    "Negocios internacionales",
    "Contabilidad y Auditoría",
    "Administración de empresa",
    "Economía"
  ];

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
        if (!carrera) {
          throw new Error('Por favor selecciona tu carrera');
        }
        if (!acceptedTerms) {
          throw new Error('Debes aceptar los Términos y Protección de Datos para registrarte');
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { 
              full_name: fullName,
              carrera: carrera,
              ciclo: ciclo,
              edad: edad
            }
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

            {!isLogin && (
              <div className="grid grid-cols-1 gap-4">
                <div className="relative">
                  <div 
                    onClick={() => setShowCarreraDropdown(!showCarreraDropdown)}
                    className="w-full bg-white/10 border border-white/20 text-white pl-12 pr-4 py-4 rounded-2xl outline-none focus:border-[#FFD233] transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <span className={carrera ? "text-white font-bold" : "text-slate-400"}>
                      {carrera || "Selecciona tu carrera"}
                    </span>
                    <ChevronRight size={18} className={`transition-transform ${showCarreraDropdown ? 'rotate-90' : ''}`} />
                  </div>

                  {showCarreraDropdown && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 5 }}
                      className="absolute top-full left-0 right-0 z-50 bg-[#1E3A8A]/90 backdrop-blur-xl border border-white/20 rounded-2xl overflow-hidden shadow-2xl"
                    >
                      {carreras.map((c, idx) => (
                        <div 
                          key={idx}
                          onClick={() => {
                            setCarrera(c);
                            setShowCarreraDropdown(false);
                          }}
                          className="p-4 hover:bg-white/10 text-white text-sm font-bold cursor-pointer transition-colors border-b border-white/5 last:border-none"
                        >
                          {c}
                        </div>
                      ))}
                    </motion.div>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative">
                    <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input 
                      type="text" 
                      required
                      placeholder="Ciclo"
                      value={ciclo}
                      onChange={e => setCiclo(e.target.value)}
                      className="w-full bg-white/10 border border-white/20 text-white placeholder:text-slate-400 pl-12 pr-4 py-4 rounded-2xl outline-none focus:border-[#FFD233] transition-colors"
                    />
                  </div>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input 
                      type="number" 
                      required
                      placeholder="Edad"
                      value={edad}
                      onChange={e => setEdad(e.target.value)}
                      className="w-full bg-white/10 border border-white/20 text-white placeholder:text-slate-400 pl-12 pr-4 py-4 rounded-2xl outline-none focus:border-[#FFD233] transition-colors"
                    />
                  </div>
                </div>
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

            {isLogin && (
              <div className="flex justify-end px-1">
                <button 
                  type="button"
                  onClick={() => setShowForgotMessage(true)}
                  className="text-blue-300 text-xs font-bold hover:text-[#FFD233] transition-colors underline underline-offset-4 decoration-blue-300/30"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            )}

            {!isLogin && (
              <div className="flex items-start gap-3 px-1 py-2">
                <div className="relative flex items-center h-5">
                  <input
                    id="terms"
                    type="checkbox"
                    required
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="w-5 h-5 rounded border-white/20 bg-white/10 text-[#FFD233] focus:ring-[#FFD233] transition-all cursor-pointer"
                  />
                </div>
                <label htmlFor="terms" className="text-xs text-slate-300 leading-tight cursor-pointer">
                  <span className="font-bold text-white block mb-1">
                    Términos y Protección de Datos <span className="text-red-500">*</span>
                  </span>
                  Al usar esta plataforma, autorizas el registro y tratamiento básico de tus datos únicamente para la gestión de actividades, beneficios y dinámicas de IECON. Tu información no será vendida ni compartida con terceros ajenos a la agrupación.
                </label>
              </div>
            )}

            <button 
              disabled={loading || (!isLogin && !acceptedTerms)}
              type="submit"
              className={`w-full font-black py-4 rounded-2xl text-lg mt-6 shadow-[0_6px_0_0_#B48600] active:translate-y-1 active:shadow-none transition-all flex justify-center items-center gap-2 ${
                loading || (!isLogin && !acceptedTerms) 
                ? 'bg-slate-700 text-slate-500 shadow-none translate-y-1 opacity-50 cursor-not-allowed' 
                : 'bg-[#FFD233] text-[#0D1B2A]'
              }`}
            >
              {loading ? 'Cargando...' : isLogin ? 'ENTRAR' : 'REGISTRARSE'}
              {!loading && <ChevronRight size={22} strokeWidth={3} />}
            </button>
          </form>

          <p className="text-center mt-8 text-slate-400 font-medium">
            {isLogin ? '¿No tienes una cuenta?' : '¿Ya tienes una cuenta?'}
            <button 
               type="button"
               onClick={() => {
                 setIsLogin(!isLogin);
                 setAcceptedTerms(false);
                 setError(null);
               }}
               className="ml-2 text-white font-bold underline decoration-[#FFD233] decoration-2 underline-offset-4"
            >
              {isLogin ? 'Regístrate aquí' : 'Inicia Sesión'}
            </button>
          </p>

        </motion.div>
      </div>

      {/* Mensaje de Contraseña Olvidada */}
      {showForgotMessage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-sm rounded-[32px] p-8 shadow-2xl text-center border-t-8 border-[#FFD233]"
          >
            <div className="w-16 h-16 bg-blue-50 text-[#1D4ED8] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Lock size={32} />
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-3">¿Problemas de Acceso?</h3>
            <p className="text-slate-500 font-medium leading-relaxed mb-8">
              Por favor, contacta con un <span className="text-[#1D4ED8] font-bold">administrador de IECON</span> para solicitar el restablecimiento de tu contraseña. Ellos te proporcionarán una clave temporal.
            </p>
            <button 
              onClick={() => setShowForgotMessage(false)}
              className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl active:scale-95 transition-all shadow-lg"
            >
              ENTENDIDO
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
