import mongoose from "mongoose";

const AllocationSchema = new mongoose.Schema({
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Item",
    required: true,
  },
  amount: { type: Number, required: true },
});

const FundSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  source: { type: String, default: "manual" },
  unallocated: { type: Number, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  allocations: [AllocationSchema],
  aiAssisted: { type: Boolean, default: false },
  receivedAt: { type: Date, default: Date.now },
});

export default mongoose.models.Fund || mongoose.model("Fund", FundSchema);
