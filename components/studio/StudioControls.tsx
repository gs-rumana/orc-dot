"use client";

import type { ComponentType } from "react";
import { Tabs } from "@base-ui/react/tabs";
import {
  Activity,
  Brush,
  Category,
  Colorfilter,
  ColorSwatch,
  Crown1,
  Diamonds,
  EmojiHappy,
  Eye,
  Ghost,
  Magicpen,
  Scissor,
  Shield,
  Smileys,
  Wind,
} from "iconsax-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { HAIR_COLORS, SKIN_COLORS, optionLabel } from "@/lib/avatar/catalog";
import { normalizeConfig } from "@/lib/avatar/normalize";
import { AVATAR_OPTIONS, type AvatarConfig } from "@/lib/avatar/types";
import { cn } from "@/lib/utils";

type Field = keyof AvatarConfig;
type IconType = ComponentType<{ size?: number; variant?: "Bold"; color?: string }>;

interface SectionSpec {
  field: Field;
  title: string;
  icon: IconType;
  /** Renders options as colour dots instead of text chips. */
  swatches?: (value: string, config: AvatarConfig) => string;
  /** Overrides the display name of an option. */
  label?: (value: string) => string;
}

const TABS: { id: string; label: string; sections: SectionSpec[] }[] = [
  {
    id: "face",
    label: "Face",
    sections: [
      { field: "shape", title: "Shape", icon: Category },
      { field: "skin", title: "Skin", icon: Colorfilter, swatches: (v) => SKIN_COLORS[v as AvatarConfig["skin"]].fill },
      { field: "ears", title: "Ears", icon: Ghost },
      { field: "eyes", title: "Eyes", icon: Eye },
      { field: "brows", title: "Brows", icon: Smileys },
      { field: "mouth", title: "Mouth", icon: EmojiHappy },
      { field: "tusks", title: "Tusks", icon: Shield },
    ],
  },
  {
    id: "gear",
    label: "Gear",
    sections: [
      { field: "hair", title: "Hair", icon: Brush },
      {
        field: "hairColor",
        title: "Hair color",
        icon: ColorSwatch,
        swatches: (v, config) =>
          v === "match" ? SKIN_COLORS[config.skin].fur : HAIR_COLORS[v as keyof typeof HAIR_COLORS],
      },
      { field: "beard", title: "Beard", icon: Scissor },
      { field: "headgear", title: "Headgear", icon: Crown1 },
      { field: "markings", title: "War paint", icon: Magicpen },
      { field: "trinket", title: "Trinkets", icon: Diamonds },
    ],
  },
  {
    id: "motion",
    label: "Motion",
    sections: [
      { field: "motion", title: "Body motion", icon: Wind },
      { field: "eyeMotion", title: "Eye motion", icon: Activity },
    ],
  },
];

const CHIP =
  "h-8 rounded-full border border-border bg-card px-3 text-[0.8rem] font-semibold text-foreground/80 hover:bg-accent aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground";

const SWATCH =
  "size-8 min-w-8 rounded-full border-2 border-black/10 p-0 ring-offset-2 ring-offset-card hover:scale-110 aria-pressed:ring-2 aria-pressed:ring-primary";

function Section({
  spec,
  value,
  onPick,
}: {
  spec: SectionSpec;
  value: AvatarConfig;
  onPick: (field: Field, next: string) => void;
}) {
  const Icon = spec.icon;
  const current = value[spec.field];
  const label = spec.label ?? optionLabel;
  const headingId = `section-${spec.field}`;
  return (
    <section className="space-y-2.5" aria-labelledby={headingId}>
      <div className="flex items-center gap-2 text-foreground">
        <span className="text-primary">
          <Icon size={18} variant="Bold" color="currentColor" />
        </span>
        <h3 id={headingId} className="text-[0.95rem] font-medium">
          {spec.title}
        </h3>
        {spec.swatches ? (
          <span className="ml-auto text-xs font-semibold text-muted-foreground">
            {label(current)}
          </span>
        ) : null}
      </div>
      <ToggleGroup
        value={[current]}
        onValueChange={(v) => {
          if (v[0]) onPick(spec.field, v[0]);
        }}
        aria-labelledby={headingId}
        className="flex flex-wrap justify-start gap-1.5"
      >
        {(AVATAR_OPTIONS[spec.field] as readonly string[]).map((option) =>
          spec.swatches ? (
            <ToggleGroupItem
              key={option}
              value={option}
              aria-label={label(option)}
              title={label(option)}
              className={SWATCH}
              style={{ backgroundColor: spec.swatches(option, value) }}
            />
          ) : (
            <ToggleGroupItem
              key={option}
              value={option}
              aria-label={label(option)}
              className={CHIP}
            >
              {label(option)}
            </ToggleGroupItem>
          ),
        )}
      </ToggleGroup>
    </section>
  );
}

export function StudioControls({
  value,
  onChange,
  hidden = [],
  matchHairColor,
}: {
  value: AvatarConfig;
  onChange: (next: AvatarConfig) => void;
  /** Fields another panel already controls (3D shows skin as its Color). */
  hidden?: Field[];
  /** Swatch for "match" hair when it follows something other than the skin. */
  matchHairColor?: string;
}) {
  // The field just picked wins any conflict (e.g. a helm replaces a mohawk).
  const onPick = (field: Field, next: string) => {
    onChange(normalizeConfig({ ...value, [field]: next }, field));
  };

  return (
    <Tabs.Root defaultValue="face" className="flex flex-col gap-4">
      <Tabs.List className="grid grid-cols-3 gap-1 rounded-full bg-muted p-1">
        {TABS.map((tab) => (
          <Tabs.Tab
            key={tab.id}
            value={tab.id}
            className={cn(
              "h-9 rounded-full font-heading text-[0.95rem] font-medium text-muted-foreground outline-none transition-colors",
              "hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
              "data-[active]:bg-card data-[active]:text-foreground data-[active]:shadow-sm",
            )}
          >
            {tab.label}
          </Tabs.Tab>
        ))}
      </Tabs.List>
      {TABS.map((tab) => (
        <Tabs.Panel key={tab.id} value={tab.id} className="flex flex-col gap-5 outline-none">
          {tab.sections
            .filter((spec) => !hidden.includes(spec.field))
            .map((spec) => (
              <Section
                key={spec.field}
                spec={
                  spec.field === "hairColor" && matchHairColor
                    ? {
                        ...spec,
                        swatches: (v, config) =>
                          v === "match" ? matchHairColor : spec.swatches!(v, config),
                        label: (v) => (v === "match" ? "Match color" : optionLabel(v)),
                      }
                    : spec
                }
                value={value}
                onPick={onPick}
              />
            ))}
        </Tabs.Panel>
      ))}
    </Tabs.Root>
  );
}
