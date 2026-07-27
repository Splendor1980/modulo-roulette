const DENOMINATIONS = [1, 5, 10, 25, 100];

export default function ChipTray({ selected, onSelect }) {
  return (
    <div className="chip-tray">
      {DENOMINATIONS.map((amount) => (
        <div
          key={amount}
          className={`chip ${selected === amount ? "selected" : ""}`}
          onClick={() => onSelect(amount)}
        >
          {amount}
        </div>
      ))}
    </div>
  );
}
