import { App, ButtonComponent, Modal, Setting, TextAreaComponent } from "obsidian";

export class ConfirmationModal extends Modal {
  
  onYes: () => void;
  constructor(app: App, onYes:()=>void) {
    super(app);
    this.onYes = onYes;
  }
  open(action?: string) {
    super.open()
    let { contentEl } = this;

    let yesButtonElement: ButtonComponent = new ButtonComponent(contentEl).setCta().setButtonText("Yes").setWarning().onClick((val)=>{
      this.onYes();
      this.close();
    });
    let noButtonElement: ButtonComponent = new ButtonComponent(contentEl).setButtonText("No").onClick((val)=>{
      this.close();
    });

    contentEl.addClass("confirmation-modal");
    contentEl.createEl("h1", { text: "Are you sure you wish to " + action + "?" });
    let buttons = contentEl.createDiv({cls:"confirmation-modal-buttons"})
    buttons.append(yesButtonElement.buttonEl);
    buttons.append(noButtonElement.buttonEl);
  }

  onClose() {
    let { contentEl } = this;
    contentEl.empty();
  }
}