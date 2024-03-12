import { Plugin, Notice, Command, Editor, MarkdownView, TAbstractFile, TFolder, TFile, EditorPosition, RGB, WorkspaceLeaf, FileView, Vault } from 'obsidian';
import { EditorView } from "@codemirror/view";
import $ from "jquery";
import {type EditorState, type Extension, Prec} from '@codemirror/state';

import { CommentModal } from "./modals/commentModal"
import { CommentsView, COMMENTS_VIEW_TYPE } from "./views/commentsView";
// var _comments = require("../../../../_comments.json");
import CommentsHandler from './commentsHandler';
import { CommentsSettingTab } from "./settings";
import { CommentViewPlugin, commentViewPlugin } from './view-plugins/commentViewPlugin';
import { CommentProfile } from './types';
import { IntroModal } from './modals/introModal';


export interface CommentsPluginSettings {
	locale: string;
	commenter: CommentProfile;
	unfocusedOpacity: number;
	focusedOpacity: number;
}
export const DEFAULT_SETTINGS: Partial<CommentsPluginSettings> = {
	locale: "en-US",
	commenter: { id: "UNSET", name: "Stacy Fakename", color: "#FF0000" },
	unfocusedOpacity: 0.75,
	focusedOpacity: 1,
};

export default class CommentPlugin extends Plugin {
	commentCommand: Command = this.addCommand({
		id: "comment-selected",
		name: "Comment Selected",
		icon: "message-square",
		editorCallback: (editor: Editor, view: MarkdownView) => {
			if (!view.file)
				return undefined;
			let filePath = view.file.path;
			let shouldComment = true;
			this.viewPlugin.decorations.between(editor.posToOffset(editor.getCursor("from")), editor.posToOffset(editor.getCursor("to")), (a, b, c): false | void => {
				shouldComment = false;
				return false
			})
			if (shouldComment && editor.getSelection() != "") {
				new CommentModal(this.app, (commentText) => {
					this.commentsHandler.addComment(filePath, editor.getSelection(), commentText, (comment) => editor.replaceSelection("|" + (comment.id) + "|" + editor.getSelection() + "||"))
					// this.commentsView.updateView(filePath, this.viewPlugin, editor);
					this.updateViews(true)
				}).open();
			} else {
				if (!shouldComment) new Notice("You cant overlap comments!")
				if (editor.getSelection() == "") new Notice("You have to select a range to comment!")
			}
		}
	});

	commentsView: CommentsView;
	commentsHandler: CommentsHandler = new CommentsHandler((this.app.vault.adapter as any).basePath, this);
	settings: CommentsPluginSettings;
	viewPlugin: CommentViewPlugin;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new CommentsSettingTab(this.app, this));

		this.registerEditorExtension([Prec.lowest(commentViewPlugin)]);
		this.app.workspace.updateOptions()
		let profileId = this.app.loadLocalStorage("CommentPlugin:comment-profile-name");
		if (!profileId || !this.commentsHandler.getCommenterProfile(profileId)) {
			new IntroModal(this.app, (val) => {
				this.app.saveLocalStorage("CommentPlugin:comment-profile-name", val.id)
				this.settings.commenter = val;
				this.commentsHandler.addCommenterProfile(val);
				this.saveSettings()
				let ed = this.app.workspace.activeEditor?.editor;
				if (!ed) return;
				// this.commentsView.updateView(this.commentsHandler.commentsPath, this.viewPlugin, ed)
				this.updateViews(true, true);
			}).open(this.commentsHandler);
		}
		//Register right click event for comment.
		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu) => {
				menu.addItem((item) => {
					item.setTitle(this.commentCommand.name.split(": ")[1])
						.setIcon(this.commentCommand.icon ? this.commentCommand.icon : null)
						.onClick(() => {

							//@ts-ignore
							this.app.commands.executeCommandById(this.commentCommand.id);
						});
				});
			})
		);
		// this.registerInterval(window.setInterval(()=>this.updateViews(), 100))
		//Register view for comments.
		this.registerView(COMMENTS_VIEW_TYPE, (leaf) => (this.commentsView = new CommentsView(leaf, this)));
		//Register ribbon button to activate view.
		this.addRibbonIcon("message-square", "Activate view", () => {
			this.activateView();
		});

		this.registerEvent(this.app.workspace.on("resize", () => {
			this.updateViews(true)
		})) 
		// this.registerEvent(this.app.workspace.on("file-open", (a) => {
		// 	this.updateViews(true)
		// }))
		// this.registerEvent(this.app.workspace.on("active-leaf-change", (leaf) => {
		// 	if (!(leaf?.view instanceof FileView) || !leaf.view.file)
		// 		return;

		// 	this.updateViews(true)
		// }))
		this.updateViews(true)
	}

	updateViews(reFocus: boolean = true, force?: true) {
		if(reFocus) $(".cm-content").trigger("focus")
		let path = this.app.workspace.getActiveFile()?.path;
		let editor = this.app.workspace.activeEditor?.editor;
		if (!path || !editor)
			return;
		// @ts-expect-error, not typed
		const editorView = editor.cm as EditorView;

		const plugin = editorView.plugin(commentViewPlugin);
		if (plugin) {
			this.viewPlugin = plugin;
			let comments = this.commentsHandler.getComments(path);

			plugin.setCommentsHandler(this.commentsHandler)
			if (comments)
				plugin.setComments(comments);
			if (this.commentsView) {
				this.commentsView.updateView(path, plugin, editor);
				plugin.setCommentsView(this.commentsView);
			}
			plugin.triggerUpdate(force);
		}
	}

	onunload() {

	}

	addComment(editor: Editor, view: MarkdownView, commentText: string): any {

	}

	async activateView() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(COMMENTS_VIEW_TYPE);

		if (leaves.length > 0) {
			// A leaf with our view already exists, use that
			leaf = leaves[0];
			leaf.detach();
		} else {
			// Our view could not be found in the workspace, create a new leaf
			// in the right sidebar for it
			leaf = workspace.getRightLeaf(false);
			await leaf.setViewState({ type: COMMENTS_VIEW_TYPE, active: true });
			workspace.revealLeaf(leaf);
		}

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		// this.commentsView.updateView(this.commentsHandler.commentsPath, this.viewPlugin)
	}
}