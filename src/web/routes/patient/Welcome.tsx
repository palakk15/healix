import { useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { hasAnyConsent } from "@core/store/session";
import { ConsentStep } from "../../components/onboarding/ConsentStep";
import { LanguageStep } from "../../components/onboarding/LanguageStep";
import { PhoneStep } from "../../components/onboarding/PhoneStep";
import { ProfileStep } from "../../components/onboarding/ProfileStep";
import { sessionStore } from "../../store";

const totalSteps = 4;

function firstStep(): number {
  const state = sessionStore.getState();
  return state.role === "patient" && state.user ? 2 : 0;
}

export default function Welcome() {
  const navigate = useNavigate();
  const location = useLocation();
  const alreadyOnboarded = useRef(sessionStore.getState().role === "patient" && hasAnyConsent(sessionStore.getState().consents));
  const [step, setStep] = useState(firstStep);

  if (alreadyOnboarded.current) return <Navigate to="/app" replace />;

  const destination = (location.state as { from?: string } | null)?.from;
  const finish = () => navigate(destination && destination !== "/app/welcome" ? destination : "/app", { replace: true });

  if (step === 0) return <LanguageStep total={totalSteps} onNext={() => setStep(1)} />;
  if (step === 1) return <PhoneStep total={totalSteps} onBack={() => setStep(0)} onNext={() => setStep(2)} />;
  if (step === 2) return <ConsentStep total={totalSteps} onBack={() => setStep(1)} onNext={() => setStep(3)} />;
  return <ProfileStep total={totalSteps} onBack={() => setStep(2)} onFinish={finish} />;
}
