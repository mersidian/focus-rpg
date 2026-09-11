import { Icon, type IconName } from "./Icon";
import { classHue } from "@/lib/palette";

/**
 * A piece of gear's mark: the weapon takes its combat style, everything worn
 * takes the equipment mark. The same two rules `item-mark` uses, reached here
 * from a slot rather than an item id.
 */
export function GearMark({ slot, style }: { slot: string; style?: string }) {
  const name =
    slot === "weapon" && style ? ((style === "gun" ? "gunplay" : style) as IconName) : "equipment";
  return (
    <Icon
      name={name}
      className="size-4 shrink-0 self-center"
      style={{ color: classHue(slot === "weapon" ? "weapon" : "armour") }}
    />
  );
}
