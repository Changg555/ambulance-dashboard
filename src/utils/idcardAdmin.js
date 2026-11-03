// จัดรูปแบบเลขบัตรประชาชน 13 หลักให้อ่านง่าย (x-xxxx-xxxxx-xx-x)
export function formatIdCardNumber(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length !== 13) return raw;
  return `${digits[0]}-${digits.slice(1, 5)}-${digits.slice(5, 10)}-${digits.slice(10, 12)}-${digits[12]}`;
}