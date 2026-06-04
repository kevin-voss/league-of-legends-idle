export interface ButtonOptions {
  variant?: "primary" | "danger" | "ghost";
  disabled?: boolean;
  active?: boolean;
  title?: string;
}

export function createButton(label: string, onClick: () => void, options: ButtonOptions = {}): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  if (options.variant) {
    button.classList.add(options.variant);
  }
  if (options.active) {
    button.classList.add("active");
  }
  if (options.title) {
    button.title = options.title;
  }
  button.disabled = Boolean(options.disabled);
  button.addEventListener("click", onClick);
  return button;
}
