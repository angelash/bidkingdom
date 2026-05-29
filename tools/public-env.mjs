export function applyPublicEnvDefaults() {
  const defaults = {
    BITKINGDOM_WEB_PORT: '5188',
    BITKINGDOM_PORT: '5187',
    VITE_SERVER_URL: 'https://kingdom-server.iepose.cn',
    BITKINGDOM_CORS_ORIGIN: 'https://kingdom-web.iepose.cn',
    BITKINGDOM_WEB_SERVE: 'preview',
    BITKINGDOM_WEB_DISABLE_HMR: '1',
    BITKINGDOM_WEB_PUBLIC_HOST: 'kingdom-web.iepose.cn',
    BITKINGDOM_WEB_PUBLIC_PROTOCOL: 'wss',
    BITKINGDOM_WEB_PUBLIC_CLIENT_PORT: '443'
  };

  for (const [key, value] of Object.entries(defaults)) {
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}
