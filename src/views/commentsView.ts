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

/**
 * A view for showing and interacting with comments and their replies.
 */
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

  /**
   * Updates the view with new comments.
   * @param filePath The path of the current file in the editor, if any.
   * @param viewPlugin The editor extension plugin, if any.
   * @param editor The current editor, if any.
   * @returns 
   */
  public updateView(filePath: string = "", viewPlugin?: CommentViewPlugin, editor?: Editor) {
    let container = this.containerEl.children[1];
    container.empty();
    container.createEl("h3", { text: "Comments" });
    container.createEl("hr");

    this.commentContainer = container.createDiv({ cls: "comments-container" });

    let comments: TSMap<string, Comment> | undefined = this.plugin.commentsHandler.getComments(filePath);
    if (!comments) return;

    if (editor && !this.currentEditor) this.currentEditor = editor;
    if (comments.values().length == 0 || !this.currentEditor || !viewPlugin) return;

    comments.forEach(comment => {
      let commenter = this.plugin.commentsHandler.getCommenterProfile(comment.commenterProfile);
      let newComment = this.renderComment(comment, commenter);
      let replyContainer = newComment.getElementsByClassName("comment-reply-container")[0];

      comment.replies.forEach(reply => {
        let newReply = this.renderReply(reply, commenter);
        replyContainer?.append(newReply);
      });

      if (comment.replies.length != 0) {
        $(newComment).addClass("comment-element-with-replies");
        setIcon(newComment.createDiv({ cls: "reply-indicator-icon" }), "message-square");
      }

      newComment.oncontextmenu = (ev) => {
        this.renderContextMenu(ev, comment, filePath, this.currentEditor, viewPlugin);
      }

      $(newComment).find(".comment-element-replies").slideUp(0);
      //On click, focus comment and slide down.
      $(newComment).on("click", (ev, a?) => {
        this.focusComment(comment.id, ev.ctrlKey || a?.scroll ? viewPlugin : undefined, !a?.dontSelect ? true : false);

        if ($(newComment).hasClass("comment-element-focused")) return;

        $(".comment-element-focused").removeClass("comment-element-focused");
        $(".comment-element-replies").slideUp(150);
        $(newComment).find(".comment-element-replies").slideDown(150);
        $(newComment).addClass("comment-element-focused");
      })

      let submit = $(newComment).find(".reply-submit");
      submit.on("click", () => {
        let replyInputElement = (submit.siblings()[0] as HTMLInputElement);

        let replyText = replyInputElement.value;
        if (!replyText) return;

        //Add reply.
        let reply = this.plugin.commentsHandler.addCommentReply(filePath, comment.id, replyText);
        if (!reply) return;

        let newReply = this.renderReply(reply, commenter);
        replyContainer?.append(newReply);
        replyInputElement.value = "";
      })

      this.commentContainer.appendChild(newComment);
    });
  }

  /**
   * Render the context menu for comments in the comment view.
   * @param event The mouse event that triggered the context menu.
   * @param comment The comment instance that was clicked.
   * @param filePath The path to the current file.
   * @param editor The current editor.
   * @param viewPlugin The current editors extension plugin for comments.
   */
  renderContextMenu(event: MouseEvent, comment: Comment, filePath: string, editor: Editor, viewPlugin: CommentViewPlugin) {
    let menu = new Menu();

    //Edit comment.
    menu.addItem((item) => {
      item.setTitle("Edit Comment").setIcon("pencil").onClick(() => {
        new CommentModal(this.app, (commentText) => {
          this.plugin.commentsHandler.editComment(filePath, comment.id, commentText);
          this.updateView(filePath, viewPlugin, editor);
          this.focusComment(comment.id, viewPlugin);
        }).open(comment.comment);
      });
    });

    //Resolve/unresolve comment.
    menu.addItem((item) => {
      let title = comment.resolved ? "Resolve Comment" : "Unresolve Comment";

      item.setTitle(title).setIcon("check").onClick(() => {
        this.plugin.commentsHandler.resolveComment(filePath, comment.id, !comment.resolved);
        this.updateView(filePath, viewPlugin, editor);
        this.focusComment(comment.id, viewPlugin);
      });
    });

    //Remove comment.
    menu.addItem((item) => {
      item.setTitle("Remove Comment").setIcon("trash").onClick(() => {
        new ConfirmationModal(this.app, () => {
          this.plugin.commentsHandler.removeComment(filePath, comment.id, (comment) => {
            var activeFile = this.app.workspace.getActiveFile();
            if (!activeFile) return;

            this.app.vault.cachedRead(activeFile).then((file) => {
              var reg = new RegExp("\\|" + comment.id + "\\|.*?\\|\\|", "sg").exec(file);
              if (!reg || !this.currentEditor) return;

              editor.replaceRange(comment.commentedText, this.currentEditor.offsetToPos(reg.index), this.currentEditor.offsetToPos(reg.index + reg[0].length));
            });
          });

          this.updateView(filePath, viewPlugin, editor);
        }).open("remove the comment");
      });
    });

    menu.showAtMouseEvent(event);
  }
  /**
   * Renders the comment component.
   * @param comment The comment to be rendered.
   * @param commenter The commenter for the comment.
   * @returns An HTMLDivElement with the newly created comment element.
   */
  renderComment(comment: Comment, commenter: CommentProfile): HTMLDivElement {
    let commentDate = new Date(comment.dateTime);
    let newComment: HTMLDivElement = document.createElement("div");

    newComment.addClass("comment-element");
    newComment.setAttr("tabindex", 0);
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

  /**
   * Renders a reply component.
   * @param reply The reply to render.
   * @param commenter The commenter profile of the reply.
   * @returns An HTMLElement with the reply element.
   */
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

  /**
   * Focuses/scrolls to a given comment in the editor
   * @param id The id of the comment to scroll to.
   * @param viewPlugin The editor extension to scroll.
   * @param select If the text of the focused comment should be selected or not.
   */
  focusComment(id: number, viewPlugin?: CommentViewPlugin, select: boolean = false) {
    if (!viewPlugin) return;

    var activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) return;

    this.app.vault.cachedRead(activeFile).then((file) => {
      var regex = new RegExp("\\|" + id + "\\|.*?\\|\\|", "sg");
      var reg = regex.exec(file);
      if (!reg) return;

      this.currentEditor.scrollIntoView(
        {
          from: this.currentEditor.offsetToPos(reg.index),
          to: this.currentEditor.offsetToPos(reg.index + reg[0].length),
        },
        true
      );
      this.currentEditor.focus();
      viewPlugin?.scrollToComment(reg.index, id, select);
    })
  }
}