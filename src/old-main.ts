// import { Plugin, Notice, Command, Editor, MarkdownView, TAbstractFile, TFolder, TFile } from 'obsidian';
// import { CommentModal } from "./modals/commentModal"
// import { getuid } from 'process';

// export default class CommentPlugin extends Plugin {
// 	commentCommand: Command = this.addCommand({
// 		id: "comment-selected",
// 		name: "Comment Selected",
// 		icon: "languages",
// 		editorCallback: (editor: Editor, view: MarkdownView)=>{
// 			let commentNote = this.getCommentNote(view.file);
// 			if(!commentNote)
// 				return;
// 			let modalResult = new CommentModal(this.app, (commentText)=>{
// 				this.addComment(editor, view, commentText);
// 			}).open();
// 		}
// 	});

// 	async onload() {
// 		this.registerEvent(
// 			this.app.workspace.on("editor-menu", (menu) => {
// 				menu.addItem((item) => {
// 					item.setTitle(this.commentCommand.name.split(": ")[1])
// 					//.setIcon(commentCommand.icon)
// 					.onClick(() => {
// 						//@ts-ignore
// 						this.app.commands.executeCommandById(this.commentCommand.id);
// 					});
// 				});
// 			})
// 		);

// 	}

// 	onunload() {

// 	}

// 	addComment(editor: Editor, view: MarkdownView, commentText: string) : any{
// 		let comment = commentText;
// 		let commentStart = editor.getCursor("from");
// 		let commentEnd = editor.getCursor("to");
// 		let commentedText = editor.getSelection();
// 		let commentedDate = new Date;
// 		let commentedFile 
// 		let commentJSON = {commentStart, commentEnd, commentedDate, commentedText, comment, replies:{}};
// 		//let commentEntry = "# {"+commentStart+","+commentEnd+","+commentedDate+"} "+commentedText
// 		new Notice("WEEE " + JSON.stringify(commentJSON));
// 		console.log(commentJSON)
// 	}

// 	getCommentNote(focusedFile: TFile | null | undefined): TFile | null | undefined {
// 		let parentFolder = focusedFile?.parent; 
// 		let parentFolderPath = parentFolder?.path; 
// 		let focusedFileName = focusedFile?.name; 
// 		let commentNote = parentFolder?.children.find((x)=>x.name=="_Comments.md").find((x)=>x.name=="_Comments.md");
// 		if(!commentNote){
// 			this.app.vault.create(parentFolderPath+"_Comments/"+focusedFileName+".md", "").then((file)=>{
// 				//@ts-ignore
// 				this.app.commands.executeCommandById(this.commentCommand.id);
// 			});
// 			return null;
// 		}else{
// 			if(commentNote instanceof TFile){
// 				return commentNote;
// 			}
// 		}
// 	}
// }