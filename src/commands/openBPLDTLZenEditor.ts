import * as vscode from "vscode";
import { config } from "../extension";
import { AtelierAPI } from "../api";
import { currentFile } from "../utils";
import { ClassDefinition } from "../utils/classDefinition";

export async function openBPLDTLZenEditor(): Promise<void> {
  try {
    // Get the editor type, either DTL or BPL
    const file = currentFile();
    if (file.uri.scheme === "file" && !config("conn").active) {
      return;
    }
    if (!file || !file.name.toLowerCase().endsWith(".cls")) {
      return;
    }
    const classDefinition = new ClassDefinition(file.name);
    const superClass = await classDefinition.super();
    let editor: string;
    let urlParamName: string;
    if (superClass.includes("Ens.DataTransformDTL")) {
      editor = "EnsPortal.DTLEditor.zen";
      urlParamName = "DT";
    } else if (superClass.includes("Ens.BusinessProcessBPL")) {
      editor = "EnsPortal.BPLEditor.zen";
      urlParamName = "BP";
    } else {
      return;
    }

    // Open the editor in a webview
    const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;
    const panel = vscode.window.createWebviewPanel(
      "bpldtleditor",
      urlParamName === "BP" ? "BPL Editor" : "DTL Editor",
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
      }
    );
    panel.webview.onDidReceiveMessage((message) => {
      console.log(message);
    });
    // try to override alert and confirm and do a custom version
    // also what coes enable scripts do and does that break anything
    const api = new AtelierAPI(file.uri);
    //const api = new AtelierAPI();
    const apps = await api.getCSPApps(true);
    const webapp = apps.result.content.filter((app) => app.default)[0].name;
    const url = new URL(
      `${api.config.https ? "https" : "http"}://${api.config.host}:${api.config.port}${webapp}/${editor}`
    );
    url.searchParams.set(urlParamName, file.name);
    url.searchParams.set("STUDIO", "1");
    console.log(url.toString());
    return api
      .actionQuery("select %Atelier_v1_Utils.General_GetCSPToken(?) token", [url.toString()])
      .then((tokenObj) => {
        console.log(tokenObj);
        const csptoken = tokenObj.result.content[0].token;
        url.searchParams.set("CSPCHD", csptoken);
        url.searchParams.set("Namespace", api.config.ns);
        console.log(url.toString());

        panel.webview.html = `
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
      <iframe src="${url.toString()}" id="editor" width="100%" height="100%" frameborder="0">
      </iframe>
    </body>
    </html>
    `;
      });
  } catch (e) {
    console.log(["error", e]);
  }
}
