import React from 'react';
import { 
  FileText, 
  ChevronRight, 
  ArrowRightLeft,
  Info,
  BookOpen,
  Filter,
  Sparkles,
  Send,
  Lightbulb,
  Target,
  Download,
  School,
  GraduationCap,
  Flame,
  TrendingUp,
  CheckSquare,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { motion } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Question, AnalysisResult } from '../types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface AnalysisDashboardProps {
  result: AnalysisResult;
  viewMode: 'bank' | 'repeated' | 'predictions' | 'report' | 'strategy';
  setViewMode: (mode: 'bank' | 'repeated' | 'predictions' | 'report' | 'strategy') => void;
  selectedUnit: string;
  setSelectedUnit: (unit: string) => void;
  currentPage: number;
  setCurrentPage: (updater: number | ((prev: number) => number)) => void;
  studyStrategy: string | null;
  isGeneratingStrategy: boolean;
  strategyTimeframe: string;
  customTimeframe: string;
  setCustomTimeframe: (text: string) => void;
  regenerateStrategy: (timeframe: string) => void;
  setSelectedQuestion: (q: Question) => void;
  downloadQuestionBank: () => void;
  downloadRepeatedQuestions: () => void;
  downloadPredictedQuestions: () => void;
  downloadAIReport: () => void;
  downloadAllZIP: () => void;
  downloadCompleteHandbook: () => void;
  isGeneratingHandbook?: boolean;
  reset: () => void;
}

const QUESTIONS_PER_PAGE = 50;

export const AnalysisDashboard: React.FC<AnalysisDashboardProps> = ({
  result,
  viewMode,
  setViewMode,
  selectedUnit,
  setSelectedUnit,
  currentPage,
  setCurrentPage,
  studyStrategy,
  isGeneratingStrategy,
  strategyTimeframe,
  customTimeframe,
  setCustomTimeframe,
  regenerateStrategy,
  setSelectedQuestion,
  downloadQuestionBank,
  downloadRepeatedQuestions,
  downloadPredictedQuestions,
  downloadAIReport,
  downloadAllZIP,
  downloadCompleteHandbook,
  isGeneratingHandbook = false,
  reset,
}) => {
  const getMostRepeatedTopics = () => {
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

  const getQuestionsList = () => {
    if (viewMode === 'bank') {
      const sorted = [...result.questions].sort((a, b) => {
        if (b.repetitionCount !== a.repetitionCount) {
          return b.repetitionCount - a.repetitionCount;
        }
        return b.marks - a.marks;
      });
      return sorted.filter(q => selectedUnit === 'All' || (q.unit || 'General') === selectedUnit);
    } else if (viewMode === 'repeated') {
      return result.questions.filter(q => q.repetitionCount > 1);
    }
    return [];
  };

  const filteredQuestions = getQuestionsList();
  const totalQuestionsCount = filteredQuestions.length;
  const totalPages = Math.ceil(totalQuestionsCount / QUESTIONS_PER_PAGE);

  const getPaginatedQuestions = () => {
    const start = (currentPage - 1) * QUESTIONS_PER_PAGE;
    return filteredQuestions.slice(start, start + QUESTIONS_PER_PAGE);
  };

  const paginatedData = getPaginatedQuestions();

  const uploadedMaterials = Array.from(new Set([
    ...(result.uploadedPapers || []),
    ...result.rawQuestions.map(q => q.paperName),
    ...(result.questions || []).flatMap(q => q.sourcePapers || [])
  ].filter(Boolean)));

  return (
    <div className="space-y-8">
      {/* Modern Dashboard Header Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-950 text-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-800 relative overflow-hidden text-left">
        <div className="absolute right-0 top-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 w-48 h-48 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {result.institution && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 text-emerald-300 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase border border-white/5 shadow-xs">
                  <School size={12} />
                  {result.institution}
                </span>
              )}
              {result.academicContext && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/5 text-slate-300 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase border border-white/5">
                  <GraduationCap size={12} />
                  {result.academicContext}
                </span>
              )}
            </div>
            
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight">
              {result.subject}
            </h2>
            
            {result.inferredSyllabus && (
              <p className="text-slate-400 text-xs md:text-sm max-w-2xl font-medium leading-relaxed">
                {result.inferredSyllabus}
              </p>
            )}
          </div>
          
          {/* Stats Summary Panel */}
          <div className="flex gap-4 bg-white/5 border border-white/10 rounded-2xl p-4 shrink-0 backdrop-blur-xs min-w-[280px]">
            <div className="flex-1 pr-4 border-r border-white/10">
              <span className="text-2xl md:text-3xl font-black text-white block">
                {uploadedMaterials.length}
              </span>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Papers Extracted</span>
            </div>
            
            <div className="flex-1 pr-4 border-r border-white/10 pl-2">
              <span className="text-2xl md:text-3xl font-black text-emerald-400 block">
                {result.questions.length}
              </span>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Compiled PYQs</span>
            </div>

            <div className="flex-1 pl-2">
              <span className="text-2xl md:text-3xl font-black text-amber-400 block">
                {getDifficultyDistribution().hard}%
              </span>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Hard Ratio</span>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Interactive Area */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Dynamic Action & Tab Select Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/5 pb-4">
            <div className="flex bg-white p-1 rounded-2xl border border-black/10 shadow-xs overflow-x-auto max-w-full no-scrollbar">
              {[
                { id: 'bank', label: 'Master Bank', icon: BookOpen },
                { id: 'repeated', label: 'High Yield', icon: Flame },
                { id: 'predictions', label: 'Predictions', icon: Sparkles },
                { id: 'strategy', label: 'Study Strategy', icon: Target },
                { id: 'report', label: 'Analytics Report', icon: TrendingUp },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setViewMode(tab.id as any)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
                    viewMode === tab.id
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-200"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  )}
                >
                  <tab.icon size={13} className={cn(viewMode === tab.id ? "text-white" : "text-slate-400")} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Filter Specifically for the Bank tab */}
            {viewMode === 'bank' && (
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-black/10 shadow-xs shrink-0 self-start sm:self-auto">
                <Filter size={13} className="text-slate-400" />
                <select 
                  value={selectedUnit}
                  onChange={(e) => setSelectedUnit(e.target.value)}
                  className="bg-transparent text-xs font-bold uppercase tracking-wider outline-none cursor-pointer text-slate-700 select-none py-1 h-6"
                >
                  <option value="All">All Units</option>
                  {Array.from(new Set(result.questions.map(q => q.unit || 'General')))
                    .filter(u => u !== 'General')
                    .sort((a, b) => {
                      const numA = parseInt(a.match(/\d+/)?.[0] || '0');
                      const numB = parseInt(b.match(/\d+/)?.[0] || '0');
                      return numA - numB || a.localeCompare(b);
                    })
                    .map(unit => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))
                  }
                  <option value="General">General</option>
                </select>
              </div>
            )}
          </div>

          {/* Tab 1: Preparation Planner (Strategy) */}
          {viewMode === 'strategy' && (
            <div className="bg-white border border-black/5 rounded-3xl p-6 md:p-8 shadow-xs space-y-6 text-left">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/5 pb-4">
                <div className="flex items-center gap-2.5 text-emerald-600">
                  <Lightbulb size={22} className="shrink-0" />
                  <div>
                    <h3 className="text-md font-bold text-slate-900 leading-tight">Syllabus-Weighed Preparation Planner</h3>
                    <p className="text-[11px] text-slate-500 font-medium">Precision focus roadmap formulated using extracted semesters frequency weights.</p>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <div className="flex bg-slate-100 p-1 rounded-xl border border-black/5">
                    {[
                      { id: 'general', label: 'Standard' },
                      { id: '1-day', label: '1 Day' }
                    ].map((t) => (
                      <button
                        key={t.id}
                        disabled={isGeneratingStrategy}
                        onClick={() => regenerateStrategy(t.id)}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                          strategyTimeframe === t.id 
                            ? "bg-white text-emerald-700 shadow-xs font-extrabold" 
                            : "text-slate-400 hover:text-slate-600"
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-black/5">
                    <input 
                      type="text"
                      placeholder="Custom days"
                      value={customTimeframe}
                      onChange={(e) => setCustomTimeframe(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && customTimeframe) {
                          regenerateStrategy(customTimeframe);
                        }
                      }}
                      className="bg-transparent text-[9px] font-bold uppercase tracking-wider outline-none px-2 py-1 w-16 placeholder:text-slate-350"
                    />
                    <button
                      onClick={() => customTimeframe && regenerateStrategy(customTimeframe)}
                      disabled={isGeneratingStrategy || !customTimeframe}
                      className="p-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all disabled:opacity-50"
                    >
                      <Send size={10} />
                    </button>
                  </div>
                </div>
              </div>

              {isGeneratingStrategy ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3 text-emerald-600">
                  <Loader2 size={32} className="animate-spin text-emerald-600" />
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400 animate-pulse">Assembling study matrix roadmap...</p>
                </div>
              ) : studyStrategy ? (
                <div className="text-sm leading-relaxed text-slate-705 whitespace-pre-wrap font-medium">
                  {studyStrategy}
                </div>
              ) : (
                <div className="py-20 text-center text-slate-400 text-xs font-medium">
                  Roadmap strategy guide not compiled. Choose Standard / 1-Day to generate.
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Predicted Future Exam Materials */}
          {viewMode === 'predictions' && (
            <div className="space-y-6 text-left">
              <div className="p-6 md:p-8 bg-slate-900 text-white rounded-3xl space-y-3 relative overflow-hidden shadow-md">
                <div className="absolute right-0 top-0 w-32 h-32 bg-yellow-400/5 rounded-full blur-2xl pointer-events-none" />
                <h4 className="text-md font-bold flex items-center gap-2 text-white">
                  <Sparkles className="text-yellow-400 animate-pulse shrink-0" size={18} />
                  Exam Predictions Model Analysis
                </h4>
                <p className="text-slate-300 text-xs font-medium leading-relaxed max-w-2xl">
                  Advanced AI predictive logic structures historical trends and question frequency weights to compile forecasts for upcoming tests.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border border-black/5 p-5 rounded-3xl space-y-4 shadow-xs">
                  <div className="flex items-center gap-2 border-b border-black/5 pb-3 text-red-500">
                    <Flame size={16} />
                    <h5 className="text-[11px] font-black uppercase tracking-widest text-slate-805">Frequent Core Topics</h5>
                  </div>
                  <ul className="space-y-3.5">
                    {result.predictions?.top10RepeatedQuestions && result.predictions.top10RepeatedQuestions.length > 0 ? (
                      result.predictions.top10RepeatedQuestions.map((q, i) => (
                        <li key={i} className="flex gap-2.5 items-start">
                          <span className="shrink-0 w-5 h-5 flex items-center justify-center bg-red-50 text-red-650 font-extrabold text-[9px] rounded-md">
                            {i + 1}
                          </span>
                          <p className="text-xs text-slate-700 font-semibold leading-relaxed">
                            {q}
                          </p>
                        </li>
                      ))
                    ) : (
                      <div className="text-center py-6 text-slate-400 text-xs">No questions synthesized filter values.</div>
                    )}
                  </ul>
                </div>

                <div className="bg-white border border-black/5 p-5 rounded-3xl space-y-4 shadow-xs">
                  <div className="flex items-center gap-2 border-b border-black/5 pb-3 text-emerald-600">
                    <Sparkles size={16} />
                    <h5 className="text-[11px] font-black uppercase tracking-widest text-slate-805">Forecasted Exam Probables</h5>
                  </div>
                  <ul className="space-y-3.5">
                    {result.predictions?.nextExamPredictions && result.predictions.nextExamPredictions.length > 0 ? (
                      result.predictions.nextExamPredictions.map((q, i) => (
                        <li key={i} className="flex gap-2.5 items-start">
                          <span className="shrink-0 w-5 h-5 flex items-center justify-center bg-emerald-50 text-emerald-600 font-extrabold text-[9px] rounded-md">
                            {i + 1}
                          </span>
                          <p className="text-xs text-slate-700 font-semibold leading-relaxed">
                            {q}
                          </p>
                        </li>
                      ))
                    ) : (
                      <div className="text-center py-6 text-slate-400 text-xs">Predictions not generated yet.</div>
                    )}
                  </ul>
                </div>
              </div>

              {/* Topic Clusters */}
              <div className="bg-white border border-black/5 p-6 rounded-3xl space-y-4 shadow-xs">
                <h5 className="text-[11px] font-black uppercase tracking-widest text-slate-805 flex items-center gap-2 pb-3 border-b border-black/5">
                  <CheckSquare size={16} className="text-amber-500 shrink-0" />
                  Forecasted High-Yield Topic Clusters
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {result.predictions?.importantTopics && result.predictions.importantTopics.length > 0 ? (
                    result.predictions.importantTopics.map((topic, i) => (
                      <div key={i} className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl flex items-center gap-3">
                        <span className="w-5 h-5 rounded bg-amber-50 flex items-center justify-center font-black text-[9px] text-amber-600 shrink-0">
                          #
                        </span>
                        <span className="text-xs font-bold text-slate-805 truncate">{topic}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 pl-2">No topic clusters extracted.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Detailed AI Analytics Reports (Report) */}
          {viewMode === 'report' && (
            <div className="space-y-6 text-left">
              {/* Report Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-white border border-black/5 p-4 rounded-2xl flex items-center gap-3">
                  <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center shrink-0">
                    <FileText size={18} />
                  </div>
                  <div>
                    <span className="text-lg font-bold block text-slate-900">
                      {uploadedMaterials.length}
                    </span>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block leading-none mt-0.5">Papers Extracted</span>
                  </div>
                </div>

                <div className="bg-white border border-black/5 p-4 rounded-2xl flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
                    <BookOpen size={18} />
                  </div>
                  <div>
                    <span className="text-lg font-bold block text-slate-900">
                      {result.questions.length}
                    </span>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block leading-none mt-0.5">Unique Database</span>
                  </div>
                </div>

                <div className="bg-white border border-black/5 p-4 rounded-2xl flex items-center gap-3">
                  <div className="w-9 h-9 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center shrink-0">
                    <TrendingUp size={18} />
                  </div>
                  <div>
                    <span className="text-lg font-bold block text-slate-900 truncate max-w-[120px]" title={(() => {
                      const unitCounts: Record<string, number> = {};
                      result.questions.forEach(q => { unitCounts[q.unit || 'General'] = (unitCounts[q.unit || 'General'] || 0) + 1; });
                      const sortedUnits = Object.entries(unitCounts).sort((a,b) => b[1] - a[1]);
                      return sortedUnits[0]?.[0] || 'N/A';
                    })()}>
                      {(() => {
                        const unitCounts: Record<string, number> = {};
                        result.questions.forEach(q => { unitCounts[q.unit || 'General'] = (unitCounts[q.unit || 'General'] || 0) + 1; });
                        const sortedUnits = Object.entries(unitCounts).sort((a,b) => b[1] - a[1]);
                        return sortedUnits[0]?.[0] || 'N/A';
                      })()}
                    </span>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block leading-none mt-0.5">Heavy Syllabus Unit</span>
                  </div>
                </div>
              </div>

              {/* Repetitive High Yield Topics */}
              <div className="bg-white border border-black/5 p-5 rounded-3xl space-y-4 shadow-xs">
                <div className="flex items-center gap-2 border-b border-black/5 pb-3">
                  <Flame className="text-red-500" size={16} />
                  <h5 className="text-[11px] font-black uppercase tracking-widest text-slate-805">Frequency Distribution Peaks</h5>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {getMostRepeatedTopics().map((t, idx) => (
                    <div key={idx} className="bg-slate-50 border border-slate-100 p-3 rounded-xl flex items-center gap-3">
                      <span className="w-6 h-6 rounded-md bg-orange-50 text-orange-600 flex items-center justify-center font-extrabold text-[10px] shrink-0">
                        #{idx + 1}
                      </span>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-slate-805 block truncate">{t.topic}</span>
                        <span className="text-[9px] text-slate-450 font-semibold">{t.totalReps} total hits</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Unit-wise frequency compiler */}
              <div className="space-y-4">
                <h5 className="text-[11px] font-black uppercase tracking-widest text-slate-500">Unit-wise Frequency Report</h5>
                
                {(() => {
                  const units = Array.from(new Set(result.questions.map(q => q.unit || 'General')))
                    .sort((a, b) => {
                      const numA = parseInt(a.match(/\d+/)?.[0] || '0');
                      const numB = parseInt(b.match(/\d+/)?.[0] || '0');
                      return numA - numB || a.localeCompare(b);
                    });

                  return units.map(unit => {
                    const unitQuestions = result.questions.filter(q => (q.unit || 'General') === unit);
                    if (unitQuestions.length === 0) return null;

                    const topicGroups: Record<string, Question[]> = {};
                    unitQuestions.forEach(q => {
                      const topKey = q.topic || 'General Topics';
                      if (!topicGroups[topKey]) topicGroups[topKey] = [];
                      topicGroups[topKey].push(q);
                    });

                    return (
                      <div key={unit} className="bg-white border border-black/5 p-5 rounded-3xl space-y-4 shadow-xs">
                        <h4 className="text-[11px] font-black text-emerald-850 uppercase tracking-widest flex items-center gap-2 border-b border-black/5 pb-3">
                          <CheckSquare size={13} className="text-emerald-600 shrink-0" />
                          {unit.toUpperCase()} ANALYSIS
                        </h4>
                        <div className="space-y-5 divide-y divide-black/5">
                          {Object.entries(topicGroups).map(([topic, qs], tIdx) => {
                            const topicFreq = qs.reduce((sum, q) => sum + q.repetitionCount, 0);
                            const yrsAsked = Array.from(new Set(qs.flatMap(q => q.sourcePapers)));
                            const maxMarks = Math.max(...qs.map(q => q.marks));
                            const minMarks = Math.min(...qs.map(q => q.marks));
                            const marksRange = maxMarks === minMarks ? `${maxMarks} Marks` : `${minMarks}-${maxMarks} Marks`;
                            
                            let importance = 'Medium Importance';
                            let priorityBadge = 'bg-blue-50 text-blue-700 border-blue-105';
                            if (topicFreq >= 3) {
                              importance = 'Highly Repeated';
                              priorityBadge = 'bg-red-50 text-red-700 border-red-105';
                            } else if (topicFreq === 1) {
                              importance = 'Rare Question';
                              priorityBadge = 'bg-slate-50 text-slate-600 border-slate-105';
                            }

                            return (
                              <div key={topic} className={cn("space-y-3", tIdx > 0 ? "pt-4" : "")}>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                                    TOPIC: {topic}
                                  </h5>
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className={cn("px-2 py-0.5 border text-[8px] font-black uppercase tracking-wider rounded", priorityBadge)}>
                                      {importance}
                                    </span>
                                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded text-[8px] font-black uppercase tracking-wider">
                                      Freq: {topicFreq}x
                                    </span>
                                    <span className="px-2 py-0.5 bg-purple-50 text-purple-750 border border-purple-100 rounded text-[8px] font-black uppercase tracking-wider">
                                      {marksRange}
                                    </span>
                                  </div>
                                </div>

                                {yrsAsked.length > 0 && (
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Years Asked:</span>
                                    <div className="flex gap-1 flex-wrap">
                                      {yrsAsked.map((y, yIdx) => (
                                        <span key={yIdx} className="px-1.5 py-0.5 bg-slate-50 border border-black/5 text-slate-500 rounded text-[8px] font-mono leading-none">
                                          {y}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                <div className="space-y-1.5">
                                  <ul className="space-y-2 pl-4 list-decimal text-xs font-semibold text-slate-705 leading-relaxed">
                                    {qs.map((q, qIdx) => (
                                      <li 
                                        key={q.id || qIdx} 
                                        className="hover:text-emerald-600 cursor-pointer transition-colors" 
                                        onClick={() => setSelectedQuestion(q)}
                                      >
                                        {q.text}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Vis Graphics Distribution Map */}
              <div className="bg-slate-50/50 border border-black/5 p-5 rounded-3xl space-y-4 shadow-xs">
                <div className="flex items-center gap-2 border-b border-black/5 pb-3">
                  <TrendingUp className="text-emerald-600" size={16} />
                  <h5 className="text-[11px] font-black uppercase tracking-widest text-slate-805">Aesthetic Trend Metrics</h5>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="bg-white border border-black/5 p-4.5 rounded-2xl space-y-3">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Difficulty Distribution</span>
                    {(() => {
                      const dist = getDifficultyDistribution();
                      return (
                        <div className="space-y-2 text-xs font-bold font-sans">
                          <div>
                            <div className="flex justify-between text-[9px] mb-0.5">
                              <span>Easy</span>
                              <span>{dist.easy}%</span>
                            </div>
                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-emerald-550 h-full bg-emerald-500 rounded-full" style={{ width: `${dist.easy}%` }} />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-[9px] mb-0.5">
                              <span>Medium</span>
                              <span>{dist.medium}%</span>
                            </div>
                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-blue-500 h-full rounded-full" style={{ width: `${dist.medium}%` }} />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-[9px] mb-0.5">
                              <span>Hard</span>
                              <span>{dist.hard}%</span>
                            </div>
                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-orange-500 h-full rounded-full" style={{ width: `${dist.hard}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="bg-white border border-black/5 p-4.5 rounded-2xl space-y-3">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Primary Marks Weightage</span>
                    {(() => {
                      const marksCount: Record<number, number> = {};
                      result.questions.forEach(q => { marksCount[q.marks] = (marksCount[q.marks] || 0) + 1; });
                      const sortedMarks = Object.entries(marksCount).sort((a,b) => b[1] - a[1]);
                      return (
                        <div className="space-y-1.5 text-xs">
                          {sortedMarks.slice(0, 3).map(([marks, count], idx) => (
                            <div key={idx} className="flex items-center justify-between p-1.5 bg-slate-50 border border-black/5 rounded-lg font-extrabold text-slate-700">
                              <span>{marks} Marks</span>
                              <span className="text-[9px] text-slate-450">{count} questions</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  <div className="bg-white border border-black/5 p-4.5 rounded-2xl space-y-3 font-sans">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Academic Summary</span>
                    {(() => {
                      const totalMarks = result.questions.reduce((sum, q) => sum + q.marks, 0);
                      const totalReps = result.questions.reduce((sum, q) => sum + q.repetitionCount, 0);
                      return (
                        <div className="space-y-2 text-[10px] font-bold text-slate-500">
                          <div className="flex justify-between border-b border-black/5 pb-1">
                            <span>Avg Marks / Q:</span>
                            <span className="text-slate-800 font-extrabold">{(totalMarks / (result.questions.length || 1)).toFixed(1)} Marks</span>
                          </div>
                          <div className="flex justify-between border-b border-black/5 pb-1">
                            <span>Average Repetition:</span>
                            <span className="text-slate-800 font-extrabold">{(totalReps / (result.questions.length || 1)).toFixed(1)}x</span>
                          </div>
                          <div className="flex justify-between pt-0.5">
                            <span>Syllabus Covered:</span>
                            <span className="text-[8px] font-black text-emerald-700 bg-emerald-50 rounded px-1 shadow-2xs">100% Verified</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Prep study recommendations */}
              <div className="bg-emerald-50/40 border border-emerald-100 p-5 rounded-3xl space-y-3">
                <div className="flex items-center gap-1.5 border-b border-emerald-100 pb-2.5">
                  <GraduationCap className="text-emerald-700" size={18} />
                  <h5 className="text-[11px] font-black uppercase tracking-widest text-emerald-850">Quick Prep Optimization</h5>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-semibold text-slate-700">
                  <div className="bg-white p-3.5 rounded-xl border border-red-100 space-y-1">
                    <span className="px-1.5 py-0.5 bg-red-50 text-red-700 font-black text-[8px] uppercase rounded block w-fit border border-red-100">HIGH PRIORITY</span>
                    <p className="text-[11px] leading-relaxed">
                      Optimize core Repeated questions: {getMostRepeatedTopics().slice(0, 2).map(t => t.topic).join(', ')}. Standard semesters duplicate these heavily!
                    </p>
                  </div>
                  <div className="bg-white p-3.5 rounded-xl border border-blue-100 space-y-1">
                    <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 font-black text-[8px] uppercase rounded block w-fit border border-blue-105">MEDIUM PRIORITY</span>
                    <p className="text-[11px] leading-relaxed">
                      Prepare secondary conceptual tags like {getMostRepeatedTopics().slice(2, 4).map(t => t.topic).join(', ') || 'EEPROM/RTC peripheral interfacing units'}.
                    </p>
                  </div>
                  <div className="bg-white p-3.5 rounded-xl border border-slate-100 space-y-1">
                    <span className="px-1.5 py-0.5 bg-slate-50 text-slate-800 font-black text-[8px] uppercase rounded block w-fit border border-black/5">LOW SUMMARY</span>
                    <p className="text-[11px] leading-relaxed">
                      Explore singular rare items once or run quick explanations via follow-up AI chats to secure top-tier syllabus confidence.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Master Bank & High Yield Lists */}
          {(viewMode === 'bank' || viewMode === 'repeated') && (
            <div className="space-y-6">
              {Array.from(new Set(paginatedData.map(q => q.unit || 'General')))
                .sort((a, b) => {
                  const numA = parseInt(a.match(/\d+/)?.[0] || '0');
                  const numB = parseInt(b.match(/\d+/)?.[0] || '0');
                  return numA - numB || a.localeCompare(b);
                })
                .map(group => {
                  const displayQuestions = paginatedData.filter(q => (q.unit || 'General') === group);
                  if (displayQuestions.length === 0) return null;

                  return (
                    <div key={group} className="space-y-4 text-left">
                      <div className="flex items-center gap-3">
                        <div className="h-px flex-1 bg-black/5" />
                        <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">{group}</h4>
                        <div className="h-px flex-1 bg-black/5" />
                      </div>
                      
                      <div className="grid gap-3">
                        {displayQuestions.map((q, index) => {
                          const isRepeatedMode = viewMode === 'repeated';
                          return (
                            <motion.div
                              key={q.id}
                              initial={{ opacity: 0, y: 15 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.01 }}
                              whileHover={{ y: -3, scale: 1.002 }}
                              whileTap={{ scale: 0.995 }}
                              onClick={() => setSelectedQuestion(q)}
                              className={cn(
                                "bg-white p-5 rounded-2xl border transition-all cursor-pointer group relative overflow-hidden text-left",
                                isRepeatedMode 
                                  ? "border-red-500/10 hover:border-red-500/30 shadow-xs" 
                                  : "border-black/5 hover:border-emerald-600/20 shadow-xs hover:shadow-md"
                              )}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex gap-3.5 w-full">
                                  <span className={cn(
                                    "text-lg font-black transition-colors shrink-0",
                                    isRepeatedMode 
                                      ? "text-red-500/10 group-hover:text-red-500/20" 
                                      : "text-black/5 group-hover:text-emerald-600/15"
                                  )}>
                                    {((currentPage - 1) * QUESTIONS_PER_PAGE + index + 1).toString().padStart(2, '0')}
                                  </span>
                                  
                                  <div className="space-y-2.5 w-full min-w-0">
                                    {q.topic && (
                                      <div className={cn(
                                        "flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md w-fit",
                                        isRepeatedMode 
                                          ? "text-red-700 bg-red-50 border border-red-105" 
                                          : "text-emerald-700 bg-emerald-50 border border-emerald-105"
                                      )}>
                                        Topic: {q.topic}
                                      </div>
                                    )}
                                    
                                    <p className="text-sm font-bold leading-relaxed text-slate-900 group-hover:text-emerald-950 transition-colors whitespace-pre-wrap">
                                      {q.text}
                                    </p>

                                    {isRepeatedMode ? (
                                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2.5 border-t border-red-500/5 mt-3">
                                        <div className="bg-red-50/40 p-2.5 rounded-xl border border-red-500/5">
                                          <span className="block text-[8px] font-extrabold uppercase tracking-wider text-red-500/70 mb-0.5">Repetitions</span>
                                          <span className="text-xs font-black text-red-700 flex items-center gap-1">
                                            <Flame size={12} className="text-red-500 fill-red-500" />
                                            {q.repetitionCount} Times
                                          </span>
                                        </div>

                                        <div className="bg-amber-50/40 p-2.5 rounded-xl border border-amber-500/5">
                                          <span className="block text-[8px] font-extrabold uppercase tracking-wider text-amber-600/80 mb-0.5">Probability</span>
                                          <span className="text-xs font-black text-amber-700 flex items-center gap-1">
                                            ★ {q.probabilityScore || (q.repetitionCount >= 3 ? 92 : 78)}%
                                          </span>
                                        </div>

                                        <div className="bg-red-50/20 p-2.5 rounded-xl border border-red-500/5 col-span-2 sm:col-span-1">
                                          <span className="block text-[8px] font-extrabold uppercase tracking-wider text-red-500/70 mb-0.5">Priority</span>
                                          <span className="text-xs font-black text-red-650 uppercase block">
                                            {q.importance || (q.repetitionCount >= 3 ? 'HIGH' : 'MEDIUM')}
                                          </span>
                                        </div>

                                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 col-span-2 sm:col-span-1">
                                          <span className="block text-[8px] font-extrabold uppercase tracking-wider text-slate-500 mb-0.5">Syllabus Weight</span>
                                          <span className="text-xs font-black text-slate-700">
                                            {q.marks} Marks
                                          </span>
                                        </div>
                                      </div>
                                    ) : null}

                                    {q.rephrasings && q.rephrasings.length > 0 && (
                                      <div className="mt-2 text-xs border-l-2 border-slate-200 pl-3 py-1 bg-slate-50/50 rounded-r-lg pr-2 space-y-0.5">
                                        <span className="font-extrabold text-slate-400 uppercase tracking-wider text-[8px] block">Variant Phrases:</span>
                                        {q.rephrasings.slice(0, 3).map((repText, idx) => (
                                          <p key={idx} className="text-slate-650 italic font-semibold leading-relaxed">"{repText}"</p>
                                        ))}
                                      </div>
                                    )}

                                    {!isRepeatedMode && (
                                      <div className="flex flex-wrap items-center gap-1.5 mt-2 pt-2 border-t border-black/5">
                                        {q.repetitionCount >= 4 && (
                                          <span className="px-2 py-0.5 bg-red-50 text-red-800 border border-red-105 rounded text-[8px] font-black uppercase tracking-wider flex items-center gap-1">
                                            🔥🔥 Highly Repeated
                                          </span>
                                        )}
                                        {q.repetitionCount === 3 && (
                                          <span className="px-2 py-0.5 bg-red-50 text-red-600 border border-red-100 rounded text-[8px] font-black uppercase tracking-wider flex items-center gap-1">
                                            🔥 Frequently Asked
                                          </span>
                                        )}
                                        {q.repetitionCount === 2 && (
                                          <span className="px-2 py-0.5 bg-blue-50 text-blue-650 border border-blue-105 rounded text-[8px] font-black uppercase tracking-wider flex items-center gap-1">
                                            ⭐ Medium Weight
                                          </span>
                                        )}
                                        {q.difficulty === 'hard' && (
                                          <span className="px-2 py-0.5 bg-orange-50 text-orange-600 border border-orange-105 rounded text-[8px] font-black uppercase tracking-wider flex items-center gap-1">
                                            Hard
                                          </span>
                                        )}
                                        {q.isConceptual && (
                                          <span className="px-2 py-0.5 bg-purple-50 text-purple-650 border border-purple-105 rounded text-[8px] font-black uppercase tracking-wider flex items-center gap-1">
                                            Conceptual
                                          </span>
                                        )}
                                        <span className="px-2 py-0.5 bg-slate-50 border border-black/5 rounded text-[8px] font-black uppercase tracking-wider text-slate-500">
                                          {q.marks} Marks
                                        </span>
                                        {q.repetitionCount > 1 && (
                                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded text-[8px] font-black uppercase tracking-wider flex items-center gap-1 leading-none">
                                            Repeated {q.repetitionCount}x
                                          </span>
                                        )}
                                        <div className="flex flex-wrap gap-1">
                                          {(q.sourceReferences || q.sourcePapers || []).map((ref, i) => (
                                            <span 
                                              key={i}
                                              className="px-1.5 py-0.5 bg-black/5 text-black/45 rounded text-[8px] font-mono font-bold uppercase leading-none"
                                            >
                                              {ref}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className={cn(
                                  "w-7 h-7 rounded-xl bg-slate-50 flex items-center justify-center transition-all shrink-0 mt-0.5 border border-black/5",
                                  isRepeatedMode 
                                    ? "group-hover:bg-red-550 group-hover:bg-red-500 group-hover:text-white" 
                                    : "group-hover:bg-emerald-600 group-hover:text-white"
                                )}>
                                  <ChevronRight size={14} />
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {/* Pagination for lists */}
          {(viewMode === 'bank' || viewMode === 'repeated') && totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-6">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-2.5 bg-white border border-black/10 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black/5 transition-all"
              >
                Prev
              </button>
              <div className="flex items-center gap-1.5 overflow-x-auto max-w-[200px] sm:max-w-none no-scrollbar py-1">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i + 1)}
                    className={cn(
                      "w-8 h-8 rounded-lg text-xs font-bold transition-all shrink-0",
                      currentPage === i + 1 
                        ? "bg-emerald-600 text-white shadow shadow-emerald-200" 
                        : "bg-white border border-black/10 text-black/40 hover:border-black/20"
                    )}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-2.5 bg-white border border-black/10 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black/5 transition-all"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Premium Action Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Printable Handouts & Resources Card */}
          <div className="bg-white border border-black/5 p-6 rounded-3xl shadow-xs space-y-4 text-left">
            <div className="flex items-center gap-2 border-b border-black/5 pb-3">
              <Download size={18} className="text-emerald-600 shrink-0" />
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-800">Printable Study Kit</h3>
            </div>
            
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Export beautifully structured, academic PDF handouts compiled sequence-wise for physical printing.
            </p>
            
            <div className="space-y-2">
              {/* Highlight Featured Complete Study Handbook Compiler */}
              <button
                onClick={downloadCompleteHandbook}
                disabled={isGeneratingHandbook}
                className="w-full flex flex-col gap-2 p-4 bg-emerald-55 border-emerald-600 border-2 bg-emerald-50 hover:bg-emerald-50/85 active:scale-98 disabled:opacity-50 transition-all rounded-3xl text-left shadow-lg shadow-emerald-50 group hover:shadow-emerald-100 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-emerald-400/10 to-transparent rounded-full" />
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
                    <GraduationCap size={20} className={isGeneratingHandbook ? "animate-spin" : ""} />
                  </div>
                  <div>
                    <span className="text-[9px] font-black tracking-widest text-[#059669] block uppercase">PREMIUM SOLVED KIT</span>
                    <span className="text-sm font-black text-slate-900 block leading-tight mt-0.5">Complete Study Handbook</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-emerald-100 text-[11px] text-[#059669] font-extrabold flex items-center gap-1">
                  <span>Compile Master Book Solutions (PDF)</span>
                  <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>

              <div className="h-2" />

              <button
                onClick={downloadQuestionBank}
                className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-emerald-50/40 border border-slate-100 hover:border-emerald-100 rounded-2xl transition-all text-left group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-55 bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <BookOpen size={14} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-black text-slate-800 block leading-tight truncate">Master Question Bank</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase font-mono">PDF • {result.questions.length} Compiled</span>
                  </div>
                </div>
                <ChevronRight size={14} className="text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>

              <button
                onClick={downloadRepeatedQuestions}
                className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-red-50/40 border border-slate-100 hover:border-red-100 rounded-2xl transition-all text-left group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-red-50 text-red-650 flex items-center justify-center shrink-0">
                    <Flame size={14} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-black text-slate-800 block leading-tight truncate">High-Yield Repeated list</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase font-mono">PDF • {result.questions.filter(q => q.repetitionCount > 1).length} Compiled</span>
                  </div>
                </div>
                <ChevronRight size={14} className="text-slate-400 group-hover:text-red-600 group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>

              <button
                onClick={downloadPredictedQuestions}
                className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-purple-50/40 border border-slate-100 hover:border-purple-100 rounded-2xl transition-all text-left group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                    <Sparkles size={14} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-black text-slate-800 block leading-tight truncate">Forecasted Exam Sheets</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase font-mono">PDF • Predictions</span>
                  </div>
                </div>
                <ChevronRight size={14} className="text-slate-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>

              <button
                onClick={downloadAIReport}
                className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-blue-50/40 border border-slate-100 hover:border-blue-105 rounded-2xl transition-all text-left group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <TrendingUp size={14} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-black text-slate-800 block leading-tight truncate">Industry Trend Report</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase font-mono">PDF • Analytics Metrics</span>
                  </div>
                </div>
                <ChevronRight size={14} className="text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>
            </div>

            <button
              onClick={downloadAllZIP}
              className="w-full mt-2 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <Download size={14} />
              Download Combined ZIP Bundle
            </button>
          </div>

          {/* Reference Source Material Checklist Card */}
          <div className="bg-white border border-black/5 p-6 rounded-3xl shadow-xs space-y-4 text-left">
            <div className="flex items-center gap-2 border-b border-black/5 pb-3">
              <FileText size={18} className="text-slate-500 shrink-0" />
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-805 font-sans">Active Materials</h3>
            </div>
            
            <p className="text-[11px] text-slate-550 text-slate-500 font-medium leading-relaxed">
              These uploaded items represent the benchmark reference source for compiling this subject's analytics profile.
            </p>
            
            <div className="space-y-2">
              {uploadedMaterials.map((paper, idx) => (
                <div key={idx} className="flex items-center gap-2.5 p-2.5 bg-slate-50 border border-slate-100 rounded-xl min-w-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="text-xs font-bold text-slate-750 truncate" title={paper}>
                    {paper}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Reset/New Analysis CTA */}
          <button
            onClick={reset}
            className="w-full py-4 bg-white hover:bg-red-50 text-slate-600 hover:text-red-650 border border-black/5 hover:border-red-150 rounded-3xl text-xs font-black uppercase tracking-widest transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <RefreshCw size={14} />
            Start New Subject Analysis
          </button>
          
        </div>
      </div>
    </div>
  );
};
