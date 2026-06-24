/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  Upload, 
  FileText, 
  X, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  ArrowRightLeft,
  ArrowRight,
  ArrowLeft,
  Info,
  BookOpen,
  Filter,
  Sparkles,
  RefreshCw,
  MessageSquare,
  Send,
  Lightbulb,
  Target,
  Download,
  List,
  School,
  GraduationCap,
  ShieldCheck,
  AlertTriangle,
  Flame,
  TrendingUp,
  CheckSquare,
  Plus,
  LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { AnalysisDashboard } from './components/AnalysisDashboard';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AnswerRenderer } from './components/AnswerRenderer';
import { UploadedFile, AnalysisResult, Question, RawQuestion, AnswerSection } from './types';
import { analyzePapers, simplifyAnswer, generateShortAnswer, chatWithAI, generateStudyStrategy, generateFullAnswer } from './services/geminiService';
import { auth, signInWithGoogle, logout } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useFirestore } from './hooks/useFirestore';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function Accordion({ title, children, defaultOpen = false, icon: Icon }: { title: string; children: React.ReactNode; defaultOpen?: boolean; icon?: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border border-black/5 rounded-[32px] overflow-hidden bg-white shadow-sm transition-all hover:shadow-md">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-8 py-6 flex items-center justify-between text-left hover:bg-black/[0.02] transition-colors"
      >
        <div className="flex items-center gap-4">
          {Icon && <div className="text-emerald-600">{Icon}</div>}
          <span className="text-lg font-bold text-slate-800">{title}</span>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="text-black/20"
        >
          <ChevronRight size={24} />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <div className="px-8 pb-8 pt-2">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authWithState, setAuthWithState] = useState<'login' | 'signup'>('login');
  const [searchQuery, setSearchQuery] = useState("");
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [zoomedDiagram, setZoomedDiagram] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<(AnalysisResult & { id: string })[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    const checkApiKey = async () => {
      // @ts-ignore
      if (window.aistudio?.hasSelectedApiKey) {
        // @ts-ignore
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      }
    };
    checkApiKey();
  }, []);

  const handleOpenKeyDialog = async () => {
    // @ts-ignore
    if (window.aistudio?.openSelectKey) {
      // @ts-ignore
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
      setError(null);
    }
  };

  const { isLoading: isLoadingHistory, logAction, saveAnalysis, loadHistory, deleteAnalysis } = useFirestore();
  const [selectedQuestion, setSelectedQuestion] = useState<Question | RawQuestion | null>(null);
  const [filter, setFilter] = useState<'all' | 'repeated'>('all');
  const [selectedUnit, setSelectedUnit] = useState<string>('All');
  const [simplifiedAnswer, setSimplifiedAnswer] = useState<string | null>(null);
  const [isSimplifying, setIsSimplifying] = useState(false);
  const [showSimplified, setShowSimplified] = useState(false);
  const [shortAnswer, setShortAnswer] = useState<string | null>(null);
  const [isGeneratingShort, setIsGeneratingShort] = useState(false);
  const [showShort, setShowShort] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [studyStrategy, setStudyStrategy] = useState<string | null>(null);
  const [isGeneratingStrategy, setIsGeneratingStrategy] = useState(false);
  const [isGeneratingAnswer, setIsGeneratingAnswer] = useState(false);
  const [isGeneratingHandbook, setIsGeneratingHandbook] = useState(false);
  const [handbookProgress, setHandbookProgress] = useState<string>("");
  const [handbookTotal, setHandbookTotal] = useState<number>(0);
  const [handbookCurrent, setHandbookCurrent] = useState<number>(0);
  const [showStrategy, setShowStrategy] = useState(false);
  const [viewMode, setViewMode] = useState<'bank' | 'repeated' | 'predictions' | 'report' | 'strategy'>('bank');
  const [contextHint, setContextHint] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [strategyTimeframe, setStrategyTimeframe] = useState("general");
  const [customTimeframe, setCustomTimeframe] = useState("");
  const QUESTIONS_PER_PAGE = 50;

  const chatEndRef = useRef<HTMLDivElement>(null);
  const modalContentRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (selectedQuestion) {
      // Use a small timeout to ensure the DOM has updated and the new content is rendered
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
      }, 0);
    }
  }, [selectedQuestion]);

  useEffect(() => {
    if (selectedQuestion) {
      scrollToBottom();
      
      // Lazy load answer if missing
      if (!selectedQuestion.answer && result) {
        const loadAnswer = async () => {
          setIsGeneratingAnswer(true);
          try {
            const fullData = await generateFullAnswer(
              selectedQuestion.text,
              selectedQuestion.marks,
              result.subject
            );
            
            // Update the question in the result state so it's cached
            setResult(prev => {
              if (!prev) return prev;
              const updateQuestion = (q: any) => {
                if (q.text === selectedQuestion.text) {
                  return { ...q, ...fullData };
                }
                return q;
              };
              
              return {
                ...prev,
                questions: prev.questions.map(updateQuestion),
                rawQuestions: prev.rawQuestions.map(updateQuestion)
              };
            });

            // Update selected question locally
            setSelectedQuestion(prev => prev ? { ...prev, ...fullData } : null);
          } catch (err) {
            console.error("Failed to generate answer", err);
          } finally {
            setIsGeneratingAnswer(false);
          }
        };
        loadAnswer();
      }
    }
  }, [chatMessages, selectedQuestion, result]);

  // Keep studyStrategy state in sync with loaded result (including history loads)
  useEffect(() => {
    if (result) {
      if (result.studyStrategy) {
        setStudyStrategy(result.studyStrategy);
      } else {
        const generate = async () => {
          setIsGeneratingStrategy(true);
          try {
            const strategy = await generateStudyStrategy(result);
            setStudyStrategy(strategy);
            setResult(prev => prev ? { ...prev, studyStrategy: strategy } : prev);
          } catch (e) {
            console.error(e);
          } finally {
            setIsGeneratingStrategy(false);
          }
        };
        generate();
      }
    } else {
      setStudyStrategy(null);
    }
  }, [result]);

  useEffect(() => {
    setCurrentPage(1);
  }, [viewMode, selectedUnit, result]);

  const getMostRepeatedTopics = () => {
    if (!result) return [];
    const topicCounts: Record<string, { count: number; totalReps: number }> = {};
    result.questions.forEach(q => {
      const t = q.topic || 'General';
      if (!topicCounts[t]) {
        topicCounts[t] = { count: 0, totalReps: 0 };
      }
      topicCounts[t].count += 1;
      topicCounts[t].totalReps += q.repetitionCount;
    });
    return Object.entries(topicCounts)
      .map(([topic, stats]) => ({ topic, ...stats }))
      .sort((a, b) => b.totalReps - a.totalReps)
      .slice(0, 5);
  };

  const getDifficultyDistribution = () => {
    if (!result) return { easy: 0, medium: 0, hard: 0 };
    const total = result.questions.length;
    if (total === 0) return { easy: 0, medium: 0, hard: 0 };
    let easy = 0, medium = 0, hard = 0;
    result.questions.forEach(q => {
      const diff = q.difficulty || 'medium';
      if (diff === 'easy') easy++;
      else if (diff === 'hard') hard++;
      else medium++;
    });
    return {
      easy: Math.round((easy / total) * 100),
      medium: Math.round((medium / total) * 100),
      hard: Math.round((hard / total) * 100),
    };
  };

  const getPaginatedQuestions = () => {
    if (!result) return [];
    if (viewMode === 'bank') {
      // Prioritized Question Bank: Unique questions sorted by frequency
      const sorted = [...result.questions].sort((a, b) => {
        // Sort by repetitionCount DESC
        if (b.repetitionCount !== a.repetitionCount) {
          return b.repetitionCount - a.repetitionCount;
        }
        // Then by marks DESC
        return b.marks - a.marks;
      });
      const filtered = sorted.filter(q => selectedUnit === 'All' || (q.unit || 'General') === selectedUnit);
      const start = (currentPage - 1) * QUESTIONS_PER_PAGE;
      return filtered.slice(start, start + QUESTIONS_PER_PAGE);
    } else if (viewMode === 'repeated') {
      const filtered = result.questions.filter(q => q.repetitionCount > 1);
      const start = (currentPage - 1) * QUESTIONS_PER_PAGE;
      return filtered.slice(start, start + QUESTIONS_PER_PAGE);
    } else if (viewMode === 'predictions' || viewMode === 'report') {
      return [];
    } else {
      const start = (currentPage - 1) * QUESTIONS_PER_PAGE;
      return result.rawQuestions.slice(start, start + QUESTIONS_PER_PAGE);
    }
  };

  const paginatedData = getPaginatedQuestions();
  const totalQuestionsCount = viewMode === 'bank' 
    ? result?.questions.filter(q => selectedUnit === 'All' || (q.unit || 'General') === selectedUnit).length || 0
    : viewMode === 'repeated'
      ? result?.questions.filter(q => q.repetitionCount > 1).length || 0
      : (viewMode === 'predictions' || viewMode === 'report')
        ? 0
        : result?.rawQuestions.length || 0;
  const totalPages = Math.ceil(totalQuestionsCount / QUESTIONS_PER_PAGE);

  const regenerateStrategy = async (timeframe: string) => {
    if (!result) return;
    setStrategyTimeframe(timeframe);
    setIsGeneratingStrategy(true);
    try {
      const strategy = await generateStudyStrategy(result, timeframe);
      setStudyStrategy(strategy);
    } catch (err) {
      console.error("Failed to generate strategy", err);
    } finally {
      setIsGeneratingStrategy(false);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      id: Math.random().toString(36).substring(7)
    }));
    setFiles(prev => [...prev, ...newFiles]);
    setError(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg']
    },
    minSize: 0,
    multiple: true
  } as any);

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      handleLoadHistory();
    } else {
      setHistory([]);
    }
  }, [user]);

  const handleLoadHistory = async () => {
    const data = await loadHistory();
    setHistory(data);
  };

  const handleDeleteAnalysis = async (id: string) => {
    await deleteAnalysis(id);
    setHistory(prev => prev.filter(h => h.id !== id));
  };

  const handleAnalyze = async () => {
    if (files.length < 2) {
      setError("Please upload at least 2 question papers.");
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const fileData = await Promise.all(files.map(async (f) => {
        return new Promise<{ data: string; mimeType: string; name: string }>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            resolve({
              data: reader.result as string,
              mimeType: f.file.type,
              name: f.file.name
            });
          };
          reader.readAsDataURL(f.file);
        });
      }));

      const analysis = await analyzePapers(fileData, contextHint);
      
      if (!analysis.isSameSubject) {
        setError(`The uploaded papers seem to be for different subjects. Detected subject: ${analysis.subject}. Please upload papers for the same subject.`);
        setIsAnalyzing(false);
        return;
      }

      // Automatically generate strategy first so it gets persisted in history
      let strategy = "";
      setIsGeneratingStrategy(true);
      try {
        strategy = await generateStudyStrategy(analysis);
        setStudyStrategy(strategy);
      } catch (err) {
        console.error("Failed to generate strategy", err);
      } finally {
        setIsGeneratingStrategy(false);
      }

      const enrichedAnalysis = {
        ...analysis,
        uploadedPapers: files.map(f => f.file.name),
        studyStrategy: strategy
      };
      setResult(enrichedAnalysis);
      if (user) {
        saveAnalysis(enrichedAnalysis);
      }
      logAction('papers_analyzed', analysis.subject);
    } catch (err: any) {
      console.error(err);
      if (err?.message?.includes("RESOURCE_EXHAUSTED") || err?.message?.includes("429")) {
        setError("You've exceeded the free quota. Please switch to a paid API key to continue analyzing papers.");
      } else {
        setError("Failed to analyze papers. Please try again.");
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const reset = () => {
    setFiles([]);
    setResult(null);
    setError(null);
    setContextHint("");
  };

  const handleSimplify = async () => {
    if (!selectedQuestion) return;
    
    if (simplifiedAnswer) {
      setShowSimplified(!showSimplified);
      return;
    }

    setIsSimplifying(true);
    try {
      const simplified = await simplifyAnswer(selectedQuestion.text, selectedQuestion.answer, selectedQuestion.marks);
      setSimplifiedAnswer(simplified);
      setShowSimplified(true);
    } catch (err: any) {
      console.error(err);
      if (err?.message?.includes("RESOURCE_EXHAUSTED") || err?.message?.includes("429")) {
        setError("You've exceeded the free quota. Please switch to a paid API key to continue.");
      }
    } finally {
      setIsSimplifying(false);
    }
  };

  const handleShort = async () => {
    if (!selectedQuestion) return;
    
    if (shortAnswer) {
      setShowShort(!showShort);
      setShowSimplified(false);
      return;
    }

    // Check if it's already in the question object (from initial analysis)
    if (selectedQuestion.shortAnswer) {
      setShortAnswer(selectedQuestion.shortAnswer);
      setShowShort(true);
      setShowSimplified(false);
      return;
    }

    setIsGeneratingShort(true);
    try {
      const short = await generateShortAnswer(selectedQuestion.text, selectedQuestion.answer);
      setShortAnswer(short);
      setShowShort(true);
      setShowSimplified(false);
    } catch (err: any) {
      console.error(err);
      if (err?.message?.includes("RESOURCE_EXHAUSTED") || err?.message?.includes("429")) {
        setError("You've exceeded the free quota. Please switch to a paid API key to continue.");
      }
    } finally {
      setIsGeneratingShort(false);
    }
  };

  const handleCloseModal = () => {
    setSelectedQuestion(null);
    setSimplifiedAnswer(null);
    setShowSimplified(false);
    setShortAnswer(null);
    setShowShort(false);
    setChatMessages([]);
    setUserInput('');
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || !selectedQuestion || isChatting || isGeneratingAnswer) return;

    const userMsg = userInput.trim();
    setUserInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsChatting(true);

    try {
      const history = chatMessages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      const response = await chatWithAI(
        selectedQuestion.text,
        selectedQuestion.answer,
        userMsg,
        history
      );
      setChatMessages(prev => [...prev, { role: 'model', text: response }]);
    } catch (err: any) {
      console.error(err);
      if (err?.message?.includes("RESOURCE_EXHAUSTED") || err?.message?.includes("429")) {
        setChatMessages(prev => [...prev, { role: 'model', text: "You've exceeded the free quota. Please switch to a paid API key to continue chatting." }]);
        setError("Quota exceeded. Switch to a paid key to continue.");
      } else {
        setChatMessages(prev => [...prev, { role: 'model', text: "Sorry, I'm having trouble connecting right now." }]);
      }
    } finally {
      setIsChatting(false);
    }
  };

  const cleanStringForPDF = (text: string): string => {
    if (!text) return "";
    let cleaned = text
      .replace(/[’‘]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/…/g, "...")
      .replace(/[—–]/g, "-")
      .replace(/──►/g, "-->")
      .replace(/──>/g, "-->")
      .replace(/──/g, "--")
      .replace(/►/g, ">")
      .replace(/├──/g, "  - ")
      .replace(/└──/g, "  - ")
      .replace(/│/g, " | ")
      .replace(/•/g, "-")
      .replace(/◦/g, "-")
      .replace(/▪/g, "-")
      .replace(/▫/g, "-")
      .replace(/º/g, "deg")
      .replace(/√/g, "sqrt")
      .replace(/±/g, "+/-")
      .replace(/²/g, "^2")
      .replace(/³/g, "^3")
      .replace(/¹/g, "^1")
      .replace(/≈/g, "~")
      .replace(/≠/g, "!=")
      .replace(/≤/g, "<=")
      .replace(/≥/g, ">=")
      .replace(/α/gi, "alpha")
      .replace(/β/gi, "beta")
      .replace(/θ/gi, "theta")
      .replace(/λ/gi, "lambda")
      .replace(/π/gi, "pi")
      .replace(/μ/gi, "micro")
      .replace(/Σ/g, "Sum");

    let resultStr = "";
    for (let i = 0; i < cleaned.length; i++) {
      const code = cleaned.charCodeAt(i);
      if (code <= 255) {
        resultStr += cleaned.charAt(i);
      }
    }

    return resultStr.trim();
  };

  const addPageDecoration = (doc: any, titleStr: string) => {
    const pageCount = doc.internal.getNumberOfPages();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;

    for (let i = 2; i <= pageCount; i++) {
      doc.setPage(i);
      
      // Header
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(titleStr.toUpperCase(), margin, 15);
      doc.text("EXAM PLUS | PREMIUM ANALYTICS", pageWidth - margin, 15, { align: 'right' });
      
      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.2);
      doc.line(margin, 17, pageWidth - margin, 17);

      // Footer
      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.2);
      doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
      
      doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
      doc.text("Generated by Exam Plus Premium Analyzer", margin, pageHeight - 10);
    }
  };

  const downloadQuestionBank = () => {
    if (!result) {
      setError("No analysis data available for download.");
      return;
    }
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);

      // COVER PAGE
      doc.setFillColor(248, 250, 252); // Soft light slate background
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      
      doc.setTextColor(5, 150, 105); // emerald-600
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(28);
      const titleLines = doc.splitTextToSize(result.subject.toUpperCase() + " QUESTION BANK", contentWidth);
      doc.text(titleLines, pageWidth / 2, pageHeight / 3, { align: 'center' });

      doc.setTextColor(100, 116, 139);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.text('Comprehensive Previous Year Questions organized by Unit and Topic', pageWidth / 2, (pageHeight / 3) + 20 + (titleLines.length * 5), { align: 'center' });

      if (result.institution) {
        doc.setFontSize(12);
        doc.text(result.institution, pageWidth / 2, (pageHeight / 3) + 30 + (titleLines.length * 5), { align: 'center' });
      }

      // Metadata card on cover
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.rect(20, pageHeight - 90, pageWidth - 40, 50, 'FD');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(71, 85, 105);
      doc.text("EXAM METRICS", 30, pageHeight - 80);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`Total Unique Questions: ${result.questions.length}`, 30, pageHeight - 70);
      const papersListCalculated = Array.from(new Set([
        ...result.rawQuestions.map(q => q.paperName),
        ...(result.questions || []).flatMap(q => q.sourcePapers || [])
      ].filter(Boolean)));
      const papersCount = papersListCalculated.length || 1;
      doc.text(`Papers Analyzed: ${papersCount}`, 30, pageHeight - 62);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 30, pageHeight - 54);

      // Body Section
      doc.addPage();
      let yPos = 30;

      const units = Array.from(new Set(result.questions.map(q => q.unit || 'General')))
        .sort((a, b) => {
          const numA = parseInt(a.match(/\d+/)?.[0] || '0');
          const numB = parseInt(b.match(/\d+/)?.[0] || '0');
          return numA - numB || a.localeCompare(b);
        });

      units.forEach(unit => {
        const unitQuestions = result.questions.filter(q => (q.unit || 'General') === unit);
        if (unitQuestions.length === 0) return;

        if (yPos > pageHeight - 40) {
          doc.addPage();
          yPos = 30;
        }

        // Section Title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(5, 150, 105);
        doc.text(unit.toUpperCase(), margin, yPos);
        yPos += 8;

        doc.setDrawColor(5, 150, 105);
        doc.setLineWidth(0.5);
        doc.line(margin, yPos, margin + 40, yPos);
        yPos += 12;

        // Group by topic within Unit
        const topicsMap: Record<string, typeof result.questions> = {};
        unitQuestions.forEach(q => {
          const t = q.topic || 'General Topics';
          if (!topicsMap[t]) topicsMap[t] = [];
          topicsMap[t].push(q);
        });

        Object.entries(topicsMap).forEach(([topicName, qList]) => {
          if (yPos > pageHeight - 40) {
            doc.addPage();
            yPos = 30;
          }

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
          doc.setTextColor(15, 23, 42); // slate-900
          doc.text(`TOPIC: ${topicName.toUpperCase()}`, margin, yPos);
          yPos += 6;

          qList.forEach((q, qidx) => {
            const lines = doc.splitTextToSize(`${qidx + 1}. ${q.text}`, contentWidth - 10);
            const neededHeight = (lines.length * 6) + 12;

            if (yPos + neededHeight > pageHeight - 20) {
              doc.addPage();
              yPos = 30;
            }

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(51, 65, 85); // slate-700
            doc.text(lines, margin + 5, yPos);
            yPos += (lines.length * 6) + 2;

            // Details description
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            const detailText = `Marks: ${q.marks} | Difficulty: ${q.difficulty?.toUpperCase()} | Repetitions: ${q.repetitionCount}x`;
            doc.text(detailText, margin + 5, yPos);
            yPos += 8;
          });

          yPos += 4;
        });

        yPos += 8;
      });

      // Add decorations via post-processing helper
      addPageDecoration(doc, `${result.subject} Question Bank`);

      const filename = `${result.subject.replace(/[^a-zA-Z0-9]/g, '_')}_Question_Bank.pdf`;
      doc.save(filename);
    } catch (err) {
      console.error(err);
      setError("Failed to generate report. Please try again.");
    }
  };

  const downloadRepeatedQuestions = () => {
    if (!result) {
      setError("No analysis data available for download.");
      return;
    }
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);

      // COVER PAGE
      doc.setFillColor(254, 242, 242); // Soft light red background
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      
      doc.setTextColor(220, 38, 38); // red-600
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(26);
      const titleLines = doc.splitTextToSize(result.subject.toUpperCase() + " REPEATED QUESTIONS", contentWidth);
      doc.text(titleLines, pageWidth / 2, pageHeight / 3, { align: 'center' });

      doc.setTextColor(100, 116, 139);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.text('Key High-Frequency Exam Content Sorted by Repetitions', pageWidth / 2, (pageHeight / 3) + 20 + (titleLines.length * 5), { align: 'center' });

      if (result.institution) {
        doc.setFontSize(12);
        doc.text(result.institution, pageWidth / 2, (pageHeight / 3) + 30 + (titleLines.length * 5), { align: 'center' });
      }

      // Metadata card on cover
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(254, 202, 202);
      doc.rect(20, pageHeight - 90, pageWidth - 40, 50, 'FD');
      
      const repeatedQuestionsOnly = result.questions.filter(q => q.repetitionCount > 1);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(153, 27, 27);
      doc.text("FREQUENCY SCORECARD", 30, pageHeight - 80);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text(`Total Repeated Questions Found: ${repeatedQuestionsOnly.length}`, 30, pageHeight - 70);
      const highRepCount = result.questions.filter(q => q.repetitionCount >= 3).length;
      doc.text(`Highly Repeated (3x or more): ${highRepCount}`, 30, pageHeight - 62);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 30, pageHeight - 54);

      // Body Section
      doc.addPage();
      let yPos = 30;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(220, 38, 38);
      doc.text("PRIORITIZED REPEATED QUESTIONS", margin, yPos);
      yPos += 8;

      doc.setDrawColor(220, 38, 38);
      doc.setLineWidth(0.5);
      doc.line(margin, yPos, margin + 50, yPos);
      yPos += 12;

      // Sort by repetitionCount DESC
      const sortedReps = [...repeatedQuestionsOnly].sort((a,b) => b.repetitionCount - a.repetitionCount);

      if (sortedReps.length === 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        doc.text("No repeated questions analyzed in these papers yet.", margin, yPos);
      } else {
        sortedReps.forEach((q, idx) => {
          const lines = doc.splitTextToSize(`${idx + 1}. ${q.text}`, contentWidth - 10);
          
          let importance = "Medium Importance";
          if (q.repetitionCount >= 3) {
            importance = "Highly Repeated";
          }
          
          const yearsList = q.sourcePapers.join(', ') || 'N/A';
          const neededHeight = (lines.length * 6) + 26;

          if (yPos + neededHeight > pageHeight - 20) {
            doc.addPage();
            yPos = 30;
          }

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
          doc.setTextColor(15, 23, 42);
          doc.text(lines, margin, yPos);
          yPos += (lines.length * 6) + 4;

          // Badges / Tags
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          
          // Repetition
          doc.setFillColor(254, 242, 242);
          doc.setDrawColor(252, 165, 165);
          doc.rect(margin, yPos - 3, 40, 6, 'FD');
          doc.setTextColor(220, 38, 38);
          doc.setFont('helvetica', 'bold');
          doc.text(`Frequency: ${q.repetitionCount} Times`, margin + 2, yPos + 1);

          // Importance Level Badge
          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(226, 232, 240);
          doc.rect(margin + 45, yPos - 3, 45, 6, 'FD');
          doc.setTextColor(71, 85, 105);
          doc.text(`Priority: ${importance}`, margin + 47, yPos + 1);

          yPos += 10;

          // Years list
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9.5);
          doc.setTextColor(71, 85, 105);
          doc.text(`Asked In: [ ${yearsList} ]`, margin, yPos);
          yPos += 5;

          if (q.unit) {
            doc.text(`Unit Reference: ${q.unit} (Topic: ${q.topic || 'General'})`, margin, yPos);
            yPos += 5;
          }

          // Separator line
          doc.setDrawColor(241, 245, 249);
          doc.line(margin, yPos, pageWidth - margin, yPos);
          yPos += 10;
        });
      }

      addPageDecoration(doc, `${result.subject} Repeated Questions`);

      const filename = `${result.subject.replace(/[^a-zA-Z0-9]/g, '_')}_Repeated_Questions.pdf`;
      doc.save(filename);
    } catch (err) {
      console.error(err);
      setError("Failed to generate report. Please try again.");
    }
  };

  const downloadPredictedQuestions = () => {
    if (!result) {
      setError("No analysis data available for download.");
      return;
    }
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);

      // COVER PAGE
      doc.setFillColor(245, 243, 255); // Soft purple background
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      
      doc.setTextColor(124, 58, 237); // purple-600
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(26);
      const titleLines = doc.splitTextToSize(result.subject.toUpperCase() + " EXAM PREDICTIONS", contentWidth);
      doc.text(titleLines, pageWidth / 2, pageHeight / 3, { align: 'center' });

      doc.setTextColor(100, 116, 139);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.text('Advanced AI Strategy & Smart Exam Forecasts', pageWidth / 2, (pageHeight / 3) + 20 + (titleLines.length * 5), { align: 'center' });

      if (result.institution) {
        doc.setFontSize(12);
        doc.text(result.institution, pageWidth / 2, (pageHeight / 3) + 30 + (titleLines.length * 5), { align: 'center' });
      }

      // Card
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(233, 213, 255);
      doc.rect(20, pageHeight - 90, pageWidth - 40, 50, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(109, 40, 217);
      doc.text("FORECAST CONFIGURATION", 30, pageHeight - 80);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text("Algorithmic Predictor: Active Trend Analysis Mapping", 30, pageHeight - 70);
      doc.text(`Expected High Probability Topics: ${result.predictions?.importantTopics?.length || 5}`, 30, pageHeight - 62);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 30, pageHeight - 54);

      // Body Section
      doc.addPage();
      let yPos = 30;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(124, 58, 237);
      doc.text("TOP 10 HIGH PROBABILITY QUESTIONS", margin, yPos);
      yPos += 8;

      doc.setDrawColor(124, 58, 237);
      doc.setLineWidth(0.5);
      doc.line(margin, yPos, margin + 60, yPos);
      yPos += 12;

      const top10 = result.predictions?.top10RepeatedQuestions || [];
      if (top10.length === 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(100, 116, 139);
        doc.text("No predictive question sets mapped. Study repeated questions first.", margin, yPos);
        yPos += 10;
      } else {
        top10.forEach((q, idx) => {
          const lines = doc.splitTextToSize(`${idx + 1}. ${q}`, contentWidth - 10);
          const blockHeight = (lines.length * 6) + 10;

          if (yPos + blockHeight > pageHeight - 20) {
            doc.addPage();
            yPos = 30;
          }

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10.5);
          doc.setTextColor(15, 23, 42);
          doc.text(lines, margin, yPos);
          yPos += (lines.length * 6) + 2;

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.5);
          doc.setTextColor(124, 58, 237);
          doc.text("* Target Group: High Repetition Probability", margin + 6, yPos);
          yPos += 8;
        });
      }

      // Next exam predictions
      const trendPreds = result.predictions?.nextExamPredictions || [];
      if (trendPreds.length > 0) {
        if (yPos > pageHeight - 60) {
          doc.addPage();
          yPos = 30;
        } else {
          yPos += 10;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(15);
        doc.setTextColor(124, 58, 237);
        doc.text("SUGGESTED NEXT EXAM PREDICTIONS", margin, yPos);
        yPos += 8;

        doc.line(margin, yPos, margin + 60, yPos);
        yPos += 12;

        trendPreds.forEach((pred, idx) => {
          const lines = doc.splitTextToSize(`${idx + 1}. ${pred}`, contentWidth - 10);
          const blockHeight = (lines.length * 6) + 10;

          if (yPos + blockHeight > pageHeight - 20) {
            doc.addPage();
            yPos = 30;
          }

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10.5);
          doc.setTextColor(15, 23, 42);
          doc.text(lines, margin, yPos);
          yPos += (lines.length * 6) + 2;

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.5);
          doc.setTextColor(13, 148, 136); // teal-600
          doc.text("* Forecast Source: Cycle shift dynamic expectation", margin + 6, yPos);
          yPos += 8;
        });
      }

      addPageDecoration(doc, `${result.subject} Exam Predictions`);

      const filename = `${result.subject.replace(/[^a-zA-Z0-9]/g, '_')}_Predicted_Questions.pdf`;
      doc.save(filename);
    } catch (err) {
      console.error(err);
      setError("Failed to generate report. Please try again.");
    }
  };

  const downloadAIReport = () => {
    if (!result) {
      setError("No analysis data available for download.");
      return;
    }
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);

      // COVER PAGE
      doc.setFillColor(236, 253, 245); // Emerald soft light background
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      
      doc.setTextColor(4, 120, 87); // emerald-700
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(28);
      const titleLines = doc.splitTextToSize(result.subject.toUpperCase() + " PYQ ANALYSIS REPORT", contentWidth);
      doc.text(titleLines, pageWidth / 2, pageHeight / 3, { align: 'center' });

      doc.setTextColor(100, 116, 139);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.text('Advanced Educational AI Analytics & Trend Forecasts', pageWidth / 2, (pageHeight / 3) + 20 + (titleLines.length * 5), { align: 'center' });

      if (result.institution) {
        doc.setFontSize(12);
        doc.text(result.institution, pageWidth / 2, (pageHeight / 3) + 30 + (titleLines.length * 5), { align: 'center' });
      }

      // Scorecard card
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(167, 243, 208);
      doc.rect(20, pageHeight - 90, pageWidth - 40, 50, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(6, 95, 70);
      doc.text("AI ANALYTICS ENGINE", 30, pageHeight - 80);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      const papersListCalculated = Array.from(new Set([
        ...result.rawQuestions.map(q => q.paperName),
        ...(result.questions || []).flatMap(q => q.sourcePapers || [])
      ].filter(Boolean)));
      const papersCount = papersListCalculated.length || 1;
      doc.text(`Total Papers Collated: ${papersCount}`, 30, pageHeight - 70);
      doc.text(`Total Unique Questions: ${result.questions.length}`, 30, pageHeight - 62);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 30, pageHeight - 54);

      // Page 2: Analytical Summary & Key indicators
      doc.addPage();
      let yPos = 30;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(4, 120, 87);
      doc.text("SUBJECT TREND STATISTIC SUMMARY", margin, yPos);
      yPos += 8;

      doc.setDrawColor(4, 120, 87);
      doc.setLineWidth(0.5);
      doc.line(margin, yPos, margin + 50, yPos);
      yPos += 12;

      // Analysis Stats Blocks
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, yPos, contentWidth, 32, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text("CORE INSIGHTS CARD", margin + 5, yPos + 8);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(71, 85, 105);
      const unitCounts: Record<string, number> = {};
      result.questions.forEach(q => { unitCounts[q.unit || 'General'] = (unitCounts[q.unit || 'General'] || 0) + 1; });
      const sortedUnits = Object.entries(unitCounts).sort((a,b) => b[1] - a[1]);
      const mostAskedUnit = sortedUnits[0]?.[0] || 'Unit 1';
      
      const mostRepTopic = getMostRepeatedTopics()[0]?.topic || 'N/A';
      
      doc.text(`Most Frequently Asked Unit: ${mostAskedUnit}`, margin + 5, yPos + 16);
      doc.text(`Top Repeated Focus Area: ${mostRepTopic}`, margin + 5, yPos + 24);
      yPos += 42;

      // Difficulty distribution
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text("DIFFICULTY LEVEL SPREAD", margin, yPos);
      yPos += 6;
      
      const diffDist = getDifficultyDistribution();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85);
      doc.text(`Easy questions proportion: ${diffDist.easy}%`, margin, yPos); yPos += 5;
      doc.text(`Medium questions proportion: ${diffDist.medium}%`, margin, yPos); yPos += 5;
      doc.text(`Hard questions proportion: ${diffDist.hard}%`, margin, yPos); yPos += 12;

      // Common Marks distribution
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text("COMMON MARKS WEIGHTS", margin, yPos);
      yPos += 8;

      const marksCount: Record<number, number> = {};
      result.questions.forEach(q => { marksCount[q.marks] = (marksCount[q.marks] || 0) + 1; });
      const sortedMarks = Object.entries(marksCount).sort((a,b) => b[1] - a[1]);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85);
      sortedMarks.slice(0, 3).map(([marks, count]) => {
        doc.text(`* ${marks} Marks: ${count} Questions`, margin + 4, yPos);
        yPos += 5;
      });
      yPos += 12;

      // Student Preparation Strategy Section
      if (yPos > pageHeight - 45) {
        doc.addPage();
        yPos = 30;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text("DIFFICULT SYLLABUS RECOMMENDATION", margin, yPos);
      yPos += 8;

      // High Priority
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(220, 38, 38);
      doc.text("HIGH PRIORITY FOCUS BLOCK (Red Zone - Must prepare)", margin, yPos);
      yPos += 6;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(71, 85, 105);
      const highSummaryLines = doc.splitTextToSize(`Direct core coverage onto standard topics like: ${getMostRepeatedTopics().slice(0, 2).map(t => t.topic).join(', ') || 'High repetition clusters'}. Thoroughly draft core solutions.`, contentWidth);
      doc.text(highSummaryLines, margin, yPos);
      yPos += (highSummaryLines.length * 5) + 8;

      // Medium Priority
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(37, 99, 235);
      doc.text("MEDIUM PRIORITY BLOCK (Blue Zone - Build Concepts)", margin, yPos);
      yPos += 6;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(71, 85, 105);
      const medSummaryLines = doc.splitTextToSize(`Draft solutions for intermediate repetitive concepts including: ${getMostRepeatedTopics().slice(2, 4).map(t => t.topic).join(', ') || 'Regular peripheral interfacing items'}.`, contentWidth);
      doc.text(medSummaryLines, margin, yPos);
      yPos += (medSummaryLines.length * 5) + 8;

      addPageDecoration(doc, `${result.subject} Analysis & Analytics`);

      const filename = `${result.subject.replace(/[^a-zA-Z0-9]/g, '_')}_AI_Report.pdf`;
      doc.save(filename);
    } catch (err) {
      console.error(err);
      setError("Failed to generate report. Please try again.");
    }
  };

  const downloadCompleteHandbook = async () => {
    if (!result) {
      setError("No analysis data available for download.");
      return;
    }

    setIsGeneratingHandbook(true);
    setHandbookProgress("Scanning Syllabus and mapping questions...");
    
    try {
      // 1. SELECT REPRESENTATIVE HIGH-YIELD QUESTIONS FOR EVERY SINGLE UNIT
      const units = Array.from(new Set(result.questions.map(q => q.unit || 'General')))
        .sort((a, b) => {
          const numA = parseInt(a.match(/\d+/)?.[0] || '0');
          const numB = parseInt(b.match(/\d+/)?.[0] || '0');
          return numA - numB || a.localeCompare(b);
        });

      const selectedQuestionsToAnswer: Question[] = [];
      units.forEach(unit => {
        const uQuestions = result.questions.filter(q => (q.unit || 'General') === unit);
        const sorted = [...uQuestions].sort((a,b) => b.repetitionCount - a.repetitionCount);
        const selected = sorted.slice(0, 2);
        selectedQuestionsToAnswer.push(...selected);
      });

      setHandbookTotal(selectedQuestionsToAnswer.length);
      setHandbookCurrent(0);

      // 2. FETCH OR GENERATE HIGH-QUALITY TOPPER ANSWERS SEQUENTIALLY
      const answeredQuestions: Question[] = [];
      for (let i = 0; i < selectedQuestionsToAnswer.length; i++) {
        const q = selectedQuestionsToAnswer[i];
        setHandbookCurrent(i + 1);
        setHandbookProgress(`Drafting premium visual notes for: "${q.text.slice(0, 45)}..."`);

        const cachedQ = result.questions.find(item => item.id === q.id);
        if (cachedQ && cachedQ.answer && cachedQ.answerSections) {
          answeredQuestions.push(cachedQ);
          continue;
        }

        const fullData = await generateFullAnswer(q.text, q.marks, result.subject);
        const updatedQ = { ...q, ...fullData };
        answeredQuestions.push(updatedQ);

        setResult(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            questions: prev.questions.map(item => item.id === q.id ? updatedQ : item)
          };
        });
      }

      setHandbookProgress("Assembling book layout and rendering Premium PDF...");

      // 3. COMPILE COMPLETE HANDBOOK PDF USING jspdf
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);

      // --- COVER PAGE ---
      doc.setFillColor(15, 23, 42); // slate-900 (Rich elegant dark layout)
      doc.rect(0, 0, pageWidth, pageHeight, 'F');

      doc.setFillColor(16, 185, 129); // emerald-500
      doc.rect(0, 0, pageWidth, 8, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(28);
      const subjectText = result.subject.toUpperCase();
      const subjectLines = doc.splitTextToSize(subjectText, contentWidth);
      doc.text(subjectLines, pageWidth / 2, pageHeight / 4, { align: 'center' });

      doc.setTextColor(16, 185, 129); // emerald-500
      doc.setFontSize(16);
      doc.text("COMPLETE EXAM PREPARATION HANDBOOK", pageWidth / 2, pageHeight / 4 + (subjectLines.length * 9) + 12, { align: 'center' });

      doc.setTextColor(148, 163, 184); // slate-400
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.text("High-Yield Questions with Comprehensive Model Solutions & Study Sheets", pageWidth / 2, pageHeight / 4 + (subjectLines.length * 9) + 22, { align: 'center' });

      if (result.institution) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.text(result.institution.toUpperCase(), pageWidth / 2, pageHeight / 4 + (subjectLines.length * 9) + 36, { align: 'center' });
      }

      doc.setFillColor(30, 41, 59); // slate-800
      doc.setDrawColor(51, 65, 85); // slate-700
      doc.setLineWidth(1);
      doc.rect(margin, pageHeight - 95, pageWidth - margin * 2, 55, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(16, 185, 129); // emerald-500
      doc.text("EXAM HANDBOOK METRICS", margin + 10, pageHeight - 85);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(241, 245, 249); // slate-100
      doc.text(`* Total Units covered: ${units.length} Academic Sections`, margin + 10, pageHeight - 74);
      doc.text(`* Premium solved handbuilt chapters: ${answeredQuestions.length} Master Answers`, margin + 10, pageHeight - 67);
      doc.text(`* Total unique exam questions categorized: ${result.questions.length} Questions`, margin + 10, pageHeight - 60);
      doc.text(`* Compilation Date: ${new Date().toLocaleDateString()} | Author: Exam Plus Auto-Compiler`, margin + 10, pageHeight - 53);

      // --- PAGE 2: TABLE OF CONTENTS ---
      doc.addPage();
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');

      let yPos = 30;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text("TABLE OF CONTENTS", margin, yPos);
      yPos += 6;
      doc.setDrawColor(16, 185, 129); // emerald-500
      doc.setLineWidth(1);
      doc.line(margin, yPos, margin + 40, yPos);
      yPos += 12;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);

      units.forEach(unit => {
        const uQuestions = result.questions.filter(q => (q.unit || 'General') === unit);
        if (yPos > pageHeight - 40) {
          doc.addPage();
          yPos = 30;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(16, 185, 129); // emerald-500
        doc.text(unit.toUpperCase(), margin, yPos);
        yPos += 8;

        const topics = Array.from(new Set(uQuestions.map(q => q.topic || 'General Topics')));
        topics.forEach(topic => {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.setTextColor(30, 41, 59); // slate-800
          doc.text(`   - Topic: ${cleanStringForPDF(topic)}`, margin, yPos);
          yPos += 6;

          const topicQList = uQuestions.filter(q => (q.topic || 'General Topics') === topic);
          topicQList.forEach(q => {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(100, 116, 139); // slate-500
            const isSolved = answeredQuestions.some(aq => aq.id === q.id);
            const statusText = isSolved ? "[Solved Model Solution]" : "[Syllabus Reference Bank]";
            const textLine = `       - Q. ${cleanStringForPDF(q.text.slice(0, 60))}... ${statusText}`;
            doc.text(textLine, margin, yPos);
            yPos += 5;
          });
        });

        yPos += 8;
      });

      // --- SUBSEQUENT PAGES: UNITS AND ANSWERS ---
      answeredQuestions.forEach((q, index) => {
        doc.addPage();
        yPos = 30;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(110, 120, 135);
        doc.text(`${(q.unit || 'Unit 1').toUpperCase()} | MODEL ANSWER STUDY GUIDE`, margin, yPos);
        yPos += 8;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(15, 23, 42); // slate-900
        const qLines = doc.splitTextToSize(`Q${index + 1}. ${cleanStringForPDF(q.text)} [${q.marks} Marks]`, contentWidth);
        doc.text(qLines, margin, yPos);
        yPos += (qLines.length * 6) + 6;

        doc.setDrawColor(241, 245, 249); // slate-100
        doc.setLineWidth(0.5);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 10;

        if (q.answerSections) {
          q.answerSections.forEach(sec => {
            const hasSectionName = sec.title && sec.content;
            if (!hasSectionName) return;

            // REMOVE COMPLETELY (Quick Revision, Viva Questions, Memory Tricks, etc.) inside the PDF
            const lowerTitle = sec.title.toLowerCase();
            if (
              lowerTitle.includes('revision') ||
              lowerTitle.includes('trick') ||
              lowerTitle.includes('mnemonic') ||
              lowerTitle.includes('viva') ||
              lowerTitle.includes('analytics') ||
              lowerTitle.includes('probability') ||
              lowerTitle.includes('score') ||
              lowerTitle.includes('years asked') ||
              lowerTitle.includes('frequency') ||
              lowerTitle.includes('statistics')
            ) {
              return; // Completely skipped inside PDF
            }

            if (yPos > pageHeight - 35) {
              doc.addPage();
              yPos = 30;
            }

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            if (sec.title.includes('Definition') || sec.title.includes('Introduction') || sec.title.includes('Overview')) {
              doc.setTextColor(5, 150, 105); // emerald-600
            } else if (sec.title.includes('Working')) {
              doc.setTextColor(217, 119, 6); // amber-600
            } else if (sec.title.includes('Diagram')) {
              doc.setTextColor(124, 58, 237); // purple-600
            } else if (sec.title.includes('Comparison')) {
              doc.setTextColor(37, 99, 235); // blue-600
            } else if (sec.title.includes('Applications')) {
              doc.setTextColor(13, 148, 136); // teal-600
            } else if (sec.title.includes('Conclusion')) {
              doc.setTextColor(8, 145, 178); // cyan-600
            } else {
              doc.setTextColor(12, 74, 110); // slate-800
            }

            doc.text(cleanStringForPDF(sec.title).toUpperCase(), margin, yPos);
            yPos += 6;

            if (sec.type === 'table') {
              const rows = sec.content.split('\n').filter(r => {
                const trimmed = r.trim();
                return trimmed && trimmed.includes('|') && !/^[|\s:-]+$/.test(trimmed);
              });

              if (rows.length > 0) {
                doc.setFontSize(9);
                doc.setTextColor(51, 65, 85);

                const colWidths = [45, 65, 65]; // structured column spacing
                rows.forEach(row => {
                  const columns = row.split('|').map(v => v.trim()).filter(Boolean);
                  if (columns.length > 0) {
                    const isHeader = row.includes('Parameter') || rows.indexOf(row) === 0;
                    doc.setFont('helvetica', isHeader ? 'bold' : 'normal');

                    const cellLines = columns.map((colText, colIdx) => {
                      const width = colWidths[Math.min(colIdx, colWidths.length - 1)];
                      return doc.splitTextToSize(colText, width - 4);
                    });

                    const maxLines = Math.max(...cellLines.map(lines => lines.length));
                    const rowHeight = maxLines * 5;

                    if (yPos + rowHeight > pageHeight - 20) {
                      doc.addPage();
                      yPos = 30;
                    }

                    let curX = margin + 4;
                    cellLines.forEach((lines, colIdx) => {
                      const width = colWidths[Math.min(colIdx, colWidths.length - 1)];
                      const cleanLines = lines.map(line => cleanStringForPDF(line));
                      doc.text(cleanLines, curX, yPos);
                      curX += width;
                    });

                    // Draw a subtle line underneath the row
                    doc.setDrawColor(241, 245, 249); // slate-100
                    doc.setLineWidth(0.2);
                    doc.line(margin, yPos + rowHeight + 1, pageWidth - margin, yPos + rowHeight + 1);

                    yPos += rowHeight + 4;
                  }
                });
                yPos += 4;
              }
            } else if (sec.type === 'diagram') {
              doc.setFont('courier', 'bold');
              doc.setFontSize(9);
              doc.setTextColor(30, 41, 59); // slate-800

              const diaRows = sec.content.split('\n').filter(r => r.trim());
              const blockHeight = diaRows.length * 4.5 + 8;

              if (yPos + blockHeight > pageHeight - 20) {
                doc.addPage();
                yPos = 30;
              }

              // Draw a premium light gray canvas frame for diagram
              doc.setFillColor(248, 250, 252); // slate-50
              doc.setDrawColor(226, 232, 240); // slate-200
              doc.setLineWidth(0.3);
              doc.rect(margin, yPos - 2, contentWidth, blockHeight, 'FD');

              let diaY = yPos + 3;
              diaRows.forEach(dRow => {
                doc.text(cleanStringForPDF(dRow), margin + 6, diaY);
                diaY += 4.5;
              });
              
              doc.setFont('helvetica', 'normal');
              yPos += blockHeight + 6;
            } else {
              const paragraphedText = sec.content.split('\n\n');
              paragraphedText.forEach(para => {
                const cleanPara = para.replace(/\*\*|__/g, '').trim();
                if (!cleanPara) return;

                // Check for structured point-by-point block layout (Meaning, Detailed Explanation, Importance, Example, etc.)
                const labelMatch = cleanPara.match(/^(Meaning|Detailed Explanation|Why Important|Importance|Example|Detailed Use|Benefits|Introduction|Concept Overview|Conclusion):/i);
                if (labelMatch) {
                  const label = labelMatch[1] + ":";
                  const restText = cleanPara.substring(label.length).trim();

                  if (yPos > pageHeight - 20) {
                    doc.addPage();
                    yPos = 30;
                  }

                  // Print label in bold dark charcoal
                  doc.setFont('helvetica', 'bold');
                  doc.setFontSize(10);
                  doc.setTextColor(15, 23, 42); // slate-900
                  doc.text(cleanStringForPDF(label), margin + 4, yPos);

                  // Calculate rest text spacing under label
                  doc.setFont('helvetica', 'normal');
                  doc.setTextColor(51, 65, 85);
                  
                  const restLines = doc.splitTextToSize(restText, contentWidth - 10);
                  let tempY = yPos + 5;
                  restLines.forEach(line => {
                    if (tempY > pageHeight - 20) {
                      doc.addPage();
                      tempY = 30;
                    }
                    doc.text(cleanStringForPDF(line), margin + 8, tempY);
                    tempY += 5;
                  });
                  yPos = tempY + 1;
                } else {
                  // Standard paragraph
                  doc.setFont('helvetica', 'normal');
                  doc.setFontSize(10);
                  doc.setTextColor(51, 65, 85);

                  const lines = doc.splitTextToSize(cleanPara, contentWidth - 6);
                  lines.forEach(line => {
                    if (yPos > pageHeight - 20) {
                      doc.addPage();
                      yPos = 30;
                    }
                    doc.text(cleanStringForPDF(line), margin + 4, yPos);
                    yPos += 5;
                  });
                  yPos += 3;
                }
              });
              yPos += 4;
            }
          });
        }
      });

      addPageDecoration(doc, `${result.subject} Solved Study Handbook`);

      const filename = `${result.subject.replace(/[^a-zA-Z0-9]/g, '_')}_Complete_Exam_Handbook.pdf`;
      doc.save(filename);
    } catch (err) {
      console.error(err);
      setError("Failed to compile study handbook. Please check your API usage and connection.");
    } finally {
      setIsGeneratingHandbook(false);
    }
  };

  const downloadAllZIP = () => {
    if (!result) {
      setError("No analysis data available for download.");
      return;
    }
    try {
      downloadQuestionBank();
      setTimeout(() => downloadRepeatedQuestions(), 400);
      setTimeout(() => downloadPredictedQuestions(), 850);
      setTimeout(() => downloadAIReport(), 1300);
    } catch (err) {
      console.error(err);
      setError("Failed to trigger sequential downloads.");
    }
  };

  const downloadPDF = () => {
    if (viewMode === 'bank') {
      downloadQuestionBank();
    } else if (viewMode === 'repeated') {
      downloadRepeatedQuestions();
    } else if (viewMode === 'predictions') {
      downloadPredictedQuestions();
    } else {
      downloadAIReport();
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <div className="w-24 h-24 bg-white rounded-[40px] flex items-center justify-center shadow-2xl shadow-emerald-200/50 border border-black/5 p-4">
            <img 
              src="/logo.png" 
              alt="Exam Plus Logo" 
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.src = 'https://api.dicebear.com/7.x/initials/svg?seed=EP&backgroundColor=059669';
              }}
            />
          </div>
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
            <p className="text-black/40 font-black uppercase tracking-widest text-[10px] animate-pulse">Initializing Exam Plus...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1E293B] font-sans selection:bg-emerald-100 relative overflow-hidden">
      {/* Premium elegant ambient background glow layout */}
      <div className="absolute top-0 inset-x-0 h-[800px] bg-gradient-to-b from-[#ECFDF5]/15 via-[#F8FAFC]/55 to-[#F8FAFC] pointer-events-none -z-10" />
      <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[40%] bg-emerald-50/10 rounded-full blur-[130px] pointer-events-none -z-10 animate-pulse [animation-duration:8s]" />
      <div className="absolute top-[20%] right-[-10%] w-[45%] h-[40%] bg-blue-50/10 rounded-full blur-[130px] pointer-events-none -z-10 animate-pulse [animation-duration:11s]" />
      <div className="absolute bottom-[10%] left-[-5%] w-[40%] h-[35%] bg-teal-50/8 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* Header */}
      <header className="border-b border-slate-800/10 bg-gradient-to-r from-[#0F172A] to-[#1E293B] sticky top-0 z-50 shadow-sm text-white font-sans">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center shadow-md border border-white/10 p-1.5 overflow-hidden">
              <img 
                src="/logo.png" 
                alt="Exam Plus" 
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.src = 'https://api.dicebear.com/7.x/initials/svg?seed=EP&backgroundColor=10B981';
                }}
              />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-black tracking-tight text-white leading-none flex items-center gap-1.5 font-heading">
                EXAM PLUS
                <span className="inline-flex items-center px-1.5 py-0.5 bg-emerald-500/15 border border-emerald-500/30 text-[#10B981] text-[8px] font-black uppercase tracking-widest rounded select-none">
                  PREMIUM
                </span>
              </span>
              <span className="text-[9px] text-slate-300 font-bold uppercase tracking-widest mt-0.5 hidden sm:inline-block">PYQ Compiler & Predictor</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {result && (
              <button 
                onClick={reset}
                className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-emerald-500/15 text-[#10B981] bg-emerald-500/5 border border-emerald-500/20 rounded-xl text-xs font-black uppercase tracking-wider transition-all select-none shadow-sm shadow-emerald-950/20"
              >
                <Plus size={14} />
                <span className="hidden sm:inline">New Analysis</span>
                <span className="sm:hidden">Reset</span>
              </button>
            )}
            {user ? (
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setShowHistory(!showHistory)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border border-transparent select-none",
                    showHistory 
                      ? "bg-[#10B981] text-white shadow-md shadow-emerald-500/20" 
                      : "text-slate-200 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <RefreshCw size={14} className={isLoadingHistory ? "animate-spin" : ""} />
                  History
                </button>
                <div className="flex items-center gap-2 pl-3 border-l border-white/10">
                  <div className="text-right hidden md:block">
                    <p className="text-xs font-black text-white leading-none">{user.displayName}</p>
                    <p className="text-[9px] text-slate-300 font-mono tracking-tighter mt-0.5">{user.email}</p>
                  </div>
                  <div className="w-8 h-8 rounded-xl overflow-hidden bg-slate-800 border border-white/10 flex items-center justify-center shrink-0">
                    {user.photoURL ? (
                      <img 
                        src={user.photoURL} 
                        alt={user.displayName || "Avatar"} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="text-xs font-black text-white uppercase font-heading">
                        {user.displayName?.charAt(0) || "U"}
                      </span>
                    )}
                  </div>
                  <button 
                    onClick={logout}
                    title="Sign Out"
                    className="w-8 h-8 rounded-xl bg-white/5 hover:bg-rose-550/20 hover:text-rose-400 text-slate-300 transition-all shrink-0 flex items-center justify-center border border-white/5 hover:border-rose-500/20"
                  >
                    <LogOut size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <button 
                onClick={signInWithGoogle}
                className="flex items-center gap-2 px-4 py-2 bg-[#10B981] text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-[#059669] transition-all shadow-md shadow-emerald-950/20"
              >
                <GraduationCap size={14} />
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        {/* Diagram Zoom Modal */}
        <AnimatePresence>
          {zoomedDiagram && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 lg:p-12"
              onClick={() => setZoomedDiagram(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-[40px] p-8 lg:p-12 w-full max-w-6xl max-h-[90vh] overflow-auto relative shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <button 
                  onClick={() => setZoomedDiagram(null)}
                  className="absolute top-6 right-6 w-12 h-12 bg-black/5 hover:bg-black/10 rounded-2xl flex items-center justify-center transition-all"
                >
                  <X size={24} />
                </button>
                <div className="mb-8">
                  <h3 className="text-2xl font-bold text-slate-900">Diagram View</h3>
                  <p className="text-slate-500 font-medium">Detailed visual representation of the concept</p>
                </div>
                <div className="flex items-center justify-center min-h-[400px] bg-slate-50 rounded-[32px] p-8 overflow-auto border border-black/5">
                  <pre className="font-mono text-sm leading-relaxed text-slate-800">
                    {zoomedDiagram}
                  </pre>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Analysis Loading Overlay with Ads Placeholder */}
        <AnimatePresence>
          {isAnalyzing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[110] bg-white flex flex-col items-center justify-center p-6 text-center"
            >
              <div className="max-w-md w-full space-y-12">
                <div className="space-y-6">
                  <div className="relative w-24 h-24 mx-auto">
                    <div className="absolute inset-0 border-4 border-emerald-100 rounded-full" />
                    <div className="absolute inset-0 border-4 border-emerald-600 rounded-full border-t-transparent animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center text-emerald-600">
                      <RefreshCw size={32} className="animate-pulse" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold text-slate-900">Analyzing Your Papers</h3>
                    <p className="text-slate-500 font-medium">This usually takes 10-20 seconds. Please stay on this page.</p>
                  </div>
                </div>

                <div className="pt-12">
                  <div className="flex items-center justify-center gap-2 text-emerald-600 font-bold text-sm">
                    <ShieldCheck size={18} />
                    <span>Secure Processing</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {!user ? (
            <motion.div
              key="auth-landing"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="max-w-5xl mx-auto space-y-12 py-4"
            >
              {/* Premium Heading Header */}
              <div className="text-center space-y-4 max-w-3xl mx-auto">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 text-[10px] font-black uppercase tracking-widest rounded-full select-none animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block" />
                  PREMIUM COGNITIVE ENGINE V2.4
                </span>
                <h1 className="text-4xl md:text-5xl lg:text-[54px] font-black tracking-tight text-slate-950 leading-[1.1]">
                  ACCELERATE YOUR <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 bg-clip-text text-transparent">EXAM PREPARATION</span>
                </h1>
                <p className="text-md md:text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed font-medium">
                  Upload previous papers to unlock deep repetition modeling, custom AI study logs, and interactive probability weights.
                </p>
              </div>

              {/* Grid Layout: Visual Dashboard Sandbox & Interactive Form Card */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch pt-4">
                
                {/* Left Side: Mock Live Predictor Sandbox */}
                <div className="lg:col-span-7 flex flex-col justify-between bg-white border border-slate-200/50 rounded-[32px] p-8 space-y-8 shadow-xs relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-slate-500/5 rounded-full blur-2xl pointer-events-none" />
                  
                  <div className="space-y-4 relative z-10">
                    <div className="flex items-center justify-between border-b border-black/[0.04] pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 border border-slate-200/50">
                          <TrendingUp size={20} />
                        </div>
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block leading-none">PREDICTIVE MODELLING</span>
                          <span className="text-sm font-black text-slate-900">Cognitive Probability View</span>
                        </div>
                      </div>
                      <span className="px-2.5 py-0.5 bg-emerald-50 text-[10px] font-bold text-emerald-700 tracking-wider rounded-lg border border-emerald-100 uppercase">
                        AI Verified
                      </span>
                    </div>

                    {/* Interactive mock lists representing what the app provides */}
                    <div className="space-y-4">
                      {/* Concept 1 */}
                      <div className="bg-slate-50/80 backdrop-blur-sm border border-slate-200/40 rounded-2xl p-4 flex items-center justify-between shadow-xs">
                        <div className="space-y-1">
                          <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 bg-rose-50 border border-rose-100 text-rose-700 rounded mr-2 inline-block">UNIT 2</span>
                          <span className="text-xs font-bold text-slate-800">Dynamic Programming & Graph Theory</span>
                          <p className="text-[10px] text-slate-500 mt-1 pl-1">Identified in Winter 2024, Summer 2025 (Repeated 4x)</p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-black text-rose-600 block">94% PROBABILITY</span>
                          <span className="text-[9.5px] text-slate-400 font-medium">Critical Priority</span>
                        </div>
                      </div>

                      {/* Concept 2 */}
                      <div className="bg-slate-50/80 backdrop-blur-sm border border-slate-200/40 rounded-2xl p-4 flex items-center justify-between shadow-xs">
                        <div className="space-y-1">
                          <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded mr-2 inline-block">UNIT 4</span>
                          <span className="text-xs font-bold text-slate-800">Normalization & B-Tree Indirection</span>
                          <p className="text-[10px] text-slate-500 mt-1 pl-1">Identified in Summer 2023, Summer 2025 (Repeated 2x)</p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-black text-indigo-600 block">76% PROBABILITY</span>
                          <span className="text-[9.5px] text-slate-400 font-medium">Frequent Topic</span>
                        </div>
                      </div>

                      {/* Concept 3 */}
                      <div className="bg-slate-50/80 backdrop-blur-sm border border-slate-200/40 rounded-2xl p-4 flex items-center justify-between shadow-xs">
                        <div className="space-y-1">
                          <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded mr-2 inline-block">UNIT 1</span>
                          <span className="text-xs font-bold text-slate-800">Asymptotic Complexity (Big-O analysis)</span>
                          <p className="text-[10px] text-slate-500 mt-1 pl-1">Extracted from Syllabus & Semester Papers</p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-black text-emerald-600 block">62% PROBABILITY</span>
                          <span className="text-[9.5px] text-slate-400 font-medium">High Occurrence</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Highlights section inside uploader */}
                  <div className="grid grid-cols-3 gap-4 border-t border-black/[0.04] pt-6 text-center">
                    <div>
                      <span className="text-xl font-black text-slate-900 block font-mono">100%</span>
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mt-1">Automatic Extraction</span>
                    </div>
                    <div>
                      <span className="text-xl font-black text-slate-900 block font-mono">2-Click</span>
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mt-1">Study Companion</span>
                    </div>
                    <div>
                      <span className="text-xl font-black text-emerald-600 block font-mono">Immediate</span>
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mt-1">Revision Schedule</span>
                    </div>
                  </div>
                </div>

                {/* Right Side: Double-Layer Glass Auth panel */}
                <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-[32px] p-8 shadow-sm flex flex-col justify-between space-y-8 relative overflow-hidden">
                  <div className="absolute top-0 left-0 h-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 w-full" />
                  
                  <div className="space-y-6">
                    {/* Toggle controls */}
                    <div className="flex border border-slate-200/50 p-1 bg-slate-50 rounded-2xl">
                      <button
                        onClick={() => setAuthWithState('login')}
                        className={cn(
                          "flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all select-none",
                          authWithState === 'login'
                            ? "bg-white text-slate-900 shadow-sm border border-slate-100"
                            : "text-slate-400 hover:text-slate-800"
                        )}
                      >
                        Log In
                      </button>
                      <button
                        onClick={() => setAuthWithState('signup')}
                        className={cn(
                          "flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all select-none",
                          authWithState === 'signup'
                            ? "bg-white text-slate-900 shadow-sm border border-slate-100"
                            : "text-slate-400 hover:text-slate-800"
                        )}
                      >
                        Sign Up
                      </button>
                    </div>

                    <AnimatePresence mode="wait">
                      {authWithState === 'login' ? (
                        <motion.div
                          key="login-content"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          transition={{ duration: 0.15 }}
                          className="space-y-6"
                        >
                          <div className="space-y-2">
                            <h3 className="text-xl font-black text-slate-900 tracking-tight leading-tight">Welcome Back Scholar!</h3>
                            <p className="text-xs text-slate-500 leading-relaxed font-medium">Access your previously saved course workspaces, study logs, and dynamic question banks from anywhere.</p>
                          </div>

                          <button
                            onClick={signInWithGoogle}
                            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-md shadow-emerald-200/50 hover:shadow-lg hover:shadow-emerald-300/60 flex items-center justify-center gap-3 active:scale-98 cursor-pointer"
                          >
                            <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                              <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114a5.617 5.617 0 0 1-5.618-5.618 5.617 5.617 0 0 1 5.618-5.617c1.393 0 2.66.49 3.655 1.442l3.12-3.12C18.847 3.5 15.8 2 12.24 2 6.58 2 2 6.58 2 12.24s4.58 10.24 10.24 10.24c5.795 0 10.24-4.11 10.24-10.24 0-.585-.05-1.17-.154-1.74H12.24z"/>
                            </svg>
                            Connect with Google
                          </button>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="signup-content"
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          transition={{ duration: 0.15 }}
                          className="space-y-6"
                        >
                          <div className="space-y-2">
                            <h3 className="text-xl font-black text-slate-900 tracking-tight leading-tight">Create Academic Workspace</h3>
                            <p className="text-xs text-slate-500 leading-relaxed font-medium">Automatic cloud storage activation. Sign up is instantaneous using Google authentication wrapper.</p>
                          </div>

                          <ul className="space-y-2 text-xs text-slate-500 font-semibold border-t border-slate-100 pt-4">
                            <li className="flex items-center gap-2">
                              <CheckCircle2 size={13} className="text-emerald-600" />
                              Zero passwords required
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle2 size={13} className="text-emerald-600" />
                              Synced library dashboard
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle2 size={13} className="text-emerald-600" />
                              Personal AI Revision Planner
                            </li>
                          </ul>

                          <button
                            onClick={signInWithGoogle}
                            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-md shadow-emerald-200/50 hover:shadow-lg hover:shadow-emerald-300/60 flex items-center justify-center gap-3 active:scale-98 cursor-pointer"
                          >
                            <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                              <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114a5.617 5.617 0 0 1-5.618-5.618 5.617 5.617 0 0 1 5.618-5.617c1.393 0 2.66.49 3.655 1.442l3.12-3.12C18.847 3.5 15.8 2 12.24 2 6.58 2 2 6.58 2 12.24s4.58 10.24 10.24 10.24c5.795 0 10.24-4.11 10.24-10.24 0-.585-.05-1.17-.154-1.74H12.24z"/>
                            </svg>
                            Instant Sign Up
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="text-center font-bold text-[10px] text-slate-400 uppercase tracking-widest border-t border-slate-100 pt-4 leading-none">
                    Security wrapper powered by Google Auth
                  </div>
                </div>
              </div>
            </motion.div>
          ) : showHistory ? (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-black tracking-tight">Your Analysis History</h2>
                  <p className="text-black/40 mt-1">Access your previously analyzed subjects and question banks.</p>
                </div>
                <button 
                  onClick={() => setShowHistory(false)}
                  className="px-6 py-2 bg-black text-white rounded-xl text-sm font-bold hover:bg-black/80 transition-all"
                >
                  Back ←
                </button>
              </div>

              {isLoadingHistory ? (
                <div className="py-20 flex flex-col items-center justify-center gap-4">
                  <Loader2 className="w-12 h-12 text-emerald-600 animate-spin" />
                  <p className="text-black/40 font-bold animate-pulse">Loading your history...</p>
                </div>
              ) : history.length > 0 ? (
                <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {history.map((h) => (
                    <div 
                      key={h.id}
                      onClick={() => {
                        setResult(h);
                        setShowHistory(false);
                      }}
                      className="bg-white p-6 rounded-[28px] border border-slate-100 hover:border-emerald-500/40 hover:shadow-xl shadow-xs transition-style group flex flex-col justify-between h-[210px] cursor-pointer relative overflow-hidden text-left"
                    >
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                            <BookOpen size={20} />
                          </div>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteAnalysis(h.id);
                            }}
                            className="p-1.5 hover:bg-rose-50 hover:text-rose-600 rounded-lg text-slate-300 transition-colors cursor-pointer"
                            title="Delete workspace"
                          >
                            <X size={15} />
                          </button>
                        </div>
                        
                        <div className="space-y-1">
                          <h3 className="text-[14.5px] font-extrabold text-slate-900 group-hover:text-emerald-700 transition-colors line-clamp-1 leading-tight" title={h.subject}>{h.subject}</h3>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest truncate mt-1" title={h.institution || "Self Preparation"}>
                            {h.institution || "Self Preparation"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-slate-100 bg-white leading-none shrink-0">
                        <span className="text-xs text-slate-500 font-bold">{h.questions ? h.questions.length : 0} compiled PYQs</span>
                        <span className="text-xs font-black uppercase tracking-wider text-emerald-600 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                          Open Workspace →
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-20 text-center space-y-4">
                  <div className="w-20 h-20 bg-black/5 rounded-full flex items-center justify-center mx-auto text-black/20">
                    <RefreshCw size={40} />
                  </div>
                  <p className="text-slate-600 font-bold">No history found. Start analyzing papers to build your library!</p>
                </div>
              )}
            </motion.div>
          ) : selectedQuestion ? (
              <motion.div 
                key="detail"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -30 }}
                transition={{ 
                  type: "spring",
                  stiffness: 300,
                  damping: 30
                }}
                className="space-y-8"
              >
              {/* Question Header */}
            <div className="bg-white rounded-[40px] p-10 border border-black/5 shadow-sm space-y-6">
              <div className="flex items-center gap-3">
                <span className="px-4 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-black uppercase tracking-widest">
                  {selectedQuestion.marks} Marks
                </span>
                {'unit' in selectedQuestion && selectedQuestion.unit && (
                  <span className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">
                    {selectedQuestion.unit}
                  </span>
                )}
                {'paperName' in selectedQuestion && selectedQuestion.paperName && (
                  <span className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">
                    {selectedQuestion.paperName}
                  </span>
                )}
                {'repetitionCount' in selectedQuestion && selectedQuestion.repetitionCount > 1 && (
                  <span className="px-4 py-1.5 bg-amber-100 text-amber-700 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-2">
                    <ArrowRightLeft size={12} />
                    Repeated {selectedQuestion.repetitionCount}x
                  </span>
                )}
              </div>
              <h3 className="text-4xl font-bold leading-tight text-slate-900">
                {selectedQuestion.text}
              </h3>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Main Answer Content */}
              <div className="lg:col-span-2 space-y-8">
                <div className="space-y-6">
                  {/* Action Buttons */}
                  <div className="flex items-center justify-end gap-2 px-4">
                    <button
                      onClick={handleShort}
                      disabled={isGeneratingShort || isGeneratingAnswer}
                      className={cn(
                        "flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold transition-all",
                        showShort 
                          ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200" 
                          : "bg-white border border-black/5 text-emerald-700 hover:bg-emerald-50",
                        (isGeneratingShort || isGeneratingAnswer) && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {isGeneratingShort ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : (
                        <List size={14} />
                      )}
                      {isGeneratingShort ? 'Generating...' : showShort ? 'Show Original' : 'Short Answer'}
                    </button>
                    <button
                      onClick={handleSimplify}
                      disabled={isSimplifying || isGeneratingAnswer}
                      className={cn(
                        "flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold transition-all",
                        showSimplified 
                          ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200" 
                          : "bg-white border border-black/5 text-emerald-700 hover:bg-emerald-50",
                        (isSimplifying || isGeneratingAnswer) && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {isSimplifying ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : (
                        <Sparkles size={14} />
                      )}
                      {isSimplifying ? 'Simplifying...' : showSimplified ? 'Show Original' : 'Simplify Language'}
                    </button>
                  </div>

                  {/* Single-Page Structured Answer */}
                  {(showShort || showSimplified) ? (
                    <div className="bg-white rounded-[40px] p-10 border border-black/5 shadow-sm">
                      <AnswerRenderer answer={showShort ? shortAnswer! : simplifiedAnswer!} />
                    </div>
                  ) : (
                    <div className="bg-white rounded-[40px] p-10 border border-black/5 shadow-sm space-y-8">
                      <AnswerRenderer 
                        answer={selectedQuestion.answer || ''} 
                        sections={selectedQuestion.answerSections} 
                      />

                      {/* Linked Questions Section */}
                      {selectedQuestion.linkedQuestionIds && selectedQuestion.linkedQuestionIds.length > 0 && (
                        <div className="pt-10 border-t border-black/5">
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                            <ArrowRightLeft size={14} />
                            Rephrased Versions
                          </h4>
                          <div className="space-y-3">
                            {selectedQuestion.linkedQuestionIds.map((linkedId) => {
                              const linkedQ = result?.questions.find(q => q.id === linkedId);
                              if (!linkedQ) return null;
                              return (
                                <div 
                                  key={linkedId}
                                  onClick={() => setSelectedQuestion(linkedQ)}
                                  className="p-4 bg-amber-50/50 border border-amber-100 rounded-2xl cursor-pointer hover:bg-amber-50 transition-all group"
                                >
                                  <div className="flex items-center justify-between gap-4">
                                    <p className="text-sm font-medium text-amber-900 line-clamp-2">
                                      {linkedQ.text}
                                    </p>
                                    <ArrowRight size={16} className="text-amber-400 group-hover:translate-x-1 transition-transform shrink-0" />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Marks Distribution Section */}
                      {selectedQuestion.marksDistribution && selectedQuestion.marksDistribution.length > 0 && (
                        <div className="pt-10 border-t border-black/5">
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                            <Target size={14} />
                            Marks Distribution
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {selectedQuestion.marksDistribution.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between p-4 bg-[#F5F5F0] rounded-2xl">
                                <span className="text-xs font-bold text-slate-600">{item.point}</span>
                                <span className="font-black text-emerald-700 text-sm">+{item.marks}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Sidebar: Chat */}
              <div className="space-y-8">
                <section className="bg-white rounded-[40px] p-10 border border-black/5 shadow-xl shadow-black/5 flex flex-col h-[650px] relative group overflow-hidden">
                  {/* Subtle background patterns */}
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500" />
                  
                  <div className="flex items-center justify-between mb-8 shrink-0">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center border border-black/5 shadow-sm p-2">
                          <img 
                            src="/logo.png" 
                            alt="Exam Plus Assistant" 
                            className="w-full h-full object-contain"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              e.currentTarget.src = 'https://api.dicebear.com/7.x/initials/svg?seed=EP&backgroundColor=059669';
                            }}
                          />
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white" />
                      </div>
                      <div>
                        <h4 className="text-lg font-black text-slate-900 tracking-tight">Exam Plus Assistant</h4>
                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Ready to help
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto space-y-6 mb-8 pr-2 custom-scrollbar">
                    {chatMessages.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-full text-center space-y-6 px-4">
                        <div className="w-20 h-20 bg-slate-50 rounded-[32px] flex items-center justify-center text-slate-300 border border-dashed border-slate-200">
                          <MessageSquare size={32} />
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-black text-slate-900 uppercase tracking-widest">Ask me anything!</p>
                          <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-[200px] mx-auto">
                            I can explain complex parts of this answer, give you more examples, or help you memorize.
                          </p>
                        </div>
                        <div className="flex flex-wrap justify-center gap-2">
                          {['Explain simply', 'Give example', 'Key points'].map((hint) => (
                            <button
                              key={hint}
                              onClick={() => {
                                setUserInput(hint);
                                // Trigger send automatically? Maybe not, just fill it.
                              }}
                              className="px-3 py-1.5 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-600 rounded-full text-[10px] font-bold text-slate-500 border border-slate-100 transition-all"
                            >
                              {hint}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {chatMessages.map((msg, idx) => (
                      <div 
                        key={idx} 
                        className={cn(
                          "flex flex-col w-full",
                          msg.role === 'user' ? "items-end" : "items-start"
                        )}
                      >
                        <div className={cn(
                          "max-w-[85%] p-5 rounded-[28px] text-sm leading-relaxed transition-all shadow-sm",
                          msg.role === 'user' 
                            ? "bg-emerald-600 text-white rounded-tr-none" 
                            : "bg-slate-50 text-slate-800 rounded-tl-none border border-slate-100"
                        )}>
                          {msg.role === 'model' ? (
                            <div className="prose prose-sm prose-slate max-w-none whitespace-pre-wrap">
                              {msg.text}
                            </div>
                          ) : (
                            <div className="whitespace-pre-wrap font-medium">{msg.text}</div>
                          )}
                        </div>
                        <span className="text-[9px] font-black text-slate-300 mt-2 uppercase tracking-widest px-4">
                          {msg.role === 'user' ? 'You' : 'Exam Plus Assistant'}
                        </span>
                      </div>
                    ))}
                    {isChatting && (
                      <div className="flex items-center gap-3 bg-emerald-50/50 p-4 rounded-[24px] border border-emerald-100 w-fit animate-pulse">
                        <div className="flex gap-1.5">
                          <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
                          <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
                          <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce" />
                        </div>
                        <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Analyzing...</span>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  <form onSubmit={handleSendMessage} className="mt-auto">
                    <div className="relative group/input">
                      <input
                        type="text"
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        placeholder="Ask a follow-up question..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-[28px] pl-6 pr-16 py-5 text-sm outline-none focus:ring-4 focus:ring-emerald-600/5 focus:border-emerald-600/30 focus:bg-white transition-all font-medium"
                      />
                      <button
                        type="submit"
                        disabled={!userInput.trim() || isChatting}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 w-11 h-11 bg-emerald-600 text-white rounded-[20px] flex items-center justify-center hover:bg-emerald-700 transition-all disabled:opacity-50 shadow-lg shadow-emerald-200 group-hover/input:scale-105"
                      >
                        <Send size={20} />
                      </button>
                    </div>
                  </form>
                </section>
              </div>
            </div>

            {/* Footer Back Button */}
            <div className="flex justify-center pt-8 pb-12">
              <button 
                onClick={handleCloseModal}
                className="flex items-center gap-3 px-8 py-4 bg-white border border-black/5 rounded-[30px] text-emerald-700 font-black uppercase tracking-widest hover:bg-emerald-50 transition-all shadow-sm group"
              >
                <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                Back ←
              </button>
            </div>
          </motion.div>
        ) : !result ? (
          <motion.div 
            key="upload"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="max-w-6xl mx-auto space-y-12"
          >
            {/* Elegant Partition Layout on Laptop */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Left Column: Core File Uploader Setup (lg:col-span-5) */}
              <div className="lg:col-span-5 bg-white border border-slate-200/65 rounded-[32px] p-6 sm:p-8 shadow-md shadow-slate-100/40 relative overflow-hidden space-y-6 text-left">
                <div className="absolute top-0 left-0 h-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 w-full" />
                
                <div className="space-y-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-widest rounded-full select-none animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block" />
                    PAPER ANALYZER MODULE
                  </span>
                  <h2 className="text-2xl font-black tracking-tight text-slate-900 leading-tight">
                    Analyze Exam Papers
                  </h2>
                  <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                    Supply your previous college or board questions (PDF, JPG, or PNG files) so our AI can extract topics, isolate repetitions, and predict future trends.
                  </p>
                </div>

                {/* Dropzone Container */}
                <div 
                  {...getRootProps()} 
                  className={cn(
                    "border-2 border-dashed rounded-2xl p-8 transition-all cursor-pointer flex flex-col items-center justify-center gap-4 relative overflow-hidden group select-none",
                    isDragActive 
                      ? "border-emerald-600 bg-emerald-500/[0.04] shadow-inner" 
                      : "border-slate-200 hover:border-slate-400 bg-slate-50/50 hover:bg-white shadow-xs hover:shadow-md hover:shadow-slate-100/50 animate-fade-in"
                  )}
                >
                  <input {...getInputProps()} />
                  <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                    <Upload size={22} />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-xs font-black text-slate-900">Click or Drag Exam Files Here</p>
                    <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">PDF, JPEG, PNG (Upload 2 or more files)</p>
                  </div>
                </div>

                {/* Selected Papers Stack */}
                <AnimatePresence>
                  {files.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-4 pt-3 border-t border-slate-100"
                    >
                      <div className="space-y-2">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Selected Question Papers</h3>
                        
                        <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
                          {files.map((file) => (
                            <div key={file.id} className="bg-slate-50/70 rounded-xl p-3 flex items-center justify-between border border-slate-100 shadow-xs hover:border-slate-200 transition-colors">
                              <div className="flex items-center gap-2.5 truncate max-w-[85%]">
                                <div className="w-8 h-8 bg-emerald-50 text-emerald-700 rounded-lg flex items-center justify-center shrink-0">
                                  <FileText size={16} />
                                </div>
                                <div className="truncate">
                                  <p className="font-bold text-xs text-slate-800 truncate" title={file.file.name}>{file.file.name}</p>
                                  <p className="text-[9px] text-slate-400 font-semibold mt-0.5">{(file.file.size / 1024 / 1024).toFixed(2)} MB</p>
                                </div>
                              </div>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeFile(file.id);
                                }}
                                className="p-1.5 hover:bg-rose-50 hover:text-rose-600 rounded-lg text-slate-400 transition-all cursor-pointer shrink-0"
                              >
                                <X size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Optional Context Level Hint */}
                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Context Level (Optional)</h3>
                        <div className="relative group/input">
                          <input
                            type="text"
                            value={contextHint}
                            onChange={(e) => setContextHint(e.target.value)}
                            placeholder="e.g. 3rd Year Computer Science, University of Mumbai..."
                            className="w-full bg-slate-50/30 border border-slate-200 rounded-xl pl-4 pr-11 py-3 text-xs font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-600/30 focus:bg-white transition-all shadow-xs"
                          />
                          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within/input:text-emerald-600 transition-colors pointer-events-none">
                            <Info size={14} />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {error && (
                  <div className="bg-rose-50/50 border border-rose-100 text-rose-800 p-4 rounded-xl flex flex-col gap-2 text-left">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />
                      <p className="text-xs font-semibold leading-relaxed">{error}</p>
                    </div>
                    {(error.includes("quota") || error.includes("API key")) && (
                      <button
                        onClick={handleOpenKeyDialog}
                        className="text-[9px] font-black uppercase tracking-wider bg-white border border-rose-200 text-rose-700 px-3 py-2 rounded-lg hover:bg-rose-50 transition-colors w-fit flex items-center gap-1.5"
                      >
                        <ShieldCheck size={11} />
                        Personal API Key
                      </button>
                    )}
                  </div>
                )}

                {/* Huge dynamic CTA button */}
                <button
                  disabled={files.length < 2 || isAnalyzing}
                  onClick={handleAnalyze}
                  className={cn(
                    "w-full py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] transition-all flex items-center justify-center gap-2 cursor-pointer",
                    files.length >= 2 && !isAnalyzing 
                      ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-200/50 hover:shadow-emerald-300/60 active:scale-98" 
                      : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200/50"
                  )}
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="animate-spin text-white mb-0.5" size={14} />
                      Performing Core Extraction...
                    </>
                  ) : (
                    "Analyze Question Papers"
                  )}
                </button>
              </div>

              {/* Right Column: Past Libraries (lg:col-span-7) */}
              <div className="lg:col-span-7 space-y-6 text-left">
                {history.length > 0 ? (
                  <div className="space-y-6">
                    {/* Header + Premium Search Input Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/40 backdrop-blur-md p-5 rounded-[24px] border border-slate-200/20 shadow-xs">
                      <div>
                        <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                          <BookOpen size={16} className="text-slate-400 border-none inline-block leading-none" />
                          YOUR STUDY ARCHIVES LIBRARY
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5 font-medium leading-normal">Quickly resume any past analyses, revision lists, or plans.</p>
                      </div>
                      
                      {/* Premium Search Filter to scale nicely with multiple elements */}
                      <div className="relative group/search max-w-xs w-full sm:w-[180px] md:w-[220px]">
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search workspaces..."
                          className="w-full bg-white border border-slate-200 rounded-xl pl-3 pr-8 py-2 text-xs font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-600/30 transition-all shadow-xs"
                        />
                        {searchQuery ? (
                          <button 
                            onClick={() => setSearchQuery("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            <X size={12} />
                          </button>
                        ) : (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within/search:text-emerald-600 transition-colors pointer-events-none">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Workspaces Grid list - perfectly sizing on desktop & laptop */}
                    {(() => {
                      const filteredHistory = history.filter(h => 
                        h.subject.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        (h.institution || "").toLowerCase().includes(searchQuery.toLowerCase())
                      );

                      if (filteredHistory.length === 0) {
                        return (
                          <div className="bg-white rounded-[32px] p-12 text-center border border-slate-200 shadow-xs space-y-4">
                            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 border border-dashed border-slate-200 mx-auto">
                              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs font-bold text-slate-900 uppercase tracking-widest">No Workspaces Found</p>
                              <p className="text-[11px] text-slate-400 font-medium">No results match your search term "{searchQuery}".</p>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div className="grid gap-4 sm:grid-cols-2">
                          {filteredHistory.slice(0, 6).map((h) => (
                            <div 
                              key={h.id}
                              onClick={() => setResult(h)}
                              className="bg-white p-5 rounded-[24px] border border-slate-100 hover:border-emerald-500/40 hover:shadow-lg shadow-sm hover:shadow-emerald-500/[0.02] transition-all cursor-pointer group flex flex-col justify-between h-[180px] relative overflow-hidden text-left"
                            >
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5 text-emerald-600 leading-none">
                                    <BookOpen size={14} className="shrink-0" />
                                    <span className="text-[9px] font-black uppercase tracking-widest leading-none">SAVED WORKSPACE</span>
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteAnalysis(h.id);
                                    }}
                                    className="p-1 hover:bg-rose-50 hover:text-rose-600 rounded-lg text-slate-300 hover:animate-pulse transition-all cursor-pointer z-20 shrink-0"
                                    title="Delete workspace"
                                  >
                                    <X size={13} />
                                  </button>
                                </div>
                                
                                <div className="space-y-1">
                                  <h4 className="font-extrabold text-slate-900 text-[14px] group-hover:text-emerald-750 transition-colors line-clamp-1 leading-tight" title={h.subject}>
                                    {h.subject}
                                  </h4>
                                  {h.institution ? (
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest line-clamp-1" title={h.institution}>
                                      {h.institution}
                                    </p>
                                  ) : (
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Self Preparation</p>
                                  )}
                                </div>

                                {/* Display uploaded papers list if available */}
                                {h.uploadedPapers && h.uploadedPapers.length > 0 && (
                                  <div className="pt-1 flex flex-wrap gap-1 max-h-[36px] overflow-hidden">
                                    {h.uploadedPapers.slice(0, 3).map((paperName, pi) => (
                                      <span key={pi} className="px-1.5 py-0.5 bg-slate-50 text-[8.5px] font-semibold text-slate-400 rounded border border-slate-100 truncate max-w-[120px]" title={paperName}>
                                        {paperName}
                                      </span>
                                    ))}
                                    {h.uploadedPapers.length > 3 && (
                                      <span className="px-1.5 py-0.5 bg-slate-100 text-[8.5px] font-bold text-slate-400 rounded border border-slate-200">
                                        +{h.uploadedPapers.length - 3} more
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                              
                              <div className="flex items-center justify-between pt-3 border-t border-slate-100 bg-white z-10 leading-none shrink-0 mt-3">
                                <span className="text-[10px] text-slate-400 font-bold">{h.questions ? h.questions.length : 0} compiled PYQs</span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                                  Open Workspace →
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    {history.length > 6 && (
                      <button
                        onClick={() => setShowHistory(true)}
                        className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 hover:text-slate-950 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all text-center cursor-pointer border border-slate-200/50"
                      >
                        View All {history.length} Saved Analyses Workspaces
                      </button>
                    )}
                  </div>
                ) : (
                  /* GORGEOUS TIMELINE INTRO - Active when no studies have been performed yet */
                  <div className="bg-white border border-slate-200/50 rounded-[32px] p-8 shadow-xs relative overflow-hidden flex flex-col justify-between h-full bg-dot-pattern text-left">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-slate-500/5 rounded-full blur-2xl pointer-events-none" />
                    
                    <div className="space-y-6 relative z-10 py-2">
                      <div className="border-b border-slate-100 pb-4">
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 block leading-none">LAUNCH CHECKLIST</span>
                        <h3 className="text-xl font-black text-slate-900 mt-1">Getting Started with Exam Plus</h3>
                        <p className="text-xs text-slate-500 font-semibold leading-relaxed mt-1">Unlock superior grades via automated past-paper trend analysis.</p>
                      </div>

                      <div className="space-y-4">
                        <div className="flex gap-3.5 items-start">
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                            <span className="text-xs font-black">1</span>
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-800 text-xs">Load Semester Question Papers</h4>
                            <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">Drag & drop at least two question papers from previous terms of the same subject. PDF, JPEG, and PNG are fully indexed.</p>
                          </div>
                        </div>

                        <div className="flex gap-3.5 items-start">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                            <span className="text-xs font-black">2</span>
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-800 text-xs">Automatic Extraction & Synthesis</h4>
                            <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">The AI deciphers raw OCR data, classifies concepts by Unit, isolates recurrence rates, and precomputes answer guides with diagrams.</p>
                          </div>
                        </div>

                        <div className="flex gap-3.5 items-start">
                          <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
                            <span className="text-xs font-black">3</span>
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-800 text-xs">Run Interactive Preparations</h4>
                            <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5 font-semibold">Test yourself with our AI assistant, learn utilizing simplified answer keys, and follow custom revision planners tailored to your remaining days.</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-100 text-center flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none shrink-0 pt-4">
                      <span>Secure Processing</span>
                      <span>No separate subscription needed</span>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </motion.div>
          ) : (
                        <motion.div 
              key="analysis"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-6"
            >
              <AnalysisDashboard
                result={result}
                viewMode={viewMode}
                setViewMode={setViewMode}
                selectedUnit={selectedUnit}
                setSelectedUnit={setSelectedUnit}
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                studyStrategy={studyStrategy}
                isGeneratingStrategy={isGeneratingStrategy}
                strategyTimeframe={strategyTimeframe}
                customTimeframe={customTimeframe}
                setCustomTimeframe={setCustomTimeframe}
                regenerateStrategy={regenerateStrategy}
                setSelectedQuestion={setSelectedQuestion}
                downloadQuestionBank={downloadQuestionBank}
                downloadRepeatedQuestions={downloadRepeatedQuestions}
                downloadPredictedQuestions={downloadPredictedQuestions}
                downloadAIReport={downloadAIReport}
                downloadAllZIP={downloadAllZIP}
                downloadCompleteHandbook={downloadCompleteHandbook}
                isGeneratingHandbook={isGeneratingHandbook}
                reset={reset}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="bg-[#111827] text-[#D1D5DB] mt-24 border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
            <div className="md:col-span-2 space-y-4 p-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center border border-emerald-500/20">
                  <GraduationCap size={16} className="text-[#10B981]" />
                </div>
                <span className="text-sm font-black tracking-tight text-white uppercase font-heading">Exam Plus</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
                Unlock higher scores with data-driven preparation. Exam Plus analyzes yours and your university's past year question papers to reveal trends, frequent units, and predicted patterns.
              </p>
            </div>
            
            <div className="space-y-3">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-white font-heading">Key Features</h4>
              <ul className="space-y-2 text-xs text-slate-400">
                <li className="hover:text-[#10B981] transition-colors cursor-pointer">PYQ Compiler</li>
                <li className="hover:text-[#10B981] transition-colors cursor-pointer flex items-center gap-1">Repetition Tracker</li>
                <li className="hover:text-[#10B981] transition-colors cursor-pointer">AI Prediction Engine</li>
                <li className="hover:text-[#10B981] transition-colors cursor-pointer">Dynamic Revision Planner</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-white font-heading">Target Subjects</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Works for any semester exams, board prep, professional certifications, or coursework files where past exam sheets are available.
              </p>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-center sm:text-left">
              <p className="text-[11px] font-medium text-slate-500">
                &copy; 2026 Exam Plus. All rights reserved.
              </p>
              <span className="hidden sm:inline text-slate-700">|</span>
              <p className="text-[11px] font-medium text-slate-500">
                Helping students code their success path.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 bg-white/5 px-3 py-1 rounded-xl uppercase tracking-wider select-none border border-white/5">
              <span>Built by</span>
              <span className="text-white">AB</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Complete Study Handbook Loading Overlay */}
      <AnimatePresence>
        {isGeneratingHandbook && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 text-left"
          >
            <div className="bg-white border border-slate-100 max-w-md w-full rounded-[36px] p-10 shadow-2xl space-y-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-500" />
              
              <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-slate-100" />
                <div className="absolute inset-0 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin" />
                <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-[20px] flex items-center justify-center border border-emerald-100 shadow-inner">
                  <GraduationCap size={28} className="animate-bounce" />
                </div>
              </div>

              <div className="space-y-3 text-center">
                <h3 className="text-lg font-black text-slate-900 leading-tight">Compiling Study Handbook</h3>
                <p className="text-xs text-slate-500 font-medium leading-relaxed px-2">
                  Assembling a complete university-grade preparation book with visual diagrams, toppers notes, and quick revisions.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <span>PROGRESS STATUS</span>
                  <span>{handbookCurrent} / {handbookTotal} SOLVED</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                  <div 
                    className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                    style={{ width: `${handbookTotal > 0 ? (handbookCurrent / handbookTotal) * 105 : 0}%` }}
                  />
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100/80">
                <span className="text-[9px] font-black uppercase tracking-widest text-[#059669] block">CURRENT PROCESS</span>
                <p className="text-xs font-bold text-slate-700 mt-1 line-clamp-1 transition-all">{handbookProgress}</p>
              </div>

              <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest text-center animate-pulse">This may take 1-2 minutes • Do not close this tab</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
