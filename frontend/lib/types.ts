export type GameMode = 'daily' | 'competitive' | 'practice';
export type GameStatus = 'in_progress' | 'won' | 'lost' | 'abandoned';
export type Classification =
  | 'brilliant'
  | 'best'
  | 'good'
  | 'okay'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'
  | 'miss'
  | 'forced';
export type TileState = 'empty' | 'tbd' | 'correct' | 'present' | 'absent';

export interface User {
  id: string;
  email: string;
  username: string;
  elo_rating: number;
  games_played: number;
  is_placement: boolean;
  current_streak: number;
  max_streak: number;
  is_admin: boolean;
  created_at: string;
}

export interface Move {
  id: string;
  game_id: string;
  move_number: number;
  guess_word: string;
  pattern: number;
  remaining_words: number | null;
  entropy_before: number | null;
  entropy_after: number | null;
  info_gained: number | null;
  optimal_info: number | null;
  optimal_word: string | null;
  expected_remaining: number | null;
  efficiency_ratio: number | null;
  bits_lost: number | null;
  classification: Classification | null;
  constraint_violation: string | null;
  constraint_violation_reason: string;
  trap_detected: boolean;
  is_book_move: boolean;
}

export interface Game {
  id: string;
  user_id: string;
  mode: GameMode;
  target_word: string | null;
  word_difficulty: number | null;
  status: GameStatus;
  num_guesses: number;
  time_seconds: number | null;
  rated: boolean;
  accuracy_score: number | null;
  luck_factor: number | null;
  elo_before: number | null;
  elo_after: number | null;
  elo_delta: number | null;
  is_placement: boolean;
  moves: Move[];
  created_at: string;
  completed_at: string | null;
}

export interface TopPick {
  word: string;
  entropy: number;
  expected_remaining: number;
  probability?: number;
}

export interface PatternBucket {
  pattern: number;
  count: number;
  probability: number;
  is_actual?: boolean;
  words?: string[];
}

export interface MoveAnalysis extends Move {
  remaining_after: number;
  luck: number;
  remaining_words_list?: string[];
  top_picks: TopPick[];
  trap_info: {
    suffix: string;
    trapped_words: string[];
    trap_size: number;
  } | null;
  pattern_distribution?: PatternBucket[];
  optimal_pattern_distribution?: PatternBucket[];
  optimal_num_groups?: number;
  optimal_largest_group?: number;
  optimal_actual_solutions_after?: number;
  optimal_expected_steps_until_solution?: number;
  letter_frequencies?: Record<string, Record<string, number>>;
  // WordleBot-spec per-turn fields
  skill_score?: number;
  luck_score?: number;
  remaining_before?: number;
  expected_solutions_after?: number;
  actual_solutions_after?: number;
  expected_steps_until_solution?: number;
  optimal_expected_remaining?: number;
  bot_pick?: string;
  bot_pick_rationale?: string;
  scenario_count?: number;
  candidates_top_n?: TopPick[];
  tip_case?: string;
}

export interface DictionaryInfo {
  guesses: number;
  suggestions: number;
  solutions: number;
  legacy: number;
}

export interface AnalysisResult {
  accuracy_score: number;
  luck_factor: number;
  moves: MoveAnalysis[];
  constraint_violations: number;
  traps_encountered: number;
  // WordleBot-spec aggregate fields
  skill_avg?: number;
  skill_avg_excluding_opener?: number;
  luck_avg?: number;
  uniqueness_percentile?: number;
  bot_solve_path?: string[];
  failure_score?: number | null;
  standard_mode_starter?: string;
  hard_mode_starter?: string;
  dictionary_sizes?: DictionaryInfo;
}

export interface EloHistoryEntry {
  id?: string;
  elo_before: number;
  elo_after: number;
  delta: number;
  accuracy_score: number | null;
  recorded_at: string;
}

export const CLASSIFICATION_CONFIG: Record<
  Classification,
  { icon: string; label: string; color: string }
> = {
  brilliant: { icon: '!!', label: 'Brilliant', color: '#1565c0' },
  best: { icon: '★', label: 'Best', color: '#538d4e' },
  good: { icon: '✓', label: 'Good', color: '#6aaa64' },
  okay: { icon: '~', label: 'Okay', color: '#2e9688' },
  inaccuracy: { icon: '?!', label: 'Inaccuracy', color: '#b59f3b' },
  mistake: { icon: '?', label: 'Mistake', color: '#e67e22' },
  blunder: { icon: '✗', label: 'Blunder', color: '#e74c3c' },
  miss: { icon: '!!', label: 'Miss', color: '#9c27b0' },
  forced: { icon: '—', label: 'Forced', color: '#565758' },
};

export const RATING_TIERS = [
  { name: 'Novice', min: 0, max: 1199, color: '#818384' },
  { name: 'Veteran', min: 1200, max: 1399, color: '#b59f3b' },
  { name: 'Master', min: 1400, max: 1599, color: '#6aaa64' },
  { name: 'Grandmaster', min: 1600, max: 9999, color: '#1565c0' },
];

export function getRatingTier(elo: number) {
  return RATING_TIERS.find((t) => elo >= t.min && elo <= t.max) || RATING_TIERS[0];
}

export function patternToTiles(pattern: number): TileState[] {
  const tiles: TileState[] = [];
  let p = pattern;
  for (let i = 0; i < 5; i++) {
    const val = p % 3;
    tiles.push(val === 2 ? 'correct' : val === 1 ? 'present' : 'absent');
    p = Math.floor(p / 3);
  }
  return tiles;
}
