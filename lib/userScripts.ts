export async function isUserScriptsAvailable(): Promise<boolean> {
  try {
    if (!browser.userScripts?.getScripts) return false;
    await browser.userScripts.getScripts();
    return true;
  } catch {
    return false;
  }
}
