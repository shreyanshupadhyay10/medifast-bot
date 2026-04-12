require("dotenv").config();
const mongoose = require("mongoose");
const Pharmacy = require("../src/models/Pharmacy");
const Inventory = require("../src/models/Inventory");
const logger = require("../src/utils/logger");

const PHARMACIES = [
  {
    name: "Sharma Medical Store",
    area: "Mansarovar",
    address: "B-14, Mansarovar Sector 7, Jaipur 302020",
    contact: { phone: "0141-2391001", whatsapp: "9876501001" },
    openingHours: "8:00 AM – 10:00 PM",
    is24x7: false,
  },
  {
    name: "Jan Aushadhi Kendra",
    area: "Vaishali Nagar",
    address: "Shop 3, Vaishali Nagar Main Road, Jaipur 302021",
    contact: { phone: "0141-2393002", whatsapp: "9876502002" },
    openingHours: "9:00 AM – 9:00 PM",
    is24x7: false,
  },
  {
    name: "City Care Pharmacy",
    area: "Malviya Nagar",
    address: "12, Malviya Nagar Main Market, Jaipur 302017",
    contact: { phone: "0141-2521003", whatsapp: "9876503003" },
    openingHours: "Open 24×7",
    is24x7: true,
  },
  {
    name: "Rajasthan Medicos",
    area: "C-Scheme",
    address: "D-41, C-Scheme, Near Statue Circle, Jaipur 302001",
    contact: { phone: "0141-2361004", whatsapp: "9876504004" },
    openingHours: "8:30 AM – 11:00 PM",
    is24x7: false,
  },
  {
    name: "LifeCare 24 Pharmacy",
    area: "Tonk Road",
    address: "Shop 7, Durgapura, Tonk Road, Jaipur 302018",
    contact: { phone: "0141-2451005", whatsapp: "9876505005" },
    openingHours: "Open 24×7",
    is24x7: true,
  },
  {
    name: "Apollo Pharmacy",
    area: "Raja Park",
    address: "13-A, Raja Park Main Road, Jaipur 302004",
    contact: { phone: "0141-2601006", whatsapp: "9876506006" },
    openingHours: "8:00 AM – 10:30 PM",
    is24x7: false,
  },
  {
    name: "Gupta Medical Hall",
    area: "Sodala",
    address: "Near Sodala Circle, New Sanganer Road, Jaipur 302019",
    contact: { phone: "0141-2231007", whatsapp: "9876507007" },
    openingHours: "9:00 AM – 9:30 PM",
    is24x7: false,
  },
  {
    name: "MedPlus Pharmacy",
    area: "Pratap Nagar",
    address: "C-Block, Pratap Nagar, Sanganer, Jaipur 302033",
    contact: { phone: "0141-2791008", whatsapp: "9876508008" },
    openingHours: "8:00 AM – 10:00 PM",
    is24x7: false,
  },
];

// Medicine data: [medicineName, genericName, brand, category, price, unit, isRare, requiresPrescription]
const MEDICINE_TEMPLATES = [
  ["Paracetamol 500mg", "Paracetamol", "Calpol", "painkiller", 18, "strip", false, false],
  ["Dolo 650mg", "Paracetamol", "Dolo", "painkiller", 32, "strip", false, false],
  ["Ibuprofen 400mg", "Ibuprofen", "Brufen", "painkiller", 25, "strip", false, false],
  ["Metformin 500mg", "Metformin HCl", "Glycomet", "antidiabetic", 45, "strip", false, true],
  ["Metformin 1000mg", "Metformin HCl", "Glycomet GP", "antidiabetic", 82, "strip", false, true],
  ["Glimepiride 2mg", "Glimepiride", "Amaryl", "antidiabetic", 95, "strip", false, true],
  ["Amlodipine 5mg", "Amlodipine Besylate", "Amlopres", "cardiac", 55, "strip", false, true],
  ["Atorvastatin 10mg", "Atorvastatin", "Lipitor", "cardiac", 120, "strip", false, true],
  ["Atorvastatin 20mg", "Atorvastatin", "Storvas", "cardiac", 195, "strip", false, true],
  ["Azithromycin 500mg", "Azithromycin", "Azee", "antibiotic", 85, "strip", false, true],
  ["Amoxicillin 500mg", "Amoxicillin", "Mox", "antibiotic", 65, "strip", false, true],
  ["Ciprofloxacin 500mg", "Ciprofloxacin", "Ciplox", "antibiotic", 72, "strip", false, true],
  ["Omeprazole 20mg", "Omeprazole", "Omez", "gastro", 38, "strip", false, false],
  ["Pantoprazole 40mg", "Pantoprazole", "Pan 40", "gastro", 42, "strip", false, false],
  ["Ondansetron 4mg", "Ondansetron", "Emeset", "gastro", 55, "strip", false, false],
  ["Cetirizine 10mg", "Cetirizine HCl", "Zyrtec", "respiratory", 22, "strip", false, false],
  ["Montelukast 10mg", "Montelukast", "Montair", "respiratory", 145, "strip", false, true],
  ["Salbutamol Inhaler", "Salbutamol", "Asthalin", "respiratory", 145, "inhaler", false, true],
  ["Vitamin D3 60K", "Cholecalciferol", "D-Rise", "vitamins", 35, "capsule", false, false],
  ["Vitamin B12 1500mcg", "Methylcobalamin", "Cobalamin", "vitamins", 85, "strip", false, false],
  ["Multivitamin", "Multivitamin", "Supradyn", "vitamins", 120, "strip", false, false],
  ["Betamethasone Cream", "Betamethasone", "Betnovate", "dermatology", 65, "tube", false, true],
  ["Clotrimazole Cream", "Clotrimazole", "Canesten", "dermatology", 45, "tube", false, false],
  ["Clonazepam 0.5mg", "Clonazepam", "Rivotril", "neurological", 55, "strip", true, true],
  ["Clonazepam 2mg", "Clonazepam", "Rivotril", "neurological", 95, "strip", true, true],
  ["Levodopa 250mg", "Levodopa/Carbidopa", "Syndopa", "neurological", 210, "strip", true, true],
  ["Tacrolimus 0.5mg", "Tacrolimus", "Pangraf", "other", 850, "strip", true, true],
  ["Mycophenolate 500mg", "Mycophenolate Mofetil", "Cellcept", "other", 1200, "strip", true, true],
];

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info("Connected to MongoDB for seeding");

    // Clear existing data
    await Pharmacy.deleteMany({});
    await Inventory.deleteMany({});
    logger.info("Cleared existing data");

    // Insert pharmacies
    const pharmacies = await Pharmacy.insertMany(PHARMACIES);
    logger.info(`Inserted ${pharmacies.length} pharmacies`);

    // Assign medicines to pharmacies randomly
    // Each pharmacy gets 60-80% of the medicines list, with random stock statuses
    const inventoryDocs = [];

    for (const pharmacy of pharmacies) {
      const shuffled = [...MEDICINE_TEMPLATES].sort(() => Math.random() - 0.5);
      const count = Math.floor(MEDICINE_TEMPLATES.length * (0.6 + Math.random() * 0.2));
      const assigned = shuffled.slice(0, count);

      for (const [medicineName, genericName, brand, category, price, unit, isRare, requiresPrescription] of assigned) {
        // Rare medicines are out of stock 70% of the time
        const inStock = isRare ? Math.random() > 0.7 : Math.random() > 0.15;

        inventoryDocs.push({
          medicineName,
          medicineNameLower: medicineName.toLowerCase(),
          genericName,
          brand,
          category,
          price,
          unit,
          isRare,
          requiresPrescription,
          inStock,
          pharmacy: pharmacy._id,
          lastVerified: new Date(Date.now() - Math.random() * 48 * 60 * 60 * 1000), // verified within last 48h
        });
      }
    }

    await Inventory.insertMany(inventoryDocs, { ordered: false });
    logger.info(`Inserted ${inventoryDocs.length} inventory records`);

    // Print summary
    const inStockCount = inventoryDocs.filter((d) => d.inStock).length;
    logger.info(`\n✅ Seed complete!`);
    logger.info(`   Pharmacies: ${pharmacies.length}`);
    logger.info(`   Inventory records: ${inventoryDocs.length}`);
    logger.info(`   In Stock: ${inStockCount}`);
    logger.info(`   Out of Stock: ${inventoryDocs.length - inStockCount}`);

    process.exit(0);
  } catch (error) {
    logger.error(`Seed failed: ${error.message}`);
    process.exit(1);
  }
};

seed();
