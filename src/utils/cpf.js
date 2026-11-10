export const limparCpf = (s) => String(s ?? "").replace(/\D/g, "");

export function cpfValido(valor) {
  const c = limparCpf(valor);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const dv = (n) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(c[i]) * (n + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
}

export const mascararCpf = (c) => c.slice(0, 2) + "*".repeat(7) + c.slice(-2);
