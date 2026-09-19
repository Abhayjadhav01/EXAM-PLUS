import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { FeedbackReport, FeedbackStatus, FeedbackType } from '../../src/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const FEEDBACK_FILE = path.join(DATA_DIR, 'feedback.json');
const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'feedback');

// In-memory rate limiting map: ip -> timestamps[]
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 mins
const MAX_REQUESTS_PER_WINDOW = 20;

// Allowed image MIME types and magic headers
const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_ATTACHMENTS = 4;

function ensureDirectories() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  if (!fs.existsSync(FEEDBACK_FILE)) {
    fs.writeFileSync(FEEDBACK_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

ensureDirectories();

function readFeedbackData(): FeedbackReport[] {
  try {
    ensureDirectories();
    const content = fs.readFileSync(FEEDBACK_FILE, 'utf-8');
    return JSON.parse(content || '[]');
  } catch (err) {
    console.error('Error reading feedback file:', err);
    return [];
  }
}

function writeFeedbackData(data: FeedbackReport[]): void {
  try {
    ensureDirectories();
    const tempFile = `${FEEDBACK_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, FEEDBACK_FILE);
  } catch (err) {
    console.error('Error writing feedback file:', err);
  }
}

/**
 * Generate sequential, unique ID: FB-2026-00001
 */
function generateFeedbackId(existing: FeedbackReport[]): string {
  const currentYear = new Date().getFullYear();
  const prefix = `FB-${currentYear}-`;
  
  let maxSeq = 0;
  for (const item of existing) {
    if (item.id && item.id.startsWith(prefix)) {
      const numPart = parseInt(item.id.replace(prefix, ''), 10);
      if (!isNaN(numPart) && numPart > maxSeq) {
        maxSeq = numPart;
      }
    }
  }

  const nextSeq = String(maxSeq + 1).padStart(5, '0');
  return `${prefix}${nextSeq}`;
}

/**
 * Validates image header magic bytes
 */
function validateImageMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 12) return false;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (mimeType === 'image/png') {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }

  // JPEG: FF D8 FF
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  // WebP: 52 49 46 46 (RIFF) ... 57 45 42 50 (WEBP)
  if (mimeType === 'image/webp') {
    const isRiff =
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
    const isWebp =
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
    return isRiff && isWebp;
  }

  return false;
}

/**
 * Text token similarity for duplicate bug detection
 */
function extractTokens(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);
  return new Set(words);
}

function calculateSimilarity(textA: string, textB: string): number {
  const tokensA = extractTokens(textA);
  const tokensB = extractTokens(textB);
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }

  const union = new Set([...tokensA, ...tokensB]).size;
  return union === 0 ? 0 : intersection / union;
}

function findSimilarReports(newReport: { subject: string; description: string; whatHappened?: string }, existing: FeedbackReport[]): string[] {
  const newCombined = `${newReport.subject} ${newReport.description} ${newReport.whatHappened || ''}`;
  const similarIds: string[] = [];

  for (const report of existing) {
    if (report.feedbackType !== 'bug') continue;
    const existingCombined = `${report.subject} ${report.description} ${report.whatHappened || ''}`;
    const similarity = calculateSimilarity(newCombined, existingCombined);
    if (similarity >= 0.28) {
      similarIds.push(report.id);
    }
  }

  return similarIds;
}

export async function handleSubmitFeedback(req: Request, res: Response) {
  try {
    // 1. Rate Limiting check
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const timestamps = rateLimitMap.get(clientIp) || [];
    const recentTimestamps = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    
    if (recentTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
      return res.status(429).json({
        error: 'Too many feedback submissions. Please wait a few minutes before submitting again.'
      });
    }
    recentTimestamps.push(now);
    rateLimitMap.set(clientIp, recentTimestamps);

    // 2. Validate payload
    const {
      feedbackType,
      name,
      email,
      subject,
      description,
      whatHappened,
      expectedBehavior,
      stepsToReproduce,
      attachments,
      technicalContext
    } = req.body;

    if (!subject || typeof subject !== 'string' || subject.trim().length === 0) {
      return res.status(400).json({ error: 'Subject is required.' });
    }
    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return res.status(400).json({ error: 'Description is required.' });
    }

    const validTypes: FeedbackType[] = ['general', 'bug', 'feature', 'other'];
    const type: FeedbackType = validTypes.includes(feedbackType) ? feedbackType : 'general';

    // 3. Process attachments
    const existingReports = readFeedbackData();
    const feedbackId = generateFeedbackId(existingReports);
    const feedbackDir = path.join(UPLOADS_DIR, feedbackId);

    const savedAttachments: { name: string; size: number; type: string; url: string }[] = [];

    if (Array.isArray(attachments) && attachments.length > 0) {
      if (attachments.length > MAX_ATTACHMENTS) {
        return res.status(400).json({
          error: `You can upload at most ${MAX_ATTACHMENTS} screenshots.`
        });
      }

      if (!fs.existsSync(feedbackDir)) {
        fs.mkdirSync(feedbackDir, { recursive: true });
      }

      for (let i = 0; i < attachments.length; i++) {
        const att = attachments[i];
        if (!att || !att.dataUrl || !att.name) continue;

        // Verify size limit
        if (att.size && att.size > MAX_FILE_SIZE_BYTES) {
          return res.status(400).json({
            error: `File "${att.name}" exceeds the 5MB size limit.`
          });
        }

        // Parse base64 DataURL
        const matches = att.dataUrl.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
          return res.status(400).json({
            error: `Invalid image data format for "${att.name}".`
          });
        }

        const mimeType = matches[1].toLowerCase();
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, 'base64');

        if (buffer.length > MAX_FILE_SIZE_BYTES) {
          return res.status(400).json({
            error: `File "${att.name}" exceeds the 5MB limit.`
          });
        }

        // Check allowed MIME
        if (!ALLOWED_MIME_TYPES.has(mimeType)) {
          return res.status(400).json({
            error: `File "${att.name}" has unsupported format ${mimeType}. Allowed: PNG, JPG, JPEG, WEBP.`
          });
        }

        // Check magic bytes
        if (!validateImageMagicBytes(buffer, mimeType)) {
          return res.status(400).json({
            error: `File "${att.name}" is corrupted or contains an invalid image signature.`
          });
        }

        // Generate safe unique filename
        const ext = path.extname(att.name).toLowerCase() || (mimeType === 'image/png' ? '.png' : mimeType === 'image/webp' ? '.webp' : '.jpg');
        if (!ALLOWED_EXTENSIONS.has(ext)) {
          return res.status(400).json({
            error: `Invalid file extension "${ext}".`
          });
        }

        const safeBaseName = path.basename(att.name, ext).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
        const uniqueFileName = `screenshot_${i + 1}_${safeBaseName}${ext}`;
        const filePath = path.join(feedbackDir, uniqueFileName);

        fs.writeFileSync(filePath, buffer);

        savedAttachments.push({
          name: att.name,
          size: buffer.length,
          type: mimeType,
          url: `/api/feedback/attachments/${feedbackId}/${uniqueFileName}`
        });
      }
    }

    // 4. Duplicate bug detection
    const similarReportIds = type === 'bug'
      ? findSimilarReports({ subject, description, whatHappened }, existingReports)
      : [];

    // 5. Create final record
    const newReport: FeedbackReport = {
      id: feedbackId,
      feedbackType: type,
      name: name ? String(name).trim().slice(0, 100) : undefined,
      email: email ? String(email).trim().slice(0, 100) : undefined,
      subject: subject.trim().slice(0, 200),
      description: description.trim().slice(0, 5000),
      whatHappened: whatHappened ? String(whatHappened).trim().slice(0, 2000) : undefined,
      expectedBehavior: expectedBehavior ? String(expectedBehavior).trim().slice(0, 2000) : undefined,
      stepsToReproduce: Array.isArray(stepsToReproduce) 
        ? stepsToReproduce.filter(s => typeof s === 'string' && s.trim().length > 0).map(s => s.trim().slice(0, 500))
        : undefined,
      attachments: savedAttachments,
      technicalContext: {
        browser: technicalContext?.browser || 'Unknown',
        os: technicalContext?.os || 'Unknown',
        screenResolution: technicalContext?.screenResolution || 'Unknown',
        appVersion: technicalContext?.appVersion || '1.0.0',
        currentPage: technicalContext?.currentPage || '/',
        timestamp: technicalContext?.timestamp || new Date().toISOString()
      },
      status: 'New',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      similarReportIds
    };

    // Prepend new report
    existingReports.unshift(newReport);
    writeFeedbackData(existingReports);

    return res.status(201).json({
      success: true,
      id: feedbackId,
      message: 'Feedback submitted successfully! Thank you for helping us improve PYQ Analyzer.',
      report: newReport
    });
  } catch (error: any) {
    console.error('Error submitting feedback:', error);
    return res.status(500).json({
      error: 'Unable to submit feedback. Please check your connection and try again.',
      details: error.message || String(error)
    });
  }
}

export async function handleGetFeedbackList(req: Request, res: Response) {
  try {
    const { type, status, search } = req.query;
    let reports = readFeedbackData();

    if (type && type !== 'all') {
      reports = reports.filter(r => r.feedbackType === type);
    }
    if (status && status !== 'all') {
      reports = reports.filter(r => r.status === status);
    }
    if (search && typeof search === 'string' && search.trim().length > 0) {
      const q = search.toLowerCase();
      reports = reports.filter(r =>
        r.id.toLowerCase().includes(q) ||
        r.subject.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        (r.name && r.name.toLowerCase().includes(q)) ||
        (r.email && r.email.toLowerCase().includes(q))
      );
    }

    return res.json({ reports });
  } catch (error: any) {
    console.error('Error fetching feedback list:', error);
    return res.status(500).json({ error: 'Failed to fetch feedback list' });
  }
}

export async function handleGetFeedbackStats(req: Request, res: Response) {
  try {
    const reports = readFeedbackData();
    const stats = {
      total: reports.length,
      bugReports: reports.filter(r => r.feedbackType === 'bug').length,
      featureRequests: reports.filter(r => r.feedbackType === 'feature').length,
      generalFeedback: reports.filter(r => r.feedbackType === 'general').length,
      otherFeedback: reports.filter(r => r.feedbackType === 'other').length,
      openBugs: reports.filter(r => r.feedbackType === 'bug' && r.status === 'New').length,
      inProgress: reports.filter(r => r.status === 'In Progress' || r.status === 'Under Review').length,
      fixed: reports.filter(r => r.status === 'Fixed').length,
      closed: reports.filter(r => r.status === 'Closed').length
    };
    return res.json({ stats });
  } catch (error: any) {
    console.error('Error fetching feedback stats:', error);
    return res.status(500).json({ error: 'Failed to fetch feedback statistics' });
  }
}

export async function handleGetFeedbackById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const reports = readFeedbackData();
    const report = reports.find(r => r.id === id);
    if (!report) {
      return res.status(404).json({ error: 'Feedback report not found' });
    }
    return res.json({ report });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch feedback report' });
  }
}

export async function handleUpdateFeedbackStatus(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { status, internalNotes } = req.body;

    const validStatuses: FeedbackStatus[] = ['New', 'Under Review', 'In Progress', 'Fixed', 'Closed'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid feedback status.' });
    }

    const reports = readFeedbackData();
    const index = reports.findIndex(r => r.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Feedback report not found' });
    }

    if (status) {
      reports[index].status = status;
    }
    if (internalNotes !== undefined) {
      reports[index].internalNotes = String(internalNotes);
    }
    reports[index].updatedAt = new Date().toISOString();

    writeFeedbackData(reports);
    return res.json({ success: true, report: reports[index] });
  } catch (error: any) {
    console.error('Error updating feedback status:', error);
    return res.status(500).json({ error: 'Failed to update feedback status' });
  }
}

export async function handleServeAttachment(req: Request, res: Response) {
  try {
    const { feedbackId, filename } = req.params;

    // Guard against path traversal attacks
    if (feedbackId.includes('..') || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid path' });
    }

    const filePath = path.join(UPLOADS_DIR, feedbackId, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp'
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(filePath);
  } catch (error: any) {
    console.error('Error serving attachment:', error);
    return res.status(500).json({ error: 'Failed to serve attachment' });
  }
}
