/**
 * What the public batch page says about a product beyond its name: a short story, highlights,
 * typical nutrition and how to store it. Ported from the Gaia Fresh app (lib/product_info.dart) so
 * the app and the batch page say the same thing; a product's own description from the Product
 * Master wins over the story. Nutrition is typical for the kind of product, not a lab value for
 * the batch - the page says so.
 */
export interface ProductInfo {
  about: string;
  highlights: string[];
  nutrition: [string, string][];
  storage: string;
  per: string;
}

const CHILLED = "Keep refrigerated at or below 4°C. Once opened, use within 2 days.";

const MILK: ProductInfo = {
  per: "100 ml",
  about: "Fresh Gaia milk, collected from our partner farmers, chilled at the village centre and pasteurised and packed at our plant - so it reaches you fresh every morning. Great for tea, coffee, cereal or a warm glass at bedtime.",
  highlights: ["Antibiotic free", "Untouched by hand", "Pasteurised", "Source of calcium"],
  nutrition: [["Energy", "64 kcal"], ["Protein", "3.3 g"], ["Fat", "3.5 g"], ["Carbohydrate", "4.7 g"], ["Calcium", "120 mg"]],
  storage: "Keep refrigerated at or below 4°C. Boil before use and consume within 24 hours of opening.",
};
const UHT: ProductInfo = {
  per: "100 ml",
  about: "Gaia UHT milk is heated to ultra-high temperature and sealed in a multi-layer pack, so it stays fresh without refrigeration until opened. Handy for travel, the office and the store cupboard - no boiling needed.",
  highlights: ["Antibiotic free", "No refrigeration till opened", "Ready to drink", "Source of calcium"],
  nutrition: [["Energy", "62 kcal"], ["Protein", "3.2 g"], ["Fat", "3.0 g"], ["Carbohydrate", "4.9 g"], ["Calcium", "120 mg"]],
  storage: "Store in a cool, dry place away from sunlight. Once opened, refrigerate and use within 2 days.",
};
const PANEER: ProductInfo = {
  per: "100 g",
  about: "Soft, fresh Gaia malai paneer made from pure milk. It holds its shape in curries, tikka and bhurji and stays soft in every bite - a simple way to add protein to everyday meals.",
  highlights: ["Rich in protein", "Source of calcium", "Soft & fresh"],
  nutrition: [["Energy", "265 kcal"], ["Protein", "18 g"], ["Fat", "20 g"], ["Carbohydrate", "1.2 g"], ["Calcium", "480 mg"]],
  storage: CHILLED,
};
const LOW_FAT_PANEER: ProductInfo = {
  per: "100 g",
  about: "Gaia Low Fat Paneer gives you the bite of fresh paneer with less fat - made for people watching their fat intake without giving up protein.",
  highlights: ["Low fat", "Rich in protein", "Source of calcium"],
  nutrition: [["Energy", "185 kcal"], ["Protein", "22 g"], ["Fat", "10 g"], ["Carbohydrate", "3.0 g"], ["Calcium", "500 mg"]],
  storage: CHILLED,
};
const DAHI: ProductInfo = {
  per: "100 g",
  about: "Thick, creamy Gaia dahi set from pasteurised milk with live cultures. Enjoy it plain, as raita, or with parathas - naturally good for digestion.",
  highlights: ["Live cultures", "Good for digestion", "Source of calcium", "Pasteurised"],
  nutrition: [["Energy", "60 kcal"], ["Protein", "3.1 g"], ["Fat", "3.0 g"], ["Carbohydrate", "4.5 g"], ["Calcium", "120 mg"]],
  storage: CHILLED,
};
const KADHI_DAHI: ProductInfo = {
  per: "100 g",
  about: "Gaia Kadhi Dahi is set slightly tangy, just right for kadhi, marinades, dhokla and batters - the sourness cooking needs, without waiting a day for it.",
  highlights: ["Made for cooking", "Live cultures", "Pasteurised"],
  nutrition: [["Energy", "50 kcal"], ["Protein", "3.0 g"], ["Fat", "2.0 g"], ["Carbohydrate", "4.5 g"], ["Calcium", "110 mg"]],
  storage: CHILLED,
};
const LASSI: ProductInfo = {
  per: "100 ml",
  about: "Chilled Gaia lassi, churned from fresh dahi - thick, sweet and refreshing. Best served cold on a hot afternoon.",
  highlights: ["Serve chilled", "Made from fresh dahi", "Ready to drink"],
  nutrition: [["Energy", "90 kcal"], ["Protein", "2.5 g"], ["Fat", "2.0 g"], ["Carbohydrate", "15 g"], ["Calcium", "90 mg"]],
  storage: "Keep refrigerated at or below 4°C. Shake well and drink soon after opening.",
};
const CHAAS: ProductInfo = {
  per: "100 ml",
  about: "Gaia Masala Chaas - light buttermilk with a touch of spices. Cools you down and goes well with any meal.",
  highlights: ["Serve chilled", "Light & cooling", "Ready to drink"],
  nutrition: [["Energy", "25 kcal"], ["Protein", "1.2 g"], ["Fat", "0.8 g"], ["Carbohydrate", "3.0 g"], ["Calcium", "50 mg"]],
  storage: "Keep refrigerated at or below 4°C. Shake well before serving.",
};
const SWEET: ProductInfo = {
  per: "100 g",
  about: "A traditional Gaia sweet made from milk the slow way - rich, creamy and just sweet enough. Perfect for festivals, guests or an after-dinner treat.",
  highlights: ["Festive favourite", "Made from pure milk"],
  nutrition: [["Energy", "300 kcal"], ["Protein", "8 g"], ["Fat", "15 g"], ["Carbohydrate", "35 g"]],
  storage: CHILLED,
};
const PEDA: ProductInfo = {
  per: "100 g",
  about: "Gaia peda, cooked down from milk and khowa the traditional way. Soft, melt-in-the-mouth and made for sharing.",
  highlights: ["Festive favourite", "Made from pure milk"],
  nutrition: [["Energy", "420 kcal"], ["Protein", "10 g"], ["Fat", "15 g"], ["Carbohydrate", "60 g"]],
  storage: "Store in a cool, dry place or refrigerate. Best consumed within a few days of opening.",
};
const KHOWA: ProductInfo = {
  per: "100 g",
  about: "Unsweetened Gaia khowa (mawa), slow-cooked from milk until rich and grainy - the base for gulab jamun, barfi, halwa and peda.",
  highlights: ["For sweets & cooking", "Unsweetened", "Rich in protein"],
  nutrition: [["Energy", "420 kcal"], ["Protein", "20 g"], ["Fat", "25 g"], ["Carbohydrate", "25 g"]],
  storage: CHILLED,
};
const GHEE: ProductInfo = {
  per: "100 g",
  about: "Gaia Desi Ghee is slow-cooked from cream the traditional way for its rich aroma and grainy texture. A spoon on hot rotis or dal, or use it for tadka and sweets.",
  highlights: ["Slow-cooked", "Rich aroma", "Grainy texture"],
  nutrition: [["Energy", "897 kcal"], ["Fat", "99.7 g"], ["Protein", "0 g"], ["Carbohydrate", "0 g"]],
  storage: "Store in a cool, dry place away from sunlight. Use a dry spoon. No refrigeration needed.",
};

/** The same rules as the app's infoFor(): by category, then name. */
export function productInfo(category: string | null, name: string, description?: string | null): ProductInfo {
  const c = `${category ?? ""} ${name}`.toLowerCase();
  const base =
    c.includes("uht") ? UHT
    : c.includes("low fat paneer") ? LOW_FAT_PANEER
    : c.includes("paneer") ? PANEER
    : c.includes("kadhi") ? KADHI_DAHI
    : c.includes("dahi") || c.includes("curd") ? DAHI
    : c.includes("lassi") ? LASSI
    : c.includes("chaas") || c.includes("butter milk") ? CHAAS
    : c.includes("ghee") ? GHEE
    : c.includes("peda") ? PEDA
    : c.includes("khowa") || c.includes("mawa") ? KHOWA
    : c.includes("rabdi") || c.includes("shrikhand") ? SWEET
    : c.includes("milk") ? MILK
    : SWEET;
  // cow milk runs richer than toned
  const nutrition: [string, string][] = base === MILK && name.toLowerCase().includes("cow")
    ? [["Energy", "67 kcal"], ["Protein", "3.1 g"], ["Fat", "4.0 g"], ["Carbohydrate", "4.7 g"], ["Calcium", "120 mg"]]
    : base.nutrition;
  const about = description && description.trim() ? description.trim() : base.about;
  return { ...base, about, nutrition };
}
