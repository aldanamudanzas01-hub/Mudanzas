import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  Wallet,
  FileSpreadsheet,
  Plus,
  Cloud,
  LogOut,
  ShieldCheck,
  UserCheck,
  KeyRound,
} from 'lucide-react';
import type {
  MoveRecord,
  OperationalExpense,
  ActiveTab,
  InventoryItem,
  PaymentMethod,
  MoveStatus,
  ExpenseCategory,
  UserRole,
  SystemUser,
} from './types.ts';
import {
  INITIAL_MOVES_SEED,
  INITIAL_EXPENSES_SEED,
  INITIAL_USERS_SEED,
} from './data/seedData.ts';
import { DashboardView } from './components/DashboardView.tsx';
import { ClientsInventoryView } from './components/ClientsInventoryView.tsx';
import { ClientDetailDrawer } from './components/ClientDetailDrawer.tsx';
import { FinancesLedgerView } from './components/FinancesLedgerView.tsx';
import {
  NewMoveModal,
  PaymentModal,
  ExpenseModal,
  DeleteClientModal,
} from './components/Modals.tsx';
import {
  LoginScreen,
  UsersManagementModal,
} from './components/AuthViews.tsx';
import { canDeleteClientRecord } from './utils/finance.ts';
import {
  auth,
  onAuthStateChanged,
  signInWithGoogle,
  signOutUser,
  testFirestoreConnection,
  fetchUserCloudData,
  saveMoveToFirestore,
  deleteMoveFromFirestore,
  updateMoveBalanceInFirestore,
  saveInventoryItemToFirestore,
  updateInventoryItemDamageInFirestore,
  deleteInventoryItemFromFirestore,
  savePaymentToFirestore,
  saveExpenseToFirestore,
  type User,
} from './lib/firebase.ts';

const LOCAL_STORAGE_MOVES_KEY = 'aldana_mudanzas_moves_cop_v4';
const LOCAL_STORAGE_EXPENSES_KEY = 'aldana_mudanzas_expenses_cop_v4';
const LOCAL_STORAGE_USERS_KEY = 'aldana_mudanzas_users_v1';
const LOCAL_STORAGE_SESSION_KEY = 'aldana_mudanzas_session_user_v1';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  const [systemUsers, setSystemUsers] = useState<SystemUser[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Fallback to seed users
    }
    return INITIAL_USERS_SEED;
  });

  const [authenticatedUser, setAuthenticatedUser] = useState<SystemUser | null>(
    () => {
      try {
        if (
          typeof window !== 'undefined' &&
          new URLSearchParams(window.location.search).get('autostart') === '1'
        ) {
          return INITIAL_USERS_SEED[0];
        }
        const saved = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as SystemUser;
          if (parsed && parsed.username && parsed.role) {
            return parsed;
          }
        }
      } catch {
        // Fallback to unauthenticated login screen
      }
      return null;
    }
  );

  const userRole: UserRole = authenticatedUser?.role || 'usuario_inventario';

  const [moves, setMoves] = useState<MoveRecord[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_MOVES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Fallback to seed
    }
    return INITIAL_MOVES_SEED;
  });

  const [expenses, setExpenses] = useState<OperationalExpense[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_EXPENSES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Fallback to seed
    }
    return INITIAL_EXPENSES_SEED;
  });

  // Cloud user state
  const [user, setUser] = useState<User | null>(null);
  const [cloudNotice, setCloudNotice] = useState<string | null>(null);

  // Selected client drawer & modals
  const [selectedMoveId, setSelectedMoveId] = useState<string | null>(null);
  const [drawerInitialTab, setDrawerInitialTab] = useState<
    'inventory' | 'statement'
  >('inventory');
  const [statementViewMoveId, setStatementViewMoveId] = useState<string>(
    INITIAL_MOVES_SEED[0].id
  );
  const [paymentModalMoveId, setPaymentModalMoveId] = useState<string | null>(
    null
  );
  const [deleteModalMoveId, setDeleteModalMoveId] = useState<string | null>(
    null
  );
  const [isNewMoveModalOpen, setIsNewMoveModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isUsersModalOpen, setIsUsersModalOpen] = useState(false);

  // Test Firestore connection on boot
  useEffect(() => {
    testFirestoreConnection();
  }, []);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_MOVES_KEY, JSON.stringify(moves));
    } catch {
      // Ignore storage quota errors
    }
  }, [moves]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_EXPENSES_KEY, JSON.stringify(expenses));
    } catch {
      // Ignore storage quota errors
    }
  }, [expenses]);

  useEffect(() => {
    try {
      localStorage.setItem(
        LOCAL_STORAGE_USERS_KEY,
        JSON.stringify(systemUsers)
      );
    } catch {
      // Ignore
    }
  }, [systemUsers]);

  useEffect(() => {
    try {
      if (authenticatedUser) {
        localStorage.setItem(
          LOCAL_STORAGE_SESSION_KEY,
          JSON.stringify(authenticatedUser)
        );
      } else {
        localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
      }
    } catch {
      // Ignore
    }
  }, [authenticatedUser]);

  // Listen to Firebase Auth state and sync with Firestore
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const cloudData = await fetchUserCloudData(currentUser.uid);
          if (cloudData.moves.length > 0) {
            setMoves(cloudData.moves);
            if (cloudData.expenses.length > 0) {
              setExpenses(cloudData.expenses);
            }
          } else {
            for (const m of moves) {
              await saveMoveToFirestore(currentUser.uid, {
                ...m,
                ownerId: currentUser.uid,
              });
            }
            for (const exp of expenses) {
              await saveExpenseToFirestore(currentUser.uid, {
                ...exp,
                ownerId: currentUser.uid,
              });
            }
          }
          setCloudNotice('Sincronizado con Firebase Firestore');
        } catch (err) {
          console.error('Error sincronizando con Firestore:', err);
        }
      } else {
        setCloudNotice(null);
      }
    });
    return () => unsub();
  }, []);

  const handleLoginSuccess = (loggedUser: SystemUser) => {
    setAuthenticatedUser(loggedUser);
  };

  const handleLogoutSystemUser = () => {
    setSelectedMoveId(null);
    setDeleteModalMoveId(null);
    setPaymentModalMoveId(null);
    setIsUsersModalOpen(false);
    setAuthenticatedUser(null);
  };

  const handleCreateSystemUser = (payload: {
    username: string;
    password: string;
    fullName: string;
    role: UserRole;
    branchCity: string;
  }) => {
    const newUser: SystemUser = {
      id: `usr_${Date.now()}`,
      username: payload.username,
      password: payload.password,
      fullName: payload.fullName,
      role: payload.role,
      branchCity: payload.branchCity,
      active: true,
      createdAt: new Date().toISOString(),
    };
    setSystemUsers((prev) => [...prev, newUser]);
  };

  const handleDeleteSystemUser = (userId: string) => {
    setSystemUsers((prev) =>
      prev.filter((u) => u.id !== userId || u.username === 'admin')
    );
  };

  const handleOpenClientDrawer = (
    moveId: string,
    tab: 'inventory' | 'statement' = 'inventory'
  ) => {
    setSelectedMoveId(moveId);
    setDrawerInitialTab(tab);
  };

  const handleCreateMove = async (payload: {
    clientName: string;
    clientPhone: string;
    clientEmail: string;
    originCity: string;
    destinationCity: string;
    moveDate: string;
    truckUnit: string;
    distanceKm: number;
    totalContractAmount: number;
    initialAdvance: number;
    advanceMethod: PaymentMethod;
    notes: string;
    items: {
      name: string;
      category: InventoryItem['category'];
      quantity: number;
      volumeM3: number;
      weightKg: number;
      isFragile: boolean;
      conditionNotes: string;
      hasDamage?: boolean;
      damageNotes?: string;
      evidencePhotoDataUrl?: string;
    }[];
  }) => {
    const nowIso = new Date().toISOString();
    const moveId = `mud_${Date.now()}`;
    const ownerId = user?.uid || 'local_operator';
    const nextNumber = moves.length + 101;
    const folio = `ALD-2026-0${nextNumber}`;

    const inventory: InventoryItem[] = payload.items.map((it, idx) => ({
      id: `inv_${Date.now()}_${idx}`,
      ownerId,
      moveId,
      name: it.name,
      category: it.category,
      quantity: it.quantity,
      volumeM3: it.volumeM3,
      weightKg: it.weightKg,
      isFragile: it.isFragile,
      conditionNotes: it.conditionNotes,
      hasDamage: Boolean(it.hasDamage),
      damageNotes: it.damageNotes || '',
      evidencePhotoDataUrl: it.evidencePhotoDataUrl || '',
      createdAt: nowIso,
      updatedAt: nowIso,
    }));

    const payments =
      payload.initialAdvance > 0
        ? [
            {
              id: `pay_${Date.now()}_1`,
              ownerId,
              moveId,
              amount: payload.initialAdvance,
              date: payload.moveDate,
              method: payload.advanceMethod,
              concept: 'Anticipo inicial de contratación de mudanza',
              reference: `ANT-${nextNumber}`,
              createdAt: nowIso,
              updatedAt: nowIso,
            },
          ]
        : [];

    const status: MoveStatus =
      payload.initialAdvance >= payload.totalContractAmount
        ? 'liquidada'
        : 'programada';

    const newMove: MoveRecord = {
      id: moveId,
      ownerId,
      folio,
      clientName: payload.clientName,
      clientPhone: payload.clientPhone,
      clientEmail: payload.clientEmail,
      originCity: payload.originCity,
      destinationCity: payload.destinationCity,
      moveDate: payload.moveDate,
      status,
      truckUnit: payload.truckUnit,
      distanceKm: payload.distanceKm,
      totalContractAmount: payload.totalContractAmount,
      amountPaid: payload.initialAdvance,
      notes: payload.notes,
      inventory,
      payments,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    setMoves((prev) => [newMove, ...prev]);
    setStatementViewMoveId(newMove.id);

    if (user) {
      await saveMoveToFirestore(user.uid, newMove);
    }
  };

  const handleDeleteMove = async (moveId: string) => {
    if (!canDeleteClientRecord(userRole)) {
      return;
    }

    setMoves((prev) => {
      const remaining = prev.filter((m) => m.id !== moveId);
      if (statementViewMoveId === moveId && remaining.length > 0) {
        setStatementViewMoveId(remaining[0].id);
      }
      return remaining;
    });

    if (selectedMoveId === moveId) {
      setSelectedMoveId(null);
    }

    if (user) {
      await deleteMoveFromFirestore(moveId);
    }
  };

  const handleRegisterPayment = async (
    moveId: string,
    payload: {
      amount: number;
      date: string;
      method: PaymentMethod;
      concept: string;
      reference: string;
    }
  ) => {
    const nowIso = new Date().toISOString();
    const ownerId = user?.uid || 'local_operator';
    const newPayment = {
      id: `pay_${Date.now()}`,
      ownerId,
      moveId,
      amount: payload.amount,
      date: payload.date,
      method: payload.method,
      concept: payload.concept,
      reference: payload.reference,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    let updatedAmountPaid = 0;
    let updatedStatus: MoveStatus = 'en_transito';

    setMoves((prev) =>
      prev.map((m) => {
        if (m.id !== moveId) return m;
        updatedAmountPaid = Math.min(
          m.totalContractAmount,
          Number((m.amountPaid + payload.amount).toFixed(2))
        );
        updatedStatus =
          updatedAmountPaid >= m.totalContractAmount ? 'liquidada' : m.status;
        return {
          ...m,
          amountPaid: updatedAmountPaid,
          status: updatedStatus,
          payments: [...m.payments, newPayment],
          updatedAt: nowIso,
        };
      })
    );

    if (user) {
      await savePaymentToFirestore(user.uid, moveId, newPayment);
      await updateMoveBalanceInFirestore(moveId, updatedAmountPaid, updatedStatus);
    }
  };

  const handleAddInventoryItem = async (
    moveId: string,
    itemData: Omit<
      InventoryItem,
      'id' | 'ownerId' | 'moveId' | 'createdAt' | 'updatedAt'
    >
  ) => {
    const nowIso = new Date().toISOString();
    const ownerId = user?.uid || 'local_operator';
    const newItem: InventoryItem = {
      id: `inv_${Date.now()}`,
      ownerId,
      moveId,
      ...itemData,
      hasDamage: Boolean(itemData.hasDamage),
      damageNotes: itemData.damageNotes || '',
      evidencePhotoDataUrl: itemData.evidencePhotoDataUrl || '',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    setMoves((prev) =>
      prev.map((m) =>
        m.id === moveId
          ? { ...m, inventory: [...m.inventory, newItem], updatedAt: nowIso }
          : m
      )
    );

    if (user) {
      await saveInventoryItemToFirestore(user.uid, moveId, newItem);
    }
  };

  const handleUpdateInventoryItemDamage = async (
    moveId: string,
    itemId: string,
    payload: {
      hasDamage: boolean;
      damageNotes: string;
      evidencePhotoDataUrl: string;
    }
  ) => {
    const nowIso = new Date().toISOString();
    setMoves((prev) =>
      prev.map((m) => {
        if (m.id !== moveId) return m;
        return {
          ...m,
          updatedAt: nowIso,
          inventory: m.inventory.map((it) =>
            it.id === itemId
              ? {
                  ...it,
                  hasDamage: payload.hasDamage,
                  damageNotes: payload.damageNotes,
                  evidencePhotoDataUrl: payload.evidencePhotoDataUrl,
                  updatedAt: nowIso,
                }
              : it
          ),
        };
      })
    );

    if (user) {
      await updateInventoryItemDamageInFirestore(moveId, itemId, payload);
    }
  };

  const handleRemoveInventoryItem = async (moveId: string, itemId: string) => {
    setMoves((prev) =>
      prev.map((m) =>
        m.id === moveId
          ? { ...m, inventory: m.inventory.filter((i) => i.id !== itemId) }
          : m
      )
    );
    if (user) {
      await deleteInventoryItemFromFirestore(moveId, itemId);
    }
  };

  const handleUpdateMoveStatus = async (moveId: string, status: MoveStatus) => {
    let currentPaid = 0;
    setMoves((prev) =>
      prev.map((m) => {
        if (m.id !== moveId) return m;
        currentPaid = m.amountPaid;
        return { ...m, status, updatedAt: new Date().toISOString() };
      })
    );
    if (user) {
      await updateMoveBalanceInFirestore(moveId, currentPaid, status);
    }
  };

  const handleCreateExpense = async (payload: {
    moveId: string;
    category: ExpenseCategory;
    description: string;
    amount: number;
    date: string;
    routeLabel: string;
  }) => {
    const nowIso = new Date().toISOString();
    const ownerId = user?.uid || 'local_operator';
    const newExp: OperationalExpense = {
      id: `exp_${Date.now()}`,
      ownerId,
      ...payload,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    setExpenses((prev) => [newExp, ...prev]);

    if (user) {
      await saveExpenseToFirestore(user.uid, newExp);
    }
  };

  // Gate: If no user is logged in with username & password, render the independent LoginScreen
  if (!authenticatedUser) {
    return (
      <LoginScreen
        users={systemUsers}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  const selectedMove = moves.find((m) => m.id === selectedMoveId) || null;
  const paymentModalMove =
    moves.find((m) => m.id === paymentModalMoveId) || null;
  const deleteModalMove =
    moves.find((m) => m.id === deleteModalMoveId) || null;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 overflow-x-hidden">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-4 sm:gap-8 no-print">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#dashboard"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('dashboard');
          }}
          className="text-base sm:text-lg font-bold tracking-tight text-slate-900 font-display whitespace-nowrap shrink-0"
        >
          Aldana Mudanzas
        </a>

        {/* Zone 2: 4 concise single-line text navigation links */}
        <nav
          aria-label="Navegación principal"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
        >
          <a
            href="#dashboard"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('dashboard');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'dashboard'
                ? 'text-slate-900 font-semibold underline underline-offset-8'
                : 'hover:text-slate-900'
            }`}
          >
            Dashboard
          </a>
          <a
            href="#clientes"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('clientes');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'clientes'
                ? 'text-slate-900 font-semibold underline underline-offset-8'
                : 'hover:text-slate-900'
            }`}
          >
            Clientes e Inventario
          </a>
          <a
            href="#finanzas"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('finanzas');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'finanzas'
                ? 'text-slate-900 font-semibold underline underline-offset-8'
                : 'hover:text-slate-900'
            }`}
          >
            Finanzas
          </a>
          <a
            href="#estados-cuenta"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('estados_cuenta');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'estados_cuenta'
                ? 'text-slate-900 font-semibold underline underline-offset-8'
                : 'hover:text-slate-900'
            }`}
          >
            Estados de Cuenta
          </a>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setIsNewMoveModalOpen(true)}
            className="px-3.5 sm:px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Nueva Mudanza
          </button>
        </div>
      </header>

      {/* Workspace Layout: Desktop Sidebar + Main Viewport */}
      <div className="flex-1 flex flex-col lg:flex-row min-w-0">
        {/* Sidebar Navigation */}
        <aside className="w-full lg:w-64 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 px-3 py-2.5 lg:p-4 flex flex-col justify-between shrink-0 no-print">
          <div className="space-y-4 lg:space-y-5">
            {/* Authenticated User Session Card */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    {userRole === 'administrador' ? (
                      <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                    ) : (
                      <UserCheck className="w-4 h-4 text-blue-600 shrink-0" />
                    )}
                    <span className="text-xs font-bold text-slate-900 truncate">
                      {authenticatedUser.fullName.split('(')[0].trim()}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 mt-0.5 truncate">
                    @{authenticatedUser.username} · {authenticatedUser.branchCity.split(',')[0]}
                  </div>
                </div>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded shrink-0 ${
                    userRole === 'administrador'
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'bg-blue-100 text-blue-900 border border-blue-300'
                  }`}
                >
                  {userRole === 'administrador' ? 'ADMIN' : 'INVENTARIO'}
                </span>
              </div>

              <p className="hidden lg:block text-[11px] text-slate-600 leading-snug">
                {userRole === 'administrador'
                  ? 'Permiso activo para eliminar clientes creados y administrar usuarios.'
                  : 'Perfil de inventario y cámara. Sin permiso para eliminar clientes.'}
              </p>

              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {userRole === 'administrador' && (
                  <button
                    type="button"
                    onClick={() => setIsUsersModalOpen(true)}
                    className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2 text-[11px] font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    Usuarios ({systemUsers.length})
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleLogoutSystemUser}
                  aria-label="Cerrar sesión de usuario"
                  className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2 text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <LogOut className="w-3.5 h-3.5 shrink-0" />
                  Salir / Cambiar
                </button>
              </div>
            </div>

            <div>
              <p className="hidden lg:block px-3 text-[11px] font-semibold text-slate-400 mb-2">
                Módulos de Control
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-1 gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('dashboard')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeTab === 'dashboard'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4 shrink-0" />
                  Dashboard Visual
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('clientes')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeTab === 'clientes'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Users className="w-4 h-4 shrink-0" />
                  Clientes e Inventario
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('finanzas')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeTab === 'finanzas'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Wallet className="w-4 h-4 shrink-0" />
                  Finanzas y Gastos
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('estados_cuenta')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeTab === 'estados_cuenta'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4 shrink-0" />
                  Estados de Cuenta
                </button>
              </div>
            </div>

            {/* Quick Client Jump List on Desktop */}
            <div className="hidden lg:block pt-4 border-t border-slate-100">
              <div className="px-3 flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-slate-400">
                  Expedientes Activos ({moves.length})
                </span>
                <button
                  type="button"
                  onClick={() => setIsNewMoveModalOpen(true)}
                  aria-label="Registrar nuevo cliente rápido"
                  className="text-slate-500 hover:text-slate-900 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-1">
                {moves.slice(0, 6).map((m) => {
                  const debt = Math.max(0, m.totalContractAmount - m.amountPaid);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleOpenClientDrawer(m.id, 'inventory')}
                      className="w-full px-3 py-2 rounded-lg text-left hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <div className="text-xs font-semibold text-slate-800 truncate">
                        {m.clientName}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center justify-between mt-0.5">
                        <span className="truncate">
                          {m.originCity.split(',')[0]} →{' '}
                          {m.destinationCity.split(',')[0]}
                        </span>
                        <span
                          className={`font-mono tabular-nums font-medium shrink-0 ml-1 ${
                            debt > 0 ? 'text-red-600' : 'text-emerald-700'
                          }`}
                        >
                          {debt > 0
                            ? `-$${debt.toLocaleString('es-CO')}`
                            : 'Pagado'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Cloud Backup / Google Auth Panel */}
          <div className="hidden lg:block pt-4 border-t border-slate-200">
            {user ? (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <div className="text-xs font-semibold text-slate-900 truncate">
                  {user.displayName || user.email}
                </div>
                <div className="text-[11px] text-emerald-700">
                  {cloudNotice || 'Respaldo Firestore Activo'}
                </div>
                <button
                  type="button"
                  onClick={() => signOutUser()}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-2.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Desconectar Nube
                </button>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <p className="text-[11px] text-slate-600">
                  Tus datos se guardan automáticamente. Inicia sesión para respaldar en la nube.
                </p>
                <button
                  type="button"
                  onClick={() => signInWithGoogle()}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <Cloud className="w-3.5 h-3.5 text-slate-600" />
                  Sincronizar con Google
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 w-full p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardView
              moves={moves}
              expenses={expenses}
              userRole={userRole}
              onSelectMove={handleOpenClientDrawer}
              onOpenPaymentModal={(id) => setPaymentModalMoveId(id)}
              onOpenNewMoveModal={() => setIsNewMoveModalOpen(true)}
              onOpenExpenseModal={() => setIsExpenseModalOpen(true)}
              onRequestDeleteMove={(id) => setDeleteModalMoveId(id)}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'clientes' && (
            <ClientsInventoryView
              moves={moves}
              userRole={userRole}
              onSelectMove={handleOpenClientDrawer}
              onOpenPaymentModal={(id) => setPaymentModalMoveId(id)}
              onOpenNewMoveModal={() => setIsNewMoveModalOpen(true)}
              onRequestDeleteMove={(id) => setDeleteModalMoveId(id)}
              onUpdateInventoryItemDamage={handleUpdateInventoryItemDamage}
            />
          )}

          {(activeTab === 'finanzas' || activeTab === 'estados_cuenta') && (
            <FinancesLedgerView
              moves={moves}
              expenses={expenses}
              mode={activeTab}
              selectedStatementMoveId={statementViewMoveId}
              onChangeSelectedStatementMoveId={(id) =>
                setStatementViewMoveId(id)
              }
              onOpenPaymentModal={(id) => setPaymentModalMoveId(id)}
              onOpenExpenseModal={() => setIsExpenseModalOpen(true)}
            />
          )}
        </main>
      </div>

      {/* Modals & Client Detail Drawer */}
      <ClientDetailDrawer
        move={selectedMove}
        userRole={userRole}
        initialTab={drawerInitialTab}
        onClose={() => setSelectedMoveId(null)}
        onAddInventoryItem={handleAddInventoryItem}
        onUpdateInventoryItemDamage={handleUpdateInventoryItemDamage}
        onRemoveInventoryItem={handleRemoveInventoryItem}
        onUpdateMoveStatus={handleUpdateMoveStatus}
        onOpenPaymentModal={(id) => setPaymentModalMoveId(id)}
        onRequestDeleteMove={(id) => setDeleteModalMoveId(id)}
      />

      <NewMoveModal
        isOpen={isNewMoveModalOpen}
        onClose={() => setIsNewMoveModalOpen(false)}
        onCreateMove={handleCreateMove}
      />

      <PaymentModal
        move={paymentModalMove}
        onClose={() => setPaymentModalMoveId(null)}
        onSubmitPayment={handleRegisterPayment}
      />

      <ExpenseModal
        isOpen={isExpenseModalOpen}
        moves={moves}
        onClose={() => setIsExpenseModalOpen(false)}
        onSubmitExpense={handleCreateExpense}
      />

      <DeleteClientModal
        move={deleteModalMove}
        canDelete={canDeleteClientRecord(userRole)}
        onClose={() => setDeleteModalMoveId(null)}
        onConfirmDelete={handleDeleteMove}
      />

      <UsersManagementModal
        isOpen={isUsersModalOpen}
        users={systemUsers}
        currentUser={authenticatedUser}
        onClose={() => setIsUsersModalOpen(false)}
        onCreateUser={handleCreateSystemUser}
        onDeleteUser={handleDeleteSystemUser}
      />
    </div>
  );
}
