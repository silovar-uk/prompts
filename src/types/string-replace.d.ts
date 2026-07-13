export {};

declare global {
  interface String {
    /**
     * App.tsx chooses a literal replacement or callback at runtime. Keep that
     * union typed locally rather than disabling TypeScript checks project-wide.
     */
    replace(
      searchValue: string | RegExp,
      replacer: string | ((substring: string, ...args: any[]) => string)
    ): string;
  }
}
