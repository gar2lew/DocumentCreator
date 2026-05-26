import type { Recipient, RecipientRole, RecipientResolutionStrategy } from './types';

export interface RecipientLookup {
  recipient: Recipient;
  matchedBy: RecipientResolutionStrategy;
}

export function resolveRecipientByRole(
  role: RecipientRole,
  allRecipients: Recipient[]
): RecipientLookup[] {
  return allRecipients
    .filter((r) => r.role === role)
    .map((r) => ({ recipient: r, matchedBy: 'by_role' as RecipientResolutionStrategy }));
}

export function resolveRecipientById(
  id: string,
  allRecipients: Recipient[]
): RecipientLookup | null {
  const found = allRecipients.find((r) => r.id === id);
  if (!found) return null;
  return { recipient: found, matchedBy: 'by_id' as RecipientResolutionStrategy };
}

export function resolveRecipientsByPackage(
  packageId: string,
  allRecipients: Recipient[]
): RecipientLookup[] {
  return allRecipients
    .filter((r) => r.packageIds.includes(packageId))
    .map((r) => ({ recipient: r, matchedBy: 'by_package' as RecipientResolutionStrategy }));
}

export function buildRecipientMappings(
  recipients: Recipient[]
): Record<string, string> {
  const mappings: Record<string, string> = {};
  for (const r of recipients) {
    mappings[r.id] = r.role;
  }
  return mappings;
}

export function getIssuanceLineageForRecipient(
  recipient: Recipient,
  allStates: { issuanceId: string; issuanceState: string; packageId: string; issuedAt: Date }[]
): { issuanceId: string; state: string; packageId: string; issuedAt: Date }[] {
  return allStates
    .filter((s) => recipient.issuanceIds.includes(s.issuanceId))
    .map((s) => ({
      issuanceId: s.issuanceId,
      state: s.issuanceState,
      packageId: s.packageId,
      issuedAt: s.issuedAt,
    }))
    .sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime());
}
