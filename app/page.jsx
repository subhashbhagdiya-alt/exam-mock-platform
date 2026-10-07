"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { ArrowRight, Award, BookOpen, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Download, Flame, Flag, Globe2, GraduationCap, Home, Info, Languages, ListChecks, RotateCcw, Search, ShieldCheck, SlidersHorizontal, Target, Trophy, X } from "lucide-react";

const supabaseBrowser = (
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
)
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    )
  : null;

async function hashRecoveryCode(code) {
  const data = new TextEncoder().encode(code.trim().toUpperCase());
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function ensureSessionKey() {
  if (typeof window === "undefined") throw new Error("Browser session is not available");
  let key = window.localStorage.getItem("exam_prep_session_key");
  if (!key) {
    key = crypto.randomUUID();
    window.localStorage.setItem("exam_prep_session_key", key);
  }
  return key;
}
const questionBank = [
  // Seed questions — this bank will be expanded and ranked by the exam-question pipeline.
  { id: 1, subject: "सामान्य ज्ञान", en: "Which is the largest planet in our Solar System?", hi: "हमारे सौरमंडल का सबसे बड़ा ग्रह कौन-सा है?", options: ["Earth / पृथ्वी", "Jupiter / बृहस्पति", "Saturn / शनि", "Neptune / वरुण"], answer: 1, explanation: "Jupiter is the largest planet in the Solar System. / बृहस्पति सौरमंडल का सबसे बड़ा ग्रह है।" },
  { id: 2, subject: "भारतीय संविधान", en: "When did the Constitution of India come into force?", hi: "भारत का संविधान कब लागू हुआ?", options: ["15 August 1947", "26 January 1950", "26 November 1949", "2 October 1950"], answer: 1, explanation: "The Constitution came into force on 26 January 1950. / संविधान 26 जनवरी 1950 को लागू हुआ।" },
  { id: 3, subject: "गणित", en: "What is the LCM of 12 and 18?", hi: "12 और 18 का लघुत्तम समापवर्त्य (LCM) क्या है?", options: ["24", "30", "36", "72"], answer: 2, explanation: "LCM(12,18) = 36. / LCM = 36." },
  { id: 4, subject: "विज्ञान", en: "Which gas do plants absorb during photosynthesis?", hi: "प्रकाश संश्लेषण के दौरान पौधे कौन-सी गैस ग्रहण करते हैं?", options: ["Oxygen / ऑक्सीजन", "Nitrogen / नाइट्रोजन", "Carbon dioxide / कार्बन डाइऑक्साइड", "Hydrogen / हाइड्रोजन"], answer: 2, explanation: "Plants absorb carbon dioxide during photosynthesis. / पौधे प्रकाश संश्लेषण में कार्बन डाइऑक्साइड ग्रहण करते हैं।" },
  { id: 5, subject: "इतिहास", en: "Who was the first President of India?", hi: "भारत के प्रथम राष्ट्रपति कौन थे?", options: ["Dr. Rajendra Prasad", "Dr. S. Radhakrishnan", "Jawaharlal Nehru", "Sardar Patel"], answer: 0, explanation: "Dr. Rajendra Prasad was India's first President. / डॉ. राजेंद्र प्रसाद भारत के प्रथम राष्ट्रपति थे।" },
  { id: 6, subject: "रीजनिंग", en: "Find the next number: 2, 6, 12, 20, 30, ?", hi: "अगली संख्या ज्ञात करें: 2, 6, 12, 20, 30, ?", options: ["36", "40", "42", "44"], answer: 2, explanation: "The differences increase by 2: +4, +6, +8, +10, so next is +12. / उत्तर 42 है।" },
  { id: 7, subject: "भूगोल", en: "Which is the longest river in India by length within the country?", hi: "भारत की सीमाओं के भीतर बहने वाली सबसे लंबी नदी कौन-सी है?", options: ["Yamuna / यमुना", "Ganga / गंगा", "Godavari / गोदावरी", "Narmada / नर्मदा"], answer: 1, explanation: "The Ganga is generally recognised as the longest river flowing within India. / भारत में गंगा सबसे लंबी नदी मानी जाती है।" },
  { id: 8, subject: "कंप्यूटर", en: "What does CPU stand for?", hi: "CPU का पूरा नाम क्या है?", options: ["Central Processing Unit", "Computer Power Utility", "Central Program User", "Core Processing Upload"], answer: 0, explanation: "CPU stands for Central Processing Unit. / CPU का अर्थ Central Processing Unit है।" },
  { id: 9, subject: "अर्थशास्त्र", en: "Which institution issues most currency notes in India?", hi: "भारत में अधिकांश करेंसी नोट कौन जारी करता है?", options: ["SBI", "Finance Commission", "Reserve Bank of India", "NITI Aayog"], answer: 2, explanation: "The RBI issues banknotes except the ₹1 note, issued by the Government of India. / ₹1 का नोट भारत सरकार जारी करती है।" },
  { id: 10, subject: "सामान्य ज्ञान", en: "What is the national animal of India?", hi: "भारत का राष्ट्रीय पशु कौन-सा है?", options: ["Asiatic lion / एशियाई शेर", "Bengal tiger / बंगाल टाइगर", "Elephant / हाथी", "Leopard / तेंदुआ"], answer: 1, explanation: "The Bengal tiger is India's national animal. / बंगाल टाइगर भारत का राष्ट्रीय पशु है।" }
];

const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return m + ":" + s;
};

export default function HomePage() {
  const [language, setLanguage] = useState("hi");
  const [view, setView] = useState("home");
  const [answers, setAnswers] = useState({});
  const [review, setReview] = useState([]);
  const [current, setCurrent] = useState(0);
  const [seconds, setSeconds] = useState(600);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [storageMessage, setStorageMessage] = useState("");
  const [showSubmit, setShowSubmit] = useState(false);
  const [testQuestions, setTestQuestions] = useState(questionBank);
  const [examConfig, setExamConfig] = useState({ total_questions: 10, duration_minutes: 10, marks_per_question: 1, negative_marks: 0, passing_percentage: 33 });
  const [examName, setExamName] = useState("MPESB Mock Test");
  const [examId, setExamId] = useState(null);
  const [exams, setExams] = useState([]);
  const [examsLoading, setExamsLoading] = useState(true);
  const [selectedExam, setSelectedExam] = useState("mpesb");
  const [jobTracks, setJobTracks] = useState([]);
  const [jobTracksLoading, setJobTracksLoading] = useState(true);
  const [selectedJobTrack, setSelectedJobTrack] = useState("mpesb-common");
  const [openExamGroup, setOpenExamGroup] = useState("MPESB");
  const [examFilter, setExamFilter] = useState("all");
  const [examQuery, setExamQuery] = useState("");
  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [user, setUser] = useState(null);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [authStep, setAuthStep] = useState("phone");
  const [authMessage, setAuthMessage] = useState("");
  const [practiceQuestionCount, setPracticeQuestionCount] = useState(10);
  const [practiceDuration, setPracticeDuration] = useState(10);
  const [availableQuestionCount, setAvailableQuestionCount] = useState(0);
  const [questionBankLoading, setQuestionBankLoading] = useState(false);
  const [questionLoadError, setQuestionLoadError] = useState("");
  const [nativeSimStatus, setNativeSimStatus] = useState("web");
  const [trustedDeviceVerified, setTrustedDeviceVerified] = useState(false);
  const [themeMode, setThemeMode] = useState("dark");
  const [splashVisible, setSplashVisible] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("exam_prep_theme");
    if (saved === "light" || saved === "dark" || saved === "system") setThemeMode(saved);
    const timer = window.setTimeout(() => setSplashVisible(false), 1800);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("exam_prep_theme", themeMode);
  }, [themeMode]);

  const effectiveTheme = themeMode === "system"
    ? (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : themeMode;

  const hi = language === "hi";
  const t = (h, e) => hi ? h : e;
  const q = testQuestions[current];
  const answered = Object.keys(answers).length;
  const filteredJobTracks = jobTracks.filter(track => {
    const categoryMatch = examFilter === "all" || track.exam_category === examFilter;
    const needle = examQuery.trim().toLowerCase();
    const text = `${track.name_hi || ""} ${track.name_en || ""} ${track.description_hi || ""} ${track.description_en || ""}`.toLowerCase();
    return categoryMatch && (!needle || text.includes(needle));
  });
  const selectedTrackData = jobTracks.find(track => track.slug === selectedJobTrack) || null;
  const examGroups = [
    { key: "MPESB", labelHi: "MPESB", labelEn: "MPESB", icon: "🏛️" },
    { key: "SSC", labelHi: "SSC", labelEn: "SSC", icon: "📝" },
    { key: "RPF", labelHi: "RPF", labelEn: "RPF", icon: "🛡️" },
    { key: "RRB", labelHi: "RRB / रेलवे", labelEn: "RRB / Railway", icon: "🚆" },
    { key: "OTHER", labelHi: "अन्य परीक्षाएँ", labelEn: "Other Exams", icon: "🎯" }
  ];
  const getExamGroup = (track) => {
    const board = String(track.exam_board || "").toUpperCase();
    if (board.includes("MPESB") || board.includes("ESB")) return "MPESB";
    if (board.includes("SSC")) return "SSC";
    if (board.includes("RPF")) return "RPF";
    if (board.includes("RRB") || board.includes("RAILWAY")) return "RRB";
    const slug = String(track.slug || "").toLowerCase();
    if (slug.startsWith("rpf-")) return "RPF";
    if (slug.startsWith("rrb-")) return "RRB";
    if (slug.startsWith("ssc-")) return "SSC";
    return "OTHER";
  };

  useEffect(() => {
    if (!supabaseBrowser) return undefined;
    let mounted = true;
    supabaseBrowser.auth.getSession().then(({ data }) => { if (mounted) setUser(data.session?.user || null); });
    const { data: listener } = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
      if (mounted) setUser(session?.user || null);
    });
    return () => { mounted = false; listener?.subscription?.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!user || !supabaseBrowser || typeof window === "undefined") {
      setTrustedDeviceVerified(false);
      return;
    }
    const existing = localStorage.getItem("exam_prep_device_key") || crypto.randomUUID();
    localStorage.setItem("exam_prep_device_key", existing);
    setTrustedDeviceVerified(false);
    (async () => {
      const { data: device, error } = await supabaseBrowser.from("user_devices").select("device_key").eq("user_id", user.id).maybeSingle();
      if (error) {
        setAuthMessage(t("Trusted device की जाँच नहीं हो सकी।","Trusted-device verification could not be completed."));
        await supabaseBrowser.auth.signOut();
        return;
      }
      if (device && device.device_key !== existing) {
        setAuthStep("recovery");
        setAuthMessage(t("यह अकाउंट दूसरे trusted device से जुड़ा है। पुराने device से recovery code लेकर यहाँ दर्ज करें।","This account is bound to another trusted device. Enter a recovery code generated on the old trusted device."));
        return;
      }
      if (!device) {
        const { error: bindError } = await supabaseBrowser.from("user_devices").insert({
          user_id: user.id,
          device_key: existing,
          phone: user.phone || null,
          last_seen_at: new Date().toISOString()
        });
        if (bindError) {
          setAuthMessage(t("यह डिवाइस trusted नहीं बन सका।","This device could not be trusted."));
          await supabaseBrowser.auth.signOut();
          return;
        }
      } else {
        await supabaseBrowser.from("user_devices").update({
          phone: user.phone || null,
          last_seen_at: new Date().toISOString()
        }).eq("user_id", user.id);
      }
      setTrustedDeviceVerified(true);
      setAuthMessage(t("लॉगिन सफल। यह डिवाइस trusted है।","Login successful. This device is trusted."));
    })();
  }, [user]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => { window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  useEffect(() => {
    if (view !== "test" || seconds <= 0) return undefined;
    const timer = setInterval(() => setSeconds(value => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [view, seconds]);

  useEffect(() => {
    if (otpCooldown <= 0) return undefined;
    const timer = setInterval(() => setOtpCooldown(value => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [otpCooldown]);

  useEffect(() => {
    if (!supabaseBrowser || typeof window === "undefined") return;
    async function flushOfflineResults() {
      try {
        const raw = localStorage.getItem("exam_prep_offline_results");
        const pending = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(pending) || !pending.length) return;
        const { data: sessionData } = await supabaseBrowser.auth.getSession();
        const accessToken = sessionData.session?.access_token || "";
        if (!accessToken) return;
        const remaining = [];
        for (const item of pending) {
          if (!item?.device_key || !item?.user_id || item.user_id !== sessionData.session?.user?.id) { remaining.push(item); continue; }
          const response = await fetch("/api/results", {
            method: "POST",
            headers: { "content-type": "application/json", Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify(item)
          });
          if (!response.ok) remaining.push(item);
        }
        localStorage.setItem("exam_prep_offline_results", JSON.stringify(remaining));
      } catch {}
    }
    flushOfflineResults();
    window.addEventListener("online", flushOfflineResults);
    return () => window.removeEventListener("online", flushOfflineResults);
  }, []);

  useEffect(() => {
    let active = true;
    async function loadExams() {
      try {
        const response = await fetch("/api/exams", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Could not load exams");
        const available = Array.isArray(payload.data) ? payload.data : [];
        if (active) {
          setExams(available);
          setExamsLoading(false);
          const preferred = available.find(item => item.slug === "mpesb") || available[0];
          if (preferred) {
            setSelectedExam(preferred.slug);
            setExamConfig({ total_questions:Number(preferred.total_questions || 10), duration_minutes:Number(preferred.duration_minutes || 10), marks_per_question:Number(preferred.marks_per_question || 1), negative_marks:Number(preferred.negative_marks || 0), passing_percentage:Number(preferred.passing_percentage || 33) });
            setExamId(preferred.id);
            setExamName(preferred.name || "Mock Test");
          }
        }
      } catch { if (active) setExamsLoading(false); }
    }
    loadExams();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadQuestionAvailability() {
      setQuestionBankLoading(true);
      try {
        const response = await fetch(`/api/questions?exam=${encodeURIComponent(selectedExam)}&limit=100`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Question bank unavailable");
        if (active) {
          const actual = Number(payload?.meta?.available || (Array.isArray(payload.data) ? payload.data.length : 0));
          setAvailableQuestionCount(actual);
          setQuestionLoadError("");
        }
      } catch (error) {
        if (active) {
          setAvailableQuestionCount(0);
          setQuestionLoadError(error?.message || "Question bank unavailable");
        }
      } finally {
        if (active) setQuestionBankLoading(false);
      }
    }
    loadQuestionAvailability();
    return () => { active = false; };
  }, [selectedExam]);

  async function requestNativeSimPermission() {
    const bridge = typeof window !== "undefined" ? window.ExamPrepNative : null;
    if (!bridge || typeof bridge.requestSimPermission !== "function") {
      setAuthMessage(t("SIM की अनुमति केवल Android app में दी जा सकती है। Browser/PWA SIM को पढ़ नहीं सकता।","SIM permission can only be granted in the Android app. A browser/PWA cannot read SIM state."));
      return;
    }
    try {
      const state = await bridge.requestSimPermission();
      setNativeSimStatus(state === "ready" ? "sim-ready" : "native");
      setAuthMessage(state === "ready" ? t("SIM verification चालू है।","SIM verification is enabled.") : t("SIM permission पूरी नहीं हुई।","SIM permission was not granted."));
    } catch (error) {
      setAuthMessage(error?.message || t("SIM permission नहीं मिल सकी।","SIM permission could not be granted."));
    }
  }

  useEffect(() => {
    let active = true;
    async function loadJobTracks() {
      try {
        const response = await fetch("/api/job-tracks", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Could not load job tracks");
        if (active) {
          setJobTracks(Array.isArray(payload.data) ? payload.data : []);
          setJobTracksLoading(false);
        }
      } catch { if (active) setJobTracksLoading(false); }
    }
    loadJobTracks();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadHistory() {
      try {
        const localRaw = typeof window !== "undefined" ? localStorage.getItem("exam_prep_local_history") : "[]";
        const localHistory = localRaw ? JSON.parse(localRaw) : [];
        const { data: sessionData } = await supabaseBrowser.auth.getSession();
        const accessToken = sessionData.session?.access_token || "";

        if (!accessToken) {
          if (active) setHistory(Array.isArray(localHistory) ? localHistory.slice(0, 50) : []);
          return;
        }

        const key = await ensureSessionKey();
        const deviceKey = typeof window !== "undefined" ? (localStorage.getItem("exam_prep_device_key") || "") : "";
        const response = await fetch(`/api/results?session_key=${encodeURIComponent(key)}`, {
          headers: { Authorization: `Bearer ${accessToken}`, ...(deviceKey ? { "x-device-key": deviceKey } : {}) }
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Could not load saved results");
        if (active) { setHistory([...(payload.data || []), ...(Array.isArray(localHistory) ? localHistory : [])].slice(0, 50)); setStorageMessage(""); }
      } catch (error) {
        if (active) setHistory(old => old.length ? old : []);
      }
    }
    loadHistory();
    return () => { active = false; };
  }, [user]);;

  useEffect(() => {
    if (view !== "test" || result) return;
    if (seconds <= 0) {
      finishTestRef.current?.();
      return;
    }
    const timer = setTimeout(() => setSeconds(s => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [view, seconds, result]);

  async function signInWithGoogle() {
    if (!supabaseBrowser) {
      setAuthMessage(t("Login सेवा अभी उपलब्ध नहीं है।","Login service is not available right now."));
      return;
    }
    setAuthMessage(t("Google login शुरू हो रहा है…","Starting Google login…"));
    const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
    const { error } = await supabaseBrowser.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo }
    });
    if (error) {
      const message = String(error.message || "");
      if (/provider.*not enabled|unsupported.*provider|not configured/i.test(message)) {
        setAuthMessage(t("Google Login अभी Supabase में enable नहीं है। Google OAuth provider configure करना होगा।","Google Login is not enabled in Supabase yet. Configure the Google OAuth provider first."));
      } else {
        setAuthMessage(message);
      }
    }
  }

  async function sendOtp() {
    if (otpCooldown > 0) return;
    if (!supabaseBrowser) {
      setAuthMessage(t("Login सेवा अभी उपलब्ध नहीं है।","Login service is not available right now."));
      return;
    }
    const digits = phone.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
    const normalized = `+91${digits}`;
    if (!/^\+91\d{10}$/.test(normalized)) {
      setAuthMessage(t("10 अंकों का भारतीय मोबाइल नंबर दर्ज करें।","Enter a valid 10-digit Indian mobile number."));
      return;
    }
    setAuthMessage(t("OTP भेजा जा रहा है…","Sending OTP…"));
    const { error } = await supabaseBrowser.auth.signInWithOtp({ phone: normalized, options: { channel: "sms" } });
    if (error) {
      const message = String(error.message || "");
      if (/unsupported phone provider/i.test(message) || /sms provider/i.test(message)) {
        setAuthMessage(t("SMS OTP सेवा अभी configured नहीं है। Supabase में SMS provider (जैसे Twilio/MessageBird/Vonage) configure करना होगा।","SMS OTP is not configured yet. Configure an SMS provider such as Twilio, MessageBird, or Vonage in Supabase Auth."));
      } else {
        setAuthMessage(message);
      }
    }
    else { setAuthStep("otp"); setOtp(""); setOtpCooldown(60); setAuthMessage(t("OTP भेज दिया गया है। 60 सेकंड बाद फिर भेज सकते हैं।","OTP sent. You can request another OTP after 60 seconds.")); }
  }

  async function verifyOtp() {
    if (!supabaseBrowser) {
      setAuthMessage(t("Login सेवा अभी उपलब्ध नहीं है।","Login service is not available right now."));
      return;
    }
    const digits = phone.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
    const normalized = `+91${digits}`;
    const token = otp.replace(/\s+/g, "");
    if (!/^\d{6}$/.test(token)) {
      setAuthMessage(t("6 अंकों का OTP दर्ज करें।","Enter the 6-digit OTP."));
      return;
    }
    setAuthMessage(t("OTP जाँचा जा रहा है…","Verifying OTP…"));
    const { error } = await supabaseBrowser.auth.verifyOtp({ phone: normalized, token, type: "sms" });
    if (error) setAuthMessage(error.message);
    else setAuthMessage(t("OTP सही है। Trusted device की जाँच हो रही है…","OTP verified. Checking trusted device…"));
  }

  async function createRecoveryCode() {
    if (!supabaseBrowser || !user || typeof window === "undefined") return;
    const deviceKey = localStorage.getItem("exam_prep_device_key") || "";
    if (!/^[0-9a-f-]{36}$/i.test(deviceKey)) {
      setAuthMessage(t("Trusted device की जानकारी नहीं मिली।","Trusted device information is unavailable."));
      return;
    }
    const bytes = new Uint8Array(9);
    crypto.getRandomValues(bytes);
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const code = Array.from(bytes, byte => alphabet[byte % alphabet.length]).join("");
    const codeHash = await hashRecoveryCode(code);
    const { data, error } = await supabaseBrowser.rpc("create_device_recovery_code", { p_device_key: deviceKey, p_code_hash: codeHash });
    if (error || data !== true) {
      setAuthMessage(error?.message || t("Recovery code नहीं बन सका।","Could not create a recovery code."));
      return;
    }
    setAuthMessage(t("Recovery code: " + code + " — इसे नए फोन में OTP के बाद दर्ज करें। यह 15 मिनट में expire होगा।","Recovery code: " + code + " — enter it on the new phone after OTP. It expires in 15 minutes."));
  }

  async function recoverTrustedDevice() {
    if (!supabaseBrowser || !user || typeof window === "undefined") return;
    const code = recoveryCode.replace(/\s+/g, "").toUpperCase();
    if (!/^[A-Z0-9]{9}$/.test(code)) {
      setAuthMessage(t("9 अक्षरों का recovery code दर्ज करें।","Enter the 9-character recovery code."));
      return;
    }
    const newDeviceKey = localStorage.getItem("exam_prep_device_key") || "";
    if (!/^[0-9a-f-]{36}$/i.test(newDeviceKey)) {
      setAuthMessage(t("नए device की पहचान नहीं मिली।","New-device identity is unavailable."));
      return;
    }
    const codeHash = await hashRecoveryCode(code);
    const { data, error } = await supabaseBrowser.rpc("consume_device_recovery_code", {
      p_code_hash: codeHash,
      p_new_device_key: newDeviceKey,
      p_phone: user.phone || null
    });
    if (error || data !== true) {
      setAuthMessage(error?.message || t("Recovery code गलत, expired या पहले इस्तेमाल हो चुका है।","Recovery code is invalid, expired, or already used."));
      return;
    }
    setTrustedDeviceVerified(true);
    setAuthStep("phone");
    setRecoveryCode("");
    setAuthMessage(t("नया device trusted बन गया।","The new device is now trusted."));
  }

  async function logout() {
    if (supabaseBrowser) await supabaseBrowser.auth.signOut();
    setUser(null);
    setAuthStep("phone");
    setOtp("");
    setRecoveryCode("");
    setTrustedDeviceVerified(false);
    setAuthMessage("");
  }

  async function startTest() {
    setAuthMessage("");
    if (!user) setAuthMessage(t("Guest practice mode: login के बिना टेस्ट शुरू हो रहा है। रिज़ल्ट इस device पर सेव होगा।","Guest practice mode: starting without login. The result will be saved on this device."));
    if (questionLoadError) { setAuthMessage(questionLoadError); return; }
    if (questionBankLoading) { setAuthMessage(t("सवाल अभी लोड हो रहे हैं। एक सेकंड रुककर फिर दबाएँ।","Questions are still loading. Wait a second and tap again.")); return; }
    const readyCount = Number(selectedTrackData?.verified_question_count || availableQuestionCount || 0);
    if (!readyCount) { setAuthMessage(t("इस परीक्षा के verified सवाल अभी उपलब्ध नहीं हैं।","Verified questions are not available for this exam yet.")); return; }
    const requestedCount = Math.min(Number(practiceQuestionCount || 10), readyCount);
    setAnswers({}); setReview([]); setCurrent(0); setSeconds(0); setResult(null); setShowSubmit(false); setTestQuestions([]);
    try {
      const response = await fetch(`/api/questions?exam=${encodeURIComponent(selectedExam)}&limit=${requestedCount}`, { cache: "no-store" });
      const payload = await response.json();
      if (response.ok && payload.exam) { const config = { total_questions: Number(payload.exam.total_questions || 10), duration_minutes: Number(payload.exam.duration_minutes || 10), marks_per_question: Number(payload.exam.marks_per_question || 1), negative_marks: Number(payload.exam.negative_marks || 0), passing_percentage: Number(payload.exam.passing_percentage || 33) }; setExamConfig(config); setExamName(String(payload.exam.name || "MPESB Mock Test")); setExamId(payload.exam.id || null); setSeconds(Number(config.duration_minutes || practiceDuration || 10) * 60); } else { setSeconds(Number(examConfig.duration_minutes || 10) * 60); }
      if (response.ok && Array.isArray(payload.data) && payload.data.length) {
        const mapped = payload.data.map((item, index) => ({
          id: index + 1,
          sourceId: item.id,
          subject: item.subject || "General",
          topic: item.topic || "",
          en: item.question_en || item.question_hi,
          hi: item.question_hi || item.question_en,
          options: Array.isArray(item.options) ? item.options : [],
          answer: Number(item.answer_index),
          explanation: item.explanation_hi || item.explanation_en || "",
          sourceType: item.source_type || "curated",
          sourceYear: item.source_year || null,
          predictionScore: Number(item.prediction_score || 0)
        })).filter(item => item.options.length === 4 && Number.isInteger(item.answer) && item.answer >= 0 && item.answer < 4);
        if (mapped.length) { setTestQuestions(mapped); setView("test"); }
        else {
          setTestQuestions([]);
          setAuthMessage(t("इस परीक्षा के सवाल वैध format में उपलब्ध नहीं हैं।","This exam's questions are not available in a valid format."));
          return;
        }
      } else {
        setTestQuestions([]);
        setAuthMessage(t("इस परीक्षा के verified सवाल अभी उपलब्ध नहीं हैं।","Verified questions are not available for this exam yet."));
        return;
      }
    } catch (error) {
      setTestQuestions([]);
      setAuthMessage(error?.message || t("Question bank लोड नहीं हो सका। कृपया दोबारा प्रयास करें।","The question bank could not be loaded. Please try again."));
      return;
    }
    setView("test");
  }
  const finishTestRef = useRef(null);

  async function finishTest() {
    if (result) return;
    const entries = Object.entries(answers);
    const correctCount = entries.filter(([id, a]) => testQuestions[Number(id)-1]?.answer === a).length;
    const wrongCount = entries.filter(([id, a]) => testQuestions[Number(id)-1]?.answer !== a).length;
    const unansweredCount = Math.max(0, testQuestions.length - entries.length);
    const grossMarks = correctCount * Number(examConfig.marks_per_question || 1);
    const negativeMarks = wrongCount * Number(examConfig.negative_marks || 0);
    const netScore = Math.max(0, grossMarks - negativeMarks);
    const accuracy = Math.round(correctCount / Math.max(1, testQuestions.length) * 100);
    const summary = { practice_mode: true, exam_id: examId, question_ids: Object.fromEntries(testQuestions.map(item => [String(item.id), item.sourceId]).filter(([, sourceId]) => sourceId)), correct: correctCount, wrong: wrongCount, unanswered: unansweredCount, score: netScore, gross_score: grossMarks, negative_score: negativeMarks, accuracy, answers: {...answers}, review_ids: [...review], language, total_questions: testQuestions.length, marks_per_question: Number(examConfig.marks_per_question || 1), negative_marks_per_question: Number(examConfig.negative_marks || 0), passing_percentage: Number(examConfig.passing_percentage || 33), test_name: examName };
    setResult(summary); setView("result"); setShowSubmit(false);

    const saveLocal = (pending = false) => {
      try {
        const key = pending ? "exam_prep_offline_results" : "exam_prep_local_history";
        const existing = JSON.parse(localStorage.getItem(key) || "[]");
        const item = {...summary, created_at: new Date().toISOString(), ...(pending ? {offline_pending:true, user_id: user?.id || null} : {})};
        localStorage.setItem(key, JSON.stringify([item, ...existing].slice(0, 50)));
        setHistory(old => [item, ...old].slice(0, 50));
      } catch {}
    };

    try {
      const sessionKey = await ensureSessionKey();
      const deviceKey = typeof window !== "undefined" ? (localStorage.getItem("exam_prep_device_key") || "") : "";
      const body = { session_key: sessionKey, practice_mode: true, requested_total_questions: practiceQuestionCount, requested_duration_minutes: practiceDuration, user_id: user?.id || null, device_key: deviceKey, ...summary };

      if (!navigator.onLine) {
        saveLocal(true);
        setStorageMessage(t("ऑफलाइन रिज़ल्ट सुरक्षित है; इंटरनेट आते ही sync होगा।","Result saved offline; it will sync automatically when you are back online."));
        return;
      }

      const { data: sessionData } = await supabaseBrowser.auth.getSession();
      const accessToken = sessionData.session?.access_token || "";

      // Guest practice is intentionally local-only. Cloud history requires an authenticated account.
      if (!accessToken) {
        saveLocal(false);
        setStorageMessage(t("Guest result इस device पर सुरक्षित है। Cloud sync के लिए login करें।","Guest result is saved on this device. Login to sync it to the cloud."));
        return;
      }

      const response = await fetch("/api/results", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Result could not be saved to cloud");
      setHistory(old => [payload.data, ...old].slice(0, 50));
      setStorageMessage("");
    } catch (error) {
      saveLocal(false);
      setStorageMessage(error?.message || "Result could not be saved to cloud");
    }
  }
  finishTestRef.current = finishTest;

  function chooseAnswer(index) { setAnswers(old => ({ ...old, [q.id]: index })); }
  function toggleReview() { setReview(old => old.includes(q.id) ? old.filter(n => n !== q.id) : [...old, q.id]); }

  return (
    <main className={"shell theme-" + effectiveTheme}>
      {splashVisible && <div className="splash-screen" aria-label="ExamPrep loading"><div className="splash-orbit splash-orbit-one"/><div className="splash-orbit splash-orbit-two"/><div className="splash-logo"><GraduationCap size={54}/></div><h1>EXAM <span>PREP</span></h1><p>Study Smarter • Score Higher</p><div className="splash-loader"><span/></div><small>Loading…</small></div>}
      <aside className="sidebar">
        <div className="brand"><div className="brand-icon"><GraduationCap size={23}/></div><span>Exam<span className="brand-accent">Prep</span><small>YOUR NEXT RANK STARTS HERE</small></span></div>
        <div className="side-label">{t("वर्कस्पेस","WORKSPACE")}</div>
        <button className={"nav-item " + (view === "home" ? "active" : "")} onClick={() => setView("home")}><Home size={18}/>{t("डैशबोर्ड","Dashboard")}</button><button className={"nav-item " + (view === "boards" ? "active" : "")} onClick={() => setView("boards")}><GraduationCap size={18}/>{t("परीक्षा बोर्ड","Exam boards")}</button>
        <button className={"nav-item " + (view !== "home" ? "active" : "")} onClick={startTest}><BookOpen size={18}/>{t("मॉक टेस्ट","Mock test")}</button>
        <button className="nav-item" onClick={() => setView("history")}><Award size={18}/>{t("मेरे रिज़ल्ट","My results")}</button>
        <button className={"nav-item " + (view === "sources" ? "active" : "")} onClick={() => setView("sources")}><Download size={18}/>{t("Source PDFs","Source PDFs")}</button>
        <div className="sidebar-bottom"><div className="daily-card"><div className="daily-icon"><Flame size={17}/></div><b>{t("लगातार अभ्यास करें","Keep your streak")}</b><p>{t("रोज़ थोड़ा अभ्यास, बेहतर रैंक।","Small daily practice. Better ranks.")}</p><div className="streak-dots"><i/><i/><i/><i/><i/><i/><i/></div></div><div className="profile"><div className="avatar">S</div><div><b>Subhash</b><span>{t("परीक्षा अभ्यर्थी","Exam candidate")}</span></div><ShieldCheck size={17} className="profile-check"/></div></div>
      </aside>

      <section className="main">
        <header className="topbar"><div className="breadcrumb">{t("आपकी तैयारी","Your preparation")} <span>/</span> <b>{view === "test" ? t("मॉक टेस्ट","Mock test") : view === "result" ? t("रिज़ल्ट","Results") : view === "history" ? t("मेरे रिज़ल्ट","My results") : view === "sources" ? t("Source PDFs","Source PDFs") : view === "about" ? t("ऐप के बारे में","About") : view === "boards" ? t("परीक्षा बोर्ड","Exam boards") : t("डैशबोर्ड","Dashboard")}</b></div><div className="top-actions"><span className={"live-pill " + (!isOnline ? "offline-pill" : "")}><i/> {isOnline ? t("सिस्टम तैयार","SYSTEM READY") : t("ऑफलाइन मोड","OFFLINE MODE")}</span><button className="lang-button" onClick={() => setLanguage(hi ? "en" : "hi")}><Languages size={16}/>{hi ? "हिंदी" : "English"}</button><button className="theme-toggle" onClick={() => setThemeMode(themeMode === "light" ? "dark" : themeMode === "dark" ? "system" : "light")} title={themeMode === "light" ? "Night mode" : themeMode === "dark" ? "System mode" : "Day mode"}>{themeMode === "light" ? "☀️" : themeMode === "dark" ? "🌙" : "◐"}<span>{themeMode === "light" ? t("दिन","Day") : themeMode === "dark" ? t("रात","Night") : t("सिस्टम","System")}</span></button><button className="menu-button" onClick={() => setMenuOpen(v=>!v)} aria-label="Menu"><SlidersHorizontal size={18}/></button>{menuOpen && <div className="menu-popover"><b>{t("दिखावट","Appearance")}</b><button onClick={() => {setThemeMode("light");setMenuOpen(false)}}>☀️ {t("Day Mode","Day Mode")}</button><button onClick={() => {setThemeMode("dark");setMenuOpen(false)}}>🌙 {t("Night Mode","Night Mode")}</button><button onClick={() => {setThemeMode("system");setMenuOpen(false)}}>◐ {t("System","System")}</button><hr/><button onClick={() => {setView("home");setMenuOpen(false)}}>{t("डैशबोर्ड","Dashboard")}</button><button onClick={() => {setView("boards");setMenuOpen(false)}}>{t("परीक्षा बोर्ड","Exam boards")}</button><button onClick={() => {setView("history");setMenuOpen(false)}}>{t("मेरे रिज़ल्ट","My results")}</button><button onClick={() => {setView("sources");setMenuOpen(false)}}>Source PDFs</button><button onClick={() => {setView("about");setMenuOpen(false)}}>{t("ऐप के बारे में","About ExamPrep")}</button></div>}</div></header>

        {view === "home" && <div className="content dashboard-content">{storageMessage && <div className="bottom-note"><div className="note-icon"><Info size={18}/></div><div><b>{t("डेटा सेव स्थिति","Storage status")}</b><p>{storageMessage}</p></div></div>}
          <div className="auth-panel" aria-label={t("वैकल्पिक लॉगिन","Optional login")}>
  <div><b>{user ? t("अकाउंट सक्रिय","Account active") : t("Guest Practice Mode","Guest Practice Mode")}</b><span>{user ? (user.email || user.phone || "") : t("लॉगिन जरूरी नहीं है। मॉक टेस्ट सीधे शुरू करें।","Login is optional. Start the mock test directly.")}</span></div>
  {user ? <button onClick={logout}>{t("लॉगआउट","Sign out")}</button> : <div className="auth-actions">
    <div className="guest-login-note">{t("लॉगिन optional है — नीचे मोबाइल लॉगिन केवल रिज़ल्ट cloud में sync करने के लिए है।","Login is optional — mobile login is only for syncing results to the cloud.")}</div>
    <div className="auth-divider"><span>{t("मोबाइल लॉगिन (वैकल्पिक)","OPTIONAL MOBILE LOGIN")}</span></div>
    {authStep === "phone" ? <><div className="phone-input"><span>+91</span><input value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,"").slice(0,10))} inputMode="numeric" autoComplete="tel-national" maxLength={10} placeholder="10 अंकों का मोबाइल नंबर"/></div><button onClick={sendOtp} disabled={otpCooldown > 0}>{otpCooldown > 0 ? `${t("फिर भेजें","Resend")} (${otpCooldown}s)` : t("OTP भेजें","Send OTP")}</button></> : authStep === "otp" ? <><input value={otp} onChange={e=>setOtp(e.target.value)} inputMode="numeric" maxLength={6} placeholder={t("6-digit OTP","6-digit OTP")}/><button onClick={verifyOtp}>{t("Verify","Verify")}</button></> : <><input value={recoveryCode} onChange={e=>setRecoveryCode(e.target.value.toUpperCase())} maxLength={9} placeholder={t("Recovery code","Recovery code")}/><button onClick={recoverTrustedDevice}>{t("Device बदलें","Replace device")}</button></>}
  </div>}
  {authMessage && <small>{authMessage}</small>}
</div>
<div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line"/> {t("आपके लक्ष्य, आपकी मेहनत","YOUR GOALS. YOUR GRIT.")}</div><h1>{t("नमस्ते, सुभाष","Hello, Subhash")} <span className="wave">✦</span><br/><span className="muted-heading">{t("आज कुछ नया सीखें।","Ready to level up today?")}</span></h1><p className="intro">{t("अपनी तैयारी को परखें, कमज़ोर विषय पहचानें और हर टेस्ट के साथ बेहतर बनें।","Test your knowledge, spot weak areas, and get better with every attempt.")}</p></div><div className="hero-emblem"><div className="emblem-ring"><GraduationCap size={47}/><span>EXAM<br/>READY</span></div><div className="orbit-dot dot-one"/><div className="orbit-dot dot-two"/></div></div>
          <div className="stats-grid"><div className="stat-card"><div className="stat-top"><span>{t("कुल मॉक टेस्ट","MOCK TESTS")}</span><div className="stat-icon purple"><BookOpen size={18}/></div></div><div className="stat-value">{history.length.toString().padStart(2,"0")}<small> / 50</small></div><div className="stat-foot">{t("हर प्रयास मायने रखता है","Every attempt counts")}</div></div><div className="stat-card"><div className="stat-top"><span>{t("सर्वश्रेष्ठ स्कोर","BEST SCORE")}</span><div className="stat-icon gold"><Trophy size={18}/></div></div><div className="stat-value">{history.length ? (() => { const best = history.reduce((a, h) => Number(h.score || 0) / Math.max(1, Number(h.total_questions || 10) * Number(h.marks_per_question || 1)) > Number(a.score || 0) / Math.max(1, Number(a.total_questions || 10) * Number(a.marks_per_question || 1)) ? h : a, history[0]); return best.score; })() : "—"}<small> / {history.length ? (() => { const best = history.reduce((a, h) => Number(h.score || 0) / Math.max(1, Number(h.total_questions || 10) * Number(h.marks_per_question || 1)) > Number(a.score || 0) / Math.max(1, Number(a.total_questions || 10) * Number(a.marks_per_question || 1)) ? h : a, history[0]); return Number(best.total_questions || 10) * Number(best.marks_per_question || 1); })() : 0}</small></div><div className="stat-foot">{t("अपना रिकॉर्ड तोड़ें","Beat your personal best")}</div></div><div className="stat-card"><div className="stat-top"><span>{t("औसत सटीकता","AVG. ACCURACY")}</span><div className="stat-icon green"><Target size={18}/></div></div><div className="stat-value">{history.length ? Math.round(history.reduce((a,h)=>a+h.accuracy,0)/history.length) : 0}<small>%</small></div><div className="stat-foot">{t("सही जवाबों का प्रतिशत","Correct answer rate")}</div></div></div>
          <div className="section-heading"><div><h2>{t("अपनी तैयारी शुरू करें","Pick up where you want to grow")}</h2><p>{t("छोटे कदम, बड़ी सफलता।","Focused practice makes progress.")}</p></div><span className="section-count">01 — 03</span></div>
          <div className="job-section">
            <div className="section-heading job-heading"><div><h2>{t("परीक्षा बोर्ड चुनें","Choose an exam board")}</h2><p>{t("पहले बोर्ड चुनें, फिर उसी बोर्ड की भर्ती/परीक्षा खोलें।","Choose a board first, then pick a recruitment or exam.")}</p></div><span className="section-count">{String(jobTracks.length).padStart(2,"0")} {t("पोस्ट","POSTS")}</span></div>
            <div className="exam-board-tabs" role="tablist" aria-label={t("परीक्षा बोर्ड","Exam boards")}>
              {examGroups.map(group => {
                const count = filteredJobTracks.filter(track => getExamGroup(track) === group.key).length;
                const ready = filteredJobTracks.filter(track => getExamGroup(track) === group.key && track.question_bank_ready === true && track.exam_slug).length;
                return <button key={group.key} type="button" role="tab" aria-selected={openExamGroup === group.key} className={"exam-board-tab " + (openExamGroup === group.key ? "active" : "")} onClick={() => setOpenExamGroup(group.key)}>
                  <span className="board-tab-icon">{group.icon}</span><span className="board-tab-copy"><b>{hi ? group.labelHi : group.labelEn}</b><small>{count} {t("पोस्ट","posts")}</small></span><em>{ready > 0 ? String(ready) + " READY" : "SOON"}</em>
                </button>;
              })}
            </div>
            <div className="exam-toolbar">
              <div className="exam-search"><Search size={15}/><input value={examQuery} onChange={e => setExamQuery(e.target.value)} placeholder={t("इस बोर्ड में परीक्षा खोजें…","Search this board…")} /></div>
              <div className="exam-filters"><button className={examFilter==="all" ? "active" : ""} onClick={() => setExamFilter("all")}><SlidersHorizontal size={13}/>{t("सभी","All")}</button><button className={examFilter==="recruitment" ? "active" : ""} onClick={() => setExamFilter("recruitment")}>{t("भर्ती","Recruitment")}</button><button className={examFilter==="entrance" ? "active" : ""} onClick={() => setExamFilter("entrance")}>{t("प्रवेश","Entrance")}</button><button className={examFilter==="eligibility" ? "active" : ""} onClick={() => setExamFilter("eligibility")}>{t("पात्रता","Eligibility")}</button></div>
            </div>
            <div className="exam-groups">{jobTracksLoading ? <div className="exam-loading">{t("परीक्षा बोर्ड लोड हो रहे हैं…","Loading exam boards…")}</div> : (() => {
              const group = examGroups.find(item => item.key === openExamGroup) || examGroups[0];
              const groupTracks = filteredJobTracks.filter(track => getExamGroup(track) === group.key);
              return <section className="exam-group exam-group-active">
                <div className="active-board-head"><div><span className="active-board-kicker">{group.icon} {t("चयनित बोर्ड","SELECTED BOARD")}</span><h3>{hi ? group.labelHi : group.labelEn}</h3></div><span>{groupTracks.length} {t("पोस्ट","posts")}</span></div>
                {groupTracks.length ? <div className="job-grid">{groupTracks.map((track,index) => <button key={track.slug} className={"job-card " + (selectedJobTrack === track.slug ? "selected" : "") + (track.status === "coming_soon" ? "coming" : "")} onClick={() => { if (track.status !== "question_bank_ready" || !track.exam_slug) return; setSelectedJobTrack(track.slug); setSelectedExam(track.exam_slug); setAvailableQuestionCount(Number(track.verified_question_count || 0)); setQuestionLoadError(""); const exam=exams.find(item => item.slug === track.exam_slug); if (exam) { setExamConfig({ total_questions:Number(exam.total_questions || 10), duration_minutes:Number(exam.duration_minutes || 10), marks_per_question:Number(exam.marks_per_question || 1), negative_marks:Number(exam.negative_marks || 0), passing_percentage:Number(exam.passing_percentage || 33) }); setExamId(exam.id); setExamName(exam.name || "Mock Test"); setPracticeDuration(Number(exam.duration_minutes || 10)); } }}>
                  <span className="job-number">{String(index + 1).padStart(2,"0")}</span><div className="job-3d-icon"><GraduationCap size={17}/></div>
                  <div className="job-copy"><b>{hi ? track.name_hi : track.name_en}</b><span>{hi ? track.description_hi : track.description_en}</span><small>{track.exam_date_text ? "📅 " + track.exam_date_text : "📅 2026"}{track.form_status_text ? " · " + track.form_status_text : ""}</small></div>
                  <em>{track.status === "question_bank_ready" ? t("अभी उपलब्ध","READY") : t("जल्द आएगा","SOON")}</em>
                  {selectedJobTrack === track.slug && <Check className="job-selected-check" size={15}/>}
                </button>)}</div> : <div className="exam-empty"><b>{t("इस बोर्ड में अभी कोई मैचिंग परीक्षा नहीं मिली।","No matching exams found for this board.")}</b><span>{t("सर्च हटाकर या दूसरा बोर्ड चुनकर देखें।","Clear the search or choose another board.")}</span></div>}
              </section>;
            })()}</div>
          </div>
          {selectedTrackData?.status === "question_bank_ready" && selectedTrackData?.exam_slug ? <>
<div className="selected-exam-strip"><div><span>{t("चयनित परीक्षा","SELECTED EXAM")}</span><b>{hi ? selectedTrackData.name_hi : selectedTrackData.name_en}</b></div><em>{availableQuestionCount > 0 ? "✓ " + availableQuestionCount + " " + t("सवाल तैयार","QUESTIONS READY") : t("बैंक जाँच रहे हैं…","CHECKING BANK…")}</em></div>
<div className="practice-config">
  <div className="config-block"><b>{t("सवाल कितने?","Questions")}</b><div className="config-options">{Array.from(new Set([10,20,30,40,50,availableQuestionCount].filter(n => n > 0 && n <= availableQuestionCount))).sort((a,b) => a-b).map(n=><button key={n} className={practiceQuestionCount===n?"active":""} onClick={()=>setPracticeQuestionCount(n)}>{n}</button>)}</div><small>{availableQuestionCount ? t(availableQuestionCount + " verified/active questions अभी उपलब्ध हैं।","There are " + availableQuestionCount + " active/verified questions right now.") : t("Verified question bank जाँच में है।","The verified question bank is being checked.")}</small></div>
  <div className="config-block"><b>{t("समय कितना?","Time")}</b><div className="config-options">{[10,20,30,45,60,120].map(n=><button key={n} className={practiceDuration===n?"active":""} onClick={()=>setPracticeDuration(n)}>{n}m</button>)}</div></div>
  <div className="config-block device-security"><b>{t("SIM / डिवाइस सुरक्षा","SIM / Device security")}</b><div className="config-options"><button onClick={requestNativeSimPermission}>{nativeSimStatus === "sim-ready" ? t("SIM चालू ✓","SIM active ✓") : t("SIM अनुमति दें","Allow SIM")}</button>{user && <button onClick={createRecoveryCode}>{t("नए फोन के लिए recovery code","Create recovery code")}</button>}</div><small>{t("Recovery code trusted device से बनता है, 15 मिनट में expire होता है और एक बार इस्तेमाल होता है।","Recovery code is created on the trusted device, expires in 15 minutes, and works once.")}</small></div>
</div>
</> : <div className="selection-empty">{t("ऊपर से READY परीक्षा चुनें।","Choose a READY exam above.")}<span>{t("SOON वाली परीक्षाएँ उपलब्ध होते ही unlock होंगी।","SOON exams unlock when their verified question bank is ready.")}</span></div>}
<div className="feature-grid"><article className="feature-card featured"><div className="feature-top"><div className="feature-icon"><ListChecks size={22}/></div><span className="tag">POPULAR</span></div><h3>{t("चयनित भर्ती का मॉक टेस्ट","Mock test for selected recruitment")}</h3><div className="selected-track"><span>{t("ट्रैक","TRACK")}</span><b>{jobTracks.find(item => item.slug === selectedJobTrack)?.name_hi || examName}</b></div><p>{t(`${examConfig.total_questions} सवाल · ${examConfig.duration_minutes} मिनट · तुरंत रिज़ल्ट`,`${examConfig.total_questions} questions · ${examConfig.duration_minutes} minutes · instant results`)}</p><div className="feature-meta"><span><Clock3 size={14}/> {examConfig.duration_minutes} min</span><span><Target size={14}/> {Number(examConfig.total_questions) * Number(examConfig.marks_per_question)} marks</span></div><button className="primary-button" disabled={questionBankLoading || !availableQuestionCount} onClick={startTest}>{questionBankLoading ? t("सवाल लोड हो रहे हैं…","Loading questions…") : t("टेस्ट शुरू करें","Start mock test")}<ArrowRight size={17}/></button>{!user ? <small className="start-hint">{t("Guest mode चालू है — login optional है।","Guest mode is enabled — login is optional.")}</small> : questionLoadError ? <small className="start-hint error-hint">{questionLoadError}</small> : null}<div className="card-decoration">01</div></article><article className="feature-card"><div className="feature-top"><div className="feature-icon green-icon"><Target size={22}/></div><span className="tag tag-green">PRACTICE</span></div><h3>{t("स्मार्ट रिविज़न","Smart revision")}</h3><p>{t("गलत जवाबों की समीक्षा करें और कॉन्सेप्ट मज़बूत करें।","Review explanations and strengthen concepts.")}</p><div className="mini-progress"><span style={{width: history.length ? "65%" : "8%"}}/></div><div className="feature-meta"><span>{t("आपकी प्रगति","Your progress")}</span><span>{history.length ? "65%" : "0%"}</span></div><button className="secondary-button" onClick={() => setView("history")}>{t("रिज़ल्ट देखें","View results")}<ArrowRight size={16}/></button></article><article className="feature-card"><div className="feature-top"><div className="feature-icon blue-icon"><Globe2 size={22}/></div><span className="tag tag-blue">BILINGUAL</span></div><h3>{t("हिंदी + English","Hindi + English")}</h3><p>{t("अपनी सुविधा के अनुसार भाषा बदलें।","Switch between Hindi and English anytime.")}</p><div className="language-pills"><span>अ आ इ</span><span>ABC</span></div><div className="feature-meta"><span>{t("दोनों भाषाओं में सवाल","Questions in both languages")}</span></div><button className="secondary-button" onClick={() => setLanguage(hi ? "en" : "hi")}>{t("English में बदलें","Switch to हिंदी")}<Languages size={16}/></button></article></div>
          <div className="bottom-note"><div className="note-icon"><ShieldCheck size={18}/></div><div><b>{t("आपकी तैयारी, आपकी रफ़्तार","Your preparation, your pace")}</b><p>{t("यह डेमो प्लेटफॉर्म है। अभ्यास के लिए प्रश्न दिए गए हैं; आधिकारिक परीक्षा के लिए नवीनतम सिलेबस देखें।","This is a demo practice platform. Check the latest official syllabus for your target exam.")}</p></div></div>
        </div>}

        {view === "test" && <div className="content test-content"><div className="test-title-row"><div><div className="eyebrow"><span className="eyebrow-line"/> {t("मॉक टेस्ट / परीक्षा","MOCK TEST / EXAM")}</div><h1>{examName}</h1><p className="intro">{t("सवाल ध्यान से पढ़ें। जरूरत हो तो रिव्यू के लिए मार्क करें।","Read carefully. Mark questions for review when needed.")}</p></div><div className={"timer-card " + (seconds < 60 ? "timer-warning" : "")}><Clock3 size={19}/><div><small>{t("बचा हुआ समय","TIME LEFT")}</small><strong>{formatTime(seconds)}</strong></div></div></div><div className="test-progress"><div><span>{t("टेस्ट की प्रगति","TEST PROGRESS")}</span><b>{answered} / {testQuestions.length} {t("जवाब दिए","answered")}</b></div><div className="progress-track"><span style={{width: (answered/testQuestions.length*100)+"%"}}/></div></div>
          <div className="test-layout"><div className="question-panel"><div className="question-meta"><span className="question-number">{t("सवाल","QUESTION")} {current + 1} <i/> {testQuestions.length}</span><span className="subject-chip">{q.subject}</span>{q.topic ? <span className="topic-chip">{q.topic}</span> : null}<span className="source-chip">{q.sourceType === "pyq" ? `PYQ${q.sourceYear ? ` ${q.sourceYear}` : ""}` : q.sourceType === "official" ? "OFFICIAL" : q.sourceType === "memory_based" ? "MEMORY-BASED" : "PRACTICE"}</span></div><h2>{hi ? q.hi : q.en}</h2><p className="question-hint">{t("सही विकल्प चुनें। आप अपना जवाब बदल सकते हैं।","Select one option. You can change your answer before submitting.")}</p><div className="options">{q.options.map((option,i)=><button key={option} className={"option " + (answers[q.id] === i ? "selected" : "")} onClick={() => chooseAnswer(i)}><span className="option-letter">{String.fromCharCode(65+i)}</span><span>{option}</span>{answers[q.id] === i ? <span className="radio-selected"/> : null}</button>)}</div>
          <div className="question-controls"><button className="secondary-button" disabled={current===0} onClick={() => setCurrent(c=>c-1)}><ChevronLeft size={17}/>{t("पिछला","Previous")}</button><button className={"review-button " + (review.includes(q.id) ? "review-on" : "")} onClick={toggleReview}><Flag size={16}/>{review.includes(q.id) ? t("रिव्यू हटाएँ","Unmark review") : t("रिव्यू के लिए","Mark for review")}</button>{current < testQuestions.length-1 ? <button className="primary-button next-button" onClick={() => setCurrent(c=>c+1)}>{t("अगला सवाल","Next question")}<ChevronRight size={17}/></button> : <button className="primary-button next-button" onClick={() => setShowSubmit(true)}>{t("टेस्ट सबमिट करें","Submit test")}<ArrowRight size={17}/></button>}</div></div>
          <aside className="question-nav"><div className="nav-heading"><h3>{t("सवालों की सूची","Question palette")}</h3><span>{answered}/{testQuestions.length}</span></div><p>{t("किसी सवाल पर जाने के लिए नंबर चुनें।","Tap a number to jump to a question.")}</p><div className="number-grid">{testQuestions.map((item,i)=><button key={item.id} onClick={() => setCurrent(i)} className={"number-cell " + (current===i ? "current" : "") + (answers[item.id] !== undefined ? " answered" : "") + (review.includes(item.id) ? " marked" : "")}>{String(item.id).padStart(2,"0")}{review.includes(item.id) && <i/>}</button>)}</div><div className="legend"><span><i className="legend-answered"/> {t("जवाब दिया","Answered")}</span><span><i className="legend-marked"/> {t("रिव्यू","Review")}</span><span><i className="legend-empty"/> {t("बाकी","Not answered")}</span></div><div className="nav-summary"><div><span>{t("जवाब दिए","Answered")}</span><b>{answered}</b></div><div><span>{t("बाकी सवाल","Remaining")}</span><b>{testQuestions.length-answered}</b></div><div><span>{t("रिव्यू के लिए","For review")}</span><b>{review.length}</b></div></div><button className="submit-full" onClick={() => setShowSubmit(true)}>{t("टेस्ट समाप्त करें","Finish test")}<ArrowRight size={16}/></button></aside></div>
          {showSubmit && <div className="modal-backdrop"><div className="confirm-modal"><div className="modal-icon"><Flag size={22}/></div><h2>{t("टेस्ट सबमिट करें?","Submit your test?")}</h2><p>{t("आपने","You have answered")} {answered} {t("में से "+testQuestions.length+" सवालों के जवाब दिए हैं। सबमिट करने के बाद जवाब नहीं बदल पाएँगे।","of the selected questions. You cannot change answers after submission.")}</p><div className="modal-actions"><button className="secondary-button" onClick={() => setShowSubmit(false)}>{t("वापस जाएँ","Go back")}</button><button className="primary-button" onClick={finishTest}>{t("हाँ, सबमिट करें","Yes, submit")}</button></div></div></div>}
        </div>}

        {view === "result" && result && <div className="content result-content">
          <div className="result-hero">
            <div className="result-trophy"><Trophy size={37}/></div>
            <div className="eyebrow"><span className="eyebrow-line"/> SESSION COMPLETE</div>
            <h1>{t("शानदार प्रयास, सुभाष!","Great effort, Subhash!")}</h1>
            <p>{t("हर टेस्ट आपको आपके लक्ष्य के और करीब ले जाता है।","Every attempt takes you one step closer to your goal.")}</p>
            <p>{t("नेट स्कोर:","Net score:")} <b>{result.score}</b> · {t("कटौती:","Negative:")} <b>{result.negative_score}</b></p>
            <div className="score-circle"><div><strong>{result.score}<small>/{Number(result.total_questions || 0) * Number(result.marks_per_question || 1)}</small></strong><span>{t("आपका स्कोर","YOUR SCORE")}</span></div></div>
          </div>
          <div className="result-insight">
            <div className="result-insight-main">
              <span>{t("आपका प्रदर्शन","YOUR PERFORMANCE")}</span>
              <b>{result.accuracy >= 80 ? t("बहुत बढ़िया!","Excellent!") : result.accuracy >= 60 ? t("अच्छी प्रगति","Good progress") : t("अभ्यास जारी रखें","Keep practicing")}</b>
              <p>{result.accuracy >= 60 ? t("गलत और बिना जवाब वाले सवालों की समीक्षा करके consistency बढ़ाएँ।","Review incorrect and unanswered questions to improve consistency.") : t("गलत और बिना जवाब वाले सवालों को दोबारा पढ़ें और अगली कोशिश में सुधार करें।","Review incorrect and unanswered questions and improve on the next attempt.")}</p>
            </div>
            <div className="performance-meter"><span>{t("सटीकता","Accuracy")}</span><strong>{result.accuracy}%</strong><div><i style={{width: Math.min(100, Math.max(0, Number(result.accuracy) || 0)) + "%"}}/></div></div>
          </div>
          <div className="result-stats">
            <div className="result-stat"><CheckCircle2 size={19}/><span>{t("सही जवाब","Correct")}</span><b>{result.correct}</b></div>
            <div className="result-stat"><Target size={19}/><span>{t("Gross Marks","Gross marks")}</span><b>{result.gross_score}</b></div>
            <div className="result-stat wrong-stat"><X size={19}/><span>{t("Negative Marks","Negative marks")}</span><b>-{result.negative_score}</b></div>
            <div className="result-stat wrong-stat"><X size={19}/><span>{t("गलत जवाब","Incorrect")}</span><b>{result.wrong}</b></div>
            <div className="result-stat unanswered-stat"><Clock3 size={19}/><span>{t("बिना जवाब","Unanswered")}</span><b>{result.unanswered}</b></div>
            <div className="result-stat accuracy-stat"><Target size={19}/><span>{t("सटीकता","Accuracy")}</span><b>{result.accuracy}%</b></div>
          </div>
          <div className="subject-analysis">
            <div className="section-heading"><div><h2>{t("विषयवार प्रदर्शन","Subject performance")}</h2><p>{t("किस विषय में पकड़ मजबूत है और कहाँ सुधार चाहिए।","See your strengths and where to improve.")}</p></div><span className="section-count">ANALYSIS</span></div>
            <div className="subject-list">
              {Object.entries(testQuestions.reduce((acc,item) => {
                const key = item.subject || "General";
                const row = acc[key] || {total:0, correct:0};
                row.total += 1;
                if (answers[item.id] === item.answer) row.correct += 1;
                acc[key] = row;
                return acc;
              }, {})).map(([subject,data]) => {
                const pct = Math.round(data.correct / Math.max(1,data.total) * 100);
                return <div className="subject-row" key={subject}><div className="subject-row-head"><b>{subject}</b><span>{data.correct}/{data.total} · {pct}%</span></div><div className="subject-bar"><i style={{width: pct + "%"}}/></div></div>;
              })}
            </div>
          </div>
          <div className="review-panel">
            <div className="section-heading"><div><h2>{t("सवालों की समीक्षा","Review your answers")}</h2><p>{t("सही उत्तर और व्याख्या देखें।","See the correct answer and explanation.")}</p></div><span className="section-count">{result.total_questions} QUESTIONS</span></div>
            {testQuestions.map((item,i) => {
              const answer = answers[item.id];
              const isRight = answer === item.answer;
              return <div className="review-question" key={item.id}><div className={"review-status " + (answer === undefined ? "status-empty" : isRight ? "status-right" : "status-wrong")}>{answer === undefined ? "—" : isRight ? <Check size={16}/> : <X size={16}/>}</div><div className="review-body"><b>{i+1}. {hi ? item.hi : item.en}</b><span>{t("आपका जवाब:","Your answer:")} {answer === undefined ? t("जवाब नहीं दिया","Not answered") : item.options[answer]}</span><span className="correct-answer">{t("सही जवाब:","Correct answer:")} {item.options[item.answer]}</span><p>{item.explanation}</p></div></div>;
            })}
          </div>
          <div className="result-actions"><button className="secondary-button" onClick={() => setView("home")}><Home size={17}/>{t("डैशबोर्ड","Dashboard")}</button><button className="primary-button" onClick={startTest}><RotateCcw size={17}/>{t("फिर से टेस्ट दें","Retake test")}</button></div>
        </div>}


        {view === "sources" && <div className="content">
          <div className="eyebrow"><span className="eyebrow-line"/> SOURCE LIBRARY</div>
          <h1>{t("Source PDFs","Source PDFs")}</h1>
          <p className="intro">{t("हर परीक्षा के मूल/स्रोत question-paper pages यहाँ मिलेंगे। PDF खोलकर सीधे डाउनलोड कर सकते हैं।","Open the original source-paper page for each exam and download the PDF directly.")}</p>
          <div className="feature-grid">
            <article className="feature-card featured"><div className="feature-top"><div className="feature-icon"><Download size={22}/></div><span className="tag">OFFICIAL</span></div><h3>MPESB Source Papers</h3><p>{t("MPESB की official question paper और candidate-response library.","Official MPESB question-paper and candidate-response library.")}</p><a className="primary-button" href="https://esb.mp.gov.in/Question%20Paper%20and%20Candidate%20Responses/Question_Objection.asp" target="_blank" rel="noreferrer">{t("PDF Library खोलें","Open PDF Library")}<Download size={17}/></a></article>
            <article className="feature-card"><div className="feature-top"><div className="feature-icon green-icon"><Download size={22}/></div><span className="tag tag-green">RPF</span></div><h3>RPF Constable 2025</h3><p>{t("23 shift-wise question-paper PDFs.","23 shift-wise question-paper PDFs.")}</p><a className="secondary-button" href="https://docs.aglasem.com/org/railway/rpf-constable/question-paper" target="_blank" rel="noreferrer">{t("Papers देखें","View papers")}<Download size={16}/></a></article>
            <article className="feature-card"><div className="feature-top"><div className="feature-icon blue-icon"><Download size={22}/></div><span className="tag tag-blue">RRB</span></div><h3>RRB ALP / Railway</h3><p>{t("RRB ALP और Railway previous-paper libraries.","RRB ALP and Railway previous-paper libraries.")}</p><a className="secondary-button" href="https://testbook.com/rrb-alp/previous-year-papers" target="_blank" rel="noreferrer">{t("ALP papers देखें","View ALP papers")}<Download size={16}/></a></article>
          </div>
          <div className="job-section">
            <div className="section-heading"><div><h2>{t("बाकी source libraries","More source libraries")}</h2><p>{t("इन pages से original PDF डाउनलोड करें; ExamPrep केवल source index रखता है।","Use these source pages to download the original PDFs; ExamPrep keeps the source index.")}</p></div><span className="section-count">SOURCE INDEX</span></div>
            <div className="job-grid">
              <a className="job-card" href="https://career.aglasem.com/index.php/railway/rrb-group-d/previous-papers/2025" target="_blank" rel="noreferrer"><div className="job-copy"><b>RRB Group D 2025</b><span>Shift-wise previous-year PDFs</span></div><em>PDF ↗</em></a>
              <a className="job-card" href="https://career.aglasem.com/index.php/railway/rrb-ntpc/previous-papers/2025" target="_blank" rel="noreferrer"><div className="job-copy"><b>RRB NTPC 2025</b><span>Graduate + Undergraduate papers</span></div><em>PDF ↗</em></a>
              <a className="job-card" href="https://career.aglasem.com/ssc/ssc-gd/previous-papers/" target="_blank" rel="noreferrer"><div className="job-copy"><b>SSC GD</b><span>Previous-year / shift-wise papers</span></div><em>PDF ↗</em></a>
              <a className="job-card" href="https://esb.mp.gov.in/Old_Question_Papers/old_question_papers.htm" target="_blank" rel="noreferrer"><div className="job-copy"><b>MPESB Old Papers</b><span>Official archive</span></div><em>PDF ↗</em></a>
            </div>
          </div>
          <div className="bottom-note"><div className="note-icon"><ShieldCheck size={18}/></div><div><b>{t("Source integrity","Source integrity")}</b><p>{t("Third-party copyrighted PDFs को हम अपनी site पर copy/re-host नहीं करते; original source/download page पर भेजते हैं।","We link to third-party original/download pages instead of copying or re-hosting copyrighted PDFs.")}</p></div></div>
        </div>}

        {view === "history" && <div className="content">{storageMessage && <div className="bottom-note"><div className="note-icon"><Info size={18}/></div><div><b>{t("डेटा सेव स्थिति","Storage status")}</b><p>{storageMessage}</p></div></div>}<div className="eyebrow"><span className="eyebrow-line"/> YOUR JOURNEY</div><h1>{t("आपके रिज़ल्ट","Your results")}</h1><p className="intro">{t("आपके हाल के मॉक टेस्ट और प्रगति यहाँ दिखाई देंगे।","Your recent mock test attempts and progress appear here.")}</p>{history.length ? <div className="history-list">{history.map((h,i)=><div className="history-item" key={i}><div className="history-icon"><Award size={21}/></div><div className="history-main"><b>{h.test_name || t("क्विक मॉक टेस्ट","Quick mock test")}</b><span>{t("प्रयास","Attempt")} {history.length-i} · {h.accuracy}% {t("सटीकता","accuracy")}</span></div><strong>{h.score}/{Number(h.total_questions || 10) * Number(h.marks_per_question || 1)}</strong><span className="history-grade">{(Number(h.score || 0) / Math.max(1, Number(h.total_questions || 10) * Number(h.marks_per_question || 1))) >= 0.8?t("बहुत अच्छा","Great"):(Number(h.score || 0) / Math.max(1, Number(h.total_questions || 10) * Number(h.marks_per_question || 1))) >= 0.5?t("अच्छा प्रयास","Good effort"):t("अभ्यास जारी रखें","Keep practicing")}</span></div>)}</div> : <div className="empty-state"><div className="empty-icon"><BookOpen size={28}/></div><h2>{t("आपका पहला टेस्ट इंतज़ार कर रहा है","Your first test is waiting")}</h2><p>{t("टेस्ट पूरा करने के बाद आपका स्कोर और विश्लेषण यहाँ दिखाई देगा।","Complete a mock test to see your score and analysis here.")}</p><button className="primary-button" disabled={!availableQuestionCount} onClick={startTest}>{t("पहला टेस्ट शुरू करें","Start your first test")}<ArrowRight size={17}/></button></div>}</div>}

        <footer className="footer"><span>© 2026 ExamPrep</span><span>{t("अभ्यास • प्रगति • सफलता","PRACTICE · PROGRESS · SUCCESS")}</span><span>{t("आपकी तैयारी जारी है","Keep showing up ✦")}</span></footer>
      </section>
    </main>
  );
}
