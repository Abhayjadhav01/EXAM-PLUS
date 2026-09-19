import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Search, 
  RefreshCw, 
  Bug, 
  Lightbulb, 
  MessageSquare, 
  HelpCircle, 
  ExternalLink, 
  Calendar, 
  User, 
  Mail, 
  Monitor, 
  AlertTriangle, 
  Save, 
  SlidersHorizontal,
  ChevronRight
} from 'lucide-react';
import { FeedbackReport, FeedbackStatus, FeedbackType } from '../types';
import { getFeedbackList, getFeedbackStats, updateFeedbackStatus } from '../services/feedbackService';

interface FeedbackAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenNewFeedback?: () => void;
}

export const FeedbackAdminModal: React.FC<FeedbackAdminModalProps> = ({
  isOpen,
  onClose,
  onOpenNewFeedback
}) => {
  const [reports, setReports] = useState<FeedbackReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<FeedbackReport | null>(null);
  const [activeTypeTab, setActiveTypeTab] = useState<string>('all');
  const [activeStatusFilter, setActiveStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<{
    total: number;
    bugReports: number;
    featureRequests: number;
    generalFeedback: number;
    otherFeedback: number;
    openBugs: number;
    inProgress: number;
    fixed: number;
    closed: number;
  } | null>(null);

  // Status update state for selected report
  const [newStatus, setNewStatus] = useState<FeedbackStatus>('New');
  const [internalNotes, setInternalNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);

  // Active zoomed screenshot
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [listRes, statsRes] = await Promise.all([
        getFeedbackList({
          type: activeTypeTab,
          status: activeStatusFilter,
          search: searchQuery
        }),
        getFeedbackStats()
      ]);
      setReports(listRes.reports);
      setStats(statsRes.stats);

      // Keep selected report updated if viewing one
      if (selectedReport) {
        const found = listRes.reports.find(r => r.id === selectedReport.id);
        if (found) {
          setSelectedReport(found);
          setNewStatus(found.status);
          setInternalNotes(found.internalNotes || '');
        }
      }
    } catch (err) {
      console.error('Failed to load feedback admin data', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, activeTypeTab, activeStatusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleSelectReport = (r: FeedbackReport) => {
    setSelectedReport(r);
    setNewStatus(r.status);
    setInternalNotes(r.internalNotes || '');
    setUpdateSuccess(false);
  };

  const handleSaveStatus = async () => {
    if (!selectedReport) return;
    setIsUpdating(true);
    try {
      const res = await updateFeedbackStatus(selectedReport.id, newStatus, internalNotes);
      setSelectedReport(res.report);
      setReports(prev => prev.map(item => item.id === res.report.id ? res.report : item));
      setUpdateSuccess(true);
      setTimeout(() => setUpdateSuccess(false), 2500);
      loadData();
    } catch (err) {
      console.error('Failed to update status', err);
    } finally {
      setIsUpdating(false);
    }
  };

  if (!isOpen) return null;

  const getTypeIcon = (type: FeedbackType) => {
    switch (type) {
      case 'bug':
        return <Bug size={14} className="text-rose-600" />;
      case 'feature':
        return <Lightbulb size={14} className="text-amber-600" />;
      case 'general':
        return <MessageSquare size={14} className="text-blue-600" />;
      default:
        return <HelpCircle size={14} className="text-purple-600" />;
    }
  };

  const getStatusBadge = (status: FeedbackStatus) => {
    switch (status) {
      case 'New':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Under Review':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'In Progress':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Fixed':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Closed':
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-slate-950/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          className="relative w-full max-w-6xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-sm">
                FD
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 leading-tight">
                  Feedback & Bug Triage Desk
                </h3>
                <p className="text-xs text-slate-500">
                  Manage user bug reports, feature suggestions, and duplicate issues
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadData}
                disabled={isLoading}
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer"
                title="Refresh Reports"
              >
                <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
              </button>
              {onOpenNewFeedback && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenNewFeedback();
                  }}
                  className="px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-colors cursor-pointer"
                >
                  + New Feedback
                </button>
              )}
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Stats Summary Bar */}
          {stats && (
            <div className="grid grid-cols-3 sm:grid-cols-7 gap-2 px-6 py-3 bg-slate-100/70 border-b border-slate-200 text-xs">
              <div className="p-2 rounded-xl bg-white border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total</span>
                <span className="text-sm font-black text-slate-800">{stats.total}</span>
              </div>
              <div className="p-2 rounded-xl bg-white border border-rose-200">
                <span className="text-[10px] uppercase font-bold text-rose-500 block">Bugs</span>
                <span className="text-sm font-black text-rose-700">{stats.bugReports}</span>
              </div>
              <div className="p-2 rounded-xl bg-white border border-blue-200">
                <span className="text-[10px] uppercase font-bold text-blue-500 block">Open Bugs</span>
                <span className="text-sm font-black text-blue-700">{stats.openBugs}</span>
              </div>
              <div className="p-2 rounded-xl bg-white border border-amber-200">
                <span className="text-[10px] uppercase font-bold text-amber-500 block">Features</span>
                <span className="text-sm font-black text-amber-700">{stats.featureRequests}</span>
              </div>
              <div className="p-2 rounded-xl bg-white border border-purple-200">
                <span className="text-[10px] uppercase font-bold text-purple-500 block">In Progress</span>
                <span className="text-sm font-black text-purple-700">{stats.inProgress}</span>
              </div>
              <div className="p-2 rounded-xl bg-white border border-emerald-200">
                <span className="text-[10px] uppercase font-bold text-emerald-600 block">Fixed</span>
                <span className="text-sm font-black text-emerald-700">{stats.fixed}</span>
              </div>
              <div className="p-2 rounded-xl bg-white border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Closed</span>
                <span className="text-sm font-black text-slate-700">{stats.closed}</span>
              </div>
            </div>
          )}

          {/* Search & Filter Controls */}
          <div className="px-6 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-white">
            {/* Type Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
              {[
                { id: 'all', label: 'All' },
                { id: 'bug', label: 'Bug Reports' },
                { id: 'feature', label: 'Feature Requests' },
                { id: 'general', label: 'General' },
                { id: 'other', label: 'Other' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTypeTab(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    activeTypeTab === tab.id
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Status and Search */}
            <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end">
              <select
                value={activeStatusFilter}
                onChange={e => setActiveStatusFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 border border-slate-200 text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="New">New</option>
                <option value="Under Review">Under Review</option>
                <option value="In Progress">In Progress</option>
                <option value="Fixed">Fixed</option>
                <option value="Closed">Closed</option>
              </select>

              <form onSubmit={handleSearchSubmit} className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search subject, ID..."
                  className="pl-8 pr-3 py-1.5 text-xs bg-slate-100 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white w-40 sm:w-56"
                />
                <Search size={14} className="absolute left-2.5 top-2 text-slate-400" />
              </form>
            </div>
          </div>

          {/* Main Layout: Split List & Detail View */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left Column: Reports List */}
            <div className="w-full sm:w-2/5 border-r border-slate-200 overflow-y-auto divide-y divide-slate-100">
              {reports.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  {isLoading ? 'Loading feedback reports...' : 'No feedback matching filters found.'}
                </div>
              ) : (
                reports.map(item => {
                  const isSelected = selectedReport?.id === item.id;
                  const hasSimilar = item.similarReportIds && item.similarReportIds.length > 0;
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectReport(item)}
                      className={`p-4 transition-all cursor-pointer hover:bg-slate-50 ${
                        isSelected ? 'bg-emerald-50/70 border-l-4 border-l-emerald-600' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          {getTypeIcon(item.feedbackType)}
                          <span className="font-mono text-[11px] font-bold text-slate-500">
                            {item.id}
                          </span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadge(
                            item.status
                          )}`}
                        >
                          {item.status}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-slate-900 line-clamp-1 mb-1">
                        {item.subject}
                      </h4>
                      <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>

                      <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-400">
                        <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                        <div className="flex items-center gap-2">
                          {hasSimilar && (
                            <span className="flex items-center gap-1 text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-bold">
                              <AlertTriangle size={10} /> Duplicate Alert
                            </span>
                          )}
                          {item.attachments?.length > 0 && (
                            <span className="bg-slate-100 px-1.5 py-0.5 rounded font-bold text-slate-600">
                              📷 {item.attachments.length}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Right Column: Selected Report Detail */}
            <div className="hidden sm:flex flex-1 flex-col overflow-y-auto bg-slate-50/50 p-6">
              {selectedReport ? (
                <div className="space-y-6 max-w-2xl">
                  {/* Top Header Card */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(selectedReport.feedbackType)}
                        <span className="text-xs font-mono font-bold text-slate-400">
                          {selectedReport.id}
                        </span>
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                          • {selectedReport.feedbackType}
                        </span>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusBadge(
                          selectedReport.status
                        )}`}
                      >
                        {selectedReport.status}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900">
                      {selectedReport.subject}
                    </h3>

                    {/* Meta info */}
                    <div className="flex flex-wrap gap-4 text-xs text-slate-500 pt-1 border-t border-slate-100">
                      <span className="flex items-center gap-1">
                        <User size={13} className="text-slate-400" />
                        {selectedReport.name || 'Anonymous User'}
                      </span>
                      {selectedReport.email && (
                        <span className="flex items-center gap-1">
                          <Mail size={13} className="text-slate-400" />
                          <a href={`mailto:${selectedReport.email}`} className="text-emerald-700 hover:underline">
                            {selectedReport.email}
                          </a>
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar size={13} className="text-slate-400" />
                        {new Date(selectedReport.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Duplicate Alert Banner */}
                  {selectedReport.similarReportIds && selectedReport.similarReportIds.length > 0 && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-bold">
                        <AlertTriangle size={14} className="text-amber-700" />
                        Recurring Issue Detected ({selectedReport.similarReportIds.length} similar reports)
                      </div>
                      <p className="text-[11px] leading-relaxed text-amber-800">
                        Other users reported problems sharing key terms with this bug. Linked reports:{' '}
                        <span className="font-mono font-semibold">
                          {selectedReport.similarReportIds.join(', ')}
                        </span>
                      </p>
                    </div>
                  )}

                  {/* Description Box */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Description
                    </h5>
                    <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                      {selectedReport.description}
                    </p>
                  </div>

                  {/* Bug Specific Details */}
                  {selectedReport.feedbackType === 'bug' && (
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                      <h5 className="text-xs font-bold uppercase tracking-wider text-rose-700">
                        Bug Diagnostics
                      </h5>

                      {selectedReport.whatHappened && (
                        <div>
                          <span className="text-[11px] font-bold text-slate-500 block">What happened:</span>
                          <p className="text-xs text-slate-800 mt-0.5">{selectedReport.whatHappened}</p>
                        </div>
                      )}

                      {selectedReport.expectedBehavior && (
                        <div>
                          <span className="text-[11px] font-bold text-slate-500 block">What was expected:</span>
                          <p className="text-xs text-slate-800 mt-0.5">{selectedReport.expectedBehavior}</p>
                        </div>
                      )}

                      {selectedReport.stepsToReproduce && selectedReport.stepsToReproduce.length > 0 && (
                        <div>
                          <span className="text-[11px] font-bold text-slate-500 block mb-1">
                            Steps to Reproduce:
                          </span>
                          <ol className="list-decimal list-inside space-y-1 text-xs text-slate-800">
                            {selectedReport.stepsToReproduce.map((s, idx) => (
                              <li key={idx}>{s}</li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Attachments / Screenshots */}
                  {selectedReport.attachments && selectedReport.attachments.length > 0 && (
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                      <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Screenshots ({selectedReport.attachments.length})
                      </h5>
                      <div className="grid grid-cols-2 gap-3">
                        {selectedReport.attachments.map((att, idx) => (
                          <div
                            key={idx}
                            className="group relative border border-slate-200 rounded-xl overflow-hidden bg-slate-50 cursor-pointer"
                            onClick={() => setZoomedImage(att.url)}
                          >
                            <img
                              src={att.url}
                              alt={att.name}
                              className="w-full h-32 object-cover transition-transform group-hover:scale-105"
                            />
                            <div className="p-2 bg-white/95 border-t border-slate-100 flex items-center justify-between text-[10px]">
                              <span className="truncate max-w-[120px] font-medium text-slate-700">
                                {att.name}
                              </span>
                              <span className="text-slate-400">
                                {(att.size / 1024).toFixed(0)} KB
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Technical Environment Details */}
                  {selectedReport.technicalContext && (
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2 text-xs">
                      <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <Monitor size={14} className="text-slate-400" />
                        Technical Environment
                      </h5>
                      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-700 pt-1">
                        <div><span className="text-slate-400">Browser:</span> {selectedReport.technicalContext.browser}</div>
                        <div><span className="text-slate-400">OS:</span> {selectedReport.technicalContext.os}</div>
                        <div><span className="text-slate-400">Resolution:</span> {selectedReport.technicalContext.screenResolution}</div>
                        <div><span className="text-slate-400">Page:</span> {selectedReport.technicalContext.currentPage}</div>
                        <div><span className="text-slate-400">App Version:</span> {selectedReport.technicalContext.appVersion}</div>
                      </div>
                    </div>
                  )}

                  {/* Status & Developer Notes Form */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Update Triage Status & Developer Notes
                    </h5>

                    <div className="flex items-center gap-3">
                      <label className="text-xs font-bold text-slate-700">Status:</label>
                      <select
                        value={newStatus}
                        onChange={e => setNewStatus(e.target.value as FeedbackStatus)}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none cursor-pointer"
                      >
                        <option value="New">New</option>
                        <option value="Under Review">Under Review</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Fixed">Fixed</option>
                        <option value="Closed">Closed</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Internal Notes (Dev team only):
                      </label>
                      <textarea
                        rows={3}
                        value={internalNotes}
                        onChange={e => setInternalNotes(e.target.value)}
                        placeholder="e.g. Investigating OCR parser table formatting issue; scheduled for patch v1.2.1"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      {updateSuccess && (
                        <span className="text-xs font-bold text-emerald-600">
                          ✓ Status & notes updated successfully!
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={handleSaveStatus}
                        disabled={isUpdating}
                        className="ml-auto px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                      >
                        <Save size={14} />
                        {isUpdating ? 'Saving...' : 'Save Updates'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                  Select a feedback report from the left column to review details.
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Screenshot Lightbox / Zoom Modal */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-60 bg-black/90 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setZoomedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-hidden">
            <img
              src={zoomedImage}
              alt="Screenshot Preview"
              className="max-w-full max-h-[85vh] object-contain rounded-xl"
            />
            <button
              onClick={() => setZoomedImage(null)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};
