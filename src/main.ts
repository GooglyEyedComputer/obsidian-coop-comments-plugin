import { Plugin, Notice, Command, Editor, MarkdownView, WorkspaceLeaf } from 'obsidian';
import { EditorView } from "@codemirror/view";
import $ from "jquery";
import { Prec } from '@codemirror/state';

import { CommentModal } from "./modals/commentModal"
import { CommentsView, COMMENTS_VIEW_TYPE } from "./views/commentsView";
import CommentsHandler from './commentsHandler';
import { CommentsSettingTab } from "./settings";
import { CommentViewPlugin, commentViewPlugin } from './view-plugins/commentViewPlugin';
import { CommentProfile, Comment } from './types';
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
			if (!view.file) return undefined;

			let shouldComment = true;
			this.viewPlugin.decorations.between(editor.posToOffset(editor.getCursor("from")), editor.posToOffset(editor.getCursor("to")), (a, b, c): false | void => shouldComment = false);
			
			//Is comment selection valid?
			if (shouldComment && editor.getSelection() != "") {
				let filePath = view.file.path;
				new CommentModal(this.app, (commentText) => {
					this.commentsHandler.addComment(filePath, editor.getSelection(), commentText, (comment) => editor.replaceSelection("|" + (comment.id) + "|" + editor.getSelection() + "||"));
					this.updateViews(true);
				}).open();
			} else {
				if (!shouldComment) new Notice("You cant overlap comments!")
				if (editor.getSelection() == "") new Notice("You have to select a range to comment!")
			}
		}
	});

	commentsView: CommentsView;
	commentsHandler: CommentsHandler;
	settings: CommentsPluginSettings;
	viewPlugin: CommentViewPlugin;

	async onload() {
		await this.loadSettings();
		this.commentsHandler = new CommentsHandler(this);
		await this.commentsHandler.readJSON();

		this.addSettingTab(new CommentsSettingTab(this.app, this));

		this.registerEditorExtension([Prec.lowest(commentViewPlugin)]);
		
		let profileId = this.app.loadLocalStorage("CommentPlugin:comment-profile-name");
		if (!profileId || !this.commentsHandler.getCommenterProfile(profileId)) {
			//Intro popup if user is new.
			new IntroModal(this.app, (val) => {
				this.app.saveLocalStorage("CommentPlugin:comment-profile-name", val.id);
				this.settings.commenter = val;
				this.commentsHandler.addCommenterProfile(val);
				this.saveSettings();
				this.updateViews(true, true);
			}).open(this.commentsHandler, profileId);
		}

		//Register right click event for commenting.
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

		//Register view for comments.
		this.registerView(COMMENTS_VIEW_TYPE, (leaf) => (this.commentsView = new CommentsView(leaf, this)));
		
		//Register ribbon button to activate view.
		this.addRibbonIcon("message-square", "Activate view", () => {
			this.toggleView();
		});

		//Update comment view and comment plugin view on "resize" (apparently the most reliable event to do this rn).
		this.registerEvent(this.app.workspace.on("resize", () => {
			this.updateViews(true);
		})) 
		this.updateViews(true);
	}
	
	/**
	 * Updates both the comments view AND the cm extension view (commentPluginView)
	 * @param reFocus If focus should be triggered on .cm-content before updating. (to make sure that the right editor is in workspace.currentEditor)
	 * @param force If the cm extension should dump current decorations and rebuild from scratch
	 */
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
			plugin.setComments(comments);
			if (this.commentsView) {
				this.commentsView.updateView(path, plugin, editor);
				plugin.setCommentsView(this.commentsView);
			}
			plugin.triggerUpdate(force)
		}
	}

	/**
	 * Activates or detaches comments view
	 */
	async toggleView() {
		let { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		let leaves = workspace.getLeavesOfType(COMMENTS_VIEW_TYPE);

		if (leaves.length > 0) {
			leaf = leaves[0];
			leaf.detach();
		} else {
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
	}
}