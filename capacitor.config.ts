import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "fr.applyflow.app",
  appName: "ApplyFlow",
  webDir: "dist",
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_applyflow",
      iconColor: "#236753",
    },
    CapacitorSQLite: { androidIsEncryption: false },
  },
};
export default config;
