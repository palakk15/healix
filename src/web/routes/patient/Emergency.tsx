import { useSearchParams } from "react-router-dom";
import { activeProfile } from "@core/store/session";
import { EmergencyScreen } from "../../components/signature/EmergencyScreen";
import { useSession } from "../../store";

export default function Emergency() {
  const [params] = useSearchParams();
  const profile = useSession((state) => activeProfile(state));
  const summary = profile ? `${profile.name}, ${profile.age}. SOS pressed.` : "SOS pressed.";
  return <EmergencyScreen reasons={[]} summary={summary} autoShare={params.get("sos") === "1"} />;
}
