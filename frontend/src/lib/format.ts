export const inr = (n: number | undefined | null) => {
  if (n == null || Number.isNaN(n)) return "—";
  const neg = n < 0, x = Math.abs(n);
  const s = x >= 1e7 ? (x / 1e7).toFixed(2) + " Cr" : x >= 1e5 ? (x / 1e5).toFixed(2) + " L" : Math.round(x).toLocaleString("en-IN");
  return (neg ? "−" : "") + "₹" + s;
};
export const inrFull = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
