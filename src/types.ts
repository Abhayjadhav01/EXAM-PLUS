export interface AnswerSection {
  title: string;
  content: string;
  type: 'text' | 'diagram' | 'example' | 'table' | 'summary';
}

export interface Question {
  id: string;
  text: string;
  marks: number;
  unit?: string;
  topic?: string;
  rephrasings?: string[];
  repetitionCount: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  isConceptual?: boolean;
  probabilityScore?: number; // Predicted exam probability percentage (e.g. 92)
  importance?: 'HIGH' | 'MEDIUM' | 'LOW'; // Prioritized importance
  sourcePapers: string[]; // Names of papers where this question appeared
  sourceReferences?: string[]; // Specific references like "2023 Q1 c"
  linkedQuestionIds?: string[]; // IDs of questions that are rephrased versions of this one
  answer?: string;
  answerSections?: AnswerSection[];
  shortAnswer?: string;
  aiNote?: string;
  marksDistribution: {
    point: string;
    marks: number;
  }[];
}

export interface RawQuestion {
  text: string;
  marks: number;
  paperName: string;
  questionReference?: string; // e.g. "Q1 c"
  linkedQuestionIds?: string[]; // IDs of questions that are rephrased versions of this one
  unit?: string;
  topic?: string;
  rephrasings?: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
  isConceptual?: boolean;
  probabilityScore?: number;
  importance?: 'HIGH' | 'MEDIUM' | 'LOW';
  answer?: string;
  answerSections?: AnswerSection[];
  shortAnswer?: string;
  marksDistribution?: {
    point: string;
    marks: number;
  }[];
}

export interface AnalysisResult {
  subject: string;
  institution?: string; // University, College, School name
  academicContext?: string; // Year, Course, Standard (e.g. 3rd Year B.Tech, 12th Grade)
  inferredSyllabus?: string; // Brief description of the syllabus inferred
  metadataConfidence: number; // 0-1 confidence score for metadata extraction
  isSameSubject: boolean;
  questions: Question[]; // Unique questions with repetition info
  rawQuestions: RawQuestion[]; // Every single question from every paper
  summary: string;
  uploadedPapers?: string[]; // Names of the original uploaded papers
  studyStrategy?: string; // Standard study strategy generated for active papers
  predictions?: {
    top10RepeatedQuestions: string[];
    importantTopics: string[];
    nextExamPredictions: string[];
  };
}

export interface UploadedFile {
  file: File;
  preview: string;
  id: string;
}

export type FeedbackType = 'general' | 'bug' | 'feature' | 'other';
export type FeedbackStatus = 'New' | 'Under Review' | 'In Progress' | 'Fixed' | 'Closed';

export interface FeedbackAttachment {
  name: string;
  size: number;
  type: string;
  dataUrl?: string;
  url?: string;
}

export interface TechnicalContext {
  browser: string;
  os: string;
  screenResolution: string;
  appVersion: string;
  currentPage: string;
  timestamp: string;
}

export interface FeedbackReport {
  id: string;
  feedbackType: FeedbackType;
  name?: string;
  email?: string;
  subject: string;
  description: string;
  whatHappened?: string;
  expectedBehavior?: string;
  stepsToReproduce?: string[];
  attachments: {
    name: string;
    size: number;
    type: string;
    url: string;
  }[];
  technicalContext: TechnicalContext;
  status: FeedbackStatus;
  createdAt: string;
  updatedAt: string;
  internalNotes?: string;
  similarReportIds?: string[];
}

export interface FeedbackFormInput {
  feedbackType: FeedbackType;
  name?: string;
  email?: string;
  subject: string;
  description: string;
  whatHappened?: string;
  expectedBehavior?: string;
  stepsToReproduce?: string[];
  attachments: {
    name: string;
    size: number;
    type: string;
    dataUrl: string;
  }[];
  technicalContext: TechnicalContext;
}
