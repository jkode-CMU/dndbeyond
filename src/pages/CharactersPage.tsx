import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { Character, getAbilityModifier, getProficiencyBonus } from '../types/character';
import ConfirmModal from '../components/ConfirmModal';
import ErrorBoundary from '../components/ErrorBoundary';

/**
 * Characters page displaying the character list and creation
 * Loads characters from backend, allows creating new ones and deleting existing
 */
export default function CharactersPage() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const loadCharacters = async () => {
    try {
      setLoading(true);
      const data = await invoke<Character[]>('load_characters');
      setCharacters(data);
    } catch (error) {
      console.error('Failed to load characters:', error);
    } finally {
      setLoading(false);
    }
  };

  const [confirmDeleteCharacterId, setConfirmDeleteCharacterId] = useState<string | null>(null);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteCharacterId(id);
  };

  const confirmDeleteCharacter = async (id: string) => {
    try {
      await invoke('delete_character', { id });
      await loadCharacters();
    } catch (error) {
      console.error('Failed to delete character:', error);
    } finally {
      setConfirmDeleteCharacterId(null);
    }
  };

  const cancelDeleteCharacter = () => setConfirmDeleteCharacterId(null);

  useEffect(() => {
    loadCharacters();
  }, []);

  const handleCreate = () => {
    setShowCreateForm(true);
  };

  return (
    <>
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Characters
        </h1>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity"
        >
          <Plus className="w-5 h-5" />
          New Character
        </button>
      </div>

      {showCreateForm && (
        <CharacterCreationForm
          onClose={() => setShowCreateForm(false)}
          onSuccess={async () => {
            setShowCreateForm(false);
            await loadCharacters();
          }}
        />
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-600 dark:text-gray-400">
          Loading...
        </div>
      ) : characters.length === 0 ? (
        <div className="text-center py-12 text-gray-600 dark:text-gray-400">
          No characters yet. Create your first character!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {characters.map((character) => (
            <div
              key={character.id}
              onClick={() => navigate(`/character/${character.id}`)}
              className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 cursor-pointer hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {character.name}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    Level {character.level} {character.race} {character.class}
                  </p>
                </div>
                <button
                  onClick={(e) => handleDelete(character.id, e)}
                  className="p-2 hover:bg-red-100 dark:hover:bg-red-900 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    <ConfirmModal
      open={!!confirmDeleteCharacterId}
      title="Delete Character"
      message="Are you sure you want to delete this character? This will remove it permanently."
      onConfirm={() => confirmDeleteCharacter(confirmDeleteCharacterId as string)}
      onCancel={cancelDeleteCharacter}
    />
    </>
  );
}

/**
 * Character creation form component
 * Allows users to input initial character information to create a new character
 */

function PointBuyEditor({ scores, setScores }: { scores: Record<string, number>, setScores: (s: Record<string, number>) => void }) {
  // Updated cost table: 9-13 => 1, 14-15 => 2
  const COST_TABLE: Record<number, number> = {9:1,10:1,11:1,12:1,13:1,14:2,15:2};
  const costFor = (score: number) => {
    if (score <= 8) return 0;
    let cost = 0;
    for (let s = 9; s <= score; s++) cost += COST_TABLE[s] ?? 0;
    return cost;
  };
  const totalCost = Object.values(scores).reduce((acc, v) => acc + costFor(v), 0);
  const remaining = 27 - totalCost;

  const change = (ability: string, delta: number) => {
    setScores({ ...scores, [ability]: Math.min(15, Math.max(8, scores[ability] + delta)) });
  };

  return (
    <div>
      <div className={`text-sm mb-2 ${remaining < 0 ? 'text-red-600' : ''}`}>Remaining points: <strong>{remaining}</strong></div>
      <div className="grid grid-cols-3 gap-2">
        {Object.entries(scores).map(([ability, value]) => (
          <div key={ability} className="flex items-center gap-2">
            <div className="w-28 capitalize text-xs">{ability}</div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => change(ability, -1)} className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded">-</button>
              <div className="px-3 py-1 border rounded bg-white dark:bg-gray-700">{value}</div>
              <button type="button" onClick={() => change(ability, +1)} className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded">+</button>
            </div>
            <div className="text-xs text-gray-500 ml-2">Cost: {costFor(value)}</div>
          </div>
        ))}
      </div>
      {remaining < 0 && <div className="text-xs text-red-600 mt-2">Point buy exceeds available points. Lower some scores.</div>}
    </div>
  );
}

function CharacterCreationForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [formData, setFormData] = useState({
    name: '',
    alignment: '',
  });
  // Separate selection state for the new multi-step tabs
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedBackground, setSelectedBackground] = useState('');
  const [selectedSpecies, setSelectedSpecies] = useState('');
  const [abilities, setAbilities] = useState({
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
  });
  // Ability creation method: 'standard'|'rolled'|'pointbuy'|'manual'
  const [abilityMethod, setAbilityMethod] = useState<'standard'|'rolled'|'pointbuy'|'manual'>('standard');

  // Standard array options and assignments
  const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
  const [standardAssigned, setStandardAssigned] = useState<Record<string, number>>({});

  // Point buy state (scores start at 8)
  const [pointBuyScores, setPointBuyScores] = useState<Record<string, number>>({
    strength: 8,
    dexterity: 8,
    constitution: 8,
    intelligence: 8,
    wisdom: 8,
    charisma: 8,
  });

  // Rolled pool for 'rolled' method: six rolled values to assign
  const [rolledPool, setRolledPool] = useState<number[]>([]);

  // Creation flow tab: 'basic' | 'abilities' | 'review'
  const [creationTab, setCreationTab] = useState<'basic'|'class'|'background'|'species'|'abilities'|'review'>('basic');

  // Inline error messages for tabs
  const [basicError, setBasicError] = useState<string | null>(null);
  const [abilitiesError, setAbilitiesError] = useState<string | null>(null);
  const [classError, setClassError] = useState<string | null>(null);
  const [backgroundError, setBackgroundError] = useState<string | null>(null);
  const [speciesError, setSpeciesError] = useState<string | null>(null);
  // Half-Elf specific choices
  const [halfElfExtraAbilities, setHalfElfExtraAbilities] = useState<string[]>([]);
  const [halfElfSkills, setHalfElfSkills] = useState<string[]>([]);
  const [halfElfExtraLanguage, setHalfElfExtraLanguage] = useState('');
  // Human extra language choice
  const [humanExtraLanguage, setHumanExtraLanguage] = useState('');
  // Half-Elf internal view tab: 'choices' shows the selection UI, 'details' shows lore/traits
  const [halfElfViewTab, setHalfElfViewTab] = useState<'choices'|'details'>('choices');
  // Halfling subrace selection ('Lightfoot' | 'Stout')
  const [selectedHalflingSubrace, setSelectedHalflingSubrace] = useState<'Lightfoot'|'Stout'|''>('');
  // Gnome subrace selection (default to Rock Gnome when Gnome chosen)
  const [selectedGnomeSubrace, setSelectedGnomeSubrace] = useState<'Rock Gnome'|''>('');
  // Criminal background: selected gaming set (default to "Dice set")
  const [criminalGamingSet, setCriminalGamingSet] = useState<string>('Dice set');
  // Bard class: equipment choices
  const [bardWeaponChoice, setBardWeaponChoice] = useState<'rapier' | 'longsword' | 'simple'>('rapier');
  const [bardSimpleWeapon, setBardSimpleWeapon] = useState<string>('Club');
  const [bardPackChoice, setBardPackChoice] = useState<'diplomat' | 'entertainer'>('diplomat');
  const [bardInstrumentChoice1, setBardInstrumentChoice1] = useState<'lute' | 'other'>('lute');
  const [bardOtherInstrument, setBardOtherInstrument] = useState<string>('Flute');
  const [bardMusicalInstruments, setBardMusicalInstruments] = useState<string[]>(['Lute', 'Flute', 'Drum']);
  const [bardSkills, setBardSkills] = useState<string[]>([]);
  const [bardCantrips, setBardCantrips] = useState<string[]>([]);
  const [bardSpells, setBardSpells] = useState<string[]>([]);
  const [bardViewTab, setBardViewTab] = useState<'equipment' | 'spells'>('equipment');
  const [expandedBardSpells, setExpandedBardSpells] = useState<Record<string, boolean>>({});
  const [bardSpellDetails, setBardSpellDetails] = useState<Record<string, any>>({});
  // General proficiencies maps editable via modal
  const [skillProficiencies, setSkillProficiencies] = useState<Record<string, 0 | 1 | 2 | 3>>({});
  const [savingThrowProficiencies, setSavingThrowProficiencies] = useState<Record<string, 0 | 1 | 2 | 3>>({});
  const [showEditProfsModal, setShowEditProfsModal] = useState(false);
  // Temporary copies used when editing proficiencies in the modal
  const [tempSkillProficiencies, setTempSkillProficiencies] = useState<Record<string, 0 | 1 | 2 | 3> | null>(null);
  const [tempSavingThrowProficiencies, setTempSavingThrowProficiencies] = useState<Record<string, 0 | 1 | 2 | 3> | null>(null);

  // Compute a view of abilities according to selected method (for live preview/modifiers)
  const getDisplayedAbilities = () => {
    if (abilityMethod === 'standard') {
      const keys = Object.keys(abilities);
      const out: Record<string, number> = {};
      keys.forEach(k => { out[k] = standardAssigned[k] ?? abilities[k as keyof typeof abilities]; });
      return out;
    }
    if (abilityMethod === 'pointbuy') return pointBuyScores;
    return abilities;
  };
  // (No multi-tab flow in this form; abilities are shown inline.)

  const rollStat = () => {
    const dice = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1);
    const sum = dice.reduce((a, b) => a + b);
    const min = Math.min(...dice);
    return sum - min;
  };

  const rollAllStats = () => {
    // create a pool of six rolls and clear assigned abilities for user assignment
    const pool = [rollStat(), rollStat(), rollStat(), rollStat(), rollStat(), rollStat()];
    setRolledPool(pool);
    setAbilities({
      strength: 0,
      dexterity: 0,
      constitution: 0,
      intelligence: 0,
      wisdom: 0,
      charisma: 0,
    });
  };

  // Helper: compute cost for a given score in point buy (base 8)
  const pointBuyCostFor = (score: number) => {
    if (score <= 8) return 0;
    // Custom cost table: 9-13 => 1 each, 14-15 => 2 each
    const table: Record<number, number> = {9:1,10:1,11:1,12:1,13:1,14:2,15:2};
    let cost = 0;
    for (let s = 9; s <= score; s++) {
      cost += table[s] ?? 0;
    }
    return cost;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    // Validate basic and abilities before submitting
    // validate through all tabs where applicable
    if (!validateBasic()) return;
    if (!validateClassTab()) return;
    if (!validateBackgroundTab()) return;
    if (!validateSpeciesTab()) return;
    if (!validateAbilities()) return;

    // Determine final abilities based on chosen method
    let finalAbilities: Record<string, number> = {};
    if (abilityMethod === 'standard') {
      // Ensure all abilities have an assigned value
      const keys = Object.keys(abilities);
      const assignedAll = keys.every(k => !!standardAssigned[k]);
      if (!assignedAll) {
        setAbilitiesError('Please assign all standard array values to abilities');
        setCreationTab('abilities');
        return;
      }
      keys.forEach(k => { finalAbilities[k] = standardAssigned[k]; });
    } else if (abilityMethod === 'rolled' || abilityMethod === 'manual') {
      finalAbilities = { ...abilities };
    } else if (abilityMethod === 'pointbuy') {
      // validate point buy total
      const total = Object.values(pointBuyScores).reduce((s, v) => s + pointBuyCostFor(v), 0);
      if (total > 27) {
        setAbilitiesError('Point buy exceeds available points (27). Adjust scores.');
        setCreationTab('abilities');
        return;
      }
      finalAbilities = { ...pointBuyScores };
    }

    // Apply racial bonuses (Half-Elf)
    if (selectedSpecies === 'Half-Elf') {
      // ensure charisma +2
      finalAbilities.charisma = (finalAbilities.charisma ?? 0) + 2;
      // apply two other +1 choices
      halfElfExtraAbilities.slice(0,2).forEach((a) => {
        if (a) finalAbilities[a] = (finalAbilities[a] ?? 0) + 1;
      });
    }
    // Apply racial bonuses (Tiefling)
    if (selectedSpecies === 'Tiefling') {
      finalAbilities.intelligence = (finalAbilities.intelligence ?? 0) + 1;
      finalAbilities.charisma = (finalAbilities.charisma ?? 0) + 2;
    }
    // Apply racial bonuses (Gnome)
    if (selectedSpecies === 'Gnome') {
      // Gnome: +2 Intelligence
      finalAbilities.intelligence = (finalAbilities.intelligence ?? 0) + 2;
      // Default to Rock Gnome subrace: +1 Constitution
      finalAbilities.constitution = (finalAbilities.constitution ?? 0) + 1;
    }
    // Apply racial bonuses (Half-Orc)
    if (selectedSpecies === 'Half-Orc') {
      finalAbilities.strength = (finalAbilities.strength ?? 0) + 2;
      finalAbilities.constitution = (finalAbilities.constitution ?? 0) + 1;
    }
    // Apply racial bonuses (Human): +1 to all abilities
    if (selectedSpecies === 'Human') {
      Object.keys(finalAbilities).forEach((k) => {
        finalAbilities[k] = (finalAbilities[k] ?? 0) + 1;
      });
    }
    // Apply racial bonuses (Halfling)
    if (selectedSpecies === 'Halfling') {
      finalAbilities.dexterity = (finalAbilities.dexterity ?? 0) + 2;
      if (selectedHalflingSubrace === 'Lightfoot') {
        finalAbilities.charisma = (finalAbilities.charisma ?? 0) + 1;
      } else if (selectedHalflingSubrace === 'Stout') {
        finalAbilities.constitution = (finalAbilities.constitution ?? 0) + 1;
      }
    }

    try {
      const speciesDefaults = getSpeciesDefaults(selectedSpecies);
      // Merge temporary skill proficiencies with species-granted proficiencies (Half-Orc: Intimidation)
      const mergedSkillProficiencies: Record<string, 0 | 1 | 2 | 3> = { ...(skillProficiencies || {}) };
      if (selectedSpecies === 'Half-Orc') {
        mergedSkillProficiencies['Intimidation'] = 1;
      }
      // Apply background-granted skill proficiencies (Criminal)
      if (selectedBackground === 'Criminal') {
        mergedSkillProficiencies['Deception'] = 1;
        mergedSkillProficiencies['Stealth'] = 1;
      }

      // Apply class-granted skill proficiencies (Bard)
      if (selectedClass === 'Bard') {
        bardSkills.forEach(skill => {
          mergedSkillProficiencies[skill] = 1;
        });
      }

      // Merge tool proficiencies: start with species defaults and add any background-granted tools
      const mergedToolProficiencies: string[] = Array.isArray(speciesDefaults.tool_proficiencies) ? [...speciesDefaults.tool_proficiencies] : [];

      // Apply class-granted tool proficiencies (Bard: 3 musical instruments)
      if (selectedClass === 'Bard') {
        bardMusicalInstruments.forEach(inst => {
          if (!mergedToolProficiencies.includes(inst)) mergedToolProficiencies.push(inst);
        });
      }
      if (selectedBackground === 'Criminal') {
        if (!mergedToolProficiencies.includes("Thieves' tools")) mergedToolProficiencies.push("Thieves' tools");
        if (criminalGamingSet && !mergedToolProficiencies.includes(criminalGamingSet)) mergedToolProficiencies.push(criminalGamingSet);
      }

      // Class-specific equipment and saving throws
      const classEquipment: string[] = [];
      const classSavingThrows: Record<string, 0 | 1 | 2 | 3> = {};

      if (selectedClass === 'Bard') {
        // Bard saving throws: dexterity, charisma (use lowercase keys to match sheet lookup)
        classSavingThrows['dexterity'] = 1;
        classSavingThrows['charisma'] = 1;

        // Weapon choice
        if (bardWeaponChoice === 'rapier') {
          classEquipment.push('Rapier');
        } else if (bardWeaponChoice === 'longsword') {
          classEquipment.push('Longsword');
        } else if (bardWeaponChoice === 'simple') {
          classEquipment.push(bardSimpleWeapon);
        }

        // Pack choice
        if (bardPackChoice === 'diplomat') {
          classEquipment.push("Diplomat's pack");
        } else {
          classEquipment.push("Entertainer's pack");
        }

        // First instrument choice
        if (bardInstrumentChoice1 === 'lute') {
          classEquipment.push('Lute');
        } else {
          classEquipment.push(bardOtherInstrument);
        }

        // Always include leather armor and dagger
        classEquipment.push('Leather armor');
        classEquipment.push('Dagger');
      }

      // Background-specific equipment
      const backgroundEquipment: string[] = [];
      // default currency for background (if any)
      let backgroundCurrency: { platinum?: number; gold?: number; silver?: number; copper?: number } | undefined;
      if (selectedBackground === 'Criminal') {
        backgroundEquipment.push('Crowbar');
        backgroundEquipment.push("Dark common clothes (hood)");
        // Give thieves' tools as an inventory item as well as a tool proficiency
        if (!backgroundEquipment.includes("Thieves' tools")) backgroundEquipment.push("Thieves' tools");
        // Instead of an item for gold, set starting gold to 15 gp
        backgroundCurrency = { gold: 15 };
      }

      // Background note text (appended to species notes)
      const backgroundNote = selectedBackground === 'Criminal'
        ? `Criminal (Spy): Criminal Contact — You have a reliable and trustworthy contact who acts as your liaison to a network of criminals and mail/messenger routes.`
        : '';
      // Build species note text (existing inline strings)
      const speciesNote = selectedSpecies === 'Half-Elf'
        ? `Half-Elf choices: +2 Charisma; +1 to ${halfElfExtraAbilities.join(', ')}. Skills: ${halfElfSkills.join(', ')}. Extra language: ${halfElfExtraLanguage}.`
        : selectedSpecies === 'Tiefling'
        ? `Tiefling: +2 Charisma, +1 Intelligence. Languages: Common, Infernal. Traits: Darkvision (60 ft.), Hellish Resistance (fire resistance), Infernal Legacy (thaumaturgy cantrip; hellish rebuke at 3rd level, darkness at 5th).`
        : selectedSpecies === 'Half-Orc'
        ? `Half-Orc: +2 Strength, +1 Constitution. Languages: Common, Orc. Traits: Darkvision (60 ft.), Menacing (proficiency in Intimidation), Relentless Endurance (when reduced to 0 HP you drop to 1 HP instead, once per long rest), Savage Attacks (extra weapon damage die on crit).`
        : selectedSpecies === 'Halfling'
        ? `Halfling (${selectedHalflingSubrace}): +2 Dexterity${selectedHalflingSubrace === 'Lightfoot' ? ', +1 Charisma' : selectedHalflingSubrace === 'Stout' ? ', +1 Constitution' : ''}. Size: Small. Speed: 25 ft. Languages: Common, Halfling. Traits: Lucky (reroll 1s), Brave (advantage vs frightened), Nimble (move through larger creatures)${selectedHalflingSubrace === 'Lightfoot' ? ', Naturally Stealthy (hide when obscured by larger creature)' : selectedHalflingSubrace === 'Stout' ? ', Stout Resilience (advantage vs poison, resistance to poison damage)' : ''}.`
        : selectedSpecies === 'Gnome'
        ? `Gnome (Rock Gnome): +2 Intelligence; +1 Constitution. Size: Small. Speed: 25 ft. Languages: Common, Gnomish. Traits: Darkvision (60 ft.), Gnome Cunning (advantage on Int/Wis/Cha saves vs magic), Artificer's Lore (double proficiency on history checks related to magic items/alchemical/technological devices), Tinker (proficiency with tinker's tools; can spend 1 hour and 10 gp materials to create small clockwork devices).`
        : '';

      // Merge class and background equipment
      const allEquipment = [...classEquipment, ...backgroundEquipment];

      // Merge class saving throws with existing saving throw proficiencies
      const mergedSavingThrows = { ...savingThrowProficiencies, ...classSavingThrows };

      // Calculate armor class based on class (Bard gets Leather armor = 11 + Dex mod)
      let startingAC = 10 + Math.floor(((finalAbilities.dexterity ?? 10) - 10) / 2);
      if (selectedClass === 'Bard') {
        // Leather armor: 11 + Dex modifier
        startingAC = 11 + Math.floor(((finalAbilities.dexterity ?? 10) - 10) / 2);
      }

      // Class-specific weapon proficiencies
      let classWeaponProfs: string[] = [];
      let classArmorProfs: string[] = [];
      if (selectedClass === 'Bard') {
        classWeaponProfs = ['Simple weapons', 'Hand crossbows', 'Longswords', 'Rapiers', 'Shortswords'];
        classArmorProfs = ['Light armor'];
      }

      const newCharacter: Character = {
        id: crypto.randomUUID(),
        name: formData.name,
        race: selectedSpecies,
        subrace: selectedSpecies === 'Halfling' ? (selectedHalflingSubrace || undefined) : (selectedSpecies === 'Gnome' ? (selectedGnomeSubrace || 'Rock Gnome') : undefined),
        class: selectedClass,
        alignment: formData.alignment,
        background: selectedBackground,
        level: 1,
        ability_scores: finalAbilities as any,
        hit_points: 8 + Math.floor(((finalAbilities.constitution ?? 10) - 10) / 2),
        max_hit_points: 8 + Math.floor(((finalAbilities.constitution ?? 10) - 10) / 2),
        armor_class: startingAC,
        initiative: Math.floor(((finalAbilities.dexterity ?? 10) - 10) / 2),
        equipment: allEquipment,
        spells: (() => {
          const spellList: string[] = [];
          if (selectedSpecies === 'Tiefling') spellList.push('Thaumaturgy');
          if (selectedClass === 'Bard') {
            spellList.push(...bardCantrips, ...bardSpells);
          }
          return spellList;
        })(),
        spell_slots: selectedClass === 'Bard' ? [2] : [],
        // initialize death saves so they persist and are visible in the sheet
        death_saves_success: [false, false, false],
        death_saves_failure: [false, false, false],
        // initialize spell slot usage tracking (for Bards, prefill two 1st-level slots)
        spell_slots_used: selectedClass === 'Bard' ? { '1': [false, false] } : {},
        notes: [speciesNote, backgroundNote].filter(Boolean).join(' '),
        skill_proficiencies: Object.keys(mergedSkillProficiencies).length ? mergedSkillProficiencies : undefined,
        saving_throw_proficiencies: Object.keys(mergedSavingThrows).length ? mergedSavingThrows : undefined,
        armor_proficiencies: [...(speciesDefaults.armor_proficiencies || []), ...classArmorProfs],
        weapon_proficiencies: [...(speciesDefaults.weapon_proficiencies || []), ...classWeaponProfs],
        tool_proficiencies: mergedToolProficiencies,
        languages: speciesDefaults.languages,
        // Persist background currency if set (e.g., Criminal starts with 15 gp)
        ...(backgroundCurrency ? { currency: backgroundCurrency } : {}),
        // Persist size/speed for Halflings
        ...(selectedSpecies === 'Halfling' ? { speed: '25 ft', size: 'Small' } : {}),
        // Persist size/speed for Half-Orc
        ...(selectedSpecies === 'Half-Orc' ? { speed: '30 ft', size: 'Medium' } : {}),
        // Persist size/speed for Gnomes (Rock Gnome)
        ...(selectedSpecies === 'Gnome' ? { speed: '25 ft', size: 'Small' } : {}),
      };

      await invoke('save_character', { character: newCharacter });
      onSuccess();
    } catch (error) {
      console.error('Failed to create character:', error);
      alert('Failed to create character');
    }
  };

  // Validation for Basic tab
  const validateBasic = () => {
    if (!formData.name || !formData.alignment) {
      setBasicError('Please fill in the name and alignment before continuing');
      setCreationTab('basic');
      return false;
    }
    setBasicError(null);
    return true;
  };

  const validateClassTab = () => {
    if (!selectedClass) {
      setClassError('Please select a class before continuing');
      setCreationTab('class');
      return false;
    }
    // Bard-specific validation
    if (selectedClass === 'Bard') {
      if (bardSkills.length !== 3) {
        setClassError('Please select exactly 3 skills for Bard');
        setCreationTab('class');
        return false;
      }
      if (bardMusicalInstruments.length !== 3) {
        setClassError('Please select exactly 3 musical instruments for Bard');
        setCreationTab('class');
        return false;
      }
      if (bardCantrips.length !== 2) {
        setClassError('Please select exactly 2 cantrips for Bard');
        setCreationTab('class');
        return false;
      }
      if (bardSpells.length !== 4) {
        setClassError('Please select exactly 4 1st level spells for Bard');
        setCreationTab('class');
        return false;
      }
    }
    setClassError(null);
    return true;
  };

  const validateBackgroundTab = () => {
    if (!selectedBackground) {
      setBackgroundError('Please select a background before continuing');
      setCreationTab('background');
      return false;
    }
    setBackgroundError(null);
    return true;
  };

  const validateSpeciesTab = () => {
    if (!selectedSpecies) {
      setSpeciesError('Please select a species before continuing');
      setCreationTab('species');
      return false;
    }
    // If Half-Elf selected, require extra choices
    if (selectedSpecies === 'Half-Elf') {
      if (halfElfExtraAbilities.length !== 2) {
        setSpeciesError('Select two other abilities to increase by +1 for Half-Elf');
        setCreationTab('species');
        return false;
      }
      if (halfElfSkills.length !== 2) {
        setSpeciesError('Select two skills for Skill Versatility');
        setCreationTab('species');
        return false;
      }
      if (!halfElfExtraLanguage) {
        setSpeciesError('Select an extra language for Half-Elf');
        setCreationTab('species');
        return false;
      }
    }
    // If Human selected, require an extra language choice
    if (selectedSpecies === 'Human') {
      if (!humanExtraLanguage) {
        setSpeciesError('Select an extra language for Human');
        setCreationTab('species');
        return false;
      }
    }
    // If Halfling selected, require subrace
    if (selectedSpecies === 'Halfling') {
      if (!selectedHalflingSubrace) {
        setSpeciesError('Select a Halfling subrace (Lightfoot or Stout)');
        setCreationTab('species');
        return false;
      }
    }
    setSpeciesError(null);
    return true;
  };

  // Validation for Abilities tab
  const validateAbilities = () => {
    if (abilityMethod === 'standard') {
      const keys = Object.keys(abilities);
      const assignedAll = keys.every(k => !!standardAssigned[k]);
      if (!assignedAll) {
        setAbilitiesError('Please assign all standard array values to abilities before continuing');
        setCreationTab('abilities');
        return false;
      }
    }
    if (abilityMethod === 'rolled') {
      // ensure every ability has been assigned a rolled value (non-zero)
      const keys = Object.keys(abilities);
      const assignedAll = keys.every(k => (abilities[k as keyof typeof abilities] ?? 0) > 0);
      if (!assignedAll) {
        setAbilitiesError('Please assign each rolled value to an ability before continuing');
        setCreationTab('abilities');
        return false;
      }
      // ensure assignments don't exceed available pool counts
      const poolCounts: Record<number, number> = {};
      rolledPool.forEach(v => poolCounts[v] = (poolCounts[v] ?? 0) + 1);
      const assignedCounts: Record<number, number> = {};
      Object.values(abilities).forEach((v) => { assignedCounts[v] = (assignedCounts[v] ?? 0) + 1; });
      for (const [valStr, count] of Object.entries(assignedCounts)) {
        const val = Number(valStr);
        if ((poolCounts[val] ?? 0) < count) {
          setAbilitiesError('Rolled assignments exceed the available rolled values. Adjust assignments.');
          setCreationTab('abilities');
          return false;
        }
      }
    }
    if (abilityMethod === 'pointbuy') {
      const total = Object.values(pointBuyScores).reduce((s, v) => s + pointBuyCostFor(v), 0);
      if (total > 27) {
        setAbilitiesError('Point buy exceeds available points (27). Adjust scores before continuing.');
        setCreationTab('abilities');
        return false;
      }
    }
    setAbilitiesError(null);
    return true;
  };

  const goNext = () => {
    // debug: log navigation attempts to help capture blank-page repro
    // eslint-disable-next-line no-console
    console.log('goNext() called. current tab=', creationTab);
    if (creationTab === 'basic') {
      if (!validateBasic()) return;
      setCreationTab('class');
      return;
    }
    if (creationTab === 'class') {
      if (!validateClassTab()) return;
      setCreationTab('background');
      return;
    }
    if (creationTab === 'background') {
      if (!validateBackgroundTab()) return;
      setCreationTab('species');
      return;
    }
    if (creationTab === 'species') {
      if (!validateSpeciesTab()) return;
      // Special handling for Halfling to prevent blank page issue
      if (selectedSpecies === 'Halfling') {
        // Use setTimeout to allow current render to complete before switching tabs
        setTimeout(() => setCreationTab('abilities'), 10);
      } else {
        setCreationTab('abilities');
      }
      return;
    }
    if (creationTab === 'abilities') {
      if (!validateAbilities()) return;
      setCreationTab('review');
      return;
    }
  };

  const goBack = () => {
    if (creationTab === 'review') {
      setCreationTab('abilities');
      return;
    }
    if (creationTab === 'abilities') {
      setCreationTab('species');
      return;
    }
    if (creationTab === 'species') {
      setCreationTab('background');
      return;
    }
    if (creationTab === 'background') {
      setCreationTab('class');
      return;
    }
    if (creationTab === 'class') {
      setCreationTab('basic');
      return;
    }
  };

  const races = ['Dragonborn', 'Dwarf', 'Elf', 'Gnome', 'Half-Elf', 'Half-Orc', 'Halfling', 'Human', 'Tiefling'];
  const classes = ['Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter', 'Monk', 'Paladin', 'Ranger', 'Rogue', 'Sorcerer', 'Warlock', 'Wizard'];
  const backgrounds = ['Acolyte', 'Criminal', 'Folk Hero', 'Noble', 'Sage', 'Soldier'];
  const alignments = ['Lawful Good','Neutral Good','Chaotic Good','Lawful Neutral','Neutral','Chaotic Neutral','Lawful Evil','Neutral Evil','Chaotic Evil'];

  const skillOptions = ['Acrobatics','Animal Handling','Arcana','Athletics','Deception','History','Insight','Intimidation','Investigation','Medicine','Nature','Perception','Performance','Persuasion','Religion','Sleight of Hand','Stealth','Survival'];
  // Universal language list
  const languageOptions = ['Common','Dwarvish','Elvish','Giant','Gnomish','Goblin','Halfling','Orc','Abyssal','Celestial','Draconic','Deep Speech','Infernal','Primordial','Sylvan','Undercommon'];

  // Return default proficiencies/languages for a given species
  const getSpeciesDefaults = (species: string) => {
    switch (species) {
      case 'Half-Elf':
        return {
          armor_proficiencies: [] as string[],
          weapon_proficiencies: [] as string[],
          tool_proficiencies: [] as string[],
          languages: ['Common','Elvish', halfElfExtraLanguage || '']?.filter(Boolean) as string[],
        };
      case 'Tiefling':
        return {
          armor_proficiencies: [] as string[],
          weapon_proficiencies: [] as string[],
          tool_proficiencies: [] as string[],
          languages: ['Common','Infernal'] as string[],
        };
      case 'Human':
        return {
          armor_proficiencies: [] as string[],
          weapon_proficiencies: [] as string[],
          tool_proficiencies: [] as string[],
          languages: ['Common', humanExtraLanguage || '']?.filter(Boolean) as string[],
        };
      case 'Halfling':
        return {
          armor_proficiencies: [] as string[],
          weapon_proficiencies: [] as string[],
          tool_proficiencies: [] as string[],
          languages: ['Common','Halfling'] as string[],
        };
      case 'Half-Orc':
        return {
          armor_proficiencies: [] as string[],
          weapon_proficiencies: [] as string[],
          tool_proficiencies: [] as string[],
            languages: ['Common','Orc'] as string[],
        };
        case 'Gnome':
          return {
            armor_proficiencies: [] as string[],
            weapon_proficiencies: [] as string[],
            // Rock Gnomes gain tinker's tools proficiency
            tool_proficiencies: ["Tinker's tools"] as string[],
            languages: ['Common','Gnomish'] as string[],
          };
      default:
        return {
          armor_proficiencies: [] as string[],
          weapon_proficiencies: [] as string[],
          tool_proficiencies: [] as string[],
          languages: ['Common'] as string[],
        };
    }
  };

  // Clear basic error when basic inputs change
  useEffect(() => {
    if (basicError) {
      if (formData.name && formData.alignment) setBasicError(null);
    }
  }, [formData.name, formData.alignment]);

  // Clear abilities error when relevant ability state changes
  useEffect(() => {
    if (abilitiesError && creationTab === 'abilities') {
      // Only validate when on abilities tab to avoid interfering with navigation
      // Inline validation logic to avoid dependency issues
      let isValid = true;
      if (abilityMethod === 'standard') {
        const keys = Object.keys(abilities);
        const assignedAll = keys.every(k => !!standardAssigned[k]);
        isValid = assignedAll;
      } else if (abilityMethod === 'rolled') {
        const keys = Object.keys(abilities);
        const assignedAll = keys.every(k => (abilities[k as keyof typeof abilities] ?? 0) > 0);
        if (!assignedAll) {
          isValid = false;
        } else {
          const poolCounts: Record<number, number> = {};
          rolledPool.forEach(v => poolCounts[v] = (poolCounts[v] ?? 0) + 1);
          const assignedCounts: Record<number, number> = {};
          Object.values(abilities).forEach((v) => { assignedCounts[v] = (assignedCounts[v] ?? 0) + 1; });
          for (const [valStr, count] of Object.entries(assignedCounts)) {
            const val = Number(valStr);
            if ((poolCounts[val] ?? 0) < count) {
              isValid = false;
              break;
            }
          }
        }
      } else if (abilityMethod === 'pointbuy') {
        const total = Object.values(pointBuyScores).reduce((s, v) => s + pointBuyCostFor(v), 0);
        isValid = total <= 27;
      }

      if (isValid) setAbilitiesError(null);
    }
  }, [abilityMethod, abilities, standardAssigned, pointBuyScores, rolledPool, creationTab, abilitiesError]);

  // Reset Half-Elf choices when species changes away
  useEffect(() => {
    if (selectedSpecies !== 'Half-Elf') {
      setHalfElfExtraAbilities([]);
      setHalfElfSkills([]);
      setHalfElfExtraLanguage('');
      setSpeciesError(null);
    }
    if (selectedSpecies !== 'Human') {
      setHumanExtraLanguage('');
    }
    if (selectedSpecies !== 'Halfling') {
      setSelectedHalflingSubrace('');
    }
    if (selectedSpecies === 'Gnome') {
      // default the gnome subrace to Rock Gnome so UI shows details
      setSelectedGnomeSubrace('Rock Gnome');
    } else {
      setSelectedGnomeSubrace('');
    }
    // initialize skill prof map from half-elf selection when chosen
    if (selectedSpecies === 'Half-Elf') {
      const map: Record<string, 0 | 1 | 2 | 3> = {};
      halfElfSkills.forEach(s => { if (s) map[s] = 1; });
      setSkillProficiencies(map);
    }
  }, [selectedSpecies]);

  // Log subrace selection to help debug runtime issues
  useEffect(() => {
    if (selectedHalflingSubrace) {
      // eslint-disable-next-line no-console
      console.log('Selected Halfling subrace:', selectedHalflingSubrace);
    }
  }, [selectedHalflingSubrace]);

  // Keep skillProficiencies in sync when half-elf skill choices change
  useEffect(() => {
    if (selectedSpecies === 'Half-Elf') {
      const map: Record<string, 0 | 1 | 2 | 3> = {};
      halfElfSkills.forEach(s => { if (s) map[s] = 1; });
      setSkillProficiencies(map);
    }
  }, [halfElfSkills, selectedSpecies]);

  // Force browser repaint when tab changes to fix blank page issue
  useEffect(() => {
    // Trigger a reflow by reading scrollHeight, then force repaint
    if (formRef.current) {
      // Immediately scroll to top before any repaints
      formRef.current.scrollTop = 0;
      // Reading scrollHeight forces a reflow
      void formRef.current.scrollHeight;
      // Use double requestAnimationFrame to ensure paint happens
      requestAnimationFrame(() => {
        if (formRef.current) {
          formRef.current.scrollTop = 0;
          requestAnimationFrame(() => {
            if (formRef.current) {
              void formRef.current.scrollHeight;
              // Scroll to top again to ensure content is in viewport
              formRef.current.scrollTop = 0;
              // Force layout recalculation
              void formRef.current.offsetHeight;
            }
          });
        }
      });
    }
  }, [creationTab]);

  // Helpers for highlighting invalid fields
  const isBasicInvalid = (field: keyof typeof formData) => !!basicError && !(formData[field] && formData[field].toString().trim() !== '');

  const getPoolCounts = () => {
    const pc: Record<number, number> = {};
    rolledPool.forEach(v => pc[v] = (pc[v] ?? 0) + 1);
    return pc;
  };

  const getAssignedCounts = () => {
    const ac: Record<number, number> = {};
    Object.values(abilities).forEach(v => { if (v && v > 0) ac[v] = (ac[v] ?? 0) + 1; });
    return ac;
  };

  const isStandardUnassigned = (abilityName: string) => abilityMethod === 'standard' && !(standardAssigned[abilityName]);
  const isRolledUnassigned = (abilityName: string) => abilityMethod === 'rolled' && !(abilities[abilityName as keyof typeof abilities] > 0);
  const isRolledOverAssigned = (abilityName: string) => {
    if (abilityMethod !== 'rolled') return false;
    const val = abilities[abilityName as keyof typeof abilities];
    if (!val || val === 0) return false;
    const pc = getPoolCounts();
    const ac = getAssignedCounts();
    return (ac[val] ?? 0) > (pc[val] ?? 0);
  };

  // Map skills to their governing ability for modifier computation
  const skillAbilityMap: Record<string, keyof typeof abilities> = {
    'Acrobatics': 'dexterity',
    'Animal Handling': 'wisdom',
    'Arcana': 'intelligence',
    'Athletics': 'strength',
    'Deception': 'charisma',
    'History': 'intelligence',
    'Insight': 'wisdom',
    'Intimidation': 'charisma',
    'Investigation': 'intelligence',
    'Medicine': 'wisdom',
    'Nature': 'intelligence',
    'Perception': 'wisdom',
    'Performance': 'charisma',
    'Persuasion': 'charisma',
    'Religion': 'intelligence',
    'Sleight of Hand': 'dexterity',
    'Stealth': 'dexterity',
    'Survival': 'wisdom',
  };

  // Compute the final ability scores including racial bonuses (for preview on Review)
  const getFinalAbilities = () => {
    let base: Record<string, number> = {} as Record<string, number>;
    if (abilityMethod === 'standard') {
      const keys = Object.keys(abilities);
      keys.forEach(k => { base[k] = standardAssigned[k] ?? abilities[k as keyof typeof abilities]; });
    } else if (abilityMethod === 'pointbuy') {
      base = { ...pointBuyScores };
    } else {
      base = { ...abilities };
    }

    const out = { ...base } as Record<string, number>;
    if (selectedSpecies === 'Half-Elf') {
      out.charisma = (out.charisma ?? 0) + 2;
      halfElfExtraAbilities.slice(0,2).forEach(a => { if (a) out[a] = (out[a] ?? 0) + 1; });
    }
    if (selectedSpecies === 'Tiefling') {
      out.intelligence = (out.intelligence ?? 0) + 1;
      out.charisma = (out.charisma ?? 0) + 2;
    }
    if (selectedSpecies === 'Half-Orc') {
      out.strength = (out.strength ?? 0) + 2;
      out.constitution = (out.constitution ?? 0) + 1;
    }
    if (selectedSpecies === 'Human') {
      Object.keys(out).forEach(k => { out[k] = (out[k] ?? 0) + 1; });
    }
    if (selectedSpecies === 'Halfling') {
      out.dexterity = (out.dexterity ?? 0) + 2;
      if (selectedHalflingSubrace === 'Lightfoot') {
        out.charisma = (out.charisma ?? 0) + 1;
      } else if (selectedHalflingSubrace === 'Stout') {
        out.constitution = (out.constitution ?? 0) + 1;
      }
    }
    if (selectedSpecies === 'Gnome') {
      out.intelligence = (out.intelligence ?? 0) + 2;
      if (selectedGnomeSubrace === 'Rock Gnome') {
        out.constitution = (out.constitution ?? 0) + 1;
      }
    }
    return out;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <ErrorBoundary>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Create New Character
        </h2>

        <form ref={formRef} onSubmit={(e) => e.preventDefault()} className="space-y-4">
          <div className="flex gap-2 mb-4">
            <button type="button" onClick={() => setCreationTab('basic')} className={`px-3 py-1 rounded ${creationTab==='basic' ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Basic</button>
            <button type="button" onClick={() => setCreationTab('class')} className={`px-3 py-1 rounded ${creationTab==='class' ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Class</button>
            <button type="button" onClick={() => setCreationTab('background')} className={`px-3 py-1 rounded ${creationTab==='background' ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Background</button>
            <button type="button" onClick={() => setCreationTab('species')} className={`px-3 py-1 rounded ${creationTab==='species' ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Species</button>
            <button type="button" onClick={() => setCreationTab('abilities')} className={`px-3 py-1 rounded ${creationTab==='abilities' ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Abilities</button>
            <button type="button" onClick={() => setCreationTab('review')} className={`px-3 py-1 rounded ${creationTab==='review' ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Review</button>
          </div>

          {/* Basic tab */}
              {creationTab === 'basic' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${isBasicInvalid('name') ? 'border-red-500 ring-1 ring-red-300' : 'border border-gray-300 dark:border-gray-600'}`} required />
              </div>

              {/* Background moved to its own tab */}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Alignment</label>
                <select value={formData.alignment} onChange={(e) => setFormData({ ...formData, alignment: e.target.value })} className={`w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${isBasicInvalid('alignment') ? 'border-red-500 ring-1 ring-red-300' : 'border border-gray-300 dark:border-gray-600'}`} required>
                  <option value="">Select alignment...</option>
                  {alignments.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              {basicError && <div className="text-xs text-red-600 mt-2">{basicError}</div>}
            </div>
          )}

          {/* Class tab */}
          {creationTab === 'class' && (
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Class</label>
                <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className={`w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${classError ? 'border-red-500 ring-1 ring-red-300' : 'border border-gray-300 dark:border-gray-600'}`}>
                  <option value="">Select class...</option>
                  {classes.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {classError && <div className="text-xs text-red-600 mt-2">{classError}</div>}
              </div>

              {/* Bard class-specific choices */}
              {selectedClass === 'Bard' && (
                <div className="p-3 border rounded bg-gray-50 dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 space-y-4">
                  <h4 className="font-semibold text-base">Bard Starting Features</h4>

                  <div className="text-xs space-y-1 mb-3">
                    <div><strong>Hit Dice:</strong> 1d8 per bard level</div>
                    <div><strong>Hit Points at 1st Level:</strong> 8 + Constitution modifier</div>
                    <div><strong>Armor:</strong> Light armor</div>
                    <div><strong>Weapons:</strong> Simple weapons, hand crossbows, longswords, rapiers, shortswords</div>
                    <div><strong>Saving Throws:</strong> Dexterity, Charisma</div>
                  </div>

                  {/* Tabs for Equipment and Spells */}
                  <div className="flex gap-2 border-b border-gray-300 dark:border-gray-600 pb-2">
                    <button type="button" onClick={() => setBardViewTab('equipment')} className={`px-3 py-1 rounded text-xs ${bardViewTab==='equipment' ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Equipment & Skills</button>
                    <button type="button" onClick={() => setBardViewTab('spells')} className={`px-3 py-1 rounded text-xs ${bardViewTab==='spells' ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Spells</button>
                  </div>

                  {bardViewTab === 'equipment' && (
                    <div className="space-y-4">
                      {/* Skill selection: choose any 3 */}
                      <div>
                        <label className="block text-xs font-semibold mb-2">Choose any 3 skills:</label>
                        <div className="grid grid-cols-2 gap-2">
                          {['Acrobatics', 'Animal Handling', 'Arcana', 'Athletics', 'Deception', 'History', 'Insight', 'Intimidation', 'Investigation', 'Medicine', 'Nature', 'Perception', 'Performance', 'Persuasion', 'Religion', 'Sleight of Hand', 'Stealth', 'Survival'].map(skill => (
                            <label key={skill} className="inline-flex items-center gap-2 text-xs">
                              <input
                                type="checkbox"
                                checked={bardSkills.includes(skill)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    if (bardSkills.length < 3) setBardSkills([...bardSkills, skill]);
                                  } else {
                                    setBardSkills(bardSkills.filter(s => s !== skill));
                                  }
                                }}
                                disabled={!bardSkills.includes(skill) && bardSkills.length >= 3}
                              />
                              {skill}
                            </label>
                          ))}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{bardSkills.length}/3 skills selected</div>
                      </div>

                      {/* Musical instruments: choose 3 */}
                      <div>
                        <label className="block text-xs font-semibold mb-2">Choose 3 musical instruments:</label>
                        <div className="grid grid-cols-2 gap-2">
                          {['Bagpipes', 'Drum', 'Dulcimer', 'Flute', 'Lute', 'Lyre', 'Horn', 'Pan flute', 'Shawm', 'Viol'].map(instrument => (
                            <label key={instrument} className="inline-flex items-center gap-2 text-xs">
                              <input
                                type="checkbox"
                                checked={bardMusicalInstruments.includes(instrument)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    if (bardMusicalInstruments.length < 3) setBardMusicalInstruments([...bardMusicalInstruments, instrument]);
                                  } else {
                                    setBardMusicalInstruments(bardMusicalInstruments.filter(i => i !== instrument));
                                  }
                                }}
                                disabled={!bardMusicalInstruments.includes(instrument) && bardMusicalInstruments.length >= 3}
                              />
                              {instrument}
                            </label>
                          ))}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{bardMusicalInstruments.length}/3 instruments selected</div>
                      </div>

                      {/* Starting Equipment */}
                      <div className="space-y-3">
                        <div className="font-semibold text-xs">Starting Equipment:</div>

                        <div>
                          <label className="block text-xs mb-1">Weapon choice:</label>
                          <div className="space-y-1">
                            <label className="flex items-center gap-2 text-xs">
                              <input type="radio" name="bardWeapon" checked={bardWeaponChoice === 'rapier'} onChange={() => setBardWeaponChoice('rapier')} />
                              (a) Rapier
                            </label>
                            <label className="flex items-center gap-2 text-xs">
                              <input type="radio" name="bardWeapon" checked={bardWeaponChoice === 'longsword'} onChange={() => setBardWeaponChoice('longsword')} />
                              (b) Longsword
                            </label>
                            <label className="flex items-center gap-2 text-xs">
                              <input type="radio" name="bardWeapon" checked={bardWeaponChoice === 'simple'} onChange={() => setBardWeaponChoice('simple')} />
                              (c) Any simple weapon
                            </label>
                          </div>
                          {bardWeaponChoice === 'simple' && (
                            <select value={bardSimpleWeapon} onChange={(e) => setBardSimpleWeapon(e.target.value)} className="mt-2 w-full px-2 py-1 rounded bg-white dark:bg-gray-700 border border-gray-300 text-xs">
                              <option>Club</option>
                              <option>Dagger</option>
                              <option>Greatclub</option>
                              <option>Handaxe</option>
                              <option>Javelin</option>
                              <option>Light hammer</option>
                              <option>Mace</option>
                              <option>Quarterstaff</option>
                              <option>Sickle</option>
                              <option>Spear</option>
                              <option>Crossbow, light</option>
                              <option>Dart</option>
                              <option>Shortbow</option>
                              <option>Sling</option>
                            </select>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs mb-1">Pack choice:</label>
                          <div className="space-y-1">
                            <label className="flex items-center gap-2 text-xs">
                              <input type="radio" name="bardPack" checked={bardPackChoice === 'diplomat'} onChange={() => setBardPackChoice('diplomat')} />
                              (a) Diplomat's pack
                            </label>
                            <label className="flex items-center gap-2 text-xs">
                              <input type="radio" name="bardPack" checked={bardPackChoice === 'entertainer'} onChange={() => setBardPackChoice('entertainer')} />
                              (b) Entertainer's pack
                            </label>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs mb-1">First musical instrument:</label>
                          <div className="space-y-1">
                            <label className="flex items-center gap-2 text-xs">
                              <input type="radio" name="bardInst1" checked={bardInstrumentChoice1 === 'lute'} onChange={() => setBardInstrumentChoice1('lute')} />
                              (a) Lute
                            </label>
                            <label className="flex items-center gap-2 text-xs">
                              <input type="radio" name="bardInst1" checked={bardInstrumentChoice1 === 'other'} onChange={() => setBardInstrumentChoice1('other')} />
                              (b) Any other musical instrument
                            </label>
                          </div>
                          {bardInstrumentChoice1 === 'other' && (
                            <select value={bardOtherInstrument} onChange={(e) => setBardOtherInstrument(e.target.value)} className="mt-2 w-full px-2 py-1 rounded bg-white dark:bg-gray-700 border border-gray-300 text-xs">
                              <option>Bagpipes</option>
                              <option>Drum</option>
                              <option>Dulcimer</option>
                              <option>Flute</option>
                              <option>Lyre</option>
                              <option>Horn</option>
                              <option>Pan flute</option>
                              <option>Shawm</option>
                              <option>Viol</option>
                            </select>
                          )}
                        </div>

                        <div className="text-xs">
                          <strong>Also includes:</strong> Leather armor, Dagger
                        </div>
                      </div>
                    </div>
                  )}

                  {bardViewTab === 'spells' && (
                    <div className="space-y-4">
                      <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                        Click on any spell to view its details. Bards start with 2 1st-level spell slots.
                      </div>

                      {/* Cantrips */}
                      <div>
                        <label className="block text-xs font-semibold mb-2">Choose 2 Cantrips:</label>
                        <div className="space-y-1">
                          {['Blade Ward', 'Dancing Lights', 'Friends', 'Light', 'Mage Hand', 'Mending', 'Message', 'Minor Illusion', 'Prestidigitation', 'True Strike', 'Vicious Mockery'].map(cantrip => {
                            const spellKey = cantrip.toLowerCase().replace(/\s+/g, '-');
                            const isExpanded = expandedBardSpells[spellKey];
                            const details = bardSpellDetails[spellKey];

                            return (
                              <div key={cantrip} className="border border-gray-300 dark:border-gray-600 rounded">
                                <div className="flex items-center gap-2 p-2 bg-white dark:bg-gray-700">
                                  <input
                                    type="checkbox"
                                    checked={bardCantrips.includes(cantrip)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        if (bardCantrips.length < 2) setBardCantrips([...bardCantrips, cantrip]);
                                      } else {
                                        setBardCantrips(bardCantrips.filter(s => s !== cantrip));
                                      }
                                    }}
                                    disabled={!bardCantrips.includes(cantrip) && bardCantrips.length >= 2}
                                  />
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (!isExpanded && !details) {
                                        try {
                                          const response = await fetch(`https://www.dnd5eapi.co/api/spells/${spellKey}`);
                                          const data = await response.json();
                                          setBardSpellDetails(prev => ({ ...prev, [spellKey]: data }));
                                        } catch (error) {
                                          console.error('Failed to fetch spell details:', error);
                                        }
                                      }
                                      setExpandedBardSpells(prev => ({ ...prev, [spellKey]: !isExpanded }));
                                    }}
                                    className="flex-1 text-left text-xs font-medium hover:text-primary"
                                  >
                                    {cantrip} {isExpanded ? '▼' : '▶'}
                                  </button>
                                </div>
                                {isExpanded && details && (
                                  <div className="p-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-300 dark:border-gray-600 text-xs space-y-2">
                                    <div><strong>Level:</strong> Cantrip</div>
                                    <div><strong>Casting Time:</strong> {details.casting_time}</div>
                                    <div><strong>Range:</strong> {details.range}</div>
                                    <div><strong>Components:</strong> {details.components?.join(', ')}</div>
                                    <div><strong>Duration:</strong> {details.duration}</div>
                                    {details.concentration && (
                                      <div className="inline-block px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs font-medium">
                                        Concentration
                                      </div>
                                    )}
                                    {details.ritual && (
                                      <div className="inline-block px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded text-xs font-medium ml-2">
                                        Ritual
                                      </div>
                                    )}
                                    <div className="pt-2"><strong>Description:</strong></div>
                                    {details.desc?.map((paragraph: string, i: number) => (
                                      <p key={i} className="text-xs text-gray-700 dark:text-gray-300">{paragraph}</p>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{bardCantrips.length}/2 cantrips selected</div>
                      </div>

                      {/* 1st Level Spells */}
                      <div>
                        <label className="block text-xs font-semibold mb-2">Choose 4 1st Level Spells:</label>
                        <div className="space-y-1">
                          {['Animal Friendship', 'Bane', 'Charm Person', 'Comprehend Languages', 'Cure Wounds', 'Detect Magic', 'Disguise Self', 'Faerie Fire', 'Feather Fall', 'Healing Word', 'Heroism', 'Identify', 'Illusory Script', 'Longstrider', 'Silent Image', 'Sleep', 'Speak with Animals', 'Thunderwave', 'Unseen Servant'].map(spell => {
                            const spellKey = spell.toLowerCase().replace(/\s+/g, '-');
                            const isExpanded = expandedBardSpells[spellKey];
                            const details = bardSpellDetails[spellKey];

                            return (
                              <div key={spell} className="border border-gray-300 dark:border-gray-600 rounded">
                                <div className="flex items-center gap-2 p-2 bg-white dark:bg-gray-700">
                                  <input
                                    type="checkbox"
                                    checked={bardSpells.includes(spell)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        if (bardSpells.length < 4) setBardSpells([...bardSpells, spell]);
                                      } else {
                                        setBardSpells(bardSpells.filter(s => s !== spell));
                                      }
                                    }}
                                    disabled={!bardSpells.includes(spell) && bardSpells.length >= 4}
                                  />
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (!isExpanded && !details) {
                                        try {
                                          const response = await fetch(`https://www.dnd5eapi.co/api/spells/${spellKey}`);
                                          const data = await response.json();
                                          setBardSpellDetails(prev => ({ ...prev, [spellKey]: data }));
                                        } catch (error) {
                                          console.error('Failed to fetch spell details:', error);
                                        }
                                      }
                                      setExpandedBardSpells(prev => ({ ...prev, [spellKey]: !isExpanded }));
                                    }}
                                    className="flex-1 text-left text-xs font-medium hover:text-primary"
                                  >
                                    {spell} {isExpanded ? '▼' : '▶'}
                                  </button>
                                </div>
                                {isExpanded && details && (
                                  <div className="p-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-300 dark:border-gray-600 text-xs space-y-2">
                                    <div><strong>Level:</strong> {details.level}</div>
                                    <div><strong>School:</strong> {details.school?.name}</div>
                                    <div><strong>Casting Time:</strong> {details.casting_time}</div>
                                    <div><strong>Range:</strong> {details.range}</div>
                                    <div><strong>Components:</strong> {details.components?.join(', ')}</div>
                                    <div><strong>Duration:</strong> {details.duration}</div>
                                    {details.concentration && (
                                      <div className="inline-block px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs font-medium">
                                        Concentration
                                      </div>
                                    )}
                                    {details.ritual && (
                                      <div className="inline-block px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded text-xs font-medium ml-2">
                                        Ritual
                                      </div>
                                    )}
                                    <div className="pt-2"><strong>Description:</strong></div>
                                    {details.desc?.map((paragraph: string, i: number) => (
                                      <p key={i} className="text-xs text-gray-700 dark:text-gray-300">{paragraph}</p>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{bardSpells.length}/4 1st level spells selected</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Background tab */}
          {creationTab === 'background' && (
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Background</label>
                <select value={selectedBackground} onChange={(e) => setSelectedBackground(e.target.value)} className={`w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${backgroundError ? 'border-red-500 ring-1 ring-red-300' : 'border border-gray-300 dark:border-gray-600'}`}>
                  <option value="">Select background...</option>
                  {backgrounds.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                {backgroundError && <div className="text-xs text-red-600 mt-2">{backgroundError}</div>}
              </div>
              {/* Background-specific details */}
              {selectedBackground === 'Criminal' && (
                <div className="p-3 border rounded bg-gray-50 dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300">
                  <h4 className="font-semibold mb-2">Criminal / Spy</h4>
                  <div className="mb-2">You are an experienced criminal with a history of breaking the law. You have spent a lot of time among other criminals and still have contacts within the criminal underworld. You're far closer than most people to the world of murder, theft, and violence that pervades the underbelly of civilization, and you have survived up to this point by flouting the rules and regulations of society.</div>
                  <div className="mb-2"><strong>Criminal Contact:</strong> You have a reliable and trustworthy contact who acts as your liaison to a network of other criminals. You know how to get messages to and from your contact, even over great distances; specifically, you know the local messengers, corrupt caravan masters, and seedy sailors who can deliver messages for you.</div>
                  <div className="mb-2"><strong>Skill Proficiencies:</strong> Deception, Stealth</div>
                  <div className="mb-2"><strong>Tool Proficiencies:</strong> Thieves' tools, one type of gaming set</div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Choose gaming set</label>
                    <select value={criminalGamingSet} onChange={(e) => setCriminalGamingSet(e.target.value)} className="w-full px-2 py-1 rounded bg-white dark:bg-gray-700 border border-gray-300 text-sm">
                      <option>Bowls</option>
                      <option>Darts</option>
                      <option>Dice set</option>
                      <option>Dragonchess set</option>
                      <option>Playing card set</option>
                      <option>Quoits</option>
                      <option>Three-Dragon Ante set</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Species tab (was Race) */}
          {creationTab === 'species' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Species</label>
                <select value={selectedSpecies} onChange={(e) => setSelectedSpecies(e.target.value)} className={`w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${speciesError ? 'border-red-500 ring-1 ring-red-300' : 'border border-gray-300 dark:border-gray-600'}`}>
                  <option value="">Select species...</option>
                  {races.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                {speciesError && <div className="text-xs text-red-600 mt-2">{speciesError}</div>}
              </div>

              {/* Half-Elf details and choices: split into two tabs (Choices, Details) */}
              {selectedSpecies === 'Half-Elf' && (
                <div>
                  <div className="flex gap-2 mb-3">
                    <button type="button" onClick={() => setHalfElfViewTab('choices')} className={`px-3 py-1 rounded ${halfElfViewTab==='choices' ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Choices</button>
                    <button type="button" onClick={() => setHalfElfViewTab('details')} className={`px-3 py-1 rounded ${halfElfViewTab==='details' ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Details</button>
                  </div>

                  {halfElfViewTab === 'choices' && (
                    <div className="p-3 border rounded bg-gray-50 dark:bg-gray-800">
                      <h4 className="font-semibold mb-2">Half-Elf</h4>
                      <div className="text-sm text-gray-700 dark:text-gray-300 mb-3">Walking in two worlds but truly belonging to neither, half-elves combine what some say are the best qualities of their elf and human parents: human curiosity, inventiveness, and ambition tempered by the refined senses, love of nature, and artistic tastes of the elves.</div>

                      <div className="text-sm mb-2"><strong>Ability Score Increase:</strong> Your Charisma score increases by 2, and two other ability scores of your choice increase by 1.</div>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Choose first additional ability (+1)</label>
                          <select value={halfElfExtraAbilities[0] ?? ''} onChange={(e) => {
                            const val = e.target.value;
                            const next = [...halfElfExtraAbilities];
                            next[0] = val;
                            // ensure uniqueness
                            if (next[1] === val) next[1] = '';
                            setHalfElfExtraAbilities(next.filter(Boolean));
                          }} className="w-full px-2 py-1 rounded bg-white dark:bg-gray-700 border border-gray-300">
                            <option value="">Select ability...</option>
                            {Object.keys(abilities).filter(a => a !== 'charisma').map(k => <option key={k} value={k}>{k}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Choose second additional ability (+1)</label>
                          <select value={halfElfExtraAbilities[1] ?? ''} onChange={(e) => {
                            const val = e.target.value;
                            const next = [...halfElfExtraAbilities];
                            next[1] = val;
                            if (next[0] === val) next[0] = '';
                            setHalfElfExtraAbilities(next.filter(Boolean));
                          }} className="w-full px-2 py-1 rounded bg-white dark:bg-gray-700 border border-gray-300">
                            <option value="">Select ability...</option>
                            {Object.keys(abilities).filter(a => a !== 'charisma').map(k => <option key={k} value={k}>{k}</option>)}
                          </select>
                        </div>
                      </div>

                      <div className="text-sm mb-2"><strong>Skill Versatility:</strong> You gain proficiency in two skills of your choice.</div>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        {skillOptions.map(s => {
                          const checked = halfElfSkills.includes(s);
                          const disabled = !checked && halfElfSkills.length >= 2;
                          return (
                            <label key={s} className={`flex items-center gap-2 text-xs ${disabled ? 'opacity-50' : ''}`}>
                              <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => {
                                if (e.target.checked) setHalfElfSkills([...halfElfSkills, s]);
                                else setHalfElfSkills(halfElfSkills.filter(x => x !== s));
                              }} />
                              <span>{s}</span>
                            </label>
                          );
                        })}
                      </div>

                      <div className="text-sm mb-2"><strong>Languages:</strong> You can speak, read, and write Common, Elvish, and one extra language of your choice.</div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Extra language</label>
                        <select value={halfElfExtraLanguage} onChange={(e) => setHalfElfExtraLanguage(e.target.value)} className="w-full px-2 py-1 rounded bg-white dark:bg-gray-700 border border-gray-300">
                          <option value="">Select language...</option>
                          {languageOptions.filter(l => l !== 'Common' && l !== 'Elvish').map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                

                  {halfElfViewTab === 'details' && (
                    <div className="p-3 border rounded bg-gray-50 dark:bg-gray-800">
                      <h4 className="font-semibold mb-2">Half-Elf Details</h4>
                      <div className="text-sm text-gray-700 dark:text-gray-300 space-y-2">
                        <div>
                          <strong>Age:</strong> Half-elves mature at the same rate humans do and reach adulthood around the age of 20. They live much longer than humans, however, often exceeding 180 years.
                        </div>
                        <div>
                          <strong>Alignment:</strong> Half-elves share the chaotic bent of their elven heritage. They value both personal freedom and creative expression, demonstrating neither love of leaders nor desire for followers. They chafe at rules, resent others’ demands, and sometimes prove unreliable, or at least unpredictable.
                        </div>
                        <div>
                          <strong>Size:</strong> Half-elves are about the same size as humans, ranging from 5 to 6 feet tall. Your size is Medium.
                        </div>
                        <div>
                          <strong>Speed:</strong> Your base walking speed is 30 feet.
                        </div>
                        <div>
                          <strong>Darkvision:</strong> Thanks to your elf blood, you have superior vision in dark and dim conditions. You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light. You can’t discern color in darkness, only shades of gray.
                        </div>
                        <div>
                          <strong>Fey Ancestry:</strong> You have advantage on saving throws against being charmed, and magic can’t put you to sleep.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {/* Halfling details and subrace selection */}
              {selectedSpecies === 'Halfling' && (
                <div className="p-3 border rounded bg-gray-50 dark:bg-gray-800">
                  <h4 className="font-semibold mb-2">Halfling</h4>
                  <div className="text-sm text-gray-700 dark:text-gray-300 mb-3">The comforts of home are the goals of most halflings' lives: a place to settle in peace and quiet, far from marauding monsters and clashing armies. Others form nomadic bands that travel constantly, lured by the open road and the wide horizon to discover the wonders of new lands and peoples. Halflings work readily with others, and they are loyal to their friends, whether halfling or otherwise. They can display remarkable ferocity when their friends, families, or communities are threatened.</div>

                  <div className="text-sm mb-2"><strong>Ability Score Increase:</strong> Your Dexterity score increases by 2.</div>
                  <div className="text-sm mb-2"><strong>Age:</strong> A halfling reaches adulthood at the age of 20 and generally lives into the middle of his or her second century.</div>
                  <div className="text-sm mb-2"><strong>Alignment:</strong> Most halflings are lawful good. They are good-hearted and kind, and have no tolerance for oppression.</div>
                  <div className="text-sm mb-2"><strong>Size:</strong> Small (about 3 feet tall).</div>
                  <div className="text-sm mb-2"><strong>Speed:</strong> Your base walking speed is 25 feet.</div>

                  <div className="text-sm mb-2"><strong>Traits:</strong></div>
                  <ul className="text-sm list-disc list-inside text-gray-600 dark:text-gray-300 mb-3">
                    <li><strong>Lucky:</strong> When you roll a 1 on an attack roll, ability check, or saving throw, you can reroll the die. You must use the new result.</li>
                    <li><strong>Brave:</strong> You have advantage on saving throws against being frightened.</li>
                    <li><strong>Nimble:</strong> You can move through the space of any creature that is of a size larger than yours.</li>
                  </ul>

                  <div className="text-sm mb-2"><strong>Languages:</strong> You can speak, read, and write Common and Halfling.</div>

                  <div className="text-sm mb-2"><strong>Subrace</strong></div>
                  <div className="flex items-center gap-4 mb-3">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setSelectedHalflingSubrace('Lightfoot')} className={`px-3 py-1 rounded ${selectedHalflingSubrace === 'Lightfoot' ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Lightfoot</button>
                      <button type="button" onClick={() => setSelectedHalflingSubrace('Stout')} className={`px-3 py-1 rounded ${selectedHalflingSubrace === 'Stout' ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Stout</button>
                    </div>
                    <div />
                  </div>

                  {/* Per-subrace detailed panes */}
                  {selectedHalflingSubrace === 'Lightfoot' && (
                    <div className="p-3 border rounded bg-white dark:bg-gray-800 mb-3">
                      <h5 className="font-semibold">Lightfoot Halfling</h5>
                      <div className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                        Lightfoot halflings are more outgoing than other halflings, and they have a natural knack for blending into other cultures. They are quick and unobtrusive.
                      </div>
                      <div className="text-sm mt-2"><strong>Ability Score Increase:</strong> Your Charisma score increases by 1.</div>
                      <div className="text-sm mt-2"><strong>Naturally Stealthy:</strong> You can attempt to hide even when you are obscured only by a creature that is at least one size larger than you.</div>
                    </div>
                  )}

                  {selectedHalflingSubrace === 'Stout' && (
                    <div className="p-3 border rounded bg-white dark:bg-gray-800 mb-3">
                      <h5 className="font-semibold">Stout Halfling</h5>
                      <div className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                        Stout halflings are hardier than other halflings and have some dwarven blood in their ancestry. They stand fast in the face of danger.
                      </div>
                      <div className="text-sm mt-2"><strong>Ability Score Increase:</strong> Your Constitution score increases by 1.</div>
                      <div className="text-sm mt-2"><strong>Stout Resilience:</strong> You have advantage on saving throws against poison, and you have resistance to poison damage.</div>
                    </div>
                  )}
                </div>
              )}
              {/* Gnome details and subrace selection */}
              {selectedSpecies === 'Gnome' && (
                <div className="p-3 border rounded bg-gray-50 dark:bg-gray-800">
                  <h4 className="font-semibold mb-2">Gnome</h4>
                  <div className="text-sm text-gray-700 dark:text-gray-300 mb-3">A constant hum of busy activity pervades the warrens and neighborhoods where gnomes form their close-knit communities. Louder sounds punctuate the hum: a crunch of grinding gears here, a minor explosion there, a yelp of surprise or triumph, and especially bursts of laughter. Gnomes take delight in life, enjoying every moment of invention, exploration, investigation, creation, and play.</div>

                  <div className="text-sm mb-2"><strong>Ability Score Increase:</strong> Your Intelligence score increases by 2.</div>
                  <div className="text-sm mb-2"><strong>Age:</strong> Gnomes mature at the same rate humans do, and most are expected to settle down into an adult life by around age 40. They can live 350 to almost 500 years.</div>
                  <div className="text-sm mb-2"><strong>Alignment:</strong> Gnomes are most often good. They may lean toward law or chaos depending on vocation and temperament.</div>
                  <div className="text-sm mb-2"><strong>Size:</strong> Small (about 3–4 feet tall).</div>
                  <div className="text-sm mb-2"><strong>Speed:</strong> Your base walking speed is 25 feet.</div>

                  <div className="text-sm mb-2"><strong>Languages:</strong> You can speak, read, and write Common and Gnomish.</div>

                  <div className="text-sm mb-2"><strong>Subrace</strong></div>
                  <div className="flex items-center gap-4 mb-3">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setSelectedGnomeSubrace('Rock Gnome')} className={`px-3 py-1 rounded ${selectedGnomeSubrace === 'Rock Gnome' ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Rock Gnome</button>
                    </div>
                    <div />
                  </div>

                  {selectedGnomeSubrace === 'Rock Gnome' && (
                    <div className="p-3 border rounded bg-white dark:bg-gray-800 mb-3">
                      <h5 className="font-semibold">Rock Gnome</h5>
                      <div className="text-sm text-gray-700 dark:text-gray-300 mt-2">As a rock gnome, you have a natural inventiveness and hardiness beyond that of other gnomes.</div>
                      <div className="text-sm mt-2"><strong>Ability Score Increase:</strong> Your Constitution score increases by 1.</div>
                      <div className="text-sm mt-2"><strong>Artificer's Lore:</strong> Whenever you make an Intelligence (History) check related to magic items, alchemical objects, or technological devices, you can add twice your proficiency bonus, instead of any proficiency bonus you normally apply.</div>
                      <div className="text-sm mt-2"><strong>Tinker:</strong> You have proficiency with artisan's tools (tinker's tools). Using those tools, you can spend 1 hour and 10 gp worth of materials to construct a Tiny clockwork device. The device ceases to function after 24 hours (unless repaired) or when dismantled; you can have up to three such devices active. Choose one: Clockwork Toy, Fire Starter, or Music Box.</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Abilities tab */}
          {creationTab === 'abilities' && (() => {
            // eslint-disable-next-line no-console
            console.log('Rendering abilities tab, method:', abilityMethod);
            return (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Ability Scores</label>
                <div className="flex items-center gap-2">
                  <div className="text-sm text-gray-600">Method:</div>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => setAbilityMethod('standard')} className={`px-2 py-1 rounded ${abilityMethod==='standard' ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Standard Array</button>
                    <button type="button" onClick={() => { setAbilityMethod('rolled'); rollAllStats(); }} className={`px-2 py-1 rounded ${abilityMethod==='rolled' ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Rolled</button>
                    <button type="button" onClick={() => setAbilityMethod('pointbuy')} className={`px-2 py-1 rounded ${abilityMethod==='pointbuy' ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Point Buy</button>
                    <button type="button" onClick={() => setAbilityMethod('manual')} className={`px-2 py-1 rounded ${abilityMethod==='manual' ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Manual</button>
                  </div>
                </div>
              </div>

              {/* Standard Array */}
              {abilityMethod === 'standard' && (
                <div className="space-y-2">
                  <div className="text-xs text-gray-600">Assign the standard array values to each ability.</div>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.keys(abilities).map((key) => {
                      const used = Object.entries(standardAssigned).filter(([k]) => k !== key).map(([,v]) => v);
                      const options = STANDARD_ARRAY.filter(v => !used.includes(v) || standardAssigned[key] === v);
                      const val = getDisplayedAbilities()[key as keyof ReturnType<typeof getDisplayedAbilities>];
                      return (
                        <div key={key}>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1 capitalize">{key}</label>
                          <select className={`w-full px-2 py-1 rounded bg-white dark:bg-gray-700 ${isStandardUnassigned(key) ? 'border-red-500 ring-1 ring-red-300' : 'border border-gray-300 dark:border-gray-700'}`} value={standardAssigned[key] ?? ''} onChange={(e) => setStandardAssigned({ ...standardAssigned, [key]: Number(e.target.value) })}>
                            <option value="">Select</option>
                            {options.map(v => <option key={v} value={v}>{v}</option>)}
                          </select>
                          <div className="text-xs text-gray-500 mt-1">Modifier: {getAbilityModifier(val) >= 0 ? `+${getAbilityModifier(val)}` : getAbilityModifier(val)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Rolled: show a roll pool and allow assignment to abilities */}
              {abilityMethod === 'rolled' && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="text-xs text-gray-600">Roll 6 values (4d6 drop lowest) and assign them to abilities.</div>
                    <button type="button" onClick={rollAllStats} className="text-sm px-3 py-1 bg-primary text-white rounded-lg">Roll</button>
                    <button type="button" onClick={() => {
                      // auto-assign pool to abilities in order if unassigned
                      const pool = [...rolledPool];
                      const keys = Object.keys(abilities) as Array<keyof typeof abilities>;
                      const assign: typeof abilities = { ...abilities } as typeof abilities;
                      for (let i = 0; i < keys.length; i++) {
                        const k = keys[i];
                        if (!assign[k] || assign[k] === 0) {
                          assign[k] = pool.shift() ?? 0;
                        }
                      }
                      setAbilities(assign);
                    }} className="text-sm px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded">Auto-Assign</button>
                  </div>

                  <div className="mb-3">
                    <div className="text-xs text-gray-500">Rolled Pool</div>
                    <div className="flex gap-2 mt-2">
                      {rolledPool.map((v, idx) => {
                        const assignedCount = Object.values(abilities).filter(a => a === v).length;
                        const poolCount = rolledPool.filter(x => x === v).length;
                        const remaining = poolCount - assignedCount;
                        return (
                          <div key={`${v}-${idx}`} className={`px-3 py-1 border rounded ${remaining > 0 ? 'bg-white dark:bg-gray-700' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
                            <div className="text-sm font-medium">{v}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(abilities).map(([key, value]) => (
                      <div key={key}>
                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1 capitalize">{key}</label>
                        <select value={value || ''} onChange={(e) => setAbilities({ ...abilities, [key]: e.target.value ? Number(e.target.value) : 0 })} className={`w-full px-2 py-1 rounded bg-white dark:bg-gray-700 ${((isRolledUnassigned(key) || isRolledOverAssigned(key)) ? 'border-red-500 ring-1 ring-red-300' : 'border border-gray-300 dark:border-gray-700')}`}>
                          <option value="">Unassigned</option>
                          {rolledPool.map((v, idx) => {
                            // disable option if already used up by other abilities (respecting duplicates)
                            const assignedCount = Object.entries(abilities).filter(([k]) => k !== key && abilities[k as keyof typeof abilities] === v).length;
                            const poolCount = rolledPool.filter(x => x === v).length;
                            const disabled = assignedCount >= poolCount;
                            return <option key={`${v}-${idx}`} value={v} disabled={disabled}>{v}{disabled ? ' (used)' : ''}</option>;
                          })}
                        </select>
                        <div className="text-xs text-gray-500 mt-1">Modifier: {getAbilityModifier(getDisplayedAbilities()[key as keyof ReturnType<typeof getDisplayedAbilities>]) >= 0 ? `+${getAbilityModifier(getDisplayedAbilities()[key as keyof ReturnType<typeof getDisplayedAbilities>])}` : getAbilityModifier(getDisplayedAbilities()[key as keyof ReturnType<typeof getDisplayedAbilities>])}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Point Buy */}
              {abilityMethod === 'pointbuy' && (
                <div>
                  <div className="text-xs text-gray-600 mb-2">You have 27 points. Scores start at 8. Costs increase with higher scores.</div>
                  <PointBuyEditor scores={pointBuyScores} setScores={setPointBuyScores} />
                </div>
              )}

              {/* Manual */}
              {abilityMethod === 'manual' && (
                <div>
                  <div className="text-xs text-gray-600 mb-2">Enter ability scores manually.</div>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(abilities).map(([key, value]) => (
                      <div key={key}>
                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1 capitalize">{key}</label>
                        <input type="number" value={value} onChange={(e) => setAbilities({ ...abilities, [key]: parseInt(e.target.value) || 0 })} min={1} max={30} className="w-full px-2 py-1 border rounded bg-white dark:bg-gray-700" />
                        <div className="text-xs text-gray-500 mt-1">Modifier: {getAbilityModifier(getDisplayedAbilities()[key as keyof ReturnType<typeof getDisplayedAbilities>]) >= 0 ? `+${getAbilityModifier(getDisplayedAbilities()[key as keyof ReturnType<typeof getDisplayedAbilities>])}` : getAbilityModifier(getDisplayedAbilities()[key as keyof ReturnType<typeof getDisplayedAbilities>])}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {abilitiesError && <div className="text-xs text-red-600 mt-2">{abilitiesError}</div>}
            </div>
            );
          })()}

          {/* Tiefling details (when Tiefling selected) */}
          {creationTab === 'species' && selectedSpecies === 'Tiefling' && (
            <div className="p-3 border rounded bg-gray-50 dark:bg-gray-800">
              <h4 className="font-semibold mb-2">Tiefling</h4>
              <div className="text-sm text-gray-700 dark:text-gray-300 mb-3">To be greeted with stares and whispers, to suffer violence and insult on the street, to see mistrust and fear in every eye: this is the lot of the tiefling. And to twist the knife, tieflings know that this is because a pact struck generations ago infused the essence of Asmodeus, overlord of the Nine Hells (and many of the other powerful devils serving under him) into their bloodline. Their appearance and their nature are not their fault but the result of an ancient sin, for which they and their children and their children's children will always be held accountable.</div>

              <div className="text-sm mb-2"><strong>Ability Score Increase:</strong> Your Intelligence score increases by 1, and your Charisma score increases by 2.</div>
              <div className="text-sm mb-2"><strong>Age:</strong> Tieflings mature at the same rate as humans but live a few years longer.</div>
              <div className="text-sm mb-2"><strong>Alignment:</strong> Tieflings might not have an innate tendency toward evil, but many of them end up there. Evil or not, an independent nature inclines many tieflings toward a chaotic alignment.</div>
              <div className="text-sm mb-2"><strong>Size:</strong> Tieflings are about the same size and build as humans. Your size is Medium.</div>
              <div className="text-sm mb-2"><strong>Speed:</strong> Your base walking speed is 30 feet.</div>
              <div className="text-sm mb-2"><strong>Darkvision:</strong> Thanks to your infernal heritage, you have superior vision in dark and dim conditions. You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light. You can’t discern color in darkness, only shades of gray.</div>
              <div className="text-sm mb-2"><strong>Hellish Resistance:</strong> You have resistance to fire damage.</div>
              <div className="text-sm mb-2"><strong>Languages:</strong> You can speak, read, and write Common and Infernal.</div>
              <div className="text-sm"><strong>Infernal Legacy:</strong> You know the thaumaturgy cantrip. When you reach 3rd level, you can cast the hellish rebuke spell as a 2nd-level spell once with this trait and regain the ability to do so when you finish a long rest. When you reach 5th level, you can cast the darkness spell once with this trait and regain the ability to do so when you finish a long rest. Charisma is your spellcasting ability for these spells.</div>
            </div>
          )}

          {/* Half-Orc details (when Half-Orc selected) */}
          {creationTab === 'species' && selectedSpecies === 'Half-Orc' && (
            <div className="p-3 border rounded bg-gray-50 dark:bg-gray-800">
              <h4 className="font-semibold mb-2">Half-Orc</h4>
              <div className="text-sm text-gray-700 dark:text-gray-300 mb-3">When alliances between humans and orcs are sealed by marriages, half-orcs are born. Some become proud chiefs of orc tribes; others venture into the world to prove themselves through mighty deeds and savage fury.</div>

              <div className="text-sm mb-2"><strong>Ability Score Increase:</strong> Your Strength score increases by 2, and your Constitution score increases by 1.</div>
              <div className="text-sm mb-2"><strong>Age:</strong> Half-orcs mature a little faster than humans, reaching adulthood around age 14, and rarely live longer than 75 years.</div>
              <div className="text-sm mb-2"><strong>Alignment:</strong> Half-orcs inherit tendencies toward chaos and are not strongly inclined toward good.</div>
              <div className="text-sm mb-2"><strong>Size:</strong> Medium.</div>
              <div className="text-sm mb-2"><strong>Speed:</strong> Your base walking speed is 30 feet.</div>

              <div className="text-sm mb-2"><strong>Darkvision:</strong> You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light.</div>

              <div className="text-sm mb-2"><strong>Menacing:</strong> You gain proficiency in the Intimidation skill.</div>

              <div className="text-sm mb-2"><strong>Relentless Endurance:</strong> When you are reduced to 0 hit points but not killed outright, you can drop to 1 hit point instead. You can't use this feature again until you finish a long rest.</div>

              <div className="text-sm mb-2"><strong>Savage Attacks:</strong> When you score a critical hit with a melee weapon attack, you can roll one of the weapon's damage dice one additional time and add it to the extra damage of the critical hit.</div>

              <div className="text-sm mb-2"><strong>Languages:</strong> You can speak, read, and write Common and Orc.</div>
            </div>
          )}

          {/* Human details (when Human selected) */}
          {creationTab === 'species' && selectedSpecies === 'Human' && (
            <div className="p-3 border rounded bg-gray-50 dark:bg-gray-800">
              <h4 className="font-semibold mb-2">Human</h4>
              <div className="text-sm text-gray-700 dark:text-gray-300 mb-3">In the reckonings of most worlds, humans are the youngest of the common races, late to arrive on the world scene and short-lived in comparison to dwarves, elves, and dragons. Perhaps it is because of their shorter lives that they strive to achieve as much as they can in the years they are given. Or maybe they feel they have something to prove to the elder races, and that's why they build their mighty empires on the foundation of conquest and trade. Whatever drives them, humans are the innovators, the achievers, and the pioneers of the worlds.</div>

              <div className="text-sm mb-2"><strong>Ability Score Increase:</strong> Your ability scores each increase by 1.</div>
              <div className="text-sm mb-2"><strong>Age:</strong> Humans reach adulthood in their late teens and live less than a century.</div>
              <div className="text-sm mb-2"><strong>Alignment:</strong> Humans tend toward no particular alignment. The best and the worst are found among them.</div>
              <div className="text-sm mb-2"><strong>Size:</strong> Medium.</div>
              <div className="text-sm mb-2"><strong>Speed:</strong> Your base walking speed is 30 feet.</div>

              <div className="text-sm mb-2"><strong>Languages:</strong> You can speak, read, and write Common and one extra language of your choice.</div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Extra language</label>
                <select value={humanExtraLanguage} onChange={(e) => setHumanExtraLanguage(e.target.value)} className="w-full px-2 py-1 rounded bg-white dark:bg-gray-700 border border-gray-300">
                  <option value="">Select language...</option>
                  {languageOptions.filter(l => l !== 'Common').map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Review tab (simple summary) */}
          {creationTab === 'review' && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Review</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-sm text-gray-500">Name</div>
                  <div className="text-lg font-semibold">{formData.name}</div>
                  <div className="text-sm text-gray-500 mt-2">Class</div>
                  <div className="text-lg font-semibold">{selectedClass}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Race</div>
                  <div className="text-lg font-semibold">{selectedSpecies}</div>
                  <div className="text-sm text-gray-500 mt-2">Background</div>
                  <div className="text-lg font-semibold">{selectedBackground}</div>
                </div>
              </div>
              <div className="mb-3">
                <div className="text-sm text-gray-500">Ability Scores</div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {Object.entries(getFinalAbilities()).map(([k, v]) => (
                    <div key={k} className="p-2 border rounded bg-gray-50 dark:bg-gray-800">
                      <div className="text-sm font-medium capitalize">{k}</div>
                      <div className="text-lg font-semibold">{v} <span className="text-sm text-gray-500">({getAbilityModifier(v) >= 0 ? `+${getAbilityModifier(v)}` : getAbilityModifier(v)})</span></div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Profiencies summary */}
              <div className="mb-3">
                <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-500">Proficiencies</div>
                  </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-xs text-gray-600 font-medium">Skills</div>
                    <div className="mt-2">
                      {Object.entries(skillProficiencies).filter(([,v]) => v > 0).length === 0 ? (
                          <div className="text-xs text-gray-500">No skill proficiencies selected</div>
                        ) : (
                          (() => {
                            const final = getFinalAbilities();
                            const prof = getProficiencyBonus(1);
                            return Object.entries(skillProficiencies).filter(([,v]) => v > 0).map(([name]) => {
                              const abilityKey = skillAbilityMap[name];
                              const abilityVal = final[abilityKey] ?? 0;
                              const mod = getAbilityModifier(abilityVal) + ((skillProficiencies[name] ?? 0) > 0 ? prof : 0);
                              return <div key={name} className="text-sm">{name} ({mod >= 0 ? `+${mod}` : mod})</div>;
                            });
                          })()
                        )}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 font-medium">Saving Throws</div>
                    <div className="mt-2">
                      {['strength','dexterity','constitution','intelligence','wisdom','charisma'].filter(s => (savingThrowProficiencies[s] ?? 0) > 0).length === 0 ? (
                        <div className="text-xs text-gray-500">No saving throw proficiencies selected</div>
                      ) : (
                        (() => {
                          const final = getFinalAbilities();
                          const prof = getProficiencyBonus(1);
                          return ['strength','dexterity','constitution','intelligence','wisdom','charisma'].filter(s => (savingThrowProficiencies[s] ?? 0) > 0).map(s => {
                            const abilityVal = final[s] ?? 0;
                            const mod = getAbilityModifier(abilityVal) + ((savingThrowProficiencies[s] ?? 0) > 0 ? prof : 0);
                            return <div key={s} className="text-sm capitalize">{s} ({mod >= 0 ? `+${mod}` : mod})</div>;
                          });
                        })()
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            {creationTab !== 'basic' ? (
              <button type="button" onClick={goBack} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg">Back</button>
            ) : (
              <div />
            )}
            <div className="flex-1" />

                    {creationTab !== 'review' ? (
                      <button type="button" onClick={goNext} className="px-4 py-2 bg-primary text-white rounded-lg">Next</button>
                    ) : (
                      <button type="button" onClick={() => handleSubmit()} className="px-4 py-2 bg-primary text-white rounded-lg">Create Character</button>
                    )}

            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg">Cancel</button>
          </div>
        </form>
      </div>
      </ErrorBoundary>
      {showEditProfsModal && tempSkillProficiencies && tempSavingThrowProficiencies && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-60">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg p-6">
            <h3 className="text-lg font-semibold mb-3">Edit Proficiencies</h3>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <div className="text-sm font-medium mb-2">Saving Throw Proficiencies</div>
                <div className="grid grid-cols-6 gap-2">
                  {['strength','dexterity','constitution','intelligence','wisdom','charisma'].map(s => {
                    const val = tempSavingThrowProficiencies[s] ?? 0;
                    return (
                      <button key={s} onClick={() => {
                        const nextVal = (val === 1 ? 0 : 1) as 0 | 1 | 2 | 3;
                        setTempSavingThrowProficiencies({ ...tempSavingThrowProficiencies, [s]: nextVal });
                      }} className={`px-2 py-1 rounded ${val ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>{s.charAt(0).toUpperCase()+s.slice(1)}</button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium mb-2">Skill Proficiencies (toggle)</div>
                <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto">
                  {skillOptions.map(s => {
                    const val = tempSkillProficiencies[s] ?? 0;
                    const selectedCount = Object.values(tempSkillProficiencies).filter(v => v > 0).length;
                    const disabled = selectedSpecies === 'Half-Elf' && !(val > 0) && selectedCount >= 2;
                    return (
                      <label key={s} className={`flex items-center gap-2 ${disabled ? 'opacity-50' : ''}`}>
                        <input type="checkbox" checked={val > 0} disabled={disabled} onChange={(e) => {
                          const next = { ...(tempSkillProficiencies ?? {}) };
                          if (e.target.checked) next[s] = 1; else delete next[s];
                          setTempSkillProficiencies(next);
                        }} />
                        <span className="text-sm">{s}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => {
                  // discard temp changes
                  setTempSkillProficiencies(null);
                  setTempSavingThrowProficiencies(null);
                  setShowEditProfsModal(false);
                }} className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded">Cancel</button>
                <button type="button" onClick={() => {
                  // commit temp changes into live state
                  if (tempSkillProficiencies) setSkillProficiencies({ ...tempSkillProficiencies });
                  if (tempSavingThrowProficiencies) setSavingThrowProficiencies({ ...tempSavingThrowProficiencies });
                  // If Half-Elf, reflect modal selections back into halfElfSkills
                  if (selectedSpecies === 'Half-Elf' && tempSkillProficiencies) {
                    setHalfElfSkills(Object.keys(tempSkillProficiencies).filter(k => (tempSkillProficiencies[k] ?? 0) > 0));
                  }
                  setTempSkillProficiencies(null);
                  setTempSavingThrowProficiencies(null);
                  setShowEditProfsModal(false);
                }} className="px-3 py-1 bg-primary text-white rounded">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
