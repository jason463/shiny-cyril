import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import ProblemSection from "@/components/landing/ProblemSection";
import FeaturesGrid from "@/components/landing/FeaturesGrid";
import FounderStory from "@/components/landing/FounderStory";
import BottomCTA from "@/components/landing/BottomCTA";
import Footer from "@/components/landing/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <ProblemSection />
        <FeaturesGrid />
        <FounderStory />
        <BottomCTA />
      </main>
      <Footer />
    </>
  );
}
