export interface AbilityScores {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}

export interface InventoryItem {
  name: string;
  description?: string;
  cost?: number; // in gold pieces
}

export interface Character {
  id: string;
  name: string;
  race: string;
  class: string;
  background: string;
  level: number;
  ability_scores: AbilityScores;
  hit_points: number;
  armor_class: number;
  initiative: number;
  equipment: Array<string | InventoryItem>;
  spells: string[];
  spell_slots: number[];
  notes: string;
  // Optional extended fields used across the UI
  subclass?: string;
  subrace?: string;
  alignment: string;
  speed?: string;
  size?: string;
  hit_dice?: string;
  attacks?: Array<any>;
  max_hit_points?: number;
  temp_hp?: number;
  xp_current?: number;
  xp_max?: number;
  // Death saves: arrays of booleans for three successes/failures
  death_saves_success?: boolean[];
  death_saves_failure?: boolean[];
  // Proficiency state: 0 = none, 1 = proficient, 2 = half, 3 = expertise
  saving_throw_proficiencies?: Record<string, 0 | 1 | 2 | 3>;
  skill_proficiencies?: Record<string, 0 | 1 | 2 | 3>;
  // Lists for armor/weapon/tool proficiencies and known languages
  armor_proficiencies?: string[];
  weapon_proficiencies?: string[];
  tool_proficiencies?: string[];
  languages?: string[];
  // Optional UI flags
  heroic_inspiration?: boolean;
  // Track which long rest abilities have been used
  used_abilities?: string[];
  // Track used spell slots per level (e.g., { '1': [false, true] } means one used of two 1st-level slots)
  spell_slots_used?: Record<string, boolean[]>;
  // Currency
  currency?: {
    platinum?: number;
    gold?: number;
    silver?: number;
    copper?: number;
  };
}

/**
 * Calculate the ability modifier from an ability score
 * Formula: floor((score - 10) / 2)
 * @param score The ability score value
 * @returns The modifier number
 */
export function getAbilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/**
 * Calculate proficiency bonus based on character level
 * Formula: floor((level - 1) / 4) + 2
 * @param level The character's level
 * @returns The proficiency bonus
 */
export function getProficiencyBonus(level: number): number {
  return Math.floor((level - 1) / 4) + 2;
}
