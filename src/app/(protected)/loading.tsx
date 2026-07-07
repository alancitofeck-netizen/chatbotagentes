import { SessionLoadingScreen } from "@/components/auth/SessionLoadingScreen";

export default function ProtectedLoading() {
  return <SessionLoadingScreen title="Cargando sesión" description="Un momento, estamos preparando tu workspace." />;
}
