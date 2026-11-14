import { useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import type { DestinationHub } from '../types';

interface CaseCreationWizardProps {
  defaultSpecialty?: string;
  defaultLanguage: string;
  destinations: DestinationHub[];
  busy: boolean;
  onCancel: () => void;
  onSubmit: (payload: {
    title: string;
    specialty: string;
    targetProcedure: string;
    diagnosisSummary: string;
    medicalHistory: string;
    preferredCountries: string[];
    preferredLanguage: string;
    budgetUsd: number;
    expectedTravelWindow: string;
    insuranceInfo: string;
    urgency: 'Routine (4–8 weeks)' | 'Priority (2–4 weeks)' | 'Expedited (< 2 weeks)';
    summary: string;
  }) => Promise<void>;
}

const STEPS = [
  '1. Basic Information',
  '2. Treatment Requirement',
  '3. Medical History',
  '4. Preferred Destination',
  '5. Budget & Travel',
  '6. Language & Insurance',
  '7. Consent & Submit',
];

export default function CaseCreationWizard({
  defaultSpecialty,
  defaultLanguage,
  destinations,
  busy,
  onCancel,
  onSubmit,
}: CaseCreationWizardProps) {
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState('');
  const [urgency, setUrgency] = useState<'Routine (4–8 weeks)' | 'Priority (2–4 weeks)' | 'Expedited (< 2 weeks)'>('Priority (2–4 weeks)');
  const [specialty, setSpecialty] = useState(defaultSpecialty || 'Cardiology');
  const [targetProcedure, setTargetProcedure] = useState('TAVR / Valve Replacement');
  const [diagnosisSummary, setDiagnosisSummary] = useState('');
  const [medicalHistory, setMedicalHistory] = useState('');
  const [preferredCountries, setPreferredCountries] = useState<string[]>(['Singapore', 'India']);
  const [budgetUsd, setBudgetUsd] = useState(22000);
  const [expectedTravelWindow, setExpectedTravelWindow] = useState('Within 4–6 weeks');
  const [preferredLanguage, setPreferredLanguage] = useState(defaultLanguage || 'English');
  const [insuranceInfo, setInsuranceInfo] = useState('Self-pay');
  const [consentChecked, setConsentChecked] = useState(true);

  const toggleCountry = (country: string) => {
    setPreferredCountries((prev) =>
      prev.includes(country) ? prev.filter((c) => c !== country) : [...prev, country],
    );
  };

  const handleFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consentChecked) return;
    await onSubmit({
      title: title.trim() || `${specialty} Cross-Border Evaluation`,
      specialty,
      targetProcedure,
      diagnosisSummary: diagnosisSummary || 'Patient-provided summary pending specialist evaluation.',
      medicalHistory: medicalHistory || 'None stated',
      preferredCountries: preferredCountries.length ? preferredCountries : ['Singapore'],
      preferredLanguage,
      budgetUsd: Number(budgetUsd) || 20000,
      expectedTravelWindow,
      insuranceInfo,
      urgency,
      summary: diagnosisSummary || `${specialty} intake for ${targetProcedure}.`,
    });
  };

  return (
    <form
      onSubmit={handleFinish}
      className="rounded-2xl border border-[#38DDF5]/40 bg-[#111B31] p-6 space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-4">
        <div>
          <div className="text-xs font-medium text-[#38DDF5]">
            7-Step Medical Case Intake · Step {step + 1} of 7
          </div>
          <h2 className="font-display text-lg font-semibold text-white">{STEPS[step]}</h2>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-slate-400 hover:text-white"
        >
          Cancel
        </button>
      </div>

      {/* Step progress strip */}
      <div className="grid grid-cols-7 gap-1.5">
        {STEPS.map((label, idx) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(idx)}
            className={`h-1.5 rounded-full transition-colors ${
              idx <= step ? 'bg-[#38DDF5]' : 'bg-white/10'
            }`}
            aria-label={label}
          />
        ))}
      </div>

      {step === 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-slate-300">Case Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Mitral Valve Second Opinion & Repair"
              className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-300">Timeline Urgency</label>
            <select
              value={urgency}
              onChange={(e) => setUrgency(e.target.value as typeof urgency)}
              className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-sm text-white"
            >
              <option>Routine (4–8 weeks)</option>
              <option>Priority (2–4 weeks)</option>
              <option>Expedited (&lt; 2 weeks)</option>
            </select>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-slate-300">Medical Specialty</label>
            <select
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-sm text-white"
            >
              <option>Cardiology</option>
              <option>Precision Oncology</option>
              <option>Orthopedics</option>
              <option>Neurology</option>
              <option>Cosmetic Surgery</option>
              <option>Dental Care</option>
              <option>Fertility</option>
              <option>Ophthalmology</option>
              <option>Hepatobiliary</option>
              <option>Bariatric</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-300">Target Procedure / Evaluation</label>
            <input
              type="text"
              value={targetProcedure}
              onChange={(e) => setTargetProcedure(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-sm text-white"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-slate-300">
              Patient-Provided Diagnosis Summary (For administrative organization)
            </label>
            <textarea
              rows={2}
              value={diagnosisSummary}
              onChange={(e) => setDiagnosisSummary(e.target.value)}
              placeholder="Summarize notes from your home physician..."
              className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-sm text-white"
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <label className="block text-xs text-slate-300">
            Relevant Medical & Surgical History
          </label>
          <textarea
            rows={3}
            value={medicalHistory}
            onChange={(e) => setMedicalHistory(e.target.value)}
            placeholder="Prior procedures, allergies, or current medications..."
            className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-sm text-white"
          />
        </div>
      )}

      {step === 3 && (
        <div>
          <label className="block text-xs text-slate-300 mb-2">
            Select Preferred Destination Corridors
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {destinations.map((d) => {
              const selected = preferredCountries.includes(d.country);
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => toggleCountry(d.country)}
                  className={`rounded-xl border p-3 text-left text-xs transition-colors ${
                    selected
                      ? 'border-[#38DDF5] bg-[#0D1428] text-white'
                      : 'border-white/10 bg-[#070B18] text-slate-400'
                  }`}
                >
                  <div className="font-semibold">{d.country}</div>
                  <div className="text-[11px] text-slate-400">{d.city}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-slate-300">Target Budget (USD)</label>
            <input
              type="number"
              value={budgetUsd}
              onChange={(e) => setBudgetUsd(Number(e.target.value))}
              className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-sm text-white font-mono-tabular"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-300">Expected Travel Dates / Window</label>
            <input
              type="text"
              value={expectedTravelWindow}
              onChange={(e) => setExpectedTravelWindow(e.target.value)}
              placeholder="e.g., December 2026"
              className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-sm text-white"
            />
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-slate-300">Preferred Language</label>
            <select
              value={preferredLanguage}
              onChange={(e) => setPreferredLanguage(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-sm text-white"
            >
              <option>English</option>
              <option>Arabic</option>
              <option>German</option>
              <option>Mandarin</option>
              <option>Hindi</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-300">Insurance / Funding Type</label>
            <input
              type="text"
              value={insuranceInfo}
              onChange={(e) => setInsuranceInfo(e.target.value)}
              placeholder="Self-pay, Employer coverage, International policy..."
              className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-sm text-white"
            />
          </div>
        </div>
      )}

      {step === 6 && (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-[#070B18] p-4 text-xs space-y-1.5 text-slate-300">
            <div className="font-semibold text-white">Case Review Summary</div>
            <div>Title: {title || `${specialty} Evaluation`}</div>
            <div>Specialty & Procedure: {specialty} · {targetProcedure}</div>
            <div>Destinations: {preferredCountries.join(', ')} · Budget: ${budgetUsd.toLocaleString()}</div>
            <div>Language: {preferredLanguage} · Travel: {expectedTravelWindow}</div>
          </div>
          <label className="flex items-start gap-2.5 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(e) => setConsentChecked(e.target.checked)}
              className="mt-0.5 rounded border-white/25 bg-[#070B18]"
            />
            <span>
              I confirm this intake reflects my administrative preferences and acknowledge that clinical review belongs solely to licensed medical professionals.
            </span>
          </label>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-white/10 pt-4">
        <button
          type="button"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3.5 py-2 text-xs text-slate-300 disabled:opacity-40"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Previous</span>
        </button>

        {step < 6 ? (
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(6, s + 1))}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#38DDF5] px-4 py-2 text-xs font-semibold text-[#070B18]"
          >
            <span>Next Step</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={busy || !consentChecked}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#38DDF5] px-5 py-2 text-xs font-semibold text-[#070B18] disabled:opacity-50"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>{busy ? 'Creating Case...' : 'Submit Medical Case'}</span>
          </button>
        )}
      </div>
    </form>
  );
}
