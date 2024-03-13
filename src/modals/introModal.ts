import { AbstractInputSuggest, App, ButtonComponent, ColorComponent, Modal, Notice, PopoverSuggest, Setting, TextAreaComponent, TextComponent } from "obsidian";
import CommentsHandler from "src/commentsHandler";
import { CommentsPluginSettings, DEFAULT_SETTINGS } from "src/main";
import { CommentProfile } from "src/types";

/**
 * A modal for setting the commenter profile, if the user is new.
 */
export class IntroModal extends Modal {
  id: string;
  name: string;
  color: string;
  idElement: Setting;
  idInput: TextComponent;
  nameElement: Setting;
  nameInput: TextComponent;
  colorElement: Setting;
  colorInput: ColorComponent;

  onSubmit: (result: CommentProfile) => void;
  constructor(app: App, onSubmit: (result: CommentProfile) => void) {
    super(app);
    this.onSubmit = onSubmit;
  }

  open(commentHandler?: CommentsHandler, currentName?: string | undefined): void {
    super.open();
    let { contentEl } = this;

    contentEl.createEl("h1", { text: "Describe your profile!" });
    contentEl.createEl("h3", { text: "These details will show up in the comments you make." });
    this.idElement = new Setting(contentEl)
      .setName("Profile Identifier")
      .setDesc("The unique name that identifies your specific profile. (Save it if you want to use the same profile from another pc.)")
      .addText((text) => {
        let ids = commentHandler?.getCommenterProfiles().map((val) => val.id);
        this.idInput = text
          .setPlaceholder("Stacy Memorablename")
          .setValue(currentName ? currentName : "")
          .onChange(async (value) => {
            let matching = ids?.includes(text.getValue());
            if (!matching) {
              this.colorInput.setValue("#000000");
              this.nameInput.setValue("");
              return;
            };
            let commenter = commentHandler?.getCommenterProfile(value);
            if (!commenter) return;
            this.colorInput.setValue(commenter?.color);
            this.nameInput.setValue(commenter?.name);
            this.nameInput.onChanged();
          });
          this.idInput.onChanged()
      });

    this.nameElement = new Setting(contentEl)
      .setName("Commenter Name")
      .setDesc("The name that is shown on your comments")
      .addText((text) => {
        this.nameInput = text
          .setPlaceholder("Stacy Fakename")
          .onChange(async (value) => {
            this.name = value;
          });
      });

    this.colorElement = new Setting(contentEl)
      .setName("Commenter Color")
      .setDesc("Color that is shown on your comments")
      .addColorPicker((picker) => {
        this.colorInput = picker
          .onChange(async (value) => {
            this.color = value;
          });
      });


    let submitButtonElement: ButtonComponent = new ButtonComponent(contentEl).setCta().setButtonText("Submit").onClick((val) => {
      this.id = this.idInput.getValue();
      if (this.id == "") return new Notice("You have to have a secret for comments to work!");
      this.color = this.colorInput.getValue();
      this.name = this.nameInput.getValue();
      this.close();
      this.onSubmit({ id: this.id, name: this.name, color: this.color });
    });

    contentEl.append(submitButtonElement.buttonEl);
  }
  close() {
    super.close()
  }
  onClose() {
    let { contentEl } = this;
    contentEl.empty();
  }
}