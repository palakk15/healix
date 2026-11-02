import { useState, type KeyboardEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { BodyArea, BodyView } from "@core/domain/bodyAreas";
import { cn } from "../../lib/cn";

export interface BodyMapProps {
  selected: readonly BodyArea[];
  onToggle: (area: BodyArea) => void;
}

function regionsFor(view: BodyView): Array<{ area: BodyArea; shape: (props: Record<string, unknown>) => ReactNode }> {
  const personRightOnViewerLeft = view === "front";
  const leftArmX = personRightOnViewerLeft ? 142 : 36;
  const rightArmX = personRightOnViewerLeft ? 36 : 142;
  const leftLegX = personRightOnViewerLeft ? 102 : 68;
  const rightLegX = personRightOnViewerLeft ? 68 : 102;
  const leftKneeX = personRightOnViewerLeft ? 117 : 83;
  const rightKneeX = personRightOnViewerLeft ? 83 : 117;

  return [
    { area: "head", shape: (p) => <circle cx="100" cy="42" r="28" {...p} /> },
    { area: "neck", shape: (p) => <rect x="86" y="68" width="28" height="22" rx="8" {...p} /> },
    { area: view === "front" ? "chest" : "upperBack", shape: (p) => <rect x="62" y="92" width="76" height="64" rx="14" {...p} /> },
    { area: view === "front" ? "stomach" : "lowerBack", shape: (p) => <rect x="66" y="158" width="68" height="62" rx="14" {...p} /> },
    { area: "leftArm", shape: (p) => <rect x={leftArmX} y="94" width="22" height="126" rx="11" {...p} /> },
    { area: "rightArm", shape: (p) => <rect x={rightArmX} y="94" width="22" height="126" rx="11" {...p} /> },
    { area: "hips", shape: (p) => <rect x="66" y="222" width="68" height="40" rx="14" {...p} /> },
    { area: "leftLeg", shape: (p) => <rect x={leftLegX} y="264" width="30" height="120" rx="14" {...p} /> },
    { area: "rightLeg", shape: (p) => <rect x={rightLegX} y="264" width="30" height="120" rx="14" {...p} /> },
    { area: "leftKnee", shape: (p) => <circle cx={leftKneeX} cy="320" r="15" {...p} /> },
    { area: "rightKnee", shape: (p) => <circle cx={rightKneeX} cy="320" r="15" {...p} /> },
  ];
}

export function BodyMap({ selected, onToggle }: BodyMapProps) {
  const { t } = useTranslation();
  const [view, setView] = useState<BodyView>("front");

  const onKey = (event: KeyboardEvent<SVGGElement>, area: BodyArea) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onToggle(area);
    }
  };

  return (
    <div>
      <div role="group" aria-label={t("triage.bodyMap.title")} className="mb-3 inline-flex rounded-pill border border-line bg-surface p-1">
        {(["front", "back"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={view === option}
            onClick={() => setView(option)}
            className={cn("type-small min-h-9 rounded-pill px-4 font-medium", view === option ? "bg-ink text-bg" : "text-ink-2")}
          >
            {t(`triage.bodyMap.${option}`)}
          </button>
        ))}
      </div>
      <svg viewBox="0 0 200 400" role="group" aria-label={t("triage.bodyMap.title")} className="mx-auto block h-[340px] w-auto max-w-full">
        {regionsFor(view).map(({ area, shape }) => {
          const active = selected.includes(area);
          return (
            <g
              key={area}
              role="button"
              tabIndex={0}
              aria-pressed={active}
              aria-label={t(`triage.bodyMap.areas.${area}`)}
              onClick={() => onToggle(area)}
              onKeyDown={(event) => onKey(event, area)}
              className="cursor-pointer outline-none [&:focus-visible>*]:stroke-accent [&:focus-visible>*]:stroke-[3]"
            >
              {shape({
                fill: active ? "var(--accent)" : "var(--surface)",
                fillOpacity: active ? 0.4 : 1,
                stroke: active ? "var(--accent)" : "var(--line)",
                strokeWidth: 2,
                className: "transition-colors hover:fill-accent-soft",
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
