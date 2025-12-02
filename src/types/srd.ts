export interface ListResult {
  index: string;
  name: string;
  url: string;
}

export interface Spell {
  index: string;
  name: string;
  desc?: string[];
  higher_level?: string[];
  range?: string;
  components?: string[];
  ritual?: boolean;
  duration?: string;
  concentration?: boolean;
  casting_time?: string;
  level?: number;
  school?: { name: string };
}

export interface Monster {
  index: string;
  name: string;
  size?: string;
  type?: string;
  alignment?: string;
  hit_points?: number;
  challenge_rating?: number;
  actions?: any[];
}

export interface Equipment {
  index: string;
  name: string;
  equipment_category?: string;
  cost?: { quantity: number; unit: string };
  weight?: number;
  desc?: string[];
}
