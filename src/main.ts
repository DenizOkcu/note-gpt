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
import { EventSource } from "extended-eventsource";

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
    // const statusBarItemEl = this.addStatusBarItem();
    // statusBarItemEl.setText("noteGPT");

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
              "Write me function in Ruby which can add all even numbers until a number which is given as parameter",
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
    };

    const eventSource = new EventSource(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      },
    );

    eventSource.onmessage = (event: MessageEvent) => {
      try {
        this.handleChunk(event.data);
      } catch (error) {
        eventSource.close();
      }
    };

    eventSource.onerror = (error) => {
      eventSource.close();
      console.error("Error occurred:", error);
    };
  }

  handleChunk(chunk) {
    if (chunk !== "[DONE]") {
      try {
        const parsedObject = JSON.parse(chunk);
        const text = parsedObject.choices[0].delta.content;
        if (text) {
          this.appendTextToActiveFile(text);
        }
      } catch (error) {
        console.error("Error parsing JSON:", error);
      }
    } else {
      this.appendTextToActiveFile("\n");
      const length = editor.lastLine();

      // move cursor to end of file https://davidwalsh.name/codemirror-set-focus-line
      const newCursor = {
        line: length + 1,
        ch: 0,
      };
      editor.setCursor(newCursor);
      throw new Error("Stream ended with [DONE]");
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
