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
        
        this.getGoCriticOutput(textDocument.fileName).then((warnings) => {
            let diagnostics: vscode.Diagnostic[] = [];
            warnings.forEach((item) => {
                let lineSnippet = textDocument.lineAt(item.line).text;
                let startCol = lineSnippet.length - lineSnippet.trimLeft().length;
                let endCol = lineSnippet.length;
                let [startPosition, endPosition] = [
                    new vscode.Position(item.line, startCol),
                    new vscode.Position(item.line, endCol)
                ];
                let range = new vscode.Range(startPosition, endPosition);
                let message = `${item.rule}: ${item.warning}`;
                let diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning);
                diagnostics.push(diagnostic);
            });
            this.diagnosticCollection.set(textDocument.uri, diagnostics);
        }).catch(err => {
            console.error(err);
        });
    }

    private getGoCriticOutput(filename: string): Promise<{line: number, col: number, rule: string, warning: string}[]> {
        let args =  ['check', filename];
        return new Promise((resolve, reject) => {
            cp.exec("gocritic " + args.join(" "), (err, _, stdErr) => {
                let decoded = stdErr;
                if (err !== null) {
                    if (err.message.startsWith("Command failed")) {
                        decoded = err.message.split("\n").slice(1).join("\n");
                    } else {
                        reject(err);
                    }
                }
                const warnings = decoded.split("\n").filter(x => x !== "").map(x => {
                    let colonSections = x.split(":");
                    let [line, col] = colonSections.slice(1, 3).map(i => Number.parseInt(i) - 1);
                    let rule = colonSections[3];
                    let warning = colonSections.slice(4).join(":");
                    return {
                        line,
                        col,
                        rule,
                        warning
                    };
                });
                resolve(warnings);
            });
        });
    }
}
