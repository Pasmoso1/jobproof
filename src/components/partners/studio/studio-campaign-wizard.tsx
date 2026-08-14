"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { StudioSelectCard } from "@/components/partners/studio/studio-select-card";
import { StudioLogoUploader } from "@/components/partners/studio/studio-logo-uploader";
import { createStudioCampaign } from "@/lib/partners/studio/actions";
import {
  STUDIO_AUDIENCES,
  STUDIO_GOALS,
  STUDIO_PLATFORMS,
  STUDIO_STYLES,
  STUDIO_THEMES,
  type StudioAudienceId,
  type StudioGoalId,
  type StudioPlatformId,
  type StudioStyleId,
  type StudioThemeId,
} from "@/lib/partners/studio/catalog";
import {
  getStudioPresetsForPartnerType,
  type StudioCampaignPreset,
} from "@/lib/partners/studio/presets";
import {
  normalizePartnerType,
  type PartnerTypeValue,
} from "@/lib/partners/constants";

const BASE_STEPS = [
  "Theme",
  "Audience",
  "Goal",
  "Platforms",
  "Style",
  "Branding",
] as const;

const PROGRESS_MESSAGES = [
  "Building campaign...",
  "Generating graphics...",
  "Writing copy...",
  "Personalizing referral assets...",
] as const;

export function StudioCampaignWizard({
  organizationName,
  isFounding,
  initialLogoUrl,
  isOrganizationPartner = false,
  partnerType = "creator",
}: {
  organizationName: string;
  isFounding: boolean;
  initialLogoUrl: string | null;
  isOrganizationPartner?: boolean;
  partnerType?: PartnerTypeValue | string;
}) {
  const router = useRouter();
  const type = normalizePartnerType(partnerType);
  const presets = useMemo(
    () => getStudioPresetsForPartnerType(type),
    [type]
  );
  const showPresets = presets.length > 0;
  const steps = useMemo(
    () => (showPresets ? (["Preset", ...BASE_STEPS] as const) : BASE_STEPS),
    [showPresets]
  );
  const [step, setStep] = useState(0);
  const [presetId, setPresetId] = useState<string | null>(null);
  const [theme, setTheme] = useState<StudioThemeId | null>(null);
  const [audience, setAudience] = useState<StudioAudienceId | null>(null);
  const [goal, setGoal] = useState<StudioGoalId | null>(null);
  const [platforms, setPlatforms] = useState<StudioPlatformId[]>([]);
  const [style, setStyle] = useState<StudioStyleId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progressIndex, setProgressIndex] = useState(0);
  const [pending, startTransition] = useTransition();
  const wizardOffset = showPresets ? 1 : 0;
  const isOrganizationPartnerResolved =
    isOrganizationPartner || type === "organization";

  const canContinue = useMemo(() => {
    if (showPresets && step === 0) return true;
    const baseStep = step - wizardOffset;
    switch (baseStep) {
      case 0:
        return Boolean(theme);
      case 1:
        return Boolean(audience);
      case 2:
        return Boolean(goal);
      case 3:
        return platforms.length > 0;
      case 4:
        return Boolean(style);
      case 5:
        return true;
      default:
        return false;
    }
  }, [
    step,
    theme,
    audience,
    goal,
    platforms,
    style,
    showPresets,
    wizardOffset,
  ]);

  function applyPreset(id: string) {
    const preset: StudioCampaignPreset | undefined = presets.find(
      (p) => p.id === id
    );
    if (!preset) return;
    setPresetId(id);
    setTheme(preset.theme);
    setAudience(preset.audience);
    setGoal(preset.goal);
    setPlatforms([...preset.platforms]);
    setStyle(preset.style);
  }

  function togglePlatform(id: StudioPlatformId) {
    setPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  const baseStep = step - wizardOffset;

  function onGenerate() {
    if (!theme || !audience || !goal || !style || platforms.length === 0) {
      setError("Complete all required steps before generating.");
      return;
    }
    setError(null);
    setProgressIndex(0);
    startTransition(async () => {
      let tick = 0;
      const timer = window.setInterval(() => {
        tick += 1;
        setProgressIndex((i) => Math.min(i + 1, PROGRESS_MESSAGES.length - 1));
        if (tick > 8) window.clearInterval(timer);
      }, 450);

      const result = await createStudioCampaign({
        theme,
        audience,
        goal,
        platforms,
        style,
      });
      window.clearInterval(timer);

      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/partner/studio/campaigns/${result.campaignId}`);
    });
  }

  return (
    <div className="space-y-6">
      <nav aria-label="Campaign wizard steps" className="overflow-x-auto">
        <ol className="flex min-w-max gap-2">
          {steps.map((label, index) => (
            <li key={label}>
              <button
                type="button"
                onClick={() => index <= step && setStep(index)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] ${
                  index === step
                    ? "bg-[#2436BB] text-white"
                    : index < step
                      ? "bg-[#2436BB]/10 text-[#2436BB]"
                      : "bg-zinc-100 text-zinc-500"
                }`}
              >
                {index + 1}. {label}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {showPresets && step === 0 ? (
        <section aria-labelledby="preset-heading">
          <h2 id="preset-heading" className="text-lg font-semibold text-zinc-900">
            Campaign presets
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            Start from a template for your partner type, or skip and build a custom campaign.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {presets.map((item) => (
              <StudioSelectCard
                key={item.id}
                title={item.label}
                description={item.description}
                icon="spark"
                selected={presetId === item.id}
                onSelect={() => applyPreset(item.id)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {baseStep === 0 && !(showPresets && step === 0) ? (
        <section aria-labelledby="theme-heading">
          <h2 id="theme-heading" className="text-lg font-semibold text-zinc-900">
            What would you like to promote?
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {STUDIO_THEMES.map((item) => (
              <StudioSelectCard
                key={item.id}
                title={item.label}
                description={item.description}
                icon={item.icon}
                selected={theme === item.id}
                onSelect={() => setTheme(item.id)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {baseStep === 1 ? (
        <section aria-labelledby="audience-heading">
          <h2 id="audience-heading" className="text-lg font-semibold text-zinc-900">
            Who is your audience?
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {STUDIO_AUDIENCES.map((item) => (
              <StudioSelectCard
                key={item.id}
                title={item.label}
                description={item.description}
                icon={item.icon}
                selected={audience === item.id}
                onSelect={() => setAudience(item.id)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {baseStep === 2 ? (
        <section aria-labelledby="goal-heading">
          <h2 id="goal-heading" className="text-lg font-semibold text-zinc-900">
            Campaign goal
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {STUDIO_GOALS.map((item) => (
              <StudioSelectCard
                key={item.id}
                title={item.label}
                description={item.description}
                icon={item.icon}
                selected={goal === item.id}
                onSelect={() => setGoal(item.id)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {baseStep === 3 ? (
        <section aria-labelledby="platforms-heading">
          <h2 id="platforms-heading" className="text-lg font-semibold text-zinc-900">
            Platforms
          </h2>
          <p className="mt-1 text-sm text-zinc-600">Select one or more.</p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {STUDIO_PLATFORMS.map((item) => (
              <StudioSelectCard
                key={item.id}
                title={item.label}
                description={item.description}
                icon={item.icon}
                selected={platforms.includes(item.id)}
                onSelect={() => togglePlatform(item.id)}
                multi
              />
            ))}
          </div>
        </section>
      ) : null}

      {baseStep === 4 ? (
        <section aria-labelledby="style-heading">
          <h2 id="style-heading" className="text-lg font-semibold text-zinc-900">
            Style
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {STUDIO_STYLES.map((item) => (
              <StudioSelectCard
                key={item.id}
                title={item.label}
                description={item.description}
                icon={item.icon}
                selected={style === item.id}
                onSelect={() => setStyle(item.id)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {baseStep === 5 ? (
        <section aria-labelledby="branding-heading" className="space-y-4">
          <div>
            <h2 id="branding-heading" className="text-lg font-semibold text-zinc-900">
              {isOrganizationPartnerResolved
                ? "Organization branding"
                : "Partner branding"}
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              Campaigns automatically include your referral link, referral code, QR
              code, and JobProof branding
              {isFounding ? ", plus your Founding Partner badge" : ""}.
              {isOrganizationPartnerResolved
                ? " Uploaded organization logos are applied to co-branded graphics automatically."
                : ""}
            </p>
          </div>
          <StudioLogoUploader
            initialLogoUrl={initialLogoUrl}
            organizationName={organizationName}
          />
        </section>
      ) : null}

      {pending ? (
        <div
          className="rounded-2xl border border-[#2436BB]/20 bg-[#2436BB]/5 p-5"
          role="status"
          aria-live="polite"
        >
          <p className="text-sm font-semibold text-[#2436BB]">
            {PROGRESS_MESSAGES[progressIndex]}
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
            <div
              className="h-full rounded-full bg-[#F28C38] transition-all"
              style={{
                width: `${((progressIndex + 1) / PROGRESS_MESSAGES.length) * 100}%`,
              }}
            />
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || pending}
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
        >
          Back
        </button>
        {step < steps.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            disabled={!canContinue || pending}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#2436BB] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1c2a96] disabled:opacity-50"
          >
            {showPresets && step === 0 && !presetId
              ? "Skip presets"
              : "Continue"}
          </button>
        ) : (
          <button
            type="button"
            onClick={onGenerate}
            disabled={!canContinue || pending}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#F28C38] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#d97720] disabled:opacity-50"
          >
            Generate Campaign
          </button>
        )}
      </div>
    </div>
  );
}
