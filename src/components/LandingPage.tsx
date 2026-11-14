import { Suspense, lazy, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Compass,
  FileCheck2,
  Globe2,
  Lock,
  ShieldCheck,
  Stethoscope,
  UserCheck,
  X,
} from 'lucide-react';
import AiIntelligenceVisual from './AiIntelligenceVisual';
import PublicPages, { type PublicPageId } from './PublicPages';
import { DESTINATIONS, DOCTORS, HOSPITALS, JOURNEY_STAGES, TREATMENTS } from '../data/seedData';
import type {
  DestinationHub,
  DoctorProfile,
  HospitalProfile,
  JourneyStageDef,
  TreatmentCategory,
  User,
} from '../types';

const GlobeHero3D = lazy(() => import('./GlobeHero3D'));

interface LandingPageProps {
  currentUser: User | null;
  onOpenAuth: (mode: 'login' | 'register', role?: 'patient' | 'provider', prefillSpecialty?: string) => void;
  onEnterPortal: () => void;
}

const EIGHT_STEPS = [
  { step: '01', title: 'Discover', description: 'Explore 10 specialized treatment categories across 7 global medical corridors.' },
  { step: '02', title: 'Create Medical Case', description: 'Complete our 7-step intake capturing goals, history, language, and budget.' },
  { step: '03', title: 'Upload Records', description: 'Organize imaging and lab PDFs inside a private consent-controlled vault.' },
  { step: '04', title: 'Provider Matching', description: 'Review explainable logistical fit rankings across international hospitals.' },
  { step: '05', title: 'Compare Quotations', description: 'Evaluate itemized proposals side-by-side including exclusions and caps.' },
  { step: '06', title: 'Select Provider', description: 'Shortlist 2–3 preferred hospitals and confirm your specialist team.' },
  { step: '07', title: 'Booking & Consultation', description: 'Schedule virtual consultations and authorize escrow-ready booking schedules.' },
  { step: '08', title: 'Treatment & Aftercare', description: 'Coordinate admission, post-discharge recovery, and home-physician handoff.' },
];

export default function LandingPage({
  currentUser,
  onOpenAuth,
  onEnterPortal,
}: LandingPageProps) {
  const [activePage, setActivePage] = useState<PublicPageId>('home');
  const [treatments, setTreatments] = useState<TreatmentCategory[]>(TREATMENTS);
  const [destinations, setDestinations] = useState<DestinationHub[]>(DESTINATIONS);
  const [hospitals, setHospitals] = useState<HospitalProfile[]>(HOSPITALS);
  const [doctors, setDoctors] = useState<DoctorProfile[]>(DOCTORS);
  const [journeyStages, setJourneyStages] = useState<JourneyStageDef[]>(JOURNEY_STAGES);

  const [selectedHub, setSelectedHub] = useState<DestinationHub>(DESTINATIONS[0]);
  const [selectedTreatment, setSelectedTreatment] = useState<TreatmentCategory | null>(null);
  const [openFaq, setOpenFaq] = useState<number>(0);
  const [scrolled, setScrolled] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    fetch('/api/public/catalog')
      .then((res) => (res.ok ? res.json() : null))
      .then((catalog) => {
        if (catalog?.hospitals?.length) setHospitals(catalog.hospitals);
        if (catalog?.destinations?.length) setDestinations(catalog.destinations);
        if (catalog?.treatments?.length) setTreatments(catalog.treatments);
        if (catalog?.doctors?.length) setDoctors(catalog.doctors);
        if (catalog?.journeyStages?.length) setJourneyStages(catalog.journeyStages);
      })
      .catch(() => {});
  }, []);

  const navigateTo = (page: PublicPageId) => {
    setActivePage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const markImgError = (key: string) => {
    setImageErrors((prev) => ({ ...prev, [key]: true }));
  };

  return (
    <div className="min-h-screen bg-[#070B18] text-[#F5F8FF]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header
        className={`sticky top-0 z-40 transition-colors duration-200 ${
          scrolled || activePage !== 'home'
            ? 'border-b border-[rgba(135,180,230,0.15)] bg-[#070B18]/95'
            : 'border-b border-transparent bg-transparent'
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-6 py-4">
          <button
            type="button"
            onClick={() => navigateTo('home')}
            className="font-display text-lg font-semibold tracking-tight text-white hover:text-[#39DDF5] transition-colors whitespace-nowrap shrink-0"
          >
            EthAum CareConnect
          </button>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#9BAAC2]">
            {(
              [
                ['treatments', 'Treatments'],
                ['destinations', 'Destinations'],
                ['hospitals', 'Hospitals'],
                ['doctors', 'Doctors'],
                ['how-it-works', 'How It Works'],
              ] as Array<[PublicPageId, string]>
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => navigateTo(id)}
                className={`transition-colors whitespace-nowrap shrink-0 ${
                  activePage === id ? 'text-[#39DDF5]' : 'hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="shrink-0">
            {currentUser ? (
              <button
                type="button"
                onClick={onEnterPortal}
                className="rounded-lg bg-[#39DDF5] px-4 py-2 text-xs font-semibold text-[#070B18] transition-colors hover:bg-[#6ae5f8] whitespace-nowrap shrink-0"
              >
                Open Portal
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onOpenAuth('login')}
                className="rounded-lg bg-[#39DDF5] px-4 py-2 text-xs font-semibold text-[#070B18] transition-colors hover:bg-[#6ae5f8] whitespace-nowrap shrink-0"
              >
                Get Started
              </button>
            )}
          </div>
        </div>
      </header>

      {activePage !== 'home' ? (
        <PublicPages
          page={activePage}
          treatments={treatments}
          destinations={destinations}
          hospitals={hospitals}
          doctors={doctors}
          journeyStages={journeyStages}
          currentUser={currentUser}
          initialDestinationId={selectedHub.id}
          onNavigate={navigateTo}
          onOpenAuth={onOpenAuth}
          onEnterPortal={onEnterPortal}
        />
      ) : (
        <>
          {/* Hero Section with Lazy-Loaded R3F 3D Medical Globe */}
          <section id="top" className="relative overflow-hidden border-b border-[rgba(135,180,230,0.15)] bg-editorial-grid">
            <div className="mx-auto grid max-w-7xl gap-10 px-6 py-10 lg:grid-cols-12 lg:items-stretch lg:py-14">
              <div className="lg:col-span-6 flex flex-col justify-center">
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div className="text-xs font-medium tracking-wide text-[#39DDF5]">
                    Healthcare Beyond Borders · Care Without Complexity
                  </div>
                  <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-[3.5rem] lg:leading-[1.06] text-balance">
                    Healthcare Without Borders.
                  </h1>
                  <p className="mt-5 max-w-xl text-base leading-relaxed text-[#9BAAC2] sm:text-lg">
                    Discover international surgical centers, organize medical records privately under
                    your own consent controls, and compare transparent itemized proposals across
                    seven global hubs.
                  </p>

                  <div className="mt-8 flex flex-wrap items-center gap-4">
                    <button
                      type="button"
                      onClick={() =>
                        currentUser ? onEnterPortal() : onOpenAuth('register', 'patient')
                      }
                      className="inline-flex items-center gap-2 rounded-lg bg-[#39DDF5] px-5 py-3 text-sm font-semibold text-[#070B18] transition-colors hover:bg-[#6ae5f8] whitespace-nowrap"
                    >
                      <span>Get Started</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => navigateTo('treatments')}
                      className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-[#0B1224] px-5 py-3 text-sm font-medium text-white transition-colors hover:border-[#39DDF5]/50 whitespace-nowrap"
                    >
                      <span>Explore Platform</span>
                    </button>
                    {!currentUser && (
                      <button
                        type="button"
                        onClick={() => onOpenAuth('login')}
                        className="text-sm font-medium text-[#9BAAC2] underline-offset-4 hover:text-white hover:underline whitespace-nowrap"
                      >
                        Sign In
                      </button>
                    )}
                  </div>

                  {/* Active Hub Telemetry Readout Card */}
                  <div className="mt-9 rounded-2xl border border-[rgba(135,180,230,0.18)] bg-[#0B1224] p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
                      <div>
                        <div className="text-[11px] font-medium uppercase tracking-wider text-[#39DDF5]">
                          Selected Corridor · {selectedHub.country}
                        </div>
                        <div className="mt-0.5 font-display text-lg font-semibold text-white">
                          {selectedHub.city} — {selectedHub.hubName}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigateTo('destinations')}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#39DDF5] hover:underline whitespace-nowrap"
                      >
                        <span>Inspect Destination</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3 text-xs">
                      <div>
                        <span className="text-[#9BAAC2]">Focus Specialties</span>
                        <div className="mt-0.5 font-medium text-white">
                          {selectedHub.specialties.slice(0, 2).join(' · ')}
                        </div>
                      </div>
                      <div>
                        <span className="text-[#9BAAC2]">Indicative Range</span>
                        <div className="mt-0.5 font-mono-tabular font-medium text-[#39DDF5]">
                          {selectedHub.avgCostAdvantage}
                        </div>
                      </div>
                      <div>
                        <span className="text-[#9BAAC2]">Network Footprint</span>
                        <div className="mt-0.5 font-mono-tabular font-medium text-white">
                          {selectedHub.accreditationCount} demo centers · {selectedHub.languages[0]}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* 3D Interactive Medical Globe Viewport */}
              <div className="lg:col-span-6 flex flex-col justify-between rounded-2xl border border-[rgba(135,180,230,0.18)] bg-[#080E1E] p-3">
                <div className="relative h-[380px] w-full sm:h-[460px] lg:h-[500px]">
                  <Suspense
                    fallback={
                      <div className="flex h-full w-full items-center justify-center rounded-xl bg-[#070B18] text-xs text-[#9BAAC2]">
                        Initializing 3D Healthcare Network...
                      </div>
                    }
                  >
                    <GlobeHero3D
                      hubs={destinations}
                      selectedHubId={selectedHub.id}
                      onSelectHub={setSelectedHub}
                    />
                  </Suspense>
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#0B1224] px-4 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {destinations.map((hub) => {
                      const active = hub.id === selectedHub.id;
                      return (
                        <button
                          key={hub.id}
                          type="button"
                          onClick={() => setSelectedHub(hub)}
                          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                            active
                              ? 'bg-[#39DDF5]/20 text-[#39DDF5] border border-[#39DDF5]/40'
                              : 'text-[#9BAAC2] hover:text-white border border-transparent'
                          }`}
                        >
                          {hub.country}
                        </button>
                      );
                    })}
                  </div>
                  <div className="text-xs text-[#9BAAC2]">Drag Earth · Click marker</div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 01: Featured Specialties */}
          <section id="treatments" className="border-b border-[rgba(135,180,230,0.15)] py-20">
            <div className="mx-auto max-w-7xl px-6">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                <div>
                  <div className="text-xs font-medium text-[#39DDF5]">
                    01. Global Healthcare Discovery
                  </div>
                  <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl text-balance">
                    Explore Healthcare Beyond Borders.
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => navigateTo('treatments')}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-[#0B1224] px-4 py-2 text-xs font-medium text-white hover:border-[#39DDF5] self-start md:self-auto whitespace-nowrap"
                >
                  <span>Browse All {treatments.length} Specialties</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {treatments.slice(0, 6).map((trt) => {
                  const hasImg = trt.imageUrl && !imageErrors[trt.id];
                  return (
                    <div
                      key={trt.id}
                      className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-[rgba(135,180,230,0.15)] bg-[#101A30] transition-colors hover:border-[#39DDF5]/45"
                    >
                      <div>
                        <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#0B1224]">
                          {hasImg ? (
                            <img
                              src={trt.imageUrl}
                              alt={trt.title}
                              referrerPolicy="no-referrer"
                              onError={() => markImgError(trt.id)}
                              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                            />
                          ) : (
                            <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#0F1B36] to-[#070B18] p-6 text-center">
                              <Stethoscope className="h-8 w-8 text-[#39DDF5]" />
                              <span className="mt-2 font-display text-sm font-medium text-slate-300">
                                {trt.title}
                              </span>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-[#101A30] via-transparent to-transparent" />
                        </div>

                        <div className="p-6">
                          <div className="flex items-center gap-2 text-xs text-[#9BAAC2]">
                            <span className="font-mono-tabular text-[#39DDF5]">
                              {trt.indicativeRangeUsd}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>Stay {trt.typicalStayDays}</span>
                          </div>
                          <h3 className="mt-2 font-display text-xl font-semibold text-white">
                            {trt.title}
                          </h3>
                          <p className="mt-2 text-sm leading-relaxed text-[#9BAAC2]">
                            {trt.description}
                          </p>
                          <div className="mt-4 border-t border-white/10 pt-3 text-xs text-[#9BAAC2]">
                            {trt.procedures.join(' · ')}
                          </div>
                        </div>
                      </div>

                      <div className="px-6 pb-6">
                        <button
                          type="button"
                          onClick={() => setSelectedTreatment(trt)}
                          className="inline-flex items-center gap-2 text-sm font-medium text-[#39DDF5] hover:text-white transition-colors"
                        >
                          <span>Inspect {trt.slug} dossier</span>
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Section 02: 7 International Corridors */}
          <section id="destinations" className="border-b border-[rgba(135,180,230,0.15)] bg-[#0B1224] py-20">
            <div className="mx-auto max-w-7xl px-6">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                <div>
                  <div className="text-xs font-medium text-[#9272FF]">
                    02. Seven International Corridors
                  </div>
                  <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl text-balance">
                    World-Class Care. Across The Globe.
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => navigateTo('destinations')}
                  className="inline-flex items-center gap-2 text-xs font-semibold text-[#39DDF5] hover:underline self-start md:self-auto"
                >
                  <span>Compare All 7 Destinations & Travel Readiness</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="mt-10 grid gap-8 lg:grid-cols-12 lg:items-stretch">
                <div className="lg:col-span-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2">
                  {destinations.map((hub) => {
                    const active = hub.id === selectedHub.id;
                    return (
                      <button
                        key={hub.id}
                        type="button"
                        onClick={() => setSelectedHub(hub)}
                        className={`flex flex-col justify-between rounded-xl border p-4 text-left transition-colors ${
                          active
                            ? 'border-[#39DDF5]/60 bg-[#14213B]'
                            : 'border-[rgba(135,180,230,0.15)] bg-[#070B18] hover:border-white/25'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between text-xs text-[#9BAAC2]">
                            <span>{hub.city}</span>
                            <Globe2 className={`h-3.5 w-3.5 ${active ? 'text-[#39DDF5]' : 'text-slate-500'}`} />
                          </div>
                          <div className="mt-2 font-display text-lg font-semibold text-white">
                            {hub.country}
                          </div>
                        </div>
                        <div className="mt-3 font-mono-tabular text-xs text-[#39DDF5]">
                          {hub.accreditationCount} demo centers
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="lg:col-span-7 overflow-hidden rounded-2xl border border-[rgba(135,180,230,0.15)] bg-[#101A30] flex flex-col justify-between">
                  <div className="relative h-56 w-full overflow-hidden bg-[#0B1224]">
                    {selectedHub.imageUrl && !imageErrors[selectedHub.id] ? (
                      <img
                        src={selectedHub.imageUrl}
                        alt={`${selectedHub.city}, ${selectedHub.country} medical hub`}
                        referrerPolicy="no-referrer"
                        onError={() => markImgError(selectedHub.id)}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[#0F1B36]">
                        <Building2 className="h-10 w-10 text-[#39DDF5]" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#101A30] via-[#101A30]/35 to-transparent" />
                    <div className="absolute bottom-4 left-6 right-6 flex flex-wrap items-end justify-between gap-2">
                      <div>
                        <div className="text-xs font-medium text-[#39DDF5]">
                          {selectedHub.hubName}
                        </div>
                        <h3 className="font-display text-2xl font-semibold text-white">
                          {selectedHub.city}, {selectedHub.country}
                        </h3>
                      </div>
                      <div className="font-mono-tabular text-xs text-slate-200">
                        {selectedHub.avgCostAdvantage}
                      </div>
                    </div>
                  </div>

                  <div className="p-6 space-y-5">
                    <p className="text-sm leading-relaxed text-[#9BAAC2]">{selectedHub.summary}</p>
                    <div className="grid gap-4 border-t border-white/10 pt-4 sm:grid-cols-2">
                      <div>
                        <div className="text-xs font-medium text-[#9BAAC2]">Popular Specialties</div>
                        <div className="mt-1 text-sm text-white">
                          {selectedHub.specialties.join(' · ')}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-[#9BAAC2]">Languages Supported</div>
                        <div className="mt-1 text-sm text-white">
                          {selectedHub.languages.join(' · ')}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 03: Structured 8-Phase Overview -> 14-Stage Journey */}
          <section id="how-it-works" className="border-b border-[rgba(135,180,230,0.15)] py-20">
            <div className="mx-auto max-w-7xl px-6">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                <div className="max-w-2xl">
                  <div className="text-xs font-medium text-[#39DDF5]">03. Structured Coordination</div>
                  <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl text-balance">
                    How EthAum CareConnect Works
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-[#9BAAC2]">
                    A patient-consented workflow moving cleanly from treatment discovery through transparent comparison to coordinated post-care follow-up.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigateTo('how-it-works')}
                  className="inline-flex items-center gap-2 text-xs font-semibold text-[#39DDF5] hover:underline self-start md:self-auto"
                >
                  <span>View Complete 14-Stage Map</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {EIGHT_STEPS.map((item, idx) => (
                  <motion.div
                    key={item.step}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-40px' }}
                    transition={{ duration: 0.35, delay: idx * 0.04 }}
                    className="rounded-2xl border border-[rgba(135,180,230,0.15)] bg-[#101A30] p-5"
                  >
                    <div className="font-mono-tabular text-sm font-semibold text-[#39DDF5]">
                      {item.step}
                    </div>
                    <h3 className="mt-2.5 font-display text-lg font-semibold text-white">
                      {item.title}
                    </h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-[#9BAAC2]">
                      {item.description}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* Section 04: AI Intelligence */}
          <section id="ai-engine" className="border-b border-[rgba(135,180,230,0.15)] bg-[#0B1224] py-20">
            <div className="mx-auto max-w-7xl px-6">
              <div className="max-w-2xl">
                <div className="text-xs font-medium text-[#9272FF]">04. Administrative Intelligence</div>
                <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl text-balance">
                  Intelligence That Simplifies Healthcare.
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-[#9BAAC2]">
                  CareConnect AI structures intake dossiers, indexes records, and normalizes quotes — leaving every clinical decision strictly to licensed physicians.
                </p>
              </div>

              <div className="mt-10">
                <AiIntelligenceVisual />
              </div>
            </div>
          </section>

          {/* Section 05: Sample Providers & Specialists */}
          <section id="providers" className="border-b border-[rgba(135,180,230,0.15)] py-20">
            <div className="mx-auto max-w-7xl px-6">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                <div>
                  <div className="text-xs font-medium text-[#39DDF5]">
                    05. Sample Provider Directory
                  </div>
                  <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl text-balance">
                    Featured Healthcare Providers
                  </h2>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => navigateTo('hospitals')}
                    className="rounded-lg border border-white/15 bg-[#0B1224] px-3.5 py-2 text-xs font-medium text-white hover:border-[#39DDF5]"
                  >
                    Hospital Directory ({hospitals.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateTo('doctors')}
                    className="rounded-lg border border-white/15 bg-[#0B1224] px-3.5 py-2 text-xs font-medium text-white hover:border-[#39DDF5]"
                  >
                    Doctor Directory ({doctors.length})
                  </button>
                </div>
              </div>

              <div className="mt-10 grid gap-6 lg:grid-cols-3">
                {hospitals.slice(0, 3).map((hosp) => (
                  <div
                    key={hosp.id}
                    className="flex flex-col justify-between rounded-2xl border border-[rgba(135,180,230,0.15)] bg-[#101A30] p-6"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-[#9BAAC2]">
                          {hosp.city}, {hosp.country}
                        </span>
                        <span className="inline-flex items-center gap-1 font-medium text-amber-300">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>
                            {hosp.credentialStatus === 'verified' ? 'Verified Demo Format' : 'Sample Listing'}
                          </span>
                        </span>
                      </div>

                      <h3 className="mt-3 font-display text-xl font-semibold text-white">
                        {hosp.name}
                      </h3>
                      <div className="mt-1 text-xs text-[#39DDF5]">
                        {hosp.accreditations.join(' · ')}
                      </div>
                      <p className="mt-3 text-sm leading-relaxed text-[#9BAAC2]">
                        {hosp.description}
                      </p>
                    </div>

                    <div className="mt-6 border-t border-white/10 pt-4">
                      <div className="flex items-center justify-between text-xs text-[#9BAAC2]">
                        <span>Indicative Range</span>
                        <span className="font-mono-tabular font-medium text-white">
                          {hosp.indicativeRangeLabel}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs text-[#9BAAC2] truncate">
                          {hosp.specialties.join(' · ')}
                        </span>
                        <button
                          type="button"
                          onClick={() => navigateTo('hospitals')}
                          className="text-xs font-medium text-[#39DDF5] hover:underline whitespace-nowrap shrink-0 ml-2"
                        >
                          View in Directory
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Section 06: Governance & Patient Safety */}
          <section className="border-b border-[rgba(135,180,230,0.15)] bg-[#0B1224] py-20">
            <div className="mx-auto max-w-7xl px-6">
              <div className="max-w-2xl">
                <div className="text-xs font-medium text-[#39DDF5]">06. Governance & Patient Safety</div>
                <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  Built on Consent, Clarity, and Clinical Oversight
                </h2>
              </div>

              <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
                {[
                  { icon: Lock, title: 'Protected Medical Records', body: 'Patient imaging and lab files are never exposed via public URLs.' },
                  { icon: FileCheck2, title: 'Transparent Proposals', body: 'Clear line-by-line inclusions, medication terms, and cancellation policies.' },
                  { icon: ShieldCheck, title: 'Credential Clarity', body: 'Explicit separation between verified registry profiles and sample listings.' },
                  { icon: UserCheck, title: 'Patient Consent', body: 'Grant or revoke document access per hospital and delete records anytime.' },
                  { icon: Compass, title: 'Qualified Clinicians', body: 'AI structures administration only; licensed doctors lead all clinical reviews.' },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.title}
                      className="rounded-xl border border-[rgba(135,180,230,0.15)] bg-[#101A30] p-5"
                    >
                      <Icon className="h-5 w-5 text-[#39DDF5]" />
                      <h3 className="mt-3 font-display text-base font-semibold text-white">
                        {item.title}
                      </h3>
                      <p className="mt-1.5 text-xs leading-relaxed text-[#9BAAC2]">{item.body}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Section 07: FAQ */}
          <section id="faq" className="border-b border-[rgba(135,180,230,0.15)] py-20">
            <div className="mx-auto max-w-4xl px-6">
              <div className="text-center">
                <div className="text-xs font-medium text-[#39DDF5]">07. Clarity & Governance FAQ</div>
                <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  Frequently Asked Questions
                </h2>
              </div>

              <div className="mt-10 space-y-3">
                {[
                  {
                    q: 'Does EthAum CareConnect diagnose conditions or recommend medical procedures?',
                    a: 'No. CareConnect and its AI Case Assistant are strictly administrative and logistical coordination tools. All clinical assessments, diagnoses, and treatment suitability reviews are performed exclusively by licensed physicians at your chosen medical center.',
                  },
                  {
                    q: 'Who can view my uploaded medical records and imaging reports?',
                    a: 'Records remain private to your account by default. You control hospital-level sharing consent individually and can revoke access or delete documents at any time.',
                  },
                  {
                    q: 'What does the Hospital Match Score represent?',
                    a: 'The match score shows transparent preference alignment across specialty capability, target budget, language support, and consultation availability. It never represents clinical suitability or medical success probability.',
                  },
                  {
                    q: 'Are the listed hospitals, doctors, and quotations real or sample data?',
                    a: 'All seeded hospital profiles, specialist listings, sample cases, and analytics on this hackathon platform are fictional demonstration entries clearly marked as sample data until partner hospitals complete live onboarding.',
                  },
                ].map((item, idx) => {
                  const isOpen = openFaq === idx;
                  return (
                    <div
                      key={item.q}
                      className="rounded-xl border border-[rgba(135,180,230,0.15)] bg-[#101A30] overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenFaq(isOpen ? -1 : idx)}
                        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium text-white hover:text-[#39DDF5]"
                      >
                        <span>{item.q}</span>
                        <span className="font-mono-tabular text-xs text-[#39DDF5]">
                          {isOpen ? '−' : '+'}
                        </span>
                      </button>
                      {isOpen && (
                        <div className="border-t border-white/10 px-5 py-4 text-xs leading-relaxed text-[#9BAAC2]">
                          {item.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Final CTA */}
          <section className="py-20">
            <div className="mx-auto max-w-5xl px-6 text-center">
              <h2 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-5xl text-balance">
                Your Healthcare Journey Starts Here.
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base text-[#9BAAC2]">
                Create a patient dossier to organize records and compare transparent quotes, or onboard your hospital international desk.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => (currentUser ? onEnterPortal() : onOpenAuth('register', 'patient'))}
                  className="rounded-lg bg-[#39DDF5] px-6 py-3 text-sm font-semibold text-[#070B18] transition-colors hover:bg-[#6ae5f8]"
                >
                  Create Patient Account
                </button>
                <button
                  type="button"
                  onClick={() => (currentUser ? onEnterPortal() : onOpenAuth('register', 'provider'))}
                  className="rounded-lg border border-white/15 bg-[#0B1224] px-6 py-3 text-sm font-medium text-white transition-colors hover:border-[#39DDF5]/50"
                >
                  Provider Onboarding
                </button>
              </div>
            </div>
          </section>
        </>
      )}

      {/* Footer */}
      <footer className="border-t border-[rgba(135,180,230,0.15)] bg-[#050812] py-12">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 px-6 md:flex-row md:items-center">
          <div>
            <div className="font-display text-base font-semibold text-white">EthAum CareConnect</div>
            <div className="mt-1 text-xs text-[#9BAAC2]">
              Healthcare Beyond Borders. Care Without Complexity. · Developed by Tanya Garg (Team Krackcode) for EthAum Venture Partners
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs text-[#9BAAC2]">
            <button type="button" onClick={() => navigateTo('treatments')} className="hover:text-white">
              Treatments
            </button>
            <button type="button" onClick={() => navigateTo('destinations')} className="hover:text-white">
              Destinations
            </button>
            <button type="button" onClick={() => navigateTo('hospitals')} className="hover:text-white">
              Hospitals
            </button>
            <button type="button" onClick={() => navigateTo('about')} className="hover:text-[#39DDF5]">
              About & Contact
            </button>
          </div>
        </div>
      </footer>

      {/* Treatment Exploration Modal */}
      {selectedTreatment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="max-w-lg w-full rounded-2xl border border-white/15 bg-[#101A30] p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-medium text-[#39DDF5]">
                  {selectedTreatment.indicativeRangeUsd} · Typical Stay {selectedTreatment.typicalStayDays}
                </div>
                <h3 className="mt-1 font-display text-xl font-semibold text-white">
                  {selectedTreatment.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTreatment(null)}
                className="rounded-lg border border-white/10 p-1.5 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-[#9BAAC2]">{selectedTreatment.description}</p>
            <div className="rounded-xl border border-white/10 bg-[#070B18] p-4">
              <div className="text-xs font-semibold text-white">Commonly Coordinated Procedures</div>
              <ul className="mt-2 space-y-1 text-xs text-slate-300">
                {selectedTreatment.procedures.map((p) => (
                  <li key={p}>· {p}</li>
                ))}
              </ul>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedTreatment(null)}
                className="rounded-lg border border-white/15 px-4 py-2 text-xs text-slate-300"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const title = selectedTreatment.title;
                  setSelectedTreatment(null);
                  if (currentUser) onEnterPortal();
                  else onOpenAuth('register', 'patient', title);
                }}
                className="rounded-lg bg-[#39DDF5] px-4 py-2 text-xs font-semibold text-[#070B18]"
              >
                Create Case for This Specialty
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
