// Preview the code extracted from every BloodItems name.
import { readFileSync } from "fs";
import { extractCodes } from "../lib/itemCode";
const items = JSON.parse(readFileSync("data/BloodItems.json", "utf-8"));
for (const i of items) console.log(String(i.Item_AID).padStart(2), "|", extractCodes(i.Item_Name.trim().replace(/\s*\n\s*/g, " / ")).join(", ").padEnd(22), "|", i.Item_Name.replace(/\n/g, " / "));
