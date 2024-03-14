import 'obsidian'
import { DataAdapter } from 'obsidian';
declare module 'obsidian' {
    interface App {
        loadLocalStorage(key: string): string;
        saveLocalStorage(key: string, value: unknown): void;
    }
}