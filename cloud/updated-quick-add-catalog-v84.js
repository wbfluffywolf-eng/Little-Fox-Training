export const updatedQuickAddHeaders = [
  "brand",
  "product_name",
  "product_type",
  "size",
  "diapers_or_inserts_per_bag",
  "diapers_or_inserts_per_case",
  "price_per_bag_or_pack_usd",
  "price_per_case_usd",
  "price_per_40_case_usd",
  "price_per_80_case_usd",
  "unit_or_sample_price_usd",
  "colors_or_prints"
];

const rows = [];
const ecoColors = "Black; Gray/Grey; White; Navy Blue; Olive Green; Deep Red; Mauve; Blue Camo; Purple Camo; Black Lace; Leopard; Marble; Black Arrow; Atom; Biohazard; Coder; Abstract; Bang Boom Comic; Cosmic Realm; Cyber Flower; Dragon; Skulls & Roses; Wolf; Caramel; Dusty Rose; Pacific; Submarine";

function add(brand, name, type, sizes, bag, cases, bagPrice = "", casePrice = "", p40 = "", p80 = "", unit = "", colors = "") {
  String(sizes || "One size").split(";").map(size => size.trim()).filter(Boolean).forEach(size => {
    rows.push([brand, name, type, size, bag, cases, bagPrice, casePrice, p40, p80, unit, colors]);
  });
}

[
  ["PeekABU", "Medium; Large; XL; XL+", "From $42.99"],
  ["LittlePawz", "Small; Medium; Large; XL", "From $40.99"],
  ["Little Kings", "Medium; Large; XL", "From $46.99"],
  ["Super Dry Kids", "Medium; Large; XL", "From $32.99"],
  ["AlphaGatorZ", "Medium; Large; XL", "From $46.99"],
  ["DinoRawrZ", "Medium; Large; XL", "From $34.99"],
  ["BunnyHopps 4-Tape", "Medium; Large; XL", "From $40.99"],
  ["TinyTails", "Small; Medium; Large; XL", "From $44.99"],
  ["Simple Ultra", "Medium; Large; XL", "From $38.99"],
  ["Oops All Huskies", "Medium; Large; XL; XL+", "From $42.99"],
  ["Simple Daytime", "Small; Medium; Large; XL", "From $37.99"]
].forEach(([name, sizes, price]) => add("ABU", name, "Disposable diaper", sizes, "10 diapers", "40 diapers; 80 diapers", price));
add("ABU", "PowerUps Europe Edition", "Booster insert", "One size", "20 inserts", "80 inserts; 160 inserts", "29.99");

[
  ["EcoAble Pocket Cloth Diaper 2.0 - Reusable Adult Diaper Shell", "Diaper shell - Pocket shell only / customizable absorbency", "$32.99 - $37.99", ecoColors],
  ["EcoAble Diaper Cover 2.0 - Reusable Waterproof Adult Diaper Cover", "Diaper shell - Waterproof cover shell only / double-layer PUL", "$30.99 - $34.99", ecoColors],
  ["EcoAble Pocket Cloth Diaper 2.0 with Snap-In Insert", "Diaper kit - Light-to-moderate daytime pocket diaper kit", "$43.99 - $49.99", ecoColors],
  ["EcoAble Diaper Cover 2.0 with Snap-In Insert", "Diaper kit - Light-to-moderate daytime cover kit", "$40.99 - $47.99", ecoColors],
  ["EcoAble Pocket Cloth Diaper 2.0 - Maximum Protection Kit", "Diaper kit - Moderate-to-heavy daytime pocket kit", "$53.99 - $61.99", ecoColors],
  ["EcoAble Diaper Cover 2.0 - Maximum Protection Kit", "Diaper kit - Moderate-to-heavy daytime cover kit", "$51.99 - $59.99", ecoColors],
  ["EcoAble Pocket Cloth Diaper 2.0 Day & Night Set", "Diaper kit - Overnight/day-night pocket kit", "$62.99 - $75.99", ecoColors],
  ["EcoAble Diaper Cover 2.0 Day & Night Set", "Diaper kit - Overnight/day-night cover kit", "$60.99 - $73.99", ecoColors],
  ["EcoAble Pull-On Diaper 2.0 Shell", "Diaper shell - Pull-up shell only / light daytime", "$27.99 - $38.99", ecoColors],
  ["EcoAble Pull-On Diaper 2.0 with Snap-In Insert", "Diaper kit - Pull-up daytime kit / light-to-moderate", "$44.99 - $50.99", ecoColors],
  ["EcoAble Pull-On Diaper 2.0 - Maximum Protection Kit", "Diaper kit - Pull-up daytime kit / moderate-to-heavy", "$54.99 - $62.99", ecoColors],
  ["EcoAble Adult Fitted Cloth Diaper", "Diaper / absorbent layer - High-absorbency fitted diaper only / overnight layer", "$41.99 - $48.99", "N/A"],
  ["EcoAble Adult Fitted Cloth Diaper with Snap-in Insert", "Diaper / absorbent layer set - High-absorbency fitted diaper + insert / nighttime layer", "$46.99 - $54.99", "N/A"],
  ["EcoAble Adult Snap-In Insert", "Booster / insert - Reusable bamboo-rayon/microfiber snap-in insert", "$23.99 - $46.99", "N/A"],
  ["EcoAble Adult Bamboo Cotton Prefold Booster", "Booster / insert - Bamboo-cotton prefold booster pad", "$25.99 - $50.99", "N/A"]
].forEach(([name, type, price, colors]) => add("EcoAble", name, type, "Small; Medium; Large", "", "N/A", price, "N/A", "", "", price, colors));

add("InControl", "InControl BeDry EliteCare Premium Incontinence Briefs", "Tape-style disposable brief", "Small; Medium; Large; X-Large", "12", "36", "$36.99", "$108.99", "", "", "$7.99");
add("InControl", "InControl BeDry EliteCare Incontinence Briefs - 2XL", "Tape-style disposable brief", "2XL", "12", "36", "$46.99", "$118.99", "", "", "$7.99");
add("InControl", "InControl BeDry Premium Incontinence Briefs", "Tape-style disposable brief", "Small; Medium; Large; X-Large", "16", "48", "$43.99", "$120.99", "", "", "$7.99");
add("InControl", "InControl BeDry Night Premium Incontinence Briefs", "Tape-style disposable brief", "Medium; Large; X-Large", "12", "36", "$41.99", "$118.99", "", "", "$7.99");
add("InControl", "InControl Active Air Incontinence Briefs", "Tape-style disposable brief", "Medium; Large; XL", "20", "60", "$50.99", "$144.99", "", "", "$7.99");
add("InControl", "BeDry Ultra Premium Underwear", "Disposable pull-up underwear", "S/M; L/XL; XL+", "12", "96", "", "", "", "", "$15.99");
add("InControl", "Incontrol Booster Pads - Unscented", "Disposable booster pad/insert", "One Size", "30", "180", "From $5.99 / $11.99", "$109.99");
add("InControl", "Harmony Nighttime Fitted Cloth Diaper", "Reusable fitted cloth diaper", "Small; Medium; Large; X-Large", "N/A - sold individually", "N/A - no case quantity shown", "$49.99 - $55.99", "N/A", "", "", "$49.99 - $55.99");
add("InControl", "Organic Adult Nighttime Prefold Cloth Diapers", "Reusable prefold cloth diaper", "X-Small; Small; Medium; Large; X-Large; 2X-Large; 3X-Large", "N/A - sold individually", "N/A - no case quantity shown", "", "", "", "", "16.00 - 39.00");
add("InControl", "Washable Incontinence Protective Briefs", "Reusable padded protective underwear/brief", "S; M; L; XL; 2XL; 3XL; 4XL", "N/A - sold individually", "N/A - no case quantity shown");
add("InControl", "Adult Pocket Diaper - Black", "Reusable pocket diaper", "One Size", "N/A - sold individually", "N/A - no case quantity shown", "", "", "", "", "29.99");
add("InControl", "Adult Pocket Diaper - White", "Reusable pocket diaper", "One Size", "N/A - sold individually", "N/A - no case quantity shown", "", "", "", "", "29.99");
add("InControl", "Blue Adult Swim Diaper", "Reusable swim diaper", "One Size", "N/A - sold individually", "N/A - no case quantity shown", "", "", "", "", "26.99");
add("InControl", "Adult Cotton Fitted Snap Diaper", "Reusable fitted snap cloth diaper", "Small; Medium; Large", "N/A - sold individually", "N/A - no case quantity shown", "", "", "", "", "29.99 - 36.99");
add("InControl", "InControl Bamboo Contour Booster Pads - 3", "Reusable booster pad/insert", "One Size", "N/A - sold as pack of 3", "N/A - no case quantity shown", "$21.99", "N/A", "", "", "$21.99");
add("InControl", "Adult Microfiber Booster Pads - 4", "Reusable booster pad/insert", "One Size", "N/A - sold as pack of 4", "N/A - no case quantity shown", "$26.99", "N/A", "", "", "$26.99");

add("Little Northwood", "Little Quest", "Disposable diaper", "M; L; XL", "Not listed", "Not listed", "$65.00 CAD");
add("Little Northwood", "Little Quest Sample Pack - 2 Diapers", "Disposable diaper sample pack", "M", "2", "N/A", "$20.00 CAD", "", "", "", "$20.00 CAD");

[
  ["Big Ears Baby", "From $39.99"],
  ["Cloud Ultra White", "From $35.99"],
  ["Dragoonz", "From $36.99"],
  ["Honey Tales", "From $39.99"],
  ["Little Melody", "From $35.99"],
  ["Rainbow Pastel Colors", "From $34.99"]
].forEach(([name, price]) => add("LNGU", name, "Disposable diaper", "M; L; XL", "10", "40; 80", price));

add("NorthShore", "NorthShore MegaMax 12-Hour Overnight HBL Diaper Style Briefs", "Tab-style disposable brief", "XS; S; M; L; XL; 2XL; 3XL", "Pack/10; Starter Pack/4; Case/40 (4/10s)", "40", "Starting at $14.99", "", "", "", "", "White; Blue; Pink; Black; Tie-Dye");
add("NorthShore", "NorthShore MegaMax 12-Hour Overnight HBL Diaper Style Briefs (USA v2)", "Tab-style disposable brief", "Selector shows S; M; L; XL; product specs list Medium and Large", "Pack/10; Starter Pack/4; Case/40 (4/10s)", "40", "Starting at $15.50", "", "", "", "", "White; Black; Purple; Blue; Pink");
add("NorthShore", "NorthShore MegaMax AirLock 9-Hour Breathable HBL Diaper Style Briefs", "Tab-style disposable breathable brief", "S; M; L; XL", "Pack/10; Starter Pack/4; Case/40 likely available by selector", "40 when Case/40 selector is used", "Starting at $15.50", "", "", "", "", "White");
add("NorthShore", "NorthShore MegaMax Lite 6-Hour Daytime HBL Diaper Style Briefs", "Tab-style disposable lighter-absorbency brief", "S; M; L; XL", "Selector-based; verify current pack/case count on product page", "Selector-based", "See product page; static text did not expose starting price in this pass", "", "", "", "", "White / product colors via selector");
add("NorthShore", "NorthShore GoSupreme 8-Hour Overnight HBL Pull-Up Incontinence Underwear", "Pull-up disposable underwear", "S; M; L; XL; plus larger sizes shown in NorthShore size guidance", "Starter/sample/pack options via NorthShore selector", "Selector-based", "Starting at $9.50", "", "", "", "", "White; Black");
add("NorthShore", "NorthShore DynaDry Supreme Heavy Incontinence Liners", "Pad / liner", "Unisex liner; size varies by package/model", "Selector-based", "Selector-based", "Starting at $14.99", "", "", "", "", "White");

add("Potty Training Dropouts", "BeddyByes", "Disposable diaper", "S; M; L; XL", "10", "40", "$39.00", "", "", "", "Sample option available; page price shown $39.00 before selector confirmation");

add("Threaded Armor", "Lounge Brief: Reusable Pull-On Adult Cloth Diaper with Built-in Absorbency", "Diaper - Pull-on brief / built-in absorbency", "Small; Medium; Large; XL", "Reusable / single item or kit", "N/A", "From $64.99", "N/A", "", "", "From $64.99", "Tux; Navy; Dove; White; Azalea; Breeze; Blue Ridge; Capybara; Bookworm; Violet; Pretty in Pink (sold out); Gotham; Arthur (sold out); Sailboat");
add("Threaded Armor", "Threaded Armor Reusable Protective Briefs", "Diaper - Protective brief / classic or with snaps option", "Small; Medium; Large; XL", "Reusable / single item or kit", "N/A", "$64.99", "N/A", "", "", "$64.99", "Tux; Dove; Navy; White; Azalea (sold out); Breeze; Blue Ridge (sold out); Capybara (sold out); Bookworm; Arthur (sold out); Violet; Sailor; Pretty in Pink (unavailable); Gotham (unavailable)");
add("Threaded Armor", "Protective Briefs with Snaps", "Diaper - Protective brief with side snaps / snap-in absorbency", "Small; Medium; Large; XL", "Reusable / single item or kit", "N/A", "$64.99", "N/A", "", "", "$64.99", "White; Navy; Breeze; Dove; Tux; Violet; Gotham; Dynasty");
add("Threaded Armor", "The Basic Brief - Adult Diaper Lite", "Diaper - Daytime adult diaper lite / built-in absorbency", "Small; Medium; Large; XL", "Reusable / single item or kit", "N/A", "$54.99", "N/A", "", "", "$54.99", "Dove; Sailboat; Tux; Navy; White");
add("Threaded Armor", "Protective Brief Packs", "Diaper pack - 3-pack or 5-pack protective brief bundle", "Small; Medium; Large; XL", "", "N/A", "From $194.00", "N/A", "", "", "From $194.00", "Variety - Male; Variety - Female; White; Tux; Navy; Sailor; Dove; Violet");
add("Threaded Armor", "Adult Diaper Soaker Bomb", "Booster / insert - Microfiber booster pad", "Regular; XL", "", "N/A", "$14.95", "N/A", "", "", "$14.95", "N/A");
add("Threaded Armor", "Adult Diaper Step-up Insert", "Booster / insert - Step-up microfiber insert", "S/M 1; L/XL 2", "", "N/A", "$14.95", "N/A", "", "", "$14.95", "N/A");
add("Threaded Armor", "Diaper Pad Absorbency Set", "Booster / insert set - 2-piece absorbency set", "S; M; L; XL", "", "N/A", "From $24.95", "N/A", "", "", "From $24.95", "N/A");
add("Threaded Armor", "Diaper Pad Set; 4 Pack", "Booster / insert pack - 4-pack diaper pad set", "See product page", "", "N/A", "From $99.80", "N/A", "", "", "From $99.80", "N/A");
add("Threaded Armor", "Snap-in Liner", "Booster / liner - Snap-in liner accessory", "Small; Medium; Large; XL", "", "N/A", "$19.95", "N/A", "", "", "$19.95", "N/A");

[
  ["Animooz Diapers", "$48"],
  ["Overnights Diapers", ""],
  ["Puppers Diapers", "$48"],
  ["Potty Monsters Diapers", "$48"],
  ["Waddlin Diapers", ""],
  ["Unicorn Diapers", "$48"],
  ["Camelot Diapers", ""],
  ["Purrfect Cafe Diapers", ""],
  ["Soggers Diapers", ""],
  ["Tighty Whities Diapers", ""],
  ["Cammies Blue Diapers", ""],
  ["Cammies Pink Diapers", ""],
  ["Tinimals Diapers", ""],
  ["Str8up Blue", "$50"],
  ["Str8up White", "$50"],
  ["Str8up Pink", "$50"],
  ["Str8up Black", "$50"],
  ["Little Rascals Diapers", "$50"],
  ["Little Rawrs Diapers", ""],
  ["Galactic Diapers", ""]
].forEach(([name, price]) => add("Tykables", name, "Disposable diaper", "Medium; Large; XL", "10 diapers", "40 diapers; 80 diapers", price));
add("Tykables", "Detective Marty Step-Ins", "Disposable pull-on / Step-In diaper", "Medium; Large; XL", "15 Step-Ins", "60 Step-Ins; 120 Step-Ins", "$40");
add("Tykables", "Dubbler Booster Pads", "Booster insert", "One size", "14 inserts", "84 inserts");
add("Tykables", "Little Builders Diapers", "Disposable diaper", "Not listed", "Not listed", "Not listed");
add("Tykables", "Deluge Diapers", "Disposable diaper", "Not listed", "Not listed", "Not listed");

export const updatedQuickAddRows = rows;
