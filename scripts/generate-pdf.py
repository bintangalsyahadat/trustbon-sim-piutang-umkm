#!/usr/bin/env python3
"""Generate PDF deskripsi 150 kata untuk submission TCC Vibe Code 2026."""

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
import os

OUTPUT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

doc = SimpleDocTemplate(
    os.path.join(OUTPUT_DIR, "Muhammad_Bintang_Alsyahadat_Universitas_Nusantara_PGRI_Kediri_TrustBon_Sistem_Informasi_Piutang_UMKM.pdf"),
    pagesize=A4,
    topMargin=2.5*cm,
    bottomMargin=2.5*cm,
    leftMargin=2.5*cm,
    rightMargin=2.5*cm,
)

styles = getSampleStyleSheet()
title_style = ParagraphStyle(
    "CustomTitle",
    parent=styles["Title"],
    fontSize=14,
    leading=18,
    alignment=TA_CENTER,
    spaceAfter=6,
    fontName="Helvetica-Bold",
)
meta_style = ParagraphStyle(
    "Meta",
    parent=styles["Normal"],
    fontSize=10,
    leading=14,
    alignment=TA_CENTER,
    spaceAfter=16,
    textColor="#555555",
    fontName="Helvetica",
)
body_style = ParagraphStyle(
    "Body",
    parent=styles["Normal"],
    fontSize=11,
    leading=16,
    alignment=TA_JUSTIFY,
    fontName="Helvetica",
)

story = []

story.append(Paragraph("TrustBon - Sistem Informasi Manajemen Piutang UMKM Multi-Tenant", title_style))
story.append(Spacer(1, 4))

meta_lines = [
    "Universitas Nusantara PGRI Kediri",
    "Ketua: Muhammad Bintang Alsyahadat",
    "Anggota 1: Yudha Anggara",
    "Anggota 2: Ning Inge Halimah Silva",
]
for line in meta_lines:
    story.append(Paragraph(line, meta_style))
story.append(Spacer(1, 8))

description = (
    "UMKM menyumbang lebih dari 60% PDB Indonesia, namun pengelolaan piutang dan kasbon "
    "masih dilakukan secara manual. Banyak UMKM kehilangan modal kerja karena piutang macet "
    "tanpa sistem peringatan dini. TrustBon hadir sebagai solusi digital berbasis web yang "
    "mengelola piutang, kasbon, dan limit kredit pelanggan secara terpusat. Sistem ini "
    "menggunakan arsitektur multi-tenant dengan Next.js 16, Prisma 7, dan PostgreSQL. "
    "Fitur unggulan meliputi Skor Kepercayaan Pelanggan berbasis rule-based scoring yang "
    "menghitung risiko kredit secara otomatis, perlindungan limit kredit melalui alur "
    "persetujuan owner, dan pengingat WhatsApp otomatis menggunakan AI Gemini yang "
    "mengirimkan pesan penagihan yang sopan dan personal. TrustBon juga menyediakan "
    "dashboard analitik berbasis AI untuk insight bisnis, serta chatbot AI yang menjawab "
    "pertanyaan seputar data piutang dan pelanggan. Dengan antarmuka profesional yang "
    "responsif dan mendukung dark mode, TrustBon dirancang untuk membantu UMKM menjaga "
    "kelangsungan bisnis, melindungi modal, dan membangun sistem kepercayaan antar pelaku "
    "usaha lokal guna mendukung keberlanjutan ekonomi komunitas."
)

story.append(Paragraph(description, body_style))

doc.build(story)

output_path = doc.filename
print(f"PDF generated: {output_path}")

# Count words
word_count = len(description.split())
print(f"Word count: {word_count}")
