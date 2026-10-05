import "./globals.css";

export const metadata = {
  title: "ExamPrep — Mock Test Platform",
  description: "Practice competitive exams with timed mock tests, instant feedback, and detailed performance analysis."
};

export default function RootLayout({ children }) {
  return <html lang="hi"><body>{children}</body></html>;
}
