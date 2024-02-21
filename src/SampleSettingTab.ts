import { App, PluginSettingTab, Setting } from "obsidian";
import NoteGpt from "./main";

export class SampleSettingTab extends PluginSettingTab {
  plugin: NoteGpt;

  constructor(app: App, plugin: NoteGpt) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    new Setting(containerEl)
      .setName("noteGPT Settings")
      .setDesc("OpenAI API Key")
      .addText((text) =>
        text
          .setPlaceholder("Enter your API Key")
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value;
            await this.plugin.saveSettings();
          }),
      );
  }
}
