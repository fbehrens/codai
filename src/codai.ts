import * as vscode from 'vscode';
import * as Fbutil from './lib/fbutil';
import * as path from 'path';
import { ImageModel, LanguageModel } from 'ai';
import { experimental_generateImage as generateImage } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';

export interface Config {
  model: LanguageModel;
  imageModel?: ImageModel;
  imageSize?: `${number}x${number}`;
  detail: Fbutil.Detail;
  dir: string;
  languageId: string;
  languageSystemPrompts?: Record<string, string>;
}

export function getConfig({
  file = vscode.window.activeTextEditor?.document.uri.path,
  languageId = vscode.window.activeTextEditor?.document.languageId,
} = {}): Config {
  if (!file || !languageId) {
    throw new Error('Active text editor is required');
  }

  const config = vscode.workspace.getConfiguration('codai');
  const model = config.get<string>('model');
  const detail = config.get<Fbutil.Detail>('detail') || 'low';
  const imageSize = config.get<`${number}x${number}`>('imageSize');
  const languageSystemPrompts =
    config.get<Record<string, string>>('languageSystemPrompts') || {};

  return {
    model:
      model === 'gpt-4o'
        ? openai('gpt-4o')
        : anthropic('claude-3-7-sonnet-20250219'),
    imageModel: openai.image('dall-e-3'),
    imageSize,
    detail,
    languageSystemPrompts,
    dir: path.dirname(file),
    languageId,
  };
}

export function getQuestion(c: Config): string {
  const e = vscode.window.activeTextEditor!;
  const d = e.document!;
  const s = e.selection;
  if (s.isEmpty && c.languageId === 'markdown') {
    const pos = s.active;
    const textBeforeCursor = new vscode.Range(0, 0, pos.line, pos.character);
    return d.getText(textBeforeCursor);
  } else if (!s.isEmpty) {
    if (c.languageId in c.languageSystemPrompts!) {
      const result = `system:${c.languageSystemPrompts![c.languageId]}
        user:${d.getText(s)}`;
      e.edit((editBuilder) => {
        e.selections.forEach((selection) => {
          editBuilder.delete(selection);
        });
      });
      return result;
    }
  }
  return '';
}

export async function dalle(c: Config): Promise<void> {
  const editor = vscode.window.activeTextEditor!;
  const position = editor.selection.active;
  const line = editor.document.lineAt(position.line);
  const prompt: string = line.text;
  const base64: string = await doDalle(prompt, c);
  const newPosition = position.with(position.line, Number.MAX_VALUE);
  editor.edit((editBuilder) => {
    editBuilder.insert(
      newPosition,
      `\n![${prompt}](data:image/png;base64,${base64})`
    );
  });
}

export async function doDalle(prompt: string, c: Config): Promise<string> {
  const generateParams = {
    model: c.imageModel!,
    prompt,
    size: c.imageSize,
  };
  console.log({ generateParams });
  const { image } = await generateImage(generateParams);
  console.log({ image });
  return image.base64;
}
