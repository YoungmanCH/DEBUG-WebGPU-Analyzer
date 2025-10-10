export interface StatsImplements<T> {
  displayForConsole(metadata: T): string[];
  formatForUI(metadata: T): string;
}
