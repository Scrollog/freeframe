/** The "Appearance" and "Sorted by" controls shared by both browse grids. */
import { useApp } from "../state";
import { Dropdown, MenuRadio } from "./Dropdown";
import { IconAppearance, IconSortArrows } from "./Icons";
import type { Settings } from "../../lib/freeframe/settings";

type CardSize = Settings["cardSize"];

const SIZES: { key: CardSize; label: string; width: number }[] = [
  { key: "small", label: "Small", width: 118 },
  { key: "medium", label: "Medium", width: 170 },
  { key: "large", label: "Large", width: 240 },
];

/** Grid track width for the chosen size — cards no longer size themselves. */
export const cardMinWidth = (size: CardSize): number =>
  SIZES.find((entry) => entry.key === size)?.width ?? 170;

export const AppearanceMenu = () => {
  const { settings, updateSettings } = useApp();
  return (
    <Dropdown
      align="left"
      triggerClass="bar-btn"
      title="Card size"
      trigger={
        <>
          <IconAppearance width={14} height={14} />
          Appearance
        </>
      }
    >
      {(close) =>
        SIZES.map((size) => (
          <MenuRadio
            key={size.key}
            label={size.label}
            checked={settings.cardSize === size.key}
            onSelect={() => {
              updateSettings({ cardSize: size.key });
              close();
            }}
          />
        ))
      }
    </Dropdown>
  );
};

export const SortedByMenu = <Key extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: Key; label: string }[];
  value: Key;
  onChange: (key: Key) => void;
}) => (
  <Dropdown
    align="left"
    triggerClass="bar-btn"
    title="Sort by"
    trigger={
      <>
        <IconSortArrows width={14} height={14} />
        Sorted by <strong>{options.find((o) => o.key === value)?.label}</strong>
      </>
    }
  >
    {(close) =>
      options.map((option) => (
        <MenuRadio
          key={option.key}
          label={option.label}
          checked={value === option.key}
          onSelect={() => {
            onChange(option.key);
            close();
          }}
        />
      ))
    }
  </Dropdown>
);
