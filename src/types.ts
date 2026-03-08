export interface Question {
  id: string;
  text: string;
  marks: number;
  unit?: string;
  answer: string;
  marksDistribution: {
    point: string;
    marks: number;
  }[];
}

export interface RepeatedQuestion {
  questionText: string;
  repetitionCount: number;
  relatedQuestionIds: string[];
}

export interface AnalysisResult {
  subject: string;
  isSameSubject: boolean;
  allQuestions: Question[];
  repeatedAnalysis: RepeatedQuestion[];
  summary: string;
}

export interface UploadedFile {
  file: File;
  preview: string;
  id: string;
}
