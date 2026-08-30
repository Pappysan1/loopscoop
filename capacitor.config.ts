import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.loopscoop.app',
  appName: 'Loop Scoop',
  webDir: 'dist/client',
  server: {
    androidScheme: 'https',
  },
}

export default config
