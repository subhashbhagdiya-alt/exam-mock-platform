import Link from "next/link";

export const metadata = { title: "Page not found — ExamPrep" };

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "100svh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background: "#090b10",
        color: "#f2f3fa",
        fontFamily: "'DM Sans','Noto Sans Devanagari',system-ui,sans-serif",
        textAlign: "center"
      }}
    >
      <div style={{ maxWidth: "420px" }}>
        <h1 style={{ margin: "0 0 8px", fontSize: "1.35rem" }}>पेज नहीं मिला · Page not found</h1>
        <p style={{ margin: "0 0 20px", lineHeight: 1.5, color: "#b7bad0" }}>
          यह पेज मौजूद नहीं है। · This page does not exist.
        </p>
        <Link
          href="/"
          style={{
            display: "inline-block",
            padding: "12px 20px",
            borderRadius: "14px",
            background: "#8f80ff",
            color: "#10101c",
            fontWeight: 700,
            textDecoration: "none"
          }}
        >
          होम पर जाएं · Back to home
        </Link>
      </div>
    </main>
  );
}
