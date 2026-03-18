'use client';
import { motion } from 'framer-motion';
import clsx from 'clsx';

interface Tab {
  id: string;
  label: string;
}

interface TabSystemProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
}

export default function TabSystem({ tabs, activeTab, onChange }: TabSystemProps) {
  return (
    <div className="flex gap-1 p-1 rounded-lg bg-bg-tertiary">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={clsx(
            'relative flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150 z-10',
            activeTab === tab.id
              ? 'text-text-primary'
              : 'text-text-secondary hover:text-text-primary'
          )}
        >
          {activeTab === tab.id && (
            <motion.div
              layoutId="tab-pill"
              className="absolute inset-0 rounded-md bg-bg-elevated"
              style={{ zIndex: -1 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300, mass: 1 }}
            />
          )}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
