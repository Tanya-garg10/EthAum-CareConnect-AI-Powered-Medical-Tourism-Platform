import { useState } from 'react';
import { motion } from 'motion/react';
import { FileText, GitCompare, Hospital, MessageSquare, ShieldAlert, Sparkles } from 'lucide-react';

interface AiNode {
  id: string;
  title: string;
  role: string;
  summary: string;
  outputPreview: string;
  safeguard: string;
  icon: typeof FileText;
}

const AI_NODES: AiNode[] = [
  {
    id: 'intake',
    title: 'AI Medical Case Assistant',
    role: 'Structured Intake',
    summary: 'Collects treatment goals, preferred regions, language preferences, and target budget into a clean intake dossier.',
    outputPreview: 'Extracted: Structural Heart · Preferred English · Target $24,000 · Timeline 2–4 weeks',
    safeguard: 'Administrative structuring only — never diagnoses symptoms.',
    icon: Sparkles,
  },
  {
    id: 'docs',
    title: 'Medical Document Organization',
    role: 'Record Indexing',
    summary: 'Categorizes uploaded PDFs (ECG, MRI narratives, pathology panels) and highlights missing administrative files.',
    outputPreview: 'Indexed 2 PDFs · Flagged 1 missing item: Updated 12-lead ECG PDF',
    safeguard: 'Records remain private until patient grants hospital-specific consent.',
    icon: FileText,
  },
  {
    id: 'matching',
    title: 'Smart Provider Matching',
    role: 'Explainable Ranking',
    summary: 'Scores hospitals transparently across specialty capability, budget alignment, language support, and published accreditations.',
    outputPreview: '94% Logistical Fit · Specialty 98 · Budget 88 · Language 98 · JCI Published',
    safeguard: 'Scores represent logistical alignment, never clinical suitability.',
    icon: Hospital,
  },
  {
    id: 'quotes',
    title: 'Intelligent Quote Comparison',
    role: 'Line-Item Clarity',
    summary: 'Normalizes hospital proposals side-by-side so inclusions, exclusions, ICU caps, and payment terms are unmistakable.',
    outputPreview: 'Compared 2 proposals: $22,400 (Singapore) vs $11,800 (New Delhi) · 3 exclusion diffs',
    safeguard: 'Never recommends the lowest price as medically superior.',
    icon: GitCompare,
  },
  {
    id: 'followup',
    title: 'Follow-Up Assistance',
    role: 'Continuity Support',
    summary: 'Coordinates time-zone virtual appointments, post-discharge summaries, and home-physician record handoffs.',
    outputPreview: 'Next milestone: Exploratory Video Call · Nov 16, 09:30 GMT',
    safeguard: 'Licensed clinicians retain full authority over all medical decisions.',
    icon: MessageSquare,
  },
];

export default function AiIntelligenceVisual() {
  const [activeId, setActiveId] = useState<string>('intake');
  const activeNode = AI_NODES.find((n) => n.id === activeId) || AI_NODES[0];

  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:items-stretch">
      <div className="lg:col-span-5 flex flex-col justify-between gap-3">
        {AI_NODES.map((node, index) => {
          const Icon = node.icon;
          const isActive = node.id === activeId;
          return (
            <button
              key={node.id}
              type="button"
              onClick={() => setActiveId(node.id)}
              className={`group flex items-start gap-4 rounded-xl border p-4 text-left transition-all ${
                isActive
                  ? 'border-[#35D5F5]/60 bg-[#0F1B36]'
                  : 'border-white/10 bg-[#0B1224] hover:border-white/25 hover:bg-[#0E1730]'
              }`}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
                  isActive
                    ? 'border-[#35D5F5]/50 bg-[#35D5F5]/15 text-[#35D5F5]'
                    : 'border-white/10 bg-white/5 text-slate-400 group-hover:text-slate-200'
                }`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-400">
                    0{index + 1} · {node.role}
                  </span>
                </div>
                <div className="mt-0.5 font-display text-base font-semibold text-white">
                  {node.title}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="lg:col-span-7 flex flex-col justify-between rounded-2xl border border-cyan-400/20 bg-[#0B1226] p-6 sm:p-8">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
            <div>
              <div className="text-xs font-medium text-[#35D5F5]">
                AI-Assisted Workflow Architecture
              </div>
              <h3 className="mt-1 font-display text-2xl font-semibold text-white">
                {activeNode.title}
              </h3>
            </div>
            <div className="font-mono-tabular text-xs text-slate-400">
              {activeNode.role} · Human-in-the-loop
            </div>
          </div>

          <p className="mt-5 text-base leading-relaxed text-slate-300">
            {activeNode.summary}
          </p>

          {/* Animated architectural node flow SVG */}
          <div className="mt-7 rounded-xl border border-white/10 bg-[#070B18] p-5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Patient Input</span>
              <span>CareConnect AI Structuring</span>
              <span>Licensed Provider Review</span>
            </div>

            <div className="relative my-5 flex items-center justify-between gap-2">
              <div className="h-px flex-1 bg-gradient-to-r from-[#35D5F5]/20 via-[#35D5F5]/70 to-[#9B8CFF]/70" />
              <motion.div
                key={activeNode.id}
                initial={{ x: -36, opacity: 0.4 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-center gap-2 rounded-lg border border-[#35D5F5]/40 bg-[#0F1B36] px-3 py-1.5 font-mono-tabular text-xs text-[#35D5F5]"
              >
                <span>Structured Output</span>
              </motion.div>
              <div className="h-px flex-1 bg-gradient-to-r from-[#9B8CFF]/70 to-[#35D5F5]/20" />
            </div>

            <div className="rounded-lg border border-white/10 bg-[#0B1224] p-3.5 font-mono-tabular text-xs leading-relaxed text-slate-200">
              {activeNode.outputPreview}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-400/25 bg-amber-500/5 p-4">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <div className="text-xs leading-relaxed text-slate-300">
            <span className="font-semibold text-amber-200">Clinical Safety Boundary: </span>
            {activeNode.safeguard}
          </div>
        </div>
      </div>
    </div>
  );
}
