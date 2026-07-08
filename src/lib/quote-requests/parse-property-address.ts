/** Best-effort parse of a single-line property address from quote intake. */
export function parseQuoteRequestPropertyAddress(
  fullAddress: string,
  fallbackProvince: string | null
): {
  propertyAddressLine1: string;
  propertyCity: string;
  propertyProvince: string;
  propertyPostalCode: string | null;
} {
  const trimmed = fullAddress.trim();
  const fallbackProv = (fallbackProvince ?? "ON").trim().toUpperCase().slice(0, 2) || "ON";

  if (!trimmed) {
    return {
      propertyAddressLine1: "Address on file",
      propertyCity: "—",
      propertyProvince: fallbackProv,
      propertyPostalCode: null,
    };
  }

  const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);

  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    const cityProvPostal = last.match(
      /^(.+?)\s+([A-Z]{2})\s+([A-Z]\d[A-Z]\s?\d[A-Z]\d)$/i
    );
    if (cityProvPostal && parts.length >= 2) {
      const city = cityProvPostal[1].trim() || parts[parts.length - 2];
      const province = cityProvPostal[2].toUpperCase();
      const postal = cityProvPostal[3].toUpperCase().replace(/\s+/, " ");
      const street = parts.slice(0, -1).join(", ");
      return {
        propertyAddressLine1: street || parts[0],
        propertyCity: city,
        propertyProvince: province,
        propertyPostalCode: postal,
      };
    }

    const provOnly = last.match(/^([A-Z]{2})\s*([A-Z]\d[A-Z]\s?\d[A-Z]\d)?$/i);
    if (provOnly && parts.length >= 2) {
      const province = provOnly[1].toUpperCase();
      const postal = provOnly[2]?.toUpperCase().replace(/\s+/, " ") ?? null;
      const city = parts[parts.length - 2];
      const street = parts.slice(0, -2).join(", ") || parts[0];
      return {
        propertyAddressLine1: street,
        propertyCity: city,
        propertyProvince: province,
        propertyPostalCode: postal,
      };
    }

    if (parts.length >= 3) {
      const postal = last.match(/^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i)
        ? last.toUpperCase().replace(/\s+/, " ")
        : null;
      if (postal) {
        const provPart = parts[parts.length - 2];
        const provMatch = provPart.match(/^([A-Z]{2})$/i);
        if (provMatch) {
          const city = parts[parts.length - 3];
          const street = parts.slice(0, -3).join(", ") || parts[0];
          return {
            propertyAddressLine1: street,
            propertyCity: city,
            propertyProvince: provMatch[1].toUpperCase(),
            propertyPostalCode: postal,
          };
        }
      }
    }
  }

  return {
    propertyAddressLine1: trimmed,
    propertyCity: "See address",
    propertyProvince: fallbackProv,
    propertyPostalCode: null,
  };
}
