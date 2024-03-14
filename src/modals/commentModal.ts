import { App, ButtonComponent, Modal, TextAreaComponent } from "obsidian";

/**
 * Modal for writing a comment.
 */
export class CommentModal extends Modal {
  commentText: string;
  onSubmit: (result: string) => void;

  constructor(app: App, onSubmit: (result: string) => void) {
    super(app);
    this.onSubmit = onSubmit;
  }
  
  open(currentText?: string): void {
    super.open();
    let { contentEl } = this;
    
    let textAreaElement: TextAreaComponent = new TextAreaComponent(contentEl).onChange((val) => {
      this.commentText = val;
    });
    textAreaElement.setValue(currentText ? currentText : "");
    
    let submitButtonElement: ButtonComponent = new ButtonComponent(contentEl).setCta().setButtonText("Submit").onClick((val) => {
      this.close();
      this.onSubmit(this.commentText);
    });

    contentEl.addClass("comment-modal");
    contentEl.createEl("h1", { text: "Write your comment!" });
    contentEl.append(textAreaElement.inputEl);
    contentEl.append(submitButtonElement.buttonEl);

  }

  onClose() {
    let { contentEl } = this;
    contentEl.empty();
  }
}