import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  MessageSquare, 
  Bug, 
  Lightbulb, 
  HelpCircle, 
  UploadCloud, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  Copy, 
  Check, 
  Monitor, 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  Image as ImageIcon 
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { FeedbackType, FeedbackFormInput, TechnicalContext } from '../types';
import { submitFeedback, detectTechnicalContext } from '../services/feedbackService';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: FeedbackType;
  currentPageContext?: string;
  onOpenAdmin?: () => void;
}

interface LocalAttachment {
  file: File;
  name: string;
  size: number;
  type: string;
  dataUrl: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_ATTACHMENTS = 4;
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  initialType = 'bug',
  currentPageContext = '/',
  onOpenAdmin
}) => {
  const [feedbackType, setFeedbackType] = useState<FeedbackType>(initialType);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');

  // Bug-specific fields
  const [whatHappened, setWhatHappened] = useState('');
  const [expectedBehavior, setExpectedBehavior] = useState('');
  const [stepsToReproduce, setStepsToReproduce] = useState<string[]>(['', '']);

  // Screenshots state
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  // Technical context
  const [technicalContext, setTechnicalContext] = useState<TechnicalContext | null>(null);
  const [showTechDetails, setShowTechDetails] = useState(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  // Initialize technical context on open
  useEffect(() => {
    if (isOpen) {
      setTechnicalContext(detectTechnicalContext(currentPageContext));
      setFeedbackType(initialType);
      setSubmitError(null);
    }
  }, [isOpen, currentPageContext, initialType]);

  // Dropzone setup
  const onDrop = (acceptedFiles: File[]) => {
    setAttachmentError(null);
    if (attachments.length + acceptedFiles.length > MAX_ATTACHMENTS) {
      setAttachmentError(`You can upload at most ${MAX_ATTACHMENTS} screenshots.`);
      return;
    }

    for (const file of acceptedFiles) {
      if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
        setAttachmentError(`Unsupported format for "${file.name}". Please use PNG, JPG, or WEBP.`);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setAttachmentError(`File "${file.name}" exceeds the 5MB size limit.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        setAttachments(prev => [
          ...prev,
          {
            file,
            name: file.name,
            size: file.size,
            type: file.type,
            dataUrl: reader.result as string
          }
        ]);
      };
      reader.readAsDataURL(file);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/webp': ['.webp']
    },
    maxSize: MAX_FILE_SIZE,
    disabled: attachments.length >= MAX_ATTACHMENTS || isSubmitting
  });

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const addReproductionStep = () => {
    if (stepsToReproduce.length < 6) {
      setStepsToReproduce(prev => [...prev, '']);
    }
  };

  const updateReproductionStep = (index: number, val: string) => {
    setStepsToReproduce(prev => {
      const copy = [...prev];
      copy[index] = val;
      return copy;
    });
  };

  const removeReproductionStep = (index: number) => {
    setStepsToReproduce(prev => prev.filter((_, i) => i !== index));
  };

  const handleCopyId = () => {
    if (submittedId) {
      navigator.clipboard.writeText(submittedId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const resetForm = () => {
    setSubject('');
    setDescription('');
    setWhatHappened('');
    setExpectedBehavior('');
    setStepsToReproduce(['', '']);
    setAttachments([]);
    setAttachmentError(null);
    setSubmitError(null);
    setSubmittedId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!subject.trim()) {
      setSubmitError('Please enter a brief subject for your feedback.');
      return;
    }
    if (!description.trim()) {
      setSubmitError('Please provide a description of your feedback or issue.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: FeedbackFormInput = {
        feedbackType,
        name: name.trim() || undefined,
        email: email.trim() || undefined,
        subject: subject.trim(),
        description: description.trim(),
        whatHappened: feedbackType === 'bug' && whatHappened.trim() ? whatHappened.trim() : undefined,
        expectedBehavior: feedbackType === 'bug' && expectedBehavior.trim() ? expectedBehavior.trim() : undefined,
        stepsToReproduce: feedbackType === 'bug' 
          ? stepsToReproduce.filter(s => s.trim().length > 0)
          : undefined,
        attachments: attachments.map(a => ({
          name: a.name,
          size: a.size,
          type: a.type,
          dataUrl: a.dataUrl
        })),
        technicalContext: technicalContext || detectTechnicalContext(currentPageContext)
      };

      const result = await submitFeedback(payload);
      setSubmittedId(result.id);
    } catch (err: any) {
      console.error('Submission failed:', err);
      setSubmitError(err.message || 'Unable to submit feedback. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-slate-950/75 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-700 flex items-center justify-center border border-emerald-500/20">
                <MessageSquare size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 leading-tight">
                  Feedback & Bug Reporting
                </h3>
                <p className="text-xs text-slate-500">
                  Help us refine PYQ Analyzer. We review every submission.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onOpenAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAdmin();
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-emerald-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
                  title="View Submitted Reports"
                >
                  Admin Desk
                </button>
              )}
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="overflow-y-auto px-6 py-5 space-y-6 flex-1 text-slate-800 text-sm">
            {submittedId ? (
              /* Success View */
              <div className="py-8 px-4 text-center space-y-6">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-3xl mx-auto flex items-center justify-center shadow-inner">
                  <CheckCircle2 size={36} />
                </div>
                <div className="space-y-2">
                  <h4 className="text-xl font-black text-slate-900">
                    Feedback Submitted Successfully!
                  </h4>
                  <p className="text-slate-600 text-xs max-w-md mx-auto leading-relaxed">
                    Thank you for helping us improve PYQ Analyzer. Our development team will review the issue and technical context to reproduce and fix it.
                  </p>
                </div>

                {/* Reference ID card */}
                <div className="max-w-sm mx-auto p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                  <div className="text-left">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                      Feedback Tracking ID
                    </span>
                    <span className="font-mono text-sm font-bold text-emerald-800">
                      {submittedId}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyId}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-semibold text-slate-700 transition-colors cursor-pointer shadow-xs"
                  >
                    {copiedId ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    {copiedId ? 'Copied' : 'Copy'}
                  </button>
                </div>

                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all cursor-pointer"
                  >
                    Submit Another Report
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              /* Feedback Form */
              <form onSubmit={handleSubmit} className="space-y-5">
                {submitError && (
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-800 text-xs leading-relaxed">
                    <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-bold">Unable to submit feedback</p>
                      <p className="mt-0.5">{submitError}</p>
                    </div>
                  </div>
                )}

                {/* Feedback Type Selector */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                    Feedback Type
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'bug', label: 'Bug Report', icon: Bug, color: 'text-rose-600' },
                      { id: 'general', label: 'General', icon: MessageSquare, color: 'text-blue-600' },
                      { id: 'feature', label: 'Feature Request', icon: Lightbulb, color: 'text-amber-600' },
                      { id: 'other', label: 'Other', icon: HelpCircle, color: 'text-purple-600' },
                    ].map(item => {
                      const Icon = item.icon;
                      const isSelected = feedbackType === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setFeedbackType(item.id as FeedbackType)}
                          className={`flex items-center gap-2 p-3 rounded-2xl border text-xs font-bold transition-all text-left cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-50/80 border-emerald-600 text-emerald-900 shadow-xs ring-1 ring-emerald-600/30'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <Icon size={16} className={isSelected ? 'text-emerald-700' : item.color} />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Optional Name & Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Your Name <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="e.g. Alex"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Email Address <span className="text-slate-400 font-normal">(Optional, for follow-up)</span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="name@university.edu"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/30"
                    />
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Subject <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    placeholder={
                      feedbackType === 'bug'
                        ? 'e.g. PDF extraction problem on multi-page questions'
                        : feedbackType === 'feature'
                        ? 'e.g. Add dark mode or export to Google Drive'
                        : 'e.g. Great experience preparing for engineering maths'
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/30"
                  />
                </div>

                {/* Bug Report Structured Details */}
                {feedbackType === 'bug' && (
                  <div className="p-4 bg-slate-50/90 border border-slate-200 rounded-2xl space-y-4">
                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 block">
                      Bug Details (Helps us reproduce & fix)
                    </span>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        What happened?
                      </label>
                      <input
                        type="text"
                        value={whatHappened}
                        onChange={e => setWhatHappened(e.target.value)}
                        placeholder="e.g. I uploaded a 4-page question paper, but only page 1 was extracted"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        What did you expect?
                      </label>
                      <input
                        type="text"
                        value={expectedBehavior}
                        onChange={e => setExpectedBehavior(e.target.value)}
                        placeholder="e.g. All 15 questions across 4 pages should be identified"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-slate-700">
                          Steps to reproduce:
                        </label>
                        {stepsToReproduce.length < 5 && (
                          <button
                            type="button"
                            onClick={addReproductionStep}
                            className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                          >
                            <Plus size={12} /> Add Step
                          </button>
                        )}
                      </div>
                      <div className="space-y-2">
                        {stepsToReproduce.map((step, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <span className="w-5 text-center text-xs font-mono font-bold text-slate-400">
                              {idx + 1}.
                            </span>
                            <input
                              type="text"
                              value={step}
                              onChange={e => updateReproductionStep(idx, e.target.value)}
                              placeholder={`Step ${idx + 1} (e.g. Click upload -> Select 2024 PDF)`}
                              className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600"
                            />
                            {stepsToReproduce.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeReproductionStep(idx)}
                                className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Describe your feedback or problem <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder={
                      feedbackType === 'bug'
                        ? 'Explain the problem in detail. Include any error messages you saw on screen.'
                        : 'Share your thoughts, suggestions, or general impressions...'
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/30"
                  />
                </div>

                {/* Screenshot Upload (Drag & Drop + Multiple) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <ImageIcon size={14} className="text-slate-500" />
                      Screenshot / Attachments <span className="text-slate-400 font-normal">(Optional, max 4)</span>
                    </label>
                    <span className="text-[10px] text-slate-400">
                      PNG, JPG, WEBP • Max 5MB each
                    </span>
                  </div>

                  {attachments.length < MAX_ATTACHMENTS && (
                    <div
                      {...getRootProps()}
                      className={`border-2 border-dashed rounded-2xl p-4 text-center transition-all cursor-pointer ${
                        isDragActive
                          ? 'border-emerald-600 bg-emerald-50/60'
                          : 'border-slate-300 hover:border-emerald-500 bg-slate-50/60 hover:bg-slate-50'
                      }`}
                    >
                      <input {...getInputProps()} />
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="w-9 h-9 rounded-full bg-slate-200/70 text-slate-600 flex items-center justify-center">
                          <UploadCloud size={18} />
                        </div>
                        <p className="text-xs font-semibold text-slate-700">
                          {isDragActive ? 'Drop screenshot here...' : 'Drag & drop screenshot here, or click to browse'}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Take a screenshot of the issue and drop it directly
                        </p>
                      </div>
                    </div>
                  )}

                  {attachmentError && (
                    <p className="text-xs font-bold text-rose-600 flex items-center gap-1">
                      <AlertCircle size={12} /> {attachmentError}
                    </p>
                  )}

                  {/* Attachment Previews */}
                  {attachments.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                      {attachments.map((att, idx) => (
                        <div
                          key={idx}
                          className="group relative border border-slate-200 rounded-xl p-1.5 bg-slate-50 flex flex-col items-center overflow-hidden"
                        >
                          <img
                            src={att.dataUrl}
                            alt={att.name}
                            className="w-full h-20 object-cover rounded-lg border border-slate-100 mb-1"
                          />
                          <div className="w-full flex items-center justify-between text-[10px] px-1 text-slate-600">
                            <span className="truncate max-w-[80px]" title={att.name}>
                              {att.name}
                            </span>
                            <span className="text-slate-400">
                              {(att.size / 1024).toFixed(0)}KB
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeAttachment(idx)}
                            className="absolute top-2 right-2 w-6 h-6 bg-rose-600 text-white rounded-lg flex items-center justify-center opacity-90 hover:opacity-100 shadow-sm cursor-pointer"
                            title="Remove screenshot"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Privacy Notice */}
                  <div className="p-3 bg-amber-50/70 border border-amber-200/70 rounded-xl text-[11px] text-amber-900 leading-relaxed">
                    <strong>Privacy Notice:</strong> Please don&apos;t upload screenshots containing passwords, API keys, personal IDs, or other sensitive personal information.
                  </div>
                </div>

                {/* Automatic Technical Information disclosure */}
                <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-slate-50/60">
                  <button
                    type="button"
                    onClick={() => setShowTechDetails(!showTechDetails)}
                    className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-bold text-slate-700 hover:bg-slate-100/60 transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <Monitor size={14} className="text-slate-500" />
                      Automatic Technical Context Included
                    </span>
                    {showTechDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {showTechDetails && technicalContext && (
                    <div className="px-4 pb-3 pt-1 text-[11px] text-slate-600 space-y-1 border-t border-slate-200/60 font-mono">
                      <div><span className="font-bold text-slate-800">Browser:</span> {technicalContext.browser}</div>
                      <div><span className="font-bold text-slate-800">OS:</span> {technicalContext.os}</div>
                      <div><span className="font-bold text-slate-800">Resolution:</span> {technicalContext.screenResolution}</div>
                      <div><span className="font-bold text-slate-800">Page Context:</span> {technicalContext.currentPage}</div>
                      <div><span className="font-bold text-slate-800">App Version:</span> {technicalContext.appVersion}</div>
                    </div>
                  )}
                </div>

                {/* Footer Submit Button */}
                <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isSubmitting}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50 cursor-pointer flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Submitting Feedback...</span>
                      </>
                    ) : (
                      <span>Submit Feedback</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
