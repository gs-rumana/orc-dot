"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  FUR_COATS,
  FUR_COLORS,
  type FurryOptions,
} from "@/lib/avatar/three/types";
import { optionLabel, SKIN_COLORS } from "@/lib/avatar/catalog";
import { AVATAR_SKINS, type AvatarSkin } from "@/lib/avatar/types";

const PLUSH = (Object.keys(FUR_COLORS) as FurryOptions["color"][]).filter(
  (color): color is Exclude<FurryOptions["color"], "skin"> => color !== "skin",
);

/**
 * One color for the 3D orc: bright plush colors, then the orc skin tones.
 * Picking a skin tone wears it as fur and keeps the 2D skin field in sync.
 */
export function FurryControls({
  value,
  skin,
  onChange,
  onSkinChange,
}: {
  value: FurryOptions;
  skin: AvatarSkin;
  onChange: (next: FurryOptions) => void;
  onSkinChange: (skin: AvatarSkin) => void;
}) {
  const current = value.color === "skin" ? skin : value.color;
  return (
    <div className="mb-5 space-y-4 border-b pb-5">
      <section aria-labelledby="fur-color">
        <div className="mb-2 flex items-center justify-between">
          <h3 id="fur-color" className="text-[0.95rem] font-medium">
            Color
          </h3>
          <span className="text-xs text-muted-foreground">
            {optionLabel(current)}
          </span>
        </div>
        <ToggleGroup
          aria-labelledby="fur-color"
          value={[current]}
          onValueChange={(values) => {
            const picked = values[0];
            const plush = PLUSH.find((color) => color === picked);
            if (plush) return onChange({ ...value, color: plush });
            const tone = AVATAR_SKINS.find((option) => option === picked);
            if (!tone) return;
            onChange({ ...value, color: "skin" });
            onSkinChange(tone);
          }}
          className="flex flex-wrap justify-start gap-2"
        >
          {[
            ...PLUSH.map((color) => [color, FUR_COLORS[color]] as const),
            ...AVATAR_SKINS.map(
              (tone) => [tone, SKIN_COLORS[tone].fill] as const,
            ),
          ].map(([option, hex]) => (
            <ToggleGroupItem
              key={option}
              value={option}
              aria-label={optionLabel(option)}
              title={optionLabel(option)}
              style={{ backgroundColor: hex }}
              className="size-8 min-w-8 rounded-full border-2 border-swatch-edge p-0 ring-offset-2 ring-offset-card hover:scale-110 aria-pressed:ring-2 aria-pressed:ring-primary"
            />
          ))}
        </ToggleGroup>
      </section>
      <section aria-labelledby="fur-texture">
        <h3 id="fur-texture" className="mb-2 text-[0.95rem] font-medium">
          Fur texture
        </h3>
        <ToggleGroup
          aria-labelledby="fur-texture"
          value={[value.coat]}
          onValueChange={(values) => {
            const coat = FUR_COATS.find((option) => option === values[0]);
            if (coat) onChange({ ...value, coat });
          }}
          className="justify-start gap-2"
        >
          {FUR_COATS.map((coat) => (
            <ToggleGroupItem
              key={coat}
              value={coat}
              className="h-8 rounded-full border bg-card px-3 text-[0.8rem] font-semibold hover:bg-accent aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
            >
              {optionLabel(coat)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </section>
    </div>
  );
}
