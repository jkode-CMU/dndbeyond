import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { Character, getAbilityModifier, getProficiencyBonus } from '../types/character';
import { fetchItem } from '../utils/srdApi';
import ConfirmModal from '../components/ConfirmModal';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * Character sheet page displaying full character details
 * Allows editing character stats with autosave functionality
 */
export default function CharacterSheet() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [character, setCharacter] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [expandedBonuses, setExpandedBonuses] = useState<Record<string, boolean>>({});
  const [spellsDetails, setSpellsDetails] = useState<Record<string, any>>({});
  const [selectedSpellName, setSelectedSpellName] = useState<string | null>(null);
  const [selectedSpellDetail, setSelectedSpellDetail] = useState<any | null>(null);
  // tabs are rendered below saving throws; keep state for future interactions
  const [activeTab, setActiveTab] = useState<'attacks' | 'features' | 'proficiencies' | 'spells' | 'inventory' | 'notes'>('attacks');
  const [pendingDeleteItem, setPendingDeleteItem] = useState<{ type: 'equipment' | 'spell'; index: number } | null>(null);
  const [pendingRest, setPendingRest] = useState<'long' | 'short' | null>(null);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', description: '', cost: '' });
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({});
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);
  const [levelUpHPChoice, setLevelUpHPChoice] = useState<'roll' | 'average'>('average');
  const [levelUpHPRoll, setLevelUpHPRoll] = useState<number | null>(null);
  const [shortRestInfo, setShortRestInfo] = useState<{ available: number; lastRoll?: number; lastTotal?: number } | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
 
  // Build a clean, print-optimized DOM element containing all character info
  const exportToPDF = async () => {
    if (!character) return;
    try {
      const tmp = document.createElement('div');
      // Offscreen but rendered so html2canvas can capture it
      tmp.style.position = 'absolute';
      tmp.style.left = '-9999px';
      tmp.style.top = '0';
      tmp.style.width = '794px';
      tmp.style.background = '#ffffff';
      tmp.style.color = '#111827';
      tmp.style.padding = '24px';
      tmp.style.fontFamily = 'Arial, Helvetica, sans-serif';
      tmp.style.fontSize = '12px';
      tmp.style.lineHeight = '1.3';
      tmp.style.boxSizing = 'border-box';

      // Header
      const header = document.createElement('div');
      header.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <div>
            <div style="font-size:20px;font-weight:700;margin-bottom:4px">${character.name}</div>
            <div style="color:#4b5563">${character.class}${(character as any).subclass ? ` (${(character as any).subclass})` : ''} — Level ${character.level} — ${character.race}</div>
          </div>
          <div style="text-align:right">
            <div style="font-weight:600;margin-bottom:4px">Alignment: ${((character as any).alignment) || '—'}</div>
            <div style="color:#4b5563">Background: ${character.background || '—'}</div>
          </div>
        </div>
      `;
      tmp.appendChild(header);

      // Quick stats row
      const stats = document.createElement('div');
      stats.style.display = 'flex';
      stats.style.gap = '16px';
      stats.style.marginBottom = '12px';
      stats.innerHTML = `
        <div><strong>HP:</strong> ${character.hit_points}${(character.temp_hp ?? 0) > 0 ? ` (+${character.temp_hp})` : ''} / ${character.max_hit_points ?? (character.level * 8)}</div>
        <div><strong>AC:</strong> ${character.armor_class}</div>
        <div><strong>Initiative:</strong> ${character.initiative >= 0 ? `+${character.initiative}` : character.initiative}</div>
        <div><strong>Prof.:</strong> +${getProficiencyBonus(character.level)}</div>
        <div><strong>Heroic Inspiration:</strong> ${(character as any).heroic_inspiration ? 'Yes' : 'No'}</div>
      `;
      tmp.appendChild(stats);

      // Abilities table
      const abilitiesSection = document.createElement('div');
      abilitiesSection.style.marginBottom = '12px';
      const abilitiesRows = Object.entries(character.ability_scores).map(([k, v]) => {
        const mod = getAbilityModifier(v as number);
        return `<div style="display:inline-block;width:24%;box-sizing:border-box;padding:6px;border:1px solid #e5e7eb;border-radius:6px;margin:2px;"><div style="font-weight:700">${k.charAt(0).toUpperCase()+k.slice(1)}</div><div style="margin-top:6px;font-size:14px">${v} <span style="color:#6b7280">(${mod>=0?`+${mod}`:mod})</span></div></div>`;
      }).join('');
      abilitiesSection.innerHTML = `<div style="font-weight:700;margin-bottom:6px">Ability Scores</div><div style="display:flex;flex-wrap:wrap;gap:8px">${abilitiesRows}</div>`;
      tmp.appendChild(abilitiesSection);

      // Two-column quick info: proficiencies / inventory & extras
      const twoCol = document.createElement('div');
      twoCol.style.display = 'flex';
      twoCol.style.gap = '12px';
      twoCol.style.marginBottom = '6px';

      const leftCol = document.createElement('div');
      leftCol.style.flex = '1';
      const armorProfs = (character.armor_proficiencies && character.armor_proficiencies.length) ? character.armor_proficiencies.join(', ') : 'None';
      const weaponProfs = (character.weapon_proficiencies && character.weapon_proficiencies.length) ? character.weapon_proficiencies.join(', ') : 'None';
      const toolProfs = (character.tool_proficiencies && character.tool_proficiencies.length) ? character.tool_proficiencies.join(', ') : 'None';
      const languages = (character.languages && character.languages.length) ? character.languages.join(', ') : 'Common';
      leftCol.innerHTML = `
        <div style="font-weight:700;margin-bottom:6px">Proficiencies</div>
        <div style="margin-bottom:6px"><strong>Armor:</strong> ${armorProfs}</div>
        <div style="margin-bottom:6px"><strong>Weapons:</strong> ${weaponProfs}</div>
        <div style="margin-bottom:6px"><strong>Tools:</strong> ${toolProfs}</div>
        <div style="margin-bottom:6px"><strong>Languages:</strong> ${languages}</div>
      `;

      const rightCol = document.createElement('div');
      rightCol.style.flex = '1';
      const plat = character.currency?.platinum ?? 0;
      const gold = character.currency?.gold ?? 0;
      const silver = character.currency?.silver ?? 0;
      const copper = character.currency?.copper ?? 0;
      const moneyStr = `${plat} pp • ${gold} gp • ${silver} sp • ${copper} cp`;
      const dsSucc = (character.death_saves_success ?? [false, false, false]).filter(Boolean).length;
      const dsFail = (character.death_saves_failure ?? [false, false, false]).filter(Boolean).length;

      // Build inventory HTML
      const inventoryHtml = (Array.isArray(character.equipment) && character.equipment.length)
        ? character.equipment.map((it: any) => {
          return `<div style="margin-bottom:4px">${typeof it === 'string' ? it : (it.name || JSON.stringify(it))}</div>`;
        }).join('')
        : '<div>No inventory items.</div>';

      // Build spells HTML
      const spellsHtml = (Array.isArray(character.spells) && character.spells.length)
        ? character.spells.map((s: any) => `<div style="margin-bottom:4px">${typeof s === 'string' ? s : (s.name || JSON.stringify(s))}</div>`).join('')
        : '<div>No known spells.</div>';

      // Natural bonuses helper (brief descriptions)
      const naturalBonusesHtml = (() => {
        const r = character.race;
        if (r === 'Half-Elf') return `<div>Darkvision (60 ft.), Magical Sleep Defense (advantage vs charm & immune to magical sleep)</div>`;
        if (r === 'Tiefling') return `<div>Darkvision (60 ft.), Hellish Resistance (fire), Infernal Legacy (Thaumaturgy; Hellish Rebuke (3), Darkness (5))</div>`;
        if (r === 'Gnome') return `<div>Darkvision (60 ft.), Gnome Cunning (advantage vs magic saves), Artificer's Lore, Tinker</div>`;
        if (r === 'Half-Orc') return `<div>Darkvision (60 ft.), Relentless Endurance (once per long rest), Savage Attacks</div>`;
        if (r === 'Halfling') return `<div>Lucky, Brave, Nimble${(character as any).subrace === 'Lightfoot' ? ', Naturally Stealthy' : ( (character as any).subrace === 'Stout' ? ', Stout Resilience' : '')}</div>`;
        return `<div>No special natural bonuses listed.</div>`;
      })();

      rightCol.innerHTML = `
        <div style="font-weight:700;margin-bottom:6px">Inventory & Money</div>
        <div style="margin-bottom:6px"><strong>Money:</strong> ${moneyStr}</div>
        <div style="font-weight:700;margin-top:8px;margin-bottom:6px">Inventory</div>
        <div style="margin-bottom:6px">${inventoryHtml}</div>
        <div style="font-weight:700;margin-top:8px;margin-bottom:6px">Spells</div>
        <div style="margin-bottom:6px">${spellsHtml}</div>
        <div style="font-weight:700;margin-top:8px;margin-bottom:6px">Other</div>
        <div style="margin-bottom:6px"><strong>Death Saves:</strong> Successes ${dsSucc} / Failures ${dsFail}</div>
        <div style="margin-bottom:6px"><strong>Natural Bonuses:</strong> ${naturalBonusesHtml}</div>
      `;

      twoCol.appendChild(leftCol);
      twoCol.appendChild(rightCol);
      tmp.appendChild(twoCol);

      // Proficiencies (saves + skills)
      const profSection = document.createElement('div');
      profSection.style.marginBottom = '6px';
      profSection.innerHTML = `<div style="font-weight:700;margin-bottom:6px;font-size:14px">Proficiencies</div>`;
      const profContent = document.createElement('div');
      // Saving throws
      const saves = ['strength','dexterity','constitution','intelligence','wisdom','charisma'];
      const saveEls = document.createElement('div');
      saveEls.style.marginBottom = '8px';
      saveEls.innerHTML = `<div style="font-weight:600">Saving Throws</div>`;
      saves.forEach((s) => {
        const mod = getAbilityModifier((character.ability_scores as any)[s]);
        const state = character.saving_throw_proficiencies?.[s] ?? 0;
        const profLabel = state === 0 ? 'None' : state === 1 ? 'Proficient' : state === 2 ? 'Half' : 'Expert';
        const eff = effectiveModifier(mod, state, getProficiencyBonus(character.level));
        const row = document.createElement('div');
        row.textContent = `${s.charAt(0).toUpperCase()+s.slice(1)}: ${eff >= 0 ? `+${eff}` : eff} (${profLabel})`;
        saveEls.appendChild(row);
      });
      profContent.appendChild(saveEls);

      // Skills
      const skillEls = document.createElement('div');
      skillEls.style.marginBottom = '8px';
      skillEls.innerHTML = `<div style="font-weight:600">Skills</div>`;
      const skillsList = [
        ['Athletics','strength'],['Acrobatics','dexterity'],['Sleight of Hand','dexterity'],['Stealth','dexterity'],['Arcana','intelligence'],['History','intelligence'],['Investigation','intelligence'],['Nature','intelligence'],['Religion','intelligence'],['Perception','wisdom'],['Survival','wisdom'],['Deception','charisma'],['Intimidation','charisma'],['Performance','charisma'],['Persuasion','charisma']
      ];
      skillsList.forEach(([name, ability]) => {
        const mod = getAbilityModifier((character.ability_scores as any)[ability]);
        const state = character.skill_proficiencies?.[name as string] ?? 0;
        const profLabel = state === 0 ? 'None' : state === 1 ? 'Proficient' : state === 2 ? 'Half' : 'Expert';
        const eff = effectiveModifier(mod, state, getProficiencyBonus(character.level));
        const row = document.createElement('div');
        row.textContent = `${name}: ${eff >= 0 ? `+${eff}` : eff} (${profLabel})`;
        skillEls.appendChild(row);
      });
      profContent.appendChild(skillEls);
      profSection.appendChild(profContent);
      // Place the detailed proficiencies inside the left column so layout stays balanced
      leftCol.appendChild(profSection);

      // Move Notes up directly after Proficiencies (remove separate Spells and Inventory blocks)
      const notesSection = document.createElement('div');
      notesSection.style.marginBottom = '6px';
      notesSection.innerHTML = `<div style="font-weight:700;margin-bottom:6px;font-size:14px">Notes</div>`;
      const notes = document.createElement('div');
      notes.style.whiteSpace = 'pre-wrap';
      notes.textContent = character.notes || '';
      notesSection.appendChild(notes);
      // Place notes inside the left column directly under proficiencies
      leftCol.appendChild(notesSection);

      // Tabs content: Attacks (moved below Proficiencies/Notes to avoid vertical gap)
      const attacksSection = document.createElement('div');
      attacksSection.style.marginBottom = '6px';
      attacksSection.innerHTML = `<div style="font-weight:700;margin-bottom:6px;font-size:14px">Attacks & Weapons</div>`;
      const attacksList = document.createElement('div');
      const attacks = (character as any).attacks ?? [];
      if (Array.isArray(attacks) && attacks.length > 0) {
        attacks.forEach((a: any) => {
          const el = document.createElement('div');
          el.style.marginBottom = '6px';
          el.textContent = typeof a === 'string' ? a : (a.name ? `${a.name} — ${a.desc || ''}` : JSON.stringify(a));
          attacksList.appendChild(el);
        });
      } else {
        attacksList.textContent = 'No attacks defined.';
      }
      attacksSection.appendChild(attacksList);
      tmp.appendChild(attacksSection);

      // Features
      const featuresSection = document.createElement('div');
      featuresSection.style.marginBottom = '6px';
      featuresSection.innerHTML = `<div style="font-weight:700;margin-bottom:6px;font-size:14px">Features</div>`;
      // features not currently stored in character; placeholder if absent
      const features = (character as any).features ?? [];
      const featuresList = document.createElement('div');
      if (Array.isArray(features) && features.length > 0) {
        features.forEach((f: any) => {
          const el = document.createElement('div');
          el.style.marginBottom = '6px';
          el.textContent = typeof f === 'string' ? f : (f.name ? `${f.name} — ${f.desc || ''}` : JSON.stringify(f));
          featuresList.appendChild(el);
        });
      } else {
        featuresList.textContent = 'No features listed.';
      }
      featuresSection.appendChild(featuresList);
      tmp.appendChild(featuresSection);

      document.body.appendChild(tmp);

      const canvas = await html2canvas(tmp, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      // Prepare jsPDF and paginate
      const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const pageCanvasHeight = Math.floor((canvasWidth * pdfHeight) / pdfWidth);

      let remainingHeight = canvasHeight;
      let positionY = 0;
      const imgType = 'image/png';

      while (remainingHeight > 0) {
        const sliceHeight = Math.min(pageCanvasHeight, remainingHeight);
        const tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = canvasWidth;
        tmpCanvas.height = sliceHeight;
        const ctx = tmpCanvas.getContext('2d');
        if (!ctx) break;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, tmpCanvas.width, tmpCanvas.height);
        ctx.drawImage(canvas, 0, positionY, canvasWidth, sliceHeight, 0, 0, canvasWidth, sliceHeight);

        const imgData = tmpCanvas.toDataURL(imgType);
        const imgScaledHeight = (sliceHeight * pdfWidth) / canvasWidth;

        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgScaledHeight);

        remainingHeight -= sliceHeight;
        positionY += sliceHeight;
        if (remainingHeight > 0) pdf.addPage();
      }

      const safeName = (character.name || 'character').replace(/[^a-z0-9_-]/gi, '_');
      pdf.save(`${safeName}.pdf`);

      // cleanup
      document.body.removeChild(tmp);
    } catch (err) {
      console.error('Failed to export PDF', err);
      alert('Failed to export PDF');
    }
  };
  const loadCharacter = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const characters = await invoke<Character[]>('load_characters');
      const char = characters.find(c => c.id === id);
      if (char) {
        // Debug log to verify loaded fields
        // eslint-disable-next-line no-console
        console.debug('Loaded character', char.id, { death_saves_success: char.death_saves_success, spell_slots_used: char.spell_slots_used });
        setCharacter(char);
        setLastSaved(new Date());
      } else {
        navigate('/characters');
      }
    } catch (error) {
      console.error('Failed to load character:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveCharacter = async (updatedCharacter: Character) => {
    try {
      // Debug log to help trace persistence
      // eslint-disable-next-line no-console
      console.debug('Saving character', updatedCharacter.id, { death_saves_success: updatedCharacter.death_saves_success, spell_slots_used: updatedCharacter.spell_slots_used });
      await invoke('save_character', { character: updatedCharacter });
      setLastSaved(new Date());
    } catch (error) {
      console.error('Failed to save character:', error);
    }
  };

  const toggleUsedAbility = (abilityId: string) => {
    if (!character) return;
    const usedAbilities = character.used_abilities || [];
    const isUsed = usedAbilities.includes(abilityId);
    const updated = {
      ...character,
      used_abilities: isUsed
        ? usedAbilities.filter(id => id !== abilityId)
        : [...usedAbilities, abilityId]
    };
    setCharacter(updated);
    saveCharacter(updated);
  };

  const toggleSpellSlot = async (level: number, slotIndex: number) => {
    if (!character) return;
    const key = String(level);
    const existing = character.spell_slots_used || {};
    const maxSlots = (character.spell_slots && character.spell_slots[level - 1] !== undefined)
      ? character.spell_slots[level - 1]
      : (level === 1 && character.class === 'Bard' && character.level >= 1 ? 2 : 0);
    const arr = existing[key] ? [...existing[key]] : Array(maxSlots).fill(false);
    // ensure array length matches maxSlots
    while (arr.length < maxSlots) arr.push(false);
    arr[slotIndex] = !arr[slotIndex];
    const updated: Character = { ...character, spell_slots_used: { ...(existing || {}), [key]: arr } };
    setCharacter(updated);
    await saveCharacter(updated);
  };

  const handleUpdate = async (updates: Partial<Character>) => {
    if (!character) return;
    const updated = { ...character, ...updates } as Character;
    setCharacter(updated);
    await saveCharacter(updated);
  };

  const confirmRemoveItem = async () => {
    if (!character || !pendingDeleteItem) return;
    const { type, index } = pendingDeleteItem;
    const key = type === 'equipment' ? 'equipment' : 'spells';
    const updated = {
      ...character,
      [key]: character[key].filter((_, i) => i !== index),
    } as Character;

    setCharacter(updated);
    await saveCharacter(updated);
    setPendingDeleteItem(null);
  };

  const cancelRemoveItem = () => setPendingDeleteItem(null);

  useEffect(() => {
    loadCharacter();
  }, [id]);

  // Preload spell details for spells on the character so the spells tab can show full info immediately
  useEffect(() => {
    if (!character || !Array.isArray(character.spells) || character.spells.length === 0) return;
    const toFetch: Array<{ name: string; index: string }> = [];
    character.spells.forEach((raw: any) => {
      const name = typeof raw === 'string' ? raw : (raw.name || String(raw));
      if (spellsDetails[name]) return; // already cached
      // derive index used by SRD API (best-effort)
      const idx = (typeof raw === 'object' && (raw.index || raw.id)) ? (raw.index || raw.id) : name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      toFetch.push({ name, index: idx });
    });
    if (toFetch.length === 0) return;

    (async () => {
      try {
        const promises = toFetch.map(t => fetchItem('spells', t.index).then(d => ({ name: t.name, detail: d })).catch(() => ({ name: t.name, detail: null })));
        const results = await Promise.all(promises);
        const next: Record<string, any> = {};
        results.forEach((r) => { if (r.detail) next[r.name] = r.detail; });
        if (Object.keys(next).length) setSpellsDetails(prev => ({ ...prev, ...next }));
      } catch (err) {
        // swallow — failing to load SRD details is non-fatal
        // eslint-disable-next-line no-console
        console.error('Failed to preload spell details', err);
      }
    })();
  }, [character?.spells]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!character) {
    return null;
  }

  const proficiencyBonus = getProficiencyBonus(character.level);
  const maxHit = character.max_hit_points ?? (character.level * 8);
  const tempHp = character.temp_hp ?? 0;
  // When showing temp HP, render the bar relative to (max + temp) so temp is visible even when current HP is near max
  const denom = Math.max(1, maxHit + tempHp);
  const hpPercent = Math.max(0, Math.min(100, Math.round((character.hit_points / denom) * 100)));
  const combinedPercent = Math.max(0, Math.min(100, Math.round(((character.hit_points + tempHp) / denom) * 100)));

  // helper to render proficiency icon (0=none,1=proficient,2=half,3=expertise)
  const ProfIcon = ({ id, state, className }: { id: string; state: number; className?: string }) => {
    const safeId = id.replace(/[^a-zA-Z0-9-_]/g, '-');
    const gradId = `grad-${safeId}`;
    if (state === 0) {
      return (
        <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" fill="none" />
        </svg>
      );
    }
    if (state === 1) {
      return (
        <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
    }
    if (state === 2) {
      return (
        <svg className={className} width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id={gradId} x1="0" x2="1">
              <stop offset="50%" stopColor="currentColor" />
              <stop offset="50%" stopColor="transparent" />
            </linearGradient>
          </defs>
          <circle cx="12" cy="12" r="8" fill={`url(#${gradId})`} stroke="currentColor" strokeWidth="1" />
        </svg>
      );
    }
    // state === 3 expertise: filled circle with ring
    return (
      <svg className={className} width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="6" fill="currentColor" />
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </svg>
    );
  };

  // compute effective modifier including proficiency state
  const effectiveModifier = (baseMod: number, profState: number, profBonus: number) => {
    let add = 0;
    if (profState === 1) add = profBonus;
    else if (profState === 2) add = Math.floor(profBonus / 2);
    else if (profState === 3) add = profBonus * 2;
    return baseMod + add;
  };

  return (
    <>
      <div className="p-6" ref={sheetRef}>
        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm mb-6">
          <div className="flex items-center gap-6">
            <button
              onClick={() => navigate('/characters')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>

            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-500 to-rose-500 flex items-center justify-center text-white text-3xl font-semibold shadow-inner">
              {character.name.charAt(0)}
            </div>

            <div className="flex-1 grid grid-cols-2 gap-4 items-start">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{character.name}</h1>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{character.class}{(character as any).subclass ? ` (${(character as any).subclass})` : ''}</div>
                <div className="text-sm text-gray-500 mt-4">Alignment</div>
                <div className="text-lg font-semibold">{(character as any).alignment || '—'}</div>
                
                {lastSaved && <div className="text-sm text-gray-500 mt-2">Last saved: {lastSaved.toLocaleTimeString()}</div>}
                <button onClick={() => exportToPDF()} className="ml-3 px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-md text-sm hover:opacity-90">
                  Export PDF
                </button>
              </div>

              <div>
                <div className="flex items-center gap-3">
                  <div>
                    <div className="text-sm text-gray-500">Level</div>
                    <div className="text-lg font-semibold">{character.level}</div>
                  </div>
                  {character.level < 20 && (
                    <button
                      onClick={() => setShowLevelUpModal(true)}
                      className="px-3 py-1 bg-primary text-white rounded hover:opacity-90 text-sm font-medium"
                    >
                      Level Up
                    </button>
                  )}
                </div>

                <div className="text-sm text-gray-500 mt-3">Race</div>
                <div className="text-lg font-semibold">{character.race}</div>

                <div className="text-sm text-gray-500 mt-3">Background</div>
                <div className="text-lg font-semibold">{character.background || '—'}</div>
              </div>
            </div>

            <div className="w-80">
              {/* Long Rest and Short Rest buttons */}
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setPendingRest('long')}
                  className="flex-1 px-3 py-2 bg-primary text-white rounded hover:opacity-90 text-sm font-medium transition-opacity"
                  title="Reset all long rest abilities"
                >
                  Long Rest
                </button>
                <button
                  type="button"
                  onClick={() => setPendingRest('short')}
                  className="flex-1 px-3 py-2 bg-primary text-white rounded hover:opacity-90 text-sm font-medium transition-opacity opacity-75"
                  title="Short rest (currently does nothing)"
                >
                  Short Rest
                </button>
              </div>

              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <svg className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="none"><path d="M12 21s-6.716-4.35-9.197-7.018C.89 11.958 3.086 7 6.5 7 8.042 7 9 7.9 9 9.2 9 7.9 9.958 7 11.5 7 14.914 7 17.11 11.958 21.197 13.982 18.716 16.65 12 21 12 21z" stroke="currentColor" strokeWidth="0"/></svg>
                  <div className="text-sm font-medium">Hit Points</div>
                </div>
                <div className="text-sm text-gray-600">{character.hit_points}{tempHp > 0 ? ` (+${tempHp})` : ''} / {maxHit + (tempHp > 0 ? tempHp : 0)}</div>
              </div>

              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-10 overflow-hidden relative">
                {/* Orange segment for combined (current + temp) */}
                <div className="absolute left-0 top-0 h-10 bg-orange-500 rounded-full transition-all" style={{ width: `${combinedPercent}%` }} />
                {/* Red segment for current HP overlays the left portion */}
                <div className="absolute left-0 top-0 h-10 bg-red-600 rounded-full transition-all" style={{ width: `${hpPercent}%` }} />
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                <input
                  type="number"
                  aria-label="Current HP"
                  className="px-2 py-1 border rounded text-center bg-white dark:bg-gray-800"
                  value={character.hit_points}
                  onChange={async (e) => {
                    const raw = Number(e.target.value);
                    const v = Number.isFinite(raw) ? Math.max(0, Math.min(raw, maxHit)) : 0;
                    await handleUpdate({ hit_points: v });
                  }}
                />

                <input
                  type="number"
                  aria-label="Max HP"
                  className="px-2 py-1 border rounded text-center bg-white dark:bg-gray-800"
                  value={character.max_hit_points ?? (character.level * 8)}
                  onChange={async (e) => {
                    const raw = Number(e.target.value);
                    const v = Number.isFinite(raw) ? Math.max(1, raw) : (character.level * 8);
                    // if current HP is greater than new max, clamp it down
                    const updated: Character = { ...character, max_hit_points: v };
                    if (updated.hit_points > v) updated.hit_points = v;
                    setCharacter(updated);
                    await saveCharacter(updated);
                  }}
                />

                <input
                  type="number"
                  aria-label="Temporary HP"
                  className="px-2 py-1 border rounded text-center bg-white dark:bg-gray-800"
                  value={character.temp_hp ?? 0}
                  onChange={async (e) => {
                    const raw = Number(e.target.value);
                    const v = Number.isFinite(raw) ? Math.max(0, raw) : 0;
                    const updated: Character = { ...character, temp_hp: v };
                    setCharacter(updated);
                    await saveCharacter(updated);
                  }}
                />
              </div>
              {/* labels below inputs */}
              <div className="mt-1 grid grid-cols-3 gap-2 text-xs text-gray-500 dark:text-gray-400">
                <div className="text-center">Current</div>
                <div className="text-center">Max</div>
                <div className="text-center">Temp</div>
              </div>

              {/* Heroic Inspiration toggle (persisted) */}
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (!character) return;
                    const updated: Character = { ...character, heroic_inspiration: !(character.heroic_inspiration ?? false) };
                    setCharacter(updated);
                    await saveCharacter(updated);
                  }}
                  className={`w-8 h-8 rounded flex items-center justify-center border ${character.heroic_inspiration ? 'bg-yellow-400 text-white border-yellow-400' : 'bg-white dark:bg-gray-800 text-gray-700 border-gray-300 dark:border-gray-600'}`}
                  aria-pressed={!!character.heroic_inspiration}
                  title={character.heroic_inspiration ? 'Heroic Inspiration: Active' : 'Heroic Inspiration: Inactive'}
                >
                  {character.heroic_inspiration ? '★' : '☆'}
                </button>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Heroic Inspiration</div>
              </div>
            </div>
          </div>
        </div>

        {/* Top row: Abilities + Combat */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
          <div className="lg:col-span-8">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold mb-3">Ability Scores</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {Object.entries(character.ability_scores).map(([key, val]) => {
                  const label = key.slice(0, 3).toUpperCase();
                  const modifier = getAbilityModifier(val as number);
                  return (
                    <div key={key} className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col items-center">
                      <div className="rounded-full bg-amber-500 text-white w-12 h-12 flex items-center justify-center text-lg font-semibold mb-3">{modifier >= 0 ? `+${modifier}` : modifier}</div>
                      <div className="text-sm text-gray-500">{label}</div>
                      <div className="text-2xl font-bold mt-1">{val}</div>
                      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded h-2 mt-3" />
                    </div>
                  );
                })}
              </div>
              
              {/* Saving Throws: horizontal row below ability scores */}
              <div className="mt-4 border-t pt-4">
                <div className="grid grid-cols-6 gap-3">
                  {['strength','dexterity','constitution','intelligence','wisdom','charisma'].map((s) => {
                    const mod = getAbilityModifier((character.ability_scores as any)[s]);
                    const profState = character.saving_throw_proficiencies?.[s] ?? 0;
                    const eff = effectiveModifier(mod, profState, proficiencyBonus);
                    return (
                      <div key={s} className="bg-gray-50 dark:bg-gray-700 p-3 rounded text-center">
                        <div className="text-xs text-gray-500">{s.charAt(0).toUpperCase() + s.slice(1)}</div>
                        <div className="text-lg font-semibold mt-1">{eff >= 0 ? `+${eff}` : eff}</div>
                        <div className="mt-2 flex items-center justify-center">
                          <div className="focus:outline-none" aria-hidden>
                            <ProfIcon id={`save-${s}`} state={profState} className={`${profState === 3 ? 'text-yellow-500' : profState === 1 ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-300'}`} />
                          </div>
                        </div>
                        <div className="mt-1 text-xs text-gray-400">Save</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-sm text-gray-500">AC</div>
                  <div className="text-2xl font-bold">{character.armor_class}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-500">Initiative</div>
                  <div className="text-2xl font-bold">{character.initiative >= 0 ? `+${character.initiative}` : character.initiative}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-500">Prof.</div>
                  <div className="text-2xl font-bold">+{proficiencyBonus}</div>
                </div>
              </div>
              <div className="mt-4 border-t pt-4">
                <div className="grid grid-cols-2 gap-4 items-center">
                  <div>
                        <div className="text-sm text-gray-500">Speed</div>
                        <div className="text-lg font-semibold">{((character as any).speed) || (character.race === 'Halfling' ? '25 ft' : '30 ft')}</div>
                  </div>
                      <div>
                        <div className="text-sm text-gray-500">Size</div>
                        <div className="text-lg font-semibold">{character.race === 'Halfling' ? 'Small' : ((character as any).size || 'Medium')}</div>
                      </div>
                  <div>
                    <div className="text-sm text-gray-500">Hit Dice</div>
                    <div className="text-lg font-semibold">
                      {(() => {
                        const cls = (character as any).class || character.class;
                        const classHitDie: Record<string, number> = {
                          Barbarian: 12,
                          Fighter: 10,
                          Paladin: 10,
                          Ranger: 10,
                          Bard: 8,
                          Cleric: 8,
                          Druid: 8,
                          Monk: 8,
                          Rogue: 8,
                          Warlock: 8,
                          Sorcerer: 6,
                          Wizard: 6,
                        };
                        const die = classHitDie[cls] ?? 8;
                        const count = character.level || 1;
                        const remaining = (character as any).hit_dice_remaining ?? count;
                        return `${count}d${die} (${remaining} left)`;
                      })()}
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Death Saves</div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="text-xs text-gray-500 w-16">Success</div>
                      <div className="flex items-center gap-2">
                        {(character.death_saves_success ?? [false, false, false]).map((val, i) => (
                          <button
                            key={`ds-success-${i}`}
                            aria-pressed={val}
                            onClick={async () => {
                              const arr = [...(character.death_saves_success ?? [false, false, false])];
                              arr[i] = !arr[i];
                              const updated: Character = { ...character, death_saves_success: arr };
                              setCharacter(updated);
                              await saveCharacter(updated);
                            }}
                            className={`w-6 h-6 rounded-full border flex items-center justify-center transition-colors ${val ? 'bg-green-500 border-green-600' : 'bg-transparent border-gray-300 dark:border-gray-600'} focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-green-300`}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-xs text-gray-500 w-16">Failure</div>
                      <div className="flex items-center gap-2">
                        {(character.death_saves_failure ?? [false, false, false]).map((val, i) => (
                          <button
                            key={`ds-failure-${i}`}
                            aria-pressed={val}
                            onClick={async () => {
                              const arr = [...(character.death_saves_failure ?? [false, false, false])];
                              arr[i] = !arr[i];
                              const updated: Character = { ...character, death_saves_failure: arr };
                              setCharacter(updated);
                              await saveCharacter(updated);
                            }}
                            className={`w-6 h-6 rounded-full border flex items-center justify-center transition-colors ${val ? 'bg-red-500 border-red-600' : 'bg-transparent border-gray-300 dark:border-gray-600'} focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-red-300`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                {/* Natural bonuses (e.g., racial traits) shown under death saves */}
                <div className="mt-3">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Natural Bonuses</div>
                  <div className="text-sm text-gray-600 dark:text-gray-200 space-y-2">
                    {character.race === 'Half-Elf' ? (
                      (() => {
                        const bonuses = [
                          { id: 'darkvision', title: 'Darkvision 60 ft.', detail: "Thanks to your elf blood, you have superior vision in dark and dim conditions. You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light. You can’t discern color in darkness, only shades of gray." },
                          { id: 'fey_ancestry', title: 'Magical Sleep Defense', detail: "You have advantage on saving throws against being charmed, and magic can’t put you to sleep." },
                        ];
                        return bonuses.map(b => (
                          <div key={b.id}>
                            <button type="button" onClick={() => setExpandedBonuses({ ...expandedBonuses, [b.id]: !expandedBonuses[b.id] })} className="text-left px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 w-full">
                              <div className="flex items-center justify-between">
                                <div className="font-medium">{b.title}</div>
                                <div className="text-xs text-gray-500">{expandedBonuses[b.id] ? '▲' : '▼'}</div>
                              </div>
                            </button>
                            {expandedBonuses[b.id] && (
                              <div className="mt-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs dark:text-gray-200 text-gray-700">
                                {b.detail}
                              </div>
                            )}
                          </div>
                        ));
                      })()
                    ) : character.race === 'Tiefling' ? (
                      (() => {
                        const bonuses = [
                          { id: 'darkvision', title: 'Darkvision 60 ft.', detail: "Thanks to your infernal heritage, you have superior vision in dark and dim conditions. You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light. You can’t discern color in darkness, only shades of gray." },
                          { id: 'hellish_resistance', title: 'Hellish Resistance', detail: 'You have resistance to fire damage.' },
                          { id: 'infernal_legacy', title: 'Infernal Legacy', detail: "You know the thaumaturgy cantrip. At 3rd level you can cast hellish rebuke as a 2nd-level spell once per long rest, and at 5th level you can cast darkness once per long rest. Charisma is your spellcasting ability for these spells." },
                        ];
                        return bonuses.map(b => (
                          <div key={b.id}>
                            <button type="button" onClick={() => setExpandedBonuses({ ...expandedBonuses, [b.id]: !expandedBonuses[b.id] })} className="text-left px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 w-full">
                              <div className="flex items-center justify-between">
                                <div className="font-medium">{b.title}</div>
                                <div className="text-xs text-gray-500">{expandedBonuses[b.id] ? '▲' : '▼'}</div>
                              </div>
                            </button>
                            {expandedBonuses[b.id] && (
                              <div className="mt-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs dark:text-gray-200 text-gray-700">
                                {b.detail}
                              </div>
                            )}
                          </div>
                        ));
                      })()
                      ) : character.race === 'Gnome' ? (
                        (() => {
                          const bonuses = [
                            { id: 'darkvision', title: 'Darkvision 60 ft.', detail: "Accustomed to life underground, you have superior vision in dark and dim conditions. You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light. You can’t discern color in darkness, only shades of gray." },
                            { id: 'gnome_cunning', title: 'Gnome Cunning', detail: "You have advantage on all Intelligence, Wisdom, and Charisma saving throws against magic." },
                            { id: 'artificers_lore', title: `Artificer's Lore`, detail: "Whenever you make an Intelligence (History) check related to magic items, alchemical objects, or technological devices, you can add twice your proficiency bonus, instead of any proficiency bonus you normally apply." },
                            { id: 'tinker', title: 'Tinker', detail: "You have proficiency with artisan's tools (tinker's tools). Using those tools, you can spend 1 hour and 10 gp worth of materials to construct a Tiny clockwork device. The device ceases to function after 24 hours (unless repaired) or when dismantled; you can have up to three such devices active. Choose one: Clockwork Toy (moves 5 ft each turn), Fire Starter (produces a miniature flame), Music Box (plays a single song)." },
                          ];
                          return bonuses.map(b => (
                            <div key={b.id}>
                              <button type="button" onClick={() => setExpandedBonuses({ ...expandedBonuses, [b.id]: !expandedBonuses[b.id] })} className="text-left px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 w-full">
                                <div className="flex items-center justify-between">
                                  <div className="font-medium">{b.title}</div>
                                  <div className="text-xs text-gray-500">{expandedBonuses[b.id] ? '▲' : '▼'}</div>
                                </div>
                              </button>
                              {expandedBonuses[b.id] && (
                                <div className="mt-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs dark:text-gray-200 text-gray-700">
                                  {b.detail}
                                </div>
                              )}
                            </div>
                          ));
                        })()
                      ) : character.race === 'Half-Orc' ? (
                        (() => {
                          const bonuses = [
                            { id: 'darkvision', title: 'Darkvision 60 ft.', detail: "Thanks to your orc blood, you have superior vision in dark and dim conditions. You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light. You can't discern color in darkness, only shades of gray.", longRest: false },
                            { id: 'relentless_endurance', title: 'Relentless Endurance', detail: "When you are reduced to 0 hit points but not killed outright, you can drop to 1 hit point instead. You can't use this feature again until you finish a long rest.", longRest: true },
                            { id: 'savage_attacks', title: 'Savage Attacks', detail: "When you score a critical hit with a melee weapon attack, you can roll one of the weapon's damage dice one additional time and add it to the extra damage of the critical hit.", longRest: false },
                          ];
                          return bonuses.map(b => {
                            const isUsed = (character.used_abilities || []).includes(b.id);
                            return (
                            <div key={b.id}>
                              <button type="button" onClick={() => setExpandedBonuses({ ...expandedBonuses, [b.id]: !expandedBonuses[b.id] })} className="text-left px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 w-full">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    {b.longRest && (
                                      <input
                                        type="checkbox"
                                        checked={isUsed}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          toggleUsedAbility(b.id);
                                        }}
                                        className="w-4 h-4 cursor-pointer"
                                        title={isUsed ? "Used (click to mark as available)" : "Available (click to mark as used)"}
                                      />
                                    )}
                                    <div className="font-medium">{b.title}</div>
                                  </div>
                                  <div className="text-xs text-gray-500">{expandedBonuses[b.id] ? '▲' : '▼'}</div>
                                </div>
                              </button>
                              {expandedBonuses[b.id] && (
                                <div className="mt-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs dark:text-gray-200 text-gray-700">
                                  {b.detail}
                                </div>
                              )}
                            </div>
                            );
                          });
                        })()
                      ) : character.race === 'Halfling' ? (
                      (() => {
                        const bonuses = [
                          { id: 'lucky', title: 'Lucky', detail: 'When you roll a 1 on an attack roll, ability check, or saving throw, you can reroll the die. You must use the new result.' },
                          { id: 'brave', title: 'Brave', detail: 'You have advantage on saving throws against being frightened.' },
                          { id: 'nimble', title: 'Halfling Nimbleness', detail: 'You can move through the space of any creature that is of a size larger than you.' },
                        ];
                        // include subrace-specific trait
                        if ((character as any).subrace === 'Lightfoot') {
                          bonuses.push({
                            id: 'naturally_stealthy',
                            title: 'Naturally Stealthy',
                            detail: 'You can attempt to hide even when you are obscured only by a creature that is at least one size larger than you. Lightfoot halflings are more outgoing than other halflings, and they have a natural knack for blending into other cultures. They are quick and unobtrusive.'
                          });
                        } else if ((character as any).subrace === 'Stout') {
                          bonuses.push({
                            id: 'stout_resilience',
                            title: 'Stout Resilience',
                            detail: 'You have advantage on saving throws against poison, and you have resistance to poison damage. Stout halflings are hardier than other halflings and have some dwarven blood in their ancestry. They stand fast in the face of danger.'
                          });
                        }
                        // speed and size are shown in the dedicated UI above; do not duplicate here
                        return bonuses.map(b => (
                          <div key={b.id}>
                            <button type="button" onClick={() => setExpandedBonuses({ ...expandedBonuses, [b.id]: !expandedBonuses[b.id] })} className="text-left px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 w-full">
                              <div className="flex items-center justify-between">
                                <div className="font-medium">{b.title}</div>
                                <div className="text-xs text-gray-500">{expandedBonuses[b.id] ? '▲' : '▼'}</div>
                              </div>
                            </button>
                            {expandedBonuses[b.id] && (
                              <div className="mt-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs dark:text-gray-200 text-gray-700">
                                {b.detail}
                              </div>
                            )}
                          </div>
                        ));
                      })()
                    ) : (
                      <div className="text-xs text-gray-500">No special natural bonuses listed.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main content row: left/middle/right (right has tabs) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: (saving throws moved above) */}
          <div className="space-y-6" />

          {/* Middle Column: (removed Quick Roller & duplicate Additional Combat Info) */}
          <div className="space-y-6" />

          {/* Right Column: (reserve area for left) */}
          <div className="space-y-6" />

          {/* Tabs module: span left + middle columns (two-column wide) */}
          <div className="lg:col-start-1 lg:col-span-2 lg:row-start-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-0 border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="flex bg-gray-50 dark:bg-gray-900 p-2 gap-2">
                <button className={`flex-1 text-left px-3 py-2 ${activeTab==='attacks' ? 'bg-white dark:bg-gray-800' : 'text-gray-600 dark:text-gray-300'}`} onClick={() => setActiveTab('attacks')}>Attacks & Weapons</button>
                <button className={`flex-1 text-left px-3 py-2 ${activeTab==='features' ? 'bg-white dark:bg-gray-800' : 'text-gray-600 dark:text-gray-300'}`} onClick={() => setActiveTab('features')}>Features</button>
                <button className={`flex-1 text-left px-3 py-2 ${activeTab==='proficiencies' ? 'bg-white dark:bg-gray-800' : 'text-gray-600 dark:text-gray-300'}`} onClick={() => setActiveTab('proficiencies')}>Proficiencies</button>
              </div>
              <div className="flex bg-gray-50 dark:bg-gray-900 p-2 gap-2">
                <button className={`flex-1 text-left px-3 py-2 ${activeTab==='spells' ? 'bg-white dark:bg-gray-800' : 'text-gray-600 dark:text-gray-300'}`} onClick={() => setActiveTab('spells')}>Spells</button>
                <button className={`flex-1 text-left px-3 py-2 ${activeTab==='inventory' ? 'bg-white dark:bg-gray-800' : 'text-gray-600 dark:text-gray-300'}`} onClick={() => setActiveTab('inventory')}>Inventory</button>
                <button className={`flex-1 text-left px-3 py-2 ${activeTab==='notes' ? 'bg-white dark:bg-gray-800' : 'text-gray-600 dark:text-gray-300'}`} onClick={() => setActiveTab('notes')}>Notes</button>
              </div>
              <div className="p-4">
                {activeTab === 'attacks' && (
                  <div>
                    <div className="text-sm text-gray-600">{(character as any).attacks?.length ? `${(character as any).attacks.length} attacks` : 'No attacks defined.'}</div>
                    <div className="space-y-3 mt-3">
                      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">Rapier +1 — Attack: +8 • Damage: 1d8+5 Piercing</div>
                      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">Shortbow — Attack: +7 • Damage: 1d6+4 Piercing</div>
                    </div>
                  </div>
                )}
                {activeTab === 'features' && (
                  <div className="text-sm text-gray-600">No features listed.</div>
                )}
                {activeTab === 'proficiencies' && (
                  <div className="space-y-2">
                    <div>
                      <div className="text-xs text-gray-500">Armor Proficiencies</div>
                      <div className="text-sm text-gray-700 dark:text-gray-200">{(character.armor_proficiencies && character.armor_proficiencies.length) ? character.armor_proficiencies.join(', ') : 'None'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Weapon Proficiencies</div>
                      <div className="text-sm text-gray-700 dark:text-gray-200">{(character.weapon_proficiencies && character.weapon_proficiencies.length) ? character.weapon_proficiencies.join(', ') : 'None'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Tool Proficiencies</div>
                      <div className="text-sm text-gray-700 dark:text-gray-200">{(character.tool_proficiencies && character.tool_proficiencies.length) ? character.tool_proficiencies.join(', ') : 'None'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Languages</div>
                      {(() => {
                        const explicit = (character.languages && character.languages.length) ? character.languages : null;
                        const fallback = character.race === 'Halfling' ? ['Common','Halfling'] : character.race === 'Tiefling' ? ['Common','Infernal'] : character.race === 'Gnome' ? ['Common','Gnomish'] : character.race === 'Half-Elf' ? ['Common','Elvish'] : character.race === 'Human' ? ['Common'] : ['Common'];
                        const toShow = explicit ?? fallback;
                        return <div className="text-sm text-gray-700 dark:text-gray-200">{toShow.join(', ')}</div>;
                      })()}
                    </div>
                  </div>
                )}
                {activeTab === 'spells' && (
                  <div>
                    {(!character.spells || character.spells.length === 0) ? (
                      <div className="text-sm text-gray-500">No known spells.</div>
                    ) : (
                      (() => {
                        // Build grouped map: level -> array of { name, details }
                        const groups = new Map<number, Array<{ name: string; details: any }>>();
                        const uncategorized: Array<{ name: string; details: any }> = [];
                        character.spells.forEach((raw: any) => {
                          const name = typeof raw === 'string' ? raw : (raw.name || String(raw));
                          const details = spellsDetails[name] ?? (typeof raw === 'object' ? (raw.details || null) : null);
                          const level = details?.level ?? (typeof raw === 'object' && raw.level !== undefined ? raw.level : null);
                          if (level === null || level === undefined) {
                            uncategorized.push({ name, details });
                          } else {
                            const arr = groups.get(level) || [];
                            arr.push({ name, details });
                            groups.set(level, arr);
                          }
                        });

                        // Sort levels ascending
                        const levels = Array.from(groups.keys()).sort((a, b) => a - b);

                        return (
                          <div className="space-y-4">
                            {levels.map((lvl) => (
                              <div key={`lvl-${lvl}`}>
                                <div className="flex items-center justify-between mb-2">
                                  <div className="text-sm font-semibold">{lvl === 0 ? 'Cantrips' : `Level ${lvl}`}</div>
                                  {lvl === 1 && (
                                    (() => {
                                      const maxSlots = (character.spell_slots && character.spell_slots[0] !== undefined)
                                        ? character.spell_slots[0]
                                        : (character.class === 'Bard' && character.level >= 1 ? 2 : 0);
                                      const usedArr = character.spell_slots_used?.['1'] ?? Array(maxSlots).fill(false);
                                      if (maxSlots <= 0) return null;
                                      return (
                                        <div className="flex items-center gap-2">
                                          {Array.from({ length: maxSlots }).map((_, si) => {
                                            const used = usedArr[si] ?? false;
                                            return (
                                              <button key={`slot-1-${si}`} title={used ? 'Used' : 'Available'} onClick={() => toggleSpellSlot(1, si)} className={`w-6 h-6 rounded flex items-center justify-center border ${used ? 'bg-red-500 text-white border-red-500' : 'bg-white dark:bg-gray-800 text-gray-700 border-gray-300 dark:border-gray-600'}`}>
                                                {used ? '●' : ''}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      );
                                    })()
                                  )}
                                </div>
                                <div className="space-y-2">
                                  {groups.get(lvl)!.map((entry, i) => {
                                    const { name, details } = entry;
                                    const casting = details?.casting_time ?? '—';
                                    const range = details?.range ?? '—';
                                    const duration = details?.duration ?? '-';
                                    let hitdc = '-';
                                    if (details) {
                                      if (typeof details.attack_bonus === 'number') {
                                        const v = details.attack_bonus;
                                        hitdc = `${v >= 0 ? `+${v}` : v}`;
                                      } else if (details.attack_type) {
                                        hitdc = `${String(details.attack_type)} attack`;
                                      } else if (details.dc) {
                                        const dcType = details.dc.dc_type?.name ?? 'Save';
                                        const dcSuccess = details.dc.dc_success ? ` (${details.dc.dc_success})` : '';
                                        hitdc = `${dcType} save${dcSuccess}`;
                                      }
                                    }
                                    let effect = 'Utility';
                                    if (details?.damage) {
                                      if (details.damage.damage_at_slot_level) {
                                        const vals = Object.values(details.damage.damage_at_slot_level);
                                        effect = typeof vals[0] === 'string' ? String(vals[0]) : 'Damage';
                                      } else if (details.damage.damage_at_character_level) {
                                        const vals = Object.values(details.damage.damage_at_character_level);
                                        effect = typeof vals[0] === 'string' ? String(vals[0]) : 'Damage';
                                      } else {
                                        effect = 'Damage';
                                      }
                                    } else if (details?.desc && Array.isArray(details.desc) && details.desc.length > 0) {
                                      const first = details.desc[0];
                                      effect = String(first).split('\n')[0].split('. ')[0] || 'Utility';
                                    }
                                    const components = details ? (Array.isArray(details.components) ? details.components.join(', ') : (details.components || '')) : '';

                                    return (
                                      <div key={`${name}-${i}`} className="p-3 rounded bg-gray-50 dark:bg-gray-700 flex items-start justify-between">
                                        <div>
                                          <div className="font-medium">{name}</div>
                                          <div className="text-xs text-gray-700 dark:text-gray-200">{casting} • {range} • Hit/DC: {hitdc}</div>
                                          <div className="text-xs text-gray-700 dark:text-gray-200 mt-1">Effect: {effect}</div>
                                          <div className="text-xs text-gray-700 dark:text-gray-200">Duration: {duration} • Components: {components || '-'}</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <button className="px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded" onClick={async () => {
                                            setSelectedSpellName(name);
                                            if (details) {
                                              setSelectedSpellDetail(details);
                                            } else {
                                              try {
                                                const idx = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                                                const d = await fetchItem('spells', idx);
                                                setSpellsDetails(prev => ({ ...prev, [name]: d }));
                                                setSelectedSpellDetail(d);
                                              } catch (err) {
                                                console.error('Failed to load spell details', name, err);
                                                setSelectedSpellDetail(null);
                                              }
                                            }
                                          }}>View</button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}

                            {uncategorized.length > 0 && (
                              <div>
                                <div className="text-sm font-semibold mb-2">Other</div>
                                <div className="space-y-2">
                                  {uncategorized.map((entry, i) => {
                                    const name = entry.name;
                                    const details = entry.details;
                                    const casting = details?.casting_time ?? '—';
                                    const range = details?.range ?? '—';
                                    const duration = details?.duration ?? '-';
                                    let hitdc = '-';
                                    if (details) {
                                      if (typeof details.attack_bonus === 'number') {
                                        const v = details.attack_bonus;
                                        hitdc = `${v >= 0 ? `+${v}` : v}`;
                                      } else if (details.attack_type) {
                                        hitdc = `${String(details.attack_type)} attack`;
                                      } else if (details.dc) {
                                        const dcType = details.dc.dc_type?.name ?? 'Save';
                                        const dcSuccess = details.dc.dc_success ? ` (${details.dc.dc_success})` : '';
                                        hitdc = `${dcType} save${dcSuccess}`;
                                      }
                                    }
                                    let effect = 'Utility';
                                    if (details?.damage) {
                                      if (details.damage.damage_at_slot_level) {
                                        const vals = Object.values(details.damage.damage_at_slot_level);
                                        effect = typeof vals[0] === 'string' ? String(vals[0]) : 'Damage';
                                      } else if (details.damage.damage_at_character_level) {
                                        const vals = Object.values(details.damage.damage_at_character_level);
                                        effect = typeof vals[0] === 'string' ? String(vals[0]) : 'Damage';
                                      } else {
                                        effect = 'Damage';
                                      }
                                    } else if (details?.desc && Array.isArray(details.desc) && details.desc.length > 0) {
                                      const first = details.desc[0];
                                      effect = String(first).split('\n')[0].split('. ')[0] || 'Utility';
                                    }
                                    const components = details ? (Array.isArray(details.components) ? details.components.join(', ') : (details.components || '')) : '';

                                    return (
                                      <div key={`unc-${name}-${i}`} className="p-3 rounded bg-gray-50 dark:bg-gray-700 flex items-start justify-between">
                                        <div>
                                          <div className="font-medium">{name}</div>
                                          <div className="text-xs text-gray-700 dark:text-gray-200">{casting} • {range} • Hit/DC: {hitdc}</div>
                                          <div className="text-xs text-gray-700 dark:text-gray-200 mt-1">Effect: {effect}</div>
                                          <div className="text-xs text-gray-700 dark:text-gray-200">Duration: {duration} • Components: {components || '-'}</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <button className="px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded" onClick={async () => {
                                            setSelectedSpellName(name);
                                            if (details) setSelectedSpellDetail(details);
                                            else {
                                              try {
                                                const idx = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                                                const d = await fetchItem('spells', idx);
                                                setSpellsDetails(prev => ({ ...prev, [name]: d }));
                                                setSelectedSpellDetail(d);
                                              } catch (err) {
                                                console.error('Failed to load spell details', name, err);
                                                setSelectedSpellDetail(null);
                                              }
                                            }
                                          }}>View</button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()
                    )}
                  </div>
                )}
                {activeTab === 'inventory' && (
                  <div>
                    {/* Currency section */}
                    <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded">
                      <div className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-200">Currency</div>
                      <div className="grid grid-cols-4 gap-3">
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Platinum</label>
                          <input
                            type="number"
                            min="0"
                            value={character.currency?.platinum ?? 0}
                            onChange={async (e) => {
                              const val = Math.max(0, parseInt(e.target.value) || 0);
                              const updated: Character = {
                                ...character,
                                currency: {
                                  platinum: val,
                                  gold: character.currency?.gold ?? 0,
                                  silver: character.currency?.silver ?? 0,
                                  copper: character.currency?.copper ?? 0,
                                }
                              };
                              setCharacter(updated);
                              await saveCharacter(updated);
                            }}
                            className="w-full px-2 py-1 border rounded text-center bg-white dark:bg-gray-800"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Gold</label>
                          <input
                            type="number"
                            min="0"
                            value={character.currency?.gold ?? 0}
                            onChange={async (e) => {
                              const val = Math.max(0, parseInt(e.target.value) || 0);
                              const updated: Character = {
                                ...character,
                                currency: {
                                  platinum: character.currency?.platinum ?? 0,
                                  gold: val,
                                  silver: character.currency?.silver ?? 0,
                                  copper: character.currency?.copper ?? 0,
                                }
                              };
                              setCharacter(updated);
                              await saveCharacter(updated);
                            }}
                            className="w-full px-2 py-1 border rounded text-center bg-white dark:bg-gray-800"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Silver</label>
                          <input
                            type="number"
                            min="0"
                            value={character.currency?.silver ?? 0}
                            onChange={async (e) => {
                              const val = Math.max(0, parseInt(e.target.value) || 0);
                              const updated: Character = {
                                ...character,
                                currency: {
                                  platinum: character.currency?.platinum ?? 0,
                                  gold: character.currency?.gold ?? 0,
                                  silver: val,
                                  copper: character.currency?.copper ?? 0,
                                }
                              };
                              setCharacter(updated);
                              await saveCharacter(updated);
                            }}
                            className="w-full px-2 py-1 border rounded text-center bg-white dark:bg-gray-800"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Copper</label>
                          <input
                            type="number"
                            min="0"
                            value={character.currency?.copper ?? 0}
                            onChange={async (e) => {
                              const val = Math.max(0, parseInt(e.target.value) || 0);
                              const updated: Character = {
                                ...character,
                                currency: {
                                  platinum: character.currency?.platinum ?? 0,
                                  gold: character.currency?.gold ?? 0,
                                  silver: character.currency?.silver ?? 0,
                                  copper: val,
                                }
                              };
                              setCharacter(updated);
                              await saveCharacter(updated);
                            }}
                            className="w-full px-2 py-1 border rounded text-center bg-white dark:bg-gray-800"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Equipment list */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                        Equipment ({character.equipment.length} items)
                      </div>
                      <button
                        onClick={() => setShowAddItemModal(true)}
                        className="px-3 py-1 bg-primary text-white rounded hover:opacity-90 text-sm"
                      >
                        Add Item
                      </button>
                    </div>
                    {character.equipment.length === 0 ? (
                      <div className="text-sm text-gray-500">No items in inventory</div>
                    ) : (
                      <div className="space-y-2">
                        {character.equipment.map((item, index) => {
                          const itemObj = typeof item === 'string' ? { name: item } : item;
                          const isExpanded = expandedItems[index] || false;
                          const hasDetails = itemObj.description || (itemObj.cost !== undefined && itemObj.cost !== null);

                          return (
                            <div key={index} className="bg-gray-50 dark:bg-gray-700 rounded">
                              <div className="flex items-center justify-between p-2">
                                <button
                                  onClick={() => hasDetails ? setExpandedItems({ ...expandedItems, [index]: !isExpanded }) : undefined}
                                  className={`flex-1 text-left flex items-center gap-2 ${hasDetails ? 'cursor-pointer' : 'cursor-default'}`}
                                >
                                  <div className="text-sm text-gray-700 dark:text-gray-200">{itemObj.name}</div>
                                  {itemObj.cost !== undefined && itemObj.cost !== null && (
                                    <span className="text-xs text-gray-500">({itemObj.cost} gp)</span>
                                  )}
                                  {hasDetails && (
                                    <span className="text-xs text-gray-500">{isExpanded ? '▲' : '▼'}</span>
                                  )}
                                </button>
                                <button
                                  onClick={() => setPendingDeleteItem({ type: 'equipment', index })}
                                  className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                                >
                                  Remove
                                </button>
                              </div>
                              {isExpanded && itemObj.description && (
                                <div className="px-3 pb-2 text-xs text-gray-600 dark:text-gray-300 border-t border-gray-200 dark:border-gray-600 pt-2">
                                  {itemObj.description}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
                {activeTab === 'notes' && (
                  <div>
                    <textarea value={character.notes} onChange={(e) => handleUpdate({ notes: e.target.value })} className="w-full h-40 p-2 border rounded bg-white dark:bg-gray-700" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Skills (moved to be adjacent to the two-column tabs) */}
          <div className="space-y-6 lg:col-start-3 lg:row-start-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold mb-3">Skills</h2>
              <div className="space-y-2">
                  {[
                  ['Athletics','strength'],
                  ['Acrobatics','dexterity'],
                  ['Sleight of Hand','dexterity'],
                  ['Stealth','dexterity'],
                  ['Arcana','intelligence'],
                  ['History','intelligence'],
                  ['Investigation','intelligence'],
                  ['Nature','intelligence'],
                  ['Religion','intelligence'],
                  ['Perception','wisdom'],
                  ['Survival','wisdom'],
                  ['Deception','charisma'],
                  ['Intimidation','charisma'],
                  ['Performance','charisma'],
                  ['Persuasion','charisma'],
                  ].map(([name, ability]) => {
                  const mod = getAbilityModifier((character.ability_scores as any)[ability]);
                  const profState = character.skill_proficiencies?.[name] ?? 0;
                  const eff = effectiveModifier(mod, profState, proficiencyBonus);
                  return (
                    <div key={name as string} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                      <div className="flex items-center gap-3">
                        <div aria-hidden>
                          <ProfIcon id={`skill-${name}`} state={profState} className={`${profState === 3 ? 'text-yellow-500' : profState === 1 ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-300'}`} />
                        </div>
                        <div>
                          <div className="text-sm font-medium">{name}</div>
                            <div className="text-xs text-gray-500">{ability.toUpperCase().slice(0,3)}</div>
                        </div>
                        </div>
                        <div className="flex items-center gap-2">
                        <button className="px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded text-sm" onClick={() => console.log(`Roll skill ${name} +${mod}`)}>🎲</button>
                          <div className="text-sm">{eff >= 0 ? `+${eff}` : eff}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
      <ConfirmModal
        open={!!pendingDeleteItem}
        title="Delete Item"
        message="Are you sure you want to delete this item?"
        onConfirm={confirmRemoveItem}
        onCancel={cancelRemoveItem}
      />
      {/* Rest confirmation modal */}
      {/* Long Rest: simple confirm modal; Short Rest: custom modal to spend hit dice */}
      {pendingRest === 'long' && (
        <ConfirmModal
          open={true}
          title="Long Rest"
          message={'Taking a long rest will reset all long rest abilities and restore some Hit Dice. Continue?'}
          confirmText="Confirm"
          confirmStyle="primary"
          onConfirm={async () => {
            if (!character) return;
            const level = character.level || 1;
            const currentRemaining = (character as any).hit_dice_remaining ?? level;
            const regain = Math.max(1, Math.floor(level / 2));
            const newRemaining = Math.min(level, currentRemaining + regain);
            const updated: Character = {
              ...character,
              used_abilities: [],
              spell_slots_used: {},
              hit_points: character.max_hit_points ?? (level * ((() => {
                const classHitDie: Record<string, number> = { Bard: 8, Barbarian: 12, Fighter: 10, Paladin: 10, Ranger: 10, Cleric: 8, Druid: 8, Monk: 8, Rogue: 8, Warlock: 8, Sorcerer: 6, Wizard: 6 };
                const die = classHitDie[(character as any).class || character.class] ?? 8;
                return die;
              })())),
              hit_dice_remaining: newRemaining,
            } as Character;
            setCharacter(updated);
            await saveCharacter(updated);
            setPendingRest(null);
          }}
          onCancel={() => setPendingRest(null)}
        />
      )}

      {pendingRest === 'short' && character && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Short Rest</h3>
            <div className="space-y-4">
              <div className="text-sm text-gray-700 dark:text-gray-300">
                Spend Hit Dice to recover hit points. You may spend one die at a time and choose to spend more after each roll.
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded p-4">
                {(() => {
                  const level = character.level || 1;
                  const total = level;
                  const available = (character as any).hit_dice_remaining ?? total;
                  return (
                    <div className="text-sm text-gray-700 dark:text-gray-200">
                      <div><strong>Hit Dice Available:</strong> {available} / {total}</div>
                      <div className="mt-2"><strong>Con modifier:</strong> {getAbilityModifier(character.ability_scores.constitution) >= 0 ? `+${getAbilityModifier(character.ability_scores.constitution)}` : getAbilityModifier(character.ability_scores.constitution)}</div>
                      {shortRestInfo && shortRestInfo.lastRoll !== undefined && (
                        <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">Last roll: {shortRestInfo.lastRoll} + CON = {shortRestInfo.lastTotal} HP recovered</div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => {
                  setShortRestInfo(null);
                  setPendingRest(null);
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded hover:opacity-90"
              >
                Finish
              </button>
              <button
                onClick={async () => {
                  // Spend one hit die
                  const level = character.level || 1;
                  const total = level;
                  const available = (character as any).hit_dice_remaining ?? total;
                  if (available <= 0) return;
                  const classHitDie: Record<string, number> = { Bard: 8, Barbarian: 12, Fighter: 10, Paladin: 10, Ranger: 10, Cleric: 8, Druid: 8, Monk: 8, Rogue: 8, Warlock: 8, Sorcerer: 6, Wizard: 6 };
                  const die = classHitDie[(character as any).class || character.class] ?? 8;
                  const roll = Math.floor(Math.random() * die) + 1;
                  const conMod = getAbilityModifier(character.ability_scores.constitution);
                  const totalHeal = Math.max(0, roll + conMod);
                  const maxHp = character.max_hit_points ?? (level * 8);
                  const newHp = Math.min(maxHp, (character.hit_points || 0) + totalHeal);
                  const newAvailable = Math.max(0, available - 1);
                  const updated: Character = { ...character, hit_points: newHp, hit_dice_remaining: newAvailable } as Character;
                  setCharacter(updated);
                  setShortRestInfo({ available: newAvailable, lastRoll: roll, lastTotal: totalHeal });
                  await saveCharacter(updated);
                }}
                className="px-4 py-2 bg-primary text-white rounded hover:opacity-90"
                disabled={((character as any).hit_dice_remaining ?? character.level ?? 1) <= 0}
              >
                Spend 1 Hit Die
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Add Item modal */}
      {showAddItemModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add Item to Inventory</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Item Name *
                </label>
                <input
                  type="text"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="e.g., Longsword, Health Potion"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={newItem.description}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Item description, properties, or notes"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cost in Gold (optional)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newItem.cost}
                  onChange={(e) => setNewItem({ ...newItem, cost: e.target.value })}
                  className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="0"
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => {
                  setShowAddItemModal(false);
                  setNewItem({ name: '', description: '', cost: '' });
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded hover:opacity-90"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!character || !newItem.name.trim()) return;

                  const item = {
                    name: newItem.name.trim(),
                    ...(newItem.description.trim() && { description: newItem.description.trim() }),
                    ...(newItem.cost && { cost: parseFloat(newItem.cost) })
                  };

                  const updated: Character = {
                    ...character,
                    equipment: [...character.equipment, item]
                  };

                  setCharacter(updated);
                  await saveCharacter(updated);
                  setShowAddItemModal(false);
                  setNewItem({ name: '', description: '', cost: '' });
                }}
                disabled={!newItem.name.trim()}
                className="px-4 py-2 bg-primary text-white rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Item
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Level Up modal */}
      {showLevelUpModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Level Up</h3>
            <div className="space-y-4">
              <div className="text-sm text-gray-700 dark:text-gray-300">
                Level up from <span className="font-bold text-primary">Level {character.level}</span> to <span className="font-bold text-primary">Level {character.level + 1}</span>?
              </div>

              {/* Bard HP increase choice */}
              {character.class === 'Bard' && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded p-4 border border-blue-200 dark:border-blue-800">
                  <div className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-200">Hit Points Increase:</div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="hpChoice"
                        checked={levelUpHPChoice === 'average'}
                        onChange={() => {
                          setLevelUpHPChoice('average');
                          setLevelUpHPRoll(null);
                        }}
                      />
                      <span>Take average: 5 + CON modifier ({5 + getAbilityModifier(character.ability_scores.constitution)} HP)</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="hpChoice"
                        checked={levelUpHPChoice === 'roll'}
                        onChange={() => setLevelUpHPChoice('roll')}
                      />
                      <span>Roll 1d8 + CON modifier</span>
                    </label>
                    {levelUpHPChoice === 'roll' && (
                      <div className="ml-6 mt-2">
                        <button
                          onClick={() => {
                            const roll = Math.floor(Math.random() * 8) + 1;
                            setLevelUpHPRoll(roll);
                          }}
                          className="px-3 py-1 bg-primary text-white rounded text-sm hover:opacity-90"
                        >
                          Roll d8
                        </button>
                        {levelUpHPRoll !== null && (
                          <div className="mt-2 text-sm">
                            <span className="font-semibold">Rolled: {levelUpHPRoll}</span>
                            <span className="ml-2">+ CON modifier ({getAbilityModifier(character.ability_scores.constitution)}) = <span className="font-bold text-primary">{levelUpHPRoll + getAbilityModifier(character.ability_scores.constitution)} HP</span></span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-gray-50 dark:bg-gray-700 rounded p-4">
                <div className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-200">Changes:</div>
                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                  {(() => {
                    const currentProf = getProficiencyBonus(character.level);
                    const newProf = getProficiencyBonus(character.level + 1);

                    if (currentProf !== newProf) {
                      return (
                        <div className="flex items-center gap-2">
                          <span className="text-green-600 dark:text-green-400">✓</span>
                          <span>Proficiency Bonus: <span className="line-through text-gray-400">+{currentProf}</span> → <span className="font-semibold text-primary">+{newProf}</span></span>
                        </div>
                      );
                    }

                    return (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">•</span>
                        <span>Proficiency Bonus remains: +{currentProf}</span>
                      </div>
                    );
                  })()}

                  {/* Inform user they gain one additional hit die on level up */}
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">•</span>
                    <span>{(() => {
                      const cls = (character as any).class || character.class;
                      const classHitDie: Record<string, number> = {
                        Barbarian: 12,
                        Fighter: 10,
                        Paladin: 10,
                        Ranger: 10,
                        Bard: 8,
                        Cleric: 8,
                        Druid: 8,
                        Monk: 8,
                        Rogue: 8,
                        Warlock: 8,
                        Sorcerer: 6,
                        Wizard: 6,
                      };
                      const die = classHitDie[cls] ?? 8;
                      const count = character.level || 1;
                      return `Hit Dice: ${count}d${die} → ${count + 1}d${die} (you gain one additional hit die).`;
                    })()}</span>
                  </div>
                </div>
              </div>

              {character.class !== 'Bard' && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Note: You may need to manually update other aspects like hit points, new features, or spell slots based on your class.
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => {
                  setShowLevelUpModal(false);
                  setLevelUpHPChoice('average');
                  setLevelUpHPRoll(null);
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded hover:opacity-90"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!character) return;

                  // Calculate HP increase for Bard
                  let hpIncrease = 0;
                  if (character.class === 'Bard') {
                    if (levelUpHPChoice === 'average') {
                      hpIncrease = 5 + getAbilityModifier(character.ability_scores.constitution);
                    } else if (levelUpHPChoice === 'roll' && levelUpHPRoll !== null) {
                      hpIncrease = levelUpHPRoll + getAbilityModifier(character.ability_scores.constitution);
                    } else {
                      alert('Please roll the d8 or choose to take the average');
                      return;
                    }
                  }

                  const updated: Character = {
                    ...character,
                    level: character.level + 1,
                    ...(character.class === 'Bard' ? {
                      hit_points: character.hit_points + hpIncrease,
                      max_hit_points: (character.max_hit_points || character.hit_points) + hpIncrease
                    } : {})
                  };
                  setCharacter(updated);
                  await saveCharacter(updated);
                  setShowLevelUpModal(false);
                  setLevelUpHPChoice('average');
                  setLevelUpHPRoll(null);
                }}
                className="px-4 py-2 bg-primary text-white rounded hover:opacity-90"
              >
                Confirm Level Up
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Spell detail modal for character spells */}
      {selectedSpellDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">{selectedSpellName}</h3>
              <button onClick={() => { setSelectedSpellDetail(null); setSelectedSpellName(null); }} className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded">Close</button>
            </div>
            <div className="mb-3 grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-500">Level</div>
                <div className="font-medium">{selectedSpellDetail.level ?? '—'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">School</div>
                <div className="font-medium">{selectedSpellDetail.school?.name ?? selectedSpellDetail.school ?? '—'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Casting Time</div>
                <div className="font-medium">{selectedSpellDetail.casting_time ?? '—'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Range</div>
                <div className="font-medium">{selectedSpellDetail.range ?? '—'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Duration</div>
                <div className="font-medium">{selectedSpellDetail.duration ?? '-'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Components</div>
                <div className="font-medium">{Array.isArray(selectedSpellDetail.components) ? selectedSpellDetail.components.join(', ') : (selectedSpellDetail.components || '-')}</div>
              </div>
            </div>
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <h4 className="font-semibold mb-2">Description</h4>
                    <div className="text-gray-700 dark:text-gray-100 whitespace-pre-wrap">
                      {Array.isArray(selectedSpellDetail.desc) ? selectedSpellDetail.desc.join('\n\n') : (selectedSpellDetail.desc || '')}
                    </div>
              {selectedSpellDetail.higher_level && (
                <div className="mt-4">
                  <h5 className="font-semibold">At Higher Levels</h5>
                  <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{Array.isArray(selectedSpellDetail.higher_level) ? selectedSpellDetail.higher_level.join('\n\n') : selectedSpellDetail.higher_level}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Editable stat component for displaying and editing numeric values
 * Shows label with current value that can be clicked to edit
 */

