import {
  App,
  Editor,
  MarkdownView,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
} from "obsidian";

// Remember to rename these classes and interfaces!

interface NoteGptSettings {
  apiKey: string;
}

const DEFAULT_SETTINGS: NoteGptSettings = {
  apiKey: "default",
};

export default class NoteGpt extends Plugin {
  fileContent = "";
  settings: NoteGptSettings;

  async onload() {
    await this.loadSettings();

    // This adds a status bar item to the bottom of the app. Does not work on mobile apps.
    const statusBarItemEl = this.addStatusBarItem();
    statusBarItemEl.setText("noteGPT");

    this.addCommand({
      id: "call-gpt-completions",
      name: "Generate Text with GPT",
      callback: async () => {
        const messages = [
          {
            role: "system",
            content: "You are a helpful assistant",
          },
          {
            role: "user",
            content:
              "Write me a function which can return all even numbers from an array",
          },
        ];

        await this.callChatGPTStream(messages);
      },
    });

    // This adds a settings tab so the user can configure various aspects of the plugin
    this.addSettingTab(new SampleSettingTab(this.app, this));

    // When registering intervals, this function will automatically clear the interval when the plugin is disabled.
    this.registerInterval(
      window.setInterval(() => console.log("setInterval"), 5 * 60 * 1000),
    );
  }

  onunload() {}

  async callChatGPTStream(messages) {
    const apiKey = this.settings.apiKey;
    if (!apiKey) {
      console.log("No OpenAI API Key set");
      return;
    }

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };

    const data = {
      model: "gpt-4-turbo-preview",
      messages: messages,
      stream: true,
      response_format: { type: "text" },
    };

    try {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers,
          body: JSON.stringify(data),
        },
      );

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer = decoder.decode(value);

        if (buffer) {
          try {
            const jsonData = buffer;

            this.handleChunk(jsonData);
          } catch (_) {}
        }
      }
    } catch (error) {
      console.error("Error in GPT Chat Streaming:", error);
    }
  }

  handleChunk(chunk) {
    const lines = chunk.replace(/data:\s*/g, "").split("\n");

    for (const line of lines) {
      if (line.trim()) {
        // Ensure the line is not empty
        try {
          const parsedObject = JSON.parse(line);
          // Do something with the parsed object
          console.log(parsedObject.choices[0].delta.content);
          this.appendTextToActiveFile(parsedObject.choices[0].delta.content);
        } catch (error) {
          console.error("Error parsing JSON line:", line);
        }
      }
    }
  }

  async appendTextToActiveFile(text: string) {
    const activeFile = await this.app.workspace.getActiveFile();

    if (!activeFile) {
      new Notice("No active file");
      return;
    }

    if (this.fileContent == "") {
      this.fileContent = await this.app.vault.read(activeFile);
    }

    this.fileContent += text;

    await this.app.vault.modify(activeFile, this.fileContent);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class SampleSettingTab extends PluginSettingTab {
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
