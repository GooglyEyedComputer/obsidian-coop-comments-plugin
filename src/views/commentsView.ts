import { Editor, EditorRange, ItemView, Menu, TFile, WorkspaceLeaf, addIcon, setIcon } from "obsidian";
import $ from "jquery";
import { TSMap } from "typescript-map";

import { Comment, CommentProfile, CommentReply } from "../types"
import CommentsHandler from "src/commentsHandler";
import CommentPlugin from "src/main";
import { CommentModal } from "src/modals/commentModal";
import { ConfirmationModal } from "src/modals/confirmationModal";
import { CommentViewPlugin } from "src/view-plugins/commentViewPlugin";

export const COMMENTS_VIEW_TYPE = "example-view";

export class CommentsView extends ItemView {
  plugin: CommentPlugin;
  commentContainer: HTMLDivElement;
  currentEditor: Editor;
  constructor(leaf: WorkspaceLeaf, plugin: CommentPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() {
    return COMMENTS_VIEW_TYPE;
  }

  getDisplayText() {
    return "Comments";
  }

  async onOpen() {
    this.updateView();
  }

  public updateView(filePath: string = "", viewPlugin?: CommentViewPlugin, editor?: Editor) {

    let container = this.containerEl.children[1];
    container.empty();
    container.createEl("h3", { text: "Comments" });
    container.createEl("hr");


    this.commentContainer = container.createDiv({ cls: "comments-container" })
    let comments: TSMap<string, Comment> | undefined = this.plugin.commentsHandler.getComments(filePath);
    if (!comments) return;
    if (editor && !this.currentEditor) {
      this.currentEditor = editor}
    if (comments.values().length == 0 || !this.currentEditor || !viewPlugin)
      return;
    comments.forEach(comment => {
      let commenter = this.plugin.commentsHandler.getCommenterProfile(comment.commenterProfile)
      let newComment = this.renderComment(comment, commenter);
      // newComment.onClickEvent((ev) => )
      let replyContainer = newComment.getElementsByClassName("comment-reply-container")[0];
      comment.replies.forEach(reply => {
        let newReply = this.renderReply(reply, commenter);
        replyContainer?.append(newReply);
      }) 
      if (comment.replies.length != 0) {
        $(newComment).addClass("comment-element-with-replies")
        setIcon(newComment.createDiv({ cls: "reply-indicator-icon" }), "message-square")
      }
      newComment.oncontextmenu = (ev) => {
        this.renderContextMenu(ev, comment, filePath, this.currentEditor, viewPlugin)
        // if ($(newComment).find(".comment-element-replies").css("display") == "flex") return;
        // $(".comment-element-replies").slideUp(150)
        // $(newComment).find(".comment-element-replies").slideDown(150)
      }
      $(newComment).find(".comment-element-replies").slideUp(0)
      $(newComment).on("click", (ev, a?) => {
        this.focusComment(comment.id, ev.ctrlKey || a?.scroll ? viewPlugin : undefined, !a?.dontSelect ? true : false)
        if ($(newComment).hasClass("comment-element-focused")) return;
        $(".comment-element-focused").removeClass("comment-element-focused")
        $(".comment-element-replies").slideUp(150)
        $(newComment).find(".comment-element-replies").slideDown(150)
        $(newComment).addClass("comment-element-focused")

      })

      let submit = $(newComment).find(".reply-submit");
      submit.on("click", (a) => {
        let replyInputElement = (submit.siblings()[0] as HTMLInputElement);
        let replyText = replyInputElement.value;
        if (!replyText)
          return;


        let reply = this.plugin.commentsHandler.addCommentReply(filePath, comment.id, replyText);
        if (!reply)
          return;
        let newReply = this.renderReply(reply, commenter);
        replyContainer?.append(newReply);
        replyInputElement.value = "";
      })

      this.commentContainer.appendChild(newComment);
    });
  }

  renderContextMenu(event: MouseEvent, comment: Comment, filePath: string, editor: Editor, viewPlugin: CommentViewPlugin) {
    let menu = new Menu();
    menu.addItem((item) => {
      item.setTitle("Edit Comment").setIcon("pencil").onClick((evt) => {
        new CommentModal(this.app, (commentText) => {
          this.plugin.commentsHandler.editComment(filePath, comment.id, commentText);
          this.updateView(filePath, viewPlugin, editor);
          this.focusComment(comment.id, viewPlugin);

        }).open(comment.comment);
      })
    })
    menu.addItem((item) => {
      let title = "Resolve Comment"
      if (comment.resolved)
        title = "Unresolve Comment"

      item.setTitle(title).setIcon("check").onClick((evt) => {
        this.plugin.commentsHandler.resolveComment(filePath, comment.id, !comment.resolved)
        this.updateView(filePath, viewPlugin, editor);
        this.focusComment(comment.id, viewPlugin);
      })
    })
    menu.addItem((item) => {
      item.setTitle("Remove Comment").setIcon("trash").onClick((evt) => {
        new ConfirmationModal(this.app, () => {
          this.plugin.commentsHandler.removeComment(filePath, comment.id, (comment) => {
            var activeFile = this.app.workspace.getActiveFile();
            if (!activeFile)
              return;

            this.app.vault.cachedRead(activeFile).then((file) => {
              var reg = new RegExp("\\|" + comment.id + "\\|.*?\\|\\|", "sg").exec(file);

              if (!reg || !this.currentEditor)
                return;

              var range: EditorRange = { from: this.currentEditor.offsetToPos(reg.index), to: this.currentEditor.offsetToPos(reg.index + reg[0].length) }
              editor.replaceRange(comment.commentedText, range.from, range.to)
            })
          });
          this.updateView(filePath, viewPlugin, editor);

        }).open("remove the comment");
      })
    })
    menu.showAtMouseEvent(event);
  }

  renderComment(comment: Comment, commenter: CommentProfile): HTMLDivElement {
    let commentDate = new Date(comment.dateTime);
    // this.commentContainer.createDiv({ cls: "comment-element" })
    let newComment: HTMLDivElement = document.createElement("div");
    newComment.addClass("comment-element")
    newComment.setAttr("tabindex", 0)
    newComment.setAttr("data-id", comment.id);
    newComment.innerHTML =
      '<div class="comment-element-header">' +
      '<div class="comment-element-credentials">' +
      '<div><p class="comment-credentials-name">' + commenter.name + '</p><div class="comment-credentials-color" style="background-color:' + commenter.color + ';"></div></div>' +
      '<p>' + commentDate.toLocaleTimeString(this.plugin.settings.locale, { timeStyle: 'short' }) + ' ' + commentDate.toLocaleDateString(this.plugin.settings.locale, { dateStyle: "short" }) + '</p>' +
      '</div>' +
      '<p class="comment-element-commented">' + comment.commentedText + '</p>' +
      '</div>' +
      '<div class="comment-element-content"><p>' + comment.comment + '</p></div>' +
      '<div class="comment-element-replies">' +
      '<div class="comment-reply-container"><p>Replies:</p></div>' +
      '<div class="comment-reply-input">' +
      '<input type="text" class="reply-text" placeholder="Reply to comment">' +
      '<button class="reply-submit" >Reply</button>' +
      '</div>' +
      '</div>';
    return newComment; 
  }

  renderReply(reply: CommentReply, commenter: CommentProfile): HTMLElement {
    let replyDate = new Date(reply.dateTime);
    let newReply = document.createElement("div");
    newReply.addClass("comment-reply-element");
    newReply.innerHTML =
      '<div class="comment-reply-credentials">' +
      '<div class="reply-credentials-name"><p>' + commenter.name + '  </p></div>' +
      '<p>' + replyDate.toLocaleTimeString(this.plugin.settings.locale, { timeStyle: 'short' }) + ' ' + replyDate.toLocaleDateString(this.plugin.settings.locale, { dateStyle: "short" }) + '</p>' +
      '</div>' +
      '<div class="comment-reply-text"><p>' + reply.reply + '</p></div>';
    return newReply;
  }

  focusComment(id: number, viewPlugin?: CommentViewPlugin, select: boolean = false) {
    var activeFile = this.app.workspace.getActiveFile();
    if (!activeFile)
      return;

    this.app.vault.cachedRead(activeFile).then((file) => {
      var regex = new RegExp("\\|" + id + "\\|.*?\\|\\|", "sg");
      var reg = regex.exec(file);

      if (!reg)
        return;

      if (!viewPlugin) return;
      var range: EditorRange = { from: this.currentEditor.offsetToPos(reg.index), to: this.currentEditor.offsetToPos(reg.index + reg[0].length) }
      this.currentEditor.scrollIntoView(
        {
          from: range.from,
          to: range.to,
        },
        true
      );
      this.currentEditor.focus();
      viewPlugin?.scrollToRange(reg.index, id, select);
    })
  }
}