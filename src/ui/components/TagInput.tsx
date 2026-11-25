// workshop-ui 소유: 태그 입력 (성격·좋아하는 것). Enter/쉼표로 추가, 추천 태그 탭.
import { useId, useState } from 'react';
import { Icon } from './Icon';

interface Props {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  suggestions: string[];
  max?: number;
  placeholder?: string;
}

export function TagInput({ label, value, onChange, suggestions, max = 6, placeholder }: Props) {
  const id = useId();
  const [text, setText] = useState('');
  const full = value.length >= max;
  const add = (raw: string) => {
    const t = raw.trim().slice(0, 12);
    if (!t || value.includes(t) || full) return;
    onChange([...value, t]);
  };
  return (
    <div className="tag-input">
      <label htmlFor={id}>{label}</label>
      <ul className="tags" aria-label={`${label} 목록`}>
        {value.map((t) => (
          <li key={t} className="tag">
            {t}
            <button type="button" className="tag__x" aria-label={`${t} 빼기`} onClick={() => onChange(value.filter((x) => x !== t))}>
              <Icon name="close" size={14} />
            </button>
          </li>
        ))}
      </ul>
      <div className="tag-input__row">
        <input
          id={id}
          type="text"
          value={text}
          maxLength={12}
          enterKeyHint="done"
          placeholder={full ? `최대 ${max}개까지예요` : placeholder}
          disabled={full}
          onChange={(e) => setText(e.currentTarget.value)}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ',') && !e.nativeEvent.isComposing) {
              e.preventDefault();
              add(text);
              setText('');
            } else if (e.key === 'Backspace' && !text && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
        />
        <button
          type="button"
          className="btn btn--small"
          disabled={full || !text.trim()}
          onClick={() => {
            add(text);
            setText('');
          }}
        >
          <Icon name="plus" size={18} /> 추가
        </button>
      </div>
      <div className="suggest" role="group" aria-label={`${label} 추천`}>
        {suggestions
          .filter((s) => !value.includes(s))
          .map((s) => (
            <button key={s} type="button" className="chip" onClick={() => add(s)} disabled={full}>
              + {s}
            </button>
          ))}
      </div>
    </div>
  );
}
