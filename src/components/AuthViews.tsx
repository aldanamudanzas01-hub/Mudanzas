import React, { useState } from 'react';
import {
  ShieldCheck,
  UserCheck,
  Lock,
  User,
  Eye,
  EyeOff,
  LogIn,
  Plus,
  Trash2,
  X,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  Truck,
} from 'lucide-react';
import type { SystemUser, UserRole } from '../types.ts';
import {
  authenticateSystemUser,
  validateNewSystemUser,
} from '../utils/finance.ts';

interface LoginScreenProps {
  users: SystemUser[];
  onLoginSuccess: (authenticatedUser: SystemUser) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  users,
  onLoginSuccess,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const result = authenticateSystemUser(users, username, password);
    if (!result.authenticated || !result.user) {
      setErrorMsg(
        result.error || 'Usuario o contraseña incorrectos. Verifica tus datos.'
      );
      return;
    }

    onLoginSuccess(result.user);
  };

  const handleQuickFill = (targetUser: SystemUser) => {
    setUsername(targetUser.username);
    setPassword(targetUser.password);
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-10">
      {/* Top Identity Bar */}
      <header className="max-w-5xl w-full mx-auto flex items-center justify-between border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-white font-display block leading-none">
              Aldana Mudanzas
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              COLOMBIA · VENEZUELA · ECUADOR · MONEDA COP
            </span>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 font-mono">
          <Lock className="w-3.5 h-3.5 text-amber-400" />
          Acceso Independiente por Rol
        </div>
      </header>

      {/* Main Login Card + Independent Role Credentials */}
      <main className="max-w-5xl w-full mx-auto my-auto py-8 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
        {/* Left Column: Login Form (7 cols on lg) */}
        <section
          aria-label="Formulario de inicio de sesión"
          className="lg:col-span-7 bg-white text-slate-900 rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xl"
        >
          <div className="mb-6">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md">
              <KeyRound className="w-3.5 h-3.5" />
              Control de Acceso Independiente
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-display mt-3">
              Iniciar Sesión en el Sistema
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Ingresa con tu usuario y contraseña asignados según tu perfil (
              <strong className="text-slate-900">Administrador</strong> o{' '}
              <strong className="text-slate-900">Usuario de Inventario</strong>
              ).
            </p>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2.5"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-username"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
              >
                Nombre de Usuario
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="login-username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ej. admin o inventario"
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-900 focus:outline-none font-mono"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
              >
                Contraseña
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ingresa tu contraseña"
                  className="w-full pl-10 pr-11 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-900 focus:outline-none font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={
                    showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 p-1 cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <LogIn className="w-4 h-4" />
                Ingresar con Usuario y Contraseña
              </button>
            </div>
          </form>

          {/* Explanation of the two user roles */}
          <div className="mt-6 pt-5 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                Perfil Administrador
              </div>
              <p className="text-slate-600 mt-1 leading-relaxed">
                Control financiero en COP, estados de cuenta, creación de usuarios y{' '}
                <strong className="text-slate-900">
                  permiso para eliminar clientes
                </strong>
                .
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-blue-600 shrink-0" />
                Perfil Usuario Inventario
              </div>
              <p className="text-slate-600 mt-1 leading-relaxed">
                Levantamiento de inventario, conteo de cajas y{' '}
                <strong className="text-slate-900">
                  evidencia fotográfica con cámara
                </strong>
                . Sin permiso para eliminar clientes.
              </p>
            </div>
          </div>
        </section>

        {/* Right Column: Independent User Accounts Directory for Quick Testing/Access (5 cols on lg) */}
        <section
          aria-label="Cuentas registradas en el sistema"
          className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4"
        >
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-amber-400 font-mono">
              Cuentas Habilitadas ({users.length})
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Cada operador o administrador ingresa con su propio usuario y
              contraseña. Haz clic en una cuenta para autocompletar o escribe
              las credenciales directamente:
            </p>
          </div>

          <div className="space-y-3">
            {users.map((u) => {
              const isAdmin = u.role === 'administrador';
              return (
                <div
                  key={u.id}
                  className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 hover:border-slate-700 transition-colors flex flex-col gap-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        {isAdmin ? (
                          <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        ) : (
                          <UserCheck className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        )}
                        {u.fullName}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Sede: {u.branchCity}
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border shrink-0 ${
                        isAdmin
                          ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                          : 'bg-sky-500/10 text-sky-300 border-sky-500/30'
                      }`}
                    >
                      {isAdmin ? 'ADMINISTRADOR' : 'INVENTARIO'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-slate-900 px-3 py-2 rounded-lg border border-slate-800/80 text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-slate-400 block">
                        USUARIO
                      </span>
                      <span className="text-white font-semibold">
                        {u.username}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">
                        CONTRASEÑA
                      </span>
                      <span className="text-amber-300 font-semibold">
                        {u.password}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <span className="text-[11px] text-slate-400">
                      {isAdmin
                        ? 'Puede eliminar clientes y gestionar usuarios'
                        : 'Solo inventario y cámara (No elimina clientes)'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleQuickFill(u)}
                      aria-label={`Autocompletar credenciales de ${u.username}`}
                      className="px-2.5 py-1 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 transition-colors shrink-0 cursor-pointer"
                    >
                      Usar {u.username}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="max-w-5xl w-full mx-auto pt-4 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
        <span>
          Aldana Mudanzas Control · Corredor Andino (Colombia, Venezuela y Ecuador)
        </span>
        <span className="font-mono">
          Moneda Oficial: Pesos Colombianos ($ COP)
        </span>
      </footer>
    </div>
  );
};

interface UsersManagementModalProps {
  isOpen: boolean;
  users: SystemUser[];
  currentUser: SystemUser;
  onClose: () => void;
  onCreateUser: (newUser: {
    username: string;
    password: string;
    fullName: string;
    role: UserRole;
    branchCity: string;
  }) => void;
  onDeleteUser: (userId: string) => void;
}

export const UsersManagementModal: React.FC<UsersManagementModalProps> = ({
  isOpen,
  users,
  currentUser,
  onClose,
  onCreateUser,
  onDeleteUser,
}) => {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('usuario_inventario');
  const [branchCity, setBranchCity] = useState('Bogotá D.C., Colombia');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const validation = validateNewSystemUser(users, {
      username,
      password,
      fullName,
      role,
      branchCity,
    });

    if (!validation.valid) {
      setErrorMsg(validation.error || 'Datos de usuario inválidos.');
      return;
    }

    onCreateUser({
      username: username.trim().toLowerCase(),
      password: password.trim(),
      fullName: fullName.trim(),
      role,
      branchCity: branchCity.trim(),
    });

    setSuccessMsg(
      `Usuario "${username.trim().toLowerCase()}" creado correctamente. Ya puede iniciar sesión de manera independiente.`
    );
    setFullName('');
    setUsername('');
    setPassword('');
    setRole('usuario_inventario');
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="users-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl my-4">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400 block">
              Seguridad y Accesos · Exclusivo Administrador
            </span>
            <h2 id="users-modal-title" className="text-lg font-bold font-display">
              Gestión de Usuarios y Contraseñas Independientes
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar gestión de usuarios"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
          {/* Create New User Form */}
          <form
            onSubmit={handleCreate}
            className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-slate-700" />
                Registrar Nuevo Usuario con Contraseña
              </h3>
              <span className="text-[11px] font-mono text-slate-500">
                Ingreso Independiente
              </span>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700 flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div
                role="status"
                className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800 flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{successMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label
                  htmlFor="new-user-fullname"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Nombre Completo del Operador / Admin *
                </label>
                <input
                  id="new-user-fullname"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ej. Camilo Vargas (Inspector Cali)"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="new-user-branch"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Sede Principal (Colombia / Venezuela / Ecuador) *
                </label>
                <select
                  id="new-user-branch"
                  value={branchCity}
                  onChange={(e) => setBranchCity(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:border-slate-900 focus:outline-none"
                >
                  <option value="Bogotá D.C., Colombia">Bogotá D.C., Colombia</option>
                  <option value="Medellín, Colombia">Medellín, Colombia</option>
                  <option value="Cali, Colombia">Cali, Colombia</option>
                  <option value="Barranquilla, Colombia">Barranquilla, Colombia</option>
                  <option value="Cúcuta, Colombia">Cúcuta, Colombia</option>
                  <option value="Caracas, Venezuela">Caracas, Venezuela</option>
                  <option value="San Cristóbal, Venezuela">San Cristóbal, Venezuela</option>
                  <option value="Quito, Ecuador">Quito, Ecuador</option>
                  <option value="Guayaquil, Ecuador">Guayaquil, Ecuador</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="new-user-username"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Usuario para Iniciar Sesión *
                </label>
                <input
                  id="new-user-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ej. inventario_cali"
                  className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="new-user-password"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Contraseña Asignada *
                </label>
                <input
                  id="new-user-password"
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ej. Cali2026*"
                  className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="new-user-role"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Rol y Nivel de Permisos *
                </label>
                <select
                  id="new-user-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:border-slate-900 focus:outline-none"
                >
                  <option value="usuario_inventario">
                    Usuario de Inventario (Levanta inventario y fotos con cámara · NO puede eliminar clientes)
                  </option>
                  <option value="administrador">
                    Administrador (Control total · SÍ puede eliminar clientes creados y gestionar finanzas)
                  </option>
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Crear Usuario con Contraseña
              </button>
            </div>
          </form>

          {/* Registered Users Table */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Usuarios Registrados ({users.length})
            </h3>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                    <th className="py-2.5 px-3">Nombre y Sede</th>
                    <th className="py-2.5 px-3">Usuario</th>
                    <th className="py-2.5 px-3">Contraseña</th>
                    <th className="py-2.5 px-3">Rol / Permiso</th>
                    <th className="py-2.5 px-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {users.map((u) => {
                    const isAdmin = u.role === 'administrador';
                    const isSelf = u.id === currentUser.id;
                    const isPrimaryAdmin = u.username === 'admin';
                    return (
                      <tr key={u.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-900">
                            {u.fullName}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {u.branchCity}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">
                          {u.username}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-700">
                          {u.password}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                              isAdmin
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-blue-50 text-blue-800 border border-blue-200'
                            }`}
                          >
                            {isAdmin ? (
                              <ShieldCheck className="w-3 h-3" />
                            ) : (
                              <UserCheck className="w-3 h-3" />
                            )}
                            {isAdmin
                              ? 'Administrador (Elimina clientes)'
                              : 'Usuario Inventario (No elimina)'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {isPrimaryAdmin || isSelf ? (
                            <span className="text-[11px] text-slate-400 font-mono">
                              {isSelf ? 'Sesión actual' : 'Base'}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onDeleteUser(u.id)}
                              aria-label={`Eliminar usuario ${u.username}`}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded-md cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Eliminar
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
