import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface DiceResult {
  id: string;
  expression: string;
  total: number;
  rolls: number[]; // Final rolls (kept values)
  allRolls: number[]; // All rolls including discarded
  timestamp: Date;
  diceType: string; // e.g., "2d6+3" or "1d20"
  rollType: 'normal' | 'advantage' | 'disadvantage';
}

/**
 * Dice roller page for rolling various dice expressions
 * Supports D&D dice notation with advantage/disadvantage
 * Roll history persists using localStorage
 */
export default function DiceRoller() {
  const [input, setInput] = useState('');
  const [currentRoll, setCurrentRoll] = useState<number[]>([]);
  const [isRolling, setIsRolling] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  
  // Load from localStorage helper
  const loadFromStorage = (): DiceResult[] => {
    try {
      const saved = localStorage.getItem('dice-roll-history');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map((r: any) => ({
          ...r,
          timestamp: new Date(r.timestamp),
          allRolls: r.allRolls || r.rolls, // Migrate old data
          rollType: r.rollType || 'normal', // Migrate old data
        }));
      }
    } catch (error) {
      console.error('Error loading from storage:', error);
    }
    return [];
  };
  
  const [results, setResults] = useState<DiceResult[]>(loadFromStorage());
  const [rollType, setRollType] = useState<'normal' | 'advantage' | 'disadvantage'>('normal');

  // Save to localStorage whenever results change (but skip during clearing)
  useEffect(() => {
    if (isClearing) {
      console.log('Skipping save during clear operation');
      return;
    }
    
    try {
      const dataToSave = JSON.stringify(results);
      localStorage.setItem('dice-roll-history', dataToSave);
      console.log('Saved to localStorage, count:', results.length);
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }, [results, isClearing]);

  /**
   * Parse dice expression (e.g., "2d6+3" or "1d20")
   * Returns object with number of dice, sides, and modifier
   */
  const parseDiceExpression = (expr: string) => {
    const match = expr.match(/(\d+)?d(\d+)([+-]?\d+)?/i);
    if (!match) return null;

    const [, count = '1', sides, modifier = '0'] = match;
    return {
      count: parseInt(count),
      sides: parseInt(sides),
      modifier: parseInt(modifier),
    };
  };

  /**
   * Roll dice based on the expression
   * Supports advantage (roll twice, take higher) and disadvantage (roll twice, take lower) for all dice
   */
  const rollDice = (expr: string): { rolls: number[]; allRolls: number[]; total: number; diceType: string } | null => {
    const parsed = parseDiceExpression(expr);
    if (!parsed) return null;

    let rolls: number[] = [];
    let allRolls: number[] = [];
    
    // For advantage/disadvantage on single dice rolls
    if (parsed.count === 1 && rollType !== 'normal') {
      // Roll twice for advantage/disadvantage
      const firstRoll = Math.floor(Math.random() * parsed.sides) + 1;
      const secondRoll = Math.floor(Math.random() * parsed.sides) + 1;
      allRolls = [firstRoll, secondRoll];
      
      if (rollType === 'advantage') {
        rolls = [Math.max(firstRoll, secondRoll)];
      } else { // disadvantage
        rolls = [Math.min(firstRoll, secondRoll)];
      }
    } else {
      // Normal rolling
      for (let i = 0; i < parsed.count; i++) {
        const roll = Math.floor(Math.random() * parsed.sides) + 1;
        rolls.push(roll);
        allRolls.push(roll);
      }
    }

    const total = rolls.reduce((a, b) => a + b, 0) + parsed.modifier;
    
    const diceType = `${parsed.count}d${parsed.sides}${parsed.modifier !== 0 ? (parsed.modifier > 0 ? '+' : '') + parsed.modifier : ''}`;
    
    return { rolls, allRolls, total, diceType };
  };

  /**
   * Handle rolling dice from input or quick roll button
   */
  const handleRoll = (expr?: string) => {
    const expression = expr || input.trim();
    if (!expression) return;

    const result = rollDice(expression);
    if (!result) {
      alert('Invalid dice expression. Use format like 1d20, 2d6+3, etc.');
      return;
    }

    setIsRolling(true);

    // Show kept rolls immediately
    setCurrentRoll(result.rolls);

    // If this was an advantage/disadvantage single-die roll, show both raw rolls
    if (result.allRolls && result.allRolls.length === 2 && rollType !== 'normal') {
      setCurrentRoll(result.allRolls);
    }

    // Add result to log after animation (extended time)
    setTimeout(() => {
      setResults([{
        id: crypto.randomUUID(),
        expression,
        total: result.total,
        rolls: result.rolls,
        allRolls: result.allRolls,
        timestamp: new Date(),
        diceType: result.diceType,
        rollType: rollType,
      }, ...results]);
      setIsRolling(false);
      setCurrentRoll([]);
    }, 1500); // Increased from 600ms to 1500ms for longer animation

    if (!expr) setInput('');
  };

  /**
   * Remove a roll from history
   */
  const handleRemoveRoll = (id: string) => {
    setResults(results.filter(r => r.id !== id));
  };

  /**
   * Clear all roll history
   * Removes all rolls from state and localStorage
   */
  const handleClearHistory = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    console.log('Clear All clicked, results length:', results.length);
    // Clear immediately (no confirm) to match expected quick-clear behavior
    // If you prefer a confirmation, re-enable window.confirm here.
    
    console.log('Starting clear process...');
    
    try {
      // Set clearing flag to prevent useEffect from interfering
      setIsClearing(true);
      console.log('Set isClearing to true');
      
      // Clear localStorage
      localStorage.removeItem('dice-roll-history');
      console.log('localStorage cleared');
      
      // Update state
      setResults([]);
      console.log('setResults called with empty array');
      
      // Reset clearing flag after a brief delay
      setTimeout(() => {
        setIsClearing(false);
        console.log('Reset isClearing flag');
      }, 100);
      
      console.log('Clear complete');
    } catch (error) {
      console.error('Error during clear:', error);
      setIsClearing(false);
    }
  };

  /**
   * Quick roll buttons for common dice
   */
  const quickRolls = [
    { label: 'd20', expr: '1d20' },
    { label: 'd12', expr: '1d12' },
    { label: 'd10', expr: '1d10' },
    { label: 'd8', expr: '1d8' },
    { label: 'd6', expr: '1d6' },
    { label: 'd4', expr: '1d4' },
  ];

  const getModifier = (expr: string) => {
    const parsed = parseDiceExpression(expr);
    return parsed?.modifier || 0;
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
        Dice Roller
      </h1>

      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 mb-6">
        <div className="flex gap-3 mb-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') handleRoll();
            }}
            placeholder="Enter dice expression (e.g., 2d6+3 or 1d20)"
            className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-lg"
          />
          <button
            onClick={() => handleRoll()}
            disabled={isRolling}
            className="px-6 py-3 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 font-medium"
          >
            Roll
          </button>
        </div>

        {/* Advantage/Disadvantage for single dice rolls */}
        <div className="mb-4 flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Roll Type:</span>
          <div className="flex gap-2">
            <button
              onClick={() => setRollType('normal')}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                rollType === 'normal'
                  ? 'bg-primary text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              Normal
            </button>
            <button
              onClick={() => setRollType('advantage')}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                rollType === 'advantage'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              Advantage
            </button>
            <button
              onClick={() => setRollType('disadvantage')}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                rollType === 'disadvantage'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              Disadvantage
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {quickRolls.map((roll) => (
            <button
              key={roll.label}
              onClick={() => handleRoll(roll.expr)}
              disabled={isRolling}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {roll.label}
            </button>
          ))}
        </div>
      </div>

      {/* Current Roll Display - stays visible longer */}
      {isRolling && currentRoll.length > 0 && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0 }}
          className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 mb-6"
        >
          <div className="flex items-center justify-center gap-4">
            <AnimatePresence>
              {currentRoll.map((roll, index) => {
                // For advantage/disadvantage, show which one is kept
                let isKept = true;
                const isAdvPair = currentRoll.length === 2 && rollType !== 'normal';
                if (isAdvPair) {
                  const [first, second] = currentRoll;
                  if (rollType === 'advantage') {
                    isKept = roll === Math.max(first, second);
                  } else if (rollType === 'disadvantage') {
                    isKept = roll === Math.min(first, second);
                  }
                }

                return (
                  <motion.div
                    key={index}
                    initial={{ rotate: 0, scale: 0 }}
                    animate={{ rotate: 360, scale: 1 }}
                    exit={{ rotate: 0, scale: 0 }}
                    transition={{ duration: 0.6 }}
                    className={`w-20 h-20 rounded-lg flex items-center justify-center text-3xl font-bold shadow-lg ${
                      isAdvPair
                        ? isKept
                          ? 'bg-primary text-white ring-4 ring-green-500'
                          : 'bg-gray-400 text-white opacity-50'
                        : 'bg-primary text-white'
                    }`}
                  >
                    {roll}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
          {rollType !== 'normal' && currentRoll.length === 2 && (
            <p className="text-center mt-2 text-sm text-gray-600 dark:text-gray-400">
              {rollType === 'advantage' ? 'Keep highest' : 'Keep lowest'}
            </p>
          )}
        </motion.div>
      )}

      {/* Roll History */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Roll History
          </h2>
          {results.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="text-sm px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Clear All
            </button>
          )}
        </div>
        {results.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No rolls yet</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {results.map((result) => {
              const modifier = getModifier(result.expression);
              return (
                <div
                  key={result.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    {/* Dice Type Label */}
                    <div className="text-xs font-semibold text-primary w-16">
                      {result.diceType}
                    </div>
                    
                    {/* Show both rolls for advantage/disadvantage */}
                    {result.rollType !== 'normal' && result.allRolls && result.allRolls.length === 2 ? (
                      <>
                        <div className="flex gap-1">
                          {result.allRolls.map((roll, i) => {
                            const keptValue = result.rolls[0];
                            const isKept = roll === keptValue;
                            return (
                              <span
                                key={i}
                                className={`w-8 h-8 rounded flex items-center justify-center font-bold ${
                                  isKept
                                    ? 'bg-primary text-white'
                                    : 'bg-gray-400 text-white opacity-50 line-through'
                                }`}
                              >
                                {roll}
                              </span>
                            );
                          })}
                        </div>
                        <span className="text-xs text-gray-500">
                          {result.rollType === 'advantage' ? '(✓ high)' : '(✓ low)'}
                        </span>
                      </>
                    ) : (
                      /* Individual Rolls for normal rolls */
                      <div className="flex gap-1">
                        {result.rolls.map((roll, i) => (
                          <span
                            key={i}
                            className="w-8 h-8 bg-primary text-white rounded flex items-center justify-center font-bold"
                          >
                            {roll}
                          </span>
                        ))}
                      </div>
                    )}
                    
                    {/* Modifier */}
                    {modifier !== 0 && (
                      <span className="text-gray-600 dark:text-gray-400">
                        {modifier > 0 ? '+' : ''}{modifier}
                      </span>
                    )}
                    
                    {/* Total */}
                    <div className="text-lg font-bold text-gray-900 dark:text-white ml-auto">
                      = {result.total}
                    </div>
                  </div>
                  
                  {/* Timestamp & Remove Button */}
                  <div className="flex items-center gap-3 ml-4">
                    <div className="text-xs text-gray-500 text-right">
                      {result.timestamp.toLocaleTimeString()}
                    </div>
                    <button
                      onClick={() => handleRemoveRoll(result.id)}
                      className="p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded transition-colors"
                      title="Remove this roll"
                    >
                      <X className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}