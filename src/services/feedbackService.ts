import { FeedbackFormInput, FeedbackReport, FeedbackStatus, TechnicalContext } from '../types';

export function detectTechnicalContext(currentPage: string = window.location.pathname): TechnicalContext {
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown';
  
  // Detect Browser
  let browser = 'Unknown Browser';
  if (/edg/i.test(userAgent)) {
    browser = 'Microsoft Edge';
  } else if (/chrome|crios/i.test(userAgent) && !/opr|opera/i.test(userAgent)) {
    browser = 'Google Chrome';
  } else if (/firefox|fxios/i.test(userAgent)) {
    browser = 'Mozilla Firefox';
  } else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) {
    browser = 'Apple Safari';
  } else if (/opr|opera/i.test(userAgent)) {
    browser = 'Opera';
  }

  // Detect OS
  let os = 'Unknown OS';
  if (/windows/i.test(userAgent)) {
    os = 'Windows';
  } else if (/macintosh|mac os x/i.test(userAgent)) {
    os = 'macOS';
  } else if (/android/i.test(userAgent)) {
    os = 'Android';
  } else if (/iphone|ipad|ipod/i.test(userAgent)) {
    os = 'iOS';
  } else if (/linux/i.test(userAgent)) {
    os = 'Linux';
  }

  // Screen resolution
  const screenResolution = typeof window !== 'undefined'
    ? `${window.screen.width} x ${window.screen.height} (Viewport: ${window.innerWidth} x ${window.innerHeight})`
    : 'Unknown';

  return {
    browser,
    os,
    screenResolution,
    appVersion: '1.2.0',
    currentPage,
    timestamp: new Date().toISOString()
  };
}

export async function submitFeedback(input: FeedbackFormInput): Promise<{
  success: boolean;
  id: string;
  message: string;
  report: FeedbackReport;
}> {
  const res = await fetch('/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to submit feedback. Please try again.');
  }
  return data;
}

export async function getFeedbackList(params?: {
  type?: string;
  status?: string;
  search?: string;
}): Promise<{ reports: FeedbackReport[] }> {
  const query = new URLSearchParams();
  if (params?.type && params.type !== 'all') query.set('type', params.type);
  if (params?.status && params.status !== 'all') query.set('status', params.status);
  if (params?.search) query.set('search', params.search);

  const res = await fetch(`/api/feedback?${query.toString()}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to retrieve feedback list.');
  }
  return data;
}

export async function getFeedbackStats(): Promise<{
  stats: {
    total: number;
    bugReports: number;
    featureRequests: number;
    generalFeedback: number;
    otherFeedback: number;
    openBugs: number;
    inProgress: number;
    fixed: number;
    closed: number;
  };
}> {
  const res = await fetch('/api/feedback/stats');
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to retrieve feedback stats.');
  }
  return data;
}

export async function updateFeedbackStatus(
  id: string,
  status?: FeedbackStatus,
  internalNotes?: string
): Promise<{ success: boolean; report: FeedbackReport }> {
  const res = await fetch(`/api/feedback/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, internalNotes })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update feedback status.');
  }
  return data;
}
