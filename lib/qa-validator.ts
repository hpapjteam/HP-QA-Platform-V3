import { validateViewOnlineUrl, validateHtmlContentUrls, fetchAndValidateCountryUrls, fetchAllowedUrlPattern } from "./url-validator";

export { fetchAndValidateCountryUrls, fetchAllowedUrlPattern };

export interface ValidationResult {
  id: string;
  name: string;
  status: "pass" | "fail" | "warning" | "pending" | "manual";
  message?: string;
}

export function validateCampaignHTML(
  html: string,
  expectedCountryPrefix: string,
  rawWebViewUrl?: string,
  countryName?: string,
  versionName?: string
): ValidationResult[] {
  const results: ValidationResult[] = [];
  
  if (!html && !rawWebViewUrl) return results;

  const countryInfo = countryName ? `${countryName}${versionName ? ` (${versionName})` : ''}` : 'selected country version';

  // 0. View Online URL Validation using reusable validator module
  let resolvedUrl = expectedCountryPrefix;
  if (rawWebViewUrl) {
    const viewOnlineCheck = validateViewOnlineUrl(rawWebViewUrl, expectedCountryPrefix, countryInfo);
    results.push(viewOnlineCheck.result);
    if (viewOnlineCheck.resolvedUrl) {
      resolvedUrl = viewOnlineCheck.resolvedUrl;
    }
  }

  // Resolve {{ViewOnline}} and similar placeholders to expectedCountryPrefix / resolvedUrl
  let processedHtml = html || "";
  if (resolvedUrl) {
    processedHtml = processedHtml
      .replace(/\{\{ViewOnline\}\}/g, resolvedUrl)
      .replace(/%2B%2BViewOnline%2B%2B/gi, resolvedUrl)
      .replace(/%%view_email_url%%/gi, resolvedUrl);
  }

  // 1. Campaign Name in Campaign Brief (Manual)
  results.push({ id: "camp_name", name: "Campaign Name Match", status: "manual", message: "Manually compare campaign name with SFMC and email template (no spaces)." });
  
  // 2. Subject Line (Manual)
  results.push({ id: "subj_line", name: "Subject Line Check", status: "manual", message: "Manually compare subject line with SFMC and email template." });

  // 3. Pre-header (Manual)
  results.push({ id: "pre_header", name: "Pre-header Check", status: "manual", message: "Check pre-header in SFMC (no spaces)." });

  // 4. AmpScript check - Benefits color code
  if (processedHtml.includes("@HPBenefitsHexColour1")) {
    results.push({ id: "benefits_color", name: "Benefits Color Code (AmpScript)", status: "pass", message: "AmpScript benefits color variables found." });
  } else {
    results.push({ id: "benefits_color", name: "Benefits Color Code (AmpScript)", status: "warning", message: "AmpScript benefits color variables (@HPBenefitsHexColour) not found. Verify against Figma." });
  }

  // 5. & 6. UTM Tracking & GA Tracking
  if (processedHtml.includes("utm_source=BSL") || processedHtml.includes("%%=v(@tracking)=%%")) {
    results.push({ id: "tracking", name: "UTM & GA Tracking Parameters", status: "pass", message: "UTM or @tracking parameters found. Manually verify dynamic GA tracking append." });
  } else {
    results.push({ id: "tracking", name: "UTM & GA Tracking Parameters", status: "warning", message: "No standard UTM parameters or @tracking tags found. Verify manually." });
  }

  // 7. Compare Content text (Manual)
  results.push({ id: "content_text", name: "Content Translation", status: "manual", message: "Compare all content text with Translation Document/Figma." });

  // 8. Check product prices (Manual)
  results.push({ id: "product_prices", name: "Product Prices", status: "manual", message: "Compare product prices against Landing Pages." });

  // 9. All Products available (Manual)
  results.push({ id: "product_stock", name: "Product Availability", status: "manual", message: "Check all product links to ensure they are in stock." });

  // 10. Check Coupons
  if (processedHtml.includes("SET @vouchersent")) {
     results.push({ id: "vouchers", name: "Dual Coupons Code", status: "pass", message: "Voucher AmpScript settings found. Manually verify if coupons are live." });
  } else {
     results.push({ id: "vouchers", name: "Dual Coupons Code", status: "manual", message: "No voucher settings found. Ensure this is expected." });
  }

  // 11. Store Place "%20" check
  const spaceInUrlRegex = /href=["']([^"']*%20[^"']*)["']/g;
  let hasSpaces = false;
  let match;
  while ((match = spaceInUrlRegex.exec(processedHtml)) !== null) {
    hasSpaces = true;
  }
  if (hasSpaces) {
    results.push({ id: "url_spaces", name: "No '%20' in Links", status: "fail", message: "Found '%20' (spaces) in URLs. Please encode properly or remove spaces." });
  } else {
    results.push({ id: "url_spaces", name: "No '%20' in Links", status: "pass", message: "No '%20' found in URLs." });
  }

  // 12. Links match Promo pages (Semi-automated) using reusable validator
  const htmlContentCheck = validateHtmlContentUrls(processedHtml, expectedCountryPrefix, countryInfo);
  results.push(htmlContentCheck.result);

  // 13. Hashtags at end of link
  const hashtagRegex = /href=["'][^"']*#[^"']*&[^"']*["']/g; // Hashtag before parameters
  if (hashtagRegex.test(processedHtml)) {
     results.push({ id: "hashtag_order", name: "Hashtag Placement", status: "fail", message: "Found hashtags placed before URL parameters. Hashtags should be at the very end of the URL." });
  } else {
     results.push({ id: "hashtag_order", name: "Hashtag Placement", status: "pass", message: "Hashtags are correctly placed at the end of URLs (or none present)." });
  }

  // 14. Background colors (Manual)
  results.push({ id: "bg_colors", name: "Background Colors", status: "manual", message: "Manually compare background colors with Figma." });

  // 15. Images are rendering properly (Manual)
  results.push({ id: "image_render", name: "Image Rendering", status: "manual", message: "Manually check if all images align correctly as per Figma." });

  // 16. Unsubscribe link
  if (processedHtml.toLowerCase().includes("unsubscribe")) {
    results.push({ id: "unsub_link", name: "Unsubscribe Link", status: "pass", message: "Unsubscribe text/link found in template. Please test by clicking." });
  } else {
    results.push({ id: "unsub_link", name: "Unsubscribe Link", status: "warning", message: "No unsubscribe link/text found." });
  }

  // 17. Check Terms and Conditions (Manual)
  results.push({ id: "tnc_dates", name: "Terms and Conditions", status: "manual", message: "Manually verify T&C offer dates match landing pages." });

  // 18. Alt and Alias tags
  const linkRegexAlias = /<a\s+(?:[^>]*?\s+)?href=["'][^"']*["'][^>]*>/gi;
  let allHaveAlias = true;
  while ((match = linkRegexAlias.exec(processedHtml)) !== null) {
     if (!match[0].toLowerCase().includes("alias=")) {
       allHaveAlias = false;
       break;
     }
  }
  if (!allHaveAlias) {
    results.push({ id: "alias_tags", name: "Alias Tags Check", status: "warning", message: "Some <a> links are missing the 'alias' attribute." });
  } else {
    results.push({ id: "alias_tags", name: "Alias Tags Check", status: "pass", message: "All links contain alias attributes. Ensure no '&' symbols." });
  }

  // 19. English version: grammar & spelling (Manual)
  results.push({ id: "grammar", name: "Grammar & Spelling", status: "manual", message: "Perform manual grammar, spelling, and widow word checks." });

  // 20. Phone number amp script
  if (processedHtml.includes("tel:")) {
     results.push({ id: "phone_links", name: "Phone Number Links", status: "pass", message: "Phone number (tel:) links found. Ensure they are correct." });
  }

  // 21. Check sup tags (ASCII)
  let asciiPass = true;
  const missingSups: string[] = [];
  if (processedHtml.includes("©") && !processedHtml.includes("<sup>©</sup>")) {
     asciiPass = false;
     missingSups.push("©");
  }
  if (processedHtml.includes("®") && !processedHtml.includes("<sup>®</sup>")) {
     asciiPass = false;
     missingSups.push("®");
  }
  
  if (!asciiPass) {
     results.push({ id: "ascii_sup", name: "ASCII Superscript Tags", status: "warning", message: `Found ${missingSups.join(', ')} without <sup> wrapper.` });
  } else {
     results.push({ id: "ascii_sup", name: "ASCII Superscript Tags", status: "pass", message: "ASCII characters appropriately superscripted (or none found)." });
  }

  // 22. All versions: ASCII rendering (Manual)
  results.push({ id: "ascii_render", name: "ASCII Rendering", status: "manual", message: "Check ASCII characters render properly in both Outlook and Web versions." });

  // 23. General view / Litmus (Manual)
  results.push({ id: "litmus_check", name: "Litmus & Group Emails", status: "manual", message: "Check Litmus link. Ensure no dual images. Compare with Invision/Figma." });

  // 24. Font sizes (Manual)
  results.push({ id: "font_sizes", name: "Font Sizes", status: "manual", message: "Check font sizes for titles, subtitles, and prices against Figma." });

  // 25. Inspect images to full (Manual)
  results.push({ id: "mobile_images", name: "Mobile Image Rendering", status: "manual", message: "Check if product images render and align properly on mobile." });

  // 26. HP Logo check
  const hpLogo = "https://image.hpnews.hp.com/lib/fe8f1573726d077475/m/1/948fb445-19d4-449e-af48-6f96388fe25b.png";
  if (processedHtml.includes(hpLogo)) {
    results.push({ id: "hp_logo", name: "HP Logo Check", status: "pass", message: "Correct HP logo with blue border found." });
  } else {
    results.push({ id: "hp_logo", name: "HP Logo Check", status: "fail", message: "Required HP logo with blue border not found." });
  }

  return results;
}
