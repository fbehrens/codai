import * as vscode from 'vscode';
import * as Codai from './codai';
import { parse, chatGpt, sleep } from './lib/fbutil';
import { Config } from './codai';
import { streamText } from 'ai';
const outputChannel = vscode.window.createOutputChannel('Codai');
let abortController: AbortController | null = null;

async function doDalle(prompt: string): Promise<string> {
  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt,
    n: 1,
    size: '1024x1024',
  });
  return response.data[0].url as string;
}

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
      await Codai.dalle(doDalle);
    })
  );

  async function completion() {
    abortController = new AbortController();
    stopGeneratingButton.show();
    const c = Codai.getConfig({});
    console.log(c.model.modelId);
    const content = Codai.getQuestion(c);
    const messages = await parse(content, c);
    outputChannel.appendLine(Codai.messagesToString(messages));
    try {
      //   const messages = await Promise.all(
      //     mess.map((m) => {
      //       return chatGpt(m, c);
      //     })
      //   );
      const result = streamText({
        messages,
        model: c.model,
      });
      for await (const delta of result.textStream) {
        if (abortController.signal.aborted) {
          throw new vscode.CancellationError();
        }
        await c.out(delta);
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
  }
  context.subscriptions.push(
    vscode.commands.registerCommand('codai.openai_completion', async () => {
      await completion();
    })
  );
}
