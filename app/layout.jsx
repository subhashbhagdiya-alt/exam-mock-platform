import "./globals.css";
import "./glass-overrides.css";
import { Analytics } from '@vercel/analytics/next';

export const metadata = {
  title: "ExamPrep — Mock Test Platform",
  description: "Practice competitive exams with timed mock tests, instant feedback, offline access, and detailed performance analysis.",
  manifest: "/manifest.json"
};

export const viewport = {
  themeColor: "#8f80ff"
};

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}<Analytics /></body></html>;
}
