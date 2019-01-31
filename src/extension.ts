// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

const messagesFileTemplate = `import { defineMessages } from 'react-intl';

const messages = defineMessages({
});

export default messages;
`;

async function extractMessage(editor: vscode.TextEditor) {
	const text = editor.document.getText(editor.selection);

	if (!text) {
		return;
	}

	// The code you place here will be executed every time your command is executed
	let localeFile = vscode.workspace.getConfiguration().get('reactIntlMessageExtractor.localeFile') as string;

	if (!localeFile) {
		const selectedLocaleFile = await vscode.window.showOpenDialog({
			canSelectFiles: true,
			canSelectFolders: false,
			canSelectMany: false,
			filters: { 'JSON': ['json'] },
		});

		if (!selectedLocaleFile) {
			return;
		}

		await vscode.workspace.getConfiguration().update('reactIntlMessageExtractor.localeFile', selectedLocaleFile[0].path, vscode.ConfigurationTarget.Workspace);
		localeFile = vscode.workspace.getConfiguration().get('reactIntlMessageExtractor.localeFile') as string;
	}

	// Display a message box to the user
	const variableName = await vscode.window.showInputBox({
		placeHolder: 'The variable name, for messages.variableName',
		validateInput: (value) => {
			return !!value ? null : 'Required!';
		},
	});

	if (!variableName) {
		return;
	}

	const messageId = await vscode.window.showInputBox({
		placeHolder: 'The message id, like component.foo.bar',
		validateInput: (value) => {
			return !!value ? null : 'Required!';
		},
	});

	if (!messageId) {
		return;
	}

	const fileName = editor.document.fileName;
	const componentDir = path.dirname(fileName);
	const componentName = path.basename(componentDir);
	const messagesPath = path.join(componentDir, `${componentName}.messages.ts`);

	if (!fs.existsSync(messagesPath)) {
		fs.writeFileSync(messagesPath, messagesFileTemplate);
	}

	// Add to messages file
	const messagesDocument = await vscode.workspace.openTextDocument(messagesPath);
	const messagesContent = messagesDocument.getText().split('\n');

	// if the last line is an empty line, increase offset
	const bottomLinesOffset = messagesContent[messagesContent.length - 1] === '' ? 4 : 3;

	// only add empty line if there's already messages in the file
	if (messagesContent.length > 7) {
		messagesContent.splice(messagesContent.length - bottomLinesOffset, 0, '');
	}

	messagesContent.splice(messagesContent.length - bottomLinesOffset, 0, `	${variableName}: {`);
	messagesContent.splice(messagesContent.length - bottomLinesOffset, 0, `		id: '${messageId}',`);
	messagesContent.splice(messagesContent.length - bottomLinesOffset, 0, `		defaultMessage: '${messageId}',`);
	messagesContent.splice(messagesContent.length - bottomLinesOffset, 0, '	},');
	
	// Add to JSON file
	const localeJsonDocument = await vscode.workspace.openTextDocument(localeFile);
	const localeJson = JSON.parse(localeJsonDocument.getText());
	localeJson[messageId] = text;

	// Write to files
	const messagesRange = new vscode.Range(
		0, 
		messagesDocument.lineAt(0).range.start.character, 
		messagesDocument.lineCount - 1, 
		messagesDocument.lineAt(messagesDocument.lineCount - 1).range.end.character
	);

	const localeJsonRange = new vscode.Range(
		0, 
		localeJsonDocument.lineAt(0).range.start.character, 
		localeJsonDocument.lineCount - 1, 
		localeJsonDocument.lineAt(localeJsonDocument.lineCount - 1).range.end.character
	);

	const workspaceEdit = new vscode.WorkspaceEdit();
	workspaceEdit.replace(messagesDocument.uri, messagesRange, messagesContent.join('\n'));
	workspaceEdit.replace(localeJsonDocument.uri, localeJsonRange, JSON.stringify(localeJson, null, 4));

	await vscode.workspace.applyEdit(workspaceEdit);

	return variableName;
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
		console.log('Congratulations, your extension "react-intl-message-extractor" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const commandExtractMessage = vscode.commands.registerCommand('reactIntlMessageExtractor.extractMessage', async () => {
		const editor = vscode.window.activeTextEditor;

		if (!editor) {
			return;
		}

		const variableName = await extractMessage(editor);

		if (!variableName) {
			return;
		}

		await editor.edit(editBuilder => {
			editBuilder.replace(editor.selection, `{messages.${variableName}}`);
		});

		// Reset selection to the end of the messages variable so it could be easily imported or changed
		editor.selection = new vscode.Selection(editor.selection.start.translate(0, 9), editor.selection.start.translate(0, 9));

		vscode.window.showInformationMessage('Message extracted.');
	});

	const commandExtractFormattedMessage = vscode.commands.registerCommand('reactIntlMessageExtractor.extractFormattedMessage', async () => {
		const editor = vscode.window.activeTextEditor;

		if (!editor) {
			return;
		}

		const variableName = await extractMessage(editor);

		if (!variableName) {
			return;
		}

		await editor.edit(editBuilder => {
			editBuilder.replace(editor.selection, `<FormattedMessage {...messages.${variableName}} />`);
		});

		// Reset selection to the end of the messages variable so it could be easily imported or changed
		editor.selection = new vscode.Selection(editor.selection.start.translate(0, 30), editor.selection.start.translate(0, 30));

		vscode.window.showInformationMessage('FormattedMessage extracted.');
	});

	context.subscriptions.push(commandExtractMessage);
	context.subscriptions.push(commandExtractFormattedMessage);
}

// this method is called when your extension is deactivated
export function deactivate() {}
