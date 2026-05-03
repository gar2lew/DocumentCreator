const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function threeDigits(n: number): string {
  if (n === 0) return '';
  if (n < 20) return ones[n];
  if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
  return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + threeDigits(n % 100) : '');
}

export function numberToWords(amount: number): string {
  if (amount === 0) return 'Zero Dollars';
  if (!isFinite(amount) || isNaN(amount)) return '';

  const dollars = Math.floor(Math.abs(amount));
  const cents = Math.round((Math.abs(amount) - dollars) * 100);

  const parts: string[] = [];

  if (dollars >= 1_000_000_000) {
    parts.push(threeDigits(Math.floor(dollars / 1_000_000_000)) + ' Billion');
  }
  if ((dollars % 1_000_000_000) >= 1_000_000) {
    parts.push(threeDigits(Math.floor((dollars % 1_000_000_000) / 1_000_000)) + ' Million');
  }
  if ((dollars % 1_000_000) >= 1_000) {
    parts.push(threeDigits(Math.floor((dollars % 1_000_000) / 1_000)) + ' Thousand');
  }
  if (dollars % 1_000 > 0) {
    parts.push(threeDigits(dollars % 1_000));
  }

  let result = (amount < 0 ? 'Negative ' : '') + parts.join(' ');
  result += dollars === 1 ? ' Dollar' : ' Dollars';

  if (cents > 0) {
    result += ' and ' + threeDigits(cents) + (cents === 1 ? ' Cent' : ' Cents');
  }

  return result;
}
