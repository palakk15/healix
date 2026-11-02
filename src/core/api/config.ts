export interface ApiConfig {
  getToken: () => string | undefined;
  isFastDemo: () => boolean;
}

export const apiConfig: ApiConfig = {
  getToken: () => undefined,
  isFastDemo: () => false,
};

export function configureApi(overrides: Partial<ApiConfig>): void {
  Object.assign(apiConfig, overrides);
}

export function authHeaders(): Record<string, string> {
  const token = apiConfig.getToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(apiConfig.isFastDemo() ? { "X-Fast-Demo": "1" } : {}),
  };
}
