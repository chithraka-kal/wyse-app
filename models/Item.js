import mongoose from "mongoose";

const ItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  funded: { type: Number, default: 0 },
  zone: { type: String, enum: ['wishlist', 'saving'], required: true },
  tier: { type: String, enum: ['big', 'medium', 'small'], default: null },
  status: {
    type: String,
    enum: ['active', 'done', 'removed'],
    default: 'active',
  },
  priority: { type: Number, enum: [1, 2, 3], default: 2 },
  notes: { type: String, default: "" },
  url: { type: String, default: "" },
  imageUrl: { type: String, default: "" },
  aiSuggested: { type: Boolean, default: false },
  tags: [String],
  addedAt: { type: Date, default: Date.now },
});

export default mongoose.models.Item || mongoose.model("Item", ItemSchema);
