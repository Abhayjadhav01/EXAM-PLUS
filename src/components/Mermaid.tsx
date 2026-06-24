import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: true,
  theme: 'base',
  themeVariables: {
    primaryColor: '#ffffff',
    primaryTextColor: '#141414',
    primaryBorderColor: '#141414',
    lineColor: '#141414',
    secondaryColor: '#f5f5f0',
    tertiaryColor: '#ffffff',
    fontFamily: 'Inter, sans-serif',
    fontSize: '14px',
  },
  securityLevel: 'loose',
});

interface MermaidProps {
  chart: string;
}

export const Mermaid: React.FC<MermaidProps> = ({ chart }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && chart) {
      ref.current.removeAttribute('data-processed');
      mermaid.contentLoaded();
    }
  }, [chart]);

  return (
    <div 
      className="mermaid bg-white p-8 rounded-[32px] border border-black/10 shadow-sm my-8 overflow-x-auto flex justify-center" 
      style={{ 
        backgroundImage: 'radial-gradient(#e5e7eb 1px, transparent 1px)', 
        backgroundSize: '20px 20px' 
      }}
      ref={ref}
    >
      {chart}
    </div>
  );
};
