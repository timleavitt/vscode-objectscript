import * as vscode from "vscode";
import { AtelierAPI } from "../api";
import { config } from "../extension";
import { currentBplDtlClassDoc } from "../providers/bplDtlEditor";
import { DocumentContentProvider } from "../providers/DocumentContentProvider";
import { currentFile } from "../utils";

export async function viewOthers(): Promise<void> {
  const file = currentFile();
  if (!file) {
    // BPL/DTL files are not supported for the standard view other method
    if (currentBplDtlClassDoc) {
      vscode.window.showTextDocument(currentBplDtlClassDoc);
    }
    return;
  }
  if (file.uri.scheme === "file" && !config("conn").active) {
    return;
  }

  const open = (item) => {
    const uri = DocumentContentProvider.getUri(item);
    vscode.window.showTextDocument(uri);
  };

  const getOthers = (info) => {
    return info.result.content[0].others;
  };
  const api = new AtelierAPI(file.uri);

  console.log("in vie others with name:", file.name);

  return api
    .actionIndex([file.name])
    .then((info) => {
      const listOthers = getOthers(info) || [];
      console.log("got others:", listOthers);
      if (!listOthers.length) {
        return;
      }
      if (listOthers.length === 1) {
        open(listOthers[0]);
      } else {
        vscode.window.showQuickPick(listOthers).then((item) => {
          open(item);
        });
      }
    })
    .catch((err) => console.error(err));
}
