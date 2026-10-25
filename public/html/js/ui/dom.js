// Crea un elemento con atributos, eventos (onclick, oninput…) y hijos (texto, nodos o arrays).
function h(tag, props, ...children) {
  const el = document.createElement(tag);
  Object.entries(props || {}).forEach(([key, val]) => {
    if (val == null || val === false) return;
    if (key === "class") el.className = val;
    else if (key === "style") Object.assign(el.style, val);
    else if (key.startsWith("on")) el.addEventListener(key.slice(2), val);
    else if (key === "value") el.value = val;
    else el.setAttribute(key, val === true ? "" : val);
  });
  el.append(
    ...children
      .flat()
      .filter(c => c != null && c !== false)
      .map(c => (c instanceof Node ? c : document.createTextNode(String(c)))),
  );
  return el;
}

// Texto con saltos de línea convertidos en <br>.
function lines(text) {
  const all = String(text).split("\n");
  return all.flatMap((line, i) => (i < all.length - 1 ? [line, h("br")] : [line]));
}
