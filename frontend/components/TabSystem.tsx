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
    <div className="flex border-b border-border-subtle">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={clsx(
              'relative px-4 py-2.5 text-sm font-medium transition-colors duration-150 shrink-0',
              isActive
                ? 'text-text-primary'
                : 'text-text-secondary hover:text-text-primary'
            )}
          >
            {tab.label}
            {isActive && (
              <motion.div
                layoutId="tab-underline"
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ backgroundColor: 'var(--tile-correct)' }}
                transition={{ type: 'spring', damping: 28, stiffness: 350, mass: 0.8 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
