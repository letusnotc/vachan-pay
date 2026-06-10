/** Normalise any Indian phone string to E.164 (+91XXXXXXXXXX) */
export const normalizePhone = (raw: string): string => {
  const cleaned = raw.replace(/[\s\-\(\)\.]/g, '');
  if (cleaned.startsWith('+'))                       return cleaned;
  if (cleaned.length === 10 && /^[6-9]/.test(cleaned)) return `+91${cleaned}`;
  if (cleaned.startsWith('91') && cleaned.length === 12) return `+${cleaned}`;
  return cleaned;
};

/** Pretty-print a +91XXXXXXXXXX number */
export const formatPhone = (phone: string): string => {
  if (phone.startsWith('+91') && phone.length === 13) {
    return `+91 ${phone.slice(3, 8)} ${phone.slice(8)}`;
  }
  return phone;
};
