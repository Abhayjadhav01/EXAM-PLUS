import React from 'react';
import { motion } from 'motion/react';
import { Trophy, CheckCircle2 } from 'lucide-react';
import { AnswerSection } from '../types';

interface AnswerRendererProps {
  answer: string;
  sections?: AnswerSection[];
}

// Robust helper to parse markdown tables
function parseMarkdownTable(content: string) {
  const lines = content.trim().split('\n');
  const tableRows: string[][] = [];
  
  for (const line of lines) {
    // Skip divider line e.g., |---|---|
    if (line.includes('|') && /^[|:\-\s]+$/.test(line)) {
      continue;
    }
    if (line.includes('|')) {
      const cells = line.split('|')
        .map(cell => cell.trim())
        .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1); // remove outer empty elements from starting/ending pipes
      
      if (cells.length > 0) {
        tableRows.push(cells);
      } else {
        const looseCells = line.split('|').map(cell => cell.trim());
        if (looseCells.length > 0 && looseCells.some(c => c !== "")) {
          tableRows.push(looseCells);
        }
      }
    }
  }
  
  if (tableRows.length < 2) return null; // Needs at least headers and one row
  
  const headers = tableRows[0];
  const rows = tableRows.slice(1);
  return { headers, rows };
}

// Pre-parse plain text to structure if sections are absent or empty
function parseAnswerText(answer: string): AnswerSection[] {
  if (!answer) return [];
  
  let cleanAnswer = answer;
  const qTypeMatch = answer.match(/QUESTION TYPE DETECTION:[^\n]+/i);
  if (qTypeMatch) {
    cleanAnswer = answer.replace(qTypeMatch[0], "").trim();
    if (cleanAnswer.startsWith("---")) {
      cleanAnswer = cleanAnswer.replace(/^---/, "").trim();
    }
  }

  const lines = cleanAnswer.split("\n");
  const sections: AnswerSection[] = [];
  
  let currentSection: AnswerSection = {
    title: "Introduction",
    content: "",
    type: "text"
  };

  const headerRegex = /^(📘|📊|📍|🧠|🎯|💡|📌|🔄|📖|⚡)\s+([^\n]+)/;

  for (const line of lines) {
    const match = line.match(headerRegex);
    if (match) {
      if (currentSection.content.trim()) {
        sections.push({ ...currentSection });
      }
      
      const emoji = match[1];
      const titleText = match[2].trim();
      
      let secType: 'text' | 'diagram' | 'example' | 'table' | 'summary' = "text";
      if (emoji === "📊" || titleText.toLowerCase().includes("table")) {
        secType = "table";
      } else if (emoji === "🧠" || emoji === "💡" || emoji === "📌") {
        secType = "example"; 
      } else if (emoji === "⚡" || emoji === "🎯") {
        secType = "summary";
      } else if (emoji === "📘") {
        secType = "text";
      }
      
      currentSection = {
        title: `${emoji} ${titleText}`,
        content: "",
        type: secType
      };
    } else {
      currentSection.content += line + "\n";
    }
  }

  if (currentSection.content.trim()) {
    sections.push(currentSection);
  }

  // Dynamic type override checks
  return sections.map(sec => {
    if (sec.type === 'text' && sec.content.includes('|') && sec.content.split('\n').filter(l => l.includes('|')).length >= 2) {
      return { ...sec, type: 'table' };
    }
    if (sec.type === 'text' && (sec.content.includes('├──') || sec.content.includes('──►') || sec.content.includes('│'))) {
      return { ...sec, type: 'diagram' };
    }
    return sec;
  });
}

export const AnswerRenderer: React.FC<AnswerRendererProps> = ({ answer, sections: providedSections }) => {
  // Use provided sections if available, else parse answer text dynamically
  const sections = (providedSections && providedSections.length > 0) 
    ? providedSections 
    : parseAnswerText(answer);

  // Extract Question Type header if present in raw answer
  const qTypeMatch = answer ? answer.match(/QUESTION TYPE DETECTION:\s*([^\n]+)/i) : null;
  const detectedQuestionType = qTypeMatch ? qTypeMatch[1].trim() : null;

  if (sections.length === 0) {
    return (
      <div className="text-slate-500 italic text-sm p-4">
        No structured study content generated yet.
      </div>
    );
  }

  return (
    <div className="space-y-10" id="answer-compiled-container">
      {/* Premium Topper Note Watermark/Badge & Table of Contents Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-6">
        {detectedQuestionType && (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100/60 rounded-2xl px-5 py-3 w-fit text-emerald-800 animate-fade-in" id="topper-note-badge">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-black uppercase tracking-[0.15em] font-mono">
              {detectedQuestionType}
            </span>
            <span className="text-emerald-300 font-normal">|</span>
            <Trophy size={13} className="text-amber-500" />
            <span className="text-[11px] font-extrabold text-amber-800">
              Premium Study Note
            </span>
          </div>
        )}
        
        {/* Compact navigation label */}
        <div className="text-xs text-slate-400 font-medium font-mono select-none self-end sm:self-auto">
          Exam Plus AI Presentation Engine v2
        </div>
      </div>

      {/* Dynamic Interactive Contents Navigation */}
      {sections.length >= 3 && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-50/70 border border-slate-100/80 rounded-3xl p-6 space-y-4 shadow-2xs"
          id="contents-nav-bar"
        >
          <div className="flex items-center gap-2 text-slate-500 select-none">
            <span className="text-[10px] uppercase font-black tracking-widest font-mono">Contents Directory</span>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {sections.map((sec, idx) => {
              const cleanTitle = sec.title
                .replace(/^(📘|📊|📍|🧠|🎯|💡|📌|🔄|📖|⚡|🖼)\s*/, "")
                .trim();
              const icon = sec.title.match(/^(📘|📊|📍|🧠|🎯|💡|📌|🔄|📖|⚡|🖼)/)?.[0] || "📍";
              return (
                <button
                  key={idx}
                  onClick={() => {
                    const el = document.getElementById(`section-card-${idx}`);
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      // Visually highlight section card temporarily
                      el.classList.add('ring-2', 'ring-emerald-400', 'ring-offset-2');
                      setTimeout(() => {
                        el.classList.remove('ring-2', 'ring-emerald-400', 'ring-offset-2');
                      }, 1800);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-emerald-50/40 border border-slate-100 hover:border-emerald-200 rounded-full text-xs font-black text-slate-700 hover:text-emerald-800 shadow-3xs cursor-pointer transition-all duration-200 select-none hover:scale-[1.02]"
                >
                  <span className="opacity-80 shrink-0">{icon}</span>
                  <span className="truncate max-w-[150px]">{cleanTitle}</span>
                </button>
              );
            })}
          </div>
        </motion.div>
      )}

      <div className="space-y-12">
      {sections.map((section, sectionIdx) => {
        const titleWithoutEmoji = section.title
          .replace(/^(📘|📊|📍|🧠|🎯|💡|📌|🔄|📖|⚡|🖼)\s*/, "")
          .trim();
        const sectionIcon = section.title.match(/^(📘|📊|📍|🧠|🎯|💡|📌|🔄|📖|⚡|🖼)/)?.[0] || "📍";

        let sectionElement = null;

        // Render sections based on their visual content block types to eliminate raw Markdown.
        switch (section.type) {
          case 'table': {
            const tableData = parseMarkdownTable(section.content);
            if (tableData) {
              return (
                <motion.div 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: sectionIdx * 0.05 }}
                  key={sectionIdx} 
                  id={`section-card-${sectionIdx}`}
                  className="space-y-4 p-1 rounded-3xl transition-all duration-300"
                >
                  <h3 className="text-base font-black text-slate-800 flex items-center gap-2.5 font-heading">
                    <span className="text-xl shrink-0">{sectionIcon}</span>
                    <span>{titleWithoutEmoji}</span>
                  </h3>
                  
                  {/* Clean rendered interactive table */}
                  <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-100 text-left">
                        <thead className="bg-slate-50/70 text-slate-700 font-extrabold text-xs uppercase tracking-wider font-sans">
                          <tr>
                            {tableData.headers.map((h, i) => (
                              <th key={i} className="px-6 py-4 font-black text-slate-600 border-b border-slate-100">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-sm text-slate-700">
                          {tableData.rows.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-slate-50/40 transition-colors">
                              {row.map((cell, cIdx) => (
                                <td key={cIdx} className="px-6 py-4 leading-normal font-medium text-slate-800">
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </motion.div>
              );
            }
            // If table parse fails, fall through to text block
            break;
          }

          case 'diagram': {
            return (
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: sectionIdx * 0.05 }}
                key={sectionIdx} 
                id={`section-card-${sectionIdx}`}
                className="space-y-4 p-1 rounded-3xl transition-all duration-300"
              >
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2.5 font-heading">
                  <span className="text-xl shrink-0">{sectionIcon}</span>
                  <span>{titleWithoutEmoji}</span>
                </h3>

                {/* Micro schematic blueprint sketch representation */}
                <div className="bg-[#FAF9F6] border border-slate-200/60 rounded-3xl p-6 relative overflow-hidden shadow-xs">
                  {/* Header dots decor */}
                  <div className="flex items-center gap-1.5 mb-4 px-1 text-slate-400 select-none">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-400/40" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400/40" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/40" />
                    <span className="text-[9px] uppercase font-bold tracking-widest text-slate-400 font-mono ml-2">Schematic Canvas</span>
                  </div>

                  <div className="overflow-x-auto w-full">
                    <pre className="font-mono text-xs text-slate-700 leading-relaxed py-1 block w-max select-all whitespace-pre">
                      {section.content.trim()}
                    </pre>
                  </div>
                </div>
              </motion.div>
            );
          }

          case 'example': {
            // Stylized rich callouts for mnemonics or industry cases
            const isMemoryTrick = sectionIcon === "🧠" || section.title.toLowerCase().includes("memory") || section.title.toLowerCase().includes("mnemonic");
            const isExample = sectionIcon === "💡" || section.title.toLowerCase().includes("example");
            const isApplication = sectionIcon === "📌" || section.title.toLowerCase().includes("app");

            let cardBg = "bg-slate-50/50 border-slate-100";
            let accentText = "text-slate-800";
            let bulletColor = "bg-slate-400";

            if (isMemoryTrick) {
              cardBg = "bg-amber-50/30 border-amber-200/40";
              accentText = "text-amber-900";
              bulletColor = "bg-amber-500";
            } else if (isExample) {
              cardBg = "bg-indigo-50/30 border-indigo-100/60";
              accentText = "text-indigo-900";
              bulletColor = "bg-indigo-600";
            } else if (isApplication) {
              cardBg = "bg-emerald-50/30 border-emerald-100/60";
              accentText = "text-emerald-900";
              bulletColor = "bg-emerald-600";
            }

            return (
              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: sectionIdx * 0.05 }}
                key={sectionIdx} 
                id={`section-card-${sectionIdx}`}
                className={`p-6 sm:p-8 rounded-3xl border ${cardBg} space-y-4 transition-all duration-300`}
              >
                <h4 className={`text-sm sm:text-base font-extrabold ${accentText} flex items-center gap-2.5 font-heading`}>
                  <span className="text-xl shrink-0">{sectionIcon}</span>
                  <span>{titleWithoutEmoji}</span>
                </h4>
                <div className={`text-slate-700 leading-relaxed text-[14.5px] whitespace-pre-wrap font-sans space-y-2`}>
                  {section.content.trim().split("\n").map((line, idx) => {
                    const cleanLine = line.replace(/^(\s*[-•*]\s*)/, "").trim();
                    if (line.match(/^\s*[-•*]/)) {
                      return (
                        <div key={idx} className="flex items-start gap-3 pl-1 py-0.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${bulletColor} mt-2.5 shrink-0`} />
                          <span>{cleanLine}</span>
                        </div>
                      );
                    }
                    if (line.trim() === '') return <div key={idx} className="h-2" />;
                    return <p key={idx}>{line}</p>;
                  })}
                </div>
              </motion.div>
            );
          }

          case 'summary': {
            // Elegant exam recap sheet highlights
            return (
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: sectionIdx * 0.05 }}
                key={sectionIdx} 
                id={`section-card-${sectionIdx}`}
                className="bg-emerald-50/20 border border-emerald-500/10 rounded-[28px] p-8 shadow-xs space-y-6 transition-all duration-300"
              >
                <div className="flex items-center justify-between border-b border-emerald-500/5 pb-4">
                  <h3 className="text-base font-black text-emerald-800 flex items-center gap-2.5 font-heading">
                    <span className="text-xl shrink-0">{sectionIcon}</span>
                    <span>{titleWithoutEmoji}</span>
                  </h3>
                  <span className="text-[10px] uppercase font-black tracking-widest text-emerald-600/70 py-1 px-3 bg-emerald-50 rounded-full font-mono">
                    Last Minute Prep
                  </span>
                </div>

                <div className="space-y-3.5 text-slate-700 font-medium text-[14px]">
                  {section.content.trim().split("\n").map((line, idx) => {
                    const cleanLine = line.replace(/^\s*[-•*]\s*/, "").replace(/^⚡\s*/, "").trim();
                    if (cleanLine === "") return null;
                    return (
                      <div key={idx} className="flex items-start gap-4">
                        <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                        <span className="leading-relaxed">{cleanLine}</span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            );
          }

          default: {
            // Normal academic text components
            return (
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: sectionIdx * 0.05 }}
                key={sectionIdx} 
                id={`section-card-${sectionIdx}`}
                className="space-y-3 p-1 rounded-3xl transition-all duration-300"
              >
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2.5 font-heading">
                  <span className="text-xl shrink-0">{sectionIcon}</span>
                  <span>{titleWithoutEmoji}</span>
                </h3>
                <div className="text-slate-700 leading-relaxed text-[14.5px] space-y-3">
                  {section.content.trim().split("\n").map((line, idx) => {
                    const subHeaderColors: Record<string, { bg: string, text: string, border: string, icon: string, label: string }> = {
                      "meaning:": { bg: "bg-teal-50", text: "text-teal-800 border-teal-100/80", border: "border-teal-500/20", icon: "📘", label: "Meaning" },
                      "concept:": { bg: "bg-teal-50", text: "text-teal-800 border-teal-100/80", border: "border-teal-500/20", icon: "📘", label: "Concept" },
                      "detailed explanation:": { bg: "bg-indigo-50", text: "text-indigo-800 border-indigo-100/80", border: "border-indigo-500/20", icon: "⚙", label: "Detailed Explanation" },
                      "why it is needed:": { bg: "bg-violet-50", text: "text-violet-800 border-violet-100/80", border: "border-violet-500/20", icon: "🎯", label: "Why Needed" },
                      "why needed:": { bg: "bg-violet-50", text: "text-violet-800 border-violet-100/80", border: "border-violet-500/20", icon: "🎯", label: "Why Needed" },
                      "why it is used:": { bg: "bg-purple-50", text: "text-purple-800 border-purple-100/80", border: "border-purple-500/20", icon: "🛠", label: "Why It Is Used" },
                      "purpose:": { bg: "bg-sky-50", text: "text-sky-800 border-sky-100/80", border: "border-sky-500/20", icon: "🎯", label: "Purpose" },
                      "how it works:": { bg: "bg-emerald-50", text: "text-emerald-800 border-emerald-100/80", border: "border-emerald-500/30", icon: "🔄", label: "How It Works" },
                      "working:": { bg: "bg-emerald-50", text: "text-emerald-800 border-emerald-100/80", border: "border-emerald-500/30", icon: "🔄", label: "Working" },
                      "working principle:": { bg: "bg-emerald-50", text: "text-emerald-800 border-emerald-100/80", border: "border-emerald-500/30", icon: "🔄", label: "Working Principle" },
                      "why it is important:": { bg: "bg-amber-50", text: "text-amber-800 border-amber-100/80", border: "border-amber-500/20", icon: "⚡", label: "Why Important" },
                      "why important:": { bg: "bg-amber-50", text: "text-amber-800 border-amber-100/80", border: "border-amber-500/20", icon: "⚡", label: "Why Important" },
                      "benefits:": { bg: "bg-pink-50", text: "text-pink-800 border-pink-100/80", border: "border-pink-500/20", icon: "🛡", label: "Benefits" },
                      "benefit:": { bg: "bg-pink-50", text: "text-pink-800 border-pink-100/80", border: "border-pink-500/20", icon: "🛡", label: "Benefit" },
                      "importance:": { bg: "bg-amber-50", text: "text-amber-800 border-amber-100/80", border: "border-amber-500/20", icon: "⚡", label: "Importance" },
                      "use cases:": { bg: "bg-blue-50", text: "text-blue-800 border-blue-100/80", border: "border-blue-500/20", icon: "🚀", label: "Use Cases" },
                      "example:": { bg: "bg-amber-50", text: "text-amber-800 border-amber-100/80", border: "border-amber-500/20", icon: "💡", label: "Example" },
                      "exam relevance:": { bg: "bg-rose-50", text: "text-rose-800 border-rose-100/80", border: "border-rose-500/20", icon: "🛡", label: "Exam Relevance" }
                    };

                    const lowerLine = line.trim().toLowerCase();
                    let matchedKey = "";
                    for (const key of Object.keys(subHeaderColors)) {
                      if (lowerLine.startsWith(key)) {
                        matchedKey = key;
                        break;
                      }
                    }

                    if (matchedKey) {
                      const details = subHeaderColors[matchedKey];
                      const index = lowerLine.indexOf(matchedKey);
                      const contentText = line.substring(index + matchedKey.length).trim();
                      return (
                        <div key={idx} className="mt-2.5 pb-1 select-none flex flex-col gap-1.5 pl-3 border-l-2 border-slate-200">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider font-mono ${details.bg} ${details.text} border w-fit`}>
                            <span>{details.icon}</span>
                            <span>{details.label}</span>
                          </span>
                          {contentText && (
                            <p className="text-[14px] leading-relaxed font-sans font-medium text-slate-700">
                              {contentText}
                            </p>
                          )}
                        </div>
                      );
                    }

                    // Detect if line is a bullet point
                    const isBullet = line.match(/^\s*[-•*]/);
                    // Match visual ordered lines like "1. ", "Step 1: "
                    const isOrdered = line.match(/^\s*(\d+\.|\w+\s+\d+:)/i);

                    const cleanLine = line
                      .replace(/^\s*[-•*]\s*/, "")
                      .replace(/^\s*(\d+\.|\w+\s+\d+:)\s*/, "")
                      .trim();

                    if (cleanLine === "") return <div key={idx} className="h-2" />;

                    if (isBullet) {
                      return (
                        <div key={idx} className="flex items-start gap-3 pl-2 py-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-2.5 shrink-0" />
                          <span className="leading-relaxed font-sans">{cleanLine}</span>
                        </div>
                      );
                    }

                    if (isOrdered) {
                      const prefixMatch = line.match(/^\s*(\d+\.|\w+\s+\d+:)/i)?.[1] || "";
                      return (
                        <div key={idx} className="flex items-start gap-3.5 pl-2 py-1 bg-slate-50/20 px-3 rounded-xl border border-dashed border-slate-100">
                          <span className="font-mono text-xs font-black text-emerald-700 bg-emerald-50 rounded-md px-1.5 py-0.5 mt-0.5 select-none hover:bg-emerald-100 transition-colors">
                            {prefixMatch.trim()}
                          </span>
                          <span className="leading-relaxed font-sans font-medium text-slate-800">{cleanLine}</span>
                        </div>
                      );
                    }

                    return (
                      <p key={idx} className="font-medium text-slate-700">
                        {line}
                      </p>
                    );
                  })}
                </div>
              </motion.div>
            );
          }
        }
        return null;
      })}
      </div>
    </div>
  );
};
