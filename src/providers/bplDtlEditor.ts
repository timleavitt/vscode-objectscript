/*
API definition:
Each message should have a "directions defined so that the webview knows where to send it (can this be removed with some port magic?)
value of "toEditor" or "toVSCode"

vscode to editor:
answer of a confirm
reload the page
are you vscode compatible?

editor to vscode:
alert or confirm message
reload the corresponding .cls file
*/

import * as vscode from "vscode";
import { AtelierAPI } from "../api";
import { currentFile } from "../utils/index";
import { DocumentContentProvider } from "./DocumentContentProvider";
import { loadChanges } from "../commands/compile";

export let currentBplDtlDocument: vscode.TextDocument = null;

export class BplDtlEditorProvider implements vscode.CustomTextEditorProvider {
  public static register(): vscode.Disposable {
    const provider = new BplDtlEditorProvider();
    const providerRegistration = vscode.window.registerCustomEditorProvider(BplDtlEditorProvider.viewType, provider);
    return providerRegistration;
  }

  public static readonly viewType = "vscode-objectscript.bplDtlEditor";

  private isDirty: boolean;

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    // get the url of the zen editor
    const url = await this.getUrl(document);
    if (!url) return;

    const type = document.fileName.substring(document.fileName.length - 3);
    const clsName = document.fileName.substring(1, document.fileName.length - 4) + ".cls";
    const clsUri = DocumentContentProvider.getUri(clsName);
    const clsFile = currentFile(await vscode.workspace.openTextDocument(clsUri));
    let pageCompatible = false;
    this.isDirty = document.isDirty;

    // Webview settings
    webviewPanel.webview.html = this.getHtmlForWebview(url);
    webviewPanel.webview.options = {
      enableScripts: true,
    };
    if (webviewPanel.active) {
      currentBplDtlDocument = document;
    }

    webviewPanel.onDidChangeViewState(async (event) => {
      console.log("on change view state");
      if (event.webviewPanel.active) {
        const title = event.webviewPanel.title.substring(1);
        const uri = DocumentContentProvider.getUri(title);
        currentBplDtlDocument = await vscode.workspace.openTextDocument(uri);
      }
    });

    // Setup webview to communicate with the iframe
    webviewPanel.webview.onDidReceiveMessage(async (message) => {
      if (message.confirm) {
        const answer = await vscode.window.showWarningMessage(message.confirm, { modal: true }, "OK");
        webviewPanel.webview.postMessage({ direction: "toEditor", answer: answer === "OK", usePort: true });
      } else if (message.alert) {
        await vscode.window.showWarningMessage(message.alert, { modal: true });
      } else if (message.modified !== undefined) {
        if (message.modified === true && !this.isDirty) {
          this.isDirty = true;
          this.dummyEdit(document);
        } else if (message.modified === false && this.isDirty) {
          this.isDirty = false;
          await vscode.commands.executeCommand("undo");
        }
      } else if (message.reload === 1) {
        loadChanges([clsFile]);
      } else if (message.vscodeCompatible === true) {
        pageCompatible = true;
      }
    });

    const saveDocumentSubscription = vscode.workspace.onDidSaveTextDocument((doc) => {
      // send a message to the iframe to reload the editor
      if (doc.uri.toString() === clsUri.toString()) {
        webviewPanel.webview.postMessage({ direction: "toEditor", reload: 1 });
      }
    });
    webviewPanel.onDidDispose(() => saveDocumentSubscription.dispose());

    // Display error if the page has not indicated that it is vscode compatible
    setTimeout(() => {
      if (!pageCompatible) {
        vscode.window.showErrorMessage(
          `This ${type.toUpperCase()} editor is not compatible with VSCode. See (TODO) to setup VSCode compatibility.`
        );
      }
    }, 3000);
  }

  private getHtmlForWebview(url: URL): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <style type="text/css">
          body, html {
            margin: 0; padding: 0; height: 100%; overflow: hidden;
            background-color: white;
          }
          #content {
            position:absolute; left: 0; right: 0; bottom: 0; top: 0px;
          }
        </style>
      </head>
      <body>
        <iframe src="${url.toString()}" id="editor" width="100%" height="100%" frameborder="0"></iframe>
        <script>
          (function() {
            const vscode = acquireVsCodeApi();

            // message passing, this code is in between vscode and the zen page, must pass to both
            var port;
            window.onmessage = (event) => {
              const data = event.data;
              const iframe = document.getElementById('editor').contentWindow;
              console.log(data);

              if (data.direction === "toEditor") {
                if (data.usePort === true) {
                  port.postMessage(event.data);
                  port = null;
                } else {
                  iframe.postMessage(data, '*');
                }
              }

              else if (data.direction === "toVSCode") {
                vscode.postMessage(data);
                if (data.usePort === true) {
                  console.log("using port");
                  port = event.ports[0];
                }
              }
            }
          }())
        </script>
      </body>
      </html>
      `;
  }

  private async getUrl(document: vscode.TextDocument): Promise<URL> {
    // the url should be the first line of the file
    const firstLine = document.getText(new vscode.Range(new vscode.Position(0, 0), new vscode.Position(1, 0)));
    const url = new URL(firstLine);
    const del = "/" + firstLine.split("/").slice(3).join("/");
    console.log(del);

    // add studio mode and a csptoken to the url
    const api = new AtelierAPI(document.uri);
    url.searchParams.set("STUDIO", "1");
    url.searchParams.set("CSPSHARE", "1");
    const response = await api.actionQuery("select %Atelier_v1_Utils.General_GetCSPToken(?) csptoken", [del]);
    const csptoken = response.result.content[0].csptoken;
    url.searchParams.set("CSPCHD", csptoken);

    console.log(url.toString());

    return url;
  }

  // Make an edit to indicate unsaved changes
  private async dummyEdit(document: vscode.TextDocument) {
    const range = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 1));

    const insertEdit = new vscode.WorkspaceEdit();
    insertEdit.insert(document.uri, range.start, " ");
    await vscode.workspace.applyEdit(insertEdit);
  }
}
