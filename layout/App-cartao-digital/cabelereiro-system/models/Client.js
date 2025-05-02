import mongoose from "mongoose";

const ClientSchema = new mongoose.Schema({
  name: String,
  checkIns: {
    type: Number,
    default: 0,
  },
  freeCuts: {
    type: Number,
    default: 0,
  },
});

export const Client = mongoose.models.Client || mongoose.model("Client", ClientSchema);
