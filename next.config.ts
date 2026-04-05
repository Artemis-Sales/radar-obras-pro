import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_FIREBASE_API_KEY: "AIzaSyA-vAfWKcFbubd8T0-qCQTo7sZjiRiHEcI",
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "radar-de-obras.firebaseapp.com",
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: "radar-de-obras",
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "radar-de-obras.firebasestorage.app",
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "1027098254048",
    NEXT_PUBLIC_FIREBASE_APP_ID: "1:1027098254048:web:06e76dfdd3e89d9ffcce85",
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: "AIzaSyCC4CfL22VdfVybBuivAdadC5c8AupGT-0",
  },
};

export default nextConfig;
