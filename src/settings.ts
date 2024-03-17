import CommentPlugin from "./main";
import { App, Notice, PluginSettingTab, Setting, SliderComponent, TextComponent } from "obsidian";
import $ from "jquery";

export class CommentsSettingTab extends PluginSettingTab {
    plugin: CommentPlugin;

    constructor(app: App, plugin: CommentPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        let { containerEl } = this;

        containerEl.empty();

        let uniqueName = this.app.loadLocalStorage("CommentPlugin:comment-profile-name");

        let secretText: TextComponent;
        new Setting(containerEl)
            .setName("Secret Name")
            .setDesc("The unique name that identifies your specific profile")
            .addText((text) =>
                secretText = text
                    .setPlaceholder("Stacy Fakename")
                    .setValue(uniqueName))
            .addButton((button) =>
                button.setButtonText("Overwrite")
                    .onClick(async () => {
                        let val = secretText.getValue();
                        if (val == "") {
                            secretText.setValue(uniqueName);
                            return new Notice("You have to have a secret for comments to work!")
                        };

                        let profile = this.plugin.commentsHandler.hasCommenterProfile(val) ? this.plugin.commentsHandler.getCommenterProfile(val) : undefined;
                        if (profile && profile.id != uniqueName) {
                            secretText.setValue(uniqueName);
                            return new Notice("Profile already exists!");
                        };

                        this.app.saveLocalStorage("CommentPlugin:comment-profile-name", val);
                        this.plugin.commentsHandler.editCommenterProfile(this.plugin.settings.commenter.id, val);
                        this.plugin.settings.commenter.id = val;
                        await this.plugin.saveSettings();
                        this.plugin.updateViews(false, true);
                    }));

        new Setting(containerEl)
            .setName("Commenter Name")
            .setDesc("The name that is shown on your comments")
            .addText((text) =>
                text
                    .setPlaceholder("Stacy Fakename")
                    .setValue(this.plugin.settings.commenter.name)
                    .onChange(async (value) => {
                        this.plugin.settings.commenter.name = value;
                        await this.plugin.saveSettings();
                        this.plugin.commentsHandler.editCommenterProfile(this.plugin.settings.commenter.id);
                        this.plugin.updateViews(false, true);
                    }));

        new Setting(containerEl)
            .setName("Commenter Color")
            .setDesc("Color that is shown on your comments")
            .addColorPicker((picker) =>
                picker
                    .setValue(this.plugin.settings.commenter.color)
                    .onChange(async (value) => {
                        this.plugin.settings.commenter.color = value;
                        await this.plugin.saveSettings();
                        this.plugin.commentsHandler.editCommenterProfile(this.plugin.settings.commenter.id);
                        this.plugin.updateViews(false, true);
                    }));

        containerEl.createEl("h3", { text: "Client settings" })
        new Setting(containerEl)
            .setName("Date format")
            .setDesc("Default date format")
            .addText((text) =>
                text
                    .setPlaceholder("MMMM dd, yyyy")
                    .setValue(this.plugin.settings.locale)
                    .onChange(async (value) => {
                        this.plugin.settings.locale = value;
                        await this.plugin.saveSettings();
                        this.plugin.updateViews(false, true);
                    }));

        let focusedText: TextComponent;
        let focusedSlider: SliderComponent;
        new Setting(containerEl)
            .setName("Focused Opacity")
            .setDesc("The opacity of the focused comment markings")
            .addText((text) => {
                focusedText = text;
                $(text.inputEl).wrap("<div class='percentage-input'></div>").parent().append("<span>%</span>");
                text.inputEl.type = "number";
                text.inputEl.min = "0";
                text.inputEl.max = "100";
                text.setValue("" + Math.round(this.plugin.settings.focusedOpacity * 100))
                    .onChange((val) => focusedSlider.setValue(parseFloat(val) / 100));
            })
            .addSlider((slider) =>
                focusedSlider = slider.setLimits(0, 1, 0.01)
                    .setValue(this.plugin.settings.focusedOpacity)
                    .onChange((val) => {
                        this.plugin.settings.focusedOpacity = val;
                        focusedText.setValue("" + Math.round(val * 100));
                        this.plugin.saveSettings();
                        this.plugin.updateViews(false, true);
                    }));

        let unfocusedText: TextComponent;
        let unfocusedSlider: SliderComponent;
        new Setting(containerEl)
            .setName("Unfocused Opacity")
            .setDesc("The opacity of the unfocused comment markings")
            .addText((text) => {
                unfocusedText = text;
                $(text.inputEl).wrap("<div class='percentage-input'></div>").parent().append("<span>%</span>");
                text.inputEl.type = "number";
                text.inputEl.min = "0";
                text.inputEl.max = "100";
                text.setValue("" + Math.round(this.plugin.settings.unfocusedOpacity * 100))
                    .onChange((val) => unfocusedSlider.setValue(parseFloat(val) / 100));
            })
            .addSlider((slider) =>
                unfocusedSlider = slider.setLimits(0, 1, 0.01)
                    .setValue(this.plugin.settings.unfocusedOpacity)
                    .onChange((val) => {
                        this.plugin.settings.unfocusedOpacity = val;
                        unfocusedText.setValue("" + Math.round(val * 100));
                        this.plugin.saveSettings();
                        this.plugin.updateViews(false, true);
                    }));
    }
}