"use client";

import { useState } from "react";

export function AdminLogin({ error, onSubmit }) {
  const [loading, setLoading] = useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#1a1625] px-4">
      <form
        action={async (formData) => {
          setLoading(true);
          await onSubmit(formData);
        }}
        className="w-full max-w-sm space-y-4"
      >
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">TrustBon Admin</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Masukkan password admin untuk melanjutkan.</p>
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 text-center">Password salah.</p>
        )}

        <input
          type="password"
          name="password"
          placeholder="Password admin"
          required
          autoFocus
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 px-4 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {loading ? "Memverifikasi..." : "Masuk"}
        </button>
      </form>
    </div>
  );
}
