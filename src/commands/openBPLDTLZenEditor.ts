import * as vscode from "vscode";
import { config } from "../extension";
import { BplEditorProvider } from "../providers/bplEditor";
import { DocumentContentProvider } from "../providers/DocumentContentProvider";
import { currentFile } from "../utils";
import { ClassDefinition } from "../utils/classDefinition";

export async function openBPLDTLZenEditor(): Promise<void> {
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
    // TODO: provide a useful error message?
    return;
  }

  const fileToEditName = file.name.substring(0, file.name.length - 4) + fileExtension;
  vscode.commands.executeCommand(
    "vscode.openWith",
    DocumentContentProvider.getUri(fileToEditName),
    BplEditorProvider.viewType
  );
}
