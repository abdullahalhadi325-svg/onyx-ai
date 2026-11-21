interface OnyxCapacitorConfig {
  appId: string;
  appName: string;
  webDir: string;
  server?: {
    androidScheme?: 'http' | 'https';
  };
  android?: {
    backgroundColor?: string;
  };
}

const config: OnyxCapacitorConfig = {
  appId: 'com.hadi.onyx',
  appName: 'Onyx',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    backgroundColor: '#000000',
  },
};

export default config;
