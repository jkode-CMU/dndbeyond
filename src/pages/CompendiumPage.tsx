import { useState, useEffect } from 'react';
import { fetchList, fetchItem, fetchEquipmentCategories, fetchEquipmentCategoryItems } from '../utils/srdApi';
import { BookOpen, Search, Heart, Star } from 'lucide-react';

type CompendiumCategory = 'spells' | 'monsters' | 'items' | 'feats';

interface CompendiumItem {
  name: string;
  type: string;
  level?: number;
  school?: string;
  duration?: string;
  classes?: string[];
  description: string;
  index?: string;
}

/**
 * Compendium page for browsing SRD (System Reference Document) content
 * Provides searchable interface for spells, monsters, items, and feats
 */
export default function CompendiumPage() {
  const [category, setCategory] = useState<CompendiumCategory>('spells');
  const [searchTerm, setSearchTerm] = useState('');
  const [items, setItems] = useState<CompendiumItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<CompendiumItem | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<any | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem('compendium-favorites');
    return saved ? JSON.parse(saved) : [];
  });
  const [loading, setLoading] = useState(false);
  const [showEquipment, setShowEquipment] = useState(true);
  const [showMagicItems, setShowMagicItems] = useState(true);
  const [equipmentCategories, setEquipmentCategories] = useState<Array<{index:string;name:string;url:string}>>([]);
  const [selectedEquipmentCategory, setSelectedEquipmentCategory] = useState<string>('all');
  // Spell filters
  const [selectedSpellClass, setSelectedSpellClass] = useState<string>('all');
  const [selectedSpellLevel, setSelectedSpellLevel] = useState<string>('all');
  const [selectedSpellSchool, setSelectedSpellSchool] = useState<string>('all');

  // Normalize various API list entry shapes into a stable { name, index, url } shape
  const normalizeEntry = (r: any) => {
    if (!r) return { name: '', index: '', url: '' };
    // if wrapped like { equipment: { index,name,url } }
    if (r.equipment && typeof r.equipment === 'object') r = r.equipment;
    if (r.item && typeof r.item === 'object') r = r.item;
    if (r.magic_item && typeof r.magic_item === 'object') r = r.magic_item;
    // sometimes name itself can be an object
    let name = r.name;
    if (name && typeof name === 'object') name = name.name || JSON.stringify(name);
    const index = r.index || (r.url || '').split('/').filter(Boolean).pop() || '';
    const url = r.url || '';
    return { name: name || '', index: index || '', url };
  };

  /**
   * Load items from bundled SRD data
   * Loads from local JSON files in the /data directory
   */
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      
      try {
        // use SRD API when available
        if (category === 'items') {
          // load categories for the equipment filter (one-time)
          try {
            const cats = await fetchEquipmentCategories();
            setEquipmentCategories(cats || []);
          } catch (e) {
            console.debug('Failed to load equipment categories', e);
            setEquipmentCategories([]);
          }

          const combined: any[] = [];

          // equipment list (either full list or by selected category)
          if (showEquipment) {
            try {
              let equipList: any[] = [];
              if (selectedEquipmentCategory && selectedEquipmentCategory !== 'all') {
                equipList = await fetchEquipmentCategoryItems(selectedEquipmentCategory as string);
              } else {
                equipList = await fetchList('equipment' as any);
              }
              equipList.forEach((r: any) => combined.push({ ...r, _source: 'equipment' }));
            } catch (e) {
              console.debug('Failed to load equipment list', e);
            }
          }

          // magic items list
          if (showMagicItems) {
            try {
              const magic = await fetchList('magic-items' as any);
              magic.forEach((r: any) => combined.push({ ...r, _source: 'magic-items' }));
            } catch (e) {
              console.debug('Failed to load magic items', e);
            }
          }

          // Map combined results to CompendiumItem
          const mapped = (combined || []).map((r: any) => {
            const n = normalizeEntry(r);
            return {
              name: n.name,
              type: r._source || (n.url && n.url.includes('/magic-items/') ? 'magic-items' : 'equipment'),
              description: n.url || '',
              index: n.index,
            } as CompendiumItem;
          });
          setItems(mapped as CompendiumItem[]);
        } else {
          const apiCategory = category as any;
          const list = await fetchList(apiCategory as any);
          // For spells, enrich list entries with duration, school, and classes
          if (apiCategory === 'spells') {
            const mapped = await Promise.all((list || []).map(async (r: any) => {
              const n = normalizeEntry(r);
              const idx = n.index;
              try {
                const details = await fetchItem('spells', idx);
                return {
                  name: n.name,
                  type: apiCategory,
                  description: n.url || '',
                  index: n.index,
                  duration: details.duration ?? null,
                  school: details.school?.name ?? null,
                  classes: Array.isArray(details.classes) ? details.classes.map((c: any) => c.name || String(c)) : [],
                  level: details.level,
                } as CompendiumItem;
              } catch (err) {
                console.debug('Failed to fetch spell details for', idx, err);
                return {
                  name: n.name,
                  type: apiCategory,
                  description: n.url || '',
                  index: n.index,
                } as CompendiumItem;
              }
            }));
            setItems(mapped as CompendiumItem[]);
          } else {
            const mapped = (list || []).map((r: any) => {
              const n = normalizeEntry(r);
              return {
                name: n.name,
                type: apiCategory,
                description: n.url || '',
                index: n.index,
              } as CompendiumItem;
            });
            setItems(mapped as CompendiumItem[]);
          }
        }
      } catch (error) {
        console.error('Failed to load compendium data:', error);
        // Fallback to placeholder data if load fails
        const placeholderData: CompendiumItem[] = Array.from({ length: 20 }, (_, i) => ({
          name: `Sample ${category.charAt(0).toUpperCase() + category.slice(1)} ${i + 1}`,
          type: category,
          level: category === 'spells' ? Math.floor(Math.random() * 9) : undefined,
          school: category === 'spells' ? ['Abjuration', 'Evocation', 'Transmutation'][Math.floor(Math.random() * 3)] : undefined,
          class: ['Wizard', 'Sorcerer', 'Warlock'][Math.floor(Math.random() * 3)],
          description: `This is a placeholder ${category} entry with detailed description and mechanics.`,
        }));
        setItems(placeholderData);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [category, showEquipment, showMagicItems, selectedEquipmentCategory]);


  /**
   * Toggle favorite status of an item
   */
  const toggleFavorite = (name: string) => {
    const newFavorites = favorites.includes(name)
      ? favorites.filter(f => f !== name)
      : [...favorites, name];

    setFavorites(newFavorites);
    localStorage.setItem('compendium-favorites', JSON.stringify(newFavorites));
  };

  const filteredItems = items.filter(item => {
    // Text search
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase());

    // Spell filters (only apply when viewing spells)
    if (category === 'spells') {
      const matchesClass = selectedSpellClass === 'all' ||
        (item.classes && item.classes.some(c => c.toLowerCase() === selectedSpellClass.toLowerCase()));
      const matchesLevel = selectedSpellLevel === 'all' ||
        item.level?.toString() === selectedSpellLevel;
      const matchesSchool = selectedSpellSchool === 'all' ||
        item.school?.toLowerCase() === selectedSpellSchool.toLowerCase();

      return matchesSearch && matchesClass && matchesLevel && matchesSchool;
    }

    return matchesSearch;
  });

  // fetch details for selected item

  useEffect(() => {
    if (!selectedItem) return;
    let cancelled = false;

    (async () => {
      try {
        setDetailsError(null);
        setDetailsLoading(true);
        setSelectedDetails(null);

        // Prefer an explicit index when available; fallback to URL parsing or slug
        const idx = selectedItem.index || (selectedItem.description || '').split('/').filter(Boolean).pop() || selectedItem.name.toLowerCase().replace(/\s+/g, '-');
        const apiCategory = selectedItem.type === 'items' ? 'equipment' : selectedItem.type;
        const details = await fetchItem(apiCategory as any, idx);
        if (cancelled) return;
        setSelectedDetails(details);
      } catch (err: any) {
        console.error('Failed to fetch item details', err);
        if (!cancelled) setDetailsError(err?.message || 'Failed to load details');
      } finally {
        if (!cancelled) setDetailsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [selectedItem]);

  // Return trimmed text from API values (array or string) or null when empty
  const safeText = (val: any): string | null => {
    if (val === null || val === undefined) return null;
    let s = '';
    if (Array.isArray(val)) s = val.join('\n\n');
    else s = String(val);
    s = s.replace(/\r/g, '').trim();
    return s.length > 0 ? s : null;
  };

  const spellDescText = selectedDetails ? safeText(selectedDetails.desc) : null;
  const spellHigherText = selectedDetails ? safeText(selectedDetails.higher_level) : null;
  const itemDescText = selectedDetails ? safeText(selectedDetails.desc) : null;
  const componentsText = selectedDetails ? (
    Array.isArray(selectedDetails.components)
      ? selectedDetails.components.map((c: any) => {
          if (typeof c === 'string') {
            // If it's 'M' and we have material info, append it
            if (c === 'M' && selectedDetails.material) {
              return `M (${selectedDetails.material})`;
            }
            return c;
          }
          return c?.name ?? JSON.stringify(c);
        }).join(', ')
      : (typeof selectedDetails.components === 'string' ? selectedDetails.components : (selectedDetails.components ? JSON.stringify(selectedDetails.components) : ''))
  ) : '';

  // Safe string representation of selected item name (used for display and favorites)
  const selectedItemNameStr = selectedItem ? (typeof selectedItem.name === 'string' ? selectedItem.name : JSON.stringify(selectedItem.name)) : '';

  const categories: { key: CompendiumCategory; label: string }[] = [
    { key: 'spells', label: 'Spells' },
    { key: 'monsters', label: 'Monsters' },
    { key: 'items', label: 'Items' },
    { key: 'feats', label: 'Feats' },
  ];

  return (
    <div className="flex h-full">
      {/* Left Panel - Item List */}
      <div className="w-1/3 border-r border-gray-300 dark:border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-300 dark:border-gray-700">
          <div className="flex items-center gap-4 mb-4">
            <BookOpen className="w-6 h-6 text-gray-900 dark:text-white" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Compendium
            </h1>
          </div>

          {/* Category Tabs */}
          <div className="flex gap-2 mb-4">
            {categories.map(cat => {
              const disabled = cat.key === 'items' || cat.key === 'feats';
              return (
                <button
                  key={cat.key}
                  onClick={() => { if (!disabled) setCategory(cat.key); }}
                  disabled={disabled}
                  title={disabled ? 'Temporarily disabled while we stabilize item/feat rendering' : undefined}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                    category === cat.key
                      ? 'bg-primary text-white'
                      : disabled
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`Search ${category}...`}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          {/* Spell-specific filters */}
          {category === 'spells' && (
            <div className="mt-3 space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Class</label>
                  <select
                    value={selectedSpellClass}
                    onChange={(e) => setSelectedSpellClass(e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="all">All Classes</option>
                    <option value="Bard">Bard</option>
                    <option value="Cleric">Cleric</option>
                    <option value="Druid">Druid</option>
                    <option value="Paladin">Paladin</option>
                    <option value="Ranger">Ranger</option>
                    <option value="Sorcerer">Sorcerer</option>
                    <option value="Warlock">Warlock</option>
                    <option value="Wizard">Wizard</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Level</label>
                  <select
                    value={selectedSpellLevel}
                    onChange={(e) => setSelectedSpellLevel(e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="all">All Levels</option>
                    <option value="0">Cantrip</option>
                    <option value="1">1st Level</option>
                    <option value="2">2nd Level</option>
                    <option value="3">3rd Level</option>
                    <option value="4">4th Level</option>
                    <option value="5">5th Level</option>
                    <option value="6">6th Level</option>
                    <option value="7">7th Level</option>
                    <option value="8">8th Level</option>
                    <option value="9">9th Level</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">School</label>
                  <select
                    value={selectedSpellSchool}
                    onChange={(e) => setSelectedSpellSchool(e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="all">All Schools</option>
                    <option value="Abjuration">Abjuration</option>
                    <option value="Conjuration">Conjuration</option>
                    <option value="Divination">Divination</option>
                    <option value="Enchantment">Enchantment</option>
                    <option value="Evocation">Evocation</option>
                    <option value="Illusion">Illusion</option>
                    <option value="Necromancy">Necromancy</option>
                    <option value="Transmutation">Transmutation</option>
                  </select>
                </div>
              </div>
            </div>
          )}
          {/* Items-specific filters */}
          {category === 'items' && (
            <div className="mt-3 flex items-center gap-2">
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={showEquipment} onChange={(e) => setShowEquipment(e.target.checked)} />
                Equipment
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={showMagicItems} onChange={(e) => setShowMagicItems(e.target.checked)} />
                Magic Items
              </label>
              <div className="ml-auto text-sm">
                <select value={selectedEquipmentCategory} onChange={(e) => setSelectedEquipmentCategory(e.target.value)} className="px-2 py-1 border rounded bg-white dark:bg-gray-700">
                  <option value="all">All categories</option>
                  {equipmentCategories.map((c) => (
                    <option key={c.index} value={c.index}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
          {/* Small banner notifying that Items/Feats are temporarily disabled */}
          <div className="mt-3">
            <div className="text-xs text-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-300 px-3 py-1 rounded">
              Note: Items and Feats tabs are temporarily disabled until rendering is fixed.
            </div>
          </div>
        </div>

        {/* Item List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredItems.map((item, index) => {
                // normalize items that may accidentally be raw API list results
                const normItem: CompendiumItem = (item as any).name && (item as any).index && (item as any).url
                  ? { name: (item as any).name, type: (item as any).type || category, description: (item as any).url || '', index: (item as any).index }
                  : (item as CompendiumItem);

                return (
                  <div
                    key={index}
                    onClick={() => {
                      console.debug('[Compendium] select item', normItem);
                      setSelectedItem(normItem);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyPress={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedItem(normItem); }}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      (selectedItem && (typeof selectedItem.name === 'string' ? selectedItem.name : JSON.stringify(selectedItem.name))) === normItem.name
                        ? 'bg-primary text-white'
                        : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{typeof normItem.name === 'string' ? normItem.name : JSON.stringify(normItem.name)}</span>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(normItem.name);
                        }}
                        onKeyPress={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); toggleFavorite(normItem.name); } }}
                        className={`p-1 rounded inline-block cursor-pointer ${
                          favorites.includes(normItem.name)
                            ? 'text-yellow-500'
                            : 'text-gray-400 hover:text-yellow-500'
                        }`}
                      >
                        <Star className="w-4 h-4 fill-current" />
                      </span>
                    </div>
                    {normItem.level !== undefined && (
                      <div className="text-xs opacity-75">
                        Level {normItem.level}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Item Details */}
      <div className="flex-1 overflow-y-auto p-6">
              {selectedItem ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                {selectedItemNameStr}
              </h2>
              <button
                onClick={() => toggleFavorite(selectedItemNameStr)}
                className={`p-2 rounded-lg transition-colors ${
                  favorites.includes(selectedItemNameStr)
                    ? 'text-yellow-500'
                    : 'text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <Heart className="w-6 h-6 fill-current" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Loading / Error states for details */}
              {detailsLoading && (
                <div className="text-gray-500">Loading details...</div>
              )}
              {detailsError && (
                <div className="text-red-500">{detailsError}</div>
              )}

              {/* Type-specific rendering using selectedDetails when available */}
              {selectedDetails && selectedItem.type === 'spells' && (
                <div>
                  <div className="flex gap-4 mb-2 flex-wrap">
                    <div>
                      <span className="font-semibold">Level:</span>{' '}
                      <span className="text-gray-700 dark:text-gray-300">{selectedDetails.level ?? '—'}</span>
                    </div>
                    <div>
                      <span className="font-semibold">School:</span>{' '}
                      <span className="text-gray-700 dark:text-gray-300">{selectedDetails.school?.name ?? selectedDetails.school ?? '—'}</span>
                    </div>
                    <div>
                      <span className="font-semibold">Casting Time:</span>{' '}
                      <span className="text-gray-700 dark:text-gray-300">{selectedDetails.casting_time ?? '—'}</span>
                    </div>
                    <div>
                      <span className="font-semibold">Range:</span>{' '}
                      <span className="text-gray-700 dark:text-gray-300">{selectedDetails.range ?? '—'}</span>
                    </div>
                    <div>
                      <span className="font-semibold">Duration:</span>{' '}
                      <span className="text-gray-700 dark:text-gray-300">{selectedDetails.duration ?? '—'}</span>
                    </div>
                    {selectedDetails.concentration && (
                      <div>
                        <span className="inline-block px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-sm font-medium">
                          Concentration
                        </span>
                      </div>
                    )}
                    {selectedDetails.ritual && (
                      <div>
                        <span className="inline-block px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded text-sm font-medium">
                          Ritual
                        </span>
                      </div>
                    )}
                    <div className="w-full">
                      <span className="font-semibold">Classes:</span>{' '}
                      <span className="text-gray-700 dark:text-gray-300">{Array.isArray(selectedDetails.classes) ? selectedDetails.classes.map((c: any) => c.name ?? String(c)).join(', ') : (selectedDetails.classes ? String(selectedDetails.classes) : '—')}</span>
                    </div>
                  </div>
                  <div className="mb-2">
                    <span className="font-semibold">Components:</span>{' '}
                    <span className="text-gray-700 dark:text-gray-300">{componentsText}</span>
                  </div>
                  <div className="border-t border-gray-300 dark:border-gray-700 pt-4">
                    <h3 className="font-semibold mb-2">Description</h3>
                    <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {spellDescText}
                    </div>
                    {spellHigherText && (
                      <div className="mt-2">
                        <h4 className="font-semibold">At Higher Levels</h4>
                        <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{spellHigherText}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedDetails && selectedItem.type === 'monsters' && (
                <div>
                  <div className="grid grid-cols-3 gap-4 mb-2">
                    <div>
                      <span className="font-semibold">Size:</span>{' '}
                      <span className="text-gray-700 dark:text-gray-300">{selectedDetails.size}</span>
                    </div>
                    <div>
                      <span className="font-semibold">Type:</span>{' '}
                      <span className="text-gray-700 dark:text-gray-300">{selectedDetails.type}</span>
                    </div>
                    <div>
                      <span className="font-semibold">Alignment:</span>{' '}
                      <span className="text-gray-700 dark:text-gray-300">{selectedDetails.alignment}</span>
                    </div>
                  </div>
                  <div className="mb-2">
                    <span className="font-semibold">HP:</span>{' '}
                    <span className="text-gray-700 dark:text-gray-300">{selectedDetails.hit_points} ({selectedDetails.hit_dice})</span>
                  </div>
                  <div className="mb-4">
                    <span className="font-semibold">Challenge Rating:</span>{' '}
                    <span className="text-gray-700 dark:text-gray-300">{selectedDetails.challenge_rating}</span>
                  </div>
                  {Array.isArray(selectedDetails.actions) && (
                    <div className="border-t border-gray-300 dark:border-gray-700 pt-4">
                      <h3 className="font-semibold mb-2">Actions</h3>
                      <div className="space-y-3">
                        {selectedDetails.actions.map((a: any, i: number) => (
                          <div key={i}>
                            <div className="font-semibold">{typeof a.name === 'string' ? a.name : JSON.stringify(a.name)}</div>
                            <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{safeText(a.desc) ?? (typeof a.desc === 'string' ? a.desc : JSON.stringify(a.desc))}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {selectedDetails && (selectedItem.type === 'items' || selectedItem.type === 'equipment') && (
                <div>
                  <div className="mb-2">
                    <span className="font-semibold">Category:</span>{' '}
                    <span className="text-gray-700 dark:text-gray-300">{selectedDetails.equipment_category || selectedDetails.category || '—'}</span>
                  </div>
                  <div className="mb-2">
                    <span className="font-semibold">Cost:</span>{' '}
                    <span className="text-gray-700 dark:text-gray-300">{selectedDetails.cost ? `${selectedDetails.cost.quantity} ${selectedDetails.cost.unit}` : '—'}</span>
                  </div>
                  <div className="mb-2">
                    <span className="font-semibold">Weight:</span>{' '}
                    <span className="text-gray-700 dark:text-gray-300">{selectedDetails.weight ?? '—'}</span>
                  </div>
                  {itemDescText && (
                    <div className="border-t border-gray-300 dark:border-gray-700 pt-4">
                      <h3 className="font-semibold mb-2">Description</h3>
                      <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{itemDescText}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Generic fallback description if no detailed rendering above */}
              {(!selectedDetails || (!['spells','monsters','items','equipment'].includes(selectedItem.type))) && (
                <div className="border-t border-gray-300 dark:border-gray-700 pt-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Description</h3>
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {typeof selectedItem.description === 'string' ? selectedItem.description : JSON.stringify(selectedItem.description)}
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            Select an item to view details
          </div>
        )}
      </div>
    </div>
  );
}
