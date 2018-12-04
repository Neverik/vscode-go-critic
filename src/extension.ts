'use strict';
import * as vscode from 'vscode';
import * as cp from 'child_process';

export function activate(context: vscode.ExtensionContext) {
    let critic = new GoCritic();	
	critic.activate(context.subscriptions);
}

export function deactivate() {
}

class GoCritic {
	diagnosticCollection: vscode.DiagnosticCollection = vscode.languages.createDiagnosticCollection();

	activate(subscriptions: vscode.Disposable[]) {

		vscode.workspace.onDidOpenTextDocument(this.doLint, this, subscriptions);
		vscode.workspace.onDidCloseTextDocument((textDocument)=> {
			this.diagnosticCollection.delete(textDocument.uri);
		}, null, subscriptions);

		vscode.workspace.onDidSaveTextDocument(this.doLint, this);
		vscode.workspace.textDocuments.forEach(this.doLint, this);
	}

	dispose(): void {
		this.diagnosticCollection.clear();
		this.diagnosticCollection.dispose();
	}

    doLint(textDocument: vscode.TextDocument) {
        if (textDocument.languageId !== 'go') {
            return;
        }

        let args =  ['check-package', '--json', textDocument.fileName];

        cp.exec("gocritic " + args.join(" "), (_, __, decoded) => {
            let diagnostics: vscode.Diagnostic[] = [];
            const warnings = decoded.split("}").filter(x => x.includes("{")).map(x => JSON.parse(x + "}"));
            warnings.forEach((item: {location: string, rule: string, warning: string}) => {
                let [line, col] = item.location.split(":").splice(1).map((x: string) => Number.parseInt(x));
                col = col - 1;
                line = line - 1;
                const startPosition = new vscode.Position(line, col);
                const txt = textDocument.getText(
                    new vscode.Range(
                        startPosition,
                        new vscode.Position(line + 1, col)));
                const offset = txt.split(" ").length;
                let range = new vscode.Range(startPosition, new vscode.Position(line, col + offset));
                let message = `${item.rule}: ${item.warning}`;
                let diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning);
                diagnostics.push(diagnostic);
            });
            this.diagnosticCollection.set(textDocument.uri, diagnostics);
        });
    }
}
