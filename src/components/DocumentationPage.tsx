import React, { useState } from 'react';
import {
  BookOpen,
  Copy,
  Check,
  Layers,
  Settings,
  ShieldCheck,
  Code,
  Terminal,
  ListOrdered,
  Globe,
  ExternalLink,
} from 'lucide-react';
import { useI18n } from '../i18n/LanguageContext';
import { getDocsContent, type DocsTab } from '../i18n/docsContent';

const TAB_ICONS: Record<DocsTab, React.ComponentType<{ className?: string }>> = {
  overview: BookOpen,
  howto: ListOrdered,
  architecture: Layers,
  features: Settings,
  math: ShieldCheck,
  api: Terminal,
  env: Code,
};

export default function DocumentationPage() {
  const { locale } = useI18n();
  const docs = getDocsContent(locale);
  const [activeTab, setActiveTab] = useState<DocsTab>('overview');
  const [copied, setCopied] = useState(false);

  const tabIds = Object.keys(docs.tabs) as DocsTab[];

  const copyDocumentation = () => {
    navigator.clipboard.writeText(docs.markdownExport);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const section = docs.sections[activeTab];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 select-none" id="lootly_docs_page">
      <div className="bg-gradient-to-r from-slate-900 to-[#0e172e] border border-slate-800/80 rounded-3xl p-6 sm:p-10 mb-8 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl -mr-20 -mt-20" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full text-xs font-semibold text-amber-400 font-mono mb-4 uppercase tracking-wider">
              <BookOpen className="h-3.5 w-3.5" /> /docs
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white font-display tracking-tight leading-tight mb-2">
              {docs.title}
            </h1>
            <p className="text-sm text-slate-400 max-w-2xl font-sans leading-relaxed flex items-center gap-2">
              <Globe className="h-3.5 w-3.5 shrink-0" />
              {docs.subtitle}
            </p>
          </div>
          <button
            onClick={copyDocumentation}
            className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-6 py-3 rounded-2xl transition duration-200 shadow-lg shadow-amber-500/10 cursor-pointer self-start md:self-auto text-sm"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" /> {docs.copied}
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" /> {docs.copyMd}
              </>
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-800/80 pb-4 mb-8">
        {tabIds.map((tabId) => {
          const Icon = TAB_ICONS[tabId];
          return (
            <button
              key={tabId}
              onClick={() => setActiveTab(tabId)}
              className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer flex items-center gap-2 ${
                activeTab === tabId
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
              }`}
            >
              <Icon className="h-4 w-4" />
              {docs.tabs[tabId]}
            </button>
          );
        })}
      </div>

      <div className="bg-[#0b1224] border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-xl min-h-[480px]">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          {React.createElement(TAB_ICONS[activeTab], { className: 'h-5 w-5 text-amber-500' })}
          {section.title}
        </h2>

        <div className="space-y-6">
          {section.blocks.map((block, idx) => (
            <div key={idx} className="space-y-3">
              {block.heading && (
                <h3 className="text-sm font-bold text-amber-400/90 font-display uppercase tracking-wide">
                  {block.heading}
                </h3>
              )}
              {block.body && (
                <p className="text-slate-300 text-sm leading-relaxed">{block.body}</p>
              )}
              {block.list && (
                <ul className="text-slate-300 text-sm space-y-2 list-disc pl-5">
                  {block.list.map((item, i) => (
                    <li key={i} className="leading-relaxed">
                      {item}
                    </li>
                  ))}
                </ul>
              )}
              {block.code && (
                <pre className="bg-slate-950 p-4 rounded-xl text-[11px] sm:text-xs font-mono text-emerald-300/90 overflow-x-auto border border-slate-800 whitespace-pre-wrap">
                  {block.code}
                </pre>
              )}
            </div>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="mt-8 pt-6 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Dev URL', value: 'http://localhost:3000' },
              { label: 'Command', value: 'npm run dev' },
              { label: 'Docs route', value: '/docs' },
            ].map((item) => (
              <div
                key={item.label}
                className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 text-center"
              >
                <span className="text-[10px] text-slate-500 font-mono uppercase block mb-1">
                  {item.label}
                </span>
                <span className="text-xs text-amber-400 font-mono font-bold">{item.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 border border-slate-800/60 bg-slate-900/20 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-slate-400 text-xs leading-relaxed max-w-xl">
          {locale === 'sr'
            ? 'Puna tehnička specifikacija u lootly-docs.html (faze razvoja). Ova stranica (/docs) reflektuje trenutno stanje koda.'
            : 'Full product spec in lootly-docs.html (roadmap phases). This page (/docs) reflects the current codebase.'}
        </p>
        <button
          onClick={() => window.open('/lootly-docs.html', '_blank')}
          className="bg-slate-800 hover:bg-slate-700 text-slate-200 py-2.5 px-4 rounded-xl text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-colors shrink-0"
        >
          lootly-docs.html <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
