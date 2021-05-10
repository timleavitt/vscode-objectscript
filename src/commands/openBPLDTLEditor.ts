import * as vscode from "vscode";
import { config } from "../extension";
import { BplDtlEditorProvider } from "../providers/bplDtlEditor";
import { DocumentContentProvider } from "../providers/DocumentContentProvider";
import { currentFile } from "../utils";
import { ClassDefinition } from "../utils/classDefinition";

export async function openBplDtlEditor(): Promise<void> {
  const file = currentFile();
  if (!file || !file.name.toLowerCase().endsWith(".cls")) {
    return;
  }
  if (file.uri.scheme === "file" && !config("conn").active) {
    return;
  }
  const classDefinition = new ClassDefinition(file.name);
  const superClass = await classDefinition.super();
  let fileExtension: string;
  if (superClass.includes("Ens.DataTransformDTL")) {
    fileExtension = ".dtl";
  } else if (superClass.includes("Ens.BusinessProcessBPL")) {
    fileExtension = ".bpl";
  } else {
    vscode.window.showErrorMessage(
      "To open in a BPL/DTL Editor, the class must extend either Ens.BusinessProcessBPL or Ens.DataTransformDTL respectively."
    );
    return;
  }

  const fileToEditName = file.name.substring(0, file.name.length - 4) + fileExtension;
  vscode.commands.executeCommand(
    "vscode.openWith",
    DocumentContentProvider.getUri(fileToEditName),
    BplDtlEditorProvider.viewType
  );
}
