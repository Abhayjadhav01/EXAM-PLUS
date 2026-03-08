/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback } from 'react';
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
  Info,
  BookOpen,
  Filter,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { UploadedFile, AnalysisResult, Question } from './types';
import { analyzePapers, simplifyAnswer } from './services/geminiService';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [filter, setFilter] = useState<'all' | 'repeated'>('all');
  const [selectedUnit, setSelectedUnit] = useState<string>('All');
  const [simplifiedAnswer, setSimplifiedAnswer] = useState<string | null>(null);
  const [isSimplifying, setIsSimplifying] = useState(false);
  const [showSimplified, setShowSimplified] = useState(false);

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

      const analysis = await analyzePapers(fileData);
      
      if (!analysis.isSameSubject) {
        setError(`The uploaded papers seem to be for different subjects. Detected subject: ${analysis.subject}. Please upload papers for the same subject.`);
        setIsAnalyzing(false);
        return;
      }

      setResult(analysis);
    } catch (err) {
      console.error(err);
      setError("Failed to analyze papers. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const reset = () => {
    setFiles([]);
    setResult(null);
    setError(null);
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
    } catch (err) {
      console.error(err);
    } finally {
      setIsSimplifying(false);
    }
  };

  const handleCloseModal = () => {
    setSelectedQuestion(null);
    setSimplifiedAnswer(null);
    setShowSimplified(false);
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#1A1A1A] font-sans selection:bg-emerald-100">
      {/* Header */}
      <header className="border-b border-black/5 bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold">P</div>
            <h1 className="text-xl font-bold tracking-tight text-black">PYQ ANALYZER</h1>
          </div>
          {result && (
            <button 
              onClick={reset}
              className="text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              Start New Analysis
            </button>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        {!result ? (
          <div className="max-w-2xl mx-auto space-y-8">
            <div className="text-center space-y-4">
              <h2 className="text-4xl font-bold tracking-tight text-balance">
                Smart Previous Year Question Analysis
              </h2>
              <p className="text-lg text-black/60">
                Upload your question papers (PDF or Images) and let AI identify patterns, repeated questions, and key topics.
              </p>
            </div>

            {/* Upload Section */}
            <div 
              {...getRootProps()} 
              className={cn(
                "border-2 border-dashed rounded-3xl p-12 transition-all cursor-pointer flex flex-col items-center justify-center gap-4",
                isDragActive ? "border-emerald-500 bg-emerald-50" : "border-black/10 hover:border-black/20 bg-white shadow-sm"
              )}
            >
              <input {...getInputProps()} />
              <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                <Upload size={32} />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold">Click or drag papers here</p>
                <p className="text-sm text-black/40">Support PDF, JPG, PNG (Min 2 papers)</p>
              </div>
            </div>

            {/* File List */}
            <AnimatePresence>
              {files.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-black/40 px-2">Uploaded Papers</h3>
                  {files.map((file) => (
                    <div key={file.id} className="bg-white rounded-2xl p-4 flex items-center justify-between border border-black/5 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-black/5 rounded-xl flex items-center justify-center text-black/60">
                          <FileText size={20} />
                        </div>
                        <div>
                          <p className="font-medium text-sm truncate max-w-[200px]">{file.file.name}</p>
                          <p className="text-xs text-black/40">{(file.file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => removeFile(file.id)}
                        className="p-2 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-700 p-4 rounded-2xl flex items-start gap-3">
                <AlertCircle size={20} className="shrink-0 mt-0.5" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            <button
              disabled={files.length < 2 || isAnalyzing}
              onClick={handleAnalyze}
              className={cn(
                "w-full py-4 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-2",
                files.length >= 2 && !isAnalyzing 
                  ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-200" 
                  : "bg-black/5 text-black/20 cursor-not-allowed"
              )}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="animate-spin" />
                  Analyzing Papers...
                </>
              ) : (
                "Analyze Papers"
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-12">
            {/* Results Header */}
            <div className="bg-white rounded-[32px] p-8 border border-black/5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <h2 className="text-4xl font-bold tracking-tight">{result.subject}</h2>
                <p className="text-black/60 text-lg">{result.summary}</p>
              </div>
              <div className="flex gap-4">
                <div className="bg-[#F5F5F0] px-6 py-3 rounded-2xl text-center">
                  <p className="text-xs font-bold text-black/40 uppercase">Total Questions</p>
                  <p className="text-2xl font-bold">{result.allQuestions.length}</p>
                </div>
                <div className="bg-emerald-50 px-6 py-3 rounded-2xl text-center">
                  <p className="text-xs font-bold text-emerald-600/60 uppercase">Repeated Topics</p>
                  <p className="text-2xl font-bold text-emerald-600">
                    {result.repeatedAnalysis.length}
                  </p>
                </div>
              </div>
            </div>

            {/* Questions List */}
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <BookOpen size={24} className="text-emerald-600" />
                  {filter === 'all' ? 'Question Bank' : 'Repeated Questions'}
                </h3>
                <div className="flex flex-wrap items-center gap-3">
                  {/* Unit Filter Dropdown */}
                  <div className="relative group">
                    <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-black/5 shadow-sm">
                      <Filter size={14} className="text-black/40" />
                      <select 
                        value={selectedUnit}
                        onChange={(e) => setSelectedUnit(e.target.value)}
                        className="bg-transparent text-xs font-bold uppercase tracking-wider outline-none cursor-pointer pr-2"
                      >
                        <option value="All">All Units</option>
                        {Array.from(new Set(result.allQuestions.map(q => q.unit || 'General')))
                          .filter(u => u !== 'General')
                          .sort((a, b) => {
                            // Sort Unit 1, Unit 2, etc numerically if possible
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
                  </div>

                  <div className="flex bg-white p-1 rounded-xl border border-black/5 shadow-sm">
                    <button
                      onClick={() => setFilter('repeated')}
                      className={cn(
                        "px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
                        filter === 'repeated' 
                          ? "bg-emerald-600 text-white shadow-sm" 
                          : "text-black/40 hover:text-black/60"
                      )}
                    >
                      Repeated
                    </button>
                    <button
                      onClick={() => setFilter('all')}
                      className={cn(
                        "px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
                        filter === 'all' 
                          ? "bg-emerald-600 text-white shadow-sm" 
                          : "text-black/40 hover:text-black/60"
                      )}
                    >
                      Question Bank
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Group by Unit/Section if available */}
              {Array.from(new Set(result.allQuestions.map(q => q.unit || 'General')))
                .filter(group => selectedUnit === 'All' || group === selectedUnit)
                .sort((a, b) => {
                  const numA = parseInt(a.match(/\d+/)?.[0] || '0');
                  const numB = parseInt(b.match(/\d+/)?.[0] || '0');
                  return numA - numB || a.localeCompare(b);
                })
                .map(group => {
                  let displayQuestions: (Question & { repetitionCount?: number })[] = [];

                  if (filter === 'all') {
                    // Raw list of all questions in this unit
                    displayQuestions = result.allQuestions.filter(q => (q.unit || 'General') === group);
                  } else {
                    // Analysis of repeated questions in this unit
                    const repeatedInUnit = result.repeatedAnalysis.filter(ra => {
                      const firstRelatedId = ra.relatedQuestionIds[0];
                      const q = result.allQuestions.find(aq => aq.id === firstRelatedId);
                      return q && (q.unit || 'General') === group;
                    });

                    displayQuestions = repeatedInUnit.map(ra => {
                      const q = result.allQuestions.find(aq => aq.id === ra.relatedQuestionIds[0])!;
                      return {
                        ...q,
                        text: ra.questionText,
                        repetitionCount: ra.repetitionCount
                      };
                    });
                  }

                  if (displayQuestions.length === 0) return null;

                  return (
                    <div key={group} className="space-y-4">
                      <h4 className="text-sm font-bold uppercase tracking-widest text-black/40 px-2">{group}</h4>
                      <div className="space-y-3">
                        {displayQuestions.map((q, index) => (
                          <motion.div
                            key={q.id}
                            whileHover={{ scale: 1.01 }}
                            onClick={() => setSelectedQuestion(q)}
                            className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex gap-4">
                                <span className="text-lg font-bold text-black/10 group-hover:text-emerald-600/20 transition-colors shrink-0">
                                  {(index + 1).toString().padStart(2, '0')}
                                </span>
                                <div className="space-y-2">
                                  <p className="text-lg font-medium leading-relaxed group-hover:text-emerald-700 transition-colors">
                                    {q.text}
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    <span className="px-3 py-1 bg-black/5 rounded-full text-xs font-bold">
                                      {q.marks} Marks
                                    </span>
                                    {filter === 'repeated' && q.repetitionCount && q.repetitionCount > 1 && (
                                      <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold flex items-center gap-1">
                                        Repeated {q.repetitionCount}x
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <ChevronRight className="text-black/20 group-hover:text-emerald-600 transition-colors shrink-0" />
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </main>

      {/* Answer Modal */}
      <AnimatePresence>
        {selectedQuestion && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseModal}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-3xl rounded-[32px] shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-black/5 flex items-start justify-between gap-4 shrink-0">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">
                      {selectedQuestion.marks} Marks
                    </span>
                    {selectedQuestion.unit && (
                      <span className="text-xs font-bold text-black/40 uppercase tracking-widest">
                        {selectedQuestion.unit}
                      </span>
                    )}
                  </div>
                  <h3 className="text-2xl font-bold leading-tight">{selectedQuestion.text}</h3>
                </div>
                <button 
                  onClick={handleCloseModal}
                  className="p-2 hover:bg-black/5 rounded-xl transition-colors shrink-0"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 overflow-y-auto space-y-8">
                {/* Answer Section */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold uppercase tracking-widest text-emerald-600">
                      {showSimplified ? 'Simplified Answer' : 'Model Answer'}
                    </h4>
                    <button
                      onClick={handleSimplify}
                      disabled={isSimplifying}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                        showSimplified 
                          ? "bg-emerald-600 text-white shadow-md" 
                          : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
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
                  <div className="prose prose-emerald max-w-none text-black/80 leading-relaxed">
                    <ReactMarkdown>
                      {showSimplified ? simplifiedAnswer! : selectedQuestion.answer}
                    </ReactMarkdown>
                  </div>
                </section>

                {/* Marks Distribution */}
                <section className="space-y-4">
                  <h4 className="text-sm font-bold uppercase tracking-widest text-emerald-600">Marks Distribution</h4>
                  <div className="space-y-3">
                    {selectedQuestion.marksDistribution.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 bg-[#F5F5F0] rounded-2xl">
                        <span className="text-sm font-medium">{item.point}</span>
                        <span className="font-bold text-emerald-600">+{item.marks}</span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <div className="p-8 border-t border-black/5 bg-[#F5F5F0]/50 shrink-0">
                <button 
                  onClick={handleCloseModal}
                  className="w-full py-4 bg-black text-white rounded-2xl font-bold hover:bg-black/80 transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-6 py-12 border-t border-black/5 text-center">
        <p className="text-sm text-black/40">
          Powered by Gemini AI • Built for Students
        </p>
      </footer>
    </div>
  );
}
