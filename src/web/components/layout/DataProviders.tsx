import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePageTitle } from "../../hooks/usePageTitle";

export function DataProviders({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } }));
  return (
    <QueryClientProvider client={client}>
      <TitleKeeper />
      {children}
    </QueryClientProvider>
  );
}

function TitleKeeper() {
  usePageTitle();
  return null;
}
