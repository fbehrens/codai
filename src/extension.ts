import * as vscode from 'vscode';
import * as Codai from './codai';
import OpenAI from 'openai';
import { parse, chatGpt, sleep, Message } from './lib/fbutil';
import { Config } from './codai';
const openai = new OpenAI({});
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
    const content = Codai.getQuestion(c);
    const mess = await parse(content, c);
    outputChannel.appendLine(Codai.messagesToString(mess));
    try {
      const messages = await Promise.all(
        mess.map((m) => {
          return chatGpt(m, c);
        })
      );
      const stream = await openai.chat.completions.create(
        {
          messages,
          model: c.model,
          stream: true,
        },
        {
          signal: abortController.signal,
        }
      );
      for await (const part of stream) {
        if (abortController.signal.aborted) {
          throw new vscode.CancellationError();
        }
        let d;
        if ((d = part.choices[0]?.delta)) {
          await c.out(d.content!);
        }
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
