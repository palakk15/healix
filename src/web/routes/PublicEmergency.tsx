import { Navigate } from "react-router-dom";
import { DataProviders } from "../components/layout/DataProviders";
import { EmergencyScreen } from "../components/signature/EmergencyScreen";
import { useSession } from "../store";

function Content() {
  const signedIn = useSession((state) => Boolean(state.accessToken));
  if (signedIn) return <Navigate to="/app/emergency" replace />;
  return <EmergencyScreen reasons={[]} summary="" publicMode />;
}

export default function PublicEmergency() {
  return (
    <DataProviders>
      <Content />
    </DataProviders>
  );
}
