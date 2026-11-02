import { useDemoQueue } from "@core/hooks/useDemoQueue";
import { FeatureGrid } from "../../components/landing/FeatureGrid";
import { ForHospitals } from "../../components/landing/ForHospitals";
import { Hero } from "../../components/landing/Hero";
import { HowItWorks } from "../../components/landing/HowItWorks";
import { SiteFooter } from "../../components/landing/SiteFooter";
import { SiteNav } from "../../components/landing/SiteNav";

export default function Landing() {
  const queue = useDemoQueue();

  return (
    <>
      <SiteNav />
      <main id="main">
        <Hero />
        <HowItWorks />
        <FeatureGrid />
        <ForHospitals queue={queue} />
      </main>
      <SiteFooter />
    </>
  );
}
