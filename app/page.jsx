"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { ArrowRight, Award, BookOpen, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Flame, Flag, Globe2, GraduationCap, Home, Info, Languages, ListChecks, RotateCcw, Search, ShieldCheck, SlidersHorizontal, Target, Trophy, X } from "lucide-react";

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
  const [selectedExam, setSelectedExam] = useState("mpesb");
  const [jobTracks, setJobTracks] = useState([]);
  const [selectedJobTrack, setSelectedJobTrack] = useState("mpesb-common");
  const [examFilter, setExamFilter] = useState("all");
  const [examQuery, setExamQuery] = useState("");
  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [user, setUser] = useState(null);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [authStep, setAuthStep] = useState("phone");
  const [authMessage, setAuthMessage] = useState("");
  const [practiceQuestionCount, setPracticeQuestionCount] = useState(10);
  const [practiceDuration, setPracticeDuration] = useState(10);
  const [availableQuestionCount, setAvailableQuestionCount] = useState(0);
  const [nativeSimStatus, setNativeSimStatus] = useState("web");
  const [trustedDeviceVerified, setTrustedDeviceVerified] = useState(false);
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

  useEffect(() => {
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
          if (!item?.device_key) { remaining.push(item); continue; }
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
          const preferred = available.find(item => item.slug === "mpesb") || available[0];
          if (preferred) {
            setSelectedExam(preferred.slug);
            setExamConfig({ total_questions:Number(preferred.total_questions || 10), duration_minutes:Number(preferred.duration_minutes || 10), marks_per_question:Number(preferred.marks_per_question || 1), negative_marks:Number(preferred.negative_marks || 0), passing_percentage:Number(preferred.passing_percentage || 33) });
            setExamId(preferred.id);
            setExamName(preferred.name || "Mock Test");
          }
        }
      } catch {}
    }
    loadExams();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadQuestionAvailability() {
      try {
        const response = await fetch(`/api/questions?exam=${encodeURIComponent(selectedExam)}&limit=50`, { cache: "no-store" });
        const payload = await response.json();
        if (active) setAvailableQuestionCount(Array.isArray(payload.data) ? payload.data.length : 0);
      } catch { if (active) setAvailableQuestionCount(0); }
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
        if (active) setJobTracks(Array.isArray(payload.data) ? payload.data : []);
      } catch {}
    }
    loadJobTracks();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadHistory() {
      try {
        const key = await ensureSessionKey();
        const { data: sessionData } = await supabaseBrowser.auth.getSession();
        const accessToken = sessionData.session?.access_token || "";
        const deviceKey = typeof window !== "undefined" ? (localStorage.getItem("exam_prep_device_key") || "") : "";
        const response = await fetch(`/api/results?session_key=${encodeURIComponent(key)}`, {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}`, ...(deviceKey ? { "x-device-key": deviceKey } : {}) } : {}
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Could not load saved results");
        if (active) { setHistory(payload.data || []); setStorageMessage(""); }
      } catch (error) {
        if (active) setStorageMessage(error?.message || "Could not load saved results");
      }
    }
    loadHistory();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (view !== "test" || result) return;
    if (seconds <= 0) { finishTest(); return; }
    const timer = setTimeout(() => setSeconds(s => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [view, seconds, result]);

  async function sendOtp() {
    if (!supabaseBrowser) {
      setAuthMessage(t("Login सेवा अभी उपलब्ध नहीं है।","Login service is not available right now."));
      return;
    }
    const normalized = phone.replace(/\s+/g, "");
    if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
      setAuthMessage(t("मोबाइल नंबर +91XXXXXXXXXX जैसे लिखें।","Enter the number in international format, e.g. +91XXXXXXXXXX."));
      return;
    }
    setAuthMessage(t("OTP भेजा जा रहा है…","Sending OTP…"));
    const { error } = await supabaseBrowser.auth.signInWithOtp({ phone: normalized, options: { channel: "sms" } });
    if (error) setAuthMessage(error.message);
    else { setAuthStep("otp"); setOtp(""); setAuthMessage(t("OTP भेज दिया गया है।","OTP sent.")); }
  }

  async function verifyOtp() {
    if (!supabaseBrowser) {
      setAuthMessage(t("Login सेवा अभी उपलब्ध नहीं है।","Login service is not available right now."));
      return;
    }
    const normalized = phone.replace(/\s+/g, "");
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
    setAuthStep("phone");
    setRecoveryCode("");
    setAuthMessage(t("नया device trusted बन गया।","The new device is now trusted."));
  }

  async function logout() {
    if (supabaseBrowser) await supabaseBrowser.auth.signOut();
    setUser(null);
    setAuthStep("phone");
    setOtp("");
  }

  async function startTest() {
    if (!user) { setAuthMessage(t("पहले मोबाइल नंबर से लॉगिन करें।","Please sign in with your mobile number first.")); return; }
    if (!trustedDeviceVerified) { setAuthMessage(t("Trusted device verification पूरी होने तक test शुरू नहीं किया जा सकता।","The test cannot start until trusted-device verification is complete.")); return; }
    if (!availableQuestionCount || practiceQuestionCount > availableQuestionCount) { setAuthMessage(t("इस परीक्षा के लिए चुने गए सवाल अभी उपलब्ध नहीं हैं।","The selected number of questions is not currently available for this exam.")); return; }
    setAnswers({}); setReview([]); setCurrent(0); setSeconds(0); setResult(null); setShowSubmit(false);
    try {
      const response = await fetch(`/api/questions?exam=${encodeURIComponent(selectedExam)}&limit=${practiceQuestionCount}`, { cache: "no-store" });
      const payload = await response.json();
      if (response.ok && payload.exam) { const config = { total_questions: Number(payload.exam.total_questions || 10), duration_minutes: Number(payload.exam.duration_minutes || 10), marks_per_question: Number(payload.exam.marks_per_question || 1), negative_marks: Number(payload.exam.negative_marks || 0), passing_percentage: Number(payload.exam.passing_percentage || 33) }; setExamConfig(config); setExamName(String(payload.exam.name || "MPESB Mock Test")); setExamId(payload.exam.id || null); setSeconds(practiceDuration * 60); } else { setSeconds(Number(examConfig.duration_minutes || 10) * 60); }
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
        if (mapped.length) setTestQuestions(mapped);
        else setTestQuestions(questionBank);
      } else {
        setTestQuestions(questionBank);
      }
    } catch {
      setTestQuestions(questionBank);
    }
    setView("test");
  }
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
    try {
      const sessionKey = await ensureSessionKey();
      const deviceKey = typeof window !== "undefined" ? (localStorage.getItem("exam_prep_device_key") || "") : "";
       const body = { session_key: sessionKey, practice_mode: true, requested_total_questions: practiceQuestionCount, requested_duration_minutes: practiceDuration, user_id: user?.id || null, device_key: deviceKey, ...summary };
      if (!navigator.onLine) {
        const pending = JSON.parse(localStorage.getItem("exam_prep_offline_results") || "[]");
        localStorage.setItem("exam_prep_offline_results", JSON.stringify([...pending, body].slice(-20)));
        setStorageMessage(t("ऑफलाइन रिज़ल्ट सुरक्षित है; इंटरनेट आते ही sync होगा।","Result saved offline; it will sync automatically when you are back online."));
        setHistory(old => [{...summary, created_at: new Date().toISOString(), offline_pending: true}, ...old].slice(0, 50));
        return;
      }
      const { data: sessionData } = await supabaseBrowser.auth.getSession();
      const accessToken = sessionData.session?.access_token || "";
      const response = await fetch("/api/results", {
        method: "POST",
        headers: { "content-type": "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
        body: JSON.stringify(body)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Result could not be saved to cloud");
      setHistory(old => [payload.data, ...old].slice(0, 50));
      setStorageMessage("");
    } catch (error) {
      setStorageMessage(error?.message || "Result could not be saved to cloud");
      setHistory(old => [{...summary, created_at: new Date().toISOString()}, ...old].slice(0, 50));
    }
  }
  function chooseAnswer(index) { setAnswers(old => ({ ...old, [q.id]: index })); }
  function toggleReview() { setReview(old => old.includes(q.id) ? old.filter(n => n !== q.id) : [...old, q.id]); }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-icon"><GraduationCap size={23}/></div><span>Exam<span className="brand-accent">Prep</span><small>YOUR NEXT RANK STARTS HERE</small></span></div>
        <div className="side-label">{t("वर्कस्पेस","WORKSPACE")}</div>
        <button className={"nav-item " + (view === "home" ? "active" : "")} onClick={() => setView("home")}><Home size={18}/>{t("डैशबोर्ड","Dashboard")}</button>
        <button className={"nav-item " + (view !== "home" ? "active" : "")} onClick={startTest}><BookOpen size={18}/>{t("मॉक टेस्ट","Mock test")}</button>
        <button className="nav-item" onClick={() => setView("history")}><Award size={18}/>{t("मेरे रिज़ल्ट","My results")}</button>
        <div className="sidebar-bottom"><div className="daily-card"><div className="daily-icon"><Flame size={17}/></div><b>{t("लगातार अभ्यास करें","Keep your streak")}</b><p>{t("रोज़ थोड़ा अभ्यास, बेहतर रैंक।","Small daily practice. Better ranks.")}</p><div className="streak-dots"><i/><i/><i/><i/><i/><i/><i/></div></div><div className="profile"><div className="avatar">S</div><div><b>Subhash</b><span>{t("परीक्षा अभ्यर्थी","Exam candidate")}</span></div><ShieldCheck size={17} className="profile-check"/></div></div>
      </aside>

      <section className="main">
        <header className="topbar"><div className="breadcrumb">{t("आपकी तैयारी","Your preparation")} <span>/</span> <b>{view === "test" ? t("मॉक टेस्ट","Mock test") : view === "result" ? t("रिज़ल्ट","Results") : view === "history" ? t("मेरे रिज़ल्ट","My results") : t("डैशबोर्ड","Dashboard")}</b></div><div className="top-actions"><span className={"live-pill " + (!isOnline ? "offline-pill" : "")}><i/> {isOnline ? t("सिस्टम तैयार","SYSTEM READY") : t("ऑफलाइन मोड","OFFLINE MODE")}</span><button className="lang-button" onClick={() => setLanguage(hi ? "en" : "hi")}><Languages size={16}/>{hi ? "हिंदी" : "English"}</button></div></header>

        {view === "home" && <div className="content">{storageMessage && <div className="bottom-note"><div className="note-icon"><Info size={18}/></div><div><b>{t("डेटा सेव स्थिति","Storage status")}</b><p>{storageMessage}</p></div></div>}
          <div className="auth-panel">
  <div><b>{user ? t("मोबाइल अकाउंट सक्रिय","Mobile account active") : t("मोबाइल से लॉगिन करें","Sign in with mobile")}</b><span>{user ? (user.phone || "") : t("आपके रिज़ल्ट आपके अकाउंट से जुड़े रहेंगे।","Your results stay linked to your account.")}</span></div>
  {user ? <button onClick={logout}>{t("लॉगआउट","Sign out")}</button> : <div className="auth-actions">{authStep === "phone" ? <><input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+91XXXXXXXXXX"/><button onClick={sendOtp}>{t("OTP भेजें","Send OTP")}</button></> : authStep === "otp" ? <><input value={otp} onChange={e=>setOtp(e.target.value)} inputMode="numeric" maxLength={6} placeholder={t("6-digit OTP","6-digit OTP")}/><button onClick={verifyOtp}>{t("Verify","Verify")}</button></> : <><input value={recoveryCode} onChange={e=>setRecoveryCode(e.target.value.toUpperCase())} maxLength={9} placeholder={t("Recovery code","Recovery code")}/><button onClick={recoverTrustedDevice}>{t("Device बदलें","Replace device")}</button></>}</div>}
  {authMessage && <small>{authMessage}</small>}
</div>
<div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line"/> {t("आपके लक्ष्य, आपकी मेहनत","YOUR GOALS. YOUR GRIT.")}</div><h1>{t("नमस्ते, सुभाष","Hello, Subhash")} <span className="wave">✦</span><br/><span className="muted-heading">{t("आज कुछ नया सीखें।","Ready to level up today?")}</span></h1><p className="intro">{t("अपनी तैयारी को परखें, कमज़ोर विषय पहचानें और हर टेस्ट के साथ बेहतर बनें।","Test your knowledge, spot weak areas, and get better with every attempt.")}</p></div><div className="hero-emblem"><div className="emblem-ring"><GraduationCap size={47}/><span>EXAM<br/>READY</span></div><div className="orbit-dot dot-one"/><div className="orbit-dot dot-two"/></div></div>
          <div className="stats-grid"><div className="stat-card"><div className="stat-top"><span>{t("कुल मॉक टेस्ट","MOCK TESTS")}</span><div className="stat-icon purple"><BookOpen size={18}/></div></div><div className="stat-value">{history.length.toString().padStart(2,"0")}<small> / 50</small></div><div className="stat-foot">{t("हर प्रयास मायने रखता है","Every attempt counts")}</div></div><div className="stat-card"><div className="stat-top"><span>{t("सर्वश्रेष्ठ स्कोर","BEST SCORE")}</span><div className="stat-icon gold"><Trophy size={18}/></div></div><div className="stat-value">{history.length ? (() => { const best = history.reduce((a, h) => Number(h.score || 0) / Math.max(1, Number(h.total_questions || 10) * Number(h.marks_per_question || 1)) > Number(a.score || 0) / Math.max(1, Number(a.total_questions || 10) * Number(a.marks_per_question || 1)) ? h : a, history[0]); return best.score; })() : "—"}<small> / {history.length ? (() => { const best = history.reduce((a, h) => Number(h.score || 0) / Math.max(1, Number(h.total_questions || 10) * Number(h.marks_per_question || 1)) > Number(a.score || 0) / Math.max(1, Number(a.total_questions || 10) * Number(a.marks_per_question || 1)) ? h : a, history[0]); return Number(best.total_questions || 10) * Number(best.marks_per_question || 1); })() : 0}</small></div><div className="stat-foot">{t("अपना रिकॉर्ड तोड़ें","Beat your personal best")}</div></div><div className="stat-card"><div className="stat-top"><span>{t("औसत सटीकता","AVG. ACCURACY")}</span><div className="stat-icon green"><Target size={18}/></div></div><div className="stat-value">{history.length ? Math.round(history.reduce((a,h)=>a+h.accuracy,0)/history.length) : 0}<small>%</small></div><div className="stat-foot">{t("सही जवाबों का प्रतिशत","Correct answer rate")}</div></div></div>
          <div className="section-heading"><div><h2>{t("अपनी तैयारी शुरू करें","Pick up where you want to grow")}</h2><p>{t("छोटे कदम, बड़ी सफलता।","Focused practice makes progress.")}</p></div><span className="section-count">01 — 03</span></div>
          <div className="job-section">
            <div className="section-heading job-heading"><div><h2>{t("MPESB परीक्षा / जॉब चुनें","Choose an MPESB exam / job")}</h2><p>{t("2026 की मौजूदा भर्ती, प्रवेश और पात्रता परीक्षाएँ एक जगह।","Current 2026 recruitment, entrance and eligibility exams in one place.")}</p></div><span className="section-count">{jobTracks.length ? String(jobTracks.length).padStart(2,"0") : "00"} EXAMS</span></div>
            <div className="exam-toolbar">
              <div className="exam-search"><Search size={15}/><input value={examQuery} onChange={e => setExamQuery(e.target.value)} placeholder={t("परीक्षा खोजें…","Search exams…")} /></div>
              <div className="exam-filters"><button className={examFilter==="all" ? "active" : ""} onClick={() => setExamFilter("all")}><SlidersHorizontal size={13}/>{t("सभी","All")}</button><button className={examFilter==="recruitment" ? "active" : ""} onClick={() => setExamFilter("recruitment")}>{t("भर्ती","Recruitment")}</button><button className={examFilter==="entrance" ? "active" : ""} onClick={() => setExamFilter("entrance")}>{t("प्रवेश","Entrance")}</button><button className={examFilter==="eligibility" ? "active" : ""} onClick={() => setExamFilter("eligibility")}>{t("पात्रता","Eligibility")}</button></div>
            </div>
            <div className="job-grid">{filteredJobTracks.map((track,index) => <button key={track.slug} className={"job-card " + (selectedJobTrack === track.slug ? "selected" : "") + (track.status === "coming_soon" ? "coming" : "")} onClick={() => { if (track.status !== "question_bank_ready" || !track.exam_slug) return; setSelectedJobTrack(track.slug); setSelectedExam(track.exam_slug); const exam=exams.find(item => item.slug === track.exam_slug); if (exam) { setExamConfig({ total_questions:Number(exam.total_questions || 10), duration_minutes:Number(exam.duration_minutes || 10), marks_per_question:Number(exam.marks_per_question || 1), negative_marks:Number(exam.negative_marks || 0), passing_percentage:Number(exam.passing_percentage || 33) }); setExamId(exam.id); setExamName(exam.name || "Mock Test"); } }}>
                <span className="job-number">{String(index + 1).padStart(2,"0")}</span><div className="job-3d-icon"><GraduationCap size={17}/></div>
                <div className="job-copy"><b>{hi ? track.name_hi : track.name_en}</b><span>{hi ? track.description_hi : track.description_en}</span><small>{track.exam_date_text ? `📅 ${track.exam_date_text}` : "📅 2026"}{track.form_status_text ? ` · ${track.form_status_text}` : ""}</small></div>
                <em>{track.status === "question_bank_ready" ? t("अभी उपलब्ध","READY") : t("जल्द आएगा","SOON")}</em>
                {selectedJobTrack === track.slug && <Check className="job-selected-check" size={15}/>}
              </button>)}</div>
            {!filteredJobTracks.length && <div className="exam-empty">{t("कोई परीक्षा नहीं मिली।","No exam found.")}</div>}
          </div>
          <div className="practice-config">
  <div className="config-block"><b>{t("सवाल कितने?","Questions")}</b><div className="config-options">{Array.from(new Set([10,20,30,40,50,availableQuestionCount].filter(n => n > 0 && n <= availableQuestionCount))).sort((a,b) => a-b).map(n=><button key={n} className={practiceQuestionCount===n?"active":""} onClick={()=>setPracticeQuestionCount(n)}>{n}</button>)}</div><small>{availableQuestionCount ? t(`${availableQuestionCount} verified/active questions अभी उपलब्ध हैं।`,`There are ${availableQuestionCount} active/verified questions available right now.`) : t("इस परीक्षा का question bank अभी उपलब्ध नहीं है।","This exam does not have a question bank yet.")}</small></div>
  <div className="config-block"><b>{t("समय कितना?","Time")}</b><div className="config-options">{[10,20,30,45,60].map(n=><button key={n} className={practiceDuration===n?"active":""} onClick={()=>setPracticeDuration(n)}>{n}m</button>)}</div></div>
  <div className="config-block device-security"><b>{t("SIM / डिवाइस सुरक्षा","SIM / Device security")}</b><div className="config-options"><button onClick={requestNativeSimPermission}>{nativeSimStatus === "sim-ready" ? t("SIM चालू ✓","SIM active ✓") : t("SIM अनुमति दें","Allow SIM")}</button>{user && <button onClick={createRecoveryCode}>{t("नए फोन के लिए recovery code","Create recovery code")}</button>}</div><small>{t("Recovery code केवल trusted device से बनता है, 15 मिनट में expire होता है और एक बार इस्तेमाल होता है।","A recovery code can only be created on the trusted device, expires in 15 minutes, and works once.")}</small></div>
</div>
<div className="feature-grid"><article className="feature-card featured"><div className="feature-top"><div className="feature-icon"><ListChecks size={22}/></div><span className="tag">POPULAR</span></div><h3>{t("चयनित भर्ती का मॉक टेस्ट","Mock test for selected recruitment")}</h3><div className="selected-track"><span>{t("ट्रैक","TRACK")}</span><b>{jobTracks.find(item => item.slug === selectedJobTrack)?.name_hi || examName}</b></div><p>{t(`${examConfig.total_questions} सवाल · ${examConfig.duration_minutes} मिनट · तुरंत रिज़ल्ट`,`${examConfig.total_questions} questions · ${examConfig.duration_minutes} minutes · instant results`)}</p><div className="feature-meta"><span><Clock3 size={14}/> {examConfig.duration_minutes} min</span><span><Target size={14}/> {Number(examConfig.total_questions) * Number(examConfig.marks_per_question)} marks</span></div><button className="primary-button" disabled={!availableQuestionCount} onClick={startTest}>{t("टेस्ट शुरू करें","Start mock test")}<ArrowRight size={17}/></button><div className="card-decoration">01</div></article><article className="feature-card"><div className="feature-top"><div className="feature-icon green-icon"><Target size={22}/></div><span className="tag tag-green">PRACTICE</span></div><h3>{t("स्मार्ट रिविज़न","Smart revision")}</h3><p>{t("गलत जवाबों की समीक्षा करें और कॉन्सेप्ट मज़बूत करें।","Review explanations and strengthen concepts.")}</p><div className="mini-progress"><span style={{width: history.length ? "65%" : "8%"}}/></div><div className="feature-meta"><span>{t("आपकी प्रगति","Your progress")}</span><span>{history.length ? "65%" : "0%"}</span></div><button className="secondary-button" onClick={() => setView("history")}>{t("रिज़ल्ट देखें","View results")}<ArrowRight size={16}/></button></article><article className="feature-card"><div className="feature-top"><div className="feature-icon blue-icon"><Globe2 size={22}/></div><span className="tag tag-blue">BILINGUAL</span></div><h3>{t("हिंदी + English","Hindi + English")}</h3><p>{t("अपनी सुविधा के अनुसार भाषा बदलें।","Switch between Hindi and English anytime.")}</p><div className="language-pills"><span>अ आ इ</span><span>ABC</span></div><div className="feature-meta"><span>{t("दोनों भाषाओं में सवाल","Questions in both languages")}</span></div><button className="secondary-button" onClick={() => setLanguage(hi ? "en" : "hi")}>{t("English में बदलें","Switch to हिंदी")}<Languages size={16}/></button></article></div>
          <div className="bottom-note"><div className="note-icon"><ShieldCheck size={18}/></div><div><b>{t("आपकी तैयारी, आपकी रफ़्तार","Your preparation, your pace")}</b><p>{t("यह डेमो प्लेटफॉर्म है। अभ्यास के लिए प्रश्न दिए गए हैं; आधिकारिक परीक्षा के लिए नवीनतम सिलेबस देखें।","This is a demo practice platform. Check the latest official syllabus for your target exam.")}</p></div></div>
        </div>}

        {view === "test" && <div className="content test-content"><div className="test-title-row"><div><div className="eyebrow"><span className="eyebrow-line"/> PRACTICE SESSION / 01</div><h1>{t("क्विक मॉक टेस्ट","Quick mock test")}</h1><p className="intro">{t("सभी सवाल हल करें और अपना सर्वश्रेष्ठ स्कोर बनाएँ।","Answer every question and aim for your personal best.")}</p></div><div className={"timer-card " + (seconds < 60 ? "timer-warning" : "")}><Clock3 size={19}/><div><small>{t("बचा हुआ समय","TIME LEFT")}</small><strong>{formatTime(seconds)}</strong></div></div></div><div className="test-progress"><div><span>{t("टेस्ट की प्रगति","TEST PROGRESS")}</span><b>{answered} / {testQuestions.length} {t("जवाब दिए","answered")}</b></div><div className="progress-track"><span style={{width: (answered/testQuestions.length*100)+"%"}}/></div></div>
          <div className="test-layout"><div className="question-panel"><div className="question-meta"><span className="question-number">QUESTION {String(q.id).padStart(2,"0")} <i/> {String(testQuestions.length).padStart(2,"0")}</span><span className="subject-chip">{q.subject}</span></div><h2>{hi ? q.hi : q.en}</h2><p className="question-hint">{t("सही विकल्प चुनें। आप अपना जवाब बदल सकते हैं।","Select one option. You can change your answer before submitting.")}</p><div className="options">{q.options.map((option,i)=><button key={option} className={"option " + (answers[q.id] === i ? "selected" : "")} onClick={() => chooseAnswer(i)}><span className="option-letter">{String.fromCharCode(65+i)}</span><span>{option}</span>{answers[q.id] === i ? <span className="radio-selected"/> : null}</button>)}</div>
          <div className="question-controls"><button className="secondary-button" disabled={current===0} onClick={() => setCurrent(c=>c-1)}><ChevronLeft size={17}/>{t("पिछला","Previous")}</button><button className={"review-button " + (review.includes(q.id) ? "review-on" : "")} onClick={toggleReview}><Flag size={16}/>{review.includes(q.id) ? t("रिव्यू हटाएँ","Unmark review") : t("रिव्यू के लिए","Mark for review")}</button>{current < testQuestions.length-1 ? <button className="primary-button next-button" onClick={() => setCurrent(c=>c+1)}>{t("अगला सवाल","Next question")}<ChevronRight size={17}/></button> : <button className="primary-button next-button" onClick={() => setShowSubmit(true)}>{t("टेस्ट सबमिट करें","Submit test")}<ArrowRight size={17}/></button>}</div></div>
          <aside className="question-nav"><div className="nav-heading"><h3>{t("सवालों की सूची","Question palette")}</h3><span>{answered}/{testQuestions.length}</span></div><p>{t("किसी सवाल पर जाने के लिए नंबर चुनें।","Tap a number to jump to a question.")}</p><div className="number-grid">{testQuestions.map((item,i)=><button key={item.id} onClick={() => setCurrent(i)} className={"number-cell " + (current===i ? "current" : "") + (answers[item.id] !== undefined ? " answered" : "") + (review.includes(item.id) ? " marked" : "")}>{String(item.id).padStart(2,"0")}{review.includes(item.id) && <i/>}</button>)}</div><div className="legend"><span><i className="legend-answered"/> {t("जवाब दिया","Answered")}</span><span><i className="legend-marked"/> {t("रिव्यू","Review")}</span><span><i className="legend-empty"/> {t("बाकी","Not answered")}</span></div><div className="nav-summary"><div><span>{t("जवाब दिए","Answered")}</span><b>{answered}</b></div><div><span>{t("बाकी सवाल","Remaining")}</span><b>{testQuestions.length-answered}</b></div><div><span>{t("रिव्यू के लिए","For review")}</span><b>{review.length}</b></div></div><button className="submit-full" onClick={() => setShowSubmit(true)}>{t("टेस्ट समाप्त करें","Finish test")}<ArrowRight size={16}/></button></aside></div>
          {showSubmit && <div className="modal-backdrop"><div className="confirm-modal"><div className="modal-icon"><Flag size={22}/></div><h2>{t("टेस्ट सबमिट करें?","Submit your test?")}</h2><p>{t("आपने","You have answered")} {answered} {t("में से "+testQuestions.length+" सवालों के जवाब दिए हैं। सबमिट करने के बाद जवाब नहीं बदल पाएँगे।","of the selected questions. You cannot change answers after submission.")}</p><div className="modal-actions"><button className="secondary-button" onClick={() => setShowSubmit(false)}>{t("वापस जाएँ","Go back")}</button><button className="primary-button" onClick={finishTest}>{t("हाँ, सबमिट करें","Yes, submit")}</button></div></div></div>}
        </div>}

        {view === "result" && result && <div className="content result-content"><div className="result-hero"><div className="result-trophy"><Trophy size={37}/></div><div className="eyebrow"><span className="eyebrow-line"/> SESSION COMPLETE</div><h1>{t("शानदार प्रयास, सुभाष!","Great effort, Subhash!")}</h1><p>{t("हर टेस्ट आपको आपके लक्ष्य के और करीब ले जाता है।","Every attempt takes you one step closer to your goal.")}</p><p>{t("नेट स्कोर:","Net score:")} <b>{result.score}</b> · {t("कटौती:","Negative:")} <b>{result.negative_score}</b></p><div className="score-circle"><div><strong>{result.score}<small>/{(result.total_questions * result.marks_per_question).toFixed ? (result.total_questions * result.marks_per_question).toFixed(2).replace(/\.00$/,"") : result.total_questions}</small></strong><span>{t("आपका स्कोर","YOUR SCORE")}</span></div></div></div><div className="result-stats"><div className="result-stat"><CheckCircle2 size={19}/><span>{t("सही जवाब","Correct")}</span><b>{result.correct}</b></div><div className="result-stat"><Target size={19}/><span>{t("Gross Marks","Gross marks")}</span><b>{result.gross_score}</b></div><div className="result-stat wrong-stat"><X size={19}/><span>{t("Negative Marks","Negative marks")}</span><b>-{result.negative_score}</b></div><div className="result-stat wrong-stat"><X size={19}/><span>{t("गलत जवाब","Incorrect")}</span><b>{result.wrong}</b></div><div className="result-stat unanswered-stat"><Clock3 size={19}/><span>{t("बिना जवाब","Unanswered")}</span><b>{result.unanswered}</b></div><div className="result-stat accuracy-stat"><Target size={19}/><span>{t("सटीकता","Accuracy")}</span><b>{result.accuracy}%</b></div></div><div className="review-panel"><div className="section-heading"><div><h2>{t("सवालों की समीक्षा","Review your answers")}</h2><p>{t("सही उत्तर और व्याख्या देखें।","See the correct answer and explanation.")}</p></div><span className="section-count">{result.total_questions} QUESTIONS</span></div>{testQuestions.map((item,i)=>{const a=answers[item.id]; const isRight=a===item.answer; return <div className="review-question" key={item.id}><div className={"review-status " + (a===undefined ? "status-empty" : isRight ? "status-right" : "status-wrong")}>{a===undefined ? "—" : isRight ? <Check size={16}/> : <X size={16}/>}</div><div className="review-body"><b>{i+1}. {hi ? item.hi : item.en}</b><span>{t("आपका जवाब:","Your answer:")} {a===undefined ? t("जवाब नहीं दिया","Not answered") : item.options[a]}</span><span className="correct-answer">{t("सही जवाब:","Correct answer:")} {item.options[item.answer]}</span><p>{item.explanation}</p></div></div>})}</div><div className="result-actions"><button className="secondary-button" onClick={() => setView("home")}><Home size={17}/>{t("डैशबोर्ड","Dashboard")}</button><button className="primary-button" onClick={startTest}><RotateCcw size={17}/>{t("फिर से टेस्ट दें","Retake test")}</button></div></div>}

        {view === "history" && <div className="content">{storageMessage && <div className="bottom-note"><div className="note-icon"><Info size={18}/></div><div><b>{t("डेटा सेव स्थिति","Storage status")}</b><p>{storageMessage}</p></div></div>}<div className="eyebrow"><span className="eyebrow-line"/> YOUR JOURNEY</div><h1>{t("आपके रिज़ल्ट","Your results")}</h1><p className="intro">{t("आपके हाल के मॉक टेस्ट और प्रगति यहाँ दिखाई देंगे।","Your recent mock test attempts and progress appear here.")}</p>{history.length ? <div className="history-list">{history.map((h,i)=><div className="history-item" key={i}><div className="history-icon"><Award size={21}/></div><div className="history-main"><b>{h.test_name || t("क्विक मॉक टेस्ट","Quick mock test")}</b><span>{t("प्रयास","Attempt")} {history.length-i} · {h.accuracy}% {t("सटीकता","accuracy")}</span></div><strong>{h.score}/{Number(h.total_questions || 10) * Number(h.marks_per_question || 1)}</strong><span className="history-grade">{(Number(h.score || 0) / Math.max(1, Number(h.total_questions || 10) * Number(h.marks_per_question || 1))) >= 0.8?t("बहुत अच्छा","Great"):(Number(h.score || 0) / Math.max(1, Number(h.total_questions || 10) * Number(h.marks_per_question || 1))) >= 0.5?t("अच्छा प्रयास","Good effort"):t("अभ्यास जारी रखें","Keep practicing")}</span></div>)}</div> : <div className="empty-state"><div className="empty-icon"><BookOpen size={28}/></div><h2>{t("आपका पहला टेस्ट इंतज़ार कर रहा है","Your first test is waiting")}</h2><p>{t("टेस्ट पूरा करने के बाद आपका स्कोर और विश्लेषण यहाँ दिखाई देगा।","Complete a mock test to see your score and analysis here.")}</p><button className="primary-button" disabled={!availableQuestionCount} onClick={startTest}>{t("पहला टेस्ट शुरू करें","Start your first test")}<ArrowRight size={17}/></button></div>}</div>}

        <footer className="footer"><span>© 2026 ExamPrep</span><span>{t("अभ्यास • प्रगति • सफलता","PRACTICE · PROGRESS · SUCCESS")}</span><span>{t("आपकी तैयारी जारी है","Keep showing up ✦")}</span></footer>
      </section>
    </main>
  );
}
