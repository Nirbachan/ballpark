// Ballpark data. Everything tunable lives here; no code change needed to recalibrate.
// All bands are annual total pay midpoints in THOUSANDS of local currency,
// for a general professional at a mid-to-large employer (tier C) in a main city.
window.Ballpark = window.Ballpark || {};

window.Ballpark.DATA = {
  FX_NOTE: "Exchange rates set at build time. Edit FX_TO_INR in src/data.js.",
  FX_TO_INR: { INR: 1, USD: 88, EUR: 103, GBP: 118, AED: 24, SEK: 9.3, SGD: 68.5, CAD: 63.5, AUD: 57.5 },

  DEFAULT_MARKET: "IN",

  // What the number includes, per market. Shown under every figure.
  PAY_BASIS: {
    IN: "Annual CTC, fixed plus variable",
    AE: "Annual total pay, tax-free",
    DEFAULT: "Annual total pay, base plus bonus"
  },
  // Families where top employers pay a large share in stock.
  STOCK_FAMILIES: ["eng", "product", "data"],

  // Signal strength describes how much the title told us, not how accurate the number is.
  SIGNAL_TEXT: { high: "Strong signal", medium: "Partial signal", low: "Weak signal" },

  // Filled in from tests/validate.js once you have tested against known salaries.
  // Example: { high: { hitRate: 0.78, n: 23 }, medium: { hitRate: 0.61, n: 12 } }
  CALIBRATION: {},

  // Level 1..7: entry, analyst, consultant, senior/AM, manager, senior manager, director+
  MARKETS: {
    IN: { name: "India", currency: "INR", base: [500, 900, 1500, 2200, 3200, 4800, 7500] },
    US: { name: "United States", currency: "USD", base: [65, 85, 105, 130, 160, 200, 260] },
    GB: { name: "United Kingdom", currency: "GBP", base: [32, 42, 55, 70, 88, 110, 145] },
    AE: { name: "UAE", currency: "AED", base: [110, 170, 240, 320, 420, 560, 780] },
    NL: { name: "Netherlands", currency: "EUR", base: [40, 50, 62, 75, 92, 112, 145] },
    DE: { name: "Germany", currency: "EUR", base: [45, 55, 66, 78, 95, 115, 150] },
    FR: { name: "France", currency: "EUR", base: [38, 46, 56, 68, 84, 104, 138] },
    SE: { name: "Sweden", currency: "SEK", base: [420, 500, 580, 680, 800, 950, 1250] },
    SG: { name: "Singapore", currency: "SGD", base: [50, 70, 90, 115, 145, 185, 250] },
    CA: { name: "Canada", currency: "CAD", base: [60, 75, 92, 110, 135, 165, 210] },
    AU: { name: "Australia", currency: "AUD", base: [70, 88, 105, 125, 150, 180, 230] }
  },

  // First match wins. `premium` applies to the named high-cost cities only.
  LOCATIONS: [
    { market: "IN", re: /\b(bengaluru|bangalore|mumbai|pune|hyderabad|chennai|new delhi|delhi|gurugram|gurgaon|noida)\b/i, premium: 1.0, metro: true },
    { market: "IN", re: /\b(india|kolkata|ahmedabad|kochi|jaipur|chandigarh|coimbatore|indore|thiruvananthapuram|mysuru|mysore|nagpur|bhubaneswar|lucknow|vadodara|visakhapatnam)\b/i, premium: 0.85 },
    { market: "AE", re: /\b(united arab emirates|uae|dubai|abu dhabi|sharjah)\b/i, premium: 1.0 },
    { market: "NL", re: /\b(netherlands|amsterdam|rotterdam|utrecht|eindhoven|the hague)\b/i, premium: 1.0 },
    { market: "DE", re: /\b(germany|deutschland|berlin|munich|münchen|hamburg|frankfurt|cologne|köln|stuttgart)\b/i, premium: 1.0 },
    { market: "FR", re: /\b(france|paris|lyon)\b/i, premium: 1.0 },
    { market: "SE", re: /\b(sweden|stockholm|gothenburg|göteborg|malmö|malmo)\b/i, premium: 1.0 },
    { market: "SG", re: /\bsingapore\b/i, premium: 1.0 },
    { market: "CA", re: /\b(canada|toronto|vancouver|montreal|ottawa|calgary)\b/i, premium: 1.0 },
    { market: "AU", re: /\b(australia|sydney|melbourne|brisbane|perth)\b/i, premium: 1.0 },
    { market: "GB", re: /\blondon\b/i, premium: 1.15 },
    { market: "GB", re: /\b(united kingdom|england|scotland|manchester|edinburgh|cambridge|oxford|uk)\b/i, premium: 1.0 },
    { market: "US", re: /\b(san francisco|bay area|new york|nyc|seattle|mountain view|palo alto|sunnyvale|menlo park|redmond|cupertino|san jose)\b/i, premium: 1.15 },
    { market: "US", re: /\b(united states|usa|austin|boston|chicago|los angeles|denver|atlanta|dallas|washington dc)\b|,\s*(CA|NY|WA|TX|MA|IL|CO|GA|NC|VA|NJ|FL|PA|OR|AZ|MN)\b/, premium: 1.0 }
  ],

  // Role families. Order matters: first match wins.
  FAMILIES: [
    { id: "product", label: "Product", mult: 1.3, re: /\b(product (manager|owner|lead|director|head|management)|head of product|\b(a|g|s)?pm\b)/i },
    { id: "data", label: "Data and AI", mult: 1.25, re: /(data scien|machine learning|\bml\b|ai engineer|ai\/ml|ml\/ai|applied scientist|research scientist|analytics engineer|data engineer|deep learning|\bnlp\b|computer vision|\bllm)/i },
    { id: "eng", label: "Engineering", mult: 1.2, re: /(engineer|developer|\bsde\b|\bswe\b|programmer|devops|\bsre\b|architect|full[- ]?stack|back[- ]?end|front[- ]?end|\bcto\b)/i },
    { id: "learning", label: "Learning and development", mult: 0.9, re: /(instructional design|learning (experience|and development|& development)|e-?learning|curriculum|\bl&d\b|learning designer|training)/i },
    { id: "design", label: "Design", mult: 1.0, re: /(designer|\bux\b|\bui\b|design lead|head of design|creative director)/i },
    { id: "hr", label: "HR and people", mult: 0.85, re: /(\bhr\b|human resources|human capital|\bpeople\b|talent|recruit|learning|l&d|training|hrbp|\bdei\b|diversity|total rewards|compensation|\bchro\b)/i },
    { id: "consulting", label: "Consulting", mult: 1.0, re: /(consult|advisory|strategy|transformation)/i },
    { id: "sales", label: "Sales", mult: 1.0, re: /(sales|account executive|business development|partnerships|customer success|key account)/i },
    { id: "marketing", label: "Marketing", mult: 0.9, re: /(marketing|brand|\bseo\b|content|communications|social media)/i },
    { id: "finance", label: "Finance", mult: 1.0, re: /(finance|financial|accountant|accounting|audit|\btax\b|treasury|fp&a|controller|investment|\bcfo\b)/i },
    { id: "ops", label: "Operations", mult: 0.9, re: /(operations|\bops\b|supply chain|logistics|procurement|project manager|program manager|\bpmo\b|delivery)/i }
  ],

  // Levels. Order matters: specific phrases before generic ones.
  LEVELS: [
    { level: 6, re: /(associate partner)/i },
    { level: 8, re: /(\bchief\b|\bc[etfop]o\b|\bchro\b|\bsvp\b|\bevp\b|senior vice president|executive vice president|managing director|managing partner|(?<!vice )\bpresident\b|\bpartner\b(?!s))/i },
    { level: 6, re: /(associate director|senior manager|sr\.?\s*manager|\bavp\b|assistant vice president|principal|staff (engineer|scientist|designer)|group product manager|senior engineering manager|associate partner)/i },
    { level: 7, re: /(vice president|\bvp\b|director|head of|\bgeneral manager\b)/i },
    { level: 5, re: /(senior (product|program) manager|sr\.?\s*(product|program) manager|architect|engineering manager)/i },
    { level: 4, re: /(business partner|hrbp|assistant manager|associate manager|product (manager|owner)|\blead\b|team lead|tech lead|senior|\bsr\.?\b|sde ?(ii|2|iii|3)|engineer (ii|iii|2|3))/i },
    { level: 5, re: /\b(manager|mgr)\b/i },
    { level: 3, re: /(consultant|specialist|engineer|developer|scientist|designer|executive|recruiter|accountant|programmer)/i },
    { level: 2, re: /(analyst|associate|coordinator|representative|officer|assistant)/i },
    { level: 1, re: /(intern|trainee|fresher|graduate|apprentice|student)/i }
  ],

  // "Partner" in these phrases is a role name, not firm partnership.
  NOT_PARTNER: /(business|program|hr|people|talent|success|channel|learning|growth|strategic|account|alliance|delivery|dei|training|sales) partner/i,

  LEVEL_NAMES: ["", "Entry", "Analyst", "Consultant", "Senior", "Manager", "Senior manager", "Director", "Executive"],
  EXEC_MULT: 1.8,

  // Employer pay tiers. India multipliers differ from elsewhere, because the
  // gap between IT services and product companies is much wider in India.
  TIER_MULT: {
    IN: { A: 1.8, B: 1.35, C: 1.0, D: 0.85, E: 0.6 },
    OTHER: { A: 1.6, B: 1.25, C: 1.0, D: 0.9, E: 0.8 }
  },
  TIER_NAMES: { A: "Top-paying employer", B: "Well-paying employer", C: "Large employer", D: "Unknown employer", E: "IT services or BPO" },
  TIERS: [
    { tier: "E", re: /\b(tcs|tata consultancy|infosys|wipro|hcl|hcltech|tech mahindra|cognizant|capgemini|ltimindtree|lti|mindtree|mphasis|hexaware|genpact|wns|concentrix|teleperformance|firstsource|exl|sutherland|conduent|persistent systems|coforge|birlasoft|zensar|cyient|sonata software|mastek|ust|virtusa|l&t technology|ltts|igate|startek|ibm consulting delivery)\b/i },
    { tier: "A", re: /\b(google|alphabet|meta|facebook|apple|microsoft|amazon|aws|netflix|nvidia|openai|anthropic|stripe|uber|linkedin|salesforce|adobe|atlassian|databricks|snowflake|airbnb|coinbase|goldman sachs|d\.? ?e\.? shaw|jane street|tower research|citadel|two sigma|optiver|mckinsey|boston consulting|bcg|bain)\b/i },
    { tier: "B", re: /\b(careem|noon|talabat|adyen|klarna|zalando|delivery hero|asml|n26|revolut|wise|flipkart|swiggy|zomato|eternal|phonepe|razorpay|cred|meesho|paytm|zepto|ola|freshworks|zoho|intuit|oracle|sap|servicenow|vmware|broadcom|cisco|intel|qualcomm|samsung|walmart|jp ?morgan|jpmorgan chase|morgan stanley|american express|amex|visa|mastercard|paypal|booking\.com|expedia|spotify|shopify|workday|kearney|oliver wyman|roland berger|strategy&|browserstack|postman|groww|dream11|myntra|nykaa|lenskart|policybazaar|udaan|sharechat|inmobi)\b/i },
    { tier: "C", re: /\b(emirates nbd|adnoc|emirates|etisalat|e&|majid al futtaim|ing|abn amro|rabobank|ericsson|volvo|allianz|deloitte|ey|ernst|kpmg|pwc|pricewaterhouse|accenture|ibm|gartner|mercer|aon|wtw|willis towers|hsbc|barclays|citi|citibank|deutsche bank|standard chartered|ubs|bny|state street|unilever|hindustan unilever|p&g|procter|nestle|siemens|bosch|philips|shell|reliance|tata steel|tata motors|mahindra|titan|ntt data|nttdata|hdfc|icici|axis bank|kotak|bajaj|airtel|jio|dell|hp|hewlett|lenovo|schneider|abb|ge|honeywell|pepsico|coca-cola|diageo|l'oreal|loreal)\b/i }
  ],

  // Words that appear on cards and headlines but are never a title, company or place.
  NOISE: /^([·•‧∙].*|(1st|2nd|3rd\+?)( degree connection)?|contact info|more|message|connect|follow|premium|verified|\d[\d,+]* (connections?|followers?)|.*mutual connections?|(he|she|they)\/\w+|open to|add profile section|enhance profile|resources|status is (online|offline|reachable).*|view .*profile|linkedin member|open to work|hiring|promoted|easy apply|apply|save|saved|viewed|applied|follow|following|connect|message|pending|premium|verified|show more|show less|see more|•.*|\d+(st|nd|rd|th)\+?|1st|2nd|3rd\+?|\(?(he|she|they)\/\w+\)?|actively reviewing applicants|be an early applicant|.*\bconnections? work here|.*alumni work here|.*mutual connections?|\d+ (applicants?|people clicked apply).*|₹.*|ballpark.*)$/i
};
