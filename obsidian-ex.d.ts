import 'obsidian'
declare module 'obsidian' {
    interface App {
        loadLocalStorage(key: string): string;
        saveLocalStorage(key: string, value: unknown): void;
    }
}