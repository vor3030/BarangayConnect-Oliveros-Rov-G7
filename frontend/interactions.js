export function mountInteractions() {
  const passwordInputs = [...document.querySelectorAll("input[type='password']")];
  const multiplePasswords = passwordInputs.length > 1;

  for (const input of passwordInputs) {
    const wrapper = document.createElement("div");
    wrapper.className = "password-control";
    input.before(wrapper);
    wrapper.append(input);

    const associatedLabel = input.id
      ? document.querySelector(`label[for="${CSS.escape(input.id)}"]`)?.textContent?.trim()
      : "";
    const labelSuffix = multiplePasswords && associatedLabel ? ` (${associatedLabel})` : "";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "password-toggle";
    toggle.textContent = "Show";
    toggle.setAttribute("aria-label", `Show characters for this field${labelSuffix}`);
    if (input.id) toggle.setAttribute("aria-controls", input.id);
    toggle.setAttribute("aria-pressed", "false");
    toggle.addEventListener("click", () => {
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      toggle.textContent = show ? "Hide" : "Show";
      toggle.setAttribute("aria-label", `${show ? "Hide" : "Show"} characters for this field${labelSuffix}`);
      toggle.setAttribute("aria-pressed", String(show));
    });
    wrapper.append(toggle);
  }

  document.querySelector("[data-error-summary]")?.focus({ preventScroll: false });
  document.documentElement.dataset.interactionsReady = "true";
  return () => {};
}
