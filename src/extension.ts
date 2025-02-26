import * as vscode from 'vscode';
import * as Codai from './codai';
import { parse } from './lib/fbutil';
import { streamText } from 'ai';
const outputChannel = vscode.window.createOutputChannel('Codai');
let abortController: AbortController | null = null;

export function activate(context: vscode.ExtensionContext) {
  const stopGeneratingButton = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left
  );
  stopGeneratingButton.text = 'Stop Generating';
  stopGeneratingButton.command = 'codai.stopGenerating';
  context.subscriptions.push(stopGeneratingButton);

  context.subscriptions.push(
    vscode.commands.registerCommand('codai.stopGenerating', () => {
      console.log({ abort: abortController });
      abortController?.abort();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codai.dalle', async () => {
      const c = Codai.getConfig({});
      await Codai.dalle(c);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codai.chat_completion', async () => {
      abortController = new AbortController();
      stopGeneratingButton.show();
      const c = Codai.getConfig({});
      const content = Codai.getQuestion(c);
      const messages = parse(content, c);
      outputChannel.appendLine(JSON.stringify(messages));
      const editor = vscode.window.activeTextEditor!;
      const output = async (output: string) => {
        await editor.edit((editBuilder) => {
          const position = editor.selection.end;
          editBuilder.insert(position, output);
        });
      };
      try {
        const result = streamText({
          messages,
          model: c.model,
        });
        if (c.languageId === 'markdown') {
          await output('assistant:\n');
        }
        for await (const delta of result.textStream) {
          if (abortController.signal.aborted) {
            throw new vscode.CancellationError();
          }
          await output(delta);
        }
      } catch (error) {
        if (error instanceof vscode.CancellationError) {
          console.log('Generation was stopped');
        } else {
          console.log(`An error occurred: ${error}`);
        }
      } finally {
        abortController = null;
        stopGeneratingButton.hide();
      }
    })
  );
}
