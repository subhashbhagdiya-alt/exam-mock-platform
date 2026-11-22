"use client";

import { useEffect } from "react";

// Shown instead of a blank screen when the app hits an unexpected error while rendering.
// Inline styles on purpose: this screen must still look right if a stylesheet is the problem.
const styles = {
  page: {
    minHeight: "100svh",
    display: "grid",
    placeItems: "center",
    padding: "24px",
    background: "#090b10",
    color: "#f2f3fa",
    fontFamily: "'DM Sans','Noto Sans Devanagari',system-ui,sans-serif",
    textAlign: "center"
  },
  card: {
    maxWidth: "420px",
    width: "100%",
    padding: "28px 22px",
    borderRadius: "24px",
    border: "1px solid rgba(143,128,255,.35)",
    background: "rgba(143,128,255,.08)"
  },
  title: { margin: "0 0 6px", fontSize: "1.35rem", fontWeight: 700 },
  text: { margin: "0 0 20px", lineHeight: 1.5, color: "#b7bad0" },
  row: { display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" },
  primary: {
    padding: "12px 20px",
    borderRadius: "14px",
    border: 0,
    background: "#8f80ff",
    color: "#10101c",
    fontWeight: 700,
    fontSize: "1rem",
    cursor: "pointer"
  },
  secondary: {
    padding: "12px 20px",
    borderRadius: "14px",
    border: "1px solid rgba(143,128,255,.5)",
    background: "transparent",
    color: "#f2f3fa",
    fontWeight: 600,
    fontSize: "1rem",
    cursor: "pointer"
  }
};

export default function Error({ error, reset }) {
  useEffect(() => {
    // Details stay in the browser console; the screen below never shows raw error text.
    console.error("ExamPrep error:", error);
  }, [error]);

  return (
    <main style={styles.page} role="alert">
      <div style={styles.card}>
        <h1 style={styles.title}>कुछ गलत हो गया · Something went wrong</h1>
        <p style={styles.text}>
          कृपया दोबारा कोशिश करें। अगर समस्या बनी रहे तो पेज रीलोड करें।
          <br />
          Please try again. If it keeps happening, reload the page.
        </p>
        <div style={styles.row}>
          <button type="button" style={styles.primary} onClick={() => reset()}>
            दोबारा कोशिश · Try again
          </button>
          <button type="button" style={styles.secondary} onClick={() => window.location.reload()}>
            रीलोड · Reload
          </button>
        </div>
      </div>
    </main>
  );
}
