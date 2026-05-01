import mongoose from "mongoose";

const AgentLogSchema = new mongoose.Schema({
  type: { type: String, enum: ["interrogate", "allocate", "categorise"] },
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Item",
    default: null,
  },
  prompt: { type: String },
  response: { type: String },
  success: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.AgentLog || mongoose.model("AgentLog", AgentLogSchema);
