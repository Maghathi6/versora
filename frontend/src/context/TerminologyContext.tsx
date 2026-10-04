import React, { createContext, useContext, useState, ReactNode } from 'react';
import { TerminologyMode, TerminologyKey, getTerm } from '../utils/terminology';

interface TerminologyContextValue {
  mode: TerminologyMode;
  setMode: (mode: TerminologyMode) => void;
  toggleMode: () => void;
  t: (key: TerminologyKey) => string;
}

const STORAGE_KEY = 'versora_terminology_mode';

const TerminologyContext = createContext<TerminologyContextValue | undefined>(undefined);

export const TerminologyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<TerminologyMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'beginner' || saved === 'advanced') {
        return saved;
      }
    } catch {
      // LocalStorage access may fail in restricted contexts; fallback gracefully
    }
    return 'beginner';
  });

  const setMode = (newMode: TerminologyMode) => {
    setModeState(newMode);
    try {
      localStorage.setItem(STORAGE_KEY, newMode);
    } catch {
      // Ignore storage write errors
    }
  };

  const toggleMode = () => {
    setMode(mode === 'beginner' ? 'advanced' : 'beginner');
  };

  const t = (key: TerminologyKey): string => {
    return getTerm(key, mode);
  };

  return (
    <TerminologyContext.Provider value={{ mode, setMode, toggleMode, t }}>
      {children}
    </TerminologyContext.Provider>
  );
};

export function useTerminology(): TerminologyContextValue {
  const context = useContext(TerminologyContext);
  if (!context) {
    throw new Error('useTerminology must be used within a TerminologyProvider');
  }
  return context;
}
