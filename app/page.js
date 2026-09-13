import { auth } from "@/auth";
import { Navbar } from "../components/Navbar";
import { Hero } from "../components/Hero";
import { ProblemsSection } from "../components/ProblemsSection";
import { FeaturesSection } from "../components/FeaturesSection";
import { ScoreSimulator } from "../components/ScoreSimulator";
import { HowItWorks } from "../components/HowItWorks";
import { Footer } from "../components/Footer";

export default async function Home() {
  // Public landing page: anonymous visitors get the normal marketing CTAs,
  // signed-in visitors get the app affordances instead. auth() keeps this
  // route dynamic so a cached response can never leak the signed-in state.
  const session = await auth();
  const isAuthenticated = Boolean(session?.user);

  return (
    <div className="min-h-screen flex flex-col selection:bg-violet-500 selection:text-white relative transition-colors duration-200">
      {/* Top Fixed Navbar */}
      <Navbar isAuthenticated={isAuthenticated} />

      {/* Main Content Sections */}
      <main className="flex-1">
        {/* 1. Hero Section */}
        <Hero isAuthenticated={isAuthenticated} />

        {/* 2. Masalah yang Diselesaikan */}
        <ProblemsSection />

        {/* 3. Fitur Utama (3 Kolom Grid) */}
        <FeaturesSection />

        {/* Interactive Rule-Based Score Simulator */}
        <ScoreSimulator />

        {/* 4. Cara Kerja (3 Langkah) */}
        <HowItWorks isAuthenticated={isAuthenticated} />
      </main>

      {/* 5. Footer */}
      <Footer />
    </div>
  );
}
