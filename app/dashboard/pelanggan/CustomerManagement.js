"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Search, Trash2, UserPlus, X } from "lucide-react";
import { deleteCustomer } from "@/app/actions/customers";
import { AuthError, authInputClass } from "@/components/AuthUi";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { GuardedLink } from "@/components/GuardedLink";
import {
  RiskScoreBadge,
  TrustStatusBadge,
} from "@/components/dashboard/StatusBadge";
import { useToast } from "@/components/Toast";
import { formatIDR } from "@/lib/format";
import { AddCustomerDialog } from "./AddCustomerDialog";
import { EditCustomerDialog } from "./EditCustomerDialog";

const sectionCardClass =
  "glass-card rounded-2xl border border-white/40 dark:border-white/10 shadow-md p-5 sm:p-6";

const headerPrimaryButtonClass =
  "inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-sm font-semibold shadow-md shadow-violet-500/25 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500";

const primaryButtonClass =
  "px-4 py-2.5 rounded-lg bg-violet-500 hover:bg-violet-600 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-violet-500 text-white font-semibold text-xs shadow-md shadow-violet-500/30 dark:shadow-black/30 transition-all flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1a1625]";

const secondaryButtonClass =
  "px-4 py-2.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/10 disabled:opacity-60 disabled:cursor-not-allowed font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1a1625]";

const TABLE_HEAD_CELL_CLASSES =
  "px-5 sm:px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400";
const TABLE_BODY_CELL_CLASSES = "px-5 sm:px-6 py-3.5";

const detailLinkClass =
  "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-violet-200 dark:border-violet-500/25 bg-violet-50/70 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 text-xs font-semibold hover:bg-violet-100 dark:hover:bg-violet-500/20 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1a1625]";

const iconButtonClass =
  "inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1a1625]";

/**
 * Customer list: header CTA, client-side search, table with actions.
 * Owner sees Edit/Delete buttons; Kasir sees read-only list.
 */
export function CustomerManagement({
  customers,
  userRole = "owner",
  loadError = null,
}) {
  const router = useRouter();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [pending, startTransition] = useTransition();

  const isOwner = userRole === "owner";

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!normalizedQuery) return customers;
    return customers.filter(
      (customer) =>
        customer.name.toLowerCase().includes(normalizedQuery) ||
        customer.phoneNumber.toLowerCase().includes(normalizedQuery)
    );
  }, [customers, normalizedQuery]);

  function handleCreated() {
    toast.success("Pelanggan baru berhasil ditambahkan.");
    router.refresh();
  }

  function handleUpdated() {
    toast.success("Data pelanggan berhasil diperbarui.");
    router.refresh();
  }

  function handleDeleteConfirm() {
    if (pending || !deleteTarget) return;
    startTransition(async () => {
      try {
        const res = await deleteCustomer({ id: deleteTarget.id });
        if (res?.ok) {
          toast.success(`Pelanggan ${deleteTarget.name} berhasil dihapus.`);
          setDeleteTarget(null);
          router.refresh();
        } else {
          toast.error(res?.error ?? "Gagal menghapus pelanggan.");
          setDeleteTarget(null);
        }
      } catch {
        toast.error("Gagal menghapus pelanggan. Silakan coba lagi.");
        setDeleteTarget(null);
      }
    });
  }

  const isEmpty = customers.length === 0;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#181126] dark:text-white">
            Kelola pelanggan
          </h1>
          <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-300">
            Catat pelanggan, atur limit kredit, dan pantau utang aktif mereka.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className={headerPrimaryButtonClass}
        >
          <Plus className="w-4.5 h-4.5" />
          Tambah pelanggan
        </button>
      </div>

      {/* Search */}
      <div className="relative mt-6 max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="search"
          aria-label="Cari pelanggan"
          placeholder="Cari nama atau nomor HP…"
          data-testid="customer-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className={`${authInputClass} pr-9`}
        />
        {query ? (
          <button
            type="button"
            aria-label="Hapus pencarian"
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            <X className="w-4 h-4" />
          </button>
        ) : null}
      </div>

      {/* Load error */}
      {loadError ? (
        <div className="mt-5">
          <AuthError message={loadError} />
        </div>
      ) : null}

      {!isEmpty ? (
        <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 tabular-nums">
          Menampilkan {filtered.length} dari {customers.length} pelanggan
        </p>
      ) : null}

      {isEmpty ? (
        <section className={`${sectionCardClass} mt-4`}>
          <div className="rounded-xl border border-dashed border-gray-200 dark:border-white/10 px-4 py-8 text-center">
            <div className="w-11 h-11 rounded-2xl bg-violet-100 dark:bg-violet-500/15 border border-violet-200 dark:border-violet-500/25 text-violet-600 dark:text-violet-300 flex items-center justify-center mx-auto mb-3">
              <UserPlus className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Belum ada pelanggan
            </h3>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 max-w-sm mx-auto leading-relaxed">
              Tambahkan pelanggan pertama Anda untuk mulai mencatat kasbon dan
              memantau limit kredit.
            </p>
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className={`${primaryButtonClass} mt-4 mx-auto`}
            >
              <Plus className="w-3.5 h-3.5" />
              Tambah pelanggan
            </button>
          </div>
        </section>
      ) : filtered.length === 0 ? (
        <section className={`${sectionCardClass} mt-4`}>
          <div className="rounded-xl border border-dashed border-gray-200 dark:border-white/10 px-4 py-8 text-center">
            <p className="text-sm font-bold text-gray-900 dark:text-white">
              Tidak ada pelanggan yang cocok dengan pencarian.
            </p>
            <button
              type="button"
              onClick={() => setQuery("")}
              className={`${secondaryButtonClass} mt-4 mx-auto`}
            >
              Reset pencarian
            </button>
          </div>
        </section>
      ) : (
        <section className={`${sectionCardClass} mt-4`}>
          <div className="overflow-x-auto">
            <table
              data-testid="customer-table"
              className="w-full min-w-[720px] text-sm"
            >
              <thead>
                <tr className="border-b border-gray-200/70 dark:border-white/10 text-left">
                  <th scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                    Nama
                  </th>
                  <th scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                    Limit Kredit
                  </th>
                  <th scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                    Utang Aktif
                  </th>
                  <th scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                    Skor Risiko
                  </th>
                  <th scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                    Status
                  </th>
                  <th scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                    <span className="sr-only">Aksi</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((customer) => (
                  <tr
                    key={customer.id}
                    data-testid="customer-row"
                    className="border-b border-gray-100/80 dark:border-white/5 last:border-b-0 hover:bg-violet-50/60 dark:hover:bg-white/5 transition-colors"
                  >
                    <td className={TABLE_BODY_CELL_CLASSES}>
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {customer.name}
                      </div>
                      <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {customer.phoneNumber}
                      </div>
                    </td>
                    <td
                      className={`${TABLE_BODY_CELL_CLASSES} tabular-nums text-gray-700 dark:text-gray-300`}
                    >
                      {formatIDR(customer.creditLimit)}
                    </td>
                    <td
                      className={`${TABLE_BODY_CELL_CLASSES} tabular-nums text-gray-700 dark:text-gray-300`}
                    >
                      {formatIDR(customer.activeDebt)}
                    </td>
                    <td className={TABLE_BODY_CELL_CLASSES}>
                      <RiskScoreBadge value={customer.riskScore} trustStatus={customer.trustStatus} />
                    </td>
                    <td className={TABLE_BODY_CELL_CLASSES}>
                      <TrustStatusBadge value={customer.trustStatus} />
                    </td>
                    <td className={`${TABLE_BODY_CELL_CLASSES} text-right`}>
                      <div className="flex items-center justify-end gap-1">
                        {isOwner ? (
                          <>
                            <button
                              type="button"
                              aria-label={`Edit ${customer.name}`}
                              onClick={() => setEditTarget(customer)}
                              className={`${iconButtonClass} text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-white/5`}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Hapus ${customer.name}`}
                              onClick={() => setDeleteTarget(customer)}
                              className={`${iconButtonClass} text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        ) : null}
                        <GuardedLink
                          href={`/dashboard/pelanggan/${customer.id}`}
                          aria-label={`Lihat detail ${customer.name}`}
                          data-testid="customer-detail-link"
                          className={detailLinkClass}
                        >
                          Detail
                        </GuardedLink>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Add dialog */}
      <AddCustomerDialog
        key={dialogOpen ? "add-customer-open" : "add-customer-closed"}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={handleCreated}
        userRole={userRole}
      />

      {/* Edit dialog */}
      <EditCustomerDialog
        key={editTarget ? `edit-customer-${editTarget.id}` : "edit-customer-closed"}
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        onUpdated={handleUpdated}
        customer={editTarget}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Hapus pelanggan"
        description={
          deleteTarget
            ? `Yakin ingin menghapus "${deleteTarget.name}"? Semua data transaksi dan riwayat pelanggan ini akan dihapus permanen.`
            : ""
        }
        actions={[
          {
            label: pending ? "Menghapus…" : "Hapus",
            tone: "danger",
            loading: pending,
            onClick: handleDeleteConfirm,
          },
          {
            label: "Batal",
            tone: "neutral",
            onClick: () => setDeleteTarget(null),
          },
        ]}
        onDismiss={() => !pending && setDeleteTarget(null)}
        dismissible={!pending}
      />
    </div>
  );
}
