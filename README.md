# TrustBon — Sistem Simulasi Piutang UMKM

Sistem manajemen piutang kasbon untuk usaha UMKM Indonesia. Membantu pemilik usaha dan kasir mencatat transaksi kredit, melacak pembayaran, mengelola risiko piutang, serta mengirim pengingat otomatis ke pelanggan melalui WhatsApp.

## Daftar Isi

- [Fitur Utama](#fitur-utama)
- [Tech Stack](#tech-stack)
- [Panduan Setup](#panduan-setup)
- [Struktur Folder](#struktur-folder)
- [Penjelasan Role & Sistem Skoring](#penjelasan-role--sistem-skoring)
- [Catatan & Batasan](#catatan--batasan)

---

## Fitur Utama

### Kelola Pelanggan (4.1)
- Daftar pelanggan dengan pencarian nama/nomor HP
- Tambah, lihat detail, dan edit limit kredit (owner-only)
- Halaman detail: profil, statistik (total kasbon, utang aktif, skor risiko), grafik histori skor, daftar transaksi dengan indikator ketepatan waktu

### Transaksi Kasbon (4.2)
- Form transaksi dengan dropdown pelanggan yang bisa dicari, opsi "Pelanggan baru?" untuk membuat pelanggan langsung dari form
- Penomoran otomatis per bulan (TB-YYYYMM-NNN)
- Auto-confirm: transaksi dalam limit → langsung dikonfirmasi; melebihi limit → menunggu persetujuan owner
- Detail utang pelanggan dan sisa limit ditampilkan setelah pemilihan pelanggan

### Pembayaran (4.3)
- Alur tiga langkah: pilih pelanggan → pilih kasbon → tentukan jumlah bayar
- Validasi: jumlah bayar tidak boleh melebihi sisa utang
- Dukungan bayar sebagian dan lunas sekaligus
- Otomatis memperbarui status transaksi (unpaid → partial → paid)

### Skoring Risiko Kredit (4.4)
- Algoritma rule-based berbasis empat komponen:
  - Persentase transaksi terlambat (bobot 40%)
  - Rata-rata hari keterlambatan (bobot 20%)
  - Rasio utang aktif terhadap limit kredit (bobot 20%)
  - Kasbon berturut-turut belum lunas (bobot 5%)
  - Bonus loyalitas pelanggan baik (+5 atau +10)
- Status kepercayaan: `stable`, `recovering`, `at_risk`
- Skor dihitung ulang secara otomatis setiap hari melalui cron job

### Riwayat Pelanggan (4.5)
- Halaman detail pelanggan menampilkan skor risiko, histori skor (grafik SVG), daftar transaksi, dan catatan keterlambatan
- Owner dapat mengedit limit kredit dan mengaktifkan/menonaktifkan pengingat otomatis

### Persetujuan Transaksi (4.6)
- Daftar transaksi yang melebihi limit kredit (need_approval)
- Tampilkan informasi limit kredit, utang aktif, dan skor risiko pelanggan
- Owner dapat menyetujui atau menolak dengan catatan

### Kelola Tim (4.7)
- Kode undangan bisnis (format `TB-XXXXX`) dengan fungsi salin dan regenerate
- Daftar anggota aktif dengan informasi role
- Penghapusan kasir (non-destruktif: status → `removed`)
- Indikator status koneksi Fonnte WhatsApp

### Pengingat WhatsApp (4.8)
- Pesan pengingat dihasilkan oleh AI (Google Gemini API) dengan nada yang menyesuaikan status kepercayaan pelanggan
- Pengiriman melalui Fonnte REST API
- Cron job harian untuk pengiriman otomatis
- Rate limit 1 detik antar pengiriman
- Pelanggan dapat menonaktifkan pengingat otomatis

### Insight Dashboard (4.9)
- Wawasan bisnis yang dihasilkan oleh AI (Google Gemini API)
- Ditampilkan di dashboard owner dengan indikator loading

### Laporan (4.11)
- Metrik ringkasan: total pelanggan, transaksi, omzet, piutang aktif
- Grafik tren 6 bulan terakhir (recharts) — omzet, piutang aktif, jumlah transaksi
- Distribusi risiko pelanggan (pie chart)
- Tabel detail pelanggan dengan kolom: nama, total kasbon, utang aktif, skor risiko, status kepercayaan
- Filter tanggal (awal/akhir)
- Export ke Excel (.xlsx) dan PDF (.pdf) — data yang diexport sesuai filter tanggal

### Dashboard Real Data (4.13)
- Dashboard kasir: jumlah pelanggan aktif, kasbon hari ini, utang aktif, pelanggan berisiko tinggi, transaksi terbaru
- Dashboard owner: semua metrik kasir + total kasbon, omzet, menunggu persetujuan, pendapatan hari ini, rata-rata persetujuan, kasbon terbesar, + wawasan AI

---

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Framework | Next.js 16 (App Router, `output: "standalone"`) |
| Bahasa | JavaScript (Tanpa TypeScript) |
| UI | React 19, Tailwind CSS v4, Lucide Icons |
| Database | PostgreSQL (Neon) via Prisma 7 + `@prisma/adapter-pg` |
| Autentikasi | NextAuth 5 (beta) — JWT strategy + Credentials provider |
| AI | Google Gemini API (`@google/genai`) |
| WhatsApp | Fonnte REST API |
| Grafik | Recharts |
| Export | xlsx (Excel), jsPDF + jspdf-autotable (PDF) |
| Tema | next-themes (dark/light mode) |
| Package Manager | Bun |

---

## Panduan Setup

### Prasyarat

- Node.js 22+
- Bun (package manager)
- Akun Neon PostgreSQL (atau PostgreSQL lokal)
- API key Google Gemini (opsional, untuk fitur pengingat & insight)
- Token Fonnte (opsional, untuk pengiriman WhatsApp)

### Instalasi

```bash
# 1. Clone repository
git clone <url-repository>
cd trustbon-sim-piutang-umkm

# 2. Install dependencies
bun install

# 3. Salin file environment
cp .env.example .env
```

### Konfigurasi Environment

Edit `.env` dan isi nilai berikut:

```env
# Database (wajib)
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"

# NextAuth (wajib)
AUTH_SECRET="<generate dengan: openssl rand -base64 32>"
NEXTAUTH_URL="http://localhost:3000"

# Gemini API (opsional — untuk pengingat AI & insight)
GEMINI_API_KEY="your-gemini-api-key"

# Fonnte (opsional — untuk kirim WhatsApp)
FONNTE_TOKEN="your-fonnte-token"

# Cron (opsional — untuk proteksi cron endpoint di production)
CRON_SECRET="your-cron-secret"
```

### Jalankan

```bash
# Development
bun run dev

# Production
bun run build
bun run start
```

Buka [http://localhost:3000](http://localhost:3000).

### Verifikasi

```bash
# Lint — pastikan bersih dari error
bun run lint

# Build
bun run build

# Verifikasi autentikasi & otorisasi (E2E)
bun run verify:authz

# Verifikasi fitur lain
bun run verify:payments
bun run verify:approval
bun run verify:risk-score
bun run verify:dashboard
bun run verify:transaction-cancel
bun run verify:customer-delete
```

---

## Struktur Folder

```
trustbon-sim-piutang-umkm/
├── app/
│   ├── actions/            # Server actions (CRUD transaksi, pelanggan, pembayaran, dll.)
│   ├── api/
│   │   ├── cron/           # Cron endpoint (pengingat harian)
│   │   └── insight/        # API endpoint untuk insight AI
│   ├── dashboard/
│   │   ├── approval/       # Halaman persetujuan transaksi
│   │   ├── laporan/        # Halaman laporan & export
│   │   ├── pelanggan/      # Daftar & detail pelanggan
│   │   ├── pembayaran/     # Manajemen pembayaran
│   │   ├── profil/         # Profil pengguna
│   │   ├── bisnis/         # Pengaturan bisnis (owner)
│   │   ├── tim/            # Kelola tim kasir (owner)
│   │   ├── transaksi/      # Daftar transaksi
│   │   └── transaksi-baru/ # Form transaksi baru
│   ├── login/              # Halaman masuk
│   ├── register/           # Alur registrasi (pilih role, buat/join bisnis)
│   └── page.js             # Landing page
├── components/
│   ├── dashboard/          # Komponen dashboard (badge, kartu, dll.)
│   └── ...                 # Komponen UI lainnya (AuthUi, ConfirmDialog, NavigationGuard, dll.)
├── lib/
│   ├── actions/            # Server action handlers
│   ├── auth.js             # NextAuth config + provider
│   ├── customer-debt.js    # Kalkulasi utang pelanggan
│   ├── onboarding-grant.js # Token onboarding (HMAC-SHA256)
│   ├── prisma.js           # Prisma client (server-only)
│   ├── reminder.js         # Sistem pengingat (Gemini + Fonnte)
│   ├── report-data.js      # Kumpulan data untuk laporan
│   ├── risk-score.js       # Kalkulasi & persist skor risiko
│   ├── risk-score-core.js  # Inti algoritma skoring (pure, tanpa DB)
│   └── session-guards.js   # Guard otorisasi berbasis DB
├── prisma/
│   ├── migrations/         # Migrasi database
│   └── schema.prisma       # Skema database
├── scripts/                # Script verifikasi E2E
├── public/                 # Aset statis
└── proxy.js                # Middleware Next.js 16 (renamed dari middleware)
```

---

## Penjelasan Role & Sistem Skoring

### Role

| Role | Deskripsi | Akses |
|------|-----------|-------|
| **Owner** | Pemilik usaha / bisnis | Full akses: dashboard, transaksi, pembayaran, pelanggan, approval, tim, laporan |
| **Cashier** | Kasir / karyawan | Terbatas: dashboard, transaksi, pembayaran, pelanggan |

### Sistem Skoring Risiko (4.4)

Skor risiko dihitung dari 0–100 dengan formula:

```
skor = 100
       − (persentase transaksi terlambat × 40)
       − (rata-rata hari terlambat / 30 × 20)
       − (persentase utang aktif / limit kredit × 20)
       − (jumlah kasbon berturut belum lunas × 5)
       + bonus loyalitas
```

| Status Kepercayaan | Kondisi |
|--------------------|---------|
| `stable` | 5 transaksi terakhir tepat waktu, atau skor ≥ 80 |
| `recovering` | 3 transaksi terakhir tepat waktu (sebelumnya terlambat), atau skor ≥ 50 |
| `at_risk` | 2 dari 3 transaksi terakhir terlambat, atau skor < 50 |

### Alur Transaksi

```
Transaksi Baru → [Cek Limit Kredit]
  ├── Dalam limit → paymentStatus: confirmed →录入 pembayaran → [Lunas/Sebagian]
  └── Melebihi limit → paymentStatus: need_approval → Owner menyetujui → confirmed
```

---

## Catatan & Batasan

- **Bahasa**: Kode sumber menggunakan JavaScript (bukan TypeScript).
- **Naming**: Nama field dan enum pada schema database tidak boleh di-rename karena sudah terintegrasi di seluruh sistem.
- **Tanpa browser alert/confirm/prompt**: Semua interaksi menggunakan komponen modal dialog kustom.
- **Database bersama**: Menggunakan Neon PostgreSQL shared instance. Perubahan schema harus di-commit sebagai SQL di bawah `prisma/migrations/`.
- **Dev server**: Port 3000 digunakan untuk development. Script verifikasi menggunakan port berbeda (3100).
- **Cron endpoint**: `/api/cron/reminders` dapat dipicu oleh Vercel Cron Job atau scheduler eksternal. Di production, lindungi dengan header `Authorization: Bearer <CRON_SECRET>`.
- **Fonnte & Gemini**: Fitur pengingat WhatsApp dan insight AI memerlukan API key yang dikonfigurasi di environment variables. Tanpa konfigurasi, fitur-fitur ini tidak akan aktif tetapi aplikasi tetap berjalan.
