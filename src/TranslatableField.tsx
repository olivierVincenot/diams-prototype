import { Languages } from 'lucide-react';
import type { Labels } from './types';
import { completeMissingTranslations } from './domain';
import { Field } from './ui';

type Translations = { en: string; ko: string };

export function TranslatableField({ label, value, onChange, translations, onTranslationsChange, knownLabels, placeholder, multiline, required, wide }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  translations?: Translations;
  onTranslationsChange: (translations: Translations) => void;
  knownLabels: Labels[];
  placeholder?: string;
  multiline?: boolean;
  required?: boolean;
  wide?: boolean;
}) {
  const current = translations ?? { en: '', ko: '' };
  return <div className={`translatable-field${wide ? ' wide' : ''}`}>
    <Field label={label}>
      {multiline
        ? <textarea rows={3} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} />
        : <input required={required} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} />}
    </Field>
    <details className="translation-options">
      <summary>Traductions EN / KO</summary>
      <div className="translation-options-body">
        <button type="button" className="btn small" disabled={!value.trim()}
          onClick={() => onTranslationsChange(completeMissingTranslations(value, current, knownLabels))}>
          <Languages size={15} />Proposer les traductions manquantes
        </button>
        <small>Dictionnaire local uniquement : les textes inconnus sont signalés « à traduire ». Les traductions existantes sont conservées et restent à relire si le texte change.</small>
        {(['en', 'ko'] as const).map(locale => <Field key={locale} label={`${label.replace(/\s*\*$/, '')} · ${locale === 'en' ? 'Anglais' : 'Coréen'}`}>
          {multiline
            ? <textarea rows={3} value={current[locale]} onChange={event => onTranslationsChange({ ...current, [locale]: event.target.value })} />
            : <input value={current[locale]} onChange={event => onTranslationsChange({ ...current, [locale]: event.target.value })} />}
        </Field>)}
      </div>
    </details>
  </div>;
}
