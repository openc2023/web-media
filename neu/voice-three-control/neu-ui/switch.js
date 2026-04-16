export function bindCheckboxControl(input, onChange) {
  const handler = () => onChange(input.checked);
  input.addEventListener("change", handler);

  return {
    destroy() {
      input.removeEventListener("change", handler);
    },
    getValue() {
      return input.checked;
    },
    setValue(nextValue) {
      input.checked = Boolean(nextValue);
    },
  };
}
