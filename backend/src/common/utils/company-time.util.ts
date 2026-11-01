export function toCompanyDateIso(date: Date = new Date(), timeZone = 'Asia/Riyadh'): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(date);
}
