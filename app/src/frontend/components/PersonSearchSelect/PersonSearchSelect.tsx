import { useMemo, useState } from "react";
import type { Person } from "../../api";

type PersonSearchSelectProps = {
  people: Person[];
  value: string;
  selectedId: string;
  placeholder?: string;
  emptyText?: string;
  onInputChange: (value: string) => void;
  onSelect: (person: Person) => void;
};

export function PersonSearchSelect({
  people,
  value,
  selectedId,
  placeholder = "输入姓名或备注后选择",
  emptyText = "没有匹配的存票人。",
  onInputChange,
  onSelect
}: PersonSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const matchedPeople = useMemo(() => {
    const keyword = value.trim();
    return people
      .filter((person) => !keyword || person.name.includes(keyword) || person.note.includes(keyword))
      .slice(0, 5);
  }, [people, value]);

  function selectPerson(person: Person) {
    onSelect(person);
    setOpen(false);
  }

  return (
    <div className="person-picker">
      <label>存票人搜索
        <input
          autoComplete="off"
          value={value}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onChange={(event) => {
            onInputChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
        />
      </label>
      {open && (
        <div className="person-picker-list" role="listbox">
          {matchedPeople.map((person) => (
            <button
              className={person.id === selectedId ? "active" : ""}
              key={person.id}
              onMouseDown={(event) => event.preventDefault()}
              type="button"
              onClick={() => selectPerson(person)}
            >
              <strong>{person.name}</strong>
              <span>余额 {person.balance}{person.note ? ` · ${person.note}` : ""}</span>
            </button>
          ))}
          {!people.length && <p className="empty-inline">暂无可选存票人。</p>}
          {!!people.length && !matchedPeople.length && <p className="empty-inline">{emptyText}</p>}
        </div>
      )}
    </div>
  );
}
