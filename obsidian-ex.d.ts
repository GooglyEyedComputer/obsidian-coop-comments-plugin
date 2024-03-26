import 'obsidian'
import { EditorView } from '@codemirror/view';
import { EditorState, Extension } from '@codemirror/state';
declare module 'obsidian' {
    interface App {
        loadLocalStorage(key: string): string;
        saveLocalStorage(key: string, value: unknown): void;
        commands: Commands;
    }
    interface Commands {
        executeCommandById(commandId: string): boolean;
        executeCommand(command: Command): boolean;
    }
    interface Editor {
        cm: EditorViewI;
    }
    interface EditorViewI extends EditorView {
        cm?: CMView;
    }
    interface CMView extends EditorView {
        state: CMState;
    }
    interface CMState extends EditorState
}

