import * as vscode from 'vscode';
import { BundleSizeProvider } from './providers/BundleSizeProvider';
import { InlineDecorationsController } from './providers/InlineDecorationsController';
import { setOutputChannel, logToOutput } from './utils/logger';

export function activate(context: vscode.ExtensionContext) {
  console.log('Bundle Size Plus extension is now active!');

  const output = vscode.window.createOutputChannel('Bundle Size Plus');
  setOutputChannel(output);
  logToOutput('[Bundle Size Plus] Activated');
  context.subscriptions.push(output);

  // Initialize the bundle size provider
  const bundleSizeProvider = new BundleSizeProvider();

  // Inline decorations controller (green, no background)
  const decorationsController = new InlineDecorationsController(bundleSizeProvider);
  decorationsController.start();
  context.subscriptions.push(decorationsController);

  // Register commands
  const clearCacheCommand = vscode.commands.registerCommand(
    'bundleSizePlus.clearCache',
    () => {
      bundleSizeProvider.clearCache();
      vscode.window.showInformationMessage('Bundle size cache cleared!');
      decorationsController.refresh();
    }
  );

  const showOutputCommand = vscode.commands.registerCommand('bundleSizePlus.showOutput', () => {
    output.show(true);
  });

  const toggleInlayHintsCommand = vscode.commands.registerCommand(
    'bundleSizePlus.toggleInlayHints',
    async () => {
      const config = vscode.workspace.getConfiguration('bundleSizePlus');
      const currentValue = config.get('enableInlayHints', true);
      await config.update('enableInlayHints', !currentValue, true);
      vscode.window.showInformationMessage(
        `Inlay hints ${!currentValue ? 'enabled' : 'disabled'}`
      );
    }
  );

  context.subscriptions.push(clearCacheCommand, showOutputCommand, toggleInlayHintsCommand);

  console.log('Bundle Size Plus: All providers registered');
}

export function deactivate() {
  console.log('Bundle Size Plus extension is now deactivated');
}
