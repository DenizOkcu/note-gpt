import { Editor, MarkdownView, Modal, Notice, Plugin, TFile } from "obsidian";
import { EventSource } from "extended-eventsource";
import { SampleSettingTab } from "./SampleSettingTab";

interface NoteGptSettings {
  apiKey: string;
}

interface Message {
  role: string;
  content: string;
}

const DEFAULT_SETTINGS: NoteGptSettings = {
  apiKey: "default",
};

export default class NoteGpt extends Plugin {
  fileContent = "";
  settings: NoteGptSettings;
  messages: Message[];
  firstMessage: Boolean = true;

  async onload() {
    await this.loadSettings();

    // This adds a status bar item to the bottom of the app. Does not work on mobile apps.
    // const statusBarItemEl = this.addStatusBarItem();
    // statusBarItemEl.setText("noteGPT");

    this.addCommand({
      id: "call-gpt-completions",
      name: "Generate Text with GPT",
      callback: async (): Promise<void> => {
        this.messages = [
          {
            role: "system",
            content: "You are a helpful assistant",
          },
          {
            role: "user",
            content: "Write me a Haiku",
          },
        ];

        await this.callChatGPTStream(this.messages);
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

  async callChatGPTStream(messages: Message[]): Promise<void> {
    const apiKey: string = this.settings.apiKey;

    if (!apiKey) {
      console.log("No OpenAI API Key set");
      return;
    }

    const headers: Record<string, string> = {
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

    eventSource.onmessage = async (event: MessageEvent) => {
      try {
        await this.handleChunk(event.data);
        this.setCursorToEndOfFile();
      } catch (error) {
        eventSource.close();
      }
    };

    eventSource.onerror = async (error) => {
      await eventSource.close();
      console.error("Error occurred:", error);
    };
  }

  async handleChunk(chunk: string) {
    const assistantDelimitter: string = "## Assistant:\n\n";
    const userDelimitter: string = "\n\n<hr>\n\n## User:\n\n";

    if (chunk !== "[DONE]") {
      try {
        const parsedObject = JSON.parse(chunk);
        let text: string = parsedObject.choices[0].delta.content;

        if (text) {
          if (this.firstMessage) {
            text = assistantDelimitter + text;
            this.firstMessage = false;
          }

          await this.appendTextToActiveFile(text);
        }
      } catch (error) {
        console.error("Error parsing JSON:", error);
      }
    } else {
      await this.appendTextToActiveFile(userDelimitter);
      this.setCursorToEndOfFile();
      this.firstMessage = true;
      throw new Error("Stream ended with [DONE]");
    }
  }

  setCursorToEndOfFile(): void {
    // Get the total number of lines in the editor
    const editor: Editor | undefined = this.app.workspace.activeEditor?.editor;
    if (editor) {
      const totalLines = editor.lineCount();
      const lastLine = totalLines - 1;
      const lastLineLength = editor.getLine(lastLine).length;

      // Set the cursor position to the end of the file
      editor.setCursor({
        line: lastLine,
        ch: lastLineLength,
      });
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

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
