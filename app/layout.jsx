import "./globals.css";
import "./glass-overrides.css";
import "./icon-finish.css";
import "./design-system-v1.css";
import "./exam-compact.css";
import "./dock-autohide.css";
import "./mobile-performance.css";
import DockAutoHide from "./dock-autohide.jsx";

export const metadata = {
  title: "ExamPrep — Mock Test Platform",
  description: "Practice competitive exams with timed mock tests, instant feedback, offline access, and detailed performance analysis.",
  manifest: "/manifest.json"
};

export const viewport = {
  themeColor: "#8f80ff"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* globals.css pulls Google Fonts through a CSS @import, which is discovered late.
            Opening both connections early removes two round-trips on slow mobile networks. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        {children}
        <DockAutoHide />
      </body>
    </html>
  );
}
