/**
 * Contract PDF scaffolding for JobProof.
 * Placeholder for PDF generation - implement with @react-pdf/renderer, jsPDF, or server-side lib.
 */

export interface ContractPdfOptions {
  contractId: string;
  contractData: Record<string, unknown>;
  jobTitle: string;
  customerName: string;
  customerEmail?: string;
  propertyAddress?: string;
  price?: number;
  depositAmount?: number;
  scopeOfWork?: string;
  paymentTerms?: string;
}

/**
 * Generate a signed contract PDF and return the storage path.
 * Placeholder: returns null until PDF generation is implemented.
 * Called after contract signing to produce the final signed PDF.
 */
export async function generateSignedContractPdf(
  _options: ContractPdfOptions
): Promise<string | null> {
  // TODO: Implement PDF generation
  // - Use @react-pdf/renderer for React-based PDF
  // - Or jsPDF, pdf-lib for programmatic generation
  // - Include contract terms, signature details, signed_at
  // - Upload to Supabase storage bucket 'contract-pdfs'
  // - Path: {profile_id}/{contract_id}/signed-{timestamp}.pdf
  // - Return storage path
  return null;
}

/**
 * Generate a signed change order PDF.
 * Placeholder: returns null until PDF generation is implemented.
 */
export async function generateSignedChangeOrderPdf(
  _options: {
    changeOrderId: string;
    changeTitle: string;
    changeDescription?: string;
    originalContractPrice: number;
    changeAmount: number;
    revisedTotalPrice: number;
    jobTitle: string;
    customerName: string;
    signedAt?: string;
    signerName?: string;
  }
): Promise<string | null> {
  // TODO: Implement PDF generation for change orders
  return null;
}
