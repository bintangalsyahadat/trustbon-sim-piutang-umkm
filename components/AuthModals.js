"use client";

import { useState } from "react";
import { X, Building2, User, Key, Mail, Phone, Lock, ArrowRight, ShieldCheck, CheckCircle2 } from "lucide-react";

export function AuthModals({
  loginOpen,
  registerOpen,
  onCloseLogin,
  onCloseRegister,
  onSwitchToRegister,
  onSwitchToLogin,
}) {
  // Login State
  const [loginRole, setLoginRole] = useState("owner"); // 'owner' | 'cashier'
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [loginSubmitted, setLoginSubmitted] = useState(false);

  // Register State
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const [generatedInviteCode, setGeneratedInviteCode] = useState("");

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    setLoginSubmitted(true);
  };

  const handleRegisterSubmit = (e) => {
    e.preventDefault();
    // Simulate generation of unique invite code for multi-tenant business
    const randomCode =
      (businessName.substring(0, 3).toUpperCase() || "TB") +
      "-" +
      Math.floor(1000 + Math.random() * 9000);
    setGeneratedInviteCode(randomCode);
    setRegisterSuccess(true);
  };

  return (
    <>
      {/* LOGIN MODAL */}
      {loginOpen && (
        <div
          id="modal-login-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn"
          onClick={onCloseLogin}
        >
          <div
            id="modal-login"
            className="glass-panel w-full max-w-md rounded-2xl p-6 sm:p-8 shadow-2xl border border-white/60 dark:border-white/20 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              id="btn-close-login"
              type="button"
              onClick={onCloseLogin}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-xl bg-violet-500 text-white flex items-center justify-center font-bold">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Masuk ke TrustBon
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Pilih peran Anda dalam operasional toko
                </p>
              </div>
            </div>

            {/* Role Switcher: Owner vs Kasir */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-violet-50 dark:bg-white/5 border border-violet-100 dark:border-white/10 mb-5">
              <button
                type="button"
                onClick={() => {
                  setLoginRole("owner");
                  setLoginSubmitted(false);
                }}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  loginRole === "owner"
                    ? "bg-white dark:bg-violet-500/20 text-violet-700 dark:text-violet-200 shadow-xs"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-800"
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Owner (Pemilik)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoginRole("cashier");
                  setLoginSubmitted(false);
                }}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  loginRole === "cashier"
                    ? "bg-white dark:bg-violet-500/20 text-violet-700 dark:text-violet-200 shadow-xs"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-800"
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Kasir (Staff Toko)</span>
              </button>
            </div>

            {loginSubmitted ? (
              <div className="text-center py-6 space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-gray-900 dark:text-white">
                  Autentikasi Terverifikasi!
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed max-w-xs mx-auto">
                  Anda login sebagai <strong>{loginRole === "owner" ? "Owner (Akses Penuh)" : "Kasir (Pencatatan Transaksi)"}</strong>. Sesi NextAuth diamankan dengan multi-tenant business isolation.
                </p>
                <button
                  type="button"
                  onClick={onCloseLogin}
                  className="mt-2 px-5 py-2 text-xs font-semibold rounded-lg bg-violet-500 text-white shadow-sm hover:bg-violet-600"
                >
                  Tutup Preview
                </button>
              </div>
            ) : (
              <form onSubmit={handleLoginSubmit} className="space-y-3.5 text-xs">
                {loginRole === "cashier" && (
                  <div>
                    <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Kode Invite Bisnis (Diberikan oleh Owner):
                    </label>
                    <div className="relative">
                      <Key className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        required
                        placeholder="Contoh: BRK-7712"
                        value={inviteCodeInput}
                        onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-violet-500/20 bg-white dark:bg-white/5 text-gray-900 dark:text-white uppercase font-mono tracking-wider focus:outline-none focus:border-violet-500"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Email Pengguna:
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      required
                      placeholder="nama@tokoanda.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-violet-500/20 bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:outline-none focus:border-violet-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Password:
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-violet-500/20 bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:outline-none focus:border-violet-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-lg bg-violet-500 hover:bg-violet-600 text-white font-semibold text-xs shadow-md shadow-violet-500/30 dark:shadow-black/30 transition-all mt-4 flex items-center justify-center gap-1.5"
                >
                  <span>Masuk sebagai {loginRole === "owner" ? "Owner" : "Kasir"}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <p className="text-center text-[11px] text-gray-500 dark:text-gray-400 pt-2">
                  Belum punya akun bisnis?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      onCloseLogin();
                      onSwitchToRegister();
                    }}
                    className="text-violet-600 dark:text-violet-400 font-semibold hover:underline"
                  >
                    Daftar UMKM Gratis
                  </button>
                </p>
              </form>
            )}
          </div>
        </div>
      )}

      {/* REGISTER MODAL */}
      {registerOpen && (
        <div
          id="modal-register-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn"
          onClick={onCloseRegister}
        >
          <div
            id="modal-register"
            className="glass-panel w-full max-w-lg rounded-2xl p-6 sm:p-8 shadow-2xl border border-white/60 dark:border-white/20 relative max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              id="btn-close-register"
              type="button"
              onClick={onCloseRegister}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-xl bg-violet-500 text-white flex items-center justify-center font-bold">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Daftarkan Usaha UMKM Anda
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Gratis. Tanpa biaya langganan awal & tanpa kartu kredit
                </p>
              </div>
            </div>

            {registerSuccess ? (
              <div className="text-center py-5 space-y-4">
                <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-sm">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white">
                    Bisnis &quot;{businessName}&quot; Berhasil Didaftarkan!
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-300 max-w-sm mx-auto">
                    Kode invite unik multi-tenant telah dibuat untuk toko Anda. Bagikan kode ini kepada kasir Anda:
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 inline-block">
                  <span className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold block">
                    Kode Invite Kasir Toko:
                  </span>
                  <span className="text-xl font-mono font-black text-violet-700 dark:text-violet-300">
                    {generatedInviteCode}
                  </span>
                </div>

                <p className="text-[11px] text-gray-500">
                  Kasir Anda dapat membuat akun menggunakan kode ini untuk langsung terhubung ke toko Anda.
                </p>

                <button
                  type="button"
                  onClick={onCloseRegister}
                  className="px-6 py-2.5 rounded-lg bg-violet-500 text-white font-semibold text-xs shadow-md shadow-violet-500/30 dark:shadow-black/30 hover:bg-violet-600 transition-all"
                >
                  Selesai & Tutup
                </button>
              </div>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Nama Bisnis / Warung / Toko:
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Toko Sembako Makmur Jaya"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-violet-500/20 bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:outline-none focus:border-violet-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Nama Lengkap Pemilik (Owner):
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        required
                        placeholder="Contoh: Budi Santoso"
                        value={ownerName}
                        onChange={(e) => setOwnerName(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-violet-500/20 bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:outline-none focus:border-violet-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Nomor WhatsApp Pemilik:
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="tel"
                        required
                        placeholder="08123456789"
                        value={ownerPhone}
                        onChange={(e) => setOwnerPhone(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-violet-500/20 bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:outline-none focus:border-violet-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Email Login Owner:
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="email"
                        required
                        placeholder="owner@toko.com"
                        value={registerEmail}
                        onChange={(e) => setRegisterEmail(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-violet-500/20 bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:outline-none focus:border-violet-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Password:
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="password"
                        required
                        placeholder="Minimal 8 karakter"
                        value={registerPassword}
                        onChange={(e) => setRegisterPassword(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-violet-500/20 bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:outline-none focus:border-violet-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-3">
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-lg bg-violet-500 hover:bg-violet-600 text-white font-semibold text-xs shadow-md shadow-violet-500/30 dark:shadow-black/30 transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>Daftarkan Bisnis & Buat Kode Kasir</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <p className="text-center text-[11px] text-gray-500 dark:text-gray-400 pt-1">
                  Sudah punya akun?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      onCloseRegister();
                      onSwitchToLogin();
                    }}
                    className="text-violet-600 dark:text-violet-400 font-semibold hover:underline"
                  >
                    Masuk di sini
                  </button>
                </p>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
