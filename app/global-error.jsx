"use client";

import { useEffect } from "react";

// Last-resort screen for errors in the root layout itself (error.jsx cannot catch those).
export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error("ExamPrep global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <main
          role="alert"
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: "24px",
            background: "#090b10",
            color: "#f2f3fa",
            fontFamily: "system-ui,sans-serif",
            textAlign: "center"
          }}
        >
          <div style={{ maxWidth: "420px" }}>
            <h1 style={{ margin: "0 0 8px", fontSize: "1.35rem" }}>कुछ गलत हो गया · Something went wrong</h1>
            <p style={{ margin: "0 0 20px", lineHeight: 1.5, color: "#b7bad0" }}>
              कृपया पेज रीलोड करें। · Please reload the page.
            </p>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                padding: "12px 20px",
                borderRadius: "14px",
                border: 0,
                background: "#8f80ff",
                color: "#10101c",
                fontWeight: 700,
                fontSize: "1rem",
                cursor: "pointer"
              }}
            >
              दोबारा कोशिश · Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
