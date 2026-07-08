import type { SupabaseClient } from "@supabase/supabase-js";
import { generateEstimateNumber } from "@/lib/estimate-number";
import { defaultTaxRateForNewFinancials } from "@/lib/tax/canada";
import { buildEstimateFieldsFromQuoteBuilder } from "@/lib/quote-requests/quote-builder/to-estimate";
import type { QuoteBuilderSection } from "@/lib/quote-requests/quote-builder/types";

export async function upsertEstimateFromQuoteBuilder(
  supabase: SupabaseClient,
  input: {
    profileId: string;
    requestId: string;
    customerId: string;
    existingEstimateId: string | null;
    projectType: string;
    propertyAddress: string;
    profileProvince: string | null;
    sections: QuoteBuilderSection[];
  }
): Promise<{ estimateId: string } | { error: string }> {
  const taxRate = defaultTaxRateForNewFinancials(
    input.profileProvince,
    null
  ).taxRate;

  const fields = buildEstimateFieldsFromQuoteBuilder({
    sections: input.sections,
    projectType: input.projectType,
    propertyAddress: input.propertyAddress,
    profileProvince: input.profileProvince,
    taxRate,
  });

  if ("error" in fields) {
    return { error: fields.error };
  }

  if (input.existingEstimateId) {
    const { data: existing } = await supabase
      .from("estimates")
      .select("id, status")
      .eq("id", input.existingEstimateId)
      .eq("profile_id", input.profileId)
      .maybeSingle();

    if (!existing) {
      return { error: "Linked estimate not found." };
    }

    if (String(existing.status) !== "draft") {
      return { error: "This quote has already been sent." };
    }

    const { error: updateError } = await supabase
      .from("estimates")
      .update({
        customer_id: input.customerId,
        title: fields.title,
        scope_of_work: fields.scopeOfWork,
        property_address_line_1: fields.propertyAddressLine1,
        property_address_line_2: fields.propertyAddressLine2,
        property_city: fields.propertyCity,
        property_province: fields.propertyProvince,
        property_postal_code: fields.propertyPostalCode,
        subtotal: fields.subtotal,
        tax_rate: fields.taxRate,
        tax_amount: fields.taxAmount,
        total: fields.total,
        notes: fields.notes,
        quote_request_id: input.requestId,
      })
      .eq("id", input.existingEstimateId)
      .eq("profile_id", input.profileId);

    if (updateError) {
      console.error("[upsertEstimateFromQuoteBuilder update]", updateError);
      return { error: "Could not update estimate." };
    }

    return { estimateId: input.existingEstimateId };
  }

  const { data: created, error: createError } = await supabase
    .from("estimates")
    .insert({
      profile_id: input.profileId,
      customer_id: input.customerId,
      quote_request_id: input.requestId,
      estimate_number: generateEstimateNumber(),
      title: fields.title,
      scope_of_work: fields.scopeOfWork,
      property_address_line_1: fields.propertyAddressLine1,
      property_address_line_2: fields.propertyAddressLine2,
      property_city: fields.propertyCity,
      property_province: fields.propertyProvince,
      property_postal_code: fields.propertyPostalCode,
      subtotal: fields.subtotal,
      tax_rate: fields.taxRate,
      tax_amount: fields.taxAmount,
      total: fields.total,
      notes: fields.notes,
      status: "draft",
    })
    .select("id")
    .single();

  if (createError || !created?.id) {
    console.error("[upsertEstimateFromQuoteBuilder create]", createError);
    return { error: "Could not create estimate." };
  }

  const estimateId = String(created.id);

  await supabase
    .from("quote_requests")
    .update({ estimate_id: estimateId })
    .eq("id", input.requestId)
    .eq("contractor_id", input.profileId);

  return { estimateId };
}
