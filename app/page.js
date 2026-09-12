"use client";

import { useState } from "react";
import { Navbar } from "../components/Navbar";
import { Hero } from "../components/Hero";
import { ProblemsSection } from "../components/ProblemsSection";
import { FeaturesSection } from "../components/FeaturesSection";
import { ScoreSimulator } from "../components/ScoreSimulator";
import { HowItWorks } from "../components/HowItWorks";
import { Footer } from "../components/Footer";
import { AuthModals } from "../components/AuthModals";

export default function Home() {
  const [loginOpen, setLoginOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);

  const scrollToScoreSimulator = () => {
    const el = document.getElementById("simulasi");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen flex flex-col selection:bg-violet-500 selection:text-white relative transition-colors duration-200">
      {/* Top Fixed Navbar */}
      <Navbar
        onOpenLogin={() => setLoginOpen(true)}
        onOpenRegister={() => setRegisterOpen(true)}
      />

      {/* Main Content Sections */}
      <main className="flex-1">
        {/* 1. Hero Section */}
        <Hero
          onOpenRegister={() => setRegisterOpen(true)}
          onOpenLogin={() => setLoginOpen(true)}
        />

        {/* 2. Masalah yang Diselesaikan */}
        <ProblemsSection />

        {/* 3. Fitur Utama (3 Kolom Grid) */}
        <FeaturesSection onExploreScore={scrollToScoreSimulator} />

        {/* Interactive Rule-Based Score Simulator */}
        <ScoreSimulator />

        {/* 4. Cara Kerja (3 Langkah) */}
        <HowItWorks onOpenRegister={() => setRegisterOpen(true)} />
      </main>

      {/* 5. Footer */}
      <Footer />

      {/* Auth Modals for Owner and Cashier Login / Registration */}
      <AuthModals
        loginOpen={loginOpen}
        registerOpen={registerOpen}
        onCloseLogin={() => setLoginOpen(false)}
        onCloseRegister={() => setRegisterOpen(false)}
        onSwitchToRegister={() => setRegisterOpen(true)}
        onSwitchToLogin={() => setLoginOpen(true)}
      />
    </div>
  );
}
