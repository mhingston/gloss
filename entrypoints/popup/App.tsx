import { SettingsForm } from '@/components/SettingsForm';

export default function App() {
  return (
    <main className="popup">
      <header>
        <h1>Gloss</h1>
        <p>Personalize any page from the floating orb.</p>
      </header>
      <SettingsForm compact />
      <ol>
        <li>Save your xAI key</li>
        <li>Open any website</li>
        <li>Click Gloss or press ⌘⇧Y</li>
        <li>Keep prompting — each pass screenshots the page</li>
      </ol>
    </main>
  );
}
