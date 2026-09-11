import { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Plus, FileText, Send, Sparkles,
  Bot, User, Loader2,
  Zap, Copy, Check, Eye, X, LogOut,
  MessageSquare, Trash2, ChevronDown, Clock, UserCircle,
  Menu, Square
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

/* ---------------------------------------------------------------------
   Original cartoon-style illustrations (hand-built SVG, brand-matched).
   Drawn in-house rather than hotlinked, so colors/animation stay fully
   under our control and there's no external licensing dependency.
------------------------------------------------------------------------ */

function RobotMascot({ className = "" }) {
  return (
    <svg viewBox="0 0 320 300" className={`mascot-svg ${className}`} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="mBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#4f46e5" />
        </linearGradient>
        <linearGradient id="mHead" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a5b4fc" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
        <radialGradient id="mGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#c4b5fd" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#c4b5fd" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* ground shadow */}
      <ellipse cx="160" cy="262" rx="70" ry="12" fill="#000" opacity="0.35" />

      {/* floating doc card left */}
      <g className="mascot-doc mascot-doc-1">
        <rect x="18" y="98" width="46" height="58" rx="8" fill="#0f0f18" stroke="#6366f1" strokeOpacity="0.5" />
        <rect x="27" y="112" width="28" height="4" rx="2" fill="#818cf8" opacity="0.8" />
        <rect x="27" y="122" width="22" height="4" rx="2" fill="#818cf8" opacity="0.5" />
        <rect x="27" y="132" width="24" height="4" rx="2" fill="#818cf8" opacity="0.5" />
      </g>
      {/* floating doc card right */}
      <g className="mascot-doc mascot-doc-2">
        <rect x="252" y="70" width="46" height="58" rx="8" fill="#0f0f18" stroke="#a855f7" strokeOpacity="0.5" />
        <rect x="261" y="84" width="28" height="4" rx="2" fill="#c4b5fd" opacity="0.8" />
        <rect x="261" y="94" width="20" height="4" rx="2" fill="#c4b5fd" opacity="0.5" />
        <rect x="261" y="104" width="25" height="4" rx="2" fill="#c4b5fd" opacity="0.5" />
      </g>

      {/* sparkles */}
      <g className="mascot-sparkle mascot-sparkle-1" fill="#a5b4fc">
        <path d="M246 168 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4 z" />
      </g>
      <g className="mascot-sparkle mascot-sparkle-2" fill="#f0abfc">
        <path d="M52 60 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 z" />
      </g>

      {/* robot group bobs gently */}
      <g className="mascot-bob">
        {/* antenna */}
        <line x1="160" y1="46" x2="160" y2="66" stroke="#818cf8" strokeWidth="3" strokeLinecap="round" />
        <circle cx="160" cy="40" r="9" fill="url(#mGlow)" />
        <circle className="mascot-antenna-dot" cx="160" cy="40" r="5" fill="#c4b5fd" />

        {/* head */}
        <rect x="118" y="66" width="84" height="66" rx="20" fill="url(#mHead)" />
        <rect x="130" y="86" width="60" height="30" rx="10" fill="#0b0b12" />
        {/* eyes */}
        <rect className="mascot-eye" x="140" y="96" width="10" height="12" rx="5" fill="#e0e7ff" />
        <rect className="mascot-eye" x="170" y="96" width="10" height="12" rx="5" fill="#e0e7ff" />
        {/* cheeks */}
        <circle cx="128" cy="118" r="5" fill="#f0abfc" opacity="0.45" />
        <circle cx="192" cy="118" r="5" fill="#f0abfc" opacity="0.45" />

        {/* body */}
        <rect x="112" y="140" width="96" height="78" rx="22" fill="url(#mBody)" />
        <rect x="140" y="160" width="40" height="26" rx="8" fill="#0b0b12" opacity="0.9" />
        <circle className="mascot-blip" cx="150" cy="173" r="4" fill="#67e8f9" />
        <circle className="mascot-blip mascot-blip-delay" cx="168" cy="173" r="4" fill="#f0abfc" />

        {/* left arm (static) */}
        <rect x="92" y="150" width="18" height="40" rx="9" fill="#6366f1" />
        {/* right arm (waving) */}
        <g className="mascot-arm">
          <rect x="208" y="146" width="18" height="40" rx="9" fill="#6366f1" transform="rotate(0 217 146)" />
        </g>

        {/* legs */}
        <rect x="128" y="212" width="18" height="30" rx="8" fill="#4f46e5" />
        <rect x="174" y="212" width="18" height="30" rx="8" fill="#4f46e5" />
      </g>
    </svg>
  );
}

function DocFlyCartoon({ className = "" }) {
  return (
    <svg viewBox="0 0 160 140" className={`docfly-svg ${className}`} xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="80" cy="122" rx="46" ry="8" fill="#000" opacity="0.3" />
      <g className="docfly-float">
        <rect x="46" y="30" width="68" height="82" rx="10" fill="#13131c" stroke="#6366f1" strokeOpacity="0.55" />
        <rect x="58" y="46" width="44" height="5" rx="2.5" fill="#818cf8" />
        <rect x="58" y="58" width="34" height="5" rx="2.5" fill="#818cf8" opacity="0.7" />
        <rect x="58" y="70" width="40" height="5" rx="2.5" fill="#818cf8" opacity="0.7" />
        <rect x="58" y="82" width="26" height="5" rx="2.5" fill="#818cf8" opacity="0.5" />
        <circle cx="112" cy="96" r="13" fill="#4f46e5" />
        <path d="M106 96 l4 4 8 -8" stroke="#e0e7ff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g className="docfly-sparkle" fill="#c4b5fd">
        <path d="M30 24 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5 z" />
      </g>
    </svg>
  );
}

/* ---------------------------------------------------------------------
   Solo Leveling-inspired "summoning circle" — rotating runic rings with
   a pulsing core, built as SVG so it stays crisp and lightweight.
------------------------------------------------------------------------ */
function MagicCircle({ className = "" }) {
  const ticks = Array.from({ length: 32 });
  return (
    <svg viewBox="0 0 400 400" className={`magic-circle-svg ${className}`} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id={`circleGlow-${className}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#a5b4fc" stopOpacity="0.55" />
          <stop offset="45%" stopColor="#6366f1" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="200" cy="200" r="196" fill={`url(#circleGlow-${className})`} />

      {/* outer runic ring */}
      <g className="circle-ring circle-ring-outer">
        <circle cx="200" cy="200" r="188" fill="none" stroke="#818cf8" strokeOpacity="0.35" strokeWidth="1" />
        {ticks.map((_, i) => {
          const a = (i * 360) / ticks.length;
          const rad = (a * Math.PI) / 180;
          const long = i % 4 === 0;
          const r1 = 188, r2 = long ? 170 : 179;
          const x1 = 200 + r1 * Math.cos(rad), y1 = 200 + r1 * Math.sin(rad);
          const x2 = 200 + r2 * Math.cos(rad), y2 = 200 + r2 * Math.sin(rad);
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="#a5b4fc" strokeOpacity={long ? 0.55 : 0.28} strokeWidth={long ? 1.4 : 0.8} />
          );
        })}
      </g>

      {/* mid hex ring */}
      <g className="circle-ring circle-ring-mid">
        <circle cx="200" cy="200" r="150" fill="none" stroke="#7c3aed" strokeOpacity="0.3" strokeWidth="1" strokeDasharray="1 7" />
        <polygon points="200,72 316,138 316,262 200,328 84,262 84,138" fill="none" stroke="#6366f1" strokeOpacity="0.32" strokeWidth="1" />
      </g>

      {/* inner sigil ring */}
      <g className="circle-ring circle-ring-inner">
        <circle cx="200" cy="200" r="104" fill="none" stroke="#818cf8" strokeOpacity="0.4" strokeWidth="1.2" />
        <circle cx="200" cy="200" r="70" fill="none" stroke="#c4b5fd" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="3 5" />
        <path d="M200 130 L228 186 L200 200 L172 186 Z" fill="#818cf8" opacity="0.18" />
      </g>

      <circle className="circle-core" cx="200" cy="200" r="5" fill="#e0e7ff" />
    </svg>
  );
}

export default function App({ onLogout, username, authenticated }) {
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [selectedDocName, setSelectedDocName] = useState(null);
  const [docPreview, setDocPreview] = useState(null);
  const [previewType, setPreviewType] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const navigate = useNavigate();

  const [chatSessions, setChatSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [sidebarTab, setSidebarTab] = useState("documents");
  const [showSidebar, setShowSidebar] = useState(false);

  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [provider, setProvider] = useState("groq");
  const [toast, setToast] = useState(null);
  const abortControllerRef = useRef(null);

  const bottomRef = useRef(null);
  const chatContainerRef = useRef(null);
  const sidebarRef = useRef(null);
  const inputRef = useRef(null);

  const showToast = (message, type = "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const copyToClipboard = async (text, index) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex((cur) => (cur === index ? null : cur)), 1800);
    } catch {
      showToast("Could not copy to clipboard");
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API}/auth/logout`, { method: "POST", credentials: "include" });
    } catch { /* ignore */ }
    if (onLogout) onLogout();
    navigate("/login");
  };

  useEffect(() => {
    fetchDocuments();
    fetchSessions();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const fetchDocuments = async () => {
    try {
      const res = await axios.get(`${API}/documents`, { withCredentials: true });
      setDocuments(res.data);
    } catch { /* ignore */ }
  };

  const deleteDocument = async (docId) => {
    if (!confirm("Delete this document?")) return;
    try {
      await axios.delete(`${API}/documents/${docId}`, { withCredentials: true });
      if (selectedDoc === docId) {
        setSelectedDoc(null);
        setSelectedDocName(null);
        setDocPreview(null);
        setPreviewType(null);
        setShowPreview(false);
        setMessages([]);
        setCurrentSessionId(null);
      }
      fetchDocuments();
      showToast("Document deleted", "success");
    } catch (err) {
      showToast("Failed to delete document");
    }
  };

  const fetchSessions = async () => {
    if (!authenticated) return;
    try {
      const res = await axios.get(`${API}/chat/sessions`, { withCredentials: true });
      setChatSessions(res.data);
    } catch { /* ignore */ }
  };

  const createSession = async (docFilename) => {
    const res = await axios.post(
      `${API}/chat/sessions`,
      { title: "New Chat", document_filename: docFilename },
      { withCredentials: true }
    );
    setCurrentSessionId(res.data.id);
    fetchSessions();
    return res.data.id;
  };

  const saveMessage = async (sessionId, role, content) => {
    await axios.post(
      `${API}/chat/sessions/${sessionId}/messages`,
      { role, content },
      { withCredentials: true }
    );
  };

  const loadSession = async (session) => {
    try {
      const res = await axios.get(
        `${API}/chat/sessions/${session.id}/messages`,
        { withCredentials: true }
      );
      setMessages(res.data.messages);
      setCurrentSessionId(session.id);
      setSidebarTab("documents");
      setShowSidebar(false);
    } catch (err) {
      showToast("Failed to load session");
    }
  };

  const deleteSession = async (sessionId) => {
    await axios.delete(`${API}/chat/sessions/${sessionId}`, { withCredentials: true });
    if (currentSessionId === sessionId) {
      setCurrentSessionId(null);
      setMessages([]);
    }
    fetchSessions();
  };

  const startNewChat = () => {
    setMessages([]);
    setCurrentSessionId(null);
    setSidebarTab("documents");
    setInput("");
    setShowSidebar(false);
  };

  const handleSelectDoc = async (doc) => {
    setSelectedDoc(doc.id);
    setSelectedDocName(doc.filename);
    setLoading(true);
    setShowSidebar(false);

    if (docPreview && previewType === "pdf") {
      URL.revokeObjectURL(docPreview);
    }

    const isPdf = doc.filename.toLowerCase().endsWith(".pdf");
    try {
      if (isPdf) {
        const res = await axios.get(`${API}/documents/${doc.id}/preview`, {
          responseType: "blob",
          withCredentials: true
        });
        setDocPreview(URL.createObjectURL(res.data));
        setPreviewType("pdf");
      } else {
        const res = await axios.get(`${API}/documents/${doc.id}/preview`, {
          responseType: "text",
          withCredentials: true
        });
        setDocPreview(res.data);
        setPreviewType("text");
      }
      setShowPreview(true);
    } catch (err) {
      setDocPreview(null);
      setPreviewType(null);
    }

    if (!currentSessionId) {
      await createSession(doc.filename);
    }
    setLoading(false);
    showToast(`Selected: ${doc.filename}`, "success");
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    setIsUploading(true);
    setUploadMessage("Uploading...");

    try {
      const progressInterval = setInterval(() => {
        setUploadMessage(prev => {
          if (prev.includes("Parsing")) return "Building structure...";
          if (prev.includes("Building")) return "Almost done...";
          return "Parsing content...";
        });
      }, 3000);

      const res = await axios.post(`${API}/upload`, formData, { withCredentials: true });
      clearInterval(progressInterval);

      if (res.data.error) throw new Error(res.data.error);

      setUploadMessage("Ready!");
      showToast("Document uploaded successfully", "success");
      await fetchDocuments();
    } catch (err) {
      showToast(err.response?.data?.detail || "Upload failed");
    } finally {
      setIsUploading(false);
      setUploadMessage("");
      e.target.value = "";
    }
  };

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
    showToast("Response stopped", "success");
  };

  const sendMessage = async () => {
    if (!input.trim() || !selectedDoc || loading) return;
    const userMsg = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = await createSession(selectedDocName || "Unknown");
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await saveMessage(sessionId, "user", userMsg.content);

      const res = await axios.post(`${API}/ask`, {
        question: userMsg.content,
        document_ids: [selectedDoc],
        provider: provider,
      }, { withCredentials: true, signal: controller.signal });

      if (controller.signal.aborted) return;

      const answer = res.data.answer;
      const reasoning = res.data.reasoning;
      const sections = res.data.sections || [];

      let fullResponse = answer;
      if (sections.length > 0) {
        fullResponse += `\n\n---\n*From: ${sections.join(", ")}*`;
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: fullResponse, reasoning },
      ]);

      await saveMessage(sessionId, "assistant", answer);
      fetchSessions();
    } catch (err) {
      if (controller.signal.aborted) return;
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Something went wrong. Please try again." },
      ]);
    }
    setLoading(false);
    abortControllerRef.current = null;
  };

  return (
    <div className="flex h-screen bg-[#020203] text-zinc-300 font-sans overflow-hidden antialiased relative">

      {/* Ambient animated background — Solo Leveling "Monarch" theme */}
      <div className="bg-scene">
        <div className="conic-aura" />
        <div className="mesh-grid" />
        <div className="aurora aurora-1" />
        <div className="aurora aurora-2" />
        <div className="aurora aurora-3" />
        <div className="aurora aurora-4" />

        {/* Rotating summoning circles, like a gate/shadow extraction sigil */}
        <MagicCircle className="summon-circle summon-circle-main" />
        <MagicCircle className="summon-circle summon-circle-accent" />

        {/* Periodic "System" activation shockwave */}
        <span className="power-pulse" />
        <span className="power-pulse power-pulse-delay" />

        {/* Rising mana / shadow motes */}
        <div className="mana-field">
          {Array.from({ length: 20 }).map((_, i) => (
            <span key={i} className="mana-mote" style={{
              left: `${(i * 41) % 100}%`,
              animationDelay: `${(i % 9) * 0.75}s`,
              animationDuration: `${7 + (i % 6)}s`,
            }} />
          ))}
        </div>

        {/* Occasional arcane lightning crack */}
        <svg className="lightning-crack" viewBox="0 0 400 800" preserveAspectRatio="none">
          <path d="M280 0 L240 160 L300 190 L200 400 L250 420 L150 800" fill="none" stroke="#a5b4fc" strokeWidth="2" strokeLinecap="round" />
        </svg>

        <div className="node-field">
          {Array.from({ length: 26 }).map((_, i) => (
            <span key={i} className={`node node-${(i % 6) + 1}`} style={{
              left: `${(i * 37) % 100}%`,
              top: `${(i * 53) % 100}%`,
              animationDelay: `${(i % 10) * 0.6}s`,
            }} />
          ))}
        </div>
        <div className="grain-overlay" />
        <div className="vignette" />
      </div>

      {/* Toast */}
      {toast && (
        <div className={`toast-in fixed top-4 right-4 z-[100] flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold shadow-2xl backdrop-blur-xl ${
          toast.type === "success" ? "bg-emerald-500/90 text-white" : "bg-red-500/90 text-white"
        }`}>
          {toast.type === "success" ? <Check size={14} /> : <X size={14} />}
          {toast.message}
        </div>
      )}

      {/* Mobile overlay */}
      {showSidebar && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" onClick={() => setShowSidebar(false)} />
      )}

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={`fixed lg:relative w-72 h-full border-r border-white/5 bg-zinc-950/95 lg:bg-zinc-950/40 backdrop-blur-3xl flex flex-col z-50 transition-transform duration-300 ${
          showSidebar ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Logo */}
        <div className="p-5 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative p-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400 overflow-hidden">
              <span className="logo-ring" />
              <svg width="22" height="22" viewBox="0 0 40 40" className="relative">
                <rect x="6" y="14" width="28" height="20" rx="7" fill="#6366f1" />
                <rect x="12" y="19" width="16" height="10" rx="4" fill="#0b0b12" />
                <circle className="logo-eye" cx="17" cy="24" r="2.4" fill="#a5b4fc" />
                <circle className="logo-eye logo-eye-delay" cx="23" cy="24" r="2.4" fill="#a5b4fc" />
                <line x1="20" y1="8" x2="20" y2="14" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" />
                <circle cx="20" cy="7" r="3" fill="#a5b4fc" />
              </svg>
            </div>
            <span className="brand-text font-bold tracking-tight text-white text-lg">RAG Bot</span>
          </div>
          <button onClick={() => setShowSidebar(false)} className="lg:hidden p-1 text-zinc-500 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Actions */}
        <div className="px-4 mb-3 flex gap-2">
          <label className={`relative overflow-hidden flex items-center justify-center gap-2 flex-1 py-2.5 bg-white text-black rounded-xl text-xs font-bold transition-transform ${isUploading ? 'opacity-70 cursor-wait' : 'cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(255,255,255,0.08)]'}`}>
            {!isUploading && <span className="btn-sheen" />}
            {isUploading ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
            <span className="truncate relative">{isUploading ? (uploadMessage || "Indexing...") : "Upload"}</span>
            <input type="file" className="hidden" onChange={handleUpload} disabled={isUploading} accept=".pdf,.md,.markdown" />
          </label>
          <button onClick={startNewChat} className="flex items-center justify-center gap-2 flex-1 py-2.5 bg-zinc-900 border border-white/10 text-zinc-300 rounded-xl hover:bg-zinc-800 hover:-translate-y-0.5 transition-all text-xs font-bold">
            <MessageSquare size={14} />
            <span>New</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="relative px-4 mb-2 mx-4 flex gap-1 bg-zinc-900/50 rounded-lg p-1">
          <div
            className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-md bg-white/10 transition-transform duration-300 ease-out"
            style={{ transform: sidebarTab === "documents" ? "translateX(0%)" : "translateX(calc(100% + 8px))" }}
          />
          {["documents", "history"].map(tab => (
            <button
              key={tab}
              onClick={() => setSidebarTab(tab)}
              className={`relative z-10 flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors ${
                sidebarTab === tab ? "text-white" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-3 space-y-1 custom-scrollbar">
          {sidebarTab === "documents" ? (
            <>
              {documents.length === 0 && (
                <div className="px-3 py-6 text-center">
                  <DocFlyCartoon className="w-28 h-24 mx-auto mb-1" />
                  <p className="text-xs text-zinc-600">No documents yet</p>
                  <p className="text-[10px] text-zinc-700 mt-0.5">Upload a PDF or Markdown file to begin</p>
                </div>
              )}
              {documents.map((doc, i) => (
                <div
                  key={doc.id}
                  className={`sidebar-item-in w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all border group relative overflow-hidden ${selectedDoc === doc.id ? "bg-indigo-500/10 border-indigo-500/20 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/5"}`}
                  style={{ animationDelay: `${i * 45}ms` }}
                >
                  {selectedDoc === doc.id && <span className="active-doc-bar" />}
                  <button onClick={() => handleSelectDoc(doc)} className="flex items-center gap-3 flex-1 min-w-0 focus:outline-none focus:ring-0">
                    <FileText size={15} className={selectedDoc === doc.id ? "text-indigo-400" : "opacity-30"} />
                    <span className="truncate text-left text-sm">{doc.filename}</span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteDocument(doc.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 rounded-lg transition-all shrink-0"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </>
          ) : (
            <>
              {chatSessions.length === 0 && (
                <div className="px-3 py-10 text-center">
                  <Clock size={22} className="mx-auto mb-2 text-zinc-700" />
                  <p className="text-xs text-zinc-600">No conversations yet</p>
                </div>
              )}
              {chatSessions.map((s, i) => (
                <div
                  key={s.id}
                  className={`sidebar-item-in w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all border group cursor-pointer ${currentSessionId === s.id ? "bg-white/5 border-white/10 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/5"}`}
                  style={{ animationDelay: `${i * 45}ms` }}
                  onClick={() => loadSession(s)}
                >
                  <Clock size={13} className="opacity-30 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{s.title}</p>
                    {s.document_filename && <p className="text-[10px] text-zinc-600 truncate">{s.document_filename}</p>}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-all shrink-0"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </>
          )}
        </div>

        {/* User */}
        <div className="p-3 border-t border-white/5 relative" ref={userMenuRef}>
          {showUserMenu && (
            <div className="user-menu-in absolute bottom-full left-3 right-3 mb-2 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-white/5">
                <p className="text-xs font-bold text-white">{username || "User"}</p>
              </div>
              <button onClick={() => { setSidebarTab("history"); setShowUserMenu(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-zinc-400 hover:text-white hover:bg-white/5 transition-colors">
                <Clock size={14} />
                <span>Chat History</span>
              </button>
              <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-zinc-400 hover:text-red-400 hover:bg-red-500/5 transition-colors">
                <LogOut size={14} />
                <span>Logout</span>
              </button>
            </div>
          )}
          <button onClick={() => setShowUserMenu(!showUserMenu)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-white/5 hover:bg-white/5 transition-all">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
              <UserCircle size={18} className="text-indigo-400" />
            </div>
            <span className="flex-1 text-left text-sm text-zinc-300 truncate">{username || "User"}</span>
            <ChevronDown size={14} className={`text-zinc-500 transition-transform ${showUserMenu ? "rotate-180" : ""}`} />
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col relative bg-transparent min-w-0 z-10">
        {/* Top bar */}
        <nav className="h-14 border-b border-white/5 flex items-center px-4 lg:px-8 justify-between bg-black/20 backdrop-blur-xl z-20 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowSidebar(true)} className="lg:hidden p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5">
              <Menu size={20} />
            </button>
            <span className={`text-xs font-bold uppercase tracking-widest hidden sm:block transition-colors ${selectedDocName ? "text-topbar-active" : "text-zinc-500"}`}>
              {selectedDocName ? selectedDocName.substring(0, 30) : "Select a document"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {selectedDoc && (
              <button
                onClick={() => setShowPreview(!showPreview)}
                className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all ${showPreview ? "bg-indigo-500 border-indigo-400 text-white" : "bg-white/5 border-white/10 text-zinc-400 hover:text-white"}`}
              >
                <Eye size={13} />
                {showPreview ? "Hide" : "Preview"}
              </button>
            )}
          </div>
        </nav>

        {/* Chat area */}
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto pt-8 pb-36 px-4 lg:px-8 custom-scrollbar">
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-[50vh] text-center">
                <RobotMascot className="w-56 h-52 mb-2 drop-shadow-[0_20px_40px_rgba(99,102,241,0.25)]" />
                <h2 className="brand-text text-xl font-semibold text-white mb-2">Ask anything about your document</h2>
                <p className="text-sm text-zinc-500 max-w-sm">
                  {selectedDoc
                    ? "Type a question below to get started"
                    : "Upload or select a document from the sidebar"}
                </p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`msg-in flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${msg.role === "user" ? "bg-white text-black" : "bg-zinc-800 border border-white/10 text-white"}`}>
                  {msg.role === "user" ? <User size={15} /> : <Bot size={15} />}
                </div>
                <div className={`flex flex-col gap-1 max-w-[85%] ${msg.role === "user" ? "items-end" : ""}`}>
                  <div className={`rounded-2xl px-5 py-3 border ${msg.role === "user" ? "bg-zinc-100 text-black border-white" : "bg-zinc-900/40 text-zinc-200 border-white/5"}`}>
                    {msg.role === "assistant" && (
                      <div className="flex items-center justify-between mb-2 border-b border-white/5 pb-1.5">
                        <span className="text-[10px] font-bold text-indigo-400 uppercase">Response</span>
                        <button onClick={() => copyToClipboard(msg.content, i)} className="text-zinc-500 hover:text-white p-0.5 transition-colors">
                          {copiedIndex === i ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                        </button>
                      </div>
                    )}
                    {msg.role === "assistant" ? (
                      <div className="rag-markdown text-sm">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-600 px-2">
                    {msg.role === "user" ? "You" : "AI"}
                  </span>
                </div>
              </div>
            ))}

            {loading && (
              <div className="msg-in flex gap-4 items-center">
                <div className="scan-icon-sm relative w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
                  <span className="scan-sweep scan-sweep-sm" />
                  <Bot size={15} className="text-white relative z-10" />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-indigo-400 flex items-center gap-1">
                    Reading document
                    <span className="thinking-dot" />
                    <span className="thinking-dot" style={{ animationDelay: "0.15s" }} />
                    <span className="thinking-dot" style={{ animationDelay: "0.3s" }} />
                  </span>
                  <button onClick={stopGeneration} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold hover:bg-red-500/20 transition-all">
                    <Square size={10} />
                    Stop
                  </button>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-3xl px-4 lg:px-8 z-40">
          <div className="input-bar relative bg-zinc-900/80 border border-white/10 backdrop-blur-[40px] rounded-2xl p-2 pr-3 shadow-2xl">
            <div className="flex items-center gap-3">
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="bg-white/5 border border-white/5 text-[10px] font-bold text-zinc-400 outline-none cursor-pointer rounded-lg px-2.5 py-1.5 uppercase tracking-wider model-select shrink-0"
              >
                <option value="groq" className="bg-zinc-900">Groq 3.3</option>
                <option value="gemini-lite" className="bg-zinc-900">Gemini Lite</option>
                <option value="gemini-flash" className="bg-zinc-900">Gemini Flash</option>
              </select>
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={selectedDoc ? "Ask a question..." : "Select a document first"}
                disabled={!selectedDoc}
                className="flex-1 bg-transparent border-none text-zinc-100 focus:ring-0 focus:outline-none resize-none py-3 px-3 text-sm placeholder-zinc-600"
              />
              {loading ? (
                <button
                  onClick={stopGeneration}
                  className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-all shrink-0"
                >
                  <Square size={16} fill="white" />
                </button>
              ) : (
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || !selectedDoc}
                  className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all shrink-0 ${
                    input.trim() && selectedDoc
                      ? "bg-white text-black hover:bg-zinc-200 hover:-translate-y-0.5"
                      : "bg-zinc-800/50 text-zinc-700 cursor-not-allowed"
                  }`}
                >
                  <Send size={16} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Preview Panel */}
        {showPreview && (
          <div className="panel-in absolute inset-y-0 right-0 w-[350px] lg:w-[420px] border-l border-white/10 bg-zinc-950/90 backdrop-blur-2xl flex flex-col z-30">
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/20 shrink-0">
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-indigo-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-white">Source</span>
              </div>
              <button onClick={() => setShowPreview(false)} className="p-1 hover:bg-white/10 rounded-lg text-zinc-500 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden p-3 custom-scrollbar">
              {previewType === "pdf" && docPreview ? (
                <iframe src={docPreview} title="PDF" className="w-full h-full rounded-xl" style={{ border: "none" }} />
              ) : (
                <pre className="whitespace-pre-wrap text-xs text-zinc-400 font-mono leading-relaxed p-4 bg-zinc-900/50 rounded-xl border border-white/5 overflow-y-auto h-full">
                  {docPreview || "Loading..."}
                </pre>
              )}
            </div>
          </div>
        )}
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&display=swap');

        .brand-text { font-family: 'Space Grotesk', ui-sans-serif, system-ui, sans-serif; }

        .text-topbar-active { color: #7c9bff; }

        /* ================= Ambient animated background ================= */
        .bg-scene {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          overflow: hidden;
          background: #020203;
        }

        /* Slow rotating hue-shifting aura, sits behind everything else */
        .conic-aura {
          position: absolute;
          top: 50%; left: 50%;
          width: 160vmax;
          height: 160vmax;
          transform: translate(-50%, -50%);
          background: conic-gradient(
            from 0deg,
            rgba(59,91,255,0.10),
            rgba(124,58,237,0.10),
            rgba(6,182,212,0.08),
            rgba(217,70,239,0.09),
            rgba(59,91,255,0.10)
          );
          filter: blur(60px);
          animation: rotateAura 60s linear infinite;
          opacity: 0.7;
        }
        @keyframes rotateAura {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }

        /* Faint drifting circuit / data mesh, on-theme for a document AI */
        .mesh-grid {
          position: absolute;
          inset: -10%;
          background-image:
            linear-gradient(rgba(129,140,248,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(129,140,248,0.05) 1px, transparent 1px);
          background-size: 64px 64px;
          mask-image: radial-gradient(ellipse 70% 55% at 50% 35%, black 30%, transparent 85%);
          animation: meshDrift 34s linear infinite;
          opacity: 0.6;
        }
        @keyframes meshDrift {
          from { background-position: 0px 0px, 0px 0px; }
          to { background-position: 64px 96px, 64px 96px; }
        }

        /* Organic drifting color blobs */
        .aurora {
          position: absolute;
          width: 560px;
          height: 560px;
          border-radius: 50%;
          filter: blur(150px);
          opacity: 0.2;
          will-change: transform;
        }
        .aurora-1 { background: #3b5bff; top: -140px; left: 6%; animation: drift1 24s ease-in-out infinite; }
        .aurora-2 { background: #7c3aed; bottom: -160px; right: 2%; animation: drift2 28s ease-in-out infinite; }
        .aurora-3 { background: #06b6d4; top: 30%; right: 18%; width: 440px; height: 440px; opacity: 0.14; animation: drift3 32s ease-in-out infinite; }
        .aurora-4 { background: #d946ef; bottom: 8%; left: 22%; width: 400px; height: 400px; opacity: 0.13; animation: drift4 26s ease-in-out infinite; }

        @keyframes drift1 {
          0%   { transform: translate(0,0) scale(1); }
          33%  { transform: translate(90px, 60px) scale(1.12); }
          66%  { transform: translate(30px, 120px) scale(0.94); }
          100% { transform: translate(0,0) scale(1); }
        }
        @keyframes drift2 {
          0%   { transform: translate(0,0) scale(1); }
          33%  { transform: translate(-80px, -50px) scale(1.08); }
          66%  { transform: translate(-30px, -110px) scale(0.92); }
          100% { transform: translate(0,0) scale(1); }
        }
        @keyframes drift3 {
          0%   { transform: translate(0,0) scale(1) rotate(0deg); }
          50%  { transform: translate(-70px, 80px) scale(1.15) rotate(20deg); }
          100% { transform: translate(0,0) scale(1) rotate(0deg); }
        }
        @keyframes drift4 {
          0%   { transform: translate(0,0) scale(1); }
          50%  { transform: translate(60px, -70px) scale(1.1); }
          100% { transform: translate(0,0) scale(1); }
        }

        /* Twinkling "data node" particles, evoking embeddings / vector points */
        .node-field { position: absolute; inset: 0; }
        .node {
          position: absolute;
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background: #a5b4fc;
          box-shadow: 0 0 6px 1px rgba(165,180,252,0.6);
          animation: nodeTwinkle 5s ease-in-out infinite;
        }
        .node-2 { background: #7dd3fc; box-shadow: 0 0 6px 1px rgba(125,211,252,0.6); animation-duration: 6.5s; }
        .node-3 { background: #f0abfc; box-shadow: 0 0 6px 1px rgba(240,171,252,0.6); animation-duration: 4.2s; }
        .node-4 { background: #c4b5fd; box-shadow: 0 0 6px 1px rgba(196,181,253,0.6); animation-duration: 7s; width: 2px; height: 2px; }
        .node-5 { background: #67e8f9; box-shadow: 0 0 6px 1px rgba(103,232,249,0.55); animation-duration: 5.6s; }
        .node-6 { background: #818cf8; box-shadow: 0 0 6px 1px rgba(129,140,248,0.6); animation-duration: 8s; width: 2px; height: 2px; }
        @keyframes nodeTwinkle {
          0%, 100% { opacity: 0.15; transform: translateY(0) scale(1); }
          50% { opacity: 0.9; transform: translateY(-14px) scale(1.4); }
        }

        .grain-overlay {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image: radial-gradient(rgba(255,255,255,0.025) 1px, transparent 1px);
          background-size: 26px 26px;
          mask-image: radial-gradient(ellipse 80% 60% at 50% 30%, black 40%, transparent 100%);
        }

        .vignette {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: radial-gradient(ellipse 90% 80% at 50% 40%, transparent 40%, rgba(2,2,3,0.75) 100%);
        }

        /* ================= Solo Leveling summoning circles ================= */
        .magic-circle-svg {
          position: absolute;
          filter: drop-shadow(0 0 34px rgba(99,102,241,0.22));
        }
        .summon-circle-main {
          width: 920px;
          height: 920px;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          opacity: 0.55;
        }
        .summon-circle-accent {
          width: 380px;
          height: 380px;
          bottom: -70px;
          right: -60px;
          opacity: 0.32;
        }
        @media (max-width: 768px) {
          .summon-circle-main { width: 640px; height: 640px; }
          .summon-circle-accent { display: none; }
        }

        .circle-ring { transform-box: fill-box; transform-origin: center; }
        .circle-ring-outer { animation: circleSpinCW 54s linear infinite; }
        .circle-ring-mid { animation: circleSpinCCW 38s linear infinite; }
        .circle-ring-inner { animation: circleSpinCW 24s linear infinite; }
        @keyframes circleSpinCW { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes circleSpinCCW { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }

        .circle-core {
          transform-box: fill-box;
          transform-origin: center;
          animation: coreFlicker 2.4s ease-in-out infinite;
          filter: drop-shadow(0 0 10px rgba(199,210,254,0.95));
        }
        @keyframes coreFlicker {
          0%, 100% { opacity: 0.45; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.7); }
        }

        /* Expanding "System" activation shockwave rings, firing from the circle's core */
        .power-pulse {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 44px;
          height: 44px;
          margin: -22px 0 0 -22px;
          border-radius: 50%;
          border: 1px solid rgba(129,140,248,0.55);
          box-shadow: 0 0 20px rgba(129,140,248,0.15);
          animation: powerPulse 9s ease-out infinite;
        }
        .power-pulse-delay { animation-delay: 4.5s; border-color: rgba(196,181,253,0.5); }
        @keyframes powerPulse {
          0% { transform: scale(1); opacity: 0.65; }
          65% { opacity: 0.12; }
          100% { transform: scale(40); opacity: 0; }
        }

        /* Rising mana motes, like essence being drawn up into the gate */
        .mana-field { position: absolute; inset: 0; overflow: hidden; }
        .mana-mote {
          position: absolute;
          bottom: -12px;
          width: 2.5px;
          height: 2.5px;
          border-radius: 50%;
          background: #a5b4fc;
          box-shadow: 0 0 8px 2px rgba(165,180,252,0.7);
          animation: manaRise linear infinite;
        }
        .mana-mote:nth-child(3n) { background: #c4b5fd; box-shadow: 0 0 8px 2px rgba(196,181,253,0.65); }
        .mana-mote:nth-child(4n) { background: #67e8f9; box-shadow: 0 0 7px 2px rgba(103,232,249,0.6); width: 2px; height: 2px; }
        @keyframes manaRise {
          0% { transform: translateY(0) translateX(0); opacity: 0; }
          12% { opacity: 0.9; }
          82% { opacity: 0.55; }
          100% { transform: translateY(-108vh) translateX(24px); opacity: 0; }
        }

        /* Rare arcane lightning crack, sweeping across the scene */
        .lightning-crack {
          position: absolute;
          top: 0;
          right: 8%;
          width: 220px;
          height: 100%;
          opacity: 0;
          animation: lightningCrack 11s ease-in-out infinite;
        }
        @keyframes lightningCrack {
          0%, 96%, 100% { opacity: 0; }
          97% { opacity: 0.9; }
          97.6% { opacity: 0.1; }
          98.2% { opacity: 0.7; }
          99% { opacity: 0; }
        }

        /* ================= Cartoon mascot animations ================= */
        .mascot-bob { animation: mascotBob 3.4s ease-in-out infinite; transform-origin: 160px 240px; }
        @keyframes mascotBob {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-8px) rotate(-1deg); }
        }
        .mascot-eye { animation: mascotBlink 4.5s ease-in-out infinite; transform-origin: center; }
        @keyframes mascotBlink {
          0%, 92%, 100% { transform: scaleY(1); }
          95% { transform: scaleY(0.15); }
        }
        .mascot-antenna-dot { animation: mascotAntenna 1.6s ease-in-out infinite; }
        @keyframes mascotAntenna {
          0%, 100% { opacity: 0.6; r: 4.5; }
          50% { opacity: 1; r: 5.5; }
        }
        .mascot-arm { animation: mascotWave 1.8s ease-in-out infinite; transform-origin: 217px 150px; }
        @keyframes mascotWave {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-18deg); }
          50% { transform: rotate(4deg); }
          75% { transform: rotate(-12deg); }
        }
        .mascot-blip { animation: mascotBlip 1.4s ease-in-out infinite; }
        .mascot-blip-delay { animation-delay: 0.7s; }
        @keyframes mascotBlip {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 1; }
        }
        .mascot-doc { animation: mascotDocFloat 5s ease-in-out infinite; }
        .mascot-doc-1 { animation-duration: 5.5s; }
        .mascot-doc-2 { animation-duration: 4.6s; animation-delay: 0.6s; }
        @keyframes mascotDocFloat {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          50% { transform: translateY(-12px) rotate(2deg); }
        }
        .mascot-sparkle { animation: mascotSparkle 2.4s ease-in-out infinite; transform-origin: center; }
        .mascot-sparkle-2 { animation-delay: 1.1s; }
        @keyframes mascotSparkle {
          0%, 100% { opacity: 0.2; transform: scale(0.7) rotate(0deg); }
          50% { opacity: 1; transform: scale(1.15) rotate(25deg); }
        }
        .mascot-svg { filter: drop-shadow(0 6px 18px rgba(99,102,241,0.2)); }

        .docfly-float { animation: docflyFloat 3s ease-in-out infinite; }
        @keyframes docflyFloat {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-6px) rotate(1.5deg); }
        }
        .docfly-sparkle { animation: mascotSparkle 2.2s ease-in-out infinite; transform-origin: center; }

        .logo-eye { animation: mascotBlink 4.5s ease-in-out infinite; transform-origin: center; }
        .logo-eye-delay { animation-delay: 0.05s; }

        /* Logo pulse ring */
        .logo-ring {
          position: absolute;
          inset: -3px;
          border-radius: 14px;
          border: 1px solid rgba(99,102,241,0.35);
          animation: logoPulse 2.6s ease-in-out infinite;
        }
        @keyframes logoPulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0; transform: scale(1.18); }
        }

        /* Button sheen */
        .btn-sheen {
          position: absolute;
          top: 0; left: -60%;
          width: 40%; height: 100%;
          background: linear-gradient(120deg, transparent, rgba(0,0,0,0.15), transparent);
          transform: skewX(-20deg);
          transition: left 0.6s ease;
        }
        label:hover .btn-sheen { left: 130%; }

        /* Sidebar item entrance */
        .sidebar-item-in { animation: itemIn 0.35s ease-out backwards; }
        @keyframes itemIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .active-doc-bar {
          position: absolute;
          left: 0; top: 8px; bottom: 8px;
          width: 3px;
          border-radius: 3px;
          background: linear-gradient(180deg, #818cf8, #6366f1);
          box-shadow: 0 0 8px rgba(99,102,241,0.6);
        }

        .user-menu-in { animation: menuIn 0.18s ease-out; }
        @keyframes menuIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Radar / scan signature */
        .radar-ring {
          position: absolute;
          inset: 0;
          border-radius: 16px;
          border: 1px solid rgba(99,102,241,0.4);
          animation: radarPulse 2.4s ease-out infinite;
        }
        .radar-ring-delay { animation-delay: 1.2s; }
        @keyframes radarPulse {
          0% { opacity: 0.55; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.9); }
        }
        .scan-icon, .scan-icon-sm { overflow: hidden; }
        .scan-sweep {
          position: absolute;
          left: 0; right: 0;
          height: 40%;
          background: linear-gradient(180deg, transparent, rgba(129,140,248,0.35), transparent);
          animation: scanSweep 2.2s ease-in-out infinite;
        }
        .scan-sweep-sm { animation-duration: 1.3s; }
        @keyframes scanSweep {
          0% { transform: translateY(-120%); }
          100% { transform: translateY(220%); }
        }

        .thinking-dot {
          width: 4px; height: 4px;
          border-radius: 50%;
          background: currentColor;
          display: inline-block;
          animation: dotBounce 0.9s ease-in-out infinite;
        }
        @keyframes dotBounce {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-2px); }
        }

        /* Messages */
        .msg-in { animation: msgIn 0.35s cubic-bezier(0.2,0.8,0.2,1) both; }
        @keyframes msgIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Input bar focus glow */
        .input-bar { transition: box-shadow 0.3s, border-color 0.3s; }
        .input-bar:focus-within {
          border-color: rgba(99,102,241,0.5);
          box-shadow: 0 0 0 1px rgba(99,102,241,0.25), 0 10px 40px rgba(99,102,241,0.15);
        }

        /* Preview panel */
        .panel-in { animation: panelIn 0.3s cubic-bezier(0.2,0.8,0.2,1) both; }
        @keyframes panelIn {
          from { opacity: 0; transform: translateX(24px); }
          to { opacity: 1; transform: translateX(0); }
        }

        /* Toast */
        .toast-in { animation: toastIn 0.3s cubic-bezier(0.2,0.8,0.2,1) both; }
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(-10px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @media (prefers-reduced-motion: reduce) {
          .aurora, .conic-aura, .mesh-grid, .node, .logo-ring, .btn-sheen,
          .sidebar-item-in, .radar-ring, .scan-sweep, .thinking-dot,
          .msg-in, .panel-in, .toast-in, .user-menu-in,
          .mascot-bob, .mascot-eye, .mascot-antenna-dot, .mascot-arm,
          .mascot-blip, .mascot-doc, .mascot-sparkle, .docfly-float,
          .docfly-sparkle, .logo-eye,
          .circle-ring, .circle-core, .power-pulse, .mana-mote, .lightning-crack {
            animation: none !important;
          }
        }

        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }

        .model-select {
          -webkit-appearance: none;
          -moz-appearance: none;
          appearance: none;
          background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236366f1' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
          background-repeat: no-repeat;
          background-position: right 6px center;
          background-size: 12px;
          padding-right: 22px;
        }

        .rag-markdown { font-size: 14px; line-height: 1.7; color: #d4d4d8; }
        .rag-markdown h1 { font-size: 1.3rem; font-weight: 700; color: #fff; margin: 1rem 0 0.5rem; }
        .rag-markdown h2 { font-size: 1.15rem; font-weight: 700; color: #fff; margin: 0.9rem 0 0.4rem; }
        .rag-markdown h3 { font-size: 1rem; font-weight: 600; color: #e4e4e7; margin: 0.8rem 0 0.3rem; }
        .rag-markdown p { margin-bottom: 0.7rem; }
        .rag-markdown strong { color: #fff; font-weight: 600; }
        .rag-markdown em { color: #a1a1aa; }
        .rag-markdown ul { list-style: disc; padding-left: 1.25rem; margin: 0.5rem 0 0.7rem; }
        .rag-markdown ol { list-style: decimal; padding-left: 1.25rem; margin: 0.5rem 0 0.7rem; }
        .rag-markdown li { margin-bottom: 0.25rem; }
        .rag-markdown li::marker { color: #6366f1; }
        .rag-markdown code { background: rgba(99,102,241,0.12); color: #a5b4fc; padding: 1px 6px; border-radius: 4px; font-size: 12px; }
        .rag-markdown pre { background: #0f0f14; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 0.8rem 1rem; overflow-x: auto; margin: 0.75rem 0; }
        .rag-markdown pre code { background: transparent; padding: 0; font-size: 12px; }
        .rag-markdown blockquote { border-left: 3px solid #6366f1; background: rgba(99,102,241,0.06); padding: 0.5rem 0.8rem; border-radius: 0 8px 8px 0; margin: 0.6rem 0; color: #a1a1aa; font-style: italic; }
        .rag-markdown table { width: 100%; border-collapse: collapse; margin: 0.75rem 0; font-size: 12px; }
        .rag-markdown th { background: #18181b; color: #fff; font-weight: 600; padding: 6px 10px; text-align: left; border: 1px solid rgba(255,255,255,0.08); }
        .rag-markdown td { padding: 5px 10px; border: 1px solid rgba(255,255,255,0.06); }
        .rag-markdown hr { border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 1rem 0; }
        .rag-markdown a { color: #818cf8; text-decoration: underline; }
        .rag-markdown a:hover { color: #a5b4fc; }
      `}</style>
    </div>
  );
}
