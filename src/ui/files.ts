import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
export async function saveFile(name: string, data: string, mime: string) {
  if (Capacitor.getPlatform() === "android") {
    const result = await Filesystem.writeFile({
      path: name,
      data,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({
      title: "Sauvegarde ApplyFlow",
      url: result.uri,
      dialogTitle: "Enregistrer ou partager la sauvegarde",
    });
    return;
  }
  const url = URL.createObjectURL(new Blob([data], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
