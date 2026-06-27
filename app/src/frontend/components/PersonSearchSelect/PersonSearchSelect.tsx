import { useMemo, useState } from "react";
import type { Person } from "../../api";

const visiblePersonLimit = 8;

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
  placeholder = "输入姓名搜索，点击下拉结果选择",
  emptyText = "没有匹配的存票人，请检查名称或状态。",
  onInputChange,
  onSelect
}: PersonSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const filteredPeople = useMemo(() => {
    const keyword = value.trim();
    return people
      .filter((person) => !keyword || person.name.includes(keyword) || person.note.includes(keyword));
  }, [people, value]);
  const matchedPeople = filteredPeople.slice(0, visiblePersonLimit);
  const hasMoreMatches = filteredPeople.length > visiblePersonLimit;

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
          {!people.length && <p className="empty-inline">暂无可选存票人，请先在存票人页面新增。</p>}
          {!!people.length && !matchedPeople.length && <p className="empty-inline">{emptyText}</p>}
          {!!matchedPeople.length && (
            <p className="person-picker-hint">
              {hasMoreMatches ? `仅显示前 ${visiblePersonLimit} 个，继续输入可缩小范围。` : `已显示 ${matchedPeople.length} 个匹配结果。`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
