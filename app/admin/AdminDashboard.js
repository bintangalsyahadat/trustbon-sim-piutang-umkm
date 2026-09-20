"use client";

import { Wifi, WifiOff, Users, Building2, MessageCircle } from "lucide-react";

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-5">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        </div>
      </div>
    </div>
  );
}

export function AdminDashboard({
  fonnteConnected,
  fonnteDeviceName,
  fonnteError,
  activeUserCount,
  activeBusinessCount,
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#1a1625] p-6 sm:p-10">
      <div className="max-w-3xl mx-auto space-y-8">
        <header>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Admin Dashboard
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Status sistem TrustBon.
          </p>
        </header>

        {/* Stats grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard
            icon={Users}
            label="Pengguna Aktif"
            value={activeUserCount}
            color="bg-violet-100 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400"
          />
          <StatCard
            icon={Building2}
            label="Bisnis Aktif"
            value={activeBusinessCount}
            color="bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
          />
        </div>

        {/* Fonnte status */}
        <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Fonnte WhatsApp</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Status koneksi pengiriman pengingat</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {fonnteConnected ? (
              <>
                <Wifi className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  Terhubung
                </span>
                {fonnteDeviceName && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                    — {fonnteDeviceName}
                  </span>
                )}
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                  {fonnteError || "Tidak terhubung"}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
