import mongoose from "mongoose";

const ItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  funded: { type: Number, default: 0 },
  zone: { type: String, enum: ["incubator", "definite"], required: true },
  tier: { type: String, enum: ["high", "mid", "low"], default: null },
  status: {
    type: String,
    enum: ["active", "done", "dropped"],
    default: "active",
  },
  promoteAfter: { type: Date, default: null },
  notes: { type: String, default: "" },
  url: { type: String, default: "" },
  imageUrl: { type: String, default: "" },
  aiSuggested: { type: Boolean, default: false },
  tags: [String],
  addedAt: { type: Date, default: Date.now },
});

export default mongoose.models.Item || mongoose.model("Item", ItemSchema);
