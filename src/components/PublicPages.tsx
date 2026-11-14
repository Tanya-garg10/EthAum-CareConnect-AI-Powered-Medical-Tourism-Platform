import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Globe2,
  LayoutGrid,
  List,
  Mail,
  MapPin,
  Search,
  Send,
  ShieldCheck,
  X,
} from 'lucide-react';
import type {
  DestinationHub,
  DoctorProfile,
  HospitalProfile,
  JourneyStageDef,
  TreatmentCategory,
  User,
} from '../types';

export type PublicPageId =
  | 'home'
  | 'treatments'
  | 'destinations'
  | 'hospitals'
  | 'doctors'
  | 'how-it-works'
  | 'about';

interface PublicPagesProps {
  page: Exclude<PublicPageId, 'home'>;
  treatments: TreatmentCategory[];
  destinations: DestinationHub[];
  hospitals: HospitalProfile[];
  doctors: DoctorProfile[];
  journeyStages: JourneyStageDef[];
  currentUser: User | null;
  initialDestinationId?: string;
  onNavigate: (page: PublicPageId) => void;
  onOpenAuth: (mode: 'login' | 'register', role?: 'patient' | 'provider', prefillSpecialty?: string) => void;
  onEnterPortal: () => void;
}

export default function PublicPages({
  page,
  treatments,
  destinations,
  hospitals,
  doctors,
  journeyStages,
  currentUser,
  initialDestinationId,
  onNavigate,
  onOpenAuth,
  onEnterPortal,
}: PublicPagesProps) {
  const [selectedTreatment, setSelectedTreatment] = useState<TreatmentCategory>(treatments[0]);
  const [selectedHubId, setSelectedHubId] = useState<string>(initialDestinationId || destinations[0]?.id || 'hub-sg');

  // Hospital Directory filters
  const [hospSearch, setHospSearch] = useState('');
  const [hospCountry, setHospCountry] = useState('All');
  const [hospSpecialty, setHospSpecialty] = useState('All');
  const [hospCredential, setHospCredential] = useState('All');
  const [hospSort, setHospSort] = useState<'availability' | 'price-asc' | 'price-desc'>('availability');
  const [hospViewMode, setHospViewMode] = useState<'grid' | 'list'>('grid');
  const [viewingHospital, setViewingHospital] = useState<HospitalProfile | null>(null);

  // Doctor Directory filters
  const [docSearch, setDocSearch] = useState('');
  const [docCountry, setDocCountry] = useState('All');
  const [docSpecialty, setDocSpecialty] = useState('All');
  const [viewingDoctor, setViewingDoctor] = useState<DoctorProfile | null>(null);

  // Contact Inquiry Form
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactRole, setContactRole] = useState<'Patient' | 'Hospital / Provider' | 'Partner / Investor'>('Patient');
  const [contactCountry, setContactCountry] = useState('United Kingdom');
  const [contactMessage, setContactMessage] = useState('');
  const [contactBusy, setContactBusy] = useState(false);
  const [contactSuccess, setContactSuccess] = useState<string | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);

  const selectedHub = destinations.find((d) => d.id === selectedHubId) || destinations[0];

  const filteredHospitals = useMemo(() => {
    const q = hospSearch.trim().toLowerCase();
    return hospitals
      .filter((h) => {
        if (hospCountry !== 'All' && h.country !== hospCountry) return false;
        if (
          hospSpecialty !== 'All' &&
          !h.specialties.some((s) => s.toLowerCase().includes(hospSpecialty.toLowerCase()))
        ) {
          return false;
        }
        if (hospCredential === 'verified' && h.credentialStatus !== 'verified') return false;
        if (hospCredential === 'sample' && h.credentialStatus !== 'sample') return false;
        if (q) {
          return (
            h.name.toLowerCase().includes(q) ||
            h.city.toLowerCase().includes(q) ||
            h.country.toLowerCase().includes(q) ||
            h.specialties.some((s) => s.toLowerCase().includes(q))
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (hospSort === 'price-asc') return a.indicativePriceUsd - b.indicativePriceUsd;
        if (hospSort === 'price-desc') return b.indicativePriceUsd - a.indicativePriceUsd;
        return a.nextAvailabilityDays - b.nextAvailabilityDays;
      });
  }, [hospitals, hospSearch, hospCountry, hospSpecialty, hospCredential, hospSort]);

  const filteredDoctors = useMemo(() => {
    const q = docSearch.trim().toLowerCase();
    return doctors.filter((d) => {
      if (docCountry !== 'All' && d.country !== docCountry) return false;
      if (docSpecialty !== 'All' && d.specialty.toLowerCase() !== docSpecialty.toLowerCase()) return false;
      if (q) {
        return (
          d.name.toLowerCase().includes(q) ||
          d.specialty.toLowerCase().includes(q) ||
          d.hospitalName.toLowerCase().includes(q) ||
          d.country.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [doctors, docSearch, docCountry, docSpecialty]);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactBusy(true);
    setContactError(null);
    setContactSuccess(null);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: contactName,
          email: contactEmail,
          role: contactRole,
          country: contactCountry,
          message: contactMessage,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setContactError(data.error || 'Could not submit inquiry.');
        return;
      }
      setContactSuccess(data.message || 'Your message has been logged.');
      setContactName('');
      setContactEmail('');
      setContactMessage('');
    } catch {
      setContactError('Network error while submitting contact inquiry.');
    } finally {
      setContactBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-12 space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[rgba(135,180,230,0.15)] pb-6">
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="inline-flex items-center gap-2 text-xs font-medium text-[#9BAAC2] hover:text-[#39DDF5] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to EthAum CareConnect Overview</span>
        </button>
        <div className="text-xs text-[#9BAAC2]">
          Sample & Demo Directory · Non-diagnostic logistical coordination platform
        </div>
      </div>

      {/* VIEW 1: EXPLORE TREATMENTS */}
      {page === 'treatments' && (
        <div className="space-y-8">
          <div>
            <div className="text-xs font-medium text-[#39DDF5]">Global Specialty Discovery</div>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-[#F5F8FF] sm:text-4xl">
              Explore Cross-Border Treatments
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[#9BAAC2]">
              Compare treatment categories, typical hospital length of stay, and indicative cost bands across our 7 international medical corridors. All figures are demonstration guides prior to formal specialist review.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-5 space-y-2.5">
              {treatments.map((t) => {
                const active = selectedTreatment.id === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTreatment(t)}
                    className={`w-full rounded-xl border p-4 text-left transition-colors ${
                      active
                        ? 'border-[#39DDF5]/60 bg-[#101A30]'
                        : 'border-[rgba(135,180,230,0.15)] bg-[#0B1224] hover:border-white/30'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono-tabular text-[#39DDF5]">{t.indicativeRangeUsd}</span>
                      <span className="text-[#9BAAC2]">Stay {t.typicalStayDays}</span>
                    </div>
                    <div className="mt-1 font-display text-base font-semibold text-white">
                      {t.title}
                    </div>
                    <div className="mt-0.5 text-xs text-[#9BAAC2]">{t.subtitle}</div>
                  </button>
                );
              })}
            </div>

            <div className="lg:col-span-7">
              <div className="rounded-2xl border border-[rgba(135,180,230,0.15)] bg-[#101A30] p-6 sm:p-8 space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[rgba(135,180,230,0.15)] pb-5">
                  <div>
                    <div className="text-xs font-medium text-[#9272FF]">Specialty Dossier</div>
                    <h2 className="mt-1 font-display text-2xl font-semibold text-white">
                      {selectedTreatment.title}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-[#9BAAC2]">
                      {selectedTreatment.description}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-[#9BAAC2]">Indicative Band</div>
                    <div className="font-mono-tabular text-lg font-semibold text-[#39DDF5]">
                      {selectedTreatment.indicativeRangeUsd}
                    </div>
                    <div className="text-xs text-[#9BAAC2]">Typical Stay: {selectedTreatment.typicalStayDays}</div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
                    Covered Procedures & Care Pathways
                  </h3>
                  <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
                    {selectedTreatment.procedures.map((proc) => (
                      <div
                        key={proc}
                        className="rounded-xl border border-[rgba(135,180,230,0.15)] bg-[#070B18] p-3.5 text-xs text-slate-200"
                      >
                        {proc}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
                    Sample Hospitals Coordinating This Specialty
                  </h3>
                  <div className="mt-3 space-y-2.5">
                    {hospitals
                      .filter(
                        (h) =>
                          h.specialties.some((s) =>
                            selectedTreatment.title.toLowerCase().includes(s.toLowerCase().split(' ')[0]),
                          ) ||
                          h.treatments.some((ht) =>
                            selectedTreatment.procedures.some((p) =>
                              ht.toLowerCase().includes(p.toLowerCase().split(' ')[0]),
                            ),
                          ),
                      )
                      .slice(0, 3)
                      .map((h) => (
                        <div
                          key={h.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[rgba(135,180,230,0.15)] bg-[#0B1224] p-4"
                        >
                          <div>
                            <div className="text-sm font-semibold text-white">{h.name}</div>
                            <div className="text-xs text-[#9BAAC2]">
                              {h.city}, {h.country} · {h.indicativeRangeLabel}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setViewingHospital(h);
                              onNavigate('hospitals');
                            }}
                            className="text-xs font-medium text-[#39DDF5] hover:underline"
                          >
                            Inspect Center →
                          </button>
                        </div>
                      ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[rgba(135,180,230,0.15)] pt-5">
                  <div className="text-xs text-[#9BAAC2]">
                    Final package pricing depends on specialist review of your medical records.
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      currentUser
                        ? onEnterPortal()
                        : onOpenAuth('register', 'patient', selectedTreatment.title)
                    }
                    className="inline-flex items-center gap-2 rounded-lg bg-[#39DDF5] px-5 py-2.5 text-xs font-semibold text-[#070B18] hover:bg-[#6ae5f8]"
                  >
                    <span>Start Case for {selectedTreatment.slug}</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: GLOBAL DESTINATIONS */}
      {page === 'destinations' && (
        <div className="space-y-8">
          <div>
            <div className="text-xs font-medium text-[#9272FF]">7 Connected Medical Hubs</div>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-[#F5F8FF] sm:text-4xl">
              International Treatment Destinations
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[#9BAAC2]">
              Inspect each medical corridor’s core specialties, multilingual international patient desks, visa & arrival logistics, and sample hospitals.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {destinations.map((hub) => {
              const active = selectedHub?.id === hub.id;
              return (
                <button
                  key={hub.id}
                  type="button"
                  onClick={() => setSelectedHubId(hub.id)}
                  className={`rounded-2xl border p-5 text-left transition-colors ${
                    active
                      ? 'border-[#39DDF5] bg-[#101A30]'
                      : 'border-[rgba(135,180,230,0.15)] bg-[#0B1224] hover:border-white/30'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs text-[#9BAAC2]">
                    <span>{hub.city}</span>
                    <Globe2 className={`h-4 w-4 ${active ? 'text-[#39DDF5]' : 'text-slate-500'}`} />
                  </div>
                  <div className="mt-2 font-display text-xl font-semibold text-white">
                    {hub.country}
                  </div>
                  <div className="mt-2 font-mono-tabular text-xs text-[#39DDF5]">
                    {hub.avgCostAdvantage}
                  </div>
                  <div className="mt-1 text-[11px] text-[#9BAAC2]">
                    {hub.accreditationCount} demo centers · {hub.specialties.slice(0, 2).join(', ')}
                  </div>
                </button>
              );
            })}
          </div>

          {selectedHub && (
            <div className="rounded-2xl border border-[rgba(135,180,230,0.15)] bg-[#101A30] p-6 sm:p-8 space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[rgba(135,180,230,0.15)] pb-5">
                <div>
                  <div className="text-xs font-medium text-[#39DDF5]">{selectedHub.hubName}</div>
                  <h2 className="mt-1 font-display text-2xl font-semibold text-white">
                    {selectedHub.city}, {selectedHub.country}
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm text-[#9BAAC2]">{selectedHub.summary}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setHospCountry(selectedHub.country);
                    onNavigate('hospitals');
                  }}
                  className="rounded-lg bg-[#39DDF5] px-4 py-2 text-xs font-semibold text-[#070B18]"
                >
                  Filter Hospitals in {selectedHub.country}
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-3 text-xs">
                <div className="rounded-xl border border-[rgba(135,180,230,0.15)] bg-[#070B18] p-4">
                  <div className="font-semibold text-white">Core Specialties</div>
                  <div className="mt-1.5 text-[#9BAAC2]">{selectedHub.specialties.join(' · ')}</div>
                </div>
                <div className="rounded-xl border border-[rgba(135,180,230,0.15)] bg-[#070B18] p-4">
                  <div className="font-semibold text-white">Interpreter & Language Support</div>
                  <div className="mt-1.5 text-[#9BAAC2]">{selectedHub.languages.join(' · ')}</div>
                </div>
                <div className="rounded-xl border border-[rgba(135,180,230,0.15)] bg-[#070B18] p-4">
                  <div className="font-semibold text-white">Travel & Medical Visa Notes</div>
                  <div className="mt-1.5 text-[#9BAAC2]">
                    {selectedHub.travelInfo || 'International airport concierge pickup, hospital visa invitation letter, and recovery accommodation desk.'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: HOSPITAL DIRECTORY */}
      {page === 'hospitals' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-xs font-medium text-[#39DDF5]">Sample Partner Network</div>
              <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-white">
                International Hospital Directory
              </h1>
              <p className="mt-1 text-sm text-[#9BAAC2]">
                Filter fictional sample hospitals by corridor, specialty, pricing, and credential demonstration status.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-[rgba(135,180,230,0.15)] bg-[#0B1224] p-1">
              <button
                type="button"
                onClick={() => setHospViewMode('grid')}
                className={`rounded-md p-1.5 ${hospViewMode === 'grid' ? 'bg-[#39DDF5] text-[#070B18]' : 'text-[#9BAAC2]'}`}
                aria-label="Grid view"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setHospViewMode('list')}
                className={`rounded-md p-1.5 ${hospViewMode === 'list' ? 'bg-[#39DDF5] text-[#070B18]' : 'text-[#9BAAC2]'}`}
                aria-label="List view"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid gap-3 rounded-2xl border border-[rgba(135,180,230,0.15)] bg-[#0B1224] p-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="search"
                value={hospSearch}
                onChange={(e) => setHospSearch(e.target.value)}
                placeholder="Search center or city..."
                className="w-full rounded-lg border border-white/15 bg-[#070B18] pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-[#39DDF5] focus:outline-none"
              />
            </div>
            <select
              value={hospCountry}
              onChange={(e) => setHospCountry(e.target.value)}
              className="rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-xs text-white"
            >
              <option value="All">All Countries ({destinations.length})</option>
              {destinations.map((d) => (
                <option key={d.id} value={d.country}>{d.country}</option>
              ))}
            </select>
            <select
              value={hospSpecialty}
              onChange={(e) => setHospSpecialty(e.target.value)}
              className="rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-xs text-white"
            >
              <option value="All">All Specialties</option>
              <option value="Cardiology">Cardiology</option>
              <option value="Oncology">Precision Oncology</option>
              <option value="Orthopedics">Orthopedics</option>
              <option value="Neurology">Neurology</option>
              <option value="Fertility">Fertility</option>
              <option value="Dental">Dental Care</option>
            </select>
            <select
              value={hospCredential}
              onChange={(e) => setHospCredential(e.target.value)}
              className="rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-xs text-white"
            >
              <option value="All">All Verification Status</option>
              <option value="verified">Verified Demo Format</option>
              <option value="sample">Unverified Sample</option>
            </select>
            <select
              value={hospSort}
              onChange={(e) => setHospSort(e.target.value as typeof hospSort)}
              className="rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-xs text-white"
            >
              <option value="availability">Sort: Fastest Consult</option>
              <option value="price-asc">Sort: Estimate Low → High</option>
              <option value="price-desc">Sort: Estimate High → Low</option>
            </select>
          </div>

          <div className={hospViewMode === 'grid' ? 'grid gap-6 md:grid-cols-2 lg:grid-cols-3' : 'space-y-4'}>
            {filteredHospitals.map((h) => (
              <div
                key={h.id}
                className={`rounded-2xl border border-[rgba(135,180,230,0.15)] bg-[#101A30] p-6 flex ${
                  hospViewMode === 'grid' ? 'flex-col justify-between' : 'flex-col sm:flex-row sm:items-center sm:justify-between gap-4'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 text-[#9BAAC2]">
                      <MapPin className="h-3.5 w-3.5 text-[#39DDF5]" />
                      {h.city}, {h.country}
                    </span>
                    <span className={h.credentialStatus === 'verified' ? 'text-emerald-400 font-medium' : 'text-amber-300 font-medium'}>
                      {h.credentialStatus === 'verified' ? 'Verified Format (Demo)' : 'Unverified Sample'}
                    </span>
                  </div>
                  <h2 className="font-display text-lg font-semibold text-white">{h.name}</h2>
                  <p className="text-xs leading-relaxed text-[#9BAAC2]">{h.description}</p>
                  <div className="text-xs text-[#39DDF5]">{h.specialties.join(' · ')}</div>
                </div>

                <div className={hospViewMode === 'grid' ? 'mt-5 border-t border-[rgba(135,180,230,0.15)] pt-4 space-y-3' : 'shrink-0 sm:text-right space-y-2'}>
                  <div className="font-mono-tabular text-sm font-semibold text-white">
                    {h.indicativeRangeLabel}
                  </div>
                  <div className="text-xs text-[#9BAAC2]">
                    Next consult: <span className="font-mono-tabular text-white">{h.nextAvailabilityDays} days</span>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <button
                      type="button"
                      onClick={() => setViewingHospital(h)}
                      className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-white hover:border-[#39DDF5]"
                    >
                      Inspect Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => (currentUser ? onEnterPortal() : onOpenAuth('register', 'patient', h.specialties[0]))}
                      className="rounded-lg bg-[#39DDF5] px-3 py-1.5 text-xs font-semibold text-[#070B18]"
                    >
                      Request Consult
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 4: DOCTOR DIRECTORY */}
      {page === 'doctors' && (
        <div className="space-y-6">
          <div>
            <div className="text-xs font-medium text-[#39DDF5]">Clinical Specialist Profiles (Sample)</div>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-white">
              International Specialist Directory
            </h1>
            <p className="mt-1 text-sm text-[#9BAAC2]">
              Review fictional demonstration physician profiles, academic publications, spoken languages, and virtual screening slots.
            </p>
          </div>

          <div className="grid gap-3 rounded-2xl border border-[rgba(135,180,230,0.15)] bg-[#0B1224] p-4 sm:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="search"
                value={docSearch}
                onChange={(e) => setDocSearch(e.target.value)}
                placeholder="Search doctor, hospital, specialty..."
                className="w-full rounded-lg border border-white/15 bg-[#070B18] pl-9 pr-3 py-2 text-xs text-white"
              />
            </div>
            <select
              value={docCountry}
              onChange={(e) => setDocCountry(e.target.value)}
              className="rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-xs text-white"
            >
              <option value="All">All Countries</option>
              {destinations.map((d) => (
                <option key={d.id} value={d.country}>{d.country}</option>
              ))}
            </select>
            <select
              value={docSpecialty}
              onChange={(e) => setDocSpecialty(e.target.value)}
              className="rounded-lg border border-white/15 bg-[#070B18] px-3 py-2 text-xs text-white"
            >
              <option value="All">All Specialties</option>
              <option value="Cardiology">Cardiology</option>
              <option value="Orthopedics">Orthopedics</option>
              <option value="Precision Oncology">Precision Oncology</option>
              <option value="Neurology">Neurology</option>
            </select>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredDoctors.map((doc) => (
              <div
                key={doc.id}
                className="flex flex-col justify-between rounded-2xl border border-[rgba(135,180,230,0.15)] bg-[#101A30] p-6"
              >
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#39DDF5] font-medium">{doc.specialty}</span>
                    <span className={doc.credentialStatus === 'verified' ? 'text-emerald-400' : 'text-amber-300'}>
                      {doc.credentialStatus === 'verified' ? 'Verified Format' : 'Sample Profile'}
                    </span>
                  </div>
                  <h2 className="mt-2 font-display text-lg font-semibold text-white">{doc.name}</h2>
                  <div className="text-xs text-[#9BAAC2]">{doc.title}</div>
                  <div className="mt-2 text-xs text-slate-300">
                    {doc.hospitalName} · {doc.city}, {doc.country}
                  </div>
                  <div className="mt-3 border-t border-[rgba(135,180,230,0.15)] pt-3 text-xs text-[#9BAAC2]">
                    {doc.yearsExperience} yrs experience · {doc.publicationsCount} publications · Languages: {doc.languages.join(', ')}
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-[rgba(135,180,230,0.15)] pt-4">
                  <div className="text-xs">
                    <div className="text-[#9BAAC2]">{doc.nextConsultSlot}</div>
                    <div className="font-mono-tabular font-semibold text-white">
                      Virtual Fee ~${doc.indicativeConsultFeeUsd}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setViewingDoctor(doc)}
                      className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white"
                    >
                      Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => (currentUser ? onEnterPortal() : onOpenAuth('register', 'patient', doc.specialty))}
                      className="rounded-lg bg-[#39DDF5] px-3 py-1.5 text-xs font-semibold text-[#070B18]"
                    >
                      Consult
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 5: HOW IT WORKS (14 STAGES) */}
      {page === 'how-it-works' && (
        <div className="space-y-8">
          <div>
            <div className="text-xs font-medium text-[#39DDF5]">Complete End-to-End Architecture</div>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              The 14-Stage International Patient Journey
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[#9BAAC2]">
              Every medical inquiry moves transparently across four structured governance phases — giving patients control over medical document consent and financial terms before any clinical booking.
            </p>
          </div>

          {(['Discovery & Intake', 'Matching & Evaluation', 'Coordination & Care', 'Recovery'] as const).map((phase) => (
            <div key={phase} className="space-y-4">
              <h2 className="font-display text-xl font-semibold text-[#39DDF5]">{phase}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {journeyStages
                  .filter((st) => st.category === phase)
                  .map((st) => (
                    <div
                      key={st.stage}
                      className="rounded-2xl border border-[rgba(135,180,230,0.15)] bg-[#101A30] p-5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono-tabular font-semibold text-[#39DDF5]">
                          STAGE {String(st.stage).padStart(2, '0')}
                        </span>
                        <span className="text-[#9BAAC2]">{st.owner}</span>
                      </div>
                      <div className="mt-2 font-display text-base font-semibold text-white">
                        {st.title}
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-[#9BAAC2]">{st.description}</p>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* VIEW 6: ABOUT & CONTACT */}
      {page === 'about' && (
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-6 space-y-6">
            <div>
              <div className="text-xs font-medium text-[#39DDF5]">Platform Governance & Contact</div>
              <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                About EthAum CareConnect 2.0
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-[#9BAAC2]">
                EthAum CareConnect is an AI-assisted international medical tourism coordination marketplace built under EthAum Venture Partners by Tanya Garg (Team Krackcode). Our architecture emphasizes consent-first record privacy, transparent line-item quotations, and strict non-diagnostic AI guardrails.
              </p>
            </div>

            <div className="space-y-3 rounded-2xl border border-[rgba(135,180,230,0.15)] bg-[#101A30] p-6 text-xs text-[#9BAAC2]">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <ShieldCheck className="h-4 w-4 text-[#39DDF5]" />
                <span>Clinical & Privacy Principles</span>
              </div>
              <p>· AI assists purely with case structuring, document indexing, and logistical checklists — never diagnoses.</p>
              <p>· All hospital profiles currently shown in this hackathon build are fictional sample listings clearly labelled for demonstration.</p>
              <p>· Referral commission tracking (5%) activates only on verified, completed treatments per partner agreement.</p>
            </div>
          </div>

          <div className="lg:col-span-6">
            <form
              onSubmit={handleContactSubmit}
              className="rounded-2xl border border-[rgba(135,180,230,0.15)] bg-[#0B1224] p-6 sm:p-8 space-y-4"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Mail className="h-4 w-4 text-[#39DDF5]" />
                <span>Contact EthAum CareConnect Operations</span>
              </div>

              {contactSuccess && (
                <div className="flex items-start gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-xs text-emerald-200">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{contactSuccess}</span>
                </div>
              )}
              {contactError && (
                <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3.5 text-xs text-rose-200">
                  {contactError}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs text-[#9BAAC2]">Full Name</label>
                  <input
                    type="text"
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Your name"
                    className="mt-1 w-full rounded-lg border border-white/15 bg-[#070B18] px-3.5 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#9BAAC2]">Email Address</label>
                  <input
                    type="email"
                    required
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="you@domain.com"
                    className="mt-1 w-full rounded-lg border border-white/15 bg-[#070B18] px-3.5 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs text-[#9BAAC2]">Inquiry Role</label>
                  <select
                    value={contactRole}
                    onChange={(e) => setContactRole(e.target.value as typeof contactRole)}
                    className="mt-1 w-full rounded-lg border border-white/15 bg-[#070B18] px-3.5 py-2 text-xs text-white"
                  >
                    <option value="Patient">Patient / Caregiver</option>
                    <option value="Hospital / Provider">Hospital / Provider Desk</option>
                    <option value="Partner / Investor">Partner / Venture Inquiry</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[#9BAAC2]">Country</label>
                  <input
                    type="text"
                    value={contactCountry}
                    onChange={(e) => setContactCountry(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/15 bg-[#070B18] px-3.5 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-[#9BAAC2]">Message</label>
                <textarea
                  rows={4}
                  required
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  placeholder="How can our coordination desk assist you?"
                  className="mt-1 w-full rounded-lg border border-white/15 bg-[#070B18] px-3.5 py-2 text-xs text-white"
                />
              </div>

              <button
                type="submit"
                disabled={contactBusy}
                className="inline-flex items-center gap-2 rounded-lg bg-[#39DDF5] px-5 py-2.5 text-xs font-semibold text-[#070B18] disabled:opacity-60"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{contactBusy ? 'Submitting...' : 'Send Inquiry'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Hospital Detail Modal */}
      {viewingHospital && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="max-h-[90vh] overflow-y-auto max-w-2xl w-full rounded-2xl border border-white/15 bg-[#0B1224] p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs text-[#39DDF5]">
                  {viewingHospital.city}, {viewingHospital.country} · {viewingHospital.bedCapacity} beds
                </div>
                <h3 className="mt-1 font-display text-xl font-semibold text-white">
                  {viewingHospital.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingHospital(null)}
                className="rounded-lg border border-white/10 p-1.5 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-[#9BAAC2]">{viewingHospital.description}</p>
            <div className="grid gap-3 rounded-xl border border-white/10 bg-[#070B18] p-4 text-xs sm:grid-cols-2">
              <div>
                <div className="text-[#9BAAC2]">Credential Status</div>
                <div className="mt-0.5 text-white">{viewingHospital.credentialNote}</div>
              </div>
              <div>
                <div className="text-[#9BAAC2]">Indicative Range</div>
                <div className="mt-0.5 font-mono-tabular text-[#39DDF5]">
                  {viewingHospital.indicativeRangeLabel}
                </div>
              </div>
              <div>
                <div className="text-[#9BAAC2]">Languages</div>
                <div className="mt-0.5 text-white">{viewingHospital.languages.join(' · ')}</div>
              </div>
              <div>
                <div className="text-[#9BAAC2]">Facilities</div>
                <div className="mt-0.5 text-white">{viewingHospital.facilities.join(' · ')}</div>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={() => setViewingHospital(null)}
                className="rounded-lg border border-white/15 px-4 py-2 text-xs text-slate-200"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const spec = viewingHospital.specialties[0];
                  setViewingHospital(null);
                  if (currentUser) onEnterPortal();
                  else onOpenAuth('register', 'patient', spec);
                }}
                className="rounded-lg bg-[#39DDF5] px-4 py-2 text-xs font-semibold text-[#070B18]"
              >
                Start Case with This Center
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Doctor Detail Modal */}
      {viewingDoctor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="max-w-lg w-full rounded-2xl border border-white/15 bg-[#0B1224] p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs text-[#39DDF5]">{viewingDoctor.specialty}</div>
                <h3 className="mt-1 font-display text-xl font-semibold text-white">
                  {viewingDoctor.name}
                </h3>
                <div className="text-xs text-[#9BAAC2]">{viewingDoctor.title}</div>
              </div>
              <button
                type="button"
                onClick={() => setViewingDoctor(null)}
                className="rounded-lg border border-white/10 p-1.5 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#070B18] p-4 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-[#9BAAC2]">Hospital</span>
                <span className="text-white">{viewingDoctor.hospitalName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9BAAC2]">Subspecialties</span>
                <span className="text-white">{viewingDoctor.subspecialties.join(', ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9BAAC2]">Languages</span>
                <span className="text-white">{viewingDoctor.languages.join(', ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9BAAC2]">Registry Note</span>
                <span className="text-amber-300">{viewingDoctor.registrationNote}</span>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setViewingDoctor(null)}
                className="rounded-lg border border-white/15 px-4 py-2 text-xs text-slate-200"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const spec = viewingDoctor.specialty;
                  setViewingDoctor(null);
                  if (currentUser) onEnterPortal();
                  else onOpenAuth('register', 'patient', spec);
                }}
                className="rounded-lg bg-[#39DDF5] px-4 py-2 text-xs font-semibold text-[#070B18]"
              >
                Request Virtual Consult
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
